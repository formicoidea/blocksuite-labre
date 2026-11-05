import type { IVec } from '@labre/global/gfx';
import type { PointerEventState } from '@labre/std';
import type { Viewport } from '@labre/std/gfx';

const PANNING_DISTANCE = 30;

/**
 * The pan step for a pointer near the edge of the VISIBLE canvas: the band is
 * measured on `viewport.visibleRect`, so a panel docked over the canvas (the
 * selection pane, the artefact catalogue) moves the band to its own edge
 * instead of hiding it under itself (issue #433).
 */
export function calPanDelta(
  viewport: Viewport,
  e: PointerEventState,
  edgeDistance = 20
): IVec | null {
  // Get the visible edge: the container less what floats over it
  const { left, top, width, height } = viewport.visibleRect;
  // Get pointer position
  let { x, y } = e;
  const { containerOffset } = e;
  x += containerOffset.x;
  y += containerOffset.y;
  // Check if pointer is near viewport edge
  const nearLeft = x < left + edgeDistance;
  const nearRight = x > left + width - edgeDistance;
  const nearTop = y < top + edgeDistance;
  const nearBottom = y > top + height - edgeDistance;
  // If pointer is not near viewport edge, return false
  if (!(nearLeft || nearRight || nearTop || nearBottom)) return null;

  // Calculate move delta
  let deltaX = 0;
  let deltaY = 0;

  // Use PANNING_DISTANCE to limit the max delta, avoid panning too fast
  if (nearLeft) {
    deltaX = Math.max(-PANNING_DISTANCE, x - (left + edgeDistance));
  } else if (nearRight) {
    deltaX = Math.min(PANNING_DISTANCE, x - (left + width - edgeDistance));
  }

  if (nearTop) {
    deltaY = Math.max(-PANNING_DISTANCE, y - (top + edgeDistance));
  } else if (nearBottom) {
    deltaY = Math.min(PANNING_DISTANCE, y - (top + height - edgeDistance));
  }

  return [deltaX, deltaY];
}
