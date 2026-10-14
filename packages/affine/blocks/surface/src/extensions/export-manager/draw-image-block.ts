import { imageCropSourceRect, readImageCrop } from '@labre/affine-model';

/**
 * Paint an image block's picture into its box for the raster export
 * (ADR 0037): the cropped part when there is a crop and the source has a
 * pixel size, otherwise the whole picture — the 5-argument call every
 * uncropped image, and an SVG with no intrinsic size, always took.
 */
export function drawImageBlock(
  ctx: Pick<CanvasRenderingContext2D, 'drawImage'>,
  image: HTMLImageElement,
  crop: unknown,
  box: { x: number; y: number; w: number; h: number }
) {
  const source = imageCropSourceRect(
    readImageCrop(crop),
    image.naturalWidth,
    image.naturalHeight
  );
  if (!source) {
    ctx.drawImage(image, box.x, box.y, box.w, box.h);
    return;
  }
  ctx.drawImage(
    image,
    source.x,
    source.y,
    source.w,
    source.h,
    box.x,
    box.y,
    box.w,
    box.h
  );
}
