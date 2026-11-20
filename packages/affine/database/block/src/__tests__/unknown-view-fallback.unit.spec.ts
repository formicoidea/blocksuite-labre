/**
 * A stored view whose mode has no preset here renders as a table (ADR 0035
 * §6, issue B3; labre ADR-0046 §8); since 2.0 that includes `calendar`,
 * whose preset left the library (ADR 0035 amendment of 2026-10-29).
 *
 * Up to 0.48 `viewMetaGet` threw `Unknown view type` for any mode outside
 * table / kanban / calendar: one `timeline` view from an import, or a
 * `gallery` written by a newer client, and the whole database rendered
 * nothing. This suite mounts a database holding a `calendar` as a 1.x
 * client stored it, a `timeline` and an invented mode, and would have
 * caught that throw, plus the ways the fix could quietly go wrong:
 *
 * - writing on load: a fallback view must leave `props.views` deep-equal,
 *   its settings must not write either, while its cells stay editable;
 * - the calendar removal turning a stored calendar into an error, a blank
 *   database or a rewritten view, instead of the readable table fallback;
 * - offering calendar again: no preset, and no menu the source feeds (views
 *   bar "+" / "Create …", Layout, conversions, slash entries) names it;
 * - a mode spelled like an `Object` member (`constructor`, `__proto__`)
 *   finding a prototype member instead of the fallback.
 *
 * Issue #680 (Labre V2 drops its Calendar view and relies on this fallback)
 * names the calendar case: reading a stored calendar through the data
 * source, the UI logic and `setCurrentView` emits no Yjs update, and
 * `dataUpdate` called on it keeps its `mode` and its calendar keys (`date`,
 * `card`, `sources`); the views bar's tab menu offers "Duplicate as table"
 * on it (and only on a fallback view) but never the plain "Duplicate",
 * which would copy `mode: 'calendar'` into a new calendar view; the bar's
 * "+" lists no calendar. It would have caught a fallback that throws or
 * resolves nothing, the `dataUpdate` guard dropped, and the `hide` of
 * either duplicate entry inverted or removed.
 *
 * The host side (the Labre app) is held by its own `lib-boundary.test.ts`;
 * the painted DOM by `integration-test/…/page/database-stored-views.spec.ts`.
 */
