/**
 * Guard for issue #739 (upstream toeverything/AFFiNE#15915, 10ea096):
 * "in a sorted view, typing into a cell makes the row jump away".
 *
 * A selected (not editing) table cell starts editing on a printable key
 * (`handleCharStartEdit`, `view-presets/table/utils.ts`). The row order is
 * frozen by `view.lockRows(true)` (`SingleViewBase.rows$` is a
 * `computedLock`). Before #739 the key was written first and the rows were
 * locked only from the cell's `render()` (`pc/cell.ts`,
 * `pc-virtual/row/cell.ts`), a Lit update after the write. Anything
 * watching `rows$` (the group's `SignalWatcher`) re-sorted on the write, and
 * `computedLock` keeps the order it last computed, so the late lock froze
 * the NEW order: the edited row had moved away from the selection's row
 * index. `handleCharStartEdit` now enters the edit mode and locks the rows
 * before it writes.
 *
 * The spec mounts a real `TableSingleView` sorted by its title on an
 * in-memory source, watches `rows$` as a renderer does, presses a letter on
 * the selected first row through the real hotkey controllers (pc and
 * pc-virtual), then applies the cell render's lock, and reads the order.
 * It would catch the lock coming after the first write again.
 */
import { effect, signal } from '@preact/signals-core';
import { describe, expect, it, vi } from 'vitest';

import type { PropertyMetaConfig } from '../core/property/property-config.js';
import type { ViewManager } from '../core/view-manager/view-manager.js';
import { propertyPresets } from '../property-presets/index.js';
import { viewPresets } from '../view-presets/index.js';
import { TableHotkeysController } from '../view-presets/table/pc/controller/hotkeys.js';
import { TableHotkeysController as VirtualTableHotkeysController } from '../view-presets/table/pc-virtual/controller/hotkeys.js';
import { TableViewAreaSelection } from '../view-presets/table/selection';
import { TableSingleView } from '../view-presets/table/table-view-manager.js';

const textMeta =
  propertyPresets.textPropertyConfig as unknown as PropertyMetaConfig;

/** Three rows sorted by their title, ascending: Alpha, Bravo, Charlie. */
function sortedTable() {
  const rows = signal(['r1', 'r2', 'r3']);
  const properties = signal(['title']);
  const values = signal(
    new Map<string, unknown>([
      ['r1:title', 'Alpha'],
      ['r2:title', 'Bravo'],
      ['r3:title', 'Charlie'],
    ])
  );
  const viewData = signal<Record<string, unknown>>({
    id: 'view-1',
    name: 'View',
    mode: 'table',
    columns: [{ id: 'title', hide: false }],
    filter: { type: 'group', op: 'and', conditions: [] },
    sort: {
      manuallySort: [],
      sortBy: [{ ref: { type: 'ref', name: 'title' }, desc: false }],
    },
  });
  const services = new Map<unknown, unknown>();
  const readonly$ = signal(false);
  const dataSource = {
    rows$: rows,
    properties$: properties,
    readonly$,
    featureFlags$: signal({
      enable_number_formatting: false,
      enable_table_virtual_scroll: false,
    }),
    propertyMetas$: signal([textMeta]),
    provider: { getAll: () => new Map() },
    viewDataGet: () => viewData.value,
    viewDataUpdate: (
      _id: string,
      updater: (data: Record<string, unknown>) => Record<string, unknown>
    ) => {
      viewData.value = { ...viewData.value, ...updater(viewData.value) };
    },
    cellValueGet: (rowId: string, propertyId: string) =>
      values.value.get(`${rowId}:${propertyId}`),
    cellValueChange: (rowId: string, propertyId: string, value: unknown) => {
      const next = new Map(values.value);
      next.set(`${rowId}:${propertyId}`, value);
      values.value = next;
    },
    propertyTypeGet: () => 'text',
    propertyTypeCanSet: () => true,
    propertyNameGet: (id: string) => id,
    propertyDataGet: () => ({}),
    propertyDataSet: vi.fn(),
    propertyReadonlyGet: () => false,
    propertyMetaGet: () => textMeta,
    serviceGet: () => null,
    serviceGetOrCreate: (key: unknown, create: () => unknown) => {
      if (!services.has(key)) services.set(key, create());
      return services.get(key);
    },
    viewMetaGet: () => viewPresets.tableViewMeta,
    cellStatus: () => 'ready',
  };
  const manager = {
    dataSource,
    readonly$,
    viewMetas: [viewPresets.tableViewMeta],
  } as unknown as ViewManager;
  return new TableSingleView(manager, 'view-1');
}

type Controller =
  | typeof TableHotkeysController
  | typeof VirtualTableHotkeysController;

/**
 * The table's UI logic as the hotkey controllers read it, around the real
 * view. The selection setter mirrors the real one: it flips the cell's
 * `isEditing$` synchronously (`pc-virtual/controller/selection.ts`).
 */
function uiLogic(view: TableSingleView, Controller: Controller) {
  const title = view.propertyGetOrCreate('title');
  const cell = {
    rowId: 'r1',
    dataset: { rowId: 'r1', columnId: 'title' },
    isEditing$: signal(false),
    column: title,
    column$: signal(title),
  };
  let current: unknown;
  const selectionController = {
    get selection() {
      return current;
    },
    set selection(next: unknown) {
      current = next;
      cell.isEditing$.value =
        (next as { isEditing?: boolean } | undefined)?.isEditing ?? false;
    },
    getCellContainer: () => cell,
  };
  let keyDown: (ctx: unknown) => boolean = () => false;
  const logic = {
    view,
    ui$: signal({ disposables: { add: vi.fn() }, requestUpdate: vi.fn() }),
    selectionController,
    bindHotkey: () => ({ dispose: vi.fn() }),
    handleEvent: (name: string, handler: (ctx: unknown) => boolean) => {
      if (name === 'keyDown') keyDown = handler;
      return { dispose: vi.fn() };
    },
  };
  new Controller(logic as never).hostConnected();
  selectionController.selection = TableViewAreaSelection.create({
    focus: { rowIndex: 0, columnIndex: 0 },
    isEditing: false,
  });
  const press = (key: string) => {
    const raw = new KeyboardEvent('keydown', { key, cancelable: true });
    keyDown({ get: () => ({ raw }) });
  };
  return { cell, press };
}

describe('typing into a selected cell of a sorted table (#739)', () => {
  it.each([
    ['pc', TableHotkeysController],
    ['pc-virtual', VirtualTableHotkeysController],
  ] as const)('keeps the edited row in place (%s)', async (_, Controller) => {
    const view = sortedTable();
    const order: string[][] = [];
    // A renderer watching the rows, as the group's SignalWatcher does.
    const stop = effect(() => {
      order.push(view.rows$.value.map(row => row.rowId));
    });
    expect(order.at(-1)).toEqual(['r1', 'r2', 'r3']);

    const { cell, press } = uiLogic(view, Controller);
    // "z" sorts last once written: the row would jump to the bottom.
    press('z');
    expect(cell.isEditing$.value).toBe(true);
    // The cell's render runs as a Lit update and locks the rows then.
    await Promise.resolve();
    view.lockRows(cell.isEditing$.value);

    expect(view.rows$.value.map(row => row.rowId)).toEqual(['r1', 'r2', 'r3']);
    stop();
  });
});
