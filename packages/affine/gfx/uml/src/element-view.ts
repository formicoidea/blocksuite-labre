import type {
  BackgroundLabelHit,
  EditableBackgroundLabel,
  FrameworkBackgroundDef,
} from '@labre/affine-block-surface';
import {
  backgroundLabelHits,
  DeclaredBackgroundView,
  EdgelessCRUDIdentifier,
  hitTestBackgroundLabel,
} from '@labre/affine-block-surface';
import type {
  UmlDiagramElementModel,
  UmlFragmentElementModel,
  UmlFragmentOperand,
  UmlPartitionElementModel,
  UmlRegionElementModel,
  UmlSubjectElementModel,
} from '@labre/affine-model';
import { TranslationProvider } from '@labre/affine-shared/services';
import type { EditorHost, PointerEventState } from '@labre/std';
import type { PointTestOptions } from '@labre/std/gfx';

import {
  UML_DIAGRAM_FRAME,
  UML_FRAGMENT_FRAME,
  UML_REGION_FRAME,
  UML_SUBJECT_FRAME,
  umlPartitionFrame,
} from './background.js';
import {
  umlFragmentOperands,
  umlInDiagramBand,
  umlInPartitionBand,
  umlInRegionBand,
  umlOperandBoundaryAt,
  umlOperandGuardAt,
} from './board-hit.js';
import { UML_OPERAND_MIN_HEIGHT } from './consts.js';
import { umlFragmentAsPainted } from './element-renderer.js';

/**
 * The one gesture every UML frame carries: a double-click on the name edits it
 * in place.
 *
 * The gesture itself — the rotation arithmetic, the widened `includesPoint`,
 * the double-click handler and the `<input>` — is the library's shared one,
 * `DeclaredBackgroundView` (issue #355, R14: extend, never copy). What this
 * class adds is only what UML answers differently: WHICH words a double-click
 * aims at, and the model those words are read from.
 *
 * Which labels exist, where they sit and what they SAY all come from the
 * declaration the renderer paints (`backgroundLabelHits`), so a label can never
 * be drawn in one place and clicked in another — which is why this class has no
 * coordinates of its own.
 *
 * ponytail: like every other framework view in the library, only `name` may be
 * written — see {@link UmlDiagramView} for what that costs the diagram frame,
 * whose drawn label is not `name`.
 */
abstract class UmlFrameView<
  T extends
    | UmlDiagramElementModel
    | UmlSubjectElementModel
    | UmlPartitionElementModel
    | UmlRegionElementModel
    | UmlFragmentElementModel,
> extends DeclaredBackgroundView<T> {
  /**
   * The model this view hit-tests against — the one the RENDERER was handed.
   *
   * The stored model for every frame but one, and the hook exists for that one:
   * a combined fragment paints through `umlFragmentAsPainted`, which hides a
   * declared `name` that operand zero's guard already covers. The boxes
   * `backgroundLabelHits` derives are only the drawn words if they are derived
   * from the same declaration — otherwise the suppressed corner stays clickable
   * and opens an editor on a string nothing paints.
   *
   * A getter and not a cached value: the props it reads are the document's, and
   * a view outlives every edit to them.
   */
  protected get _painted(): T {
    return this.model;
  }

  /**
   * The declaration's editable labels, element-local, derived from the PAINTED
   * model — see {@link _painted}. This is `DeclaredBackgroundView.labelAt`'s
   * own walk with that one substitution, which is why the frames below do not
   * call `super.labelAt`.
   */
  protected _hits(w: number, h: number): BackgroundLabelHit[] {
    return backgroundLabelHits(
      this.def,
      this._painted as unknown as Record<string, unknown>,
      w,
      h,
      this.gfx.std.getOptional(TranslationProvider)
    );
  }

  /**
   * Which region of the frame aims at the name, given an ELEMENT-LOCAL point.
   *
   * The DRAWN WORDS by default — the box `backgroundLabelHits` derives from the
   * very anchor the renderer paints at. That is the right answer for a name
   * written INSIDE the plot, over the drawing, where anything wider would
   * swallow clicks meant for the elements around it: the subject's name sits in
   * its top-left corner, and this is its whole story.
   *
   * A frame whose name has a band of its own overrides this — see
   * {@link UmlDiagramView}.
   */
  protected override labelAt(
    lx: number,
    ly: number,
    w: number,
    h: number
  ): EditableBackgroundLabel | null {
    const hit = hitTestBackgroundLabel(this._hits(w, h), lx, ly);
    return hit && hit.prop === 'name' ? { prop: 'name', text: hit.text } : null;
  }

  /**
   * The name label, answered over a whole BAND rather than over its words —
   * for the frames whose name has a strip of its own.
   *
   * @param inBand whether the point is in the frame's band, as the frame's own
   * band helper (`board-hit.ts`) decides.
   */
  protected _nameInBand(
    inBand: boolean,
    w: number,
    h: number
  ): EditableBackgroundLabel | null {
    if (!inBand) return null;
    const name = this._hits(w, h).find(hit => hit.prop === 'name');
    return name ? { prop: 'name', text: name.text } : null;
  }
}

