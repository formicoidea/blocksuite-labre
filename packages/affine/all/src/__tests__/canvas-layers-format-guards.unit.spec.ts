/**
 * ADR 0031, stage 1 — the format facts user layers are built on, pinned
 * BEFORE any stage writes a field.
 *
 * Layers and "hide for everyone" ship as optional PROPS — `layers` on the
 * `affine:surface` block, `layer` / `hiddenForEveryone` on every gfx block and
 * element — and never as a new element TYPE. That choice rests on three facts
 * about the client already in users' hands, and each is one test here:
 *
 * 1. An unknown `prop:` on a gfx block (a key a newer client wrote) crosses
 *    the doc-snapshot boundary — whole-doc copy, template insertion, cross-doc
 *    drag — and comes back out unchanged.
 * 2. The same for an unknown `prop:` on the `affine:surface` block itself,
 *    where `layers` will live.
 * 3. An unknown element TYPE inside the surface's `elements` map makes the
 *    surface throw while it loads — which is why a `layer` element type was
 *    rejected: an older client would fail to open the whole canvas, not merely
 *    lose its layers.
 *
 * The clipboard half of the guard (a duplicate carries a block's unknown prop,
 * a paste leaves the surface's untouched) needs the real edgeless clipboard and
 * lives in `packages/integration-test/.../unknown-block-props.spec.ts`.
 *
 * The probe key is one no schema will ever declare, for the reason
 * `unknown-element-props.spec.ts` gives: a plausible future name would move the
 * spec onto the declared-prop branch the day that field ships.
 */
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import type { DocSnapshot, Store } from '@labre/store';
import { Schema, Text, Transformer } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { config as rxjsConfig } from 'rxjs';
import { describe, expect, test } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';
import { getAffineSchemas } from '../schemas.js';

const PROBE_KEY = 'x-labre-unknown-probe';
const PROBE_VALUE = 'from-a-newer-client';

function createWorkspace(id: string) {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();

  const transformer = new Transformer({
    schema: new Schema().register(getAffineSchemas({})),
    blobCRUD: collection.blobSync,
    middlewares: [],
    docCRUD: {
      create: (docId: string) =>
        collection.createDoc(docId).getStore({ id: docId }),
      get: (docId: string) =>
        collection.getDoc(docId)?.getStore({ id: docId }) ?? null,
      delete: (docId: string) => collection.removeDoc(docId),
    },
  });

  return { collection, transformer };
}

/** A page, its surface, one note and one shape — the smallest real board. */
function authorBoard(collection: TestWorkspace, id: string) {
  const store = collection.createDoc(id).getStore({ id });
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('L') });
    const surfaceId = store.addBlock('affine:surface', {}, rootId);
    store.addBlock('affine:note', { xywh: '[0,0,400,100]' }, rootId);
    const surface = store.getBlock(surfaceId)!.model as unknown as {
      addElement: (props: Record<string, unknown>) => string;
    };
    surface.addElement({ type: 'shape', xywh: '[500,0,100,100]' });
  });
  return store;
}

type Node = DocSnapshot['blocks'];

function findNode(node: Node, flavour: string): Node | null {
  if (node.flavour === flavour) return node;
  for (const child of node.children) {
    const found = findNode(child, flavour);
    if (found) return found;
  }
  return null;
}

/**
 * The snapshot a NEWER client would have exported: the same board, with the
 * probe key on the block of `flavour`.
 */
function withProbe(snapshot: DocSnapshot, flavour: string, id: string) {
  const copy = JSON.parse(JSON.stringify(snapshot)) as DocSnapshot;
  const node = findNode(copy.blocks, flavour);
  if (!node) throw new Error(`no ${flavour} in the snapshot`);
  node.props[PROBE_KEY] = PROBE_VALUE;
  return { ...copy, meta: { ...copy.meta, id } };
}

function yBlockOf(store: Store, flavour: string) {
  const model = [...store.getAllModels()].find(m => m.flavour === flavour);
  if (!model) throw new Error(`no ${flavour} in the store`);
  return model.yBlock;
}

describe('an unknown prop crosses the doc-snapshot boundary', () => {
  test('on a gfx block (affine:note): import keeps it, re-export emits it', async () => {
    const { collection, transformer } = createWorkspace('guard-note');
    const board = authorBoard(collection, 'board');
    const snapshot = transformer.docToSnapshot(board) as DocSnapshot;

    const reloaded = await transformer.snapshotToDoc(
      withProbe(snapshot, 'affine:note', 'note-reloaded')
    );

    expect(yBlockOf(reloaded!, 'affine:note').get(`prop:${PROBE_KEY}`)).toBe(
      PROBE_VALUE
    );
    const reExported = transformer.docToSnapshot(reloaded!) as DocSnapshot;
    expect(findNode(reExported.blocks, 'affine:note')!.props[PROBE_KEY]).toBe(
      PROBE_VALUE
    );
  });

  /**
   * Stage 1 found this guard red: `SurfaceBlockTransformer` rebuilt the
   * surface's props as `{ elements }` on both `toSnapshot` and
   * `fromSnapshot`, so any other surface prop — `layers` and `showGrid`
   * included — was dropped by a whole-doc copy, a template insertion or an
   * export/import. The transformer now carries every other prop through
   * (ADR 0031, amendment "Snapshots carry the surface props").
   */
  test('on the affine:surface block: import keeps it, re-export emits it', async () => {
    const { collection, transformer } = createWorkspace('guard-surface');
    const board = authorBoard(collection, 'board');
    const snapshot = transformer.docToSnapshot(board) as DocSnapshot;

    const reloaded = await transformer.snapshotToDoc(
      withProbe(snapshot, 'affine:surface', 'surface-reloaded')
    );

    expect(yBlockOf(reloaded!, 'affine:surface').get(`prop:${PROBE_KEY}`)).toBe(
      PROBE_VALUE
    );
    const reExported = transformer.docToSnapshot(reloaded!) as DocSnapshot;
    expect(
      findNode(reExported.blocks, 'affine:surface')!.props[PROBE_KEY]
    ).toBe(PROBE_VALUE);
  });
});

