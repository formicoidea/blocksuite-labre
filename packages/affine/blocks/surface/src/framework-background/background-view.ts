import { TranslationProvider } from '@labre/affine-shared/services';
import { rotatePoint } from '@labre/global/gfx';
import type { EditorHost, PointerEventState } from '@labre/std';
import type {
  GfxPrimitiveElementModel,
  PointTestOptions,
} from '@labre/std/gfx';
import { GfxElementModelView } from '@labre/std/gfx';

import { EdgelessCRUDIdentifier } from '../extensions/crud-extension.js';
import type { FrameworkBackgroundDef } from './def.js';
import { backgroundLabelHits, hitTestBackgroundLabel } from './labels.js';

/** A label a double-click may rename: the prop to write, and the words shown. */
export interface EditableBackgroundLabel {
  /** The model prop the in-place editor writes back to. */
  prop: string;
  /**
   * The words currently DRAWN there.
   *
   * The editor opens on this, not on `model[prop]`: a label whose prop has
   * never been written shows its vocabulary, and opening an empty box on it
   * would silently offer to erase a name the user can see.
   */
  text: string;
  /**
   * Where the edited words go, when a flat `{ [prop]: value }` patch cannot say
   * it. Absent — the case for every label a declaration binds — the editor
   * writes `updateElement(id, { [prop]: value })`.
   *
   * The one label shape that needs it is a name kept INSIDE a structured prop:
   * a UML combined fragment's operand guard lives in `operands[i].name`, and
   * renaming it means rewriting that array (trimmed, the key dropped when
   * cleared), which no single-prop patch expresses. A write hook on the label
   * rather than on the view, because the target is a property of the label hit
   * — one view carries labels of both kinds.
   *
   * Called only for an ACTUAL change (the untouched-value rule below still
   * applies), after the editor has closed and after the undo boundary has been
   * captured: the hook writes, and nothing else.
   */
  commit?: (value: string) => void;
}

/**
 * The rename gesture every framework background shares: double-click a label,
 * type, Enter or click away.
 *
 * Written ONCE here, and that is the whole point of the file. The Wardley map
 * shipped it first, EDGY copied the half it needed, C4 and BPMN copied other
 * halves — and the three backgrounds that never got a copy (the Core Domain
 * Chart, the Event Storming board, Cynefin and Estuarine) simply had no way to
 * rename anything, which is how issue #355 was reported. R14 of
 * `docs/add-a-framework/02-framework-rules.md` — extend, never copy — applies
 * to a view's overrides exactly as it applies to a model's: seven copies of an
 * `<input>` is not a seam, it is six places for the next fix to miss.
 *
 * A subclass says only WHERE its labels are, through {@link labelAt}. Almost
 * every framework answers that from its declaration and should extend
 * {@link DeclaredBackgroundView} instead; a framework that paints its words by
 * hand (Cynefin, Estuarine — figurative reproductions of an official drawing,
 * with no `FrameworkBackgroundDef` behind them) extends this class and hit-tests
 * in its own reference space.
 *
 * UML's five frames were the last copy standing and now extend
 * {@link DeclaredBackgroundView} like the rest (2026-09-17); the combined
 * fragment's operand guards are why a label may carry its own
 * {@link EditableBackgroundLabel.commit}.
 */
export abstract class FrameworkBackgroundView<
  T extends GfxPrimitiveElementModel = GfxPrimitiveElementModel,
