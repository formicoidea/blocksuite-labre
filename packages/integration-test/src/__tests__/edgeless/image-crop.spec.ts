/**
 * « Rogner » end to end (ADR 0037), on the real editor, page and canvas.
 *
 * The picture is 200×100, red on its left half and blue on its right, so a
 * crop is visible in a pixel.
 *
 * This spec would have caught:
 * - opening a document whose image has no crop WRITING one (the stored
 *   format must not move on load or on first paint);
 * - a canvas crop that squeezes the whole picture into the cropped box, in
 *   the editor or in the PNG export;
 * - a crop gesture that changes the bytes, takes more than one undo step,
 *   or reaches the canvas as a drag of the image;
 * - a page crop that resizes the whole picture instead of opening a window
 *   on it;
 * - the frame opening, or a preset writing, on a readonly page;
 * - a canvas frame opened under live selection handles, which sit on its
 *   corners and swallow the crop gesture, or over a canvas that still zooms
 *   under the wheel (the PO could not crop, 2026-10-27);
 * - a wheel over the frame that zooms the canvas instead of the picture,
 *   zooms off the frame's centre, moves the box, or writes more than one
 *   undo step;
 * - a drag inside the frame that moves the frame instead of panning the
 *   picture behind it, or moves the canvas box (PO acceptance, 2026-11-04);
 * - a zoom slider missing from above the frame, writing while held, zooming
 *   off the centre or moving the box; on a page, a zoom that changes the
 *   size of the window instead of the size of the whole picture;
 * - Escape leaving the handles hidden or the viewport locked;
 * - a frame with corner handles only, a side handle that changes both
 *   dimensions or loses a preset's ratio, or a side drag that takes more
 *   than one undo step (PO acceptance P4-7, 2026-11-05);
 * - a wheel that zooms the picture past the slider's 4x;
 * - a page frame drawn under the element toolbar, or a toolbar left hidden
 *   once the frame closes.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { CanvasRenderer, ExportManager } from '@labre/affine/blocks/surface';
import {
  ToolbarFlag,
  ToolbarRegistryIdentifier,
} from '@labre/affine/shared/services';
import type {
  ImageBlockComponent,
  ImageEdgelessBlockComponent,
} from '@labre/affine/blocks/image';
import type { ImageBlockModel } from '@labre/affine/model';
import { Bound } from '@labre/global/gfx';
import { afterEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const BLUE = [0, 0, 255];

async function twoColourPng(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 100;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgb(255, 0, 0)';
  ctx.fillRect(0, 0, 100, 100);
  ctx.fillStyle = 'rgb(0, 0, 255)';
  ctx.fillRect(100, 0, 100, 100);
  return new Promise(resolve =>
    canvas.toBlob(blob => resolve(blob!), 'image/png')
  );
}

async function until(check: () => boolean, label: string) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await wait(20);
  }
  throw new Error(`timed out waiting for ${label}`);
}

const imgOf = (block: HTMLElement) =>
  block.querySelector<HTMLImageElement>('img.drag-target');

const loaded = (block: HTMLElement | null) => {
  const img = block && imgOf(block);
  return Boolean(img?.complete && img.naturalWidth > 0);
};

const overlayOf = (block: HTMLElement) =>
  block.querySelector('affine-image-crop-overlay');

const storedKeys = (model: ImageBlockModel) =>
  Array.from(
    (
      window.doc.getBlock(model.id) as unknown as {
        yBlock: { keys(): Iterable<string> };
      }
    ).yBlock.keys()
  );

const handleOf = (overlay: HTMLElement, grip: string) =>
  overlay.shadowRoot!.querySelector<HTMLElement>(
    `[data-testid="image-crop-handle-${grip}"]`
  )!;

/** One pointer gesture on a crop handle, the way a mouse would do it. */
async function dragHandle(
  overlay: HTMLElement,
  grip: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w',
  dx: number,
  dy: number
) {
  await dragFrom(handleOf(overlay, grip), dx, dy);
}

/** One pointer gesture from the centre of `target`, in two moves. */
async function dragFrom(target: HTMLElement, dx: number, dy: number) {
  const box = target.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const init = { bubbles: true, composed: true, button: 0, pointerId: 1 };
  target.dispatchEvent(
    new PointerEvent('pointerdown', { ...init, clientX: x, clientY: y })
  );
  document.dispatchEvent(
    new PointerEvent('pointermove', {
      ...init,
      clientX: x + dx / 2,
      clientY: y + dy / 2,
    })
  );
  document.dispatchEvent(
    new PointerEvent('pointermove', {
      ...init,
      clientX: x + dx,
      clientY: y + dy,
    })
  );
  document.dispatchEvent(
    new PointerEvent('pointerup', { ...init, clientX: x + dx, clientY: y + dy })
  );
  await wait();
}

