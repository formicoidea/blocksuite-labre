import { isTouchPadPinchEvent } from '@labre/affine-shared/utils';

/**
 * The class `createSimplePortal` stamps on every portal root it appends to
 * `document.body` — the only thing a popup rendered OUTSIDE the editor host
 * still has in common with the editor that opened it.
 */
export const PORTAL_CLASS = 'blocksuite-portal';

/**
 * What the edgeless board owes a wheel event seen on `document`, in capture:
 *
 * - `ignore`: not a pinch, or not this editor's business — the page keeps it.
 * - `swallow`: a pinch inside a popup the editor portalled out to
 *   `document.body`. The browser must not page-zoom, but the board must not
 *   move either: zooming under an anchored popup leaves it pointing at nothing.
 * - `zoom`: a pinch inside the editor — the canvas zooms.
 */
export type PinchZoomAction = 'ignore' | 'swallow' | 'zoom';

/**
 * The whole decision, readable from the event and the host alone so it can be
 * tested without a live editor.
 */
export function pinchZoomAction(
  event: WheelEvent,
  host: EventTarget
): PinchZoomAction {
  // A plain wheel still belongs to whatever is under the pointer: an
  // overflowing toolbar, a bubble, a panel. Only the zoom gesture is claimed.
  if (!isTouchPadPinchEvent(event)) return 'ignore';

  const path = event.composedPath();
  if (path.includes(host)) return 'zoom';
  if (
    path.some(
      node => node instanceof Element && node.classList.contains(PORTAL_CLASS)
    )
  ) {
    return 'swallow';
  }
  return 'ignore';
}
