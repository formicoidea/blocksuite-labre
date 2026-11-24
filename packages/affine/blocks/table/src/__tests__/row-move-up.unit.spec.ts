/**
 * Issue #731 (upstream toeverything/AFFiNE#15878): "Move Up" in a row's menu
 * moves the row up.
 *
 * `TableDataManager.moveRow(from, after)` places the row AFTER the row at
 * index `after`. The row menu called `moveRow(rowIndex, rowIndex - 1)`, which
 * asks for a place between row `rowIndex - 1` and the row itself — where it
 * already is: the order key changes, the display order does not. "Move Left"
 * on a column already passes `columnIndex - 2`.
 *
 * Second defect, same root: Move Down on the last row (Move Right on the last
 * column) asked `getOrder` for a key after an index past the end, which fell
 * back to a key between `null` and `null` — `a0`, an existing row's key. A
 * move that leaves the item where it is now writes nothing (no fresh key, no
 * empty undo step), and an index past the end clamps to the last item.
 *
 * The spec opens the REAL row menu (`TableCell.openRowOptions`) with the
 * context menu captured, picks the action by name and reads the display
 * order back from a REAL table model.
 */
import {
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
  type TableBlockModel,
  TableBlockSchemaExtension,
} from '@labre/affine-model';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, it, vi } from 'vitest';

// `vi.mock` below is hoisted above these imports.
import { TableCell } from '../table-cell.js';
import { TableDataManager } from '../table-data-manager.js';

type Action = { kind: 'action'; name: string; select: () => void };
type Group = { kind: 'group'; items: unknown[] };

const popped = vi.hoisted(() => ({ items: [] as unknown[] }));

vi.mock('@labre/affine-components/context-menu', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@labre/affine-components/context-menu')
    >();
  return {
    ...actual,
    menu: {
      ...actual.menu,
      action: (config: object) => ({ kind: 'action', ...config }),
      group: (config: object) => ({ kind: 'group', ...config }),
      subMenu: (config: object) => ({ kind: 'subMenu', ...config }),
    },
    popMenu: (_target: unknown, { options }: { options: { items: [] } }) => {
      popped.items = options.items;
    },
  };
});

let seq = 0;
const ROW_NAMES = ['first', 'second', 'third'];
const LAST_ROW = ROW_NAMES.length - 1;
const COLUMN_NAMES = ['left', 'middle', 'right'];
const LAST_COLUMN = COLUMN_NAMES.length - 1;

function createTable() {
  const workspace = new TestWorkspace({ id: `row-move-up-${seq++}` });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    TableBlockSchemaExtension,
  ];
  workspace.meta.initialize();
  const store: Store = workspace.createDoc().getStore();
  let tableId = '';
  store.load(() => {
    const root = store.addBlock('affine:page', { title: new Text('') });
    const note = store.addBlock('affine:note', {}, root);
    tableId = store.addBlock(
      'affine:table',
      {
        columns: Object.fromEntries(
          COLUMN_NAMES.map((name, index) => [
            name,
            { columnId: name, order: `a${index}` },
          ])
        ),
        rows: Object.fromEntries(
          ROW_NAMES.map((name, index) => [
            name,
            { rowId: name, order: `a${index}` },
          ])
        ),
        cells: Object.fromEntries(
          ROW_NAMES.flatMap(row =>
            COLUMN_NAMES.map(column => [
              `${row}:${column}`,
              { text: new Text(`${row} ${column}`) },
            ])
          )
        ),
      },
      note
    );
  });
  const model = store.getBlock(tableId)?.model as TableBlockModel;
  return new TableDataManager(model);
}

const order = (dataManager: InstanceType<typeof TableDataManager>) =>
  dataManager.rows$.value.map(row => row.rowId);

const columnOrder = (dataManager: InstanceType<typeof TableDataManager>) =>
  dataManager.columns$.value.map(column => column.columnId);

/** The stored order keys, to tell "unchanged" from "rewritten in place". */
const storedKeys = (dataManager: InstanceType<typeof TableDataManager>) => ({
  rows: dataManager.rows$.value.map(row => row.order),
  columns: dataManager.columns$.value.map(column => column.order),
});

function pickAction(name: string) {
  const action = (popped.items as Group[])
    .flatMap(group => group.items as Action[])
    .find(item => item.kind === 'action' && item.name === name);
  if (!action) throw new Error(`no "${name}" in the menu`);
  action.select();
}

function pickColumnAction(
  dataManager: InstanceType<typeof TableDataManager>,
  columnIndex: number,
  name: string
) {
  const column = dataManager.columns$.value[columnIndex];
  if (!column) throw new Error(`no column ${columnIndex}`);
  const cell = {
    dataManager,
    selectionController: { setSelected: () => {} },
    headerToggle: () => ({ kind: 'header-toggle' }),
  };
  TableCell.prototype.openColumnOptions.call(
    cell as unknown as InstanceType<typeof TableCell>,
    {} as never,
    column,
    columnIndex
  );
  pickAction(name);
}

