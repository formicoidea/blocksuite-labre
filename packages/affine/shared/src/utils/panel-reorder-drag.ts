import { panelDragStarted } from '../styles/panel-header.js';

/**
 * The ONE drag-to-reorder gesture of the side panels (ADR 0034):
 * the frame panel's cards and the selection pane's rows.
 *
 * Why it exists: the two panels each wrote their own drag and the two
 * drifted. The frame panel's (`fragments/frame-panel/src/utils/drag.ts`, now
 * deleted) ran on mouse events, never refused a read-only document, drew the
 * drop line at 0 for a drop after the last card, and had no way out but the
 * release. The selection pane's (hand-written in `selection-pane-widget.ts`)
 * ran on pointer events, refused read-only and showed a `not-allowed` cursor,
 * and swallowed Escape. Only the threshold was shared, and a comment held the
 * rest together. Both panels now hand this controller what is theirs — the
 * rows, the drop rule, the ghost, the write — and it owns the gesture:
 *
 * - pointer events, listened to on the document in the CAPTURE phase from the
 *   press to the end, so a panel that stops its own events' propagation (the
 *   pane does, to keep the canvas out of them) still sees every move;
 * - a read-only document never starts one: the press adds no listener;
 * - a press becomes a drag past {@link panelDragStarted} — called here and
 *   nowhere else — and only then is anything picked up;
 * - over the whole viewport, a mask carries the cursor: `grabbing` over a gap
 *   that takes the drop, `not-allowed` elsewhere (its geometry stays in each
 *   panel's stylesheet, the controller sets the cursor and nothing else);
 * - Escape or `pointercancel` CANCELS: nothing is written, the release that
 *   follows writes nothing, and the Escape does not reach the panel (which
 *   would close it);
 * - the click that follows a release or a cancel is not a click: the panel
 *   asks {@link PanelReorderDrag.consumeSwallowedClick} in its click handler;
 * - with a `scroller`, a row held near the list's top or bottom edge scrolls
 *   the list (ADR 0034, amendment of 2026-11-04), and the drop line follows
 *   the rows that scroll under a still pointer
 *   ({@link PanelReorderDragOptions.scroller}).
 *
 * Multi-selection is the panel's business: `onPickUp` decides what moves,
 * `dropAt` skips the rows that move with it.
 */

/** A pointer position, in client coordinates. */
export interface PanelDragPoint {
  clientX: number;
  clientY: number;
}

export interface PanelReorderDragOptions<Drop> {
  /** Read at the press: a read-only document never starts a drag. */
  readonly: () => boolean;
  /** The rows, top first, read LIVE at every move. */
  rows: () => readonly HTMLElement[];
  /** The box a drop must land in; outside it, or `null`, refuses. */
  bounds: () => HTMLElement | null;
  /** The press became a drag: select what moves, build the ghost. */
  onPickUp: (press: PanelDragPoint) => void;
  /**
   * What a release at the gap `gap` — before `rows()[gap]`, `rows().length`
   * after the last — would do, or `null` to refuse it.
   */
  dropAt: (gap: number, point: PanelDragPoint) => Drop | null;
  /** Every move of a drag: draw the ghost at `ghost`, the line for `drop`. */
  onMove: (drop: Drop | null, ghost: PanelDragPoint) => void;
  /** The release, over a gap that takes it. Before `onEnd`. */
  onDrop: (drop: Drop) => void;
  /** A drag ended — dropped, refused, cancelled or disposed. Always last. */
  onEnd: () => void;
  /** The cursor mask: appended to `host()` on pick-up, removed at the end. */
  mask: { host: () => ParentNode | null; className: string; testId?: string };
  /** Carries `data-drag="valid" | "invalid"` while a drag is live. */
  stateHost?: () => HTMLElement | null;
  /**
   * The box that scrolls the rows, usually the same element as `bounds`.
   * Absent, the list never scrolls by itself (the shape before 2.6, still
   * accepted).
   *
   * Present, a drag held in the band {@link panelEdgeScrollDelta} draws along
   * its top or bottom edge scrolls it once per animation frame, faster the
   * deeper in the band, capped at 30 px per frame (past the edge, the cap) —
   * the canvas's edge pan rule (`calPanDelta`,
   * `blocks/surface/src/tool/panning-utils.ts`). After each step, and on every
   * `scroll` of the box (a wheel during the drag), the gap is resolved again
   * at the last pointer, so the line and `onMove` follow the rows under a
   * still pointer. The band lies INSIDE the box: a release there still drops
   * at the gap under the pointer; past the box's edge the list scrolls at the
   * cap but a release there is refused, as it always was. The loop stops when
   * the pointer leaves the band, when the box cannot scroll further, and at
   * the end of the drag (drop, Escape, `pointercancel`, dispose).
   */
  scroller?: () => HTMLElement | null;
}

