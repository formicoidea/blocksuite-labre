import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import type { BpmnLane, BpmnPoolElementModel } from '@labre/affine-model';
import type { PointerEventState } from '@labre/std';
import { GfxElementModelView } from '@labre/std/gfx';

import { bpmnLanesOf, renameBpmnLane } from './actions.js';
import { POOL_LANE_MIN_HEIGHT } from './consts.js';
import {
  bpmnLaneBoundaryAt,
  bpmnPoolBands,
  bpmnPoolTargetAt,
} from './pool-hit.js';

/**
 * View for a BPMN pool. Three direct gestures live here:
 *
 * - **dblclick in the pool's own title band** — the left margin strip the
 *   participant name is written up — edits that name in place;
 * - **dblclick in a lane's title band** edits THAT lane's name instead. A lane
 *   name is not in the declaration's hit-test walk (`backgroundLabelHits`,
 *   which Wardley uses): it is a function of the MODEL, not of the declaration,
 *   so the box comes from `backgroundInstanceZoneBand` — the very rectangle the
 *   renderer paints the name in, rather than a second set of metrics that would
 *   one day disagree with it;
 * - **drag on an internal lane boundary** moves the separator, taking from one
 *   lane and giving to the other.
 *
 * Both renames are ZONED to their band (PO recette, 2026-08-26). The whole pool
 * used to open the participant editor, which was right while a pool had one
 * name; with a name per lane it would mean a double-click in the middle of the
 * flow area renames the participant — neither of the two things the user could
 * have meant, and the kind of write nobody notices until it is in a
 * deliverable. A double-click on open canvas inside the pool now does nothing,
 * and the `text` cursor over either band is what says where the names are.
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
    this.on('pointermove', e => this._updateHover(e));
    this.on('pointerdown', e => this._updateHover(e));
    this.on('pointerleave', () => this._leave());
  }

  override onDestroyed(): void {
    this._closeEditor();
    this._leave();
    super.onDestroyed();
  }

  /** Hand the cursor back on the way out; nothing here owns it for long. */
  private _leave(): void {
    this._disarm();
    if (!this._drag) this.gfx.cursor$.value = 'default';
  }

  /* ── Lane geometry ─────────────────────────────────────────────────── */

  /** The pointer, in element-local model units. */
  private _localPoint(e: PointerEventState): [number, number] {
    const [mx, my] = this.gfx.viewport.toModelCoord(e.x, e.y);
    const [ex, ey] = this.model.deserializedXYWH;
    return [mx - ex, my - ey];
  }

  /**
   * The boxes the gestures below aim at, all of them delegated to `pool-hit.ts`.
   *
   * That module is pure, so every answer here can be asserted without an
   * editor, a viewport or a canvas; and it derives each box from
   * `backgroundInstanceZones` / `backgroundInstanceZoneBand`, the same two
   * functions the renderer paints from and the audit reports from. The view
   * supplies the pointer and the zoom and nothing else.
   */
  private _bands() {
    return bpmnPoolBands(this.model);
  }

  private _boundaryAt(local: readonly [number, number]): number | null {
    return bpmnLaneBoundaryAt(this.model, local);
  }

  /** Which name this point aims at, if any — lane strip first, see `pool-hit`. */
  private _targetAt(local: readonly [number, number]) {
    return bpmnPoolTargetAt(this.model, local, this.gfx.viewport.zoom);
  }

  private get _editable(): boolean {
    return !this.gfx.std.store.readonly && !this.model.isLocked();
  }

  /* ── Hover: what this point would do ───────────────────────────────── */

  /**
   * One pass over the pointer, deciding both the cursor and whether a
   * separator drag is armed.
   *
   * The order is the order the gestures win in. A separator sits INSIDE a lane
   * title band at every lane boundary, so the two overlap and something has to
   * give: the separator takes it, because it is a twelve-unit strip the user
   * has to aim at deliberately, while the title band is the whole leading edge
   * and has plenty left over. It is also already gated on the pool being
   * selected, so on an unselected pool the band wins uncontested.
   */
  private _updateHover(e: PointerEventState): void {
    const local = this._localPoint(e);
    const selected = this.gfx.selection.selectedIds.includes(this.model.id);

    if (this._editable && selected) {
      const index = this._boundaryAt(local);
      if (index !== null) {
        // Reasserted on every move rather than only on arrival: the cursor is a
        // signal shared with the resize handles and the tools, and whoever set
        // it last wins — so the one that is still true says so again.
        this.gfx.cursor$.value = 'ns-resize';
        if (this._armed?.index !== index) {
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
        return;
      }
    }
    this._disarm();

    // A title band announces itself, selected or not: finding out that a name
    // can be changed should not cost a click first. Gated on `_editable` all
    // the same — an I-beam over a locked pool would promise an editor that
    // refuses to open, which is the sort of small lie the recette is against.
    const overTitle = this._editable && this._targetAt(local) !== null;
    this.gfx.cursor$.value = overTitle ? 'text' : 'default';
  }

  private _disarm(): void {
    // Never mid-gesture: the pointer leaves the boundary as soon as the drag
    // starts moving, and disarming there would drop the drag on its first step.
    if (this._drag) return;
    if (!this._armed) return;
    this._armed.disposers.forEach(dispose => dispose());
    this._armed = null;
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

  /**
   * A double-click renames whatever TITLE BAND it landed in, and nothing
   * otherwise (PO recette, 2026-08-26).
   *
   * The whole pool used to open the participant editor. That was right while a
   * pool had one name; now that every lane carries one it would mean a
   * double-click in the middle of the flow area renames the participant — not
   * one of the things the user could have meant, and the kind of write nobody
   * notices until it is in a deliverable. A double-click on open canvas inside
   * the pool now does nothing, which is the honest answer.
   */
  private _onDblClick(e: PointerEventState): void {
    if (!this._editable) return;

    const target = this._targetAt(this._localPoint(e));
    if (target === null) return;

    if (target.kind === 'lane') {
      const { index } = target;
      const lane = bpmnLanesOf(this.model)[index];
      this._openEditor(e, lane?.name ?? '', value =>
        renameBpmnLane(this.gfx.std, this.model, index, value)
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
