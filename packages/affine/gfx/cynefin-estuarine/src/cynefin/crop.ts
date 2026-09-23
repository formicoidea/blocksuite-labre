import type { SerializedXYWH } from '@labre/global/gfx';
import { Bound } from '@labre/global/gfx';

import { refScale } from '../utils';
import { REF_H, REF_W } from './consts';

/**
 * Cropping a Cynefin frame back onto its drawing, at the end of a resize.
 *
 * The diagram is a figurative reproduction of the official SVG, so it cannot be
 * stretched: `element-renderer.ts` fits it uniformly and centres what is left
 * over (`refScale`). Dragged off its 1080 × 777 proportion, the element
 * therefore letterboxes — at 1600 × 600 there are FOUR HUNDRED model units of
 * nothing either side of the picture. And a framework background is caught by
 * its border and by nothing else
 * (`model/src/elements/framework-background/hit-test.ts`, a band of `10 / zoom`
 * around the `xywh`), so the frame the user has to aim at ends up hundreds of
 * units away from anything drawn.
 *
 * The answer the PO chose (23/09/2026) is not to stretch the drawing and not to
 * widen the hit test, but to bring the FRAME back to the picture when the user
 * lets go of a resize handle. Nothing is deformed and nothing is truncated: the
 * element simply stops claiming room it does not paint.
 *
 * Why it is safe under rotation: a uniform fit centres what it fits, so
 * `ox + REF_W * s / 2 === w / 2`. The cropped box has the SAME CENTRE as the one
 * it replaces, and a surface element rotates about its centre — so the drawing
 * does not move, at any angle.
 */

/**
 * Below half a model unit there is nothing to see, and writing anyway would
 * cost an undo entry for a gesture that changed nothing. It is also what makes
 * the crop idempotent: a frame already cropped is left alone.
 */
const CROP_EPSILON = 0.5;

/**
 * The frame of `xywh` brought back onto the drawing it letterboxes, or `null`
 * when it is already on it.
 */
export function cynefinCroppedXYWH(
  xywh: SerializedXYWH
): SerializedXYWH | null {
  const bound = Bound.deserialize(xywh);
  if (!(bound.w > 0) || !(bound.h > 0)) return null;

  const { s, ox, oy } = refScale(bound.w, bound.h, REF_W, REF_H);
  if (ox < CROP_EPSILON && oy < CROP_EPSILON) return null;

  return new Bound(
    bound.x + ox,
    bound.y + oy,
    REF_W * s,
    REF_H * s
  ).serialize();
}