function pickRowAction(
  dataManager: InstanceType<typeof TableDataManager>,
  rowIndex: number,
  name: string
) {
  const row = dataManager.rows$.value[rowIndex];
  if (!row) throw new Error(`no row ${rowIndex}`);
  const cell = {
    dataManager,
    selectionController: { setSelected: () => {} },
    headerToggle: () => ({ kind: 'header-toggle' }),
  };
  TableCell.prototype.openRowOptions.call(
    cell as unknown as InstanceType<typeof TableCell>,
    {} as never,
    row,
    rowIndex
  );
  pickAction(name);
}

describe('row menu move actions (#731)', () => {
  it('Move Down moves the row one place down (control)', () => {
    const dataManager = createTable();
    pickRowAction(dataManager, 0, 'Move Down');
    expect(order(dataManager)).toEqual(['second', 'first', 'third']);
  });

  it('Move Up moves the last row one place up', () => {
    const dataManager = createTable();
    pickRowAction(dataManager, LAST_ROW, 'Move Up');
    expect(order(dataManager)).toEqual(['first', 'third', 'second']);
  });

  it('Move Up moves the second row to the top', () => {
    const dataManager = createTable();
    pickRowAction(dataManager, 1, 'Move Up');
    expect(order(dataManager)).toEqual(['second', 'first', 'third']);
  });

  // Adjacent edge: `moveRow(last, last + 1)` once asked `getOrder` for a key
  // after an index past the end, which fell back to a key between `null` and
  // `null` — `a0`, the first row's own key.
  it('Move Down on the last row writes nothing', () => {
    const dataManager = createTable();
    const before = storedKeys(dataManager);
    pickRowAction(dataManager, LAST_ROW, 'Move Down');
    expect(order(dataManager)).toEqual(ROW_NAMES);
    expect(storedKeys(dataManager)).toEqual(before);
  });

  it('Move Up on the first row writes nothing', () => {
    const dataManager = createTable();
    const before = storedKeys(dataManager);
    pickRowAction(dataManager, 0, 'Move Up');
    expect(order(dataManager)).toEqual(ROW_NAMES);
    expect(storedKeys(dataManager)).toEqual(before);
  });
});

describe('column menu move actions (#731)', () => {
  it('Move Left moves the column one place left', () => {
    const dataManager = createTable();
    pickColumnAction(dataManager, LAST_COLUMN, 'Move Left');
    expect(columnOrder(dataManager)).toEqual(['left', 'right', 'middle']);
  });

  it('Move Right moves the column one place right', () => {
    const dataManager = createTable();
    pickColumnAction(dataManager, 0, 'Move Right');
    expect(columnOrder(dataManager)).toEqual(['middle', 'left', 'right']);
  });

  it('Move Right on the last column writes nothing', () => {
    const dataManager = createTable();
    const before = storedKeys(dataManager);
    pickColumnAction(dataManager, LAST_COLUMN, 'Move Right');
    expect(columnOrder(dataManager)).toEqual(COLUMN_NAMES);
    expect(storedKeys(dataManager)).toEqual(before);
  });

  it('Move Left on the first column writes nothing', () => {
    const dataManager = createTable();
    const before = storedKeys(dataManager);
    pickColumnAction(dataManager, 0, 'Move Left');
    expect(columnOrder(dataManager)).toEqual(COLUMN_NAMES);
    expect(storedKeys(dataManager)).toEqual(before);
  });
});

describe('TableDataManager moves (#731)', () => {
  it('moving a row after itself or after its predecessor writes nothing', () => {
    const dataManager = createTable();
    const before = storedKeys(dataManager);
    dataManager.moveRow(1, 1);
    dataManager.moveRow(1, 0);
    dataManager.moveColumn(1, 1);
    dataManager.moveColumn(1, 0);
    expect(storedKeys(dataManager)).toEqual(before);
  });

  it('an index past the end appends after the last item with a fresh key', () => {
    const dataManager = createTable();
    dataManager.moveRow(0, ROW_NAMES.length + 1);
    expect(order(dataManager)).toEqual(['second', 'third', 'first']);
    const keys = storedKeys(dataManager).rows;
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('a row added past the end gets a key of its own', () => {
    const dataManager = createTable();
    dataManager.addRow(ROW_NAMES.length + 1);
    const keys = storedKeys(dataManager).rows;
    expect(keys).toHaveLength(ROW_NAMES.length + 1);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('moves nothing in a readonly store', () => {
    const dataManager = createTable();
    const before = storedKeys(dataManager);
    (
      dataManager as unknown as { model: { store: Store } }
    ).model.store.readonly = true;
    dataManager.moveRow(LAST_ROW, -1);
    dataManager.moveColumn(LAST_COLUMN, -1);
    expect(storedKeys(dataManager)).toEqual(before);
  });
});
