import { getChromeAccentColor } from '@labre/affine-shared/services';
import { DisposableGroup } from '@labre/global/disposable';
import type { GfxController } from '@labre/std/gfx';
import { effect } from '@preact/signals-core';

import { Overlay } from './overlay.js';

/** Border thickness, in screen pixels: the selection frame's. */
const HIGHLIGHT_STROKE_WIDTH = 2;

/**
 * Draws the transient emphasis around the elements held by `gfx.highlight`
 * (`ElementHighlightManager`).
 *
 * The emphasis is the canvas's existing vocabulary, a square border on the
 * element's bounds like the selection frame (`edgeless-selected-rect`), not a
 * second, detached ring: the product owner asked for the border alone after
 * the P1 recette, so a selection-pane hover reads as « this one » and not as a
 * new kind of mark.
 *
 * The overlay is a pure renderer: it owns no state, reads nothing from the
 * store and mutates nothing, which makes it safe on a read-only editor.
 */
export class ElementHighlightOverlay extends Overlay {
  static override overlayName: string = 'element-highlight';

  private readonly _disposables = new DisposableGroup();

  private get _strokeColor() {
    return getChromeAccentColor(this.gfx.std);
  }

  constructor(gfx: GfxController) {
    super(gfx);

    this._disposables.add(
      effect(() => {
        // Repaint the canvas whenever the highlighted set changes.
        this.gfx.highlight.highlighted$.value;
        this.refresh();
      })
    );
  }

  override dispose(): void {
    this._disposables.dispose();
  }

  override render(ctx: CanvasRenderingContext2D): void {
    const elements = this.gfx.highlight.highlightedElements;
    if (elements.length === 0) return;

    const { zoom } = this.gfx.viewport;

    ctx.save();
    ctx.strokeStyle = this._strokeColor;
    ctx.lineWidth = HIGHLIGHT_STROKE_WIDTH / zoom;

    for (const element of elements) {
      const [x, y, w, h] = element.deserializedXYWH;

      ctx.save();
      // Rotate around the element center so rotated elements keep a tight
      // border; connectors and other non-rotatable elements use their bound box.
      ctx.translate(x + w / 2, y + h / 2);
      if (element.rotate) {
        ctx.rotate((element.rotate * Math.PI) / 180);
      }
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }

    ctx.restore();
  }
}
