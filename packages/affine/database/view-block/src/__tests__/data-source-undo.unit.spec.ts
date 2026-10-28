/**
 * The data-view block's own columns and cells are undoable (`BlockQueryDataSource`).
 *
 * **This spec would have caught** `cellValueChange` and `propertyDelete`
 * writing a key of a record prop (`cells[rowId]`) and splicing an array prop
 * (`columns`) outside a transaction: such a nested write goes through the
 * props proxy with its own origin, which the undo manager does not track, so
 * Ctrl+Z skipped the edit (same trap as the user layers' record writes,
 * `blocks/surface/src/extensions/user-layers/actions.ts`). `propertyAdd`
 * already wrapped its splice in `store.transact`; the two siblings now do too.
 */
import {
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import type { EditorHost } from '@labre/std';
import type { Store } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { beforeEach, describe, expect, test } from 'vitest';

import { BlockQueryDataSource } from '../data-source.js';
import {
  type DataViewBlockModel,
  DataViewBlockSchemaExtension,
} from '../data-view-model.js';

const COLUMN = { id: 'col', type: 'rich-text', name: 'Column 1', data: {} };

function setup() {
  const workspace = new TestWorkspace({
    id: 'test-workspace',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const store = workspace.createDoc('doc0').getStore({
    extensions: [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      DataViewBlockSchemaExtension,
    ],
  });
  let id = '';
  // `store.load` (not `doc.load`) runs the store extensions' `loaded` hooks,
  // the history's among them: without it `canUndo` never updates.
  store.load(() => {
    const root = store.addBlock('affine:page', {});
    const note = store.addBlock('affine:note', {}, root);
    id = store.addBlock(
      'affine:data-view',
      { columns: [COLUMN], cells: { row: { col: 'before' } } },
      note
    );
  });
  const model = store.getModelById(id) as DataViewBlockModel;
  // The constructor reads nothing of the host but its store.
  const host = { store } as unknown as EditorHost;
  const source = new BlockQueryDataSource(host, model, { type: 'todo' });
  // Creation is not what the specs undo.
  store.resetHistory();
  return { store, model, source };
}

describe('the data-view block data source is undoable', () => {
  let store: Store;
  let model: DataViewBlockModel;
  let source: BlockQueryDataSource;

  beforeEach(() => {
    ({ store, model, source } = setup());
  });

  test('one undo restores a cell changed by cellValueChange', () => {
    source.cellValueChange('row', 'col', 'after');
    expect(model.props.cells.row.col).toBe('after');

    expect(store.canUndo).toBe(true);
    store.undo();
    expect(model.props.cells.row.col).toBe('before');
  });

  test('one undo restores a column deleted by propertyDelete', () => {
    source.propertyDelete('col');
    expect(model.props.columns.map(c => c.id)).toEqual([]);

    expect(store.canUndo).toBe(true);
    store.undo();
    expect(model.props.columns.map(c => c.id)).toEqual(['col']);
  });
});
