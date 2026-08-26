import {
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import type { EstuarineElementModel } from '@labre/affine-model';

import { FONT_FAMILY, refScale } from '../utils';
import {
  ARROWHEADS,
  AXIS_LABELS,
  AXIS_WIDTH,
  COLORS,
  COUNTERFACTUAL_PATH,
  COUNTERFACTUAL_WIDTH,
  E_AXIS,
  LABEL_LETTER_SPACING,
  LABELS,
  LIMINAL_PATH,
  LIMINAL_WIDTH,
  REF_H,
  REF_W,
  T_AXIS,
  VOLATILE_PATH,
  VOLATILE_WIDTH,
} from './consts';

/**
 * The three reference curves are drawn as a permanent GHOST (PO arbitration,
 * 26/08/2026): dashed, translucent, never solid again.
 *
 * The reasoning is what an Estuarine line IS. Liminal, Volatile and
 * Counter-factual are not measurements — they are boundaries a group argues
 * itself into, and the printed map is a support for that argument, not a
 * verdict about where the boundary lies. A solid stroke made the tool's own
 * curve look like the answer, and the group's negotiated line (drawn on top,
 * with a brush or a connector) look like an annotation on it. Dashing the
 * reference inverts that: the tool suggests, the group states.
 *
 * The toggles keep their meaning exactly — ON shows the ghost, OFF hides it.
 * What changed is only how ON looks, plus the ~600 ms reveal animation the
 * moment a toggle flips (see `./ghost-overlay.ts`), which exists so a line
 * that comes back at 45 % opacity is still SEEN arriving.
 *
 * The legends stay solid. A label is a name, not a boundary.
 */

/** Dash pattern of the ghost, in reference-space units. */
export const GHOST_DASH: readonly number[] = [12, 10];

/** Opacity of the permanent ghost. */
export const GHOST_ALPHA = 0.45;

/** Which `EstuarineElementModel` flag shows a given curve. */
export type EstuarineCurveVisibility =
  | 'showLiminal'
  | 'showVolatile'
  | 'showCounterfactual';

export interface EstuarineCurve {
  key: 'liminal' | 'volatile' | 'counterfactual';
  path: Path2D;
  color: string;
  width: number;
  visibleProp: EstuarineCurveVisibility;
}

/**
 * The three curves, with their `Path2D` built ONCE.
 *
 * A lazy memo (`??=`) rather than a module-level constant, and that is not a
 * micro-optimisation: `Path2D` does not exist under Node, and `./consts.ts` —
 * which this module imports — is pulled in by the unit specs. Building the
 * paths at import time would make merely importing this framework's constants
 * throw in every non-browser environment. Built on the first PAINT instead,
 * which by definition happens on a canvas.
 */
let _curves: readonly EstuarineCurve[] | undefined;

export function estuarineCurves(): readonly EstuarineCurve[] {
  return (_curves ??= [
    {
      key: 'liminal',
      path: new Path2D(LIMINAL_PATH),
      color: COLORS.liminal,
      width: LIMINAL_WIDTH,
      visibleProp: 'showLiminal',
    },
    {
      key: 'volatile',
      path: new Path2D(VOLATILE_PATH),
      color: COLORS.volatile,
      width: VOLATILE_WIDTH,
      visibleProp: 'showVolatile',
    },
    {
      key: 'counterfactual',
      path: new Path2D(COUNTERFACTUAL_PATH),
      color: COLORS.counterfactual,
      width: COUNTERFACTUAL_WIDTH,
      visibleProp: 'showCounterfactual',
    },
  ]);
}

/**
 * Put `ctx` into the map's REFERENCE space: the fixed 690 × 801 design the
 * geometry is authored in, fitted uniformly (letterboxed) into the element's
 * bounds and rotated with it.
 *
 * Shared with the ghost overlay, which paints the very same curves one layer
 * above and must land on them to the pixel.
 */
export function applyEstuarineTransform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  const { s, ox, oy } = refScale(w, h, REF_W, REF_H);
  ctx.translate(ox, oy);
  ctx.scale(s, s);
}

/**
 * Canvas renderer for the Estuarine framework map — reproduces the official SVG:
 * the e (vertical, double-headed) / t (horizontal, single-headed) axes and the
 * three reference curves (Liminal / Volatile / Counter-factual), each with its
 * legend and individually hideable. Drawn in the fixed reference space and
 * scaled uniformly to the element bounds.
 */
export const estuarine: ElementRenderer<EstuarineElementModel> = (
  model,
  ctx,
  matrix
) => {
  const [, , w, h] = model.deserializedXYWH;
  const cx = w / 2;
  const cy = h / 2;
  ctx.setTransform(
    matrix.translateSelf(cx, cy).rotateSelf(model.rotate).translateSelf(-cx, -cy)
  );

  applyEstuarineTransform(ctx, w, h);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ── Axes ────────────────────────────────────────────────────────────
  ctx.strokeStyle = COLORS.axis;
  ctx.fillStyle = COLORS.axis;
  ctx.lineWidth = AXIS_WIDTH;
  ctx.beginPath();
  ctx.moveTo(E_AXIS.x, E_AXIS.y1);
  ctx.lineTo(E_AXIS.x, E_AXIS.y2);
  ctx.moveTo(T_AXIS.x1, T_AXIS.y);
  ctx.lineTo(T_AXIS.x2, T_AXIS.y);
  ctx.stroke();
  for (const [[tx, ty], [ax, ay], [bx, by]] of ARROWHEADS) {
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.closePath();
    ctx.fill();
  }

  // Uppercase legend (centre-anchored, alphabetic baseline, letter-spaced).
  const hasSpacing = 'letterSpacing' in ctx;
  const legend = (l: { text: string; x: number; y: number; size: number; color: string }) => {
    ctx.fillStyle = l.color;
    ctx.font = `600 ${l.size}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (hasSpacing) ctx.letterSpacing = `${LABEL_LETTER_SPACING}px`;
    ctx.fillText(l.text, l.x, l.y);
    if (hasSpacing) ctx.letterSpacing = '0px';
  };

  // ── The three curves, as ghosts ─────────────────────────────────────
  // `save`/`restore` around each one so the dash and the alpha never leak onto
  // the legend that follows it — a legend is a name, and names stay solid.
  for (const curve of estuarineCurves()) {
    if (!model[curve.visibleProp]) continue;
    ctx.save();
    ctx.strokeStyle = curve.color;
    ctx.lineWidth = curve.width;
    ctx.globalAlpha = GHOST_ALPHA;
    ctx.setLineDash([...GHOST_DASH]);
    ctx.stroke(curve.path);
    ctx.restore();
    legend(LABELS[curve.key]);
  }

  // ── Italic e / t axis letters ───────────────────────────────────────
  if (model.showAxisLabels) {
    ctx.fillStyle = COLORS.axisLabel;
    ctx.font = `italic 700 ${AXIS_LABELS.size}px Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(AXIS_LABELS.e.text, AXIS_LABELS.e.x, AXIS_LABELS.e.y);
    ctx.fillText(AXIS_LABELS.t.text, AXIS_LABELS.t.x, AXIS_LABELS.t.y);
  }
};

export const EstuarineRendererExtension = ElementRendererExtension(
  'estuarine',
  estuarine
);
