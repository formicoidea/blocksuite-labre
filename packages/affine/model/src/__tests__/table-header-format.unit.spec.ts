/**
 * ADR 0043 — the simple table's header row and header column are two optional
 * stored keys, `prop:headerRow` and `prop:headerColumn`, `true` or absent.
 *
 * This spec would have caught:
 * - a default other than `undefined`: `sync-controller` writes such a default
 *   into every table the first time a document opens, editing every existing
 *   page on load and syncing that edit to every peer;
 * - a snapshot taken from a pre-0043 table gaining the keys on the way out or
 *   on the way back in (copy, duplicate, export would then write them);
 * - turning a header off by writing `false` instead of deleting the key.
 */
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { NoteBlockSchemaExtension } from '../blocks/note/index.js';
import { RootBlockSchemaExtension } from '../blocks/root/index.js';
import {
  type TableBlockModel,
  TableBlockSchemaExtension,
} from '../blocks/table/index.js';

let seq = 0;

function workspace() {
  const collection = new TestWorkspace({ id: `table-header-${seq++}` });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    TableBlockSchemaExtension,
  ];
  collection.meta.initialize();
  return collection;
}

/**
 * A page holding a 1×2 table as a 0.58 client stored it: no header key at all.
 * (A table created now carries both keys with an `undefined` value, the way a
 * flat block's creation already writes `comments`; what matters is that
 * nothing is written when a document OPENS, and that no value is ever `false`.)
 */
function legacyUpdate() {
  const doc = workspace().createDoc('page');
  const store = doc.getStore();
  let tableId = '';
  let noteId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', {});
    noteId = store.addBlock('affine:note', {}, rootId);
    tableId = store.addBlock(
      'affine:table',
      {
        rows: { r1: { rowId: 'r1', order: 'a0' } },
        columns: {
          c1: { columnId: 'c1', order: 'a0' },
          c2: { columnId: 'c2', order: 'a1', width: 180 },
        },
        cells: {
          'r1:c1': { text: new Text('Name') },
          'r1:c2': { text: new Text('Owner') },
        },
      },
      noteId
    );
  });
  const yBlock = yBlockOf(doc.spaceDoc, tableId);
  doc.spaceDoc.transact(() => {
    yBlock.delete('prop:headerRow');
    yBlock.delete('prop:headerColumn');
  });
  return { update: Y.encodeStateAsUpdate(doc.spaceDoc), tableId, noteId };
}

/** Opens a stored update the way a host opens a document. */
function open(update: Uint8Array) {
  const doc = workspace().createDoc('page');
  Y.applyUpdate(doc.spaceDoc, update);
  const store = doc.getStore();
  store.load();
  return { doc, store };
}

function yBlockOf(spaceDoc: Y.Doc, id: string) {
  return spaceDoc.getMap('blocks').get(id) as Y.Map<unknown>;
}

const headerKeys = (yBlock: Y.Map<unknown>) =>
  Array.from(yBlock.keys()).filter(key => key.startsWith('prop:header'));

describe('table header: stored format (ADR 0043)', () => {
  test('a new table stores no header value', () => {
    const doc = workspace().createDoc('page');
    const store = doc.getStore();
    let tableId = '';
    store.load(() => {
      const rootId = store.addBlock('affine:page', {});
      const noteId = store.addBlock('affine:note', {}, rootId);
      tableId = store.addBlock('affine:table', {}, noteId);
    });
    const yBlock = yBlockOf(doc.spaceDoc, tableId);
    expect(yBlock.get('prop:headerRow')).toBeUndefined();
    expect(yBlock.get('prop:headerColumn')).toBeUndefined();
  });

  test('opening a document without the keys writes nothing', () => {
    const { update, tableId } = legacyUpdate();
    const doc = workspace().createDoc('page');
    Y.applyUpdate(doc.spaceDoc, update);
    const stateBefore = Y.encodeStateVector(doc.spaceDoc);
    const jsonBefore = JSON.stringify(doc.spaceDoc.toJSON());

    const store = doc.getStore();
    store.load();
    const model = store.getModelById(tableId) as TableBlockModel;

    expect(model.props.headerRow).toBeUndefined();
    expect(model.props.headerColumn).toBeUndefined();
    expect(model.props.headerRow$.value).toBeUndefined();
    expect(Y.encodeStateVector(doc.spaceDoc)).toEqual(stateBefore);
    expect(JSON.stringify(doc.spaceDoc.toJSON())).toBe(jsonBefore);
    expect(headerKeys(yBlockOf(doc.spaceDoc, tableId))).toEqual([]);
  });

  test('a snapshot of a pre-0043 table round-trips with no header', async () => {
    const { update, tableId, noteId } = legacyUpdate();
    const { doc, store } = open(update);
    const transformer = store.getTransformer();
    const model = store.getModelById(tableId) as TableBlockModel;
    const snapshot = transformer.blockToSnapshot(model);
    if (!snapshot) throw new Error('no snapshot');

    // What a clipboard or a file carries is JSON: no header survives it.
    expect(JSON.stringify(snapshot.props)).not.toContain('header');

    const copy = await transformer.snapshotToBlock(
      JSON.parse(JSON.stringify({ ...snapshot, id: 'table-copy' })),
      store,
      noteId
    );
    if (!copy) throw new Error('no copy');
    const yCopy = yBlockOf(doc.spaceDoc, copy.id);
    expect(yCopy.get('prop:headerRow')).toBeUndefined();
    expect(yCopy.get('prop:headerColumn')).toBeUndefined();
    expect((copy as TableBlockModel).props.columns['c2']?.width).toBe(180);
  });

  test('the flags round-trip through Yjs and turn off by deleting the key', () => {
    const { update, tableId } = legacyUpdate();
    const { doc, store } = open(update);
    const model = store.getModelById(tableId) as TableBlockModel;

    store.transact(() => {
      model.props.headerRow = true;
      model.props.headerColumn = true;
    });
    expect(headerKeys(yBlockOf(doc.spaceDoc, tableId)).sort()).toEqual([
      'prop:headerColumn',
      'prop:headerRow',
    ]);

    const peer = open(Y.encodeStateAsUpdate(doc.spaceDoc)).store;
    const peerModel = peer.getModelById(tableId) as TableBlockModel;
    expect(peerModel.props.headerRow).toBe(true);
    expect(peerModel.props.headerColumn).toBe(true);

    store.transact(() => {
      delete model.props.headerRow;
    });
    expect(model.props.headerRow).toBeUndefined();
    expect(headerKeys(yBlockOf(doc.spaceDoc, tableId))).toEqual([
      'prop:headerColumn',
    ]);
  });
});
