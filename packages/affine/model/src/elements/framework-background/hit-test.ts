import type { IBound, IVec } from '@labre/global/gfx';
import {
  getPointsFromBoundWithRotation,
  pointInPolygon,
  pointOnPolygonStoke,
} from '@labre/global/gfx';
import type { PointTestOptions } from '@labre/std/gfx';

/**
 * The width of the band a background is picked by, in SCREEN pixels.
 *
 * Ten is what every caller on the picking path already asks for
 * (`getElementByPoint`, the default tool, the gfx view event handler all pass
 * `hitThreshold: 10`); naming it here gives the one caller that passes nothing
 * — the frame manager, which calls `includesPoint(x, y, {})` — the same band
 * instead of a shape's 1-pixel default.
 */
export const BACKGROUND_BORDER_HIT_THRESHOLD = 10;

/**
 * Whether a point picks a framework background — THE hit test every background
 * in the library shares.
 *
 * ## A background is picked by its border, not by its area
 *
 * A background is a passive canvas: the user drops nodes onto it and works on
 * THEM. A hit test over the whole rectangle makes the backdrop compete with its
 * own content for every click — it wins outright when it sits above in the
 * paint order (`getElementByPoint` keeps the topmost hit), and it fills every
 * gap when it sits below (the interior of an unfilled shape, the space beside a
 * small node). Both were reported from the same recette (issue #194).
 *
 * So the band IS the affordance: within `hitThreshold` screen pixels of the
 * (rotated) outline, and nowhere else. The threshold is divided by the zoom for
 * the reason every shape divides it — a border band has to stay the same width
 * under the pointer whatever the viewport is doing.
 *
 * ## The interior still answers "is the pointer on this element"
 *
 * `ignoreTransparent: false` is the existing way a caller says it is asking
 * about the element's visible EXTENT rather than about what a click would pick
 * — an unfilled shape answers the same two ways for the same reason
 * (`rect.includesPoint`). Exactly two callers pass it: the default tool, which
 * uses it to decide whether a press on an ALREADY-SELECTED element starts a
 * move, and the connector manager, which never sees a background at all
 * (`connectable` is false). So a selected background keeps being dragged from
 * anywhere inside it, and only picking changed.
 *
 * ## What did NOT change
 *
 * `containsBound` / `intersectsBound` (the lasso), `getNearestPoint` and
 * `getLineIntersections` are untouched: a rubber band that had to graze the
 * outline would be a second regression dressed as a fix.
 */
export function backgroundIncludesPoint(
  bounds: IBound,
  x: number,
  y: number,
  options?: PointTestOptions
): boolean {
  const point: IVec = [x, y];
  const points = getPointsFromBoundWithRotation(bounds);

  const threshold =
    (options?.hitThreshold ?? BACKGROUND_BORDER_HIT_THRESHOLD) /
    (options?.zoom ?? 1);

  if (pointOnPolygonStoke(point, points, threshold)) return true;

  return options?.ignoreTransparent === false && pointInPolygon(point, points);
}
