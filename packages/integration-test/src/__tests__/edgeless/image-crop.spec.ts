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
 * - the frame opening, or a preset writing, on a readonly page.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { CanvasRenderer, ExportManager } from '@labre/affine/blocks/surface';
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

/** One pointer gesture on a crop handle, the way a mouse would do it. */
async function dragHandle(
  overlay: HTMLElement,
  corner: 'nw' | 'ne' | 'sw' | 'se',
  dx: number,
  dy: number
) {
  const handle = overlay.shadowRoot!.querySelector<HTMLElement>(
    `[data-corner="${corner}"]`
  )!;
  const box = handle.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const init = { bubbles: true, composed: true, button: 0, pointerId: 1 };
  handle.dispatchEvent(
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

    image.cropController.restoreOriginal();
    await wait();
    expect(model.props.crop).toBeUndefined();
    expect(
      image
        .querySelector<HTMLElement>('.resizable-img')!
        .getBoundingClientRect().width
    ).toBeCloseTo(200, 0);
  });
});
