/**
 * « Rogner » (ADR 0037): the geometry of the crop tool and the one write it
 * makes per gesture.
 *
 * This spec would have caught:
 * - a preset that ignores the source's proportions (a 16:9 window on a
 *   portrait photo is wider than tall only in pixels, not in fractions);
 * - a window dragged or resized out of the picture, or a held ratio lost on
 *   the way to the image's edge;
 * - a canvas crop that keeps the box and squeezes the picture, or moves the
 *   kept part elsewhere on the canvas (rotation included);
 * - a gesture split into several undo steps, an unchanged gesture pushing an
 *   empty one, a write on a readonly store, or a crop that touches the bytes.
 */
import {
  type ImageBlockModel,
  ImageBlockSchemaExtension,
  NoteBlockSchemaExtension,
  readImageCrop,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';

import {
  cropBoundFor,
  maskRatio,
  moveCrop,
  presetCrop,
  ratioCrop,
  resizeCrop,
  WHOLE_IMAGE,
  wholeImageSize,
} from '../crop/crop-math';
import { writeImageCrop } from '../crop/write-crop';

const close = (actual: Record<string, number>, expected: typeof actual) => {
  for (const [key, value] of Object.entries(expected)) {
    expect(actual[key], key).toBeCloseTo(value, 6);
  }
};

describe('crop geometry', () => {
  test('a preset is the largest centred window of its ratio, in pixels', () => {
    // 1600×900 is already 16:9: the whole image.
    close(presetCrop('16:9', 1600, 900), WHOLE_IMAGE);
    // A portrait 900×1600: full width, 506.25 px of height.
    const portrait = presetCrop('16:9', 900, 1600);
    close(portrait, { x: 0, w: 1, h: 506.25 / 1600 });
    expect(portrait.y).toBeCloseTo((1 - portrait.h) / 2, 6);
    // A wide 2000×1000 in 1:1: full height, half the width, centred.
    close(presetCrop('1:1', 2000, 1000), { x: 0.25, y: 0, w: 0.5, h: 1 });
    close(presetCrop('free', 2000, 1000), WHOLE_IMAGE);
    expect(maskRatio('4:3', 0, 100)).toBeNull();
  });

  test('a ratio crop cuts a picture to a box (ADR 0044)', () => {
    // A 2:1 box on a square picture: the whole width, the middle half.
    close(ratioCrop(2, 400, 400), { x: 0, y: 0.25, w: 1, h: 0.5 });
    // A 1:2 box on a 1600×900 picture: full height, 450 px of width.
    close(ratioCrop(0.5, 1600, 900), {
      x: (1 - 450 / 1600) / 2,
      y: 0,
      w: 450 / 1600,
      h: 1,
    });
    // Same proportions, or nothing known: the whole picture.
    close(ratioCrop(16 / 9, 1600, 900), WHOLE_IMAGE);
    close(ratioCrop(0, 1600, 900), WHOLE_IMAGE);
    close(ratioCrop(2, 0, 900), WHOLE_IMAGE);
  });

  test('moving keeps the window inside the image', () => {
    const start = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };
    close(moveCrop(start, 0.1, -0.05), { x: 0.3, y: 0.15, w: 0.5, h: 0.5 });
    close(moveCrop(start, 1, -1), { x: 0.5, y: 0, w: 0.5, h: 0.5 });
  });

  test('a free corner resizes against the pinned opposite corner', () => {
    const start = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };
    close(resizeCrop(start, 'se', 0.1, -0.2, null), {
      x: 0.2,
      y: 0.2,
      w: 0.6,
      h: 0.3,
    });
    close(resizeCrop(start, 'nw', -0.5, -0.5, null), {
      x: 0,
      y: 0,
      w: 0.7,
      h: 0.7,
    });
  });

  test('a held ratio survives the image edge', () => {
    const k = maskRatio('16:9', 1600, 900) as number; // 1 in fractions
    const start = { x: 0.1, y: 0.1, w: 0.4, h: 0.4 };
    const grown = resizeCrop(start, 'se', 0.8, 0.1, k);
    expect(grown.w / grown.h).toBeCloseTo(k, 6);
    expect(grown.x + grown.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(grown.y + grown.h).toBeLessThanOrEqual(1 + 1e-9);
    close(grown, { x: 0.1, y: 0.1, w: 0.9, h: 0.9 });
  });

  test('a resized page window stores the WHOLE picture size', () => {
    const crop = { x: 0.25, y: 0, w: 0.5, h: 0.5 };
    // Known proportions: the height follows the source.
    expect(
      wholeImageSize({ w: 150, h: 75 }, crop, { width: 800, height: 400 })
    ).toEqual({ width: 300, height: 150 });
    // An SVG with no intrinsic size, or a picture not loaded yet: the window
    // is scaled back up on both axes, never written as the whole size —
    // that shrank the image on every resize.
    expect(wholeImageSize({ w: 150, h: 60 }, crop, null)).toEqual({
      width: 300,
      height: 120,
    });
  });

  test('the canvas box keeps the scale and the place of the kept part', () => {
    const bound = { x: 100, y: 100, w: 400, h: 200 };
    // Keep the right half: the box halves in width and moves right.
    close(cropBoundFor(bound, 0, WHOLE_IMAGE, { x: 0.5, y: 0, w: 0.5, h: 1 }), {
      x: 300,
      y: 100,
      w: 200,
      h: 200,
    });
    // And back: the whole picture where it was.
    close(
      cropBoundFor(
        { x: 300, y: 100, w: 200, h: 200 },
        0,
        { x: 0.5, y: 0, w: 0.5, h: 1 },
        WHOLE_IMAGE
      ),
      bound
    );
    // Turned a half turn, the right half of the picture is on the LEFT.
    close(
      cropBoundFor(bound, 180, WHOLE_IMAGE, { x: 0.5, y: 0, w: 0.5, h: 1 }),
      { x: 100, y: 100, w: 200, h: 200 }
    );
  });
});

