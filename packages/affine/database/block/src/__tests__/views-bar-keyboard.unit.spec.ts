/**
 * The views bar (view tabs, "N more", "+") and the quick-setting bar's chips
 * (a filter, a filter group, "Add filter", the sorts) are reached from the
 * keyboard like the view toolbar beside them (#678's follow-up, WCAG 2.1.1,
 * 2.4.3, 4.1.2).
 *
 * 4.1.0 left them out of the tab order: Tab went from the title straight to
 * Filter, and a filter created from the keyboard could be neither edited
 * nor removed from it (its chip had no `tabindex`).
 *
 * What it would have caught:
 * - a tab or "+" out of the tab order, without a role, or without a name;
 * - the current view not said (`aria-current`), or a tab saying it opens a
 *   menu where its click opens none (another view's tab, a read-only view);
 * - "+" offered on a read-only document;
 * - a view picked from the keyboard dropping the focus on the body when the
 *   view drawn next redraws the bar (its tab must hold it);
 * - a filter chip, a group chip or "Add filter" out of the tab order, or a
 *   chip whose menu, opened from the keyboard, cannot remove the filter;
 *   the focus dropped on the body once the removed filter's chip is gone.
 *
 * The real keys (Tab order, Enter, Escape, the ring, the view's keys kept
 * out) are held by `integration-test/…/page/database-bars-keyboard.spec.ts`.
 */
import {
  DatabaseBlockSchemaExtension,
  type DatabaseBlockModel,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { effects as contextMenuEffects } from '@labre/affine-components/context-menu';
import { FeatureFlagService } from '@labre/affine-shared/services';
import {
  type DataSourceBase,
  DataViewRootUILogic,
  type DataViewUILogicBase,
  firstFilterInGroup,
  renderUniLit,
} from '@labre/affine-database-engine';
import { effects as dataViewEffects } from '@labre/affine-database-engine/effects';
import { VIEWS_BAR_ADD_VIEW } from '@labre/affine-database-engine/translations';
import type { TableSingleView } from '@labre/affine-database-engine/view-presets';
import { widgetPresets } from '@labre/affine-database-engine/widget-presets';
import { type Store, Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { html } from 'lit';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { DatabaseBlockDataSource } from '../data-source.js';

/** A stored table view: what the table preset's defaultData writes. */
const tableView = (id: string, name: string) => ({
  id,
  name,
  mode: 'table',
  columns: [],
  filter: { type: 'group', op: 'and', conditions: [] },
});
const TABLE = tableView('v1', 'Table View');
const SECOND = tableView('v2', 'Second');

const extensions = [
  RootBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  DatabaseBlockSchemaExtension,
  FeatureFlagService,
];

function database(views: readonly object[]): {
  store: Store;
  model: DatabaseBlockModel;
} {
  const collection = new TestWorkspace({
    id: 'views-bar-keyboard',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  collection.meta.initialize();
  const doc = collection.createDoc('doc0');
  doc.load();
  const store = doc.getStore({ extensions });
  const rootId = store.addBlock('affine:page', { title: new Text('page') });
  const noteId = store.addBlock('affine:note', {}, rootId);
  const databaseId = store.addBlock(
    'affine:database',
    { title: new Text('Plan'), views: views as never },
    noteId
  );
  store.addBlock('affine:paragraph', { text: new Text('row') }, databaseId);
  const model = store.getModelById(databaseId) as DatabaseBlockModel;
  store.resetHistory();
  return { store, model };
}

beforeAll(() => {
  if (!customElements.get('affine-data-view-renderer')) dataViewEffects();
  if (!customElements.get('affine-menu')) contextMenuEffects();
});

afterEach(() => {
  document.body.innerHTML = '';
});

/** Lit renders a level of nested elements per pass: the bars sit four down. */
const SETTLE_PASSES = 6;

const settle = () =>
  Array.from({ length: SETTLE_PASSES }).reduce<Promise<unknown>>(
    async previous => {
      await previous;
      return Promise.all(
        [...document.body.querySelectorAll('*')].map(
          element =>
            (element as Partial<{ updateComplete: Promise<unknown> }>)
              .updateComplete
        )
      );
    },
    Promise.resolve()
  );

const tools = widgetPresets.createTools({
  table: [widgetPresets.tools.filter, widgetPresets.tools.viewOptions],
});

/**
 * The root renderer, each view drawing what the database header draws of
 * it: the views bar, the toolbar's Filter and "⋯", the quick-setting bar.
 */
async function mount(source: DataSourceBase) {
  const root = new DataViewRootUILogic({
    dataSource: source,
    eventTrace: vi.fn(),
    selection$: signal(undefined),
    setSelection: () => {},
    viewPlaceholder: (logic: DataViewUILogicBase) => html`
      <data-view-header-views
        .dataViewLogic="${logic}"
      ></data-view-header-views>
      ${renderUniLit(tools, { dataViewLogic: logic })}
      ${renderUniLit(widgetPresets.quickSettingBar, { dataViewLogic: logic })}
    `,
  } as never);
  const element = document.createElement('affine-data-view-renderer');
  element.logic = root;
  document.body.append(element);
  await settle();
  return { root, element };
}

const all = (selector: string) => [
  ...document.querySelectorAll<HTMLElement>(selector),
];
const one = (selector: string) => document.querySelector<HTMLElement>(selector);

const tabOf = (id: string) =>
  one(`[data-testid="database-view-tab"][data-view-id="${id}"]`);

/** What Enter or Space sends on such a control: a click of detail 0. */
const keyboardClick = (element: HTMLElement) =>
  element.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 })
  );

describe('the views bar', () => {
  test('puts every tab and "+" in the tab order as named buttons, the current one said', async () => {
    const { model } = database([TABLE, SECOND]);
    await mount(new DatabaseBlockDataSource(model));

    const tabs = all('[data-testid="database-view-tab"]');
    expect(
      tabs.map(tab => ({
        role: tab.getAttribute('role'),
        tabIndex: tab.tabIndex,
        name: tab.textContent?.trim(),
        current: tab.getAttribute('aria-current'),
        popup: tab.getAttribute('aria-haspopup'),
      }))
    ).toEqual([
      {
        role: 'button',
        tabIndex: 0,
        name: TABLE.name,
        current: 'true',
        popup: 'menu',
      },
      {
        role: 'button',
        tabIndex: 0,
        name: SECOND.name,
        current: null,
        popup: null,
      },
    ]);
    const add = one('[data-testid="database-add-view-button"]')!;
    expect(add.getAttribute('role')).toBe('button');
    expect(add.tabIndex).toBe(0);
    expect(add.getAttribute('aria-label')).toBe(VIEWS_BAR_ADD_VIEW[1]);
    expect(add.getAttribute('aria-haspopup')).toBe('menu');
  });

  test('read-only: tabs still pick a view but open no menu, and there is no "+"', async () => {
    const { store, model } = database([TABLE, SECOND]);
    store.readonly = true;
    await mount(new DatabaseBlockDataSource(model));

    expect(tabOf(TABLE.id)?.getAttribute('aria-haspopup')).toBe(null);
    expect(tabOf(TABLE.id)?.tabIndex).toBe(0);
    expect(one('[data-testid="database-add-view-button"]')).toBe(null);
  });

  test('a view picked from the keyboard is current and its tab keeps the focus', async () => {
    const { model } = database([TABLE, SECOND]);
    const source = new DatabaseBlockDataSource(model);
    await mount(source);

    tabOf(SECOND.id)!.focus();
    keyboardClick(tabOf(SECOND.id)!);
    await settle();

    expect(source.viewManager.currentViewId$.value).toBe(SECOND.id);
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(tabOf(SECOND.id))
    );
    expect(tabOf(SECOND.id)?.getAttribute('aria-current')).toBe('true');
  });
});