export interface PanelReorderDrag {
  /** Hand it the row's `pointerdown`. */
  press(event: PointerEvent): void;
  /**
   * Whether the click being handled follows a drag's release or cancel —
   * answered `true` once, then `false`.
   */
  consumeSwallowedClick(): boolean;
  /** Whether a press has become a drag that has not ended yet. */
  readonly dragging: boolean;
  /** Ends a live drag (`onEnd`, nothing written) and removes the listeners. */
  dispose(): void;
}

/**
 * The gap a pointer at `clientY` is over: how many rows have their middle
 * above it. `0` is before the first row, `rects.length` after the last.
 */
export function panelReorderGap(
  rects: readonly DOMRect[],
  clientY: number
): number {
  let gap = 0;
  for (const rect of rects) {
    if (clientY > rect.top + rect.height / 2) gap++;
  }
  return gap;
}

/** How wide the edge band of a scrolling list is, in CSS pixels. */
const EDGE_SCROLL_BAND = 20;
/** The fastest an edge scroll goes, in CSS pixels per frame (PO decision). */
const EDGE_SCROLL_MAX = 30;

/**
 * How far a list scrolls this frame for a pointer at `clientY` while a row is
 * dragged over `box`: negative in the band along the top edge, positive in the
 * band along the bottom one, proportional to the depth past the band's inner
 * side and capped at `max`; `0` between the two bands. The vertical twin of
 * the canvas's `calPanDelta`.
 */
export function panelEdgeScrollDelta(
  box: DOMRect,
  clientY: number,
  band = EDGE_SCROLL_BAND,
  max = EDGE_SCROLL_MAX
): number {
  const top = box.top + band;
  const bottom = box.bottom - band;
  if (clientY < top) return Math.max(-max, clientY - top);
  if (clientY > bottom) return Math.min(max, clientY - bottom);
  return 0;
}

