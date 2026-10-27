import {
  backgroundInstanceZones,
  backgroundPlot,
  type CanvasRenderer,
  createFrameworkBackgroundRenderer,
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import type { BpmnPoolElementModel } from '@labre/affine-model';
import { GfxControllerIdentifier } from '@labre/std/gfx';

import type { BpmnLaneFocusHolder } from './actions.js';
import { BPMN_POOL_BACKGROUND } from './background';
import { POOL_LANE_BAND_WIDTH } from './consts.js';
import { bpmnPoolLayout } from './pool-hit.js';

/**
 * The pool as the framework-background primitive paints it.
 *
 * There is no BPMN drawing code any more: the pool is an INSTANTIATION of the
 * framework-background primitive, configured by the `BPMN_POOL_BACKGROUND`
 * declaration. What used to be ninety lines of hand-traced rounded rectangle,
 * filled band and rotated name is now a declaration any other framework can
 * write for itself.
 */
const paintPool = createFrameworkBackgroundRenderer<BpmnPoolElementModel>(
  BPMN_POOL_BACKGROUND,
  {
    // The model cannot measure text, so picking would select by the DECLARED
    // band widths while a long name paints them wider. Cache what was painted
    // on the model's `@local()` `paintedBands` (never stored), and only when
    // it changed: a local write is an `elementUpdated`, which repaints.
    onBands: (model, layout) => {
      const margin = layout.margin.left;
      const zoneBandWidth = layout.zoneBandWidth ?? POOL_LANE_BAND_WIDTH;
      const previous = model.paintedBands;
      if (
        previous?.margin === margin &&
        previous.zoneBandWidth === zoneBandWidth
      ) {
        return;
      }
      model.paintedBands = { margin, zoneBandWidth };
    },
  }
);

/** Width of the focused lane's outline, in model units. */
const FOCUS_OUTLINE_WIDTH = 2;

/**
 * Canvas renderer for the BPMN pool: the declared background, then the outline
 * of the FOCUSED lane, if this editor has one (`BpmnLaneFocusHolder`, held by
 * the pool's view and never stored).
 *
 * The outline is the editor talking about the drawing — "this is the lane the
 * reorder commands will move" — not part of it, so it is the theme's accent
 * (`--affine-primary-color`, resolved through the renderer) rather than a
 * notation colour. It is painted only onto the editor's OWN canvases: the SVG
 * and PNG exports paint through this same renderer into a context of their
 * own, and a file must not carry an on-screen focus. A renderer with no editor
 * behind it (a bare unit test) paints none either, and a host that defines no
 * accent gets none.
 *
 * Painted in the transform the primitive left on the context — element-local
 * units, rotated about the centre like the rest of the pool.
 *
 * Exported as a function as well as an extension because the fidelity suite
 * drives it directly with a canvas stub.
 */
export const bpmnPool: ElementRenderer<BpmnPoolElementModel> = (
  model,
  ctx,
  matrix,
  renderer,
  rc,
  viewportBound
) => {
  paintPool(model, ctx, matrix, renderer, rc, viewportBound);

  const canvas = renderer as CanvasRenderer | undefined;
  if (!canvas?.std) return;
  const onScreen =
    ctx.canvas === canvas.canvas ||
    canvas.stackingCanvas.includes(ctx.canvas as HTMLCanvasElement);
  if (!onScreen) return;
  const holder = canvas.std
    .getOptional(GfxControllerIdentifier)
    ?.view?.get(model.id) as Partial<BpmnLaneFocusHolder> | null | undefined;
  const id = holder?.focusedLaneId;
  if (!id) return;

  const [, , w, h] = model.deserializedXYWH;
  // The outline hugs the flow area as PAINTED, i.e. right of a participant
  // band a long name may have widened.
  const plot = backgroundPlot(
    BPMN_POOL_BACKGROUND,
    w,
    h,
    bpmnPoolLayout(model).margin
  );
  const prefix = BPMN_POOL_BACKGROUND.instanceZones?.idPrefix ?? 'lane';
  const zone = backgroundInstanceZones(
    BPMN_POOL_BACKGROUND,
    model as unknown as Readonly<Record<string, unknown>>
  ).find(candidate => candidate.id === `${prefix}:${id}`);
  if (!zone) return;

  const accent = canvas.getPropertyValue('--affine-primary-color').trim();
  if (!accent) return;

  const inset = FOCUS_OUTLINE_WIDTH / 2;
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = FOCUS_OUTLINE_WIDTH;
  ctx.setLineDash([]);
  ctx.strokeRect(
    plot.x0 + inset,
    plot.y0 + zone.rect.y * plot.height + inset,
    plot.width - FOCUS_OUTLINE_WIDTH,
    zone.rect.h * plot.height - FOCUS_OUTLINE_WIDTH
  );
  ctx.restore();
};

export const BpmnPoolRendererExtension = ElementRendererExtension(
  BPMN_POOL_BACKGROUND.type,
  bpmnPool
);
