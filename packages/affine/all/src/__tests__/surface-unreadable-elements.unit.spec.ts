/**
 * Surface loading against the REAL element types (#669, #681, ADR 0053).
 *
 * `framework/std` holds the load guard and its own spec with test element
 * types; these two cases need the real models, the real connector watcher and
 * the real spatial index, which only this package assembles.
 *
 * 1. **A real type whose MOUNT throws.** A raw writer stores a `mindmap` whose
 *    `children` map holds a `null` node. The model builds; its `children`
 *    observer runs `buildTree` at mount and throws `Cannot read properties of
 *    null (reading 'index')` (`affine/model/.../mindmap.ts`). Before the guard
 *    that throw left the load loop: the shapes beside it were never mounted
 *    and the surface watchers never set up. The mindmap is now skipped as
 *    `unreadable`, everything else mounts, nothing is written.
 * 2. **Elements stored without `id`** (#681: a template JSON written with
 *    `snapshotToDoc` as is). The model used to take its id from the stored
 *    `id` prop, so it got `undefined`, and the first `elementAdded` or
 *    `elementUpdated` reached `GridManager` with `getElementById(undefined)`:
 *    `null.externalXYWH`, reported by rxjs as an unhandled error. Identity is
 *    now the key in the elements map; two id-less shapes and the id-less
 *    connector between them load, index and update.
 *
 * Errors thrown in an rxjs subscriber surface on a later macrotask through
 * `config.onUnhandledError`; every test captures them there and asserts none.
 */
import type { SurfaceBlockModel } from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import type { ConnectorElementModel } from '@labre/affine-model';
import { type GfxController, GridManager } from '@labre/std/gfx';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { config as rxjsConfig } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { getInternalStoreExtensions } from '../extensions/store.js';

const storeExtensions = () =>
  new StoreExtensionManager(getInternalStoreExtensions({})).get('store');

let seq = 0;
let thrown: unknown[] = [];
const previousHandler = rxjsConfig.onUnhandledError;

beforeEach(() => {
  thrown = [];
  rxjsConfig.onUnhandledError = error => thrown.push(error);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  rxjsConfig.onUnhandledError = previousHandler;
  vi.restoreAllMocks();
});

/** Lets rxjs report what a subscriber threw, and the watchers' microtasks run. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

/** The document the editor wrote: a page and an empty surface. */
function createBoard() {
  const id = `unreadable-${seq++}`;
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = storeExtensions();
  collection.meta.initialize();
  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('#669') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });

  // A bare copy of the same document, written to as any outside writer would.
  const raw = new Y.Doc();
  Y.applyUpdate(raw, Y.encodeStateAsUpdate(store.spaceDoc));

  return { collection, id, surfaceId, raw };
}

function elementsOf(spaceDoc: Y.Doc, surfaceId: string) {
  const block = spaceDoc.getMap('blocks').get(surfaceId) as Y.Map<unknown>;
  const boxed = block.get('prop:elements') as Y.Map<unknown>;
  return boxed.get('value') as Y.Map<unknown>;
}

function writeRaw(
  raw: Y.Doc,
  surfaceId: string,
  elements: Record<string, Record<string, unknown>>
) {
  const target = elementsOf(raw, surfaceId);
  raw.transact(() => {
    Object.entries(elements).forEach(([key, props]) => {
      const map = new Y.Map<unknown>();
      target.set(key, map);
      Object.entries(props).forEach(([prop, value]) => map.set(prop, value));
    });
  });
}

/**
 * Opens the document in a second tab, with the real spatial index mounted on
 * its surface, and records every Yjs update the open itself produces.
 */
function open(board: ReturnType<typeof createBoard>): {
  store: Store;
  surface: SurfaceBlockModel;
  updates: Uint8Array[];
} {
  const reader = new TestWorkspace({ id: board.id });
  reader.storeExtensions = storeExtensions();
  Y.applyUpdate(reader.doc, Y.encodeStateAsUpdate(board.collection.doc));
  const doc = reader.getDoc(board.id)!;
  Y.applyUpdate(doc.spaceDoc, Y.encodeStateAsUpdate(board.raw), 'remote');

  const updates: Uint8Array[] = [];
  const record = (update: Uint8Array) => updates.push(update);
  doc.spaceDoc.on('update', record);
  const store = doc.getStore({ id: board.id });
  doc.load();
  const surface = store.getBlock(board.surfaceId)!
    .model as unknown as SurfaceBlockModel;
  doc.spaceDoc.off('update', record);

  new GridManager({
    std: { store },
    surface,
  } as unknown as GfxController).mounted();

  return { store, surface, updates };
}