describe('the keys and the pointer on the bars', () => {
  test("Tab stays the browser's, shortcuts and Escape reach the editor, a press drops the tabindex", async () => {
    const { model } = database([TABLE, SECOND]);
    const { element } = await mount(new DatabaseBlockDataSource(model));
    const editorKeydown = vi.fn();
    element.addEventListener('keydown', editorKeydown);
    const tab = tabOf(SECOND.id)!;
    const send = (init: KeyboardEventInit) =>
      tab.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          ...init,
        })
      );

    // The view's keys listen on the document: Tab there moved its cell.
    send({ key: 'Tab' });
    send({ key: 'Tab', shiftKey: true });
    expect(editorKeydown).not.toHaveBeenCalled();
    const passing: KeyboardEventInit[] = [
      { key: 'Escape' },
      { key: 'z', ctrlKey: true },
      { key: 'z', ctrlKey: true, shiftKey: true },
    ];
    passing.forEach(send);
    expect(
      editorKeydown,
      'Escape, undo and redo go through'
    ).toHaveBeenCalledTimes(passing.length);

    // As 4.0.0 drew it, a pressed tab takes no focus of its own.
    tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const during = tab.getAttribute('tabindex');
    window.dispatchEvent(new PointerEvent('pointerup'));
    expect([during, tab.getAttribute('tabindex')]).toEqual([null, '0']);
  });
});

describe('the quick-setting bar', () => {
  /** A filter on the first property, its bar shown by the Filter button. */
  async function withFilter() {
    const { model } = database([TABLE]);
    const source = new DatabaseBlockDataSource(model);
    const { root } = await mount(source);
    const view = root.currentView$.value!.view as TableSingleView;
    view.filterTrait.filterSet(firstFilterInGroup(view.vars$.value));
    await settle();
    one('[data-testid="dv-tools-filter"]')!.click();
    await settle();
    return view;
  }

  test('puts the filter chip and "Add filter" in the tab order as menu buttons', async () => {
    await withFilter();

    const chips = [
      one('[data-testid="dv-filter-condition"]'),
      one('[data-testid="dv-filter-bar-add"]'),
    ];
    expect(
      chips.map(chip => [
        chip?.getAttribute('role'),
        chip?.tabIndex,
        chip?.getAttribute('aria-haspopup'),
      ])
    ).toEqual(chips.map(() => ['button', 0, 'menu']));
  });

  test('a filter chip opened from the keyboard removes its filter, the focus never on the body', async () => {
    const view = await withFilter();
    const chip = one('[data-testid="dv-filter-condition"]')!;
    chip.focus();
    keyboardClick(chip);
    await vi.waitFor(() =>
      expect(one('affine-menu .delete-item')).not.toBe(null)
    );
    expect(chip.getAttribute('aria-expanded'), 'its menu said open').toBe(
      'true'
    );

    one('affine-menu .delete-item')!.click();
    await settle();

    expect(view.filterTrait.filter$.value.conditions).toEqual([]);
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        one('[data-testid="dv-tools-view-options"]')
      )
    );
  });
});
