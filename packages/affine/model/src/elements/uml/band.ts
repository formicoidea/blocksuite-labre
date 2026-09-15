import { rotatePoint } from '@labre/global/gfx';

/**
 * The NAME BAND carve-out, shared by the UML backgrounds that wear one.
 *
 * A framework background is picked by its BORDER and nothing else (issue #194),
 * which is what keeps a transparent frame from stealing the clicks meant for
 * what it is drawn round. Every frame that writes its name in a STRIP of its
 * own then has to carve that strip back in, or the words are unreachable: a
 * single click on them would select nothing at all.
 *
 * `UmlDiagramElementModel.includesPoint` was the first to do it and states the
 * argument in full. This module is the same arithmetic, lifted out when the
 * activity PARTITION (§15.6.4) and the state-machine REGION (§14.2.4) each
 * arrived wanting it — and wanting it on two different edges, the partition's
 * band following its own `orientation`. Three inline copies of a rotation
 * unwind is three places for one of them to be fixed.
 *
 * The diagram frame keeps its own copy: it is a RED ZONE file whose hit test is
 * pinned by a spec written against it, and rewriting a shipped carve-out to
 * share code with a new one buys nothing a reader can see.
 */

/** What a band test needs of an element: its box and its rotation. */
export interface UmlBandGeometry {
  deserializedXYWH: readonly number[];
  rotate?: number;
}

/**
 * Whether a CANVAS point lies in the leading band of an element — the strip
 * along its top edge (`'top'`) or along its left edge (`'left'`).
 *
 * The band is axis-aligned INSIDE the element, never on the canvas, so the
 * element rotation is undone about the centre before anything is measured:
 * without that the strip would stay pinned to the top of the screen while the
 * name it is meant to pick turned away with the frame.
 *
 * Clamped to an element smaller than its own band, which is the degenerate case
 * a renderer clamps too: an unclamped strip would hang off a squashed frame and
 * pick it from empty canvas.
 */
export function umlInNameBand(
  model: UmlBandGeometry,
  side: 'top' | 'left',
  band: number,
  x: number,
  y: number
): boolean {
  const [ex, ey, w, h] = model.deserializedXYWH;
  if (!(w > 0) || !(h > 0) || !(band > 0)) return false;

  // Element-local coordinates, undoing the element rotation about its centre.
  let lx = x - ex;
  let ly = y - ey;
  const rotate = model.rotate ?? 0;
  if (rotate) {
    const [ux, uy] = rotatePoint([x, y], [ex + w / 2, ey + h / 2], -rotate);
    lx = ux - ex;
    ly = uy - ey;
  }

  if (lx < 0 || lx > w || ly < 0 || ly > h) return false;

  return side === 'top' ? ly <= Math.min(band, h) : lx <= Math.min(band, w);
}
