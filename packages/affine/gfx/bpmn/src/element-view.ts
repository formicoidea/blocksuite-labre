import {
  backgroundInstanceZones,
  backgroundPlot,
  EdgelessCRUDIdentifier,
} from '@labre/affine-block-surface';
import type { BpmnLane, BpmnPoolElementModel } from '@labre/affine-model';
import type { PointerEventState } from '@labre/std';
import { GfxElementModelView } from '@labre/std/gfx';

import { bpmnLanesOf, renameBpmnLane } from './actions.js';
import { BPMN_POOL_BACKGROUND } from './background.js';
import {
  POOL_LANE_GRAB,
  POOL_LANE_MIN_HEIGHT,
  POOL_LANE_NAME_HIT_HEIGHT,
  POOL_LANE_NAME_HIT_WIDTH,
} from './consts.js';

/**
 * View for a BPMN pool. Three direct gestures live here:
 *
 * - **dblclick on the pool** edits the participant name in place. The whole
 *   pool is the target, deliberately NOT the declaration's label hit test
 *   (`backgroundLabelHits`, which Wardley uses): a participant has exactly one
 *   name, and asking the user to find the 28-unit band to change it would be a
 *   regression dressed up as consistency;
 * - **dblclick in a lane's name corner** edits THAT lane's name instead. A lane
 *   name is not in the declaration's hit-test walk — it is a function of the
 *   model, not of the declaration (see the renderer's note on why the two must
 *   not be able to disagree) — so the box is computed here from the very
 *   metrics the renderer draws with;
 * - **drag on an internal lane boundary** moves the separator, taking from one
 *   lane and giving to the other.
 *
 * ## How the separator drag takes the gesture
 *
 * `GfxElementModelView.dispatch` reports a drag as handled whenever a handler
 * is REGISTERED, without consulting what the handler returned, and the default
 * tool stands down on that report. A permanently registered `dragstart` would
 * therefore make a pool undraggable. So the drag handlers are ARMED — attached
 * while the pointer is over a boundary of a selected pool, detached the moment
 * it is not — and the pool moves normally everywhere else.
 *
 * Arming happens on `pointermove` AND on `pointerdown`, and neither is a hover
 * requirement: a touch drag emits its first `pointermove` before the drag
 * threshold is crossed (the move controller listens on the host, the drag
 * controller on the document, so the host listener runs first), which is what
 * makes the grab zone work with no hovering at all. The `ns-resize` cursor is a
 * bonus for whoever has a mouse, never the affordance itself.
 *
 * ## The pool must be selected first
 *
 * Both the cursor and the grab are gated on the pool being selected. On an
 * infinite canvas, dragging over an element means "move it"; silently turning a
 * twelve-unit strip of an UNSELECTED pool into a resize handle would take that
 * away from a user who never said they were working on this pool. One click
 * first, and then the strip is live.
 *
 * ponytail: a ROTATED pool is not accounted for — the pointer is converted to
 * element-local coordinates by subtraction, so every hit box here assumes an
 * upright pool. Same reserve `backgroundAxisFacts` documents, for the same
 * reason: nothing rotates a framework background today. Upgrade: rotate the
 * local point by `-model.rotate` about the element centre, at the one function
 * that has the element in hand (`_localPoint`), not a new declared field.
 */
export class BpmnPoolView extends GfxElementModelView<BpmnPoolElementModel> {
  static override type: string = 'bpmnPool';

  private _nameEditor: HTMLInputElement | null = null;

  /** The boundary the pointer is over, and the handlers armed for it. */
  private _armed: { index: number; disposers: (() => void)[] } | null = null;

  /** Everything a separator drag needs, frozen at `dragstart`. */
  private _drag: {
    index: number;
    lanes: readonly BpmnLane[];
    /** Sum of the weights — the constant the two neighbours share. */
    total: number;
    /** Plot height in model units, i.e. what one unit of weight is worth. */
    plotHeight: number;
    /** Floor, already expressed as a weight. */
    minWeight: number;
  } | null = null;

  override onCreated(): void {
    super.onCreated();
    this.on('dblclick', e => this._onDblClick(e));
    this.on('pointermove', e => this._updateGrab(e));
    this.on('pointerdown', e => this._updateGrab(e));
    this.on('pointerleave', () => this._disarm());
  }

  override onDestroyed(): void {
    this._closeEditor();
    this._disarm();
    super.onDestroyed();
  }

  /* ── Lane geometry ─────────────────────────────────────────────────── */

  /** The pointer, in element-local model units. */
  private _localPoint(e: PointerEventState): [number, number] {
    const [mx, my] = this.gfx.viewport.toModelCoord(e.x, e.y);
    const [ex, ey] = this.model.deserializedXYWH;
    return [mx - ex, my - ey];
  }