/**
 * The sheet a UML diagram is drawn on. Double-click ANYWHERE in its heading band
 * to rename it.
 *
 * The band and not the words, which is the first thing this subclass changes —
 * the same call the C4 board and the BPMN pool's participant band both make: a
 * strip you may only double-click the eleven characters of is a target that lies
 * about where it is. Here it also buys something they do not need: the tag is
 * drawn round the words with padding on either side, so a user aiming at the
 * pentagon they can see is inside the zone whether or not they hit a glyph.
 *
 * The second is what the editor opens on, and that is the one place UML parts
 * company with the C4 board it is modelled on. Annex A's heading is
 * `<kind> <name>` — a derived string, joined from a closed discriminant the
 * picker owns and a name the author owns — so opening on the drawn words would
 * hand the user `class Orders` to edit, and committing it would write the kind
 * INTO the name, to be prefixed again on the next paint. The editor therefore
 * opens on `name` — the author's half — and writes `name` back, never the drawn
 * label's own prop: `heading` is a getter, and a getter is not somewhere a
 * rename can land.
 */
export class UmlDiagramView extends UmlFrameView<UmlDiagramElementModel> {
  static override type: string = 'umlDiagram';

  protected override get def(): FrameworkBackgroundDef {
    return UML_DIAGRAM_FRAME;
  }

  protected override labelAt(
    lx: number,
    ly: number,
    w: number,
    h: number
  ): EditableBackgroundLabel | null {
    if (!umlInDiagramBand(this.model, [lx, ly])) return null;
    const heading = this._hits(w, h).some(hit => hit.prop === 'heading');
    return heading ? { prop: 'name', text: this.model.name } : null;
  }
}

/** The rectangle drawn round a system's use cases. Double-click its name. */
export class UmlSubjectView extends UmlFrameView<UmlSubjectElementModel> {
  static override type: string = 'umlSubject';

  protected override get def(): FrameworkBackgroundDef {
    return UML_SUBJECT_FRAME;
  }
}

/**
 * An activity swimlane (§15.6.4). Double-click ANYWHERE in its name band to
 * rename it — across the top of a vertical lane, down the left edge of a
 * horizontal one.
 *
 * The band and not the words, the same call the diagram frame makes: a strip you
 * may only double-click the eight characters of is a target that lies about
 * where it is. It matters more here than on the sheet, because a partition is
 * TRANSPARENT: every point that is not its own furniture falls through to the
 * actions drawn inside it, so the header is the only place a user can take hold
 * of the lane at all.
 *
 * The declaration this hit-tests against is chosen by the element's own
 * `orientation`, through the one function that makes that choice — so the view,
 * the renderer and the band helper cannot disagree about which edge the band is
 * on.
 */
