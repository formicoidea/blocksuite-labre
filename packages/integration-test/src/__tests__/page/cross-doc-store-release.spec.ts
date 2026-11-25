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
 * keeps it), and nothing of A opens it again, a re-render or a document-list
 * change included (the card read B through its default store's key and
 * rebuilt it); B is then opened again on a fresh store and edited, and A
 * shows the edit.
 */
import type { EmbedLinkedDocBlockComponent } from '@labre/affine/blocks/embed-doc';
import type { SurfaceRefBlockComponent } from '@labre/affine/blocks/surface-ref';
import { type Store, Text } from '@labre/store';
import { afterEach, describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

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

/** B's `Doc`: it says whether a default store is open, and builds none. */
const docB = () => window.collection.getDoc(B_ID)!;

/** Something in the workspace renamed: a document-list change. */
function renameA(title: string) {
  window.collection.meta.setDocMeta(window.doc.id, { title });
}

/** A peer of `doc` adds a paragraph under `noteId`; it arrives remote. */
function peerAddsParagraph(doc: Y.Doc, noteId: string, text: string) {
  const peer = new Y.Doc();
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc));
  peer.transact(() => {
    const blocks = peer.getMap<Y.Map<unknown>>('blocks');
    const paragraph = new Y.Map<unknown>();
    paragraph.set('sys:id', text);
    paragraph.set('sys:flavour', 'affine:paragraph');
    paragraph.set('sys:version', 1);
    paragraph.set('sys:children', new Y.Array<string>());
    paragraph.set('prop:type', 'text');
    paragraph.set('prop:text', new Y.Text(text));
    blocks.set(text, paragraph);
    (blocks.get(noteId)!.get('sys:children') as Y.Array<string>).push([text]);
  });
  Y.applyUpdate(
    doc,
    Y.encodeStateAsUpdate(peer, Y.encodeStateVector(doc)),
    'remote'
  );
  peer.destroy();
}

/** A linked-doc card to `pageId` in A, and what it shows. */
function mountCard(pageId: string) {
  const cardId = window.doc.addBlock(
    'affine:embed-linked-doc',
    { pageId, style: 'vertical' },
    noteOfA()
  );
  const card = () =>
    window.editor.host!.querySelector<EmbedLinkedDocBlockComponent>(
      `affine-embed-linked-doc-block[data-block-id="${cardId}"]`
    )!;
  const preview = () =>
    card()?.querySelector<HTMLElement>('.affine-embed-doc-content-note-blocks')
      ?.textContent ?? '';
  const loading = () =>
    !!card()?.querySelector('.affine-embed-linked-doc-block.loading');
  return { card, preview, loading };
}

/** Release B's default store, forget it here, answer a weak reference. */
function closeB(b: { store: Store | null }) {
  const store = b.store!;
  b.store = null;
  store.dispose();
  return new WeakRef(store);
}

describe('another document shows a document that is closed (ADR 0057)', () => {
  test("a linked-doc card lets B's store go, never opens it again, then shows B edited on a fresh store", async () => {
    cleanup = await setupEditor('page');
    const b = openB();
    const cardId = window.doc.addBlock(
      'affine:embed-linked-doc',
      { pageId: B_ID, style: 'vertical' },
      noteOfA()
    );
    const card = () =>
      window.editor.host!.querySelector<EmbedLinkedDocBlockComponent>(
        `affine-embed-linked-doc-block[data-block-id="${cardId}"]`
      )!;
    const preview = () =>
      card().querySelector<HTMLElement>(
        '.affine-embed-doc-content-note-blocks'
      );
    const title = () =>
      card()
        .querySelector('.affine-embed-linked-doc-content-title-text')
        ?.textContent?.trim();
    await until(() => expect(preview()?.textContent).toContain('first'));
    expect(title()).toBe('B');

    const released = closeB(b);
    expect(docB().defaultStore).toBeNull();

    // A forced re-render and reload of the card.
    card().requestUpdate();
    card().refreshData();
    await card().updateComplete;
    expect(docB().defaultStore).toBeNull();
    // A document-list change: another document renamed, then B.
    renameA('A renamed');
    await card().updateComplete;
    expect(docB().defaultStore).toBeNull();
    window.collection.meta.setDocMeta(B_ID, { title: 'B renamed' });
    await until(() => expect(title()).toBe('B renamed'));
    expect(docB().defaultStore).toBeNull();

    await allCollected([released]);
    expect(docB().defaultStore).toBeNull();

    const fresh = docB().getStore();
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
    expect(docB().defaultStore).toBeNull();
    surfaceRef.requestUpdate();
    await surfaceRef.updateComplete;
    renameA('A renamed');
    expect(docB().defaultStore).toBeNull();
    await allCollected([released]);
    expect(docB().defaultStore).toBeNull();

    const fresh = docB().getStore();
    fresh.load();
    fresh.updateBlock(b.frameId, { xywh: '[10,10,300,150]' });

    await until(() =>
      expect(surfaceRef.referenceModel?.xywh).toBe('[10,10,300,150]')
    );
    fresh.dispose();
  });

  test("B open nowhere: a peer's new block shows in the card; B opened, then closed: it keeps up, nothing rebuilt", async () => {
    cleanup = await setupEditor('page');
    const b = openB();
    closeB(b);
    const { preview } = mountCard(B_ID);
    await until(() => expect(preview()).toContain('first'));
    // Read from the card's own store: B is still closed.
    expect(docB().defaultStore).toBeNull();

    peerAddsParagraph(docB().spaceDoc, b.noteId, 'from-a-peer');
    await until(() => expect(preview()).toContain('from-a-peer'));
    expect(docB().defaultStore).toBeNull();

    const open = { store: docB().getStore() as Store | null };
    open.store!.load();
    peerAddsParagraph(docB().spaceDoc, b.noteId, 'while-open');
    await until(() => expect(preview()).toContain('while-open'));

    closeB(open);
    peerAddsParagraph(docB().spaceDoc, b.noteId, 'after-close');
    expect(docB().defaultStore).toBeNull();
  });

  test("B's content arrives and B is opened in one task while the card waits: the card stops loading and shows it", async () => {
    cleanup = await setupEditor('page');
    const arriving = window.collection.createDoc('doc:arriving');
    const { preview, loading } = mountCard(arriving.id);
    await until(() => expect(loading()).toBe(true));

    // Written elsewhere, then, in one task: synced in, and opened by the host.
    const source = window.collection
      .createDoc('doc:arriving-source')
      .getStore();
    source.load(() => {
      const root = source.addBlock('affine:page', { title: new Text('Late') });
      const note = source.addBlock('affine:note', {}, root);
      source.addBlock('affine:paragraph', { text: new Text('arrived') }, note);
    });
    Y.applyUpdate(
      arriving.spaceDoc,
      Y.encodeStateAsUpdate(source.spaceDoc),
      'remote'
    );
    const opened = arriving.getStore();
    opened.load();

    await until(() => expect(loading()).toBe(false));
    await until(() => expect(preview()).toContain('arrived'));
    opened.dispose();
    source.dispose();
  });
});
