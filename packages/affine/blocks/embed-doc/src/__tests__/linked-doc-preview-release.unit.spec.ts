/**
 * A linked-doc card releases the store of its note preview (#746, ADR 0057,
 * part 3).
 *
 * `renderLinkedDocInCard` built the preview from a query store of the
 * linked document on every render and never released it: a synced card
 * re-renders on each update of its document, and each render whose blocks
 * changed left a store, with every Yjs observer it attached, for the
 * workspace's life. A card now holds its preview's store, swaps it when a
 * render needs another one, and releases it when it disconnects; two cards
 * showing the same blocks share one store, and one card going leaves the
 * other's alive.
 */
import { ViewExtensionManagerIdentifier } from '@labre/affine-ext-loader';
import {
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { effects as stdEffects } from '@labre/std/effects';
import { type Store, Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';

import {
  releaseLinkedDocPreview,
  renderLinkedDocInCard,
} from '../common/render-linked-doc.js';

// The preview renders an `editor-host`.
stdEffects();

type Card = Parameters<typeof renderLinkedDocInCard>[0];

const endOfTask = () => new Promise<void>(resolve => queueMicrotask(resolve));

const isDisposed = (store: Store) => {
  try {
    store.transact(() => {});
    return false;
  } catch {
    return true;
  }
};

function openLinkedDoc() {
  const workspace = new TestWorkspace({
    id: 'linked-doc-preview-release',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
  ];
  workspace.meta.initialize();
  const linkedDoc = workspace.createDoc('linked').getStore();
  let noteId = '';
  linkedDoc.load(() => {
    const page = linkedDoc.addBlock('affine:page', {});
    noteId = linkedDoc.addBlock('affine:note', {}, page);
    linkedDoc.addBlock('affine:paragraph', { text: new Text('one') }, noteId);
  });
  // Every query store the cards ask for, in order.
  const previews: Store[] = [];
  const getStore = linkedDoc.doc.getStore.bind(linkedDoc.doc);
  vi.spyOn(linkedDoc.doc, 'getStore').mockImplementation(options => {
    const store = getStore(options);
    if (options?.query) previews.push(store);
    return store;
  });
  return { workspace, linkedDoc, noteId, previews };
}

/** The members `renderLinkedDocInCard` reads off a card. */
function cardOf(linkedDoc: Store) {
  const container = document.createElement('div');
  return {
    linkedDoc,
    model: { props: { pageId: linkedDoc.id, style: 'vertical' } },
    isNoteContentEmpty: true,
    isError: false,
    isConnected: true,
    noteContainer: Promise.resolve(container),
    host: {
      std: {
        get: (id: unknown) =>
          id === ViewExtensionManagerIdentifier ? { get: () => [] } : null,
      },
    },
  } as unknown as Card;
}

async function render(card: Card, previews: Store[]) {
  const before = previews.length;
  renderLinkedDocInCard(card);
  await vi.waitFor(() => expect(previews.length).toBe(before + 1));
  return previews[previews.length - 1];
}

describe('the linked-doc card preview store (ADR 0057 part 3)', () => {
  test('a disconnected card releases its preview store', async () => {
    const { workspace, linkedDoc, previews } = openLinkedDoc();
    try {
      const card = cardOf(linkedDoc);
      const preview = await render(card, previews);
      expect(preview).not.toBe(linkedDoc);

      releaseLinkedDocPreview(card);
      await endOfTask();

      expect(isDisposed(preview)).toBe(true);
      expect(isDisposed(linkedDoc)).toBe(false);
    } finally {
      workspace.dispose();
    }
  });

  test('a render that needs other blocks swaps the store; the same blocks keep it', async () => {
    const { workspace, linkedDoc, noteId, previews } = openLinkedDoc();
    try {
      const card = cardOf(linkedDoc);
      const first = await render(card, previews);
      const again = await render(card, previews);
      await endOfTask();
      expect(again).toBe(first);
      expect(isDisposed(first)).toBe(false);

      linkedDoc.addBlock('affine:paragraph', { text: new Text('two') }, noteId);
      const other = await render(card, previews);
      await endOfTask();
      expect(other).not.toBe(first);
      expect(isDisposed(first)).toBe(true);
      expect(isDisposed(other)).toBe(false);

      releaseLinkedDocPreview(card);
    } finally {
      workspace.dispose();
    }
  });

  test('two cards of the same document share a store until the last one goes', async () => {
    const { workspace, linkedDoc, previews } = openLinkedDoc();
    try {
      const first = cardOf(linkedDoc);
      const second = cardOf(linkedDoc);
      const shared = await render(first, previews);
      expect(await render(second, previews)).toBe(shared);

      releaseLinkedDocPreview(first);
      await endOfTask();
      expect(isDisposed(shared)).toBe(false);

      releaseLinkedDocPreview(second);
      await endOfTask();
      expect(isDisposed(shared)).toBe(true);
    } finally {
      workspace.dispose();
    }
  });
});
