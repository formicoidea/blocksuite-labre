/**
 * GUARD — the crop menu's preset rows stay clickable once a crop exists.
 *
 * What it would have caught (PO acceptance, 2026-11-05): « Free » (or the
 * ratio last used) could not be picked again after a first crop. The rows
 * marked `data-selected` from the mask the STORED crop remembers, and a
 * selected `editor-menu-action` is inert (`pointer-events: none`: re-picking
 * a choice in force is a no-op there). These rows are not a choice but the
 * gesture that opens the frame, so the row in force is the preset the frame
 * is OPEN on, and none once it is closed.
 */
import {
  type ImageBlockModel,
  ImageBlockSchemaExtension,
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { TestWorkspace } from '@labre/store/test';
import { render } from 'lit';
import { describe, expect, test } from 'vitest';

import { ImageCropController } from '../crop/crop-controller';
import { imageCropToolbarAction } from '../crop/crop-toolbar';
import { writeImageCrop } from '../crop/write-crop';

let seq = 0;

function authorImage() {
  const collection = new TestWorkspace({ id: `crop-toolbar-rows-${seq++}` });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ImageBlockSchemaExtension,
  ];
  collection.meta.initialize();
  const store = collection.createDoc().getStore();
  let imageId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', {});
    const noteId = store.addBlock('affine:note', {}, rootId);
    imageId = store.addBlock('affine:image', { sourceId: 'sha-abc' }, noteId);
  });
  store.resetHistory();
  return { store, model: store.getModelById(imageId) as ImageBlockModel };
}

/** No translation provider: every wording falls back to its English. */
const std = { getOptional: () => undefined, get: () => undefined } as never;

function rows(controller: ImageCropController) {
  const block = {
    cropController: controller,
    blobUrl: 'blob:image',
    model: controller['_block'].model,
  };
  const action = imageCropToolbarAction(() => block);
  const host = document.createElement('div');
  render(action.content!({ std, readonly: false } as never), host);
  const selected = Array.from(
    host.querySelectorAll<HTMLElement>('[data-testid^="image-crop-"]')
  )
    .filter(row => row.hasAttribute('data-selected'))
    .map(row => row.dataset.testid);
  return { host, selected };
}

describe('the crop menu rows', () => {
  test('no row is in force while the frame is closed, whatever the crop', () => {
    const { model } = authorImage();
    const controller = new ImageCropController(
      { model, std, querySelector: () => null },
      false
    );
    writeImageCrop(model, { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, 'free', false);

    expect(rows(controller).selected).toEqual([]);
  });

  test('the row in force is the preset the frame is open on', () => {
    const { model } = authorImage();
    const controller = new ImageCropController(
      { model, std, querySelector: () => null },
      false
    );
    writeImageCrop(model, { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, 'free', false);

    controller.choose('free');
    expect(rows(controller).selected).toEqual(['image-crop-free']);

    controller.stop();
    expect(rows(controller).selected).toEqual([]);
  });
});
