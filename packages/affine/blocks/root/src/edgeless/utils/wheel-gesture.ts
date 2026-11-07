import { normalizeWheelDeltaY } from '@labre/affine-block-surface';
import { IS_WINDOWS } from '@labre/global/env';
import { Point, Vec } from '@labre/global/gfx';
import type { Viewport } from '@labre/std/gfx';

/**
 * The viewport maths of a wheel and of a two-finger pinch, shared by the
 * editor's edgeless root and the read-only canvas viewer (ADR 0050 §4), so the
 * two never drift. Reading the event and deciding whether it is this
 * component's business stays with each caller; these only move the viewport.
 */

/** Zooms around the pointer, by the wheel's vertical delta. */
export function zoomAtPointer(
  viewport: Viewport,
  e: WheelEvent,
  rect: DOMRect
): void {
  const [baseX, baseY] = viewport.toModelCoord(
    e.clientX - rect.x,
    e.clientY - rect.y
  );
  viewport.setZoom(
    normalizeWheelDeltaY(e.deltaY, viewport.zoom),
    new Point(baseX, baseY),
    true
  );
}

/**
 * Pans by the wheel's deltas. Shift+wheel means "scroll sideways" on every
 * platform. Windows never sends a horizontal delta for it, so the vertical one
 * has to be reinterpreted; elsewhere the OS does it natively for trackpads and
 * horizontal-capable mice, and `deltaX === 0` is what a plain mouse — with
 * nothing but a vertical wheel — leaves us to work with.
 */
export function panByWheel(viewport: Viewport, e: WheelEvent): void {
  const simulateHorizontalScroll = e.shiftKey && (IS_WINDOWS || e.deltaX === 0);
  const dx = simulateHorizontalScroll
    ? e.deltaY / viewport.zoom
    : e.deltaX / viewport.zoom;
  const dy = simulateHorizontalScroll ? 0 : e.deltaY / viewport.zoom;

  viewport.applyDeltaCenter(dx, dy);
  viewport.viewportMoved.next([dx, dy]);
}

export type PinchPointer = {
  x: number;
  y: number;
  delta: { x: number; y: number };
};

/**
 * One step of a two-finger pinch: the zoom follows the change of distance
 * between the fingers, around their midpoint. Coordinates are relative to the
 * viewport element.
 */
export function pinchStep(
  viewport: Viewport,
  p1: PinchPointer,
  p2: PinchPointer
): void {
  const lastDistance = Vec.dist(
    [p1.x - p1.delta.x, p1.y - p1.delta.y],
    [p2.x - p2.delta.x, p2.y - p2.delta.y]
  );
  if (lastDistance === 0) return;
  const currentDistance = Vec.dist([p1.x, p1.y], [p2.x, p2.y]);
  const [baseX, baseY] = viewport.toModelCoord(
    0.5 * (p1.x + p2.x),
    0.5 * (p1.y + p2.y)
  );
  viewport.setZoom(
    (currentDistance / lastDistance) * viewport.zoom,
    new Point(baseX, baseY)
  );
}
