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
  C4BoardElementModel,
  C4BoundaryElementModel,
} from '@labre/affine-model';
import { TranslationProvider } from '@labre/affine-shared/services';
import { rotatePoint } from '@labre/global/gfx';
import type { EditorHost, PointerEventState } from '@labre/std';
import type { PointTestOptions } from '@labre/std/gfx';
import { GfxElementModelView } from '@labre/std/gfx';

import { C4_BOARD_BACKGROUND, C4_BOUNDARY_BACKGROUND } from './background';
import { c4InBoardTitleBand } from './board-hit';

/**
 * The one gesture the two C4 frames carry: a double-click on the name edits it
 * in place.
 *
 * Both frames are a card with exactly one editable word on it — the board's
 * title, the boundary's name — so the gesture is written once here and the two
 * views differ only in which declaration they hit-test against. That is the
 * simplified version of `BpmnPoolView`: no lanes, no separators, no armed drag,
 * because neither frame has anything inside it to divide.
 *
 * Which labels exist, where they sit, what they SAY and which are editable all
 * come from the declaration the renderer paints (`backgroundLabelHits`), so a
 * label can never be drawn in one place and clicked in another — the same
 * source `WardleyView` reads, and the reason this class has no coordinates of
 * its own.
 *
 * ponytail: like every other framework view in the library, only `name` may be
 * written. The declarations bind exactly one prop each; the guard is what keeps
 * that true if a second label is ever declared with a prop nobody meant to
 * expose to an in-place editor.
 */
abstract class C4FrameView<
  T extends C4BoardElementModel | C4BoundaryElementModel,
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
   * very anchor the renderer paints at, so a label can never be drawn in one
   * place and clicked in another. That is the right answer for a name written
   * INSIDE the plot, over the diagram, where anything wider would swallow
   * clicks meant for the elements around it: the C4 boundary's name sits in its
   * bottom-left corner, and this is its whole story.
   *
   * A frame whose name has a strip of its own overrides this and returns the
   * strip — see {@link C4BoardView}.
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
   * #194) — but the name written on its card must still receive the
   * double-click that renames it.
   *
   * Same seam Wardley and EDGY use: the pointer router asks the VIEW, picking
   * asks the MODEL, and a framework declares its own gesture zones beside the
   * code that draws them. Without this the name becomes unrenameable; without
   * the model change the card swallows every click meant for the nodes on it.
   *
   * The BOARD's band is in both answers — the model picks it and this widens
   * nothing over it — so on that frame the fallback below only ever fires for a
   * point the model already took. It is the BOUNDARY that still needs it: its
   * name is written inside the plot, where nothing is selectable.
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

    this._openEditor(hit.text, e);
  }

  /**
   * @param current the words currently DRAWN, which is what the user aimed at —
   * never `model.name`, so a frame showing its declared wording opens on that
   * wording rather than on an empty box.
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
 * The sheet a C4 diagram is drawn on. Double-click ANYWHERE in its title band
 * to rename it.
 *
 * The band and not the words, which is the whole of what this subclass changes.
 * A header strip you may only double-click the eleven characters of is a target
 * that lies about where it is — the same call the BPMN pool's participant band
 * makes, and now the same geometry: the strip that is painted is the strip a
 * single click selects (`C4BoardElementModel.includesPoint`) and the strip a
 * double-click renames.
 *
 * `hits` still supplies the WORDS the editor opens on, so a board showing its
 * default title opens on that title rather than on an empty box — only the
 * region grew.
 */
export class C4BoardView extends C4FrameView<C4BoardElementModel> {
  static override type: string = 'c4Board';

  protected override get def(): FrameworkBackgroundDef {
    return C4_BOARD_BACKGROUND;
  }

  protected override _nameAt(
    hits: readonly BackgroundLabelHit[],
    lx: number,
    ly: number
  ): BackgroundLabelHit | null {
    const name = hits.find(hit => hit.prop === 'name');
    if (!name) return null;
    return c4InBoardTitleBand(this.model, [lx, ly]) ? name : null;
  }
}

/** The dashed frame drawn round part of one. Double-click its name to rename. */
export class C4BoundaryView extends C4FrameView<C4BoundaryElementModel> {
  static override type: string = 'c4Boundary';

  protected override get def(): FrameworkBackgroundDef {
    return C4_BOUNDARY_BACKGROUND;
  }
}