const pixel = (canvas: HTMLCanvasElement, x: number, y: number) =>
  Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data).slice(
    0,
    3
  );

describe('image crop on the canvas', () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    window.doc.readonly = false;
    cleanups.splice(0).forEach(cleanup => cleanup());
  });

  async function canvasImage() {
    cleanups.push(await setupEditor('edgeless'));
    const sourceId = await window.doc.blobSync.set(await twoColourPng());
    const surface = getSurface(window.doc, window.editor);
    const id = window.doc.addBlock(
      'affine:image',
      { sourceId, xywh: '[0,0,200,100]', width: 200, height: 100 },
      surface.model.id
    );
    const model = window.doc.getModelById(id) as ImageBlockModel;
    let block: ImageEdgelessBlockComponent | null = null;
    await until(() => {
      block = window.editor.std.view.getBlock(
        id
      ) as ImageEdgelessBlockComponent | null;
      return loaded(block);
    }, 'the canvas image');
    return { model, block: block! as ImageEdgelessBlockComponent, sourceId };
  }

  test('an image without crop is painted whole and stores no crop', async () => {
    const { model, block } = await canvasImage();
    await wait();

    expect(storedKeys(model)).not.toContain('prop:crop');
    expect(block.querySelector('.labre-image-crop-window')).toBeNull();
    expect(overlayOf(block)).toBeNull();
  });

  test('a preset crops the box, keeps the bytes, and undoes in one step', async () => {
    const { model, block, sourceId } = await canvasImage();
    window.doc.resetHistory();

    block.cropController.choose('1:1');
    await wait();

    expect({ ...model.props.crop }).toEqual({
      x: 0.25,
      y: 0,
      w: 0.5,
      h: 1,
      mask: '1:1',
    });
    expect(model.xywh).toBe('[50,0,100,100]');
    expect(model.props.sourceId).toBe(sourceId);
    expect(block.querySelector('.labre-image-crop-window img')).not.toBeNull();
    expect(overlayOf(block)).not.toBeNull();

    window.doc.undo();
    await wait();
    expect(model.props.crop).toBeUndefined();
    expect(model.xywh).toBe('[0,0,200,100]');
  });

  test('a free drag of a corner is one gesture and never moves the image', async () => {
    const { model, block } = await canvasImage();
    block.cropController.choose('free');
    await wait();
    const overlay = overlayOf(block) as HTMLElement;
    expect(overlay).not.toBeNull();
    // Nothing is written by opening the frame.
    expect(model.props.crop).toBeUndefined();

    window.doc.resetHistory();
    const width = overlay.getBoundingClientRect().width;
    await dragHandle(overlay, 'se', -width / 2, 0);

    const crop = { ...model.props.crop };
    expect(crop.x).toBeCloseTo(0, 3);
    expect(crop.w).toBeCloseTo(0.5, 2);
    expect(crop.h).toBeCloseTo(1, 3);
    const [x, y, w, h] = JSON.parse(model.xywh) as number[];
    expect(x).toBeCloseTo(0, 1);
    expect(y).toBeCloseTo(0, 1);
    expect(w).toBeCloseTo(100, 0);
    expect(h).toBeCloseTo(100, 1);

    window.doc.undo();
    expect(model.props.crop).toBeUndefined();
    expect(model.xywh).toBe('[0,0,200,100]');

    // A press elsewhere closes the frame.
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true })
    );
    await wait();
    expect(overlayOf(block)).toBeNull();
  });

  test('a free side handle resizes one dimension in one gesture', async () => {
    const { model, block } = await canvasImage();
    block.cropController.choose('free');
    await wait();
    const overlay = overlayOf(block) as HTMLElement;
    for (const side of ['n', 's'] as const) {
      expect(getComputedStyle(handleOf(overlay, side)).cursor).toBe(
        'ns-resize'
      );
    }
    for (const side of ['e', 'w'] as const) {
      expect(getComputedStyle(handleOf(overlay, side)).cursor).toBe(
        'ew-resize'
      );
    }

    window.doc.resetHistory();
    const width = overlay.getBoundingClientRect().width;
    // The east side halfway in, the pointer wandering down: the height and
    // the west side do not move.
    await dragHandle(overlay, 'e', -width / 2, 30);

    const crop = { ...model.props.crop };
    expect(crop.x).toBeCloseTo(0, 3);
    expect(crop.y).toBeCloseTo(0, 3);
    expect(crop.w).toBeCloseTo(0.5, 2);
    expect(crop.h).toBeCloseTo(1, 3);
    const [x, y, w, h] = JSON.parse(model.xywh) as number[];
    expect(x).toBeCloseTo(0, 1);
    expect(y).toBeCloseTo(0, 1);
    expect(w).toBeCloseTo(100, 0);
    expect(h).toBeCloseTo(100, 1);

    window.doc.undo();
    expect(model.props.crop).toBeUndefined();
    expect(model.xywh).toBe('[0,0,200,100]');
    expect(window.doc.canUndo).toBe(false);
  });

  test('a side handle on a preset keeps its ratio about the centre line', async () => {
    const { model, block } = await canvasImage();
    block.cropController.choose('1:1');
    await wait();
    expect(model.xywh).toBe('[50,0,100,100]');
    const overlay = overlayOf(block) as HTMLElement;
    const frameBox = overlay
      .shadowRoot!.querySelector<HTMLElement>(
        '[data-testid="image-crop-window"]'
      )!
      .getBoundingClientRect();

    window.doc.resetHistory();
    // The east side a quarter of the window in.
    await dragHandle(overlay, 'e', -frameBox.width / 4, 0);

    const { x = 0, y = 0, w = 0, h = 0 } = model.props.crop ?? {};
    // 1:1 on a 200×100 picture is w / h = 0.5 in fractions.
    expect(w).toBeCloseTo(0.375, 2);
    expect(h).toBeCloseTo(0.75, 2);
    expect(x).toBeCloseTo(0.25, 3);
    expect(y + h / 2).toBeCloseTo(0.5, 3);
    const [, , bw, bh] = JSON.parse(model.xywh) as number[];
    expect(bw).toBeCloseTo(bh, 0);

    window.doc.undo();
    expect(model.xywh).toBe('[50,0,100,100]');
    expect(window.doc.canUndo).toBe(false);
  });

  test('the wheel stops at 4x like the slider', async () => {
    const { model, block } = await canvasImage();
    block.cropController.choose('free');
    await wait();
    const overlay = overlayOf(block) as HTMLElement;
    for (let i = 0; i < 20; i++) {
      overlay.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          composed: true,
          cancelable: true,
          deltaY: -300,
        })
      );
    }
    await until(() => model.props.crop !== undefined, 'the wheel commit');
    // The whole 200×100 picture is 1x; 4x shows a quarter of it across.
    expect(model.props.crop?.w).toBeCloseTo(0.25, 6);
    expect(model.props.crop?.h).toBeCloseTo(0.25, 6);
  });

  test('the frame owns the canvas: no handles, no zoom, the wheel crops', async () => {
    const { model, block } = await canvasImage();
    const { gfx } = getDocRootBlock(
      window.doc,
      window.editor,
      'edgeless'
    ) as EdgelessRootBlockComponent;
    const widget = document.querySelector('edgeless-selected-rect');
    const countHandles = () =>
      (widget?.shadowRoot ?? widget)?.querySelectorAll('.handle').length ?? 0;

    gfx.selection.set({ elements: [model.id], editing: false });
    await wait();
    // Selected: the handles are there, which makes the next check meaningful.
    expect(countHandles()).toBeGreaterThan(0);
    expect(gfx.viewport.locked).toBe(false);

    block.cropController.choose('free');
    await wait();
    const overlay = overlayOf(block) as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(countHandles()).toBe(0);
    expect(gfx.selection.editing).toBe(true);
    expect(gfx.viewport.locked).toBe(true);

    // Three ticks up at three quarters of the width, mid height.
    window.doc.resetHistory();
    const zoom = gfx.viewport.zoom;
    const box = overlay.getBoundingClientRect();
    const clientX = box.left + box.width * 0.75;
    const clientY = box.top + box.height * 0.5;
    for (let i = 0; i < 3; i++) {
      overlay.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          composed: true,
          cancelable: true,
          deltaY: -100,
          clientX,
          clientY,
        })
      );
    }
    // Nothing is written while the wheel turns.
    expect(model.props.crop).toBeUndefined();
    await until(() => model.props.crop !== undefined, 'the wheel commit');

    const crop = { ...model.props.crop };
    const scale = 1.05 ** -3;
    expect(crop.w).toBeCloseTo(scale, 3);
    expect(crop.h).toBeCloseTo(scale, 3);
    // The picture zooms about the frame's centre, wherever the pointer is,
    // and the frame (the box) does not move (PO acceptance, 2026-11-04).
    expect(crop.x).toBeCloseTo(0.5 - 0.5 * scale, 3);
    expect(crop.y).toBeCloseTo(0.5 - 0.5 * scale, 3);
    expect(model.xywh).toBe('[0,0,200,100]');
    expect(gfx.viewport.zoom).toBe(zoom);

    // One scroll, one undo step.
    window.doc.undo();
    expect(model.props.crop).toBeUndefined();
    window.doc.redo();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    await wait();
    expect(overlayOf(block)).toBeNull();
    expect(gfx.viewport.locked).toBe(false);
    expect(gfx.selection.editing).toBe(false);
    expect(gfx.selection.has(model.id)).toBe(true);
    expect(countHandles()).toBeGreaterThan(0);
  });

  test('a drag inside the frame pans the picture, never the frame', async () => {
    const { model, block } = await canvasImage();
    block.cropController.choose('1:1');
    await wait();
    expect(model.xywh).toBe('[50,0,100,100]');
    const overlay = overlayOf(block) as HTMLElement;
    const frame = overlay.shadowRoot!.querySelector<HTMLElement>(
      '[data-testid="image-crop-window"]'
    )!;
    const before = frame.getBoundingClientRect();

    window.doc.resetHistory();
    // A quarter of the window to the right: the picture follows the hand,
    // so the window shows what was on its left.
    await dragFrom(frame, before.width / 4, 0);

    const crop = { ...model.props.crop };
    expect(crop.x).toBeCloseTo(0.25 - 0.5 / 4, 3);
    expect(crop.y).toBeCloseTo(0, 3);
    expect(crop.w).toBeCloseTo(0.5, 6);
    expect(crop.h).toBeCloseTo(1, 6);
    expect(model.xywh).toBe('[50,0,100,100]');
    const after = frame.getBoundingClientRect();
    expect(after.left).toBeCloseTo(before.left, 0);
    expect(after.width).toBeCloseTo(before.width, 0);

    // One drag, one undo step.
    window.doc.undo();
    expect(model.props.crop?.x).toBeCloseTo(0.25, 6);
    expect(model.xywh).toBe('[50,0,100,100]');
  });

  test('the zoom slider above the frame zooms the picture behind it', async () => {
    const { model, block } = await canvasImage();
    block.cropController.choose('1:1');
    await wait();
    const overlay = overlayOf(block) as HTMLElement;
    const frame = overlay
      .shadowRoot!.querySelector<HTMLElement>(
        '[data-testid="image-crop-window"]'
      )!
      .getBoundingClientRect();
    const slider = overlay.shadowRoot!.querySelector<HTMLElement>(
      '[data-testid="image-crop-zoom"]'
    )!;
    const track = slider.getBoundingClientRect();
    expect(track.width).toBeGreaterThan(0);
    // Above the frame, centred on it.
    expect(track.bottom).toBeLessThanOrEqual(frame.top + 1);
    expect(track.left + track.width / 2).toBeCloseTo(
      frame.left + frame.width / 2,
      0
    );

    window.doc.resetHistory();
    // A third of the track (16px items, the track runs between their
    // centres): 1x + 3 × 1/3 = 2x.
    const init = { bubbles: true, composed: true, button: 0, pointerId: 1 };
    const clientX = track.left + 8 + (track.width - 16) / 3;
    const clientY = track.top + track.height / 2;
    slider.dispatchEvent(
      new PointerEvent('pointerdown', { ...init, clientX, clientY })
    );
    // Nothing is written while the slider is held.
    expect(model.props.crop?.w).toBeCloseTo(0.5, 6);
    slider.dispatchEvent(
      new PointerEvent('pointerup', { ...init, clientX, clientY })
    );
    await wait();

    const { x = 0, y = 0, w = 0, h = 0 } = model.props.crop ?? {};
    expect(w).toBeCloseTo(0.25, 2);
    expect(h).toBeCloseTo(0.5, 2);
    // About the frame's centre, the box unmoved.
    expect(x + w / 2).toBeCloseTo(0.5, 3);
    expect(y + h / 2).toBeCloseTo(0.5, 3);
    expect(model.xywh).toBe('[50,0,100,100]');

    window.doc.undo();
    expect(model.props.crop?.w).toBeCloseTo(0.5, 6);
    expect(window.doc.canUndo).toBe(false);
  });

  test('the PNG export draws the kept part only', async () => {
    const { model, block } = await canvasImage();
    block.cropController.choose('free');
    block.cropController.commit({ x: 0.5, y: 0, w: 0.5, h: 1 });
    block.cropController.stop();
    await wait();
    expect(model.xywh).toBe('[100,0,100,100]');
    // The raster export looks for the note container: a canvas with no note
    // exports nothing at all (an older quirk, not this feature's).
    addNote(window.doc, { xywh: '[600, 600, 100, 50]' });
    await wait();

    const edgeless = getDocRootBlock(
      window.doc,
      window.editor,
      'edgeless'
    ) as EdgelessRootBlockComponent;
    const renderer = getSurface(window.doc, window.editor).renderer;
    expect(renderer).toBeInstanceOf(CanvasRenderer);
    const canvas = await window.editor.std
      .get(ExportManager)
      .edgelessToCanvas(
        renderer as CanvasRenderer,
        Bound.deserialize(model.xywh),
        edgeless.gfx,
        [model]
      );

    // The blob is drawn at the bound's origin: before ADR 0037 the whole
    // picture was squeezed into the box and its red half showed here.
    expect(pixel(canvas!, 25, 50)).toEqual(BLUE);
    expect(pixel(canvas!, 75, 50)).toEqual(BLUE);
  });

  test('a readonly page opens no frame and writes nothing', async () => {
    const { model, block } = await canvasImage();
    window.doc.readonly = true;

    block.cropController.choose('16:9');
    await wait();

    expect(model.props.crop).toBeUndefined();
    expect(overlayOf(block)).toBeNull();
  });
});

