import { ThemeProvider } from '@labre/affine-shared/services';
import { DisposableGroup } from '@labre/global/disposable';
import type { GfxController } from '@labre/std/gfx';
import { effect } from '@preact/signals-core';

import { Overlay } from './overlay.js';

/** Ring thickness, in screen pixels. */
const HIGHLIGHT_STROKE_WIDTH = 2;

/** Gap between the element bounds and the ring, in screen pixels. */
const HIGHLIGHT_GAP = 4;

/** Ring corner radius, in screen pixels. */
const HIGHLIGHT_RADIUS = 4;

/** Used when no theme is provided, matches the legacy frame highlight. */
const FALLBACK_HIGHLIGHT_COLOR = '#1E96EB';

/**
 * Draws the transient emphasis ring around the elements held by
 * `gfx.highlight` (`ElementHighlightManager`).
 *
 * The overlay is a pure renderer: it owns no state, reads nothing from the
 * store and mutates nothing, which makes it safe on a read-only editor.
 */
export class ElementHighlightOverlay extends Overlay {
  static override overlayName: string = 'element-highlight';

  private readonly _disposables = new DisposableGroup();

  private get _strokeColor() {
    return (
      this.gfx.std
        .getOptional(ThemeProvider)
        ?.getCssVariableColor('--affine-primary-color') ??
      FALLBACK_HIGHLIGHT_COLOR
    );
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
    const gap = HIGHLIGHT_GAP / zoom;
    const radius = HIGHLIGHT_RADIUS / zoom;

    ctx.save();
    ctx.strokeStyle = this._strokeColor;
    ctx.lineWidth = HIGHLIGHT_STROKE_WIDTH / zoom;

    for (const element of elements) {
      const [x, y, w, h] = element.deserializedXYWH;

      ctx.save();
      // Rotate around the element center so rotated elements keep a tight
      // ring; connectors and other non-rotatable elements use their bound box.
      ctx.translate(x + w / 2, y + h / 2);
      if (element.rotate) {
        ctx.rotate((element.rotate * Math.PI) / 180);
      }
      ctx.beginPath();
      ctx.roundRect(
        -w / 2 - gap,
        -h / 2 - gap,
        w + gap * 2,
        h + gap * 2,
        radius
      );
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}
