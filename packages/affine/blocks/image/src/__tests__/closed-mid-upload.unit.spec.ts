/**
 * Images uploaded and measured while the document is closed are not
 * written (#746, ADR 0057).
 *
 * `addImageBlocks` and `addSiblingImageBlocks` upload and measure every
 * file (`await Promise.all(...)`) before they write the blocks. A host that
 * closed the document meanwhile (`store.dispose()`) made the write throw,
 * an unhandled rejection, and the gesture could not tell: a released store
 * still answers "writable". They now check `store.disposed` after the
 * await and write nothing.
 */
import {
  ImageBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import type { Store } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { addImageBlocks, addSiblingImageBlocks } from '../utils.js';

const gate = vi.hoisted(() => ({
  measure: null as null | ((size: { width: number; height: number }) => void),
}));

vi.mock('@labre/affine-shared/utils', async original => ({
  ...(await original<typeof import('@labre/affine-shared/utils')>()),
  readImageSize: () =>
    new Promise(resolve => {
      gate.measure = resolve;
    }),
}));

/** What the stubbed measure answers. */
const SIDE = 10;
const BYTES = 4;
/** Well above any test file. */
const MAX_FILE_SIZE = 1_000_000;

afterEach(() => {
  gate.measure = null;
});

function openStore() {
  const workspace = new TestWorkspace({
    id: 'closed-mid-upload',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const store = workspace.createDoc('doc').getStore({
    extensions: [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      ParagraphBlockSchemaExtension,
      ImageBlockSchemaExtension,
    ],
  });
  let noteId = '';
  let paragraphId = '';
  store.load(() => {
    const root = store.addBlock('affine:page', {});
    noteId = store.addBlock('affine:note', {}, root);
    paragraphId = store.addBlock('affine:paragraph', {}, noteId);
  });
  const std = {
    store,
    get: () => ({ maxFileSize: MAX_FILE_SIZE }),
    getOptional: () => null,
  } as never;
  return { workspace, store, std, noteId, paragraphId };
}

const recordUpdates = (store: Store) => {
  const updates: Uint8Array[] = [];
  store.spaceDoc.on('update', (update: Uint8Array) => updates.push(update));
  return updates;
};

const picture = () =>
  new File([new Uint8Array(BYTES)], 'a.png', { type: 'image/png' });

describe('images added to a document closed during their upload (ADR 0057)', () => {
  test('addImageBlocks writes nothing and resolves to no block', async () => {
    const { workspace, store, std, noteId } = openStore();
    try {
      const pending = addImageBlocks(std, [picture()], noteId);
      await vi.waitFor(() => expect(gate.measure).not.toBeNull());
      store.dispose();
      const updates = recordUpdates(store);
      gate.measure!({ width: SIDE, height: SIDE });

      await expect(pending).resolves.toEqual([]);
      expect(updates).toEqual([]);
    } finally {
      workspace.dispose();
    }
  });

  test('addSiblingImageBlocks writes nothing and resolves to no block', async () => {
    const { workspace, store, std, paragraphId } = openStore();
    try {
      const target = store.getModelById(paragraphId)!;
      const pending = addSiblingImageBlocks(std, [picture()], target);
      await vi.waitFor(() => expect(gate.measure).not.toBeNull());
      store.dispose();
      const updates = recordUpdates(store);
      gate.measure!({ width: SIDE, height: SIDE });

      await expect(pending).resolves.toEqual([]);
      expect(updates).toEqual([]);
    } finally {
      workspace.dispose();
    }
  });

  test('the store still open: the image is written, as before', async () => {
    const { workspace, store, std, noteId } = openStore();
    try {
      const pending = addImageBlocks(std, [picture()], noteId);
      await vi.waitFor(() => expect(gate.measure).not.toBeNull());
      gate.measure!({ width: SIDE, height: SIDE });

      const ids = await pending;
      expect(ids).toHaveLength(1);
      expect(store.getBlock(ids[0]!)?.flavour).toBe('affine:image');
    } finally {
      workspace.dispose();
    }
  });
});
