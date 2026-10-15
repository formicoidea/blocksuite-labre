/**
 * The raster export paints an image block's picture into its box
 * (ADR 0037, `drawImageBlock`).
 *
 * This spec would have caught the first cut of the crop in the export: it
 * always took the 9-argument `drawImage` with the source's natural size, so
 * an SVG with no intrinsic size (natural size 0×0) drew NOTHING, cropped or
 * not — a regression for every uncropped SVG image on the canvas.
 */
import { describe, expect, test, vi } from 'vitest';

import { drawImageBlock } from '../extensions/export-manager/draw-image-block.js';

const box = { x: 10, y: 20, w: 100, h: 50 };

const imageOf = (naturalWidth: number, naturalHeight: number) =>
  ({ naturalWidth, naturalHeight }) as HTMLImageElement;

describe('drawImageBlock', () => {
  test('an uncropped image is drawn whole into its box', () => {
    const ctx = { drawImage: vi.fn() };
    const image = imageOf(800, 400);
    drawImageBlock(ctx, image, undefined, box);
    expect(ctx.drawImage).toHaveBeenCalledWith(image, 10, 20, 100, 50);
  });

  test('an image with no natural size is drawn whole, cropped or not', () => {
    const ctx = { drawImage: vi.fn() };
    const svg = imageOf(0, 0);
    drawImageBlock(ctx, svg, undefined, box);
    drawImageBlock(ctx, svg, { x: 0.5, y: 0, w: 0.5, h: 1 }, box);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, svg, 10, 20, 100, 50);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, svg, 10, 20, 100, 50);
  });

  test('a cropped image draws the kept part of the source only', () => {
    const ctx = { drawImage: vi.fn() };
    const image = imageOf(800, 400);
    drawImageBlock(ctx, image, { x: 0.5, y: 0, w: 0.5, h: 1 }, box);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      image,
      400,
      0,
      400,
      400,
      10,
      20,
      100,
      50
    );
  });

  test('a damaged crop reads as no crop', () => {
    const ctx = { drawImage: vi.fn() };
    const image = imageOf(800, 400);
    drawImageBlock(ctx, image, { x: 0, y: 0, w: 0, h: 1 }, box);
    expect(ctx.drawImage).toHaveBeenCalledWith(image, 10, 20, 100, 50);
  });
});
