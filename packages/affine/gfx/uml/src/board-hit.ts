import type { BackgroundRect } from '@labre/affine-block-surface';
import { backgroundPlot } from '@labre/affine-block-surface';

import { UML_DIAGRAM_FRAME } from './background.js';

/**
 * Where the UML diagram frame's heading band is, in ELEMENT-LOCAL model units.
 *
 * Pure, and kept out of `element-view.ts` so the answer can be asserted without
 * an editor, a viewport or a canvas around it — the same split `board-hit.ts`
 * makes for the C4 board and `pool-hit.ts` for the BPMN pool.
 *
 * The rectangle is derived from `backgroundPlot`, the very function the renderer
 * lays the heading out from: nothing here restates a coordinate, so the strip a
 * user aims at cannot drift away from the strip the frame reserves.
 *
 * ponytail: a ROTATED frame is not accounted for — the caller converts by
 * subtraction (and, in `UmlFrameView`, by de-rotating about the centre first),
 * so every box here assumes an upright frame. Same reserve `board-hit.ts` and
 * `pool-hit.ts` both document.
 */

/** What this file needs of a frame: its box. */
export interface UmlDiagramGeometry {
  deserializedXYWH: readonly number[];
}

/**
 * The frame's heading band, or `null` when there is no room for one.
 *
 * The band IS the top margin, full width, clamped to a frame shorter than its
 * own heading — the degenerate case the model's own carve-out clamps too.
 */
export function umlDiagramBand(
  model: UmlDiagramGeometry
): BackgroundRect | null {
  const [, , w, h] = model.deserializedXYWH;
  if (!(w > 0) || !(h > 0)) return null;

  const plot = backgroundPlot(UML_DIAGRAM_FRAME, w, h);
  const height = Math.min(plot.y0, h);
  if (!(height > 0)) return null;

  return { x: 0, y: 0, w, h: height };
}

/**
 * Whether an element-local point is in the frame's heading band.
 *
 * The WHOLE band, not the tight box of the cut-corner tag. The strip is part of
 * the sheet — nothing is ever dropped there by convention, and the drawing goes
 * below it — so a click anywhere along it belongs to the frame, and this is the
 * same answer `UmlDiagramElementModel.includesPoint` gives: what is picked is
 * what is renamed.
 *
 * No zoom-grown target, unlike the BPMN pool's 28-unit strip: growing this one
 * would put the rename zone outside the band the MODEL lets a click select, and
 * the two agreeing is worth more than the pixels it would gain at 0.2 zoom.
 */
export function umlInDiagramBand(
  model: UmlDiagramGeometry,
  local: readonly [number, number]
): boolean {
  const band = umlDiagramBand(model);
  if (!band) return false;
  const [lx, ly] = local;
  return (
    lx >= band.x &&
    lx <= band.x + band.w &&
    ly >= band.y &&
    ly <= band.y + band.h
  );
}
