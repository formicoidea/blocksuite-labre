/**
 * « Rogner » (ADR 0037): the geometry of the crop tool and the one write it
 * makes per gesture.
 *
 * This spec would have caught:
 * - a preset that ignores the source's proportions (a 16:9 window on a
 *   portrait photo is wider than tall only in pixels, not in fractions);
 * - a window dragged or resized out of the picture, or a held ratio lost on
 *   the way to the image's edge;
 * - an edge handle that moves the opposite edge, changes the other dimension
 *   of a free window, or lets the window leave the image or go below the
 *   minimum side; with a ratio, an edge that loses the ratio, grows the
 *   other side off its centre, or stops dead against the image border
 *   instead of being pushed back inside (PO acceptance, 2026-11-05);
 * - a canvas crop that keeps the box and squeezes the picture, or moves the
 *   kept part elsewhere on the canvas (rotation included);
 * - a gesture split into several undo steps, an unchanged gesture pushing an
 *   empty one, a write on a readonly store, or a crop that touches the bytes;
 * - a drag inside the frame that moves the frame instead of the picture
 *   (the PO's acceptance of 2026-11-04 inverted the gesture), a pan that
 *   uncovers the frame, or a zoom that drifts off the frame's centre, loses
 *   its ratio, goes below 1x or below the minimum side, or reads back a
 *   zoom other than the one the slider set;
 * - a pan or a zoom that moves the canvas box, or changes the size of the
 *   page window (`width × crop.w`), or takes more than one undo step;
 * - a canvas frame that opens with the selection handles still live on its
 *   corners or the canvas still zooming under the wheel (the PO could not
 *   crop, 2026-10-27), or a close path that leaves the image in editing
 *   state or the viewport locked.
 */