let seq = 0;

function authorImage(props: Partial<ImageBlockModel['props']> = {}) {
  const collection = new TestWorkspace({ id: `image-crop-write-${seq++}` });
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
    imageId = store.addBlock(
      'affine:image',
      { sourceId: 'sha-abc', ...props },
      noteId
    );
  });
  store.resetHistory();
  const model = store.getModelById(imageId) as ImageBlockModel;
  return { store, model };
}

describe('writeImageCrop', () => {
  test('a page crop writes the crop alone and is one undo step', () => {
    const { store, model } = authorImage({ width: 400, height: 300 });
    const rect = { x: 0.1, y: 0.2, w: 0.5, h: 0.5 };

    expect(writeImageCrop(model, rect, '4:3', false)).toBe(true);
    expect(readImageCrop(model.props.crop)).toEqual({ ...rect, mask: '4:3' });
    expect(model.props.width).toBe(400);
    expect(model.props.height).toBe(300);
    expect(model.props.sourceId).toBe('sha-abc');

    store.undo();
    expect(model.props.crop).toBeUndefined();
    expect(store.canUndo).toBe(false);
  });

  test('a canvas crop moves the box in the same step', () => {
    const { store, model } = authorImage({ xywh: '[100,100,400,200]' });

    writeImageCrop(model, { x: 0.5, y: 0, w: 0.5, h: 1 }, 'free', true);
    expect(Bound.deserialize(model.xywh).toXYWH()).toEqual([
      300, 100, 200, 200,
    ]);
    expect(readImageCrop(model.props.crop)).toEqual({
      x: 0.5,
      y: 0,
      w: 0.5,
      h: 1,
    });

    store.undo();
    expect(model.xywh).toBe('[100,100,400,200]');
    expect(model.props.crop).toBeUndefined();
  });

  test('the original image removes the key and restores the box', () => {
    const { model } = authorImage({ xywh: '[100,100,400,200]' });
    writeImageCrop(model, { x: 0.5, y: 0, w: 0.5, h: 1 }, '1:1', true);

    expect(writeImageCrop(model, undefined, 'free', true)).toBe(true);
    expect(model.props.crop).toBeUndefined();
    expect(model.xywh).toBe('[100,100,400,200]');
  });

  test('nothing is written when nothing changes', () => {
    const { store, model } = authorImage();
    expect(writeImageCrop(model, WHOLE_IMAGE, 'free', false)).toBe(false);
    expect(writeImageCrop(model, undefined, 'free', false)).toBe(false);

    const rect = { x: 0, y: 0, w: 0.5, h: 0.5 };
    writeImageCrop(model, rect, 'free', false);
    store.resetHistory();
    expect(writeImageCrop(model, { ...rect }, 'free', false)).toBe(false);
    expect(store.canUndo).toBe(false);
    // The same window under another preset is a change.
    expect(writeImageCrop(model, rect, '1:1', false)).toBe(true);
  });

  test('a readonly store is never written', () => {
    const { store, model } = authorImage();
    store.readonly = true;
    expect(
      writeImageCrop(model, { x: 0, y: 0, w: 0.5, h: 0.5 }, 'free', false)
    ).toBe(false);
    expect(model.props.crop).toBeUndefined();
  });
});
