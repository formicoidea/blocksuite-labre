/**
 * An unmounted editor is garbage: neither the integration harness nor the
 * library keeps it.
 *
 * The suite shares one page (`isolate: false`) and that page grew by about
 * 6 MB per test, 8.2 GB over a full run (docs/lessons.md 39). Measured at
 * 25a849786: 30 edgeless mounts and cleanups kept all 30 `BlockStdScope`s,
 * and the JS heap grew by about 650 KB per mount (the detached DOM and
 * canvases they hold come on top, in the renderer). The holders, found in
 * heap snapshots:
 *
 * - the harness: `setupEditor` built a `TestWorkspace` per spec and never
 *   disposed of it or of its store. The workspace's y-protocols `Awareness`
 *   runs a `setInterval` that only `dispose()` clears, and after a local
 *   edit the store's `BlockMetaService` holds a 30 s `throttleTime` timer
 *   until the store is disposed: the page's timer list held every workspace
 *   of the session, its store, its blocks, and on a canvas the last editor
 *   mounted on it. The cleanup a spec keeps in scope also held its app, and
 *   the app its editor;
 * - the library: that last editor was held by the surface model, which kept
 *   the unmounted editor's surface middlewares, each closing over its std
 *   (`SurfaceMiddlewareExtension`). A host that keeps its workspace open
 *   kept one detached editor per document it had opened on the canvas. And
 *   the editor unmounted while active stayed in `UIEventDispatcher`'s static
 *   active slot until another one was activated (seen only after a spec
 *   that had moved the pointer, so every editor here is made active).
 *
 * What it would have caught: any of those holders, as a count of editors
 * still alive after full garbage collections (a number, not a timing), and
 * the harness's growth as a heap budget per mount. The count is eventual:
 * a debounce of a few hundred milliseconds (the toolbar's resize, the
 * viewport's) still holds the last editors for that long, a leak holds them
 * for good.
 */
import { ShapeType } from '@labre/affine/model';
import type { TestWorkspace } from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { aliveAfterGc, usedHeapAfterGc } from '../utils/heap.js';
import { setupEditor } from '../utils/setup.js';

/** Mounts per test: enough for a per-mount leak to stand out of the noise. */
const MOUNTS = 30;

/** Mounts before the heap's baseline: first-use caches fill there. */
const WARM_UP = 5;

/**
 * Heap growth allowed per mount once warm, in bytes. Measured about 75 KB
 * once the teardown frees the editor (20 KB on an empty canvas), about
 * 650 KB while it kept every editor.
 */
const HEAP_BUDGET_PER_MOUNT = 200_000;

/** A frame or two for the canvas to paint what was added. */
const SETTLE_MS = 50;

/** Past the longest debounce that may still hold the last editors. */
const RELEASE_TIMEOUT_MS = 5000;

/** Mounts and garbage collections take a few seconds each test. */
const TEST_TIMEOUT_MS = 60_000;

/** Mount an edgeless editor, active, with a shape on its canvas, painted. */
async function mountWithAShape() {
  const cleanup = await setupEditor('edgeless');
  const edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
  // What a click, a focus or the pointer entering does; most specs do it.
  edgeless.std.event.active = true;
  edgeless.service.crud.addElement('shape', {
    shapeType: ShapeType.Rect,
    xywh: '[0,0,100,100]',
  });
  await edgeless.updateComplete;
  await wait(SETTLE_MS);
  return { cleanup, std: new WeakRef(window.editor.std) };
}

/** Wait until every editor in `refs` has been collected. */
const allReleased = (refs: WeakRef<object>[]) =>
  vi.waitFor(
    async () => expect(await aliveAfterGc(refs), 'editors still alive').toBe(0),
    { timeout: RELEASE_TIMEOUT_MS, interval: 250 }
  );

describe('the editor teardown frees what it mounted', () => {
  test(
    'mounting and cleaning up again and again keeps no editor',
    async () => {
      const editors: WeakRef<object>[] = [];
      let baseline = 0;
      for (let mount = 1; mount <= MOUNTS; mount++) {
        const { cleanup, std } = await mountWithAShape();
        editors.push(std);
        cleanup();
        if (mount === WARM_UP) {
          await allReleased(editors);
          baseline = await usedHeapAfterGc();
        }
      }

      await allReleased(editors);
      const growth = (await usedHeapAfterGc()) - baseline;
      console.log(
        `[heap] ${(growth / (MOUNTS - WARM_UP) / 1000).toFixed(0)} KB per mount over ${MOUNTS - WARM_UP} edgeless mounts`
      );
      expect(
        growth / (MOUNTS - WARM_UP),
        `${(growth / 1e6).toFixed(2)} MB over ${MOUNTS - WARM_UP} mounts`
      ).toBeLessThan(HEAP_BUDGET_PER_MOUNT);
    },
    TEST_TIMEOUT_MS
  );

  test(
    'a workspace kept open does not keep the editors unmounted from it',
    async () => {
      // What a host does: the workspace outlives the editors of its documents.
      const kept: TestWorkspace[] = [];
      const editors: WeakRef<object>[] = [];
      for (let mount = 1; mount <= MOUNTS; mount++) {
        const { cleanup, std } = await mountWithAShape();
        kept.push(window.collection);
        editors.push(std);
        cleanup();
      }

      await allReleased(editors);
      expect(kept).toHaveLength(MOUNTS);
    },
    TEST_TIMEOUT_MS
  );
});