export class UmlPartitionView extends UmlFrameView<UmlPartitionElementModel> {
  static override type: string = 'umlPartition';

  protected override get def(): FrameworkBackgroundDef {
    return umlPartitionFrame(this.model);
  }

  protected override labelAt(
    lx: number,
    ly: number,
    w: number,
    h: number
  ): EditableBackgroundLabel | null {
    return this._nameInBand(umlInPartitionBand(this.model, [lx, ly]), w, h);
  }
}

/**
 * A composite state (§14.2.4). Double-click anywhere in its name band to rename
 * it.
 *
 * The partition's story with no orientation to turn: the band is across the top,
 * always, because that is where §14.2.4 writes a state's name.
 */
export class UmlRegionView extends UmlFrameView<UmlRegionElementModel> {
  static override type: string = 'umlRegion';

  protected override get def(): FrameworkBackgroundDef {
    return UML_REGION_FRAME;
  }

  protected override labelAt(
    lx: number,
    ly: number,
    w: number,
    h: number
  ): EditableBackgroundLabel | null {
    return this._nameInBand(umlInRegionBand(this.model, [lx, ly]), w, h);
  }
}

/**
 * A COMBINED FRAGMENT (§17.6.4). Two gestures of its own, on top of the rename
 * every UML frame carries:
 *
 * - **dblclick on a GUARD** — the `[condition]` written in an operand's
 *   top-left corner — edits that guard in place. On an unsplit fragment there
 *   is one, and it is the element's own `name`; once the box has been cut into
 *   operands each of them carries its own, in `operands[i].name`;
 * - **drag on an internal operand SEPARATOR** moves the dashed line, taking
 *   from one operand and giving to the other.
 *
 * ## The operator is NOT renamed here
 *
 * Double-clicking the pentagon does nothing, deliberately. `operator` is a
 * closed discriminant of thirteen values (§17.6.4 plus §17.7.4's `ref`) and it
 * is picked from the toolbar; a free-text editor over it would let an author
 * type `altt` and lose every rule, every reading and every export that keys on
 * the word. The same call the diagram frame's `kind` already makes.
 *
 * ## How the separator drag takes the gesture
 *
 * Armed, exactly as `BpmnPoolView`'s is and for the reason stated there:
 * `GfxElementModelView.dispatch` reports a drag as handled whenever a handler
 * is REGISTERED, so a permanent `dragstart` would make the fragment
 * undraggable. The handlers are attached while the pointer is over a separator
 * of a SELECTED fragment and detached the moment it is not.
 *
 * ponytail: a ROTATED fragment is not accounted for by the separator drag —
 * its pointer is converted to element-local coordinates by subtraction, so the
 * separator boxes assume an upright frame (the guards do not: the shared base
 * de-rotates before {@link labelAt}). The same reserve `board-hit.ts`
 * documents; nothing rotates a framework background today.
 */
export class UmlFragmentView extends UmlFrameView<UmlFragmentElementModel> {
  static override type: string = 'umlFragment';

  /** The separator the pointer is over, and the handlers armed for it. */
  private _armed: { index: number; disposers: (() => void)[] } | null = null;

  /** Everything a separator drag needs, frozen at `dragstart`. */
  private _drag: {
    index: number;
    operands: readonly UmlFragmentOperand[];
    /** Sum of the weights — the constant the two neighbours share. */
    total: number;
    /** Plot height in model units, i.e. what one unit of weight is worth. */
    plotHeight: number;
    /** Floor, already expressed as a weight. */
    minWeight: number;
  } | null = null;

  protected override get def(): FrameworkBackgroundDef {
    return UML_FRAGMENT_FRAME;
  }

