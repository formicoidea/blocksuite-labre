import { StoreExtensionManager } from '@labre/affine-ext-loader';
import type { SurfaceBlockModel } from '@labre/affine-block-surface';
import type { DocSnapshot, Store } from '@labre/store';
import { Schema, Text, Transformer } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';

import { getInternalStoreExtensions } from '../../extensions/store.js';
import { type BlockFlags, OPTIONAL_BLOCKS } from '../../flags.js';
import { getAffineSchemas } from '../../schemas.js';

/** Every optional block AND every framework switched off. */
const ALL_OFF = Object.fromEntries(
  OPTIONAL_BLOCKS.map(block => [block, false])
) as BlockFlags;

const ALL_ON: BlockFlags = {};

/**
 * Assemble a workspace exactly the way an editor does: store extensions from
 * the assembly point (they carry the `BlockSchemaExtension`s that populate
 * `store.schema` at runtime) plus a `Transformer` for snapshot round-trips.
 */
function createEditor(flags: BlockFlags) {
  const manager = new StoreExtensionManager(getInternalStoreExtensions(flags));
  const collection = new TestWorkspace({ id: 'reversed-flag-contract' });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();

  const transformer = new Transformer({
    schema: new Schema().register(getAffineSchemas(flags)),
    blobCRUD: collection.blobSync,
    middlewares: [],
    docCRUD: {
      create: (id: string) => collection.createDoc(id).getStore({ id }),
      get: (id: string) => collection.getDoc(id)?.getStore({ id }) ?? null,
      delete: (id: string) => collection.removeDoc(id),
    },
  });

  return { collection, transformer };
}

/**
 * A document mixing an optional BLOCK (code) with optional FRAMEWORK surface
 * elements (a Wardley map + node, an EDGY board, a brush stroke).
 */
function authorDocument(collection: TestWorkspace, id: string) {
  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  let noteId = '';

  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('PF4') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
    noteId = store.addBlock('affine:note', {}, rootId);
    store.addBlock('affine:paragraph', { text: new Text('hello') }, noteId);
    store.addBlock('affine:code', { language: 'ts' }, noteId);
  });

  const surface = store.getBlock(surfaceId)?.model as SurfaceBlockModel;
  surface.addElement({ type: 'wardley', xywh: '[0,0,800,600]' });
  surface.addElement({ type: 'wardleyNode', xywh: '[10,10,100,40]' });
  surface.addElement({ type: 'edgyBoard', xywh: '[900,0,800,600]' });
  surface.addElement({ type: 'brush', xywh: '[0,700,100,100]' });

  return { store, surfaceId, noteId };
}

/** Stable, comparable view of what the document actually contains. */
function describeDocument(store: Store, surfaceId: string) {
  const surface = store.getBlock(surfaceId)?.model as SurfaceBlockModel;
  return {
    flavours: [...store.getAllModels()].map(m => m.flavour).sort(),
    elementTypes: surface.elementModels.map(e => e.type).sort(),
  };
}

describe('a document survives its flags being off', () => {
  test('authoring and reading works with every flag off', () => {
    const { collection } = createEditor(ALL_OFF);
    const { store, surfaceId } = authorDocument(collection, 'doc:off');

    // The blocks are in the model tree — not swallowed by a missing schema.
    const summary = describeDocument(store, surfaceId);
    expect(summary.flavours).toEqual([
      'affine:code',
      'affine:note',
      'affine:page',
      'affine:paragraph',
      'affine:surface',
    ]);
    // The framework elements are in the surface — not dropped.
    expect(summary.elementTypes).toEqual([
      'brush',
      'edgyBoard',
      'wardley',
      'wardleyNode',
    ]);
    // Their schemas are registered, so validation on load cannot fail.
    expect(store.schema.flavourSchemaMap.has('affine:code')).toBe(true);
    expect(store.schema.flavourSchemaMap.has('affine:database')).toBe(true);
  });

  test('save/load round-trip preserves everything with every flag off', async () => {
    const { collection, transformer } = createEditor(ALL_OFF);
    const { store, surfaceId } = authorDocument(collection, 'doc:off');
    const before = describeDocument(store, surfaceId);

    // Export — this is where a missing schema used to throw
    // `Flavour schema not found` and silently produce nothing.
    const snapshot = transformer.docToSnapshot(store);
    expect(snapshot).toBeDefined();

    const reloaded = await transformer.snapshotToDoc({
      ...(snapshot as DocSnapshot),
      meta: { ...(snapshot as DocSnapshot).meta, id: 'doc:off-reloaded' },
    });
    expect(reloaded).toBeDefined();

    const reloadedSurfaceId = [...reloaded!.getAllModels()].find(
      m => m.flavour === 'affine:surface'
    )!.id;
    expect(describeDocument(reloaded!, reloadedSurfaceId)).toEqual(before);
  });

  test('an OFF → ON cycle gives back byte-identical content', async () => {
    // 1. authored while the frameworks were ENABLED
    const authoring = createEditor(ALL_ON);
    const { store: authored, surfaceId } = authorDocument(
      authoring.collection,
      'doc:authored'
    );
    const authoredSnapshot = authoring.transformer.docToSnapshot(
      authored
    ) as DocSnapshot;
    const authoredSummary = describeDocument(authored, surfaceId);

    // 2. opened by a tenant that has every framework DISABLED
    const disabled = createEditor(ALL_OFF);
    const openedOff = await disabled.transformer.snapshotToDoc(
      authoredSnapshot
    );
    expect(openedOff).toBeDefined();
    const offSurfaceId = [...openedOff!.getAllModels()].find(
      m => m.flavour === 'affine:surface'
    )!.id;
    expect(describeDocument(openedOff!, offSurfaceId)).toEqual(authoredSummary);

    // 3. re-exported from the disabled editor, then re-opened with the
    //    frameworks back ON: nothing was lost on the way through.
    const reExported = disabled.transformer.docToSnapshot(
      openedOff!
    ) as DocSnapshot;
    expect(reExported.blocks).toEqual(authoredSnapshot.blocks);

    const reEnabled = createEditor(ALL_ON);
    const openedOn = await reEnabled.transformer.snapshotToDoc(reExported);
    expect(openedOn).toBeDefined();
    const onSurfaceId = [...openedOn!.getAllModels()].find(
      m => m.flavour === 'affine:surface'
    )!.id;
    expect(describeDocument(openedOn!, onSurfaceId)).toEqual(authoredSummary);
  });
});
