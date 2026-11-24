/**
 * What a workspace kept open retains of the stores opened in it (#746,
 * ADR 0057). The Labre app keeps one workspace for the whole session and
 * mounts an editor per document it opens; `editor-teardown.spec.ts` builds a
 * fresh workspace per mount and disposes of it, so its "75 KB per mount" does
 * not describe this case (docs/lessons.md 39, amendment of 2026-11-24).
 *
 * Measured at 63635c2ab, Chromium, headless, 20 documents with 3 before the
 * heap baseline, each mounted in edgeless with one shape drawn, then
 * unmounted (this spec and a throwaway variant of it, two runs per case, the
 * first case of a run discarded as JIT warm-up):
 *
 * - remounting ONE document 20 times: `doc.getStore()` is keyed by the
 *   sub-document's guid (`store/src/impls/doc.ts:151-153`), so every mount
 *   gets the same store; the heap grows by 18-20 KB per mount, the shape each
 *   mount adds to the document;
 * - opening 20 DISTINCT documents, without disposing of the store (what a
 *   host does today, and should): 20 of 20 stores alive, 85-89 KB of JS heap
 *   per document. With `store.dispose()` and `removeStore` after the
 *   unmount: still 20 of 20, 69-80 KB per document. Part of that is the
 *   document's own Yjs content, which the workspace's root `Y.Doc` keeps
 *   whatever the store does; the split was not measured. The holders of the
 *   store are the Yjs observers it attaches and `dispose()` does not detach
 *   (per-block `observe` closures, the awareness `change` listener, the
 *   `Y.UndoManager` never destroyed). Only `workspace.dispose()` and dropping
 *   the workspace free them: at once for disposed stores, 30 s later for the
 *   others (the `BlockMetaService` throttle window of their last local edit);
 * - 20 previews through `doc.getStore({ query })` (the drag preview, the
 *   linked-doc card, the frame preview): 20 of 20 alive, even after
 *   `dispose()` and `removeStore`; 20 calls to `getStore({ readonly: false })`
 *   give 20 distinct stores, each under a random key
 *   (`store/src/model/store-container.ts:23-27`).
 *
 * Every test is a real assertion. Two held before ADR 0057 and stay: one
 * document remounted keeps one store and no editor, and a store removed from
 * its container is rebuilt live from Yjs (it sees a block a peer adds). Four
 * pinned the leak above (`PINNED LEAK`) and were flipped to their ADR 0057
 * targets as its parts landed: a disposed store is collected, `dispose()`
 * alone makes the next `getStore()` build a new, live store, disposed preview
 * stores are collected, and `getStore({ readonly: false })` is one store.
 * Measured at the landing of part 1 (Chromium, headless): 0 of 20 disposed
 * stores alive once the last editors' debounces ran (3 of 20 at the first
 * collection after the loop), 0 of 20 preview stores, 10-12 KB of heap per
 * document opened and closed (69-80 KB before).
 *
 * Each test builds its own workspace and disposes of it in a `finally`: the
 * session shares one page (`isolate: false`), and a disposed, dropped
 * workspace frees every store it held (within the 30 s above).
 */