  /**
   * The suppression the renderer applies, read back here so the rename boxes
   * are the drawn words and nothing else.
   *
   * On a SPLIT fragment written by an older build the stored model carries both
   * `name` and `operands`, and the canvas paints operand zero's guard over the
   * declared one's corner — i.e. paints `name` nowhere. `umlFragmentAsPainted`
   * is the single statement of which of the two wins; calling it here is what
   * keeps {@link labelAt}'s fallback from opening an editor on the invisible
   * corner. The operand branch of that method is unaffected: it reads
   * `operands`, which the suppression never touches.
   */
  protected override get _painted(): UmlFragmentElementModel {
    return umlFragmentAsPainted(this.model);
  }

  override onCreated(): void {
    super.onCreated();
    this.on('pointermove', e => this._updateHover(e));
    this.on('pointerdown', e => this._updateHover(e));
    this.on('pointerleave', () => this._leave());
  }

  override onDestroyed(): void {
    this._leave();
    super.onDestroyed();
  }

  /* ── The rename targets ────────────────────────────────────────────── */

  /**
   * The operand guards first, the declaration's own label second.
   *
   * The order is the order the gestures win in, and it only matters on a SPLIT
   * fragment: the first operand's corner is the very corner the declared
   * `guard` label is anchored in. The operand takes it, because on a split
   * fragment the guards live in `operands` and `name` has been moved into the
   * first of them (`background.ts` states the contract) — handing the
   * double-click to `name` would open an editor on a string nothing paints.
   */
  protected override labelAt(
    lx: number,
    ly: number,
    w: number,
    h: number
  ): EditableBackgroundLabel | null {
    const index = umlOperandGuardAt(this.model, [lx, ly]);
    if (index !== null) {
      const operand = this._operands()[index];
      if (operand) {
        // A guard lives INSIDE `operands`, which no `{ [prop]: value }` patch
        // can reach — hence the label's own `commit`, the base's one write
        // hook. `prop` names the prop the hook rewrites; the base never writes
        // it itself.
        return {
          prop: 'operands',
          text: operand.name ?? '',
          commit: value => this._writeGuard(index, value),
        };
      }
    }
    return super.labelAt(lx, ly, w, h);
  }

  private _operands(): readonly UmlFragmentOperand[] {
    const stored = this.model.operands;
    return Array.isArray(stored) ? stored : [];
  }

  /**
   * Write one operand's guard, dropping the key entirely when it is cleared.
   *
   * The same shape `renameBpmnLane` writes: an absent `name` is an unguarded
   * operand — which is what an `else` branch with no condition is — and an
   * empty string left in the array would be a key that means nothing and
   * paints nothing.
   *
   * No undo boundary here: the shared editor captures one before it calls a
   * label's `commit`.
   */
  private _writeGuard(index: number, value: string): void {
    const operands = this._operands();
    const operand = operands[index];
    if (!operand) return;

    const trimmed = value.trim();
    if ((operand.name ?? '') === trimmed) return;

    const next = operands.map((entry, i) =>
      i === index
        ? {
            id: entry.id,
            ...(trimmed ? { name: trimmed } : {}),
            size: entry.size,
          }
        : entry
    );
    this.gfx.std
      .get(EdgelessCRUDIdentifier)
      .updateElement(this.model.id, { operands: next });
  }

  /* ── The separator drag ────────────────────────────────────────────── */

  /**
   * A fragment is SELECTED by its border and its operator band — but the
   * internal operand separators are twelve-unit strips in the middle of the
   * plot, and they must still receive their pointer events.
   *
   * Not a selection zone: a click between two messages still goes to whatever
   * is under it, because picking asks the MODEL. This only decides where the
   * fragment's own gestures are heard.
   */
  override includesPoint(
    x: number,
    y: number,
    options: PointTestOptions,
    host: EditorHost
  ): boolean {
    if (super.includesPoint(x, y, options, host)) return true;
    const [ex, ey] = this.model.deserializedXYWH;
    return umlOperandBoundaryAt(this.model, [x - ex, y - ey]) !== null;
  }

  /** Whether this fragment may be written to at all. */
  private get _writable(): boolean {
    return !this.gfx.std.store.readonly && !this.model.isLocked();
  }

