import { panelDragStarted } from '../styles/panel-header.js';

/**
 * The ONE drag-to-reorder gesture of the side panels (ADR 0034, proposed):
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
 *   asks {@link PanelReorderDrag.consumeSwallowedClick} in its click handler.
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

export function createPanelReorderDrag<Drop>(
  options: PanelReorderDragOptions<Drop>
): PanelReorderDrag {
  let start: { x: number; y: number } | null = null;
  let dragging = false;
  let listening: Document | null = null;
  let mask: HTMLElement | null = null;
  let swallowClick = false;

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

  const unlisten = () => {
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
    const at = point(event);
    const drop = resolve(at);
    show(drop);
    options.onMove(drop, at);
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
