/**
 * A stored view whose mode has no preset here renders as a table; calendar is
 * render-only (ADR 0035 §6, issue B3; labre ADR-0046 §8).
 *
 * Up to 0.48 `viewMetaGet` threw `Unknown view type` for any mode outside
 * table / kanban / calendar: one `timeline` view from an import, or a
 * `gallery` written by a newer client, and the whole database rendered
 * nothing. This suite mounts a database holding a `calendar`, a `timeline`
 * and an invented mode and would have caught that throw, plus the three ways
 * the fix could quietly go wrong:
 *
 * - writing on load: a fallback view must leave `props.views` deep-equal,
 *   its settings must not write either, while its cells stay editable;
 * - offering calendar again: creatable ⊂ renderable, and no menu the source
 *   feeds (views bar "+" / "Create …", Layout, conversions, slash entries)
 *   names calendar as a target, while a stored calendar keeps its preset and
 *   its conversions out;
 * - a mode spelled like an `Object` member (`constructor`, `__proto__`)
 *   finding a prototype member instead of the fallback.
 *
 * The host side (the Labre app) is held by its own `lib-boundary.test.ts`.
 */
import {
  DatabaseBlockSchemaExtension,
  type DatabaseBlockModel,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { FeatureFlagService } from '@labre/affine-shared/services';
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
import { beforeAll, describe, expect, test } from 'vitest';

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

  // Written the way a 0.48 client wrote them: a table and a calendar through
  // the view manager, then two views no preset here knows.
  const writer = new DatabaseBlockDataSource(model);
  const tableId = writer.viewManager.viewAdd(viewPresets.tableViewMeta.type);
  const calendarId = writer.viewManager.viewAdd(
    viewPresets.calendarViewMeta.type
  );
  store.updateBlock(model, {
    views: [...model.props.views, TIMELINE, INVENTED] as never,
  });
  writer.dispose();

  return { store, model, status, rowId, tableId, calendarId };
}

beforeAll(() => {
  // The table UI logic builds its controllers' elements at construction.
  if (!customElements.get('affine-data-view-renderer')) dataViewEffects();
});

const storedViews = (model: DatabaseBlockModel) =>
  JSON.parse(JSON.stringify(model.props.views)) as unknown[];

describe('an unknown view mode renders as a table', () => {
  test('a database holding calendar, timeline and an invented mode mounts', () => {
    const { model, status, rowId, tableId, calendarId } = createDatabase();
    const before = storedViews(model);

    // As on load: a fresh source, every view built, every UI logic made.
    const source = new DatabaseBlockDataSource(model);
    const root = new DataViewRootUILogic({ dataSource: source } as never);
    for (const id of [tableId, calendarId, TIMELINE.id, INVENTED.id]) {
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
    expect(meta(calendarId)).toBe('calendar');
    expect(meta(TIMELINE.id)).toBe('table');
    expect(meta(INVENTED.id)).toBe('table');

    const shown = (id: string) =>
      source.viewManager.viewGet(id)?.shownAsFallback$.value;
    expect(shown(tableId)).toBe(false);
    expect(shown(calendarId)).toBe(false);
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
    const calendarId = (before[1] as { id: string }).id;
    expect(duplicateAsShownPreset(source.viewManager, calendarId)).toBe(
      undefined
    );
  });

  test.each(['constructor', '__proto__', 'toString', '', 'TABLE'])(
    'mode %j falls back to the table preset',
    mode => {
      expect(databaseBlockViewMetaGet(mode)).toBe(viewPresets.tableViewMeta);
    }
  );
});

describe('calendar renders but is never created', () => {
  const types = (metas: { type: string }[]) => metas.map(meta => meta.type);

  test('creatable presets are a subset of the renderable ones', () => {
    const renderable = new Set(types(databaseBlockRenderableViews));
    for (const type of types(databaseBlockViews)) {
      expect(renderable.has(type), type).toBe(true);
    }
    expect(renderable.has('calendar')).toBe(true);
  });

  test('neither the views bar nor Layout lists calendar', () => {
    const { model } = createDatabase();
    const source = new DatabaseBlockDataSource(model);
    // "+", "Create …" and Layout all list `viewMetas`.
    expect(types(source.viewMetas)).not.toContain('calendar');
    expect(types(source.viewManager.viewMetas)).not.toContain('calendar');
  });

  test('no conversion goes into calendar, the ones out of it stay', () => {
    const { model } = createDatabase();
    const source = new DatabaseBlockDataSource(model);
    for (const converts of [databaseBlockViewConverts, source.viewConverts]) {
      expect(converts.filter(c => c.to === 'calendar')).toEqual([]);
      expect(
        converts.filter(c => c.from === 'calendar').map(c => c.to)
      ).toEqual(expect.arrayContaining(['table', 'kanban']));
    }
  });

  test('a stored calendar can still be switched to a table', () => {
    const { model, calendarId } = createDatabase();
    const source = new DatabaseBlockDataSource(model);
    source.viewManager.viewChangeType(calendarId, 'table');
    expect(source.viewManager.viewGet(calendarId)?.type).toBe('table');
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
