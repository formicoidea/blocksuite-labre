import {
  CanvasRenderer,
  type ElementRenderer,
  ElementRendererIdentifier,
  type RoughCanvas,
  type SurfaceBlockComponent,
  ToolOverlay,
} from '@labre/affine-block-surface';
import { ThemeProvider } from '@labre/affine-shared/services';
import type { Bound } from '@labre/global/gfx';
import type { GfxController, GfxPrimitiveElementModel } from '@labre/std/gfx';

/** Gap between the bottom of the footprint and the baseline of the label. */
const LABEL_GAP = 16;

/** Label size in SCREEN pixels; divided by the zoom before it is drawn. */
const LABEL_SIZE = 12;

/**
 * The ghost an armed {@link ArtefactPlacementTool} leaves under the cursor: the
 * artefact itself, painted by the very renderers that will paint it once it is
 * placed, at full opacity (PO decision, 2026-09-16).
 *
 * The elements are DETACHED models (`createDetachedElement`), built once by the
 * tool from the recording of the command — never per frame, and never in the
 * document. Each frame only runs the renderers, in paint order.
 *
 * When nothing could be built — the recording threw, or recorded nothing the
 * surface can build — the ghost falls back to what the tool can still promise:
 * a dashed footprint and the command's label under it. A real preview carries
 * its own words, so it gets no label.
 *
 * Like `ShapeOverlay`, everything is positioned from {@link ToolOverlay.x} /
 * {@link ToolOverlay.y} — the cursor in model coordinates — and the recorded
 * boxes are offsets around it, because the recording ran against a viewport
 * whose centre was the origin. The same offset is what the placement re-applies
 * for real.
 */
export class ArtefactGhostOverlay extends ToolOverlay {
  /** The footprint, relative to the cursor. */
  bound: Bound;

  /** What the command is called, in the reader's language. */
  label: string;

  /** The artefact's drawable elements, in paint order, with their renderer. */
  private readonly _preview: {
    model: GfxPrimitiveElementModel;
    render: ElementRenderer;
  }[];

  constructor(
    gfx: GfxController,
    bound: Bound,
    label: string,
    models: GfxPrimitiveElementModel[] = []
  ) {
    super(gfx);
    this.bound = bound;
    this.label = label;
    // Resolved once: a type without a canvas renderer is skipped silently, as
    // the surface's own render loop skips it.
    this._preview = models.flatMap(model => {
      const render = gfx.std.getOptional<ElementRenderer>(
        ElementRendererIdentifier(model.type)
      );
      return render ? [{ model, render }] : [];
    });
  }

  /** Whether the artefact itself is drawn, rather than the fallback box. */
  get drawsArtefact() {
    return this._preview.length > 0;
  }

  override render(ctx: CanvasRenderingContext2D, rc: RoughCanvas): void {
    ctx.globalAlpha = this.globalAlpha;
    if (this.globalAlpha === 0) return;

    const renderer = (this.gfx.surfaceComponent as SurfaceBlockComponent | null)
      ?.renderer;

    if (this.drawsArtefact && renderer instanceof CanvasRenderer) {
      this._renderArtefact(ctx, rc, renderer);
    } else {
      this._renderFootprint(ctx);
    }
  }

  /**
   * What the surface's render loop does per element, with the cursor in place
   * of the element's position: the context is already in model coordinates
   * here, so the element's matrix is that transform moved to cursor + offset.
   */
  private _renderArtefact(
    ctx: CanvasRenderingContext2D,
    rc: RoughCanvas,
    renderer: CanvasRenderer
  ) {
    const base = ctx.getTransform();
    const viewportBound = this.gfx.viewport.viewportBounds;

    for (const { model, render } of this._preview) {
      const [x, y] = model.deserializedXYWH;
      ctx.save();
      ctx.globalAlpha = model.opacity ?? 1;
      render(
        model,
        ctx,
        base.translate(this.x + x, this.y + y),
        renderer,
        rc,
        viewportBound
      );
      ctx.restore();
    }
  }

  private _renderFootprint(ctx: CanvasRenderingContext2D) {
    const theme = this.gfx.std.get(ThemeProvider);
    const stroke = theme.getCssVariableColor('--affine-primary-color');
    const text = theme.getCssVariableColor('--affine-text-secondary-color');

    // Chrome, not content: the outline and the label keep their size on screen
    // whatever the zoom, the way the polygon tool's own indicators do.
    const zoom = this.gfx.viewport.zoom;
    const { bound } = this;
    const x = this.x + bound.x;
    const y = this.y + bound.y;
    const radius = Math.min(8 / zoom, bound.w / 4, bound.h / 4);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, bound.w, bound.h, radius);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.stroke();

    if (this.label) {
      ctx.setLineDash([]);
      ctx.font = `${LABEL_SIZE / zoom}px var(--affine-font-family, sans-serif)`;
      ctx.fillStyle = text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        this.label,
        x + bound.w / 2,
        y + bound.h + LABEL_GAP / zoom - LABEL_SIZE / zoom
      );
    }
    ctx.restore();
  }
}
