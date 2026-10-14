import {
  IMAGE_CROP_MIN_SIDE,
  type ImageCrop,
  type ImageCropMask,
} from '@labre/affine-model';

/** A crop rectangle without its mask, normalised to the source (ADR 0036). */
export type CropRect = Pick<ImageCrop, 'x' | 'y' | 'w' | 'h'>;

export type CropCorner = 'nw' | 'ne' | 'sw' | 'se';

export const WHOLE_IMAGE: CropRect = { x: 0, y: 0, w: 1, h: 1 };

/** Width over height, in source pixels, each preset keeps. */
const MASK_RATIOS: Record<Exclude<ImageCropMask, 'free'>, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
};

const EPSILON = 1e-6;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * The normalised `w / h` a mask holds on a source of this size, or `null`
 * when the crop is free or the size is unknown. A 16:9 window on a portrait
 * photo is much wider in normalised units than in pixels.
 */
export function maskRatio(
  mask: ImageCropMask,
  naturalWidth: number,
  naturalHeight: number
): number | null {
  if (mask === 'free' || naturalWidth <= 0 || naturalHeight <= 0) return null;
  return (MASK_RATIOS[mask] * naturalHeight) / naturalWidth;
}

/**
 * The largest centred rectangle of the mask's ratio: what choosing a preset
 * writes before the author adjusts it. Free is the whole image.
 */
export function presetCrop(
  mask: ImageCropMask,
  naturalWidth: number,
  naturalHeight: number
): CropRect {
  const k = maskRatio(mask, naturalWidth, naturalHeight);
  if (k === null) return WHOLE_IMAGE;
  let w = k;
  let h = 1;
  if (w > 1) {
    w = 1;
    h = 1 / k;
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/** The window dragged by a normalised delta, kept inside the image. */
export function moveCrop(start: CropRect, dx: number, dy: number): CropRect {
  return {
    ...start,
    x: clamp(start.x + dx, 0, 1 - start.w),
    y: clamp(start.y + dy, 0, 1 - start.h),
  };
}

/**
 * The window resized by dragging one corner, the opposite corner pinned.
 * With a ratio `k` (normalised `w / h`), the window grows to cover the pointer
 * and then shrinks to fit the image, so it never leaves the source.
 */
export function resizeCrop(
  start: CropRect,
  corner: CropCorner,
  dx: number,
  dy: number,
  k: number | null
): CropRect {
  const west = corner === 'nw' || corner === 'sw';
  const north = corner === 'nw' || corner === 'ne';
  const anchorX = west ? start.x + start.w : start.x;
  const anchorY = north ? start.y + start.h : start.y;
  const pointerX = (west ? start.x : start.x + start.w) + dx;
  const pointerY = (north ? start.y : start.y + start.h) + dy;
  const maxW = west ? anchorX : 1 - anchorX;
  const maxH = north ? anchorY : 1 - anchorY;
  const min = IMAGE_CROP_MIN_SIDE;

  let w = clamp(west ? anchorX - pointerX : pointerX - anchorX, min, maxW);
  let h = clamp(north ? anchorY - pointerY : pointerY - anchorY, min, maxH);
  if (k !== null) {
    if (w / k > h) h = w / k;
    else w = h * k;
    if (w > maxW) {
      w = maxW;
      h = w / k;
    }
    if (h > maxH) {
      h = maxH;
      w = h * k;
    }
    if (w < min) {
      w = min;
      h = w / k;
    }
    if (h < min) {
      h = min;
      w = h * k;
    }
  }
  return {
    x: west ? anchorX - w : anchorX,
    y: north ? anchorY - h : anchorY,
    w,
    h,
  };
}

export function sameCropRect(a: CropRect, b: CropRect): boolean {
  return (
    Math.abs(a.x - b.x) < EPSILON &&
    Math.abs(a.y - b.y) < EPSILON &&
    Math.abs(a.w - b.w) < EPSILON &&
    Math.abs(a.h - b.h) < EPSILON
  );
}

/**
 * The canvas box once the crop changes from `from` to `to`, for a block whose
 * box shows `from`: the picture keeps its scale and the kept part stays where
 * it was on the canvas. The box rotates about its centre (`rotate` degrees,
 * CSS direction), so the shift is rotated before it is applied.
 */
export function cropBoundFor(
  bound: { x: number; y: number; w: number; h: number },
  rotate: number,
  from: CropRect,
  to: CropRect
): { x: number; y: number; w: number; h: number } {
  const scaleX = bound.w / from.w;
  const scaleY = bound.h / from.h;
  const w = to.w * scaleX;
  const h = to.h * scaleY;
  const dx = (to.x - from.x) * scaleX + w / 2 - bound.w / 2;
  const dy = (to.y - from.y) * scaleY + h / 2 - bound.h / 2;
  const t = (rotate * Math.PI) / 180;
  const cx = bound.x + bound.w / 2 + dx * Math.cos(t) - dy * Math.sin(t);
  const cy = bound.y + bound.h / 2 + dx * Math.sin(t) + dy * Math.cos(t);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * Where the WHOLE source sits relative to a box showing `crop`, as CSS
 * percentages of that box: the cropped `<img>` and the crop frame both use it.
 */
export function wholeImageFrame(crop: CropRect) {
  return {
    left: `${(-crop.x / crop.w) * 100}%`,
    top: `${(-crop.y / crop.h) * 100}%`,
    width: `${100 / crop.w}%`,
    height: `${100 / crop.h}%`,
  };
}
