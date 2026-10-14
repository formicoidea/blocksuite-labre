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
 * Record one crop gesture (ADR 0037). Answers whether anything was written.
 *
 * - Nothing on a readonly store, nothing when the crop (mask included) is
 *   already the one asked for: an unchanged write is an empty undo step.
 * - One gesture, one undo step: `captureSync` then a single transaction.
 * - The whole image, or `undefined`, REMOVES the key; a full rectangle is
 *   never stored.
 * - On the canvas the box is the visible part, so `xywh` moves in the same
 *   transaction: the picture keeps its scale and position. On a page,
 *   `width`/`height` stay those of the whole picture and nothing else moves.
 * - `sourceId` is never touched: the bytes do not change.
 */
export function writeImageCrop(
  model: ImageBlockModel,
  next: CropRect | undefined,
  mask: ImageCropMask,
  onCanvas: boolean
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

  const props: Partial<ImageBlockProps> = {};
  if (onCanvas) {
    const bound = Bound.deserialize(model.xywh);
    if (bound.w > 0 && bound.h > 0) {
      const { x, y, w, h } = cropBoundFor(
        bound,
        model.props.rotate ?? 0,
        current ?? WHOLE_IMAGE,
        target ?? WHOLE_IMAGE
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
