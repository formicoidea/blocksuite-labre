/**
 * The drag image's store is released when the drag ends (#746, ADR 0057,
 * part 3).
 *
 * Every block drag builds its image from a query store of the document
 * (`PreviewHelper.getPreviewStd`), and nothing released it: each drag left a
 * store, with every Yjs observer it attached, for the workspace's life. The
 * helper now holds each image's store until `releasePreviews()`, which the
 * drag watcher runs when the drag ends, dropped or cancelled.
 */
import { ViewExtensionManagerIdentifier } from '@labre/affine-ext-loader';
import {
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  DocModeProvider,
  EditorSettingProvider,
} from '@labre/affine-shared/services';
import type { Store } from '@labre/store';
import { Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { describe, expect, test } from 'vitest';

import type { AffineDragHandleWidget } from '../drag-handle.js';
import { PreviewHelper } from '../helpers/preview-helper.js';

const endOfTask = () => new Promise<void>(resolve => queueMicrotask(resolve));

const isDisposed = (store: Store) => {
  try {
    store.transact(() => {});
    return false;
  } catch {
    return true;
  }
};

function openStore() {
  const workspace = new TestWorkspace({
    id: 'drag-preview-release',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
  ];
  workspace.meta.initialize();
  const store = workspace.createDoc('doc').getStore();
  let paragraphId = '';
  store.load(() => {
    const page = store.addBlock('affine:page', {});
    const note = store.addBlock('affine:note', {}, page);
    paragraphId = store.addBlock(
      'affine:paragraph',
      { text: new Text('dragged') },
      note
    );
  });
  return { workspace, store, paragraphId };
}

/** The few services `getPreviewStd` reads, and the editor's own store. */
function widgetOn(store: Store) {
  const services = new Map<unknown, unknown>([
    [DocModeProvider, { getEditorMode: () => 'page' }],
    [EditorSettingProvider, { setting$: signal({}) }],
    [ViewExtensionManagerIdentifier, { get: () => [] }],
  ]);
  return {
    std: { get: (id: unknown) => services.get(id) },
    store,
    host: { querySelector: () => null },
  } as unknown as AffineDragHandleWidget;
}

describe('the drag image store (ADR 0057 part 3)', () => {
  test('is a query store of the document, disposed when the drag ends', async () => {
    const { workspace, store, paragraphId } = openStore();
    try {
      const helper = new PreviewHelper(widgetOn(store));
      const { previewStd } = helper.getPreviewStd([paragraphId]);
      const preview = previewStd.store;
      expect(preview).not.toBe(store);
      expect(preview.getBlock(paragraphId)?.blockViewType).toBe('display');

      helper.releasePreviews();
      await endOfTask();

      expect(isDisposed(preview)).toBe(true);
      // The editor's store is untouched.
      expect(isDisposed(store)).toBe(false);
      expect(store.getBlock(paragraphId)).toBeDefined();
    } finally {
      workspace.dispose();
    }
  });

  test('two drags of the same blocks: each drag end releases its image', async () => {
    const { workspace, store, paragraphId } = openStore();
    try {
      const helper = new PreviewHelper(widgetOn(store));
      const first = helper.getPreviewStd([paragraphId]).previewStd.store;
      helper.releasePreviews();
      await endOfTask();
      const second = helper.getPreviewStd([paragraphId]).previewStd.store;

      expect(second).not.toBe(first);
      expect(isDisposed(second)).toBe(false);
      helper.releasePreviews();
      await endOfTask();
      expect(isDisposed(second)).toBe(true);
    } finally {
      workspace.dispose();
    }
  });
});