  /**
   * The lane bands of this pool, in element-local model units.
   *
   * Read through `backgroundInstanceZones` and never recomputed: the renderer
   * paints from that function, the audit reports from it, and a hit box derived
   * any other way would be a fourth reading of the same partition — including
   * its dropping of malformed rows, which is exactly the reading the user sees.
   */
  private _bands(): {
    plot: ReturnType<typeof backgroundPlot>;
    bands: { top: number; height: number }[];
  } | null {
    const [, , w, h] = this.model.deserializedXYWH;
    const plot = backgroundPlot(BPMN_POOL_BACKGROUND, w, h);
    if (!(plot.width > 0) || !(plot.height > 0)) return null;

    const zones = backgroundInstanceZones(
      BPMN_POOL_BACKGROUND,
      this.model as unknown as Readonly<Record<string, unknown>>
    );
    if (zones.length === 0) return null;

    return {
      plot,
      bands: zones.map(zone => ({
        top: plot.y0 + zone.rect.y * plot.height,
        height: zone.rect.h * plot.height,
      })),
    };
  }

  /**
   * The INTERNAL boundary the point is on, as the index of the lane BELOW it —
   * so `i` separates lane `i - 1` from lane `i`. `null` for anywhere else.
   *
   * Internal only: the outer edges belong to the plot, and dragging one would
   * be a resize of the pool, which the handles already do.
   */
  private _boundaryAt(local: readonly [number, number]): number | null {
    const geometry = this._bands();
    if (!geometry) return null;
    const { plot, bands } = geometry;

    // The band on the left is the participant's name, not the flow area: a
    // separator does not run through it, so neither does its grab zone.
    if (local[0] < plot.x0 || local[0] > plot.x1) return null;

    for (let i = 1; i < bands.length; i++) {
      if (Math.abs(local[1] - bands[i].top) <= POOL_LANE_GRAB) return i;
    }
    return null;
  }

  /** The lane whose NAME corner the point is in, or `null`. */
  private _nameBoxAt(local: readonly [number, number]): number | null {
    const geometry = this._bands();
    if (!geometry) return null;
    const { plot, bands } = geometry;

    // 44 view pixels is the touch-target floor, converted to model units so the
    // box is at least that big however far out the board is zoomed; the fixed
    // model-unit metrics win once the pool is drawn large enough for them to.
    const zoom = this.gfx.viewport.zoom || 1;
    const minTouch = 44 / zoom;
    const width = Math.min(
      plot.width,
      Math.max(POOL_LANE_NAME_HIT_WIDTH, minTouch)
    );

    if (local[0] < plot.x0 || local[0] > plot.x0 + width) return null;

    for (let i = 0; i < bands.length; i++) {
      const height = Math.min(
        bands[i].height,
        Math.max(POOL_LANE_NAME_HIT_HEIGHT, minTouch)
      );
      if (local[1] >= bands[i].top && local[1] <= bands[i].top + height) {
        return i;
      }
    }
    return null;
  }

  private get _editable(): boolean {
    return !this.gfx.std.store.readonly && !this.model.isLocked();
  }

  /* ── Separator drag ────────────────────────────────────────────────── */

  private _updateGrab(e: PointerEventState): void {
    if (
      !this._editable ||
      !this.gfx.selection.selectedIds.includes(this.model.id)
    ) {
      this._disarm();
      return;
    }

    const index = this._boundaryAt(this._localPoint(e));
    if (index === null) {
      this._disarm();
      return;
    }
    // Reasserted on every move rather than only on arrival: the cursor is a
    // signal shared with the resize handles and the tools, and whoever set it
    // last wins — so the one that is still true says so again.
    this.gfx.cursor$.value = 'ns-resize';
    if (this._armed?.index === index) return;

    this._disarm();
    this._armed = {
      index,
      disposers: [
        this.on('dragstart', evt => this._onDragStart(evt)),
        this.on('dragmove', evt => this._onDragMove(evt)),
        this.on('dragend', () => this._onDragEnd()),
      ],
    };
  }

  private _disarm(): void {
    // Never mid-gesture: the pointer leaves the boundary as soon as the drag
    // starts moving, and disarming there would drop the drag on its first step.
    if (this._drag) return;
    if (!this._armed) return;
    this._armed.disposers.forEach(dispose => dispose());
    this._armed = null;
    this.gfx.cursor$.value = 'default';
  }

