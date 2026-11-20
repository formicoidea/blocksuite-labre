import { type Middleware, size } from '@floating-ui/dom';

/**
 * A menu never runs past the window, and every entry stays reachable
 * (product owner's acceptance of the database work: on a base of three rows
 * opened on its full page, the column menu ran past the bottom of a short
 * window and "Duplicate" and "Delete" could not be reached). Menus are
 * placed `fixed` (`POPUP_STRATEGY`): a tall page let the reader scroll the
 * anchor up and the menu with it, a short one had nothing to scroll.
 *
 * Internal to the context menu: not exported from its entry point.
 */

/** The gap a capped panel keeps to the window's edge. */
const WINDOW_PADDING = 8;

/**
 * Caps `panel` at `room` and lets it scroll inside itself, only while its
 * content is taller than the room; a panel that fits carries no cap and no
 * scroll, and loses them again once it fits (a larger window). Its scroll
 * position survives a new placement.
 */
export function capToRoom(panel: HTMLElement, room: number) {
  const { style } = panel;
  const scrolled = panel.scrollTop;
  style.maxHeight = '';
  style.overflowY = '';
  style.overflowX = '';
  const limit = Math.max(0, Math.floor(room));
  if (panel.scrollHeight <= limit) return;
  Object.assign(style, {
    maxHeight: `${limit}px`,
    overflowY: 'auto',
    // Shut, not left to compute to `auto` beside the vertical axis: a
    // translated child would scroll the panel sideways
    // (`popup-overflow.unit.spec.ts`).
    overflowX: 'hidden',
  });
  panel.scrollTop = scrolled;
}

/**
 * Last in a menu's middleware, after its placement is chosen: the room is
 * what floating-ui measures on the side the menu opens on.
 */
export const fitToWindowHeight = (): Middleware =>
  size({
    padding: WINDOW_PADDING,
    apply({ availableHeight, elements }) {
      capToRoom(elements.floating, availableHeight);
    },
  });

/**
 * How far a panel scrolls for an entry to show (their client rects): 0 when
 * it does. Used when the KEYBOARD moves the highlight (the arrows move a
 * `.focused` class, not the DOM focus, so nothing else brings the entry into
 * view); never on a pointer
 * event, a sub-menu closing or a programmatic focus, or the panel would
 * scroll under the mouse. Only the panel scrolls, never the page.
 */
export function scrollDeltaToShow(
  panel: Pick<DOMRect, 'top' | 'bottom'>,
  entry: Pick<DOMRect, 'top' | 'bottom'>
): number {
  if (entry.top < panel.top) return entry.top - panel.top;
  if (entry.bottom > panel.bottom) return entry.bottom - panel.bottom;
  return 0;
}