import { ShapeType } from '@labre/affine/model';
import {
  CommunityCanvasTextFonts,
  FontConfigExtension,
} from '@labre/affine/shared/services';
import { type Query, type Store, Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { TestAffineEditorContainer } from '../../index.js';
import { getTestStoreManager } from '../../store.js';
import { getTestViewManager } from '../../view.js';
import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { aliveAfterGc, usedHeapAfterGc } from '../utils/heap.js';
// Its import registers the editor's custom elements (`effects()`), once.
import { cleanup } from '../utils/setup.js';

/** Documents (or mounts, or previews) per test. */
const N = 20;

/** Documents opened before the heap's baseline: first-use caches fill there. */
const WARM_UP = 3;

/** A frame or two for the canvas to paint what was added. */
const SETTLE_MS = 50;

/** Past the longest debounce that may still hold the last editors. */
const RELEASE_TIMEOUT_MS = 5000;

/** How often `allReleased` collects and counts again. */
const RELEASE_POLL_MS = 250;

/** Mounts and garbage collections take a few seconds each test. */
const TEST_TIMEOUT_MS = 90_000;

const BYTES_PER_KB = 1000;

const storeExtensions = getTestStoreManager().get('store');
const viewManager = getTestViewManager();

let workspaces = 0;

/** `0 … count - 1`. */
const indices = (count: number) => Array.from({ length: count }, (_, i) => i);

/** Run `step` for each index, one after the other (mounts never overlap). */
const inSequence = <T>(
  from: number,
  to: number,
  step: (i: number) => Promise<T>
) =>
  indices(to - from).reduce<Promise<T[]>>(
    async (done, i) => [...(await done), await step(from + i)],
    Promise.resolve([])
  );

/** A workspace a host would keep open: one per test, disposed in `finally`. */
function openWorkspace() {
  workspaces += 1;
  const workspace = new TestWorkspace({
    id: `store-retention-${workspaces}`,
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.storeExtensions = storeExtensions;
  workspace.meta.initialize();
  return workspace;
}

/** Open a document the way a host does: the default store, loaded, seeded. */
function openStore(workspace: TestWorkspace, docId: string) {
  const doc = workspace.getDoc(docId) ?? workspace.createDoc(docId);
  const store = doc.getStore();
  store.load(() => {
    if (store.root) return;
    const rootId = store.addBlock('affine:page', { title: new Text() });
    store.addBlock('affine:surface', {}, rootId);
  });
  return { doc, store };
}

/**
 * Mount an edgeless editor on `store`, active, draw a shape, let it paint,
 * then unmount it. Returns a weak reference to the editor's std.
 */
async function mountAndUnmount(store: Store) {
  const app = document.createElement('div');
  const editor = new TestAffineEditorContainer();
  editor.doc = store;
  editor.mode = 'edgeless';
  editor.pageSpecs = [
    ...viewManager.get('page'),
    FontConfigExtension(CommunityCanvasTextFonts),
  ];
  editor.edgelessSpecs = [
    ...viewManager.get('edgeless'),
    FontConfigExtension(CommunityCanvasTextFonts),
  ];
  app.append(editor);
  document.body.append(app);
  await editor.updateComplete;

  const edgeless = getDocRootBlock(store, editor, 'edgeless');
  // What a click, a focus or the pointer entering does; most specs do it.
  edgeless.std.event.active = true;
  edgeless.service.crud.addElement('shape', {
    shapeType: ShapeType.Rect,
    xywh: '[0,0,100,100]',
  });
  await edgeless.updateComplete;
  await wait(SETTLE_MS);

  const std = new WeakRef<object>(editor.std);
  app.remove();
  return std;
}

/** Wait until every object in `refs` has been collected. */
const allReleased = (refs: WeakRef<object>[], what: string) =>
  vi.waitFor(
    async () => expect(await aliveAfterGc(refs), `${what} still alive`).toBe(0),
    { timeout: RELEASE_TIMEOUT_MS, interval: RELEASE_POLL_MS }
  );

const kbPer = (bytes: number, count: number) =>
  (bytes / count / BYTES_PER_KB).toFixed(0);

describe('a workspace kept open and the stores opened in it', () => {
  test(
    'remounting one document reuses its store and keeps no editor',
    async () => {
      cleanup(); // a previous spec's editor and workspace, if it left them
      const workspace = openWorkspace();
      try {
        const { store: first } = openStore(workspace, 'doc:retained');
        const editors = await inSequence(0, N, async mount => {
          const { store } = openStore(workspace, 'doc:retained');
          expect(store, `mount ${mount}`).toBe(first);
          return mountAndUnmount(store);
        });
        await allReleased(editors, 'editors');
      } finally {
        workspace.dispose();
      }
    },
    TEST_TIMEOUT_MS
  );

  /**
   * ADR 0057 part 1 (was PINNED LEAK: 20 of 20 alive, held by the Yjs
   * observers `dispose()` left attached): a store disposed after its last
   * unmount is collected. The last editors mounted on it are collected a
   * moment later (their debounces), so the count is awaited like theirs in
   * the first test. The heap per document is logged, not asserted.
   */
  test(
    'a store disposed after its last unmount is collected',
    async () => {
      cleanup();
      const workspace = openWorkspace();
      try {
        /** Open, mount, unmount, then the release a host would make. */
        const openAndClose = async (index: number) => {
          const { doc, store } = openStore(workspace, `doc:${index}`);
          await mountAndUnmount(store);
          store.dispose();
          // A no-op since ADR 0057: `dispose()` already forgot the store.
          doc.removeStore({ id: doc.spaceDoc.guid });
          return new WeakRef(store);
        };
        const warm = await inSequence(0, WARM_UP, openAndClose);
        const baseline = await usedHeapAfterGc();
        const measured = await inSequence(WARM_UP, N, openAndClose);
        const stores = [...warm, ...measured];

        const alive = await aliveAfterGc(stores);
        const growth = (await usedHeapAfterGc()) - baseline;
        console.log(
          `[store-retention] ${alive}/${N} disposed stores alive, ${kbPer(growth, N - WARM_UP)} KB per document over ${N - WARM_UP} documents`
        );
        await allReleased(stores, 'disposed stores');
      } finally {
        workspace.dispose();
      }
    },
    TEST_TIMEOUT_MS
  );

  /**
   * ADR 0057 part 1 (was PINNED LEAK: `dispose()` alone left the store in its
   * container, the next `getStore()` handed the same dead store back, and it
   * never saw what a peer added): the next `getStore()` builds a new store,
   * which sees the block a peer adds.
   */
  test('dispose() alone makes the next getStore() build a live store', () => {
    cleanup();
    const workspace = openWorkspace();
    try {
      const { doc, store } = openStore(workspace, 'doc:dead');
      store.dispose();
      const reopened = doc.getStore();
      // `toBe` on two stores would print both object graphs on failure.
      expect(reopened === store, 'the same, disposed, store').toBe(false);
      reopened.load();
      const noteId = addNoteFromAPeer(doc.spaceDoc, store);
      expect(doc.yBlocks.has(noteId)).toBe(true);
      expect(reopened.getBlock(noteId)?.flavour).toBe('affine:note');
    } finally {
      workspace.dispose();
    }
  });

  /**
   * What already holds: once the disposed store is removed from its
   * container, the next `getStore()` builds a new one from Yjs, which is
   * live: a block a peer adds reaches it and its `blockUpdated` fires. ADR
   * 0057 makes the removal implicit; this must stay true.
   */
  test('after removeStore, reopening builds a live store from Yjs', () => {
    cleanup();
    const workspace = openWorkspace();
    try {
      const { doc, store } = openStore(workspace, 'doc:reopened');
      store.dispose();
      doc.removeStore({ id: doc.spaceDoc.guid });

      const reopened = doc.getStore();
      expect(reopened).not.toBe(store);
      reopened.load();
      expect(reopened.root?.flavour).toBe('affine:page');
      const added: string[] = [];
      reopened.slots.blockUpdated.subscribe(({ type, id }) => {
        if (type === 'add') added.push(id);
      });

      const noteId = addNoteFromAPeer(doc.spaceDoc, reopened);

      expect(reopened.getBlock(noteId)?.flavour).toBe('affine:note');
      expect(added).toContain(noteId);
    } finally {
      workspace.dispose();
    }
  });

  /**
   * ADR 0057 part 1 (was PINNED LEAK: 20 of 20 alive): 20 preview stores,
   * each disposed the way a call site does once its preview is gone, are
   * collected.
   */
  test(
    'a query store disposed after its preview is collected',
    async () => {
      cleanup();
      const workspace = openWorkspace();
      try {
        const { doc, store } = openStore(workspace, 'doc:previewed');
        const rootId = store.root?.id ?? '';
        // A distinct query per preview, as a drag of a different selection or
        // a card of a different document makes.
        const previews = indices(N).map(index => {
          const query: Query = {
            mode: 'strict',
            match: [
              { id: rootId, viewType: 'display' },
              { id: `preview-${index}`, viewType: 'display' },
            ],
          };
          const preview = doc.getStore({ query });
          preview.dispose();
          doc.removeStore({ query });
          return new WeakRef(preview);
        });

        const alive = await aliveAfterGc(previews);
        console.log(
          `[store-retention] ${alive}/${N} query stores alive after dispose + removeStore`
        );
        expect(alive).toBe(0);
      } finally {
        workspace.dispose();
      }
    },
    TEST_TIMEOUT_MS
  );

  /**
   * PINNED LEAK (ADR 0057 part 2): every `getStore({ readonly: false })`
   * mints a new store under a random key, 20 distinct stores for 20 calls.
   */
  test('today each getStore({ readonly: false }) builds a new store', () => {
    cleanup();
    const workspace = openWorkspace();
    try {
      const { doc, store } = openStore(workspace, 'doc:writeable');
      const stores = new Set(
        indices(N).map(() => doc.getStore({ readonly: false }))
      );
      console.log(
        `[store-retention] ${stores.size} distinct stores from ${N} getStore({ readonly: false })`
      );
      expect(stores.size, 'PINNED LEAK, see the docblock').toBe(N);
      // ADR 0057 target: expect(stores.size).toBe(1);
      // and it stays distinct from the default store (doc.unit.spec.ts,
      // "local readonly"):
      expect(stores.has(store)).toBe(false);
    } finally {
      workspace.dispose();
    }
  });
});

/**
 * A peer adds an empty note under the page, and its update reaches this
 * client as a remote one (origin `'remote'`, not this doc's client id).
 * Returns the note's id. `schemaOf` gives the note's schema version.
 */
function addNoteFromAPeer(spaceDoc: Y.Doc, schemaOf: Store) {
  const peer = new Y.Doc();
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(spaceDoc));
  const blocks = peer.getMap<Y.Map<unknown>>('blocks');
  const root = [...blocks.values()].find(
    block => block.get('sys:flavour') === 'affine:page'
  );
  if (!root) throw new Error('addNoteFromAPeer: no page block');
  const noteId = 'note-from-a-peer';
  const version =
    schemaOf.schema.flavourSchemaMap.get('affine:note')?.version ?? 1;
  peer.transact(() => {
    const note = new Y.Map<unknown>();
    note.set('sys:id', noteId);
    note.set('sys:flavour', 'affine:note');
    note.set('sys:version', version);
    note.set('sys:children', new Y.Array<string>());
    blocks.set(noteId, note);
    (root.get('sys:children') as Y.Array<string>).push([noteId]);
  });
  Y.applyUpdate(
    spaceDoc,
    Y.encodeStateAsUpdate(peer, Y.encodeStateVector(spaceDoc)),
    'remote'
  );
  peer.destroy();
  return noteId;
}
