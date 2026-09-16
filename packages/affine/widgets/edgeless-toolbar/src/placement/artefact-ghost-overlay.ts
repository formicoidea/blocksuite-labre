import { type RoughCanvas, ToolOverlay } from '@labre/affine-block-surface';
import { ThemeProvider } from '@labre/affine-shared/services';
import type { Bound } from '@labre/global/gfx';
import type { GfxController } from '@labre/std/gfx';

/** Gap between the bottom of the footprint and the baseline of the label. */
const LABEL_GAP = 16;

/** Label size in SCREEN pixels; divided by the zoom before it is drawn. */
const LABEL_SIZE = 12;

/**
 * The ghost an armed {@link ArtefactPlacementTool} leaves under the cursor: the
 * footprint of what the command will create, at true model size, with the
 * command's own label under it.
 *
 * An outline and not a rendering of the artefact itself. Drawing the real thing
 * would mean building the elements before the user has committed to a place —
 * and a framework artefact is often several elements, a group and a connector,
 * none of which exist until `runCommand` runs. The dashed box says exactly what
 * the tool can honestly promise: this much room, here, called this.
 *
 * Like `ShapeOverlay`, the box is positioned from {@link ToolOverlay.x} /
 * {@link ToolOverlay.y} — the cursor in model coordinates — and the footprint is
 * an offset around it, because the recording that measured it ran against a
 * viewport whose centre was the origin. The same offset is what the placement
 * re-applies for real.
 */
export class ArtefactGhostOverlay extends ToolOverlay {
  /** The footprint, relative to the cursor. */
  bound: Bound;

  /** What the command is called, in the reader's language. */
  label: string;

  constructor(gfx: GfxController, bound: Bound, label: string) {
    super(gfx);
    this.bound = bound;
    this.label = label;
  }

  override render(ctx: CanvasRenderingContext2D, _rc: RoughCanvas): void {
    ctx.globalAlpha = this.globalAlpha;
    if (this.globalAlpha === 0) return;

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
