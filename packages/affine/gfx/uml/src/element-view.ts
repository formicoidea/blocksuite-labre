import type {
  BackgroundLabelHit,
  FrameworkBackgroundDef,
} from '@labre/affine-block-surface';
import {
  backgroundLabelHits,
  EdgelessCRUDIdentifier,
  hitTestBackgroundLabel,
} from '@labre/affine-block-surface';
import type {
  UmlDiagramElementModel,
  UmlPartitionElementModel,
  UmlRegionElementModel,
  UmlSubjectElementModel,
} from '@labre/affine-model';
import { TranslationProvider } from '@labre/affine-shared/services';
import { rotatePoint } from '@labre/global/gfx';
import type { EditorHost, PointerEventState } from '@labre/std';
import type { PointTestOptions } from '@labre/std/gfx';
import { GfxElementModelView } from '@labre/std/gfx';

import {
  UML_DIAGRAM_FRAME,
  UML_REGION_FRAME,
  UML_SUBJECT_FRAME,
  umlPartitionFrame,
} from './background.js';
import {
  umlInDiagramBand,
  umlInPartitionBand,
  umlInRegionBand,
} from './board-hit.js';

/**
 * The one gesture every UML frame carries: a double-click on the name edits it
 * in place.
 *
 * All four are a rectangle with exactly one editable word on them — the
 * diagram's name, the subject's, the partition's, the composite state's — so the
 * gesture is written once here and the views differ only in which declaration
 * they hit-test against and how wide their rename zone is. The simplified version of `C4FrameView`, which is
 * itself the simplified `BpmnPoolView`: no lanes, no separators, no armed drag.
 *
 * Which labels exist, where they sit and what they SAY all come from the
 * declaration the renderer paints (`backgroundLabelHits`), so a label can never
 * be drawn in one place and clicked in another — which is why this class has no
 * coordinates of its own.
 *
 * ponytail: like every other framework view in the library, only `name` may be
 * written — see {@link UmlFrameView._editable} for what that costs the diagram
 * frame, whose drawn label is not `name`.
 */
abstract class UmlFrameView<
  T extends
    | UmlDiagramElementModel
    | UmlSubjectElementModel
    | UmlPartitionElementModel
    | UmlRegionElementModel,
