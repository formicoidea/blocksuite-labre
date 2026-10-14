/**
 * ADR 0037 — the image crop is one optional stored key, `prop:crop`.
 *
 * This spec would have caught:
 * - a `crop` default other than `undefined`: `sync-controller` writes such a
 *   default into every image the first time a document opens, which edits
 *   every existing page on load and syncs that edit to every peer;
 * - a reader that trusts the stored value: a damaged or hostile crop must
 *   show the whole picture, never an empty box or a throw;
 * - an "uncrop" that writes a full rectangle instead of removing the key,
 *   which an older client cannot tell from a crop.
 */
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import {
  IMAGE_CROP_MASKS,
  type ImageBlockModel,
  ImageBlockSchemaExtension,
  imageCropSourceRect,
  readImageCrop,
} from '../blocks/image/index.js';
import { NoteBlockSchemaExtension } from '../blocks/note/index.js';
import { RootBlockSchemaExtension } from '../blocks/root/index.js';

let seq = 0;

function workspace() {
  const collection = new TestWorkspace({ id: `image-crop-${seq++}` });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ImageBlockSchemaExtension,
  ];
  collection.meta.initialize();
  return collection;
}

/** A page holding one image, written the way a 0.49 client writes it. */
function authorImage() {
  const collection = workspace();
  const doc = collection.createDoc('page');
  const store = doc.getStore();
  let imageId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', {});
    const noteId = store.addBlock('affine:note', {}, rootId);
    imageId = store.addBlock(
      'affine:image',
      { sourceId: 'sha-abc', width: 400, height: 300 },
      noteId
    );
  });
  return { doc, store, imageId };
}

const yBlockOf = (spaceDoc: Y.Doc, id: string) =>
  spaceDoc.getMap('blocks').get(id) as Y.Map<unknown>;

/** Every key an image stored before ADR 0037 — no more, no less. */
const KEYS_BEFORE_CROP = [
  'prop:caption',
  'prop:height',
  'prop:index',
  'prop:lockedBySelf',
  'prop:rotate',
  'prop:size',
  'prop:sourceId',
  'prop:width',
  'prop:xywh',
  'sys:children',
  'sys:flavour',
  'sys:id',
  'sys:version',
];

describe('image crop: stored format (ADR 0037)', () => {
  test('a new image stores no crop key', () => {
    const { doc, imageId } = authorImage();
    const keys = Array.from(yBlockOf(doc.spaceDoc, imageId).keys()).sort();

    expect(keys).not.toContain('prop:crop');
    // A key this list does not name is a new default someone started writing.
    expect(keys).toEqual(KEYS_BEFORE_CROP);
  });

  test('opening a document without crop writes nothing', () => {
    const { doc, imageId } = authorImage();
    const update = Y.encodeStateAsUpdate(doc.spaceDoc);

    const reopened = workspace().createDoc('page');
    Y.applyUpdate(reopened.spaceDoc, update);
    const stateBefore = Y.encodeStateVector(reopened.spaceDoc);
    const jsonBefore = JSON.stringify(reopened.spaceDoc.toJSON());

    const store = reopened.getStore();
    store.load();
    const model = store.getModelById(imageId) as ImageBlockModel;

    expect(model.props.crop).toBeUndefined();
    expect(model.props.crop$.value).toBeUndefined();
    expect(readImageCrop(model.props.crop)).toBeUndefined();
    expect(Y.encodeStateVector(reopened.spaceDoc)).toEqual(stateBefore);
    expect(JSON.stringify(reopened.spaceDoc.toJSON())).toBe(jsonBefore);
    expect(yBlockOf(reopened.spaceDoc, imageId).has('prop:crop')).toBe(false);
  });

  test('a crop round-trips through Yjs and is removed by deleting the key', () => {
    const { doc, store, imageId } = authorImage();
    const model = store.getModelById(imageId) as ImageBlockModel;

    store.updateBlock(model, {
      crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.25, mask: '16:9' },
    });
    expect(readImageCrop(model.props.crop)).toEqual({
      x: 0.1,
      y: 0.2,
      w: 0.5,
      h: 0.25,
      mask: '16:9',
    });
    expect(yBlockOf(doc.spaceDoc, imageId).has('prop:crop')).toBe(true);

    const reopened = workspace().createDoc('page');
    Y.applyUpdate(reopened.spaceDoc, Y.encodeStateAsUpdate(doc.spaceDoc));
    const peer = reopened.getStore();
    peer.load();
    expect(
      readImageCrop((peer.getModelById(imageId) as ImageBlockModel).props.crop)
    ).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.25, mask: '16:9' });

    store.transact(() => {
      delete (model.props as { crop?: unknown }).crop;
    });
    expect(model.props.crop).toBeUndefined();
    expect(yBlockOf(doc.spaceDoc, imageId).has('prop:crop')).toBe(false);
  });
});

describe('IMAGE_CROP_MASKS', () => {
  // Stored tokens are append-only: a token renamed or removed is a crop an
  // existing document can no longer reopen on its preset.
  test('is frozen; a new mask goes at the end', () => {
    expect(IMAGE_CROP_MASKS).toEqual(['free', '16:9', '4:3', '1:1']);
  });
});

describe('readImageCrop', () => {
  test('reads a valid crop and drops an unknown mask token', () => {
    expect(readImageCrop({ x: 0, y: 0, w: 0.5, h: 1 })).toEqual({
      x: 0,
      y: 0,
      w: 0.5,
      h: 1,
    });
    expect(readImageCrop({ x: 0, y: 0, w: 0.5, h: 1, mask: 'golden' })).toEqual(
      { x: 0, y: 0, w: 0.5, h: 1 }
    );
    expect(readImageCrop({ x: 0, y: 0, w: 0.5, h: 1, mask: 'free' })).toEqual({
      x: 0,
      y: 0,
      w: 0.5,
      h: 1,
    });
  });

  test.each([
    ['absent', undefined],
    ['null', null],
    ['a string', '0,0,1,1'],
    ['NaN', { x: Number.NaN, y: 0, w: 0.5, h: 0.5 }],
    ['Infinity', { x: 0, y: 0, w: Infinity, h: 0.5 }],
    ['a missing side', { x: 0, y: 0, w: 0.5 }],
    ['an empty side', { x: 0, y: 0, w: 0, h: 0.5 }],
    ['a sliver', { x: 0, y: 0, w: 0.001, h: 0.5 }],
    ['a negative origin', { x: -0.2, y: 0, w: 0.5, h: 0.5 }],
    ['outside the image', { x: 0.6, y: 0, w: 0.5, h: 0.5 }],
    ['the whole image', { x: 0, y: 0, w: 1, h: 1, mask: '1:1' }],
  ])('%s reads as the whole image', (_, value) => {
    expect(readImageCrop(value)).toBeUndefined();
  });

  test('the source rectangle a raster export draws', () => {
    expect(
      imageCropSourceRect({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 800, 400)
    ).toEqual({ x: 200, y: 200, w: 400, h: 100 });
    // Nothing to cut: the caller draws the whole image, never a 0×0 source.
    expect(imageCropSourceRect(undefined, 800, 400)).toBeNull();
    expect(
      imageCropSourceRect({ x: 0.25, y: 0, w: 0.5, h: 1 }, 0, 0)
    ).toBeNull();
  });
});
