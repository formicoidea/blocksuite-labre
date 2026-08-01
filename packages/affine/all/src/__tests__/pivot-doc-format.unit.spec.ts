/**
 * `pivotDocId` and the DOCUMENT FORMAT (MF1, ADR 0005 § 2 and Compatibility).
 *
 * The field ships with **no version bump and no migration**, which is only
 * defensible if three things hold at the format level rather than in a unit
 * stub. Each is one test below:
 *
 * 1. A document authored BEFORE the field existed opens, reads unbound, and
 *    re-exports byte-identically — surface elements have no schema version and
 *    no upgrade hook, so "nothing happens on load" has to be literally true.
 * 2. The binding crosses the full doc-snapshot boundary (export → import →
 *    re-export), the path used by whole-doc copy, template insertion and
 *    cross-doc drag.
 * 3. An element that never binds stays byte-identical to one created before the
 *    field existed. `@field().init()` returns early on an `undefined` default,
 *    and this ADR DEPENDS on that: give `pivotDocId` a non-`undefined` default
 *    and the cost returns on every brush stroke.
 */
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import type { SurfaceBlockModel } from '@labre/affine-block-surface';
import type { DocSnapshot, Store } from '@labre/store';
import { Schema, Text, Transformer } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';
import { getAffineSchemas } from '../schemas.js';

const RECORD = 'pivot-payments';

function createEditor(id: string) {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();

  const transformer = new Transformer({
    schema: new Schema().register(getAffineSchemas({})),
    blobCRUD: collection.blobSync,
    middlewares: [],
    docCRUD: {
      create: (docId: string) => collection.createDoc(docId).getStore({ id: docId }),
      get: (docId: string) => collection.getDoc(docId)?.getStore({ id: docId }) ?? null,
      delete: (docId: string) => collection.removeDoc(docId),
    },
  });

  return { collection, transformer };
}

/** A board with one bound shape and one plain one, unless `bind` is false. */
function authorBoard(
  collection: TestWorkspace,
  id: string,
  { bind = true }: { bind?: boolean } = {}
) {
  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('MF1') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });

  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;
  surface.addElement({
    type: 'shape',
    xywh: '[0,0,100,100]',
    shapeType: 'rect',
    role: 'wardley:component',
    ...(bind ? { pivotDocId: RECORD } : {}),
  });
  surface.addElement({ type: 'shape', xywh: '[200,0,100,100]' });

  return { store, surfaceId };
}

const surfaceOf = (store: Store) =>
  [...store.getAllModels()].find(
    m => m.flavour === 'affine:surface'
  ) as SurfaceBlockModel;

/** What the surface says about its bindings, in element order. */
const bindingsOf = (store: Store) =>
  surfaceOf(store).elementModels.map(e => e.pivotDocId);

describe('the binding crosses the snapshot boundary', () => {
  test('export → import → re-export preserves it exactly', async () => {
    const { collection, transformer } = createEditor('pivot-format');
    const { store } = authorBoard(collection, 'board');
    expect(bindingsOf(store)).toEqual([RECORD, undefined]);

    const snapshot = transformer.docToSnapshot(store) as DocSnapshot;
    const reloaded = await transformer.snapshotToDoc({
      ...snapshot,
      meta: { ...snapshot.meta, id: 'board-reloaded' },
    });

    expect(reloaded).toBeDefined();
    expect(bindingsOf(reloaded!)).toEqual([RECORD, undefined]);

    // The doc-snapshot path replays every key verbatim, so a round trip is
    // lossless in both directions — unlike the element-creation-from-props
    // paths, which only carry keys with a declared accessor (which is why the
    // field is declared on the BASE class).
    const reExported = transformer.docToSnapshot(reloaded!) as DocSnapshot;
    expect(reExported.blocks).toEqual(snapshot.blocks);
  });

  test('the unbound element carries no key through the snapshot', () => {
    const { collection, transformer } = createEditor('pivot-format-absent');
    const { store } = authorBoard(collection, 'board');

    const snapshot = JSON.stringify(
      transformer.docToSnapshot(store) as DocSnapshot
    );

    // Exactly one occurrence of the key in the whole document: the bound
    // element's. An element that never binds is byte-identical to one created
    // before the field existed — the entire no-migration argument.
    expect(snapshot.split('"pivotDocId"')).toHaveLength(2);
  });
});

describe('a document authored before the field existed', () => {
  test('opens unbound, and re-exports byte-identically', async () => {
    const { collection, transformer } = createEditor('pivot-format-legacy');
    // A board written by a client that had never heard of `pivotDocId`: no
    // element carries the key. There is no version counter to compare, no
    // upgrade hook to run and no key-set validation — an absent key is simply
    // a key nobody reads.
    const { store } = authorBoard(collection, 'legacy', { bind: false });

    const snapshot = transformer.docToSnapshot(store) as DocSnapshot;
    expect(JSON.stringify(snapshot)).not.toContain('pivotDocId');

    const reloaded = await transformer.snapshotToDoc({
      ...snapshot,
      meta: { ...snapshot.meta, id: 'legacy-reloaded' },
    });

    expect(bindingsOf(reloaded!)).toEqual([undefined, undefined]);
    expect(surfaceOf(reloaded!).elementModels.map(e => e.role)).toEqual([
      'wardley:component',
      undefined,
    ]);

    const reExported = transformer.docToSnapshot(reloaded!) as DocSnapshot;
    expect(reExported.blocks).toEqual(snapshot.blocks);
    // Nothing was stamped on the way through — not even for the element that
    // has a role and could plausibly have been "upgraded".
    expect(JSON.stringify(reExported)).not.toContain('pivotDocId');
  });

  test('binding one element leaves the others untouched', async () => {
    const { collection, transformer } = createEditor('pivot-format-partial');
    const { store } = authorBoard(collection, 'legacy', { bind: false });
    const before = transformer.docToSnapshot(store) as DocSnapshot;

    const [first] = surfaceOf(store).elementModels;
    surfaceOf(store).updateElement(first.id, { pivotDocId: RECORD });

    const after = transformer.docToSnapshot(store) as DocSnapshot;
    expect(JSON.stringify(after).split('"pivotDocId"')).toHaveLength(2);
    expect(bindingsOf(store)).toEqual([RECORD, undefined]);

    // And unbinding gets the document back to semantic neutrality with the key
    // gone, not merely reading as `undefined`.
    first.clearField('pivotDocId');
    const restored = transformer.docToSnapshot(store) as DocSnapshot;
    expect(restored.blocks).toEqual(before.blocks);
  });
});