export function createPanelReorderDrag<Drop>(
  options: PanelReorderDragOptions<Drop>
): PanelReorderDrag {
  let start: { x: number; y: number } | null = null;
  let dragging = false;
  let listening: Document | null = null;
  let mask: HTMLElement | null = null;
  let swallowClick = false;
  /** The last pointer of the drag, resolved again when the rows scroll. */
  let last: PanelDragPoint | null = null;
  /** The box listened to for `scroll`, and the pending edge-scroll frame. */
  let scrolling: HTMLElement | null = null;
  let frame: number | null = null;

  const point = (event: PointerEvent): PanelDragPoint => ({
    clientX: event.clientX,
    clientY: event.clientY,
  });

  const resolve = (at: PanelDragPoint): Drop | null => {
    const bounds = options.bounds();
    if (!bounds) return null;
    const box = bounds.getBoundingClientRect();
    if (
      at.clientX < box.left ||
      at.clientX > box.right ||
      at.clientY < box.top ||
      at.clientY > box.bottom
    ) {
      return null;
    }
    const rects = options.rows().map(row => row.getBoundingClientRect());
    return options.dropAt(panelReorderGap(rects, at.clientY), at);
  };

  const show = (drop: Drop | null) => {
    if (mask) mask.style.cursor = drop ? 'grabbing' : 'not-allowed';
    const host = options.stateHost?.();
    if (host) host.dataset.drag = drop ? 'valid' : 'invalid';
  };

  /** The gap under the last pointer, drawn and handed to the panel. */
  const follow = () => {
    if (!dragging || !last) return;
    const drop = resolve(last);
    show(drop);
    options.onMove(drop, last);
  };

  const edgeDelta = (scroller: HTMLElement): number => {
    if (!last) return 0;
    const box = scroller.getBoundingClientRect();
    // Beside the list (over the canvas), the list stays where it is.
    if (last.clientX < box.left || last.clientX > box.right) return 0;
    return panelEdgeScrollDelta(box, last.clientY);
  };

  const step = () => {
    frame = null;
    const scroller = options.scroller?.();
    if (!dragging || !scroller) return;
    const delta = edgeDelta(scroller);
    if (delta === 0) return;
    const before = scroller.scrollTop;
    const end = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    // Whole pixels, away from zero: a browser rounds a fractional scrollTop,
    // and a step rounded to nothing would end the loop inside the band.
    const px = delta > 0 ? Math.ceil(delta) : Math.floor(delta);
    scroller.scrollTop = Math.min(end, Math.max(0, before + px));
    if (scroller.scrollTop === before) return;
    follow();
    frame = requestAnimationFrame(step);
  };

  const edgeScroll = () => {
    if (frame !== null) return;
    const scroller = options.scroller?.();
    if (!scroller || edgeDelta(scroller) === 0) return;
    frame = requestAnimationFrame(step);
  };

  function onScroll() {
    follow();
  }

  const unlisten = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    scrolling?.removeEventListener('scroll', onScroll);
    scrolling = null;
    if (!listening) return;
    listening.removeEventListener('pointermove', onPointerMove, true);
    listening.removeEventListener('pointerup', onPointerUp, true);
    listening.removeEventListener('pointercancel', onPointerCancel, true);
    listening.removeEventListener('keydown', onKeydown, true);
    listening = null;
  };

  /** Back to idle; `onEnd` only when something was picked up. */
  const finish = () => {
    unlisten();
    start = null;
    last = null;
    if (!dragging) return;
    dragging = false;
    mask?.remove();
    mask = null;
    const host = options.stateHost?.();
    if (host) delete host.dataset.drag;
    options.onEnd();
  };

  const cancel = () => {
    if (dragging) swallowClick = true;
    finish();
  };

  const pickUp = (event: PointerEvent) => {
    dragging = true;
    const host = options.mask.host();
    if (host) {
      const doc = (event.target as Node | null)?.ownerDocument ?? document;
      mask = doc.createElement('div');
      mask.className = options.mask.className;
      if (options.mask.testId) mask.dataset.testid = options.mask.testId;
      mask.style.cursor = 'grabbing';
      host.append(mask);
    }
    scrolling = options.scroller?.() ?? null;
    scrolling?.addEventListener('scroll', onScroll, { passive: true });
    options.onPickUp({ clientX: start!.x, clientY: start!.y });
  };

  function onPointerMove(event: PointerEvent) {
    if (!start) return;
    if (!dragging) {
      if (!panelDragStarted(start, { x: event.clientX, y: event.clientY })) {
        return;
      }
      pickUp(event);
    }
    last = point(event);
    follow();
    edgeScroll();
  }

  function onPointerUp(event: PointerEvent) {
    if (!dragging) {
      // A press that never became a drag: the click that follows is a click.
      finish();
      return;
    }
    const drop = resolve(point(event));
    swallowClick = true;
    try {
      if (drop !== null) options.onDrop(drop);
    } finally {
      finish();
    }
  }

  function onPointerCancel() {
    cancel();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (!dragging) {
      // A press still under the threshold: forget it, and let the Escape do
      // what it does in the panel.
      finish();
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    cancel();
  }

  return {
    press(event) {
      // Any new press clears a click left armed by a release or a cancel
      // that no click followed (released over another element).
      swallowClick = false;
      if (event.button !== 0 || start) return;
      if (options.readonly()) return;
      start = { x: event.clientX, y: event.clientY };
      const doc = (event.target as Node | null)?.ownerDocument ?? document;
      doc.addEventListener('pointermove', onPointerMove, true);
      doc.addEventListener('pointerup', onPointerUp, true);
      doc.addEventListener('pointercancel', onPointerCancel, true);
      doc.addEventListener('keydown', onKeydown, true);
      listening = doc;
    },
    consumeSwallowedClick() {
      const swallowed = swallowClick;
      swallowClick = false;
      return swallowed;
    },
    get dragging() {
      return dragging;
    },
    dispose() {
      finish();
    },
  };
}