  private _onDragStart(_: PointerEventState): void {
    const index = this._armed?.index;
    const geometry = this._bands();
    if (index === undefined || !geometry || !this._editable) return;

    const lanes = bpmnLanesOf(this.model);
    if (!lanes[index - 1] || !lanes[index]) return;

    const total = lanes.reduce((sum, lane) => sum + lane.size, 0);
    if (!(total > 0)) return;

    this._drag = {
      index,
      lanes: lanes.map(lane => ({ ...lane })),
      total,
      plotHeight: geometry.plot.height,
      // The floor is a HEIGHT the user can see, so it is stated in the model
      // units of a pool at its reference height and converted to a weight
      // against this pool's own total — a pool stretched to twice the height
      // keeps the same visible floor, which is the point of weights.
      minWeight: (POOL_LANE_MIN_HEIGHT / geometry.plot.height) * total,
    };
    // Local writes until the release: the intermediate weights repaint the
    // canvas but never reach the document, so the whole drag is ONE undo step.
    this.model.stash('lanes');
  }

  private _onDragMove(e: PointerEventState): void {
    const drag = this._drag;
    if (!drag) return;

    // The travel SINCE the drag started, in view pixels (`e.delta` is the step
    // since the last move, which is not the same thing), converted to model
    // units. Always recomputed from the FROZEN pair rather than nudged: a nudge
    // would accumulate the clamp and drift away from the pointer.
    const dy = (e.y - e.start.y) / (this.gfx.viewport.zoom || 1);
    const perUnit = drag.total / drag.plotHeight;

    const above = drag.lanes[drag.index - 1];
    const below = drag.lanes[drag.index];
    const pair = above.size + below.size;

    // The pair's total is invariant: the separator takes from one and gives to
    // the other, so no lane the user is not touching changes size.
    const wanted = above.size + dy * perUnit;
    const floor = Math.min(drag.minWeight, pair / 2);
    const nextAbove = Math.max(floor, Math.min(pair - floor, wanted));

    const next = drag.lanes.map((lane, i) =>
      i === drag.index - 1
        ? { ...lane, size: nextAbove }
        : i === drag.index
          ? { ...lane, size: pair - nextAbove }
          : lane
    );
    this.model.lanes = next;
  }

  private _onDragEnd(): void {
    const drag = this._drag;
    this._drag = null;
    if (!drag) return;

    // Before the commit, not after: `pop` writes straight into the Y.Map, and
    // without a boundary here a separator moved within half a second of the
    // previous edit would be undone together with it.
    this.gfx.std.store.captureSync();
    this.model.pop('lanes');
    this._disarm();
  }

  /* ── In-place naming ───────────────────────────────────────────────── */

  private _onDblClick(e: PointerEventState): void {
    if (!this._editable) return;

    const laneIndex = this._nameBoxAt(this._localPoint(e));
    if (laneIndex !== null) {
      const lane = bpmnLanesOf(this.model)[laneIndex];
      this._openEditor(e, lane?.name ?? '', value =>
        renameBpmnLane(this.gfx.std, this.model, laneIndex, value)
      );
      return;
    }

    this._openEditor(e, String(this.model.name ?? ''), value => {
      this.gfx.std.store.captureSync();
      this.gfx.std
        .get(EdgelessCRUDIdentifier)
        .updateElement(this.model.id, { name: value });
    });
  }

  private _openEditor(
    e: PointerEventState,
    initial: string,
    commit: (value: string) => void
  ): void {
    this._closeEditor();

    const input = document.createElement('input');
    input.value = initial;
    Object.assign(input.style, {
      position: 'fixed',
      left: `${e.raw.clientX}px`,
      top: `${e.raw.clientY}px`,
      transform: 'translate(-50%, -50%)',
      zIndex: '10000',
      minWidth: '140px',
      padding: '3px 8px',
      font: '14px Inter, sans-serif',
      color: 'var(--affine-text-primary-color, #1f2328)',
      background: 'var(--affine-background-overlay-panel-color, #ffffff)',
      border: '1px solid var(--affine-primary-color, #1e96eb)',
      borderRadius: '6px',
      boxShadow: 'var(--affine-shadow-2, 0 2px 8px rgba(0,0,0,0.18))',
      outline: 'none',
    });
    document.body.append(input);
    this._nameEditor = input;

    // Mark "editing" so the global edgeless key handlers (delete, escape, …)
    // don't act on the pool while the user types.
    this.gfx.selection.set({ elements: [this.model.id], editing: true });

    input.focus();
    input.select();

    const onCommit = () => {
      if (this._nameEditor !== input) return;
      const value = input.value;
      this._closeEditor();
      commit(value);
    };

    input.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter') {
        ev.preventDefault();
        onCommit();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        this._closeEditor();
      }
    });
    input.addEventListener('blur', onCommit);
  }

  private _closeEditor(): void {
    if (!this._nameEditor) return;
    const input = this._nameEditor;
    this._nameEditor = null;
    input.remove();
    if (this.isConnected) {
      this.gfx.selection.set({ elements: [this.model.id], editing: false });
    }
  }
}