> extends GfxElementModelView<T> {
  /** The declaration this view hit-tests against — the one the renderer paints. */
  protected abstract get def(): FrameworkBackgroundDef;

  /** The in-place `<input>` used to edit the name, or null when idle. */
  private _editor: HTMLInputElement | null = null;

  override onCreated(): void {
    super.onCreated();
    this.on('dblclick', e => this._onDblClick(e));
  }

  override onDestroyed(): void {
    this._closeEditor();
    super.onDestroyed();
  }

  /**
   * The words the editor must OPEN on, for a label the user has aimed at.
   *
   * The drawn words by default, which is the rule everywhere else in the
   * library: a label showing its declared wording opens on that wording rather
   * than on an empty box.
   *
   * The DIAGRAM frame overrides it, and that is the one place UML parts company
   * with the C4 board it is modelled on. Annex A's heading is `<kind> <name>` —
   * a derived string, joined from a closed discriminant the picker owns and a
   * name the author owns — so opening on the drawn words would hand the user
   * `class Orders` to edit, and committing it would write the kind INTO the
   * name, to be prefixed again on the next paint.
   */
  protected _editable(hit: BackgroundLabelHit): string {
    return hit.text;
  }

  /** The editable name label under a MODEL-space point, or null. */
  private _labelAt(mx: number, my: number) {
    const [bx, by, w, h] = this.model.deserializedXYWH;

    // Element-local coordinates, undoing the element rotation about its centre.
    let lx = mx - bx;
    let ly = my - by;
    const rot = this.model.rotate ?? 0;
    if (rot) {
      const center: [number, number] = [bx + w / 2, by + h / 2];
      const [ux, uy] = rotatePoint([mx, my], center, -rot);
      lx = ux - bx;
      ly = uy - by;
    }

    const hits = backgroundLabelHits(
      this.def,
      this.model as unknown as Record<string, unknown>,
      w,
      h,
      this.gfx.std.getOptional(TranslationProvider)
    );
    return this._nameAt(hits, lx, ly);
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
  protected _nameAt(
    hits: readonly BackgroundLabelHit[],
    lx: number,
    ly: number
  ): BackgroundLabelHit | null {
    const hit = hitTestBackgroundLabel(hits, lx, ly);
    return hit && hit.prop === 'name' ? hit : null;
  }

  /**
   * A frame is SELECTED by its border (`FrameworkBackgroundElementModel`, issue
   * #194) — but the name written on it must still receive the double-click that
   * renames it.
   *
   * Same seam Wardley, C4 and EDGY use: the pointer router asks the VIEW,
   * picking asks the MODEL, and a framework declares its own gesture zones
   * beside the code that draws them.
   *
   * The DIAGRAM's band is in both answers — the model picks it and this widens
   * nothing over it — so on that frame the fallback below only ever fires for a
   * point the model already took. It is the SUBJECT that needs it: its name is
   * written inside the plot, where nothing is selectable.
   */
  override includesPoint(
    x: number,
    y: number,
    options: PointTestOptions,
    host: EditorHost
  ): boolean {
    if (super.includesPoint(x, y, options, host)) return true;
    return this._labelAt(x, y) !== null;
  }

  private _onDblClick(e: PointerEventState): void {
    if (this.gfx.std.store.readonly || this.model.isLocked()) return;

    const [mx, my] = this.gfx.viewport.toModelCoord(e.x, e.y);
    const hit = this._labelAt(mx, my);
    if (!hit) return;

    this._openEditor(this._editable(hit), e);
  }

  /**
   * @param current the words the editor opens on — see {@link _editable}. Always
   * the author's own half of the label, never the notation's.
   */
  private _openEditor(current: string, e: PointerEventState): void {
    this._closeEditor();

    const input = document.createElement('input');
    input.value = current;
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
    this._editor = input;

    // Mark "editing" so the global edgeless key handlers (delete, escape, …)
    // don't act on the frame while the user types.
    this.gfx.selection.set({ elements: [this.model.id], editing: true });

    input.focus();
    input.select();

    const commit = () => {
      // Guard against re-entrancy: removing the input fires `blur`, which would
      // otherwise call `commit` a second time.
      if (this._editor !== input) return;
      const value = input.value;
      this._closeEditor();
      // Opening an editor is not renaming: an untouched value would push an
      // empty entry onto undo and freeze the drawn wording as the user's own.
      if (value === current) return;
      this.gfx.std.store.captureSync();
      // `name` and never the drawn label's own prop: the diagram frame paints a
      // DERIVED heading, and a getter is not somewhere a rename can land.
      this.gfx.std
        .get(EdgelessCRUDIdentifier)
        .updateElement(this.model.id, { name: value });
    };

    input.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter') {
        ev.preventDefault();
        commit();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        this._closeEditor();
      }
    });
    input.addEventListener('blur', commit);
  }

  private _closeEditor(): void {
    if (!this._editor) return;
    const input = this._editor;
    this._editor = null;
    input.remove();
    if (this.isConnected) {
      this.gfx.selection.set({ elements: [this.model.id], editing: false });
    }
  }
}

/**
 * The sheet a UML diagram is drawn on. Double-click ANYWHERE in its heading band
 * to rename it.
 *
 * The band and not the words, which is the whole of what this subclass changes —
 * the same call the C4 board and the BPMN pool's participant band both make: a
 * strip you may only double-click the eleven characters of is a target that lies
 * about where it is. Here it also buys something they do not need: the tag is
 * drawn round the words with padding on either side, so a user aiming at the
 * pentagon they can see is inside the zone whether or not they hit a glyph.
 *
 * The editor opens on `name` — the author's half of `<kind> <name>` — and the
 * commit writes `name` back. The kind is the picker's, and it is prefixed again
 * on the next paint.
 */
export class UmlDiagramView extends UmlFrameView<UmlDiagramElementModel> {
  static override type: string = 'umlDiagram';

  protected override get def(): FrameworkBackgroundDef {
    return UML_DIAGRAM_FRAME;
  }

  protected override _nameAt(
    hits: readonly BackgroundLabelHit[],
    lx: number,
    ly: number
  ): BackgroundLabelHit | null {
    const heading = hits.find(hit => hit.prop === 'heading');
    if (!heading) return null;
    return umlInDiagramBand(this.model, [lx, ly]) ? heading : null;
  }

  /** The author's half of the heading — see {@link UmlFrameView._editable}. */
  protected override _editable(): string {
    return this.model.name;
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

  protected override _nameAt(
    hits: readonly BackgroundLabelHit[],
    lx: number,
    ly: number
  ): BackgroundLabelHit | null {
    const name = hits.find(hit => hit.prop === 'name');
    if (!name) return null;
    return umlInPartitionBand(this.model, [lx, ly]) ? name : null;
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

  protected override _nameAt(
    hits: readonly BackgroundLabelHit[],
    lx: number,
    ly: number
  ): BackgroundLabelHit | null {
    const name = hits.find(hit => hit.prop === 'name');
    if (!name) return null;
    return umlInRegionBand(this.model, [lx, ly]) ? name : null;
  }
}
