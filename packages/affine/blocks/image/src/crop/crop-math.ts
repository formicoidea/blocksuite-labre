import {
  IMAGE_CROP_MIN_SIDE,
  type ImageCrop,
  type ImageCropMask,
} from '@labre/affine-model';

/** A crop rectangle without its mask, normalised to the source (ADR 0037). */
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
  if (mask === 'free') return WHOLE_IMAGE;
  return ratioCrop(MASK_RATIOS[mask], naturalWidth, naturalHeight);
}

/**
 * The largest centred rectangle whose width over height, in SOURCE PIXELS, is
 * `ratio`: a preset's window, and the cut a shape's box makes in the picture
 * that replaces it (ADR 0044). The whole image when the size or the ratio is
 * unknown.
 */
export function ratioCrop(
  ratio: number,
  naturalWidth: number,
  naturalHeight: number
): CropRect {
  if (!(ratio > 0) || naturalWidth <= 0 || naturalHeight <= 0) {
    return WHOLE_IMAGE;
  }
  const k = (ratio * naturalHeight) / naturalWidth;
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

/** Scale of the window per 100 units of wheel `deltaY`. */
export const CROP_WHEEL_STEP = 1.05;

/** At most this many steps per wheel event: a fast flick stays readable. */
const CROP_WHEEL_MAX_STEPS = 3;

/**
 * The window's scale for one wheel event: below 1 when the wheel turns up
 * (`deltaY < 0`), which shrinks the window and so zooms into the picture.
 */
export function cropWheelFactor(deltaY: number): number {
  const steps = clamp(
    deltaY / 100,
    -CROP_WHEEL_MAX_STEPS,
    CROP_WHEEL_MAX_STEPS
  );
  return CROP_WHEEL_STEP ** steps;
}

/**
 * The window scaled by `factor` about a point of the source (`px`, `py`,
 * normalised): that point stays under the pointer. The aspect is `k`
 * (normalised `w / h`) when a mask holds one, else the window's own; the
 * window never outgrows the image nor shrinks below the minimum side, and is
 * then pushed back inside the image.
 */
export function zoomCrop(
  start: CropRect,
  factor: number,
  px: number,
  py: number,
  k: number | null
): CropRect {
  const ratio = k ?? start.w / start.h;
  const min = IMAGE_CROP_MIN_SIDE;
  let w = start.w * factor;
  let h = w / ratio;
  // Fit inside the image first, then grow to the minimum: a ratio too
  // extreme for both keeps the minimum, as `resizeCrop` does.
  const shrink = Math.min(1, 1 / w, 1 / h);
  w *= shrink;
  h *= shrink;
  const grow = Math.max(1, min / w, min / h);
  w *= grow;
  h *= grow;
  const sx = w / start.w;
  const sy = h / start.h;
  return {
    x: clamp(px - (px - start.x) * sx, 0, Math.max(0, 1 - w)),
    y: clamp(py - (py - start.y) * sy, 0, Math.max(0, 1 - h)),
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
 * The stored page `width`/`height` of a cropped image whose window was
 * resized to `box`: the WHOLE picture's size (ADR 0037), never the window's.
 * The height follows the source's proportions when they are known; an SVG
 * with no intrinsic size, or a picture not loaded yet, scales the window's
 * own height instead — writing the window itself would shrink the image on
 * every resize.
 */
export function wholeImageSize(
  box: { w: number; h: number },
  crop: CropRect,
  natural: { width: number; height: number } | null
): { width: number; height: number } {
  const width = box.w / crop.w;
  return {
    width,
    height: natural ? (width * natural.height) / natural.width : box.h / crop.h,
  };
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