import {
  IMAGE_CROP_MIN_SIDE,
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
  cropWheelFactor,
  cropZoomOf,
  maskRatio,
  moveCrop,
  panCrop,
  presetCrop,
  ratioCrop,
  resizeCrop,
  resizeCropEdge,
  WHOLE_IMAGE,
  wholeImageSize,
  zoomCropAt,
} from '../crop/crop-math';
import { ImageCropController } from '../crop/crop-controller';
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

  test('a free edge resizes one side only, the opposite edge pinned', () => {
    const start = { x: 0.2, y: 0.3, w: 0.4, h: 0.4 };
    close(resizeCropEdge(start, 'e', 0.1, null), {
      x: 0.2,
      y: 0.3,
      w: 0.5,
      h: 0.4,
    });
    // The left edge follows the pointer, the right edge stays at 0.6.
    close(resizeCropEdge(start, 'w', -0.1, null), {
      x: 0.1,
      y: 0.3,
      w: 0.5,
      h: 0.4,
    });
    // The top edge going down, the bottom edge stays at 0.7.
    close(resizeCropEdge(start, 'n', 0.1, null), {
      x: 0.2,
      y: 0.4,
      w: 0.4,
      h: 0.3,
    });
    close(resizeCropEdge(start, 's', -0.1, null), {
      x: 0.2,
      y: 0.3,
      w: 0.4,
      h: 0.3,
    });
  });

  test('a free edge stops at the image border and at the minimum side', () => {
    const start = { x: 0.2, y: 0.3, w: 0.4, h: 0.4 };
    close(resizeCropEdge(start, 's', 1, null), {
      x: 0.2,
      y: 0.3,
      w: 0.4,
      h: 0.7,
    });
    close(resizeCropEdge(start, 'w', -1, null), {
      x: 0,
      y: 0.3,
      w: 0.6,
      h: 0.4,
    });
    close(resizeCropEdge(start, 'e', -1, null), {
      x: 0.2,
      y: 0.3,
      w: IMAGE_CROP_MIN_SIDE,
      h: 0.4,
    });
    close(resizeCropEdge(start, 'n', 1, null), {
      x: 0.2,
      y: 0.7 - IMAGE_CROP_MIN_SIDE,
      w: 0.4,
      h: IMAGE_CROP_MIN_SIDE,
    });
  });

  test('with a ratio, an edge drags the other side along, centred', () => {
    const k = maskRatio('1:1', 1000, 1000) as number;
    const start = { x: 0.2, y: 0.3, w: 0.4, h: 0.4 };
    // The right edge: the left edge stays, the height grows with the width
    // about the vertical centre (0.5).
    close(resizeCropEdge(start, 'e', 0.2, k), {
      x: 0.2,
      y: 0.2,
      w: 0.6,
      h: 0.6,
    });
    // Up to the image border on the dragged axis.
    close(resizeCropEdge(start, 'e', 1, k), {
      x: 0.2,
      y: 0.1,
      w: 0.8,
      h: 0.8,
    });
    // The top edge shrinking: the bottom edge stays, the width follows
    // about the horizontal centre (0.4), never below the minimum side.
    close(resizeCropEdge(start, 'n', 1, k), {
      x: 0.4 - IMAGE_CROP_MIN_SIDE / 2,
      y: 0.7 - IMAGE_CROP_MIN_SIDE,
      w: IMAGE_CROP_MIN_SIDE,
      h: IMAGE_CROP_MIN_SIDE,
    });
  });

  test('with a ratio, an edge window is pushed back inside the image', () => {
    const square = maskRatio('1:1', 1000, 1000) as number;
    // Against the top border: centred growth would leave the image, so the
    // window is pushed down instead of stopped.
    close(resizeCropEdge({ x: 0.1, y: 0, w: 0.4, h: 0.4 }, 'e', 0.4, square), {
      x: 0.1,
      y: 0,
      w: 0.8,
      h: 0.8,
    });
    // A 2:1 window grown from its bottom edge: the width is capped at the
    // whole image, the height follows the ratio back down.
    const wide = 2;
    const grown = resizeCropEdge(
      { x: 0, y: 0.3, w: 0.4, h: 0.2 },
      's',
      1,
      wide
    );
    close(grown, { x: 0, y: 0.3, w: 1, h: 0.5 });
    expect(grown.w / grown.h).toBeCloseTo(wide, 6);
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

describe('the picture pans and zooms behind a fixed frame', () => {
  test('panning moves the window against the hand, inside the image', () => {
    const start = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
    // The hand goes right and down: the picture follows, so the window
    // shows what was up and to the left.
    close(panCrop(start, 0.1, 0.05), { x: 0.1, y: 0.15, w: 0.4, h: 0.4 });
    // Never past the image's edge: the picture still covers the frame.
    close(panCrop(start, 1, -1), { x: 0, y: 0.6, w: 0.4, h: 0.4 });
  });

  test('1x is the widest window of the frame ratio', () => {
    // A 2:1 window on the image: the whole width is 1x.
    expect(cropZoomOf({ x: 0, y: 0.25, w: 1, h: 0.5 })).toBeCloseTo(1, 6);
    // A tall 1:2 window: the whole height is 1x.
    expect(cropZoomOf({ x: 0.25, y: 0, w: 0.5, h: 1 })).toBeCloseTo(1, 6);
    // Half of it across is 2x.
    expect(cropZoomOf({ x: 0.2, y: 0.4, w: 0.5, h: 0.25 })).toBeCloseTo(2, 6);
  });

  test('zooming scales about the window centre, its ratio kept', () => {
    const start = { x: 0.3, y: 0.3, w: 0.4, h: 0.2 };
    const zoomed = zoomCropAt(start, 4);
    close(zoomed, { w: 0.25, h: 0.125 });
    expect(zoomed.x + zoomed.w / 2).toBeCloseTo(0.5, 6);
    expect(zoomed.y + zoomed.h / 2).toBeCloseTo(0.4, 6);
    // The zoom it reports is the one asked for: the slider reads it back.
    expect(cropZoomOf(zoomed)).toBeCloseTo(4, 6);
    expect(cropZoomOf(zoomCropAt(start, 1.37))).toBeCloseTo(1.37, 6);
  });

  test('zooming out stays inside the image and never below 1x', () => {
    // Near a corner, zooming out pushes the window back in.
    const corner = zoomCropAt({ x: 0.7, y: 0.7, w: 0.3, h: 0.3 }, 1.25);
    close(corner, { x: 0.2, y: 0.2, w: 0.8, h: 0.8 });
    // Below 1x is 1x: the widest window, centred where it can be.
    close(zoomCropAt({ x: 0.1, y: 0.4, w: 0.4, h: 0.2 }, 0.2), {
      x: 0,
      y: 0.25,
      w: 1,
      h: 0.5,
    });
  });

  test('zooming in never shrinks below the minimum side', () => {
    const tiny = zoomCropAt({ x: 0.5, y: 0.5, w: 0.03, h: 0.03 }, 1000);
    expect(tiny.w).toBeCloseTo(IMAGE_CROP_MIN_SIDE, 6);
    expect(tiny.h).toBeCloseTo(IMAGE_CROP_MIN_SIDE, 6);
  });

  test('the wheel up zooms in, the wheel down zooms out', () => {
    expect(cropWheelFactor(-100)).toBeCloseTo(1 / 1.05, 6);
    expect(cropWheelFactor(100)).toBeCloseTo(1.05, 6);
    // A flick is bounded.
    expect(cropWheelFactor(-10_000)).toBeCloseTo(1.05 ** -3, 6);
  });
});

describe('writeImageCrop keeping the frame (pan and zoom)', () => {
  test('on the canvas the box does not move', () => {
    const { store, model } = authorImage({ xywh: '[100,100,400,200]' });
    writeImageCrop(model, { x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 'free', true);
    const box = model.xywh;
    store.resetHistory();

    // A pan.
    expect(
      writeImageCrop(model, { x: 0.3, y: 0.1, w: 0.5, h: 0.5 }, 'free', true, {
        keep: 'frame',
      })
    ).toBe(true);
    expect(model.xywh).toBe(box);
    // A zoom.
    writeImageCrop(model, { x: 0.35, y: 0.2, w: 0.25, h: 0.25 }, 'free', true, {
      keep: 'frame',
    });
    expect(model.xywh).toBe(box);
    expect(readImageCrop(model.props.crop)).toEqual({
      x: 0.35,
      y: 0.2,
      w: 0.25,
      h: 0.25,
    });

    // Each is one undo step.
    store.undo();
    expect(readImageCrop(model.props.crop)?.w).toBeCloseTo(0.5, 6);
    store.undo();
    expect(readImageCrop(model.props.crop)?.x).toBeCloseTo(0.2, 6);
    expect(store.canUndo).toBe(false);
  });

  test('on a page the window keeps its size: width × crop.w holds', () => {
    const { store, model } = authorImage({ width: 400, height: 300 });
    writeImageCrop(model, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 'free', false);
    store.resetHistory();

    // A pan writes the crop alone.
    writeImageCrop(model, { x: 0.1, y: 0.25, w: 0.5, h: 0.5 }, 'free', false, {
      keep: 'frame',
    });
    expect(model.props.width).toBe(400);
    expect(model.props.height).toBe(300);

    // Zooming to 2x of that window doubles the whole picture's size.
    writeImageCrop(
      model,
      { x: 0.225, y: 0.375, w: 0.25, h: 0.25 },
      'free',
      false,
      { keep: 'frame' }
    );
    expect(model.props.width! * 0.25).toBeCloseTo(400 * 0.5, 6);
    expect(model.props.height! * 0.25).toBeCloseTo(300 * 0.5, 6);

    // The zoom, size and crop together, is one undo step.
    store.undo();
    expect(model.props.width).toBe(400);
    expect(readImageCrop(model.props.crop)?.w).toBeCloseTo(0.5, 6);
  });

  test('a page image with no stored size scales the size it is drawn at', () => {
    const { model } = authorImage();
    writeImageCrop(model, { x: 0, y: 0, w: 0.5, h: 0.5 }, 'free', false);
    writeImageCrop(model, { x: 0, y: 0, w: 0.25, h: 0.25 }, 'free', false, {
      keep: 'frame',
      natural: { width: 800, height: 600 },
    });
    expect(model.props.width).toBeCloseTo(1600, 6);
    expect(model.props.height).toBeCloseTo(1200, 6);
  });

  test('an unchanged pan or zoom writes nothing', () => {
    const { store, model } = authorImage({ xywh: '[0,0,400,200]' });
    const rect = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };
    writeImageCrop(model, rect, 'free', true);
    store.resetHistory();
    expect(
      writeImageCrop(model, { ...rect }, 'free', true, { keep: 'frame' })
    ).toBe(false);
    expect(store.canUndo).toBe(false);
  });
});

/** The gfx controller as the crop frame uses it: a selection and a viewport. */
function stubCanvas() {
  const listeners = new Set<() => void>();
  let state = { elements: [] as string[], editing: false };
  const selection = {
    get editing() {
      return state.editing;
    },
    has: (id: string) => state.elements.includes(id),
    set(next: { elements: string[]; editing?: boolean }) {
      state = { elements: next.elements, editing: next.editing ?? false };
      listeners.forEach(listener => listener());
    },
    slots: {
      updated: {
        subscribe(listener: () => void) {
          listeners.add(listener);
          return { unsubscribe: () => listeners.delete(listener) };
        },
      },
    },
  };
  const viewport = { locked: false };
  return { selection, viewport, listeners };
}

function canvasController() {
  const { store, model } = authorImage({ xywh: '[0,0,400,200]' });
  const gfx = stubCanvas();
  const block = {
    model,
    std: { get: () => gfx } as never,
    querySelector: () => null,
  };
  const controller = new ImageCropController(block, true);
  return { store, model, gfx, controller };
}

describe('the canvas while the frame is open', () => {
  test('opening selects the image in editing state and locks the viewport', () => {
    const { model, gfx, controller } = canvasController();

    controller.choose('free');
    expect(gfx.selection.has(model.id)).toBe(true);
    expect(gfx.selection.editing).toBe(true);
    expect(gfx.viewport.locked).toBe(true);

    // Switching preset keeps the one session.
    controller.choose('1:1');
    expect(gfx.listeners.size).toBe(1);

    controller.stop();
    expect(controller.editing$.value).toBeNull();
    expect(gfx.selection.has(model.id)).toBe(true);
    expect(gfx.selection.editing).toBe(false);
    expect(gfx.viewport.locked).toBe(false);
    expect(gfx.listeners.size).toBe(0);
    // A second stop is harmless.
    expect(() => controller.stop()).not.toThrow();
  });

  test('a viewport locked before stays locked after', () => {
    const { gfx, controller } = canvasController();
    gfx.viewport.locked = true;
    controller.choose('free');
    controller.stop();
    expect(gfx.viewport.locked).toBe(true);
  });

  test('the original image closes the frame and gives the canvas back', () => {
    const { gfx, controller } = canvasController();
    controller.choose('16:9');
    controller.restoreOriginal();
    expect(controller.editing$.value).toBeNull();
    expect(gfx.selection.editing).toBe(false);
    expect(gfx.viewport.locked).toBe(false);
  });

  test('a selection moved elsewhere closes the frame', () => {
    const { gfx, controller } = canvasController();
    controller.choose('free');
    gfx.selection.set({ elements: ['other'] });
    expect(controller.editing$.value).toBeNull();
    expect(gfx.viewport.locked).toBe(false);
    // The new selection is the author's, not overwritten.
    expect(gfx.selection.has('other')).toBe(true);
  });

  test('a deleted block closes without selecting a ghost', () => {
    const { store, model, gfx, controller } = canvasController();
    controller.choose('free');
    store.deleteBlock(model);
    expect(() => controller.stop()).not.toThrow();
    expect(gfx.viewport.locked).toBe(false);
    // The stub keeps the stale id; the real selection drops it on delete.
    expect(gfx.selection.editing).toBe(true);
  });

  test('a readonly store opens nothing', () => {
    const { store, gfx, controller } = canvasController();
    store.readonly = true;
    controller.choose('free');
    expect(controller.editing$.value).toBeNull();
    expect(gfx.viewport.locked).toBe(false);
    expect(gfx.selection.editing).toBe(false);
  });

  test('the page opens the frame without touching a canvas', () => {
    const { model } = authorImage({ width: 400, height: 300 });
    const block = {
      model,
      std: {
        get: () => {
          throw new Error('the page has no canvas');
        },
      } as never,
      querySelector: () => null,
    };
    const controller = new ImageCropController(block, false);
    controller.choose('free');
    expect(controller.editing$.value).toBe('free');
    controller.stop();
    expect(controller.editing$.value).toBeNull();
  });
});
