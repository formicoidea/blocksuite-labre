/**
 * The stored crop of an image block (ADR 0037): a view on the source, never
 * new bytes. The rectangle is normalised to the source image (0..1 on each
 * axis), so it needs no pixel size and survives any resize.
 *
 * Append-only: a mask token, once shipped, is never renamed or removed. A
 * token this build does not know reads as `free`.
 */
export const IMAGE_CROP_MASKS = ['free', '16:9', '4:3', '1:1'] as const;

export type ImageCropMask = (typeof IMAGE_CROP_MASKS)[number];

export interface ImageCrop {
  x: number;
  y: number;
  w: number;
  h: number;
  /** The preset that drew the rectangle; absent means free. */
  mask?: ImageCropMask;
}

/**
 * Below this a side is a sliver nobody can grab again; the crop tool never
 * writes one, and a stored one is treated as damaged.
 */
export const IMAGE_CROP_MIN_SIDE = 0.02;

const EPSILON = 1e-6;

const isFraction = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * The crop to paint, or `undefined` for the whole image.
 *
 * Every reader goes through here: the value may come from a peer, an import
 * or a damaged document, and a crop that cannot be honoured shows the whole
 * picture rather than an empty box or an error. A rectangle covering the
 * whole image is "no crop" too, so nothing downstream has to tell them apart.
 */
export function readImageCrop(value: unknown): ImageCrop | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { x, y, w, h, mask } = value as Record<string, unknown>;
  if (!isFraction(x) || !isFraction(y) || !isFraction(w) || !isFraction(h)) {
    return undefined;
  }
  if (x < -EPSILON || y < -EPSILON) return undefined;
  if (w < IMAGE_CROP_MIN_SIDE - EPSILON || h < IMAGE_CROP_MIN_SIDE - EPSILON) {
    return undefined;
  }
  if (x + w > 1 + EPSILON || y + h > 1 + EPSILON) return undefined;
  if (isWholeImage({ x, y, w, h })) return undefined;

  const crop: ImageCrop = {
    x: Math.max(0, x),
    y: Math.max(0, y),
    w: Math.min(w, 1 - Math.max(0, x)),
    h: Math.min(h, 1 - Math.max(0, y)),
  };
  if (
    typeof mask === 'string' &&
    mask !== 'free' &&
    (IMAGE_CROP_MASKS as readonly string[]).includes(mask)
  ) {
    crop.mask = mask as ImageCropMask;
  }
  return crop;
}

export function isWholeImage(rect: Pick<ImageCrop, 'x' | 'y' | 'w' | 'h'>) {
  return (
    Math.abs(rect.x) < EPSILON &&
    Math.abs(rect.y) < EPSILON &&
    Math.abs(rect.w - 1) < EPSILON &&
    Math.abs(rect.h - 1) < EPSILON
  );
}

/**
 * The part of the source, in source pixels, a crop keeps — what a raster
 * export hands to `drawImage(image, sx, sy, sw, sh, …)`. The whole image when
 * there is no crop.
 */
export function imageCropSourceRect(
  crop: ImageCrop | undefined,
  naturalWidth: number,
  naturalHeight: number
): { x: number; y: number; w: number; h: number } {
  if (!crop) return { x: 0, y: 0, w: naturalWidth, h: naturalHeight };
  return {
    x: crop.x * naturalWidth,
    y: crop.y * naturalHeight,
    w: crop.w * naturalWidth,
    h: crop.h * naturalHeight,
  };
}