describe('image crop on a page', () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup());
  });

  test('a crop opens a window on the picture at the same scale', async () => {
    cleanups.push(await setupEditor('page'));
    const { flags } = window.editor.std.get(ToolbarRegistryIdentifier);
    const sourceId = await window.doc.blobSync.set(await twoColourPng());
    const noteId = window.doc.addBlock('affine:note', {}, window.doc.root!.id);
    const id = window.doc.addBlock(
      'affine:image',
      { sourceId, width: 200, height: 100 },
      noteId
    );
    const model = window.doc.getModelById(id) as ImageBlockModel;
    let block: ImageBlockComponent | null = null;
    await until(() => {
      block = window.editor.std.view.getBlock(id) as ImageBlockComponent | null;
      return loaded(block);
    }, 'the page image');
    const image = block! as ImageBlockComponent;
    await wait();
    expect(storedKeys(model)).not.toContain('prop:crop');

    image.cropController.choose('1:1');
    await wait();
    // The element toolbar sat over the top handles: hidden while cropping.
    expect(flags.check(ToolbarFlag.Hiding)).toBe(true);

    const box = image
      .querySelector<HTMLElement>('.resizable-img')!
      .getBoundingClientRect();
    expect(box.width).toBeCloseTo(100, 0);
    expect(box.height).toBeCloseTo(100, 0);
    // The whole picture keeps its stored size: an older client and the HTML
    // adapter still draw it whole.
    expect(model.props.width).toBe(200);
    expect(model.props.height).toBe(100);
    const img = imgOf(image)!.getBoundingClientRect();
    expect(img.width).toBeCloseTo(200, 0);
    expect(img.left).toBeCloseTo(box.left - 50, 0);

    // The slider's End key zooms to 4x behind the frame: the window keeps
    // its size on the page, so the WHOLE picture's stored size grows.
    const slider = overlayOf(image)!.shadowRoot!.querySelector<HTMLElement>(
      '[data-testid="image-crop-zoom"]'
    )!;
    slider
      .shadowRoot!.querySelector<HTMLElement>('[role="slider"]')!
      .dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'End',
          bubbles: true,
          composed: true,
          cancelable: true,
        })
      );
    await until(() => (model.props.crop?.w ?? 1) < 0.2, 'the slider commit');
    expect(model.props.crop?.w).toBeCloseTo(0.125, 6);
    expect(model.props.width).toBeCloseTo(800, 6);
    expect(model.props.height).toBeCloseTo(400, 6);
    await wait();
    const zoomed = image
      .querySelector<HTMLElement>('.resizable-img')!
      .getBoundingClientRect();
    expect(zoomed.width).toBeCloseTo(100, 0);
    expect(zoomed.height).toBeCloseTo(100, 0);

    // The zoom, size and crop together, is one undo step.
    window.doc.undo();
    expect(model.props.width).toBe(200);
    expect(model.props.crop?.w).toBeCloseTo(0.5, 6);

    image.cropController.restoreOriginal();
    await wait();
    expect(model.props.crop).toBeUndefined();
    expect(flags.check(ToolbarFlag.Hiding)).toBe(false);
    expect(
      image
        .querySelector<HTMLElement>('.resizable-img')!
        .getBoundingClientRect().width
    ).toBeCloseTo(200, 0);
  });
});