> extends GfxElementModelView<T> {
  /** The in-place `<input>` used to edit a label, or null when idle. */
  private _labelEditor: HTMLInputElement | null = null;

  override onCreated(): void {
    super.onCreated();
    this.on('dblclick', e => this._onDblClick(e));
  }

  override onDestroyed(): void {
    this._closeLabelEditor();
    super.onDestroyed();
  }

  /**
   * The editable label under an ELEMENT-LOCAL point, or null.
   *
   * `lx` / `ly` are already de-rotated and relative to the element's top-left
   * corner, and `w` / `h` are its current size: a subclass never repeats the
   * rotation arithmetic, which is precisely what four copies of it got wrong in
   * four slightly different ways.
   */
  protected abstract labelAt(
    lx: number,
    ly: number,
    w: number,
    h: number
  ): EditableBackgroundLabel | null;

  /**
   * A background is SELECTED by its border (`FrameworkBackgroundElementModel`,
   * issue #194) — but the words written on it must still receive the
   * double-click that renames them.
   *
   * So the two areas differ, and this is where they are allowed to: the pointer
   * router asks the VIEW (`GfxViewEventManager`), and the view adds the zones
   * its labels are drawn in. Picking is unaffected — `getElementByPoint` still
   * asks the model, so a click in the middle of the frame still goes to
   * whatever the user put there.
   */
  override includesPoint(
    x: number,
    y: number,
    options: PointTestOptions,
    host: EditorHost
  ): boolean {
    if (super.includesPoint(x, y, options, host)) return true;
    return this._labelAtModelPoint(x, y) !== null;
  }

  /** The editable label under a MODEL-space point, or null. */
  private _labelAtModelPoint(
    mx: number,
    my: number
  ): EditableBackgroundLabel | null {
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

    return this.labelAt(lx, ly, w, h);
  }

  /** Double-click on a label → edit its text in place. */
  private _onDblClick(e: PointerEventState): void {
    if (this.gfx.std.store.readonly || this.model.isLocked()) return;

    const [mx, my] = this.gfx.viewport.toModelCoord(e.x, e.y);
    const hit = this._labelAtModelPoint(mx, my);
    if (!hit) return;

    this._openLabelEditor(hit, e);
  }

  /**
   * @param label the label aimed at. The editor opens on `label.text`, the
   * words currently DRAWN — which is the vocabulary, not `model[prop]`, for a
   * label the user has never renamed. Opening on the raw prop would show an
   * empty box for a label that plainly reads "Evolution".
   */
  private _openLabelEditor(
    label: EditableBackgroundLabel,
    e: PointerEventState
  ): void {
    this._closeLabelEditor();
    const current = label.text;

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
      border: '1px solid var(--affine-primary-color)',
      borderRadius: '6px',
      boxShadow: 'var(--affine-shadow-2, 0 2px 8px rgba(0,0,0,0.18))',
      outline: 'none',
    });
    document.body.append(input);
    this._labelEditor = input;

    // Mark the element as "editing" so the global edgeless key handlers
    // (delete, escape, etc.) don't act on it while the user types.
    this.gfx.selection.set({ elements: [this.model.id], editing: true });

    input.focus();
    input.select();

    const commit = () => {
      // Guard against re-entrancy: removing the input fires `blur` — Chrome
      // fires it SYNCHRONOUSLY inside `remove()` — which would otherwise call
      // `commit` a second time. `_closeLabelEditor` clears the field before it
      // removes the node, so that nested call finds it gone and returns.
      if (this._labelEditor !== input) return;
      const value = input.value;
      this._closeLabelEditor();
      // Opening an editor is not renaming. Writing back an untouched value
      // would persist the resolved VOCABULARY as the user's own text, freezing
      // the label in whatever language it was read in and putting it beyond
      // any catalogue for good — and it would push an empty entry onto undo.
      if (value === current) return;
      this.gfx.std.store.captureSync();
      if (label.commit) {
        label.commit(value);
        return;
      }
      this.gfx.std
        .get(EdgelessCRUDIdentifier)
        .updateElement(this.model.id, { [label.prop]: value });
    };

    input.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter') {
        ev.preventDefault();
        commit();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        this._closeLabelEditor();
      }
    });
    input.addEventListener('blur', commit);
  }

  private _closeLabelEditor(): void {
    if (!this._labelEditor) return;
    const input = this._labelEditor;
    this._labelEditor = null;
    input.remove();
    if (this.isConnected) {
      this.gfx.selection.set({ elements: [this.model.id], editing: false });
    }
  }
}

/**
 * The same gesture, aimed by the DECLARATION the renderer paints.
 *
 * Which labels exist, where they sit, what they SAY and which are editable all
 * come from one place, resolved through the same catalogue — so a label can
 * never be drawn in one place and clicked in another, nor read one thing and
 * open on another. A subclass supplies its {@link def} and nothing else.
 *
 * A framework that needs to narrow the answer — a closed list of writable
 * props, a hit region wider than the words — overrides {@link labelAt} and
 * calls `super.labelAt` for the declaration's answer first.
 */
export abstract class DeclaredBackgroundView<
  T extends GfxPrimitiveElementModel = GfxPrimitiveElementModel,
> extends FrameworkBackgroundView<T> {
  /** The declaration this view hit-tests against — the one the renderer paints. */
  protected abstract get def(): FrameworkBackgroundDef;

  protected override labelAt(
    lx: number,
    ly: number,
    w: number,
    h: number
  ): EditableBackgroundLabel | null {
    const hit = hitTestBackgroundLabel(
      backgroundLabelHits(
        this.def,
        this.model as unknown as Record<string, unknown>,
        w,
        h,
        this.gfx.std.getOptional(TranslationProvider)
      ),
      lx,
      ly
    );
    return hit ? { prop: hit.prop, text: hit.text } : null;
  }
}
