/**
 * The table's two header toggles (ADR 0043) and the "fit column" double-click
 * on a column's resize handle, at the data-manager / controller level.
 *
 * Would have caught:
 * - a header toggle writing `false` instead of deleting the key, or writing
 *   (and pushing an undo entry) when nothing changed;
 * - a write from a readonly store (header, resize, fit);
 * - a gesture split over several undo steps (`captureSync` once per call);
 * - the fit ignoring the other columns, the container's padding or the
 *   virtual padding, writing a width below `ColumnMinWidth`, or writing
 *   anything when no room is left.
 */
import {
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
  type TableBlockModel,
  TableBlockSchemaExtension,
} from '@labre/affine-model';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';

import { ColumnMinWidth } from '../consts.js';
import {
  remainingColumnWidth,
  SelectionController,
} from '../selection-controller.js';
import type { TableBlockComponent } from '../table-block.js';
import { tableContainer } from '../table-block-css.js';
import { TableDataManager } from '../table-data-manager.js';

let seq = 0;

function setup() {
  const collection = new TestWorkspace({ id: `table-header-fit-${seq++}` });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    TableBlockSchemaExtension,
  ];
  collection.meta.initialize();
  const doc = collection.createDoc('page');
  const store = doc.getStore();
  let tableId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', {});
    const noteId = store.addBlock('affine:note', {}, rootId);
    tableId = store.addBlock(
      'affine:table',
      {
        rows: { r0: { rowId: 'r0', order: 'a0' } },
        columns: {
          c0: { columnId: 'c0', order: 'a0' },
          c1: { columnId: 'c1', order: 'a1' },
        },
        cells: {
          'r0:c0': { text: new Text('a') },
          'r0:c1': { text: new Text('b') },
        },
      },
      noteId
    );
  });
  const model = store.getModelById(tableId) as TableBlockModel;
  const manager = new TableDataManager(model);
  const capture = vi.spyOn(store, 'captureSync');
  return { store, model, manager, capture };
}

describe('header toggles (ADR 0043)', () => {
  test('on writes true, off deletes the key, one undo step each', () => {
    const { model, manager, capture } = setup();

    manager.setHeaderRow(true);
    expect(model.props.headerRow).toBe(true);
    expect(manager.headerRow$.value).toBe(true);
    expect(capture).toHaveBeenCalledTimes(1);

    manager.setHeaderRow(false);
    expect(model.props.headerRow).toBeUndefined();
    expect(model.yBlock.get('prop:headerRow')).toBeUndefined();
    expect(manager.headerRow$.value).toBe(false);
    expect(capture).toHaveBeenCalledTimes(2);

    manager.setHeaderColumn(true);
    expect(model.props.headerColumn).toBe(true);
    expect(manager.headerColumn$.value).toBe(true);
  });

  test('an unchanged value writes nothing', () => {
    const { manager, capture, store } = setup();
    const transact = vi.spyOn(store, 'transact');
    manager.setHeaderRow(false);
    manager.setHeaderColumn(false);
    expect(capture).not.toHaveBeenCalled();
    expect(transact).not.toHaveBeenCalled();
  });

  test('a readonly store is left alone', () => {
    const { store, model, manager, capture } = setup();
    store.readonly = true;
    manager.setHeaderRow(true);
    manager.setHeaderColumn(true);
    manager.setColumnWidth('c0', 200);
    expect(model.props.headerRow).toBeUndefined();
    expect(model.props.headerColumn).toBeUndefined();
    expect(model.props.columns['c0']?.width).toBeUndefined();
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('setColumnWidth', () => {
  test('one undo step per call, nothing when unchanged', () => {
    const { model, manager, capture } = setup();
    manager.setColumnWidth('c0', 200);
    expect(model.props.columns['c0']?.width).toBe(200);
    expect(capture).toHaveBeenCalledTimes(1);
    manager.setColumnWidth('c0', 200);
    manager.setColumnWidth('missing', 200);
    expect(capture).toHaveBeenCalledTimes(1);
  });
});

describe('remainingColumnWidth', () => {
  test('the room left, floored, never below the minimum', () => {
    expect(remainingColumnWidth(750, 120)).toBe(630);
    expect(remainingColumnWidth(750.9, 120)).toBe(630);
    expect(remainingColumnWidth(150, 120)).toBe(ColumnMinWidth);
  });

  test('no room left gives nothing to write', () => {
    expect(remainingColumnWidth(100, 120)).toBeUndefined();
    expect(remainingColumnWidth(120, 120)).toBeUndefined();
    expect(remainingColumnWidth(Number.NaN, 0)).toBeUndefined();
  });
});

describe('fitColumnToRemainingSpace', () => {
  /**
   * The table's DOM as `renderBlock` lays it out: the scroll container (its
   * own padding), the virtual-padding wrapper, one row of two cells.
   */
  function mount(
    manager: TableDataManager,
    options: { clientWidth: number; cellWidth: number; scale?: number }
  ) {
    const { clientWidth, cellWidth, scale = 1 } = options;
    const host = document.createElement('div');
    const container = document.createElement('div');
    container.className = tableContainer;
    container.style.padding = '10px 0px 18px 10px';
    Object.defineProperty(container, 'clientWidth', { value: clientWidth });
    const inner = document.createElement('div');
    inner.style.paddingLeft = '20px';
    inner.style.paddingRight = '20px';
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    for (const columnId of ['c0', 'c1']) {
      const td = document.createElement('td');
      td.dataset['columnId'] = columnId;
      td.getBoundingClientRect = () =>
        ({ width: cellWidth * scale }) as DOMRect;
      tr.append(td);
    }
    tbody.append(tr);
    table.append(tbody);
    inner.append(table);
    container.append(inner);
    host.append(container);
    document.body.append(host);
    Object.assign(host, {
      addController: () => {},
      dataManager: manager,
      getScale: () => scale,
    });
    return new SelectionController(host as unknown as TableBlockComponent);
  }

  test('takes what the container offers minus the other columns', () => {
    const { model, manager, capture } = setup();
    // 800, minus 10 (container padding), 2 x 20 (virtual padding), 120 (c1)
    const controller = mount(manager, { clientWidth: 800, cellWidth: 120 });
    controller.fitColumnToRemainingSpace('c0');
    expect(model.props.columns['c0']?.width).toBe(630);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  test('reads the other columns in unscaled pixels', () => {
    const { model, manager } = setup();
    const controller = mount(manager, {
      clientWidth: 800,
      cellWidth: 120,
      scale: 2,
    });
    controller.fitColumnToRemainingSpace('c0');
    expect(model.props.columns['c0']?.width).toBe(630);
  });

  test('writes nothing when no room is left', () => {
    const { model, manager, capture } = setup();
    const controller = mount(manager, { clientWidth: 150, cellWidth: 120 });
    controller.fitColumnToRemainingSpace('c0');
    expect(model.props.columns['c0']?.width).toBeUndefined();
    expect(capture).not.toHaveBeenCalled();
  });

  test('writes nothing on a readonly store', () => {
    const { store, model, manager } = setup();
    store.readonly = true;
    const controller = mount(manager, { clientWidth: 800, cellWidth: 120 });
    controller.fitColumnToRemainingSpace('c0');
    expect(model.props.columns['c0']?.width).toBeUndefined();
  });
});
