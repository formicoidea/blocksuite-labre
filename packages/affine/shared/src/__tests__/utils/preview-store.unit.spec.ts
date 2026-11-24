/**
 * `holdPreviewStore`: a preview's query store is released when the last
 * preview using it is gone (#746, ADR 0057, part 3).
 *
 * Previews asking for the same options share one cached store (every frame
 * card of a document, every surface-ref note portal). Before ADR 0057 no
 * library preview disposed of its store, and the three that called
 * `removeStore` dropped the cache entry while the store, and its Yjs
 * observers, stayed alive. A hold per preview, counted per store, lets the
 * last release dispose of it without killing the store of a preview still on
 * screen; a preview moved in the DOM re-holds the same store instead of
 * rebuilding it.
 */
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test } from 'vitest';

import { holdPreviewStore } from '../../utils/preview-store.js';

const query = {
  mode: 'loose' as const,
  match: [{ flavour: 'affine:frame', viewType: 'hidden' as const }],
};

const endOfTask = () => new Promise<void>(resolve => queueMicrotask(resolve));

function openDoc() {
  const workspace = new TestWorkspace({
    id: 'preview-store',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  return { workspace, doc: workspace.createDoc('doc') };
}

const isDisposed = (store: { transact(fn: () => void): void }) => {
  try {
    store.transact(() => {});
    return false;
  } catch {
    return true;
  }
};

describe('holdPreviewStore (ADR 0057 part 3)', () => {
  test('the last release disposes of the store and the container forgets it', async () => {
    const { workspace, doc } = openDoc();
    try {
      const hold = holdPreviewStore(doc, { readonly: true, query });
      hold.release();
      await endOfTask();

      expect(isDisposed(hold.store)).toBe(true);
      expect(doc.getStore({ readonly: true, query })).not.toBe(hold.store);
    } finally {
      workspace.dispose();
    }
  });

  test('two previews share one store; the first release keeps it alive', async () => {
    const { workspace, doc } = openDoc();
    try {
      const first = holdPreviewStore(doc, { readonly: true, query });
      const second = holdPreviewStore(doc, { readonly: true, query });
      expect(second.store).toBe(first.store);

      first.release();
      first.release(); // idempotent: never counts twice
      await endOfTask();
      expect(isDisposed(second.store)).toBe(false);

      second.release();
      await endOfTask();
      expect(isDisposed(second.store)).toBe(true);
    } finally {
      workspace.dispose();
    }
  });

  test('a preview released and held again in the same task keeps its store', async () => {
    const { workspace, doc } = openDoc();
    try {
      const before = holdPreviewStore(doc, { readonly: true, query });
      before.release(); // disconnected…
      const after = holdPreviewStore(doc, { readonly: true, query }); // …reconnected
      await endOfTask();

      expect(after.store).toBe(before.store);
      expect(isDisposed(after.store)).toBe(false);
      after.release();
    } finally {
      workspace.dispose();
    }
  });
});