function sync(raw: Y.Doc, store: Store) {
  Y.applyUpdate(
    store.spaceDoc,
    Y.encodeStateAsUpdate(raw, Y.encodeStateVector(store.spaceDoc)),
    'remote'
  );
}

/** The proof a model is mounted: its updates leave the surface. */
function expectMounted(surface: SurfaceBlockModel, id: string) {
  const updated: string[] = [];
  const subscription = surface.elementUpdated.subscribe(payload =>
    updated.push(payload.id)
  );
  surface.updateElement(id, { xywh: '[7,7,100,100]' });
  subscription.unsubscribe();
  expect(updated).toContain(id);
}

const shape = (x: number) => ({
  type: 'shape',
  shapeType: 'rect',
  xywh: `[${x},0,100,100]`,
});

describe('a real mindmap whose mount throws on a null node', () => {
  const elements = () => {
    const children = new Y.Map<unknown>();
    children.set('shape-a', { index: 'a0' });
    children.set('broken', null);
    return {
      'shape-a': { ...shape(0), id: 'shape-a', index: 'a0', seed: 1 },
      mindmap: {
        type: 'mindmap',
        id: 'mindmap',
        index: 'a1',
        seed: 2,
        children,
      },
      'shape-b': { ...shape(300), id: 'shape-b', index: 'a2', seed: 3 },
    };
  };

  test('is skipped at load; the shapes beside it mount', async () => {
    const board = createBoard();
    writeRaw(board.raw, board.surfaceId, elements());

    const { surface, updates } = open(board);
    await settle();

    expect(thrown).toEqual([]);
    expect(surface.getElementById('mindmap')).toBeNull();
    expect(surface.damagedElements.get('mindmap')).toEqual({
      type: 'mindmap',
      reason: 'unreadable',
    });
    expect(updates).toEqual([]);
    expectMounted(surface, 'shape-a');
    expectMounted(surface, 'shape-b');
    await settle();
    expect(thrown).toEqual([]);
  });

  test('is skipped the same way when it arrives by a remote update', async () => {
    const board = createBoard();
    const { store, surface } = open(board);
    const added: string[] = [];
    surface.elementAdded.subscribe(({ id }) => added.push(id));

    writeRaw(board.raw, board.surfaceId, elements());
    expect(() => sync(board.raw, store)).not.toThrow();
    await settle();

    expect(thrown).toEqual([]);
    expect(added.sort()).toEqual(['shape-a', 'shape-b']);
    expect(surface.damagedElements.get('mindmap')?.reason).toBe('unreadable');
    expectMounted(surface, 'shape-b');
  });
});

describe('elements stored without an id (#681)', () => {
  /** What `snapshotToDoc` of a template JSON leaves: no `id`, `index`, `seed`. */
  const elements = () => ({
    'shape-a': shape(0),
    'shape-b': shape(300),
    link: {
      type: 'connector',
      // A template stores its mode; without one the path generator throws
      // `unknown connector mode`, a separate gap this spec does not cover.
      mode: 0,
      source: { id: 'shape-a' },
      target: { id: 'shape-b' },
    },
  });

  test('load under their keys, and a shape update reaches the index', async () => {
    const board = createBoard();
    writeRaw(board.raw, board.surfaceId, elements());

    const { surface, updates } = open(board);
    await settle();

    for (const key of ['shape-a', 'shape-b', 'link']) {
      expect(surface.getElementById(key)!.id).toBe(key);
    }
    expect(surface.damagedElements.size).toBe(0);
    expect(updates).toEqual([]);

    expectMounted(surface, 'shape-a');
    await settle();
    expect(thrown).toEqual([]);
    const connector = surface.getElementById('link') as ConnectorElementModel;
    expect(connector.source.id).toBe('shape-a');
  });

  test('the same when they arrive by a remote update', async () => {
    const board = createBoard();
    const { store, surface } = open(board);
    const added: string[] = [];
    surface.elementAdded.subscribe(({ id }) => added.push(id));

    writeRaw(board.raw, board.surfaceId, elements());
    sync(board.raw, store);
    await settle();

    expect(added.sort()).toEqual(['link', 'shape-a', 'shape-b']);
    expectMounted(surface, 'shape-b');
    await settle();
    expect(thrown).toEqual([]);
  });
});