import {
  DatabaseBlockSchemaExtension,
  type DatabaseBlockModel,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  effects as contextMenuEffects,
  type PopupTarget,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import {
  FeatureFlagService,
  TOOLBAR_DUPLICATE,
} from '@labre/affine-shared/services';
import {
  DataViewRootUILogic,
  duplicateAsShownPreset,
  type FilterGroup,
} from '@labre/affine-database-engine';
import { effects as dataViewEffects } from '@labre/affine-database-engine/effects';
import { propertyModelPresets } from '@labre/affine-database-engine/property-pure-presets';
import {
  type TableSingleView,
  viewPresets,
} from '@labre/affine-database-engine/view-presets';
import { Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { databaseSlashMenuConfig } from '../configs/slash-menu.js';
import { DatabaseBlockDataSource } from '../data-source.js';
import { addProperty } from '../utils/block-utils.js';
import {
  databaseBlockRenderableViews,
  databaseBlockViewConverts,
  databaseBlockViewMetaGet,
  databaseBlockViews,
} from '../views/index.js';

const TIMELINE = {
  id: 'v-timeline',
  name: 'Roadmap',
  mode: 'timeline',
  // Keys of a preset this client never had; they must survive untouched.
  range: { start: 'p-date', end: 'p-date-end' },
  zoom: 'quarter',
  filter: { kind: 'not-a-filter-group' },
};

/** A calendar as 0.48 to 1.x stored it (`calendarViewModel.defaultData`). */
const CALENDAR = {
  id: 'v-calendar',
  name: 'Calendar View',
  mode: 'calendar',
  filter: { type: 'group', op: 'and', conditions: [] },
  date: { startColumnId: 'p-date' },
  card: { titleColumnId: 'p-title', visiblePropertyIds: [] },
  sources: { workspaceCalendar: { enabled: true } },
  ui: {},
};

const INVENTED = {
  id: 'v-invented',
  name: 'From the future',
  mode: 'swimlane-2031',
  lanes: [{ id: 'l1', label: 'Now' }],
};

function createDatabase() {
  const collection = new TestWorkspace({
    id: 'unknown-view-fallback',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  collection.meta.initialize();
  const doc = collection.createDoc('doc0');
  doc.load();
  const store = doc.getStore({
    extensions: [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      ParagraphBlockSchemaExtension,
      DatabaseBlockSchemaExtension,
      FeatureFlagService,
    ],
  });
  const rootId = store.addBlock('affine:page', { title: new Text('views') });
  const noteId = store.addBlock('affine:note', {}, rootId);
  const databaseId = store.addBlock(
    'affine:database',
    { columns: [], title: new Text('Database') },
    noteId
  );
  const model = store.getModelById(databaseId) as DatabaseBlockModel;
  const status = addProperty(
    model,
    'end',
    propertyModelPresets.selectPropertyModelConfig.create('Status', {
      options: [{ id: 'o1', value: 'Done', color: 'var(--affine-tag-blue)' }],
    })
  );
  const rowId = store.addBlock(
    'affine:paragraph',
    { text: new Text('row one') },
    databaseId
  );

  // A table through the view manager, then three views no preset here
  // knows: a calendar of 1.x, an import's timeline, a newer client's mode.
  const writer = new DatabaseBlockDataSource(model);
  const tableId = writer.viewManager.viewAdd(viewPresets.tableViewMeta.type);
  store.updateBlock(model, {
    views: [...model.props.views, CALENDAR, TIMELINE, INVENTED] as never,
  });
  writer.dispose();

  return { store, model, status, rowId, tableId };
}

beforeAll(() => {
  // The table UI logic builds its controllers' elements at construction.
  if (!customElements.get('affine-data-view-renderer')) dataViewEffects();
  if (!customElements.get('affine-menu')) contextMenuEffects();
});

afterEach(() => {
  document.body.innerHTML = '';
});

const storedViews = (model: DatabaseBlockModel) =>
  JSON.parse(JSON.stringify(model.props.views)) as unknown[];

describe('an unknown view mode renders as a table', () => {
  test('a database holding calendar, timeline and an invented mode mounts', () => {
    const { model, status, rowId, tableId } = createDatabase();
    const before = storedViews(model);

    // As on load: a fresh source, every view built, every UI logic made.
    const source = new DatabaseBlockDataSource(model);
    const root = new DataViewRootUILogic({ dataSource: source } as never);
    for (const id of [tableId, CALENDAR.id, TIMELINE.id, INVENTED.id]) {
      source.viewManager.setCurrentView(id);
      const logic = root.currentView$.value;
      expect(logic, id).toBeDefined();
      const view = logic!.view;
      expect(view.properties$.value.length, id).toBeGreaterThan(0);
      expect(
        view.rows$.value.map(row => row.rowId),
        id
      ).toEqual([rowId]);
      expect(view.propertyMap$.value[status], id).toBeDefined();
    }

    const meta = (id: string) => source.viewManager.viewGet(id)?.meta.type;
    expect(meta(tableId)).toBe('table');
    expect(meta(CALENDAR.id)).toBe('table');
    expect(meta(TIMELINE.id)).toBe('table');
    expect(meta(INVENTED.id)).toBe('table');

    const shown = (id: string) =>
      source.viewManager.viewGet(id)?.shownAsFallback$.value;
    expect(shown(tableId)).toBe(false);
    expect(shown(CALENDAR.id)).toBe(true);
    expect(shown(TIMELINE.id)).toBe(true);
    expect(shown(INVENTED.id)).toBe(true);

    expect(storedViews(model)).toEqual(before);
  });

  test('a fallback view keeps its stored mode and reads the table defaults', () => {
    const { model } = createDatabase();
    const source = new DatabaseBlockDataSource(model);
    const view = source.viewManager.viewGet(TIMELINE.id) as TableSingleView;

    expect(view.type).toBe('timeline');
    expect(view.name$.value).toBe('Roadmap');
    // The stored `filter` is not a filter group: it is not trusted.
    expect(view.filterTrait.filter$.value.conditions).toEqual([]);
  });

  test('its settings never write, its cells do', () => {
    const { model, status, rowId } = createDatabase();
    const before = storedViews(model);
    const source = new DatabaseBlockDataSource(model);
    const view = source.viewManager.viewGet(TIMELINE.id) as TableSingleView;

    view.nameSet('Renamed');
    view.propertyGetOrCreate(status).hideSet(true);
    view.propertyGetOrCreate(status).updateWidth(400);
    view.filterTrait.filterSet({
      type: 'group',
      op: 'or',
      conditions: [],
    } satisfies FilterGroup);
    expect(storedViews(model)).toEqual(before);

    view.cellGetOrCreate(rowId, status).valueSet('o1');
    expect(source.cellValueGet(rowId, status)).toBe('o1');
  });

  test('"Duplicate as table" adds a table and leaves the stored view alone', () => {
    const { model } = createDatabase();
    const before = storedViews(model);
    const source = new DatabaseBlockDataSource(model);

    const id = duplicateAsShownPreset(source.viewManager, TIMELINE.id);
    expect(id).toBeDefined();
    const after = storedViews(model);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after[before.length]).toMatchObject({
      id,
      name: 'Roadmap',
      mode: 'table',
    });
    expect(source.viewManager.currentViewId$.value).toBe(id);

    // Not offered for a view this client draws with its own preset.
    const tableId = (before[0] as { id: string }).id;
    expect(duplicateAsShownPreset(source.viewManager, tableId)).toBe(undefined);
  });

  test.each(['constructor', '__proto__', 'toString', '', 'TABLE'])(
    'mode %j falls back to the table preset',
    mode => {
      expect(databaseBlockViewMetaGet(mode)).toBe(viewPresets.tableViewMeta);
    }
  );
});

describe('calendar is gone (2.0): drawn as a table, never created', () => {
  const types = (metas: { type: string }[]) => metas.map(meta => meta.type);

  test('creatable presets are a subset of the renderable ones, neither has calendar', () => {
    const renderable = new Set(types(databaseBlockRenderableViews));
    for (const type of types(databaseBlockViews)) {
      expect(renderable.has(type), type).toBe(true);
    }
    expect(renderable.has('calendar')).toBe(false);
    expect(Object.keys(viewPresets).join()).not.toMatch(/calendar/i);
  });

  test('a stored calendar reads as a table, its name and rows kept, nothing written', () => {
    const { model, rowId } = createDatabase();
    const before = storedViews(model);
    const source = new DatabaseBlockDataSource(model);
    const view = source.viewManager.viewGet(CALENDAR.id) as TableSingleView;

    expect(view.type).toBe('calendar');
    expect(view.meta.type).toBe('table');
    expect(view.name$.value).toBe('Calendar View');
    expect(view.rows$.value.map(row => row.rowId)).toEqual([rowId]);
    expect(storedViews(model)).toEqual(before);
  });

  test('neither the views bar nor Layout lists calendar', () => {
    const { model } = createDatabase();
    const source = new DatabaseBlockDataSource(model);
    // "+", "Create …" and Layout all list `viewMetas`.
    expect(types(source.viewMetas)).not.toContain('calendar');
    expect(types(source.viewManager.viewMetas)).not.toContain('calendar');
  });

  test('no conversion goes into or out of calendar', () => {
    const { model } = createDatabase();
    const source = new DatabaseBlockDataSource(model);
    for (const converts of [databaseBlockViewConverts, source.viewConverts]) {
      expect(
        converts.filter(c => c.to === 'calendar' || c.from === 'calendar')
      ).toEqual([]);
    }
  });

  test('"Duplicate as table" is the way out of a stored calendar', () => {
    const { model } = createDatabase();
    const source = new DatabaseBlockDataSource(model);
    const id = duplicateAsShownPreset(source.viewManager, CALENDAR.id);
    expect(id).toBeDefined();
    expect(source.viewManager.viewGet(id!)?.type).toBe('table');
  });

  test('no slash entry creates a calendar', () => {
    const items = databaseSlashMenuConfig.items;
    const list = typeof items === 'function' ? [] : items;
    expect(list.length).toBeGreaterThan(0);
    for (const item of list) {
      const words = [
        'name' in item ? item.name : '',
        ...('searchAlias' in item ? (item.searchAlias ?? []) : []),
      ].join(' ');
      expect(words.toLowerCase()).not.toContain('calendar');
    }
  });
});

type ViewsBar = HTMLElement & {
  dataViewLogic: unknown;
  openViewOption(target: PopupTarget, viewId: string): void;
  _addViewMenu(event: MouseEvent): void;
};

describe('#680: a stored calendar is read, never rewritten, and can leave as a table', () => {
  const storedCalendar = (model: DatabaseBlockModel) =>
    storedViews(model).find(
      view => (view as { id: string }).id === CALENDAR.id
    );

  /**
   * The views bar of a database, as its header builds it: the element
   * `dataViewEffects()` registers. Typed by shape, as `DataViewHeaderViews`
   * is exported from no entry point of the engine.
   */
  function viewsBar(source: DatabaseBlockDataSource, viewId: string) {
    const root = new DataViewRootUILogic({ dataSource: source } as never);
    source.viewManager.setCurrentView(viewId);
    const bar = document.createElement('data-view-header-views') as ViewsBar;
    bar.dataViewLogic = root.currentView$.value!;
    const anchor = document.createElement('div');
    document.body.append(anchor);
    return { bar, anchor, target: popupTargetFromElement(anchor) };
  }

  const byTestId = (id: string) =>
    document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  /**
   * A tab's menu, once painted ("Delete" closes every tab's menu): its
   * "Duplicate as table" entry, and whether it lists the plain "Duplicate"
   * (no test id: found by its English fallback, `std` being absent).
   */
  async function openTabMenu(source: DatabaseBlockDataSource, viewId: string) {
    const { bar, target } = viewsBar(source, viewId);
    bar.openViewOption(target, viewId);
    await vi.waitUntil(() =>
      document.querySelector('affine-menu .delete-item')
    );
    const names = [
      ...document.querySelectorAll('affine-menu .affine-menu-button'),
    ].map(item => item.textContent?.trim());
    return {
      asTable: byTestId('database-view-duplicate-as-table'),
      duplicate: names.includes(TOOLBAR_DUPLICATE[1]),
    };
  }

  // No block mounted, no Lit render: the real paint is held by
  // `integration-test/…/page/database-stored-views.spec.ts`, which compares
  // `props.views` deep-equal but does not count Yjs updates.
  test('reading through the data source, UI logic and `setCurrentView` emits no Yjs update; a direct `dataUpdate` keeps mode and calendar keys', () => {
    const { store, model } = createDatabase();
    expect(storedCalendar(model)).toEqual(CALENDAR);
    const updates: Uint8Array[] = [];
    const onUpdate = (update: Uint8Array) => updates.push(update);
    store.doc.spaceDoc.on('update', onUpdate);

    // What a load does below the view: a fresh source, its root UI logic,
    // the calendar made current and its view logic read.
    const source = new DatabaseBlockDataSource(model);
    const root = new DataViewRootUILogic({ dataSource: source } as never);
    source.viewManager.setCurrentView(CALENDAR.id);
    const view = root.currentView$.value!.view as TableSingleView;
    expect(view.meta).toBe(viewPresets.tableViewMeta);
    expect(view.properties$.value.length).toBeGreaterThan(0);
    expect(view.filterTrait.filter$.value.conditions).toEqual([]);

    // Every setting of the view funnels into `dataUpdate`; called directly,
    // with what a careless fallback would write, it writes nothing.
    view.dataUpdate(
      () =>
        ({
          mode: 'table',
          columns: [],
          date: undefined,
          card: undefined,
          sources: undefined,
        }) as never
    );

    store.doc.spaceDoc.off('update', onUpdate);
    expect(updates).toEqual([]);
    expect(storedCalendar(model)).toEqual(CALENDAR);
  });

  test('the tab menu offers "Duplicate as table" on the calendar, never "Duplicate", and it adds a table', async () => {
    const { model } = createDatabase();
    const source = new DatabaseBlockDataSource(model);

    const { asTable: entry, duplicate } = await openTabMenu(
      source,
      CALENDAR.id
    );
    // "Duplicate" copies the stored view as is: a new calendar view.
    expect(duplicate, '"Duplicate" offered').toBe(false);
    expect(entry, '"Duplicate as table" offered').not.toBe(null);
    entry!.click();

    const added = source.viewManager.currentViewId$.value!;
    expect(added).not.toBe(CALENDAR.id);
    expect(source.viewManager.viewGet(added)?.type).toBe('table');
    expect(storedCalendar(model)).toEqual(CALENDAR);
  });

  test('the tab menu of a view drawn with its own preset has "Duplicate", not "Duplicate as table"', async () => {
    const { model, tableId } = createDatabase();
    const source = new DatabaseBlockDataSource(model);

    const { asTable, duplicate } = await openTabMenu(source, tableId);
    expect(asTable).toBe(null);
    // Holds the calendar's `duplicate: false` to a lookup that can match.
    expect(duplicate).toBe(true);
  });

  test('the views bar "+" lists every creatable preset and no calendar', async () => {
    const { model } = createDatabase();
    const source = new DatabaseBlockDataSource(model);
    const { bar, anchor } = viewsBar(source, CALENDAR.id);

    bar._addViewMenu({ currentTarget: anchor } as never);
    await vi.waitUntil(() => byTestId('database-add-view-preset'));
    const names = [
      ...document.querySelectorAll('[data-testid="database-add-view-preset"]'),
    ].map(item => item.textContent?.trim().toLowerCase() ?? '');
    expect(names).toHaveLength(source.viewMetas.length);
    expect(names.filter(name => name.includes('calendar'))).toEqual([]);
  });
});
