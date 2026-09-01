import {
  backgroundLabelHits,
  EdgelessCRUDIdentifier,
  FrameworkBackgroundInteractionExtension,
  hitTestBackgroundLabel,
} from '@labre/affine-block-surface';
import type { WardleyBackgroundElementModel } from '@labre/affine-model';
import { TranslationProvider } from '@labre/affine-shared/services';
import { rotatePoint } from '@labre/global/gfx';
import type { EditorHost, PointerEventState } from '@labre/std';
import type { PointTestOptions } from '@labre/std/gfx';
import { GfxElementModelView } from '@labre/std/gfx';

import {
  isWardleyLabelProp,
  WARDLEY_BACKGROUND,
  type WardleyLabelProp,
} from './background';

export class WardleyView extends GfxElementModelView<WardleyBackgroundElementModel> {
  static override type: string = 'wardley';

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
   * The editable label under a MODEL-space point, or null.
   *
   * Which labels exist, where they sit, what they SAY and which are editable
   * all come from the declaration the renderer paints — one source, resolved
   * through the same catalogue, so a label can never be drawn in one place
   * and clicked in another, nor read one thing and open on another.
   */
  private _labelAt(mx: number, my: number) {
    const [bx, by, w, h] = this.model.deserializedXYWH;

    // Convert the model-space point into element-local coordinates, undoing the
    // element rotation around its center.
    let lx = mx - bx;
    let ly = my - by;
    const rot = this.model.rotate ?? 0;
    if (rot) {
      const center: [number, number] = [bx + w / 2, by + h / 2];
      const [ux, uy] = rotatePoint([mx, my], center, -rot);
      lx = ux - bx;
      ly = uy - by;
    }

    const hit = hitTestBackgroundLabel(
      backgroundLabelHits(
        WARDLEY_BACKGROUND,
        this.model as unknown as Record<string, unknown>,
        w,
        h,
        this.gfx.std.getOptional(TranslationProvider)
      ),
      lx,
      ly
    );
    // The declaration names the prop; this decides whether it may be written.
    if (!hit || !isWardleyLabelProp(hit.prop)) return null;
    return { prop: hit.prop, text: hit.text };
  }

  /**
   * The map is SELECTED by its border (`WardleyBackgroundElementModel`), but
   * its axis labels must still receive the double-click that renames them.
   *
   * So the two areas differ, and this is where they are allowed to: the pointer
   * router asks the VIEW (`GfxViewEventManager`), and the view adds the zones
   * the declaration draws its labels in. Picking is unaffected —
   * `getElementByPoint` still asks the model, so a click in the middle of the
   * map still goes to whatever the user put there.
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

  /** Double-click on a label → edit its text in place. */
  private _onDblClick(e: PointerEventState): void {
    if (this.model.isLocked()) return;

    const [mx, my] = this.gfx.viewport.toModelCoord(e.x, e.y);
    const hit = this._labelAt(mx, my);
    if (!hit) return;

    this._openLabelEditor(hit.prop, hit.text, e);
  }

  /**
   * @param current the words currently DRAWN — which is the vocabulary, not
   * `model[field]`, for a label the user has never renamed. Opening on the raw
   * prop would show an empty box for a label that plainly reads "Evolution".
   */
  private _openLabelEditor(
    field: WardleyLabelProp,
    current: string,
    e: PointerEventState
  ): void {
    this._closeLabelEditor();

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
    this._labelEditor = input;

    // Mark the element as "editing" so the global edgeless key handlers
    // (delete, escape, etc.) don't act on it while the user types.
    this.gfx.selection.set({ elements: [this.model.id], editing: true });

    input.focus();
    input.select();

    const commit = () => {
      // Guard against re-entrancy: removing the input fires `blur`, which would
      // otherwise call `commit` a second time.
      if (this._labelEditor !== input) return;
      const value = input.value;
      this._closeLabelEditor();
      // Opening an editor is not renaming. Writing back an untouched value
      // would persist the resolved VOCABULARY as the user's own text, freezing
      // the label in whatever language it was read in and putting it beyond
      // any catalogue for good — and it would push an empty entry onto undo.
      if (value === current) return;
      this.gfx.std.store.captureSync();
      this.gfx.std
        .get(EdgelessCRUDIdentifier)
        .updateElement(this.model.id, { [field]: value });
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
 * Resize gating, from the primitive: the handles stay hidden until
 * `resizeEnabled` is true — the runtime half of the declaration's
 * `geometry.resizable`.
 */
export const WardleyInteraction =
  FrameworkBackgroundInteractionExtension(WARDLEY_BACKGROUND);
