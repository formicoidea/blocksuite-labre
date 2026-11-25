/**
 * A document closed while another document shows it (#746, ADR 0057,
 * amendment of 2026-11-25).
 *
 * A host closes a document with `store.dispose()` on its default store. That
 * store is shared across the workspace, and components of OTHER documents
 * read it:
 *
 * - a linked-doc card in A subscribed once to B's default store: after B was
 *   closed the card kept the released store alive and never refreshed again,
 *   whoever edited B afterwards (a peer, or B reopened on a fresh store);
 * - a surface-ref in A referencing an element of B kept that element's
 *   model, from B's default store: dead (its surface disposed) and keeping
 *   the store alive.
 *
 * Held here end to end, for each: A stays mounted with its card or its
 * surface-ref; B's default store is disposed and collected (nothing of A
 * keeps it); B is then opened again on a fresh store and edited, and A shows
 * the edit.
 */
import type { SurfaceRefBlockComponent } from '@labre/affine/blocks/surface-ref';
import { type Store, Text } from '@labre/store';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { aliveAfterGc } from '../utils/heap.js';
import { setupEditor } from '../utils/setup.js';

const PATIENCE_MS = 5000;
const RELEASE_POLL_MS = 250;
const B_ID = 'doc:closed-b';

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

const until = <T>(check: () => T) =>
  vi.waitFor(check, { timeout: PATIENCE_MS });

/** B, opened the way a host opens it: its default store, seeded. */
function openB() {
  const store = window.collection.createDoc(B_ID).getStore();
  let noteId = '';
  let frameId = '';
  store.load(() => {
    const root = store.addBlock('affine:page', { title: new Text('B') });
    const surface = store.addBlock('affine:surface', {}, root);
    noteId = store.addBlock('affine:note', {}, root);
    store.addBlock('affine:paragraph', { text: new Text('first') }, noteId);
    frameId = store.addBlock(
      'affine:frame',
      { title: new Text('Frame'), xywh: '[0,0,200,100]' },
      surface
    );
  });
  return { store: store as Store | null, noteId, frameId };
}

/** A note of A, the document mounted in the editor. */
function noteOfA() {
  const a = window.doc;
  return a.addBlock('affine:note', {}, a.root!.id);
}

/** Wait until every reference has been collected. */
const allCollected = (refs: WeakRef<object>[]) =>
  vi.waitFor(async () => expect(await aliveAfterGc(refs)).toBe(0), {
    timeout: PATIENCE_MS,
    interval: RELEASE_POLL_MS,
  });

/** Release B's default store, forget it here, answer a weak reference. */
function closeB(b: { store: Store | null }) {
  const store = b.store!;
  b.store = null;
  store.dispose();
  return new WeakRef(store);
}

describe('another document shows a document that is closed (ADR 0057)', () => {
  test("a linked-doc card lets B's store go, then shows B edited on a fresh store", async () => {
    cleanup = await setupEditor('page');
    const b = openB();
    window.doc.addBlock(
      'affine:embed-linked-doc',
      { pageId: B_ID, style: 'vertical' },
      noteOfA()
    );
    const preview = () =>
      window.editor.host!.querySelector<HTMLElement>(
        '.affine-embed-doc-content-note-blocks'
      );
    await until(() => expect(preview()?.textContent).toContain('first'));

    const released = closeB(b);
    await allCollected([released]);

    const fresh = window.collection.getDoc(B_ID)!.getStore();
    fresh.load();
    fresh.addBlock('affine:paragraph', { text: new Text('second') }, b.noteId);

    await until(() => expect(preview()?.textContent).toContain('second'));
    fresh.dispose();
  });

  test("a surface-ref to an element of B lets B's store go, then follows B edited on a fresh store", async () => {
    cleanup = await setupEditor('page');
    const b = openB();
    const id = window.doc.addBlock(
      'affine:surface-ref',
      { reference: b.frameId, refFlavour: 'affine:frame' },
      noteOfA()
    );
    const surfaceRef = await until(() => {
      const element =
        window.editor.host!.querySelector<SurfaceRefBlockComponent>(
          `affine-surface-ref[data-block-id="${id}"]`
        );
      expect(element?.referenceModel?.id).toBe(b.frameId);
      return element!;
    });
    // Read from B's readonly store, never from the default one.
    // A frame is a block model: it has the store it was read from.
    const referenced = surfaceRef.referenceModel as { store?: Store } | null;
    expect(referenced?.store).toBeDefined();
    expect(referenced?.store).not.toBe(b.store);

    const released = closeB(b);
    await allCollected([released]);

    const fresh = window.collection.getDoc(B_ID)!.getStore();
    fresh.load();
    fresh.updateBlock(b.frameId, { xywh: '[10,10,300,150]' });

    await until(() =>
      expect(surfaceRef.referenceModel?.xywh).toBe('[10,10,300,150]')
    );
    fresh.dispose();
  });
});
