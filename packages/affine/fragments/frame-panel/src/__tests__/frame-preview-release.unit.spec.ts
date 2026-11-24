/**
 * The frame cards release their shared preview store (#746, ADR 0057,
 * part 3).
 *
 * Every frame card of a document builds its thumbnail from the same query
 * store (`{ readonly: true, query: <frames hidden> }`). On disconnect a card
 * called `removeStore({ query })`, whose readonly key reads `'false'`: the
 * entry it created stayed, and nothing disposed of the store. Disposing of
 * it per card would have killed the thumbnails of every other card, so each
 * card holds it and the last one to go disposes of it.
 */
import { DocModeProvider } from '@labre/affine-shared/services';
import { type Store } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, test } from 'vitest';

import { AFFINE_FRAME_PREVIEW, FramePreview } from '../card/frame-preview.js';

if (!customElements.get(AFFINE_FRAME_PREVIEW)) {
  customElements.define(AFFINE_FRAME_PREVIEW, FramePreview);
}

const endOfTask = () => new Promise<void>(resolve => queueMicrotask(resolve));

const isDisposed = (store: Store) => {
  try {
    store.transact(() => {});
    return false;
  } catch {
    return true;
  }
};

const previewFilter = {
  mode: 'loose' as const,
  match: [{ flavour: 'affine:frame', viewType: 'hidden' as const }],
};

function openStore() {
  const workspace = new TestWorkspace({
    id: 'frame-preview-release',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const store = workspace.createDoc('doc').getStore();
  store.load();
  return { workspace, store };
}

/**
 * A card's preview, connected. Fluid and hidden, it never measures a width,
 * so it builds no mini editor: only its store is under test.
 */
function connectPreview(store: Store) {
  const preview = new FramePreview();
  preview.std = {
    get: (id: unknown) => (id === DocModeProvider ? {} : null),
  } as never;
  preview.frame = {
    xywh: '[0,0,100,100]',
    propsUpdated: new Subject(),
    store,
  } as never;
  preview.fluid = true;
  preview.style.display = 'none';
  document.body.append(preview);
  return preview;
}

const previewStoreOf = (store: Store) =>
  store.doc.getStore({ readonly: true, query: previewFilter });

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the frame preview store (ADR 0057 part 3)', () => {
  test('the last card to go disposes of the shared store', async () => {
    const { workspace, store } = openStore();
    try {
      const first = connectPreview(store);
      const second = connectPreview(store);
      const shared = previewStoreOf(store);

      first.remove();
      await endOfTask();
      expect(isDisposed(shared)).toBe(false);
      expect(previewStoreOf(store)).toBe(shared);

      second.remove();
      await endOfTask();
      expect(isDisposed(shared)).toBe(true);
      expect(previewStoreOf(store)).not.toBe(shared);
      expect(isDisposed(store)).toBe(false);
    } finally {
      workspace.dispose();
    }
  });

  test('a card moved in the DOM keeps its store', async () => {
    const { workspace, store } = openStore();
    try {
      const preview = connectPreview(store);
      const shared = previewStoreOf(store);
      document.body.prepend(preview); // disconnect then reconnect
      await endOfTask();
      expect(isDisposed(shared)).toBe(false);
      expect(previewStoreOf(store)).toBe(shared);
      preview.remove();
    } finally {
      workspace.dispose();
    }
  });
});