  private _leave(): void {
    this._disarm();
    if (!this._drag) this.gfx.cursor$.value = 'default';
  }

  private _localPoint(e: PointerEventState): [number, number] {
    const [mx, my] = this.gfx.viewport.toModelCoord(e.x, e.y);
    const [ex, ey] = this.model.deserializedXYWH;
    return [mx - ex, my - ey];
  }

  /** One pass over the pointer: the cursor, and whether a drag is armed. */
  private _updateHover(e: PointerEventState): void {
    const local = this._localPoint(e);
    const selected = this.gfx.selection.selectedIds.includes(this.model.id);

    if (this._writable && selected) {
      const index = umlOperandBoundaryAt(this.model, local);
      if (index !== null) {
        // Reasserted on every move rather than only on arrival: the cursor is
        // shared with the resize handles and the tools, and whoever set it last
        // wins — so the one that is still true says so again.
        this.gfx.cursor$.value = 'ns-resize';
        if (this._armed?.index !== index) {
          this._disarm();
          this._armed = {
            index,
            disposers: [
              this.on('dragstart', () => this._onDragStart()),
              this.on('dragmove', evt => this._onDragMove(evt)),
              this.on('dragend', () => this._onDragEnd()),
            ],
          };
        }
        return;
      }
    }
    this._disarm();

    // A guard announces itself, selected or not: finding out that a condition
    // can be changed should not cost a click first.
    const overGuard =
      this._writable && umlOperandGuardAt(this.model, local) !== null;
    this.gfx.cursor$.value = overGuard ? 'text' : 'default';
  }

  private _disarm(): void {
    // Never mid-gesture: the pointer leaves the separator as soon as the drag
    // starts moving, and disarming there would drop it on its first step.
    if (this._drag) return;
    if (!this._armed) return;
    this._armed.disposers.forEach(dispose => dispose());
    this._armed = null;
  }

  private _onDragStart(): void {
    const index = this._armed?.index;
    const geometry = umlFragmentOperands(this.model);
    if (index === undefined || !geometry || !this._writable) return;

    const operands = this._operands();
    if (!operands[index - 1] || !operands[index]) return;

    const total = operands.reduce((sum, operand) => sum + operand.size, 0);
    if (!(total > 0)) return;

    this._drag = {
      index,
      operands: operands.map(operand => ({ ...operand })),
      total,
      plotHeight: geometry.plot.height,
      // The floor is a HEIGHT the user can see, stated in the model units of a
      // fragment at its reference height and converted to a weight against this
      // fragment's own total — so a fragment stretched to twice the height
      // keeps the same visible floor, which is the point of weights.
      minWeight: (UML_OPERAND_MIN_HEIGHT / geometry.plot.height) * total,
    };
    // Local writes until the release: the intermediate weights repaint the
    // canvas but never reach the document, so the whole drag is ONE undo step.
    this.model.stash('operands');
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

    const above = drag.operands[drag.index - 1];
    const below = drag.operands[drag.index];
    const pair = above.size + below.size;

    // The pair's total is invariant: the separator takes from one and gives to
    // the other, so no operand the user is not touching changes size.
    const wanted = above.size + dy * perUnit;
    const floor = Math.min(drag.minWeight, pair / 2);
    const nextAbove = Math.max(floor, Math.min(pair - floor, wanted));

    this.model.operands = drag.operands.map((operand, i) =>
      i === drag.index - 1
        ? { ...operand, size: nextAbove }
        : i === drag.index
          ? { ...operand, size: pair - nextAbove }
          : operand
    );
  }

  private _onDragEnd(): void {
    const drag = this._drag;
    this._drag = null;
    if (!drag) return;

    // Before the commit, not after: `pop` writes straight into the Y.Map, and
    // without a boundary here a separator moved within half a second of the
    // previous edit would be undone together with it.
    this.gfx.std.store.captureSync();
    this.model.pop('operands');
    this._disarm();
  }
}
