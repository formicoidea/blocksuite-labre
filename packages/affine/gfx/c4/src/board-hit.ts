import type { BackgroundRect } from '@labre/affine-block-surface';
import { backgroundPlot } from '@labre/affine-block-surface';

import { C4_BOARD_BACKGROUND } from './background.js';

/**
 * Where the C4 board's title band is, in ELEMENT-LOCAL model units.
 *
 * Pure, and lifted out of `element-view.ts` so the answer can be asserted
 * without an editor, a viewport or a canvas around it — the same split
 * `pool-hit.ts` makes for the BPMN pool, and for the same reason.
 *
 * The rectangle is derived from `backgroundPlot`, the very function the renderer
 * paints the band from: nothing here restates a coordinate, so the strip a user
 * aims at cannot drift away from the strip they can see.
 *
 * ponytail: a ROTATED board is not accounted for — the caller converts by
 * subtraction (and, in `C4FrameView`, by de-rotating about the centre first),
 * so every box here assumes an upright board. Same reserve `pool-hit.ts`
 * documents.
 */

/** What this file needs of a board: its box. */
export interface C4BoardGeometry {
  deserializedXYWH: readonly number[];
}

/**
 * The board's title band, or `null` when there is no room for one.
 *
 * The band IS the top margin, full width, clamped to a board shorter than its
 * own header — the degenerate case the renderer clamps and the model's own
 * carve-out clamps too.
 */
export function c4BoardTitleBand(
  model: C4BoardGeometry
): BackgroundRect | null {
  const [, , w, h] = model.deserializedXYWH;
  if (!(w > 0) || !(h > 0)) return null;

  const plot = backgroundPlot(C4_BOARD_BACKGROUND, w, h);
  const height = Math.min(plot.y0, h);
  if (!(height > 0)) return null;

  return { x: 0, y: 0, w, h: height };
}

/**
 * Whether an element-local point is in the board's title band.
 *
 * The WHOLE band, not the tight box of the drawn glyphs. A header strip you may
 * only double-click the eleven characters of is a target that lies about where
 * it is — the same call the pool's participant band makes (`bpmnInPoolTitleBand`).
 *
 * No zoom-grown target here, unlike the pool's 28-unit strip: growing this one
 * would put the rename zone outside the band the MODEL lets a click select, and
 * "what is painted is what is picked" is worth more than the pixels a 56-unit
 * header would gain at 0.2 zoom.
 */
export function c4InBoardTitleBand(
  model: C4BoardGeometry,
  local: readonly [number, number]
): boolean {
  const band = c4BoardTitleBand(model);
  if (!band) return false;
  const [lx, ly] = local;
  return (
    lx >= band.x &&
    lx <= band.x + band.w &&
    ly >= band.y &&
    ly <= band.y + band.h
  );
}
