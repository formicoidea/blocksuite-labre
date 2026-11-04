import {
  type ImageBlockModel,
  type ImageBlockProps,
  type ImageCrop,
  type ImageCropMask,
  isWholeImage,
  readImageCrop,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';

import {
  cropBoundFor,
  type CropRect,
  sameCropRect,
  WHOLE_IMAGE,
} from './crop-math.js';

/**
 * What a crop write holds still on screen. `'image'`: the picture keeps its
 * scale and place and the box follows the window (the corner handles, the
 * presets, « Image d'origine »). `'frame'`: the box keeps its place and size
 * and the picture moves or scales behind it (panning and zooming inside the
 * frame, PO acceptance of 2026-11-04).
 */
export type CropKeep = 'image' | 'frame';

/** Below this the window's width did not change: a pan, not a zoom. */
const SAME_SCALE = 1e-6;

export interface WriteImageCropOptions {
  /** Defaults to `'image'`, every write before the 2026-11-04 amendment. */
  readonly keep?: CropKeep;
  /**
   * The size a page image with no stored `width`/`height` is drawn at (its
   * loaded pixel size): what `'frame'` scales when the block stores none.
   */
  readonly natural?: { width: number; height: number } | null;
}

/**
 * Record one crop gesture (ADR 0037). Answers whether anything was written.
 *
 * - Nothing on a readonly store, nothing when the crop (mask included) is
 *   already the one asked for: an unchanged write is an empty undo step.
 * - One gesture, one undo step: `captureSync` then a single transaction.
 * - The whole image, or `undefined`, REMOVES the key; a full rectangle is
 *   never stored.
 * - Keeping the image: on the canvas the box is the visible part, so `xywh`
 *   moves in the same transaction and the picture keeps its scale and
 *   position; on a page `width`/`height` stay those of the whole picture and
 *   nothing else moves.
 * - Keeping the frame: `xywh` is untouched on the canvas; on a page
 *   `width`/`height` (the WHOLE picture) are scaled by the old window width
 *   over the new one in the same transaction, so `width × crop.w`, the box
 *   shown, holds. A pan changes no width and writes only `crop`.
 * - `sourceId` is never touched: the bytes do not change.
 */
export function writeImageCrop(
  model: ImageBlockModel,
  next: CropRect | undefined,
  mask: ImageCropMask,
  onCanvas: boolean,
  { keep = 'image', natural = null }: WriteImageCropOptions = {}
): boolean {
  const store = model.store;
  if (store.readonly) return false;

  const current = readImageCrop(model.props.crop);
  const target: ImageCrop | undefined =
    next && !isWholeImage(next)
      ? {
          x: next.x,
          y: next.y,
          w: next.w,
          h: next.h,
          ...(mask === 'free' ? {} : { mask }),
        }
      : undefined;

  if (!current && !target) return false;
  if (
    current &&
    target &&
    sameCropRect(current, target) &&
    (current.mask ?? 'free') === (target.mask ?? 'free')
  ) {
    return false;
  }

  const from = current ?? WHOLE_IMAGE;
  const to = target ?? WHOLE_IMAGE;
  const props: Partial<ImageBlockProps> = {};
  if (keep === 'frame') {
    if (!onCanvas) {
      Object.assign(props, frameKeptPageSize(model, from, to, natural));
    }
  } else if (onCanvas) {
    const bound = Bound.deserialize(model.xywh);
    if (bound.w > 0 && bound.h > 0) {
      const { x, y, w, h } = cropBoundFor(
        bound,
        model.props.rotate ?? 0,
        from,
        to
      );
      props.xywh = new Bound(x, y, w, h).serialize();
    }
  }
  if (target) props.crop = target;

  store.captureSync();
  store.transact(() => {
    if (Object.keys(props).length > 0) store.updateBlock(model, props);
    if (!target) delete (model.props as { crop?: ImageCrop }).crop;
  });
  return true;
}

/**
 * The page `width`/`height` that keep the shown window's size when the crop
 * goes from `from` to `to`; nothing for a pan (same width) or when the size
 * the picture is drawn at is unknown.
 */
function frameKeptPageSize(
  model: ImageBlockModel,
  from: CropRect,
  to: CropRect,
  natural: { width: number; height: number } | null
): Pick<ImageBlockProps, 'width' | 'height'> | null {
  const factor = from.w / to.w;
  if (!Number.isFinite(factor) || Math.abs(factor - 1) < SAME_SCALE) {
    return null;
  }
  const { width, height } = model.props;
  const base = width && height ? { width, height } : natural;
  if (!base) return null;
  return { width: base.width * factor, height: base.height * factor };
}