describe('the surface snapshot round trip', () => {
  /**
   * A record-shaped unknown prop (the shape `layers` has) and a boolean one
   * (the shape `showGrid` has) both survive export → import → export
   * unchanged, next to the elements, which round-trip as before.
   */
  test('an unknown record and an unknown boolean come back identical', async () => {
    const { collection, transformer } = createWorkspace('round-trip');
    const board = authorBoard(collection, 'board');
    const snapshot = JSON.parse(
      JSON.stringify(transformer.docToSnapshot(board))
    ) as DocSnapshot;
    const surface = findNode(snapshot.blocks, 'affine:surface')!;
    const record = {
      'probe-a': { name: 'Back', index: 'a0', hidden: true },
      'probe-b': { name: 'Front', index: 'a1' },
    };
    surface.props[`${PROBE_KEY}-record`] = record;
    surface.props[`${PROBE_KEY}-flag`] = false;

    const reloaded = await transformer.snapshotToDoc({
      ...snapshot,
      meta: { ...snapshot.meta, id: 'round-trip-reloaded' },
    });
    const reExported = transformer.docToSnapshot(reloaded!) as DocSnapshot;
    const after = findNode(reExported.blocks, 'affine:surface')!;

    expect(after.props[`${PROBE_KEY}-record`]).toEqual(record);
    expect(after.props[`${PROBE_KEY}-flag`]).toBe(false);
    expect(after.props.elements).toEqual(surface.props.elements);
  });

  /**
   * Every snapshot written before the fix holds `elements` and nothing else
   * on the surface: it must load into a surface whose stored props are
   * exactly that one key, as it always did.
   */
  test('an old snapshot (elements only) loads exactly as before', async () => {
    const { collection, transformer } = createWorkspace('old-snapshot');
    const board = authorBoard(collection, 'board');
    const snapshot = transformer.docToSnapshot(board) as DocSnapshot;
    expect(
      Object.keys(findNode(snapshot.blocks, 'affine:surface')!.props)
    ).toEqual(['elements']);

    const reloaded = await transformer.snapshotToDoc({
      ...snapshot,
      meta: { ...snapshot.meta, id: 'old-reloaded' },
    });
    const yBlock = yBlockOf(reloaded!, 'affine:surface');
    const propKeys = [...yBlock.keys()].filter(key => key.startsWith('prop:'));

    expect(propKeys).toEqual(['prop:elements']);
    const reExported = transformer.docToSnapshot(reloaded!) as DocSnapshot;
    expect(
      Object.keys(findNode(reExported.blocks, 'affine:surface')!.props)
    ).toEqual(['elements']);
  });
});

describe('an unknown element TYPE', () => {
  test('makes the surface throw while it loads', async () => {
    const { collection, transformer } = createWorkspace('guard-type');
    const board = authorBoard(collection, 'board');
    const snapshot = JSON.parse(
      JSON.stringify(transformer.docToSnapshot(board))
    ) as DocSnapshot;
    const surface = findNode(snapshot.blocks, 'affine:surface')!;
    const elements = surface.props.elements as Record<
      string,
      Record<string, unknown>
    >;
    elements['probe-element'] = {
      id: 'probe-element',
      type: 'x-labre-layer-probe',
      index: 'a0',
      xywh: '[0,0,10,10]',
    };

    // The surface builds its element models from its `created` slot, an rxjs
    // subscriber, and rxjs reports a subscriber's throw on a later macrotask
    // through `config.onUnhandledError`. Capture it there rather than letting
    // it escape as an unhandled error, and wait for that macrotask.
    const thrown: unknown[] = [];
    const previous = rxjsConfig.onUnhandledError;
    rxjsConfig.onUnhandledError = error => thrown.push(error);
    try {
      await transformer.snapshotToDoc({
        ...snapshot,
        meta: { ...snapshot.meta, id: 'type-reloaded' },
      });
      await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
      rxjsConfig.onUnhandledError = previous;
    }

    expect(thrown).toHaveLength(1);
    expect(String(thrown[0])).toMatch(
      /Invalid element type: x-labre-layer-probe/
    );
  });
});
