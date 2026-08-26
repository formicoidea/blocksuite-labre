import {
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import type { EstuarineElementModel } from '@labre/affine-model';

import { FONT_FAMILY } from '../utils';
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
 * How the fixed 690 × 801 reference design maps onto an element of `w × h`.
 *
 * ## Why an Estuarine map STRETCHES (PO recette, 26/08/2026)
 *
 * It used to be fitted uniformly and letterboxed (`refScale`), so widening the
 * background left the drawing at its authored proportions, centred, with short
 * axes floating in empty margins. That is wrong for THIS frame, and the reason
 * is what an Estuarine map is: a coordinate system. The e axis measures energy
 * to change, the t axis measures time, and the three curves are the boundaries
 * a group negotiates ACROSS that plane. Give the user more room and they mean
 * "more plane" — a longer time axis, a taller energy axis — not "the same
 * picture, bigger". So both directions follow the element independently.
 *
 * **Cynefin, right next door, deliberately keeps the uniform letterbox**: its
 * background is a figurative drawing — a cliff, hand-drawn arcs, a hatched
 * fall — and a figurative drawing has proportions that stretching would simply
 * damage. Two frames, two answers, and the difference is not an oversight.
 *
 * ## The two factors
 *
 * `sx` / `sy` stretch positions and paths. `strokeScale` is the ISOTROPIC
 * factor for everything that must not be deformed — stroke widths, arrowhead
 * triangles, font sizes, letter-spacing — taken as the geometric mean of the
 * two, the usual area-preserving stand-in for "one scale" when there are two.
 *
 * At the authored ratio `sx === sy`, so all three collapse to the single old
 * factor and `ox`/`oy` were zero: a map that has not been stretched paints
 * exactly the pixels it painted before this change.
 */
export interface EstuarineFit {
  /** Reference x → element x. */
  sx: number;
  /** Reference y → element y. */
  sy: number;
  /** The one undeformed factor: widths, arrowheads, type. */
  strokeScale: number;
  /**
   * `lineWidth` correction for a path stroked INSIDE the stretched space.
   *
   * Canvas transforms the pen along with the path, so under `scale(sx, sy)` a
   * nominal width `L` paints somewhere between `L·sx` and `L·sy` depending on
   * the direction of the segment. There is no exact single number for a curve
   * that runs in every direction; we approximate the pen's effective widening
   * by the ARITHMETIC mean of the two factors and divide it out, which lands
   * the ghost on {@link strokeScale} on average and keeps it within the
   * sx/sy spread everywhere else. Exactly `1` at the authored ratio.
   */
  curveLineScale: number;
}

export function estuarineFit(w: number, h: number): EstuarineFit {
  const sx = w / REF_W;
  const sy = h / REF_H;
  const strokeScale = Math.sqrt(sx * sy);
  return { sx, sy, strokeScale, curveLineScale: strokeScale / ((sx + sy) / 2) };
}

/**
 * Put `ctx` into the map's STRETCHED reference space, where the authored
 * geometry (a `Path2D` built from `./consts.ts`) lands on the element's real
 * bounds in both directions.
 *
 * The single source of truth for that transform, and it has to stay single:
 * the ghost overlay paints the very same curves one layer above and must land
 * on them to the pixel. Everything that must NOT be stretched — axes,
 * arrowheads, legends — is drawn outside it, in element coordinates, from the
 * same {@link EstuarineFit}.
 */
export function applyEstuarineTransform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): EstuarineFit {
  const fit = estuarineFit(w, h);
  ctx.scale(fit.sx, fit.sy);
  return fit;
}

/**
 * Canvas renderer for the Estuarine framework map — reproduces the official SVG:
 * the e (vertical, double-headed) / t (horizontal, single-headed) axes and the
 * three reference curves (Liminal / Volatile / Counter-factual), each with its
 * legend and individually hideable.
 *
 * Two spaces, and which one a mark belongs to is the whole design:
 *
 * - **Element coordinates**, entered by mapping each authored coordinate
 *   through {@link EstuarineFit} by hand (`ax` / `ay` below): the axes, their
 *   arrowheads and every word. Their POSITION follows the stretch — an axis
 *   ends where the map now ends — while their SHAPE does not, because a
 *   stretched arrowhead or a squashed letter is a defect, never a feature.
 * - **Stretched reference space**, entered by {@link applyEstuarineTransform}:
 *   the three curves, which are boundaries across the plane and must cover
 *   whatever plane the user has made.
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
    matrix
      .translateSelf(cx, cy)
      .rotateSelf(model.rotate)
      .translateSelf(-cx, -cy)
  );

  const fit = estuarineFit(w, h);
  /** Authored x → element x. Proportional: `43.5 / 690` of the real width. */
  const ax = (x: number) => x * fit.sx;
  /** Authored y → element y. */
  const ay = (y: number) => y * fit.sy;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ── Axes ────────────────────────────────────────────────────────────
  // Drawn in element coordinates so the e axis spans the real height and the
  // t axis the real width, while `lineWidth` stays one honest thickness
  // instead of being fattened in whichever direction the map was pulled.
  ctx.strokeStyle = COLORS.axis;
  ctx.fillStyle = COLORS.axis;
  ctx.lineWidth = AXIS_WIDTH * fit.strokeScale;
  ctx.beginPath();
  ctx.moveTo(ax(E_AXIS.x), ay(E_AXIS.y1));
  ctx.lineTo(ax(E_AXIS.x), ay(E_AXIS.y2));
  ctx.moveTo(ax(T_AXIS.x1), ay(T_AXIS.y));
  ctx.lineTo(ax(T_AXIS.x2), ay(T_AXIS.y));
  ctx.stroke();
  // Each head is pinned by its TIP — which travels to the real end of its axis
  // — and then built from the authored offsets at the isotropic scale, so the
  // triangle keeps its shape at any aspect ratio.
  for (const [[tx, ty], [px, py], [qx, qy]] of ARROWHEADS) {
    const tipX = ax(tx);
    const tipY = ay(ty);
    const k = fit.strokeScale;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + (px - tx) * k, tipY + (py - ty) * k);
    ctx.lineTo(tipX + (qx - tx) * k, tipY + (qy - ty) * k);
    ctx.closePath();
    ctx.fill();
  }

  // Uppercase legend (centre-anchored, alphabetic baseline, letter-spaced).
  // Anchored proportionally, typed isotropically — never inside the stretch.
  const hasSpacing = 'letterSpacing' in ctx;
  const legend = (l: {
    text: string;
    x: number;
    y: number;
    size: number;
    color: string;
  }) => {
    ctx.fillStyle = l.color;
    ctx.font = `600 ${l.size * fit.strokeScale}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (hasSpacing) {
      ctx.letterSpacing = `${LABEL_LETTER_SPACING * fit.strokeScale}px`;
    }
    ctx.fillText(l.text, ax(l.x), ay(l.y));
    if (hasSpacing) ctx.letterSpacing = '0px';
  };

  // ── The three curves, as ghosts ─────────────────────────────────────
  // `save`/`restore` around each one so neither the stretch nor the dash nor
  // the alpha leaks onto the legend that follows it — a legend is a name, and
  // names stay solid, upright and undeformed.
  for (const curve of estuarineCurves()) {
    if (!model[curve.visibleProp]) continue;
    ctx.save();
    applyEstuarineTransform(ctx, w, h);
    ctx.strokeStyle = curve.color;
    ctx.lineWidth = curve.width * fit.curveLineScale;
    ctx.globalAlpha = GHOST_ALPHA;
    ctx.setLineDash([...GHOST_DASH]);
    ctx.stroke(curve.path);
    ctx.restore();
    legend(LABELS[curve.key]);
  }

  // ── Italic e / t axis letters ───────────────────────────────────────
  if (model.showAxisLabels) {
    ctx.fillStyle = COLORS.axisLabel;
    ctx.font = `italic 700 ${AXIS_LABELS.size * fit.strokeScale}px Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(AXIS_LABELS.e.text, ax(AXIS_LABELS.e.x), ay(AXIS_LABELS.e.y));
    ctx.fillText(AXIS_LABELS.t.text, ax(AXIS_LABELS.t.x), ay(AXIS_LABELS.t.y));
  }
};

export const EstuarineRendererExtension = ElementRendererExtension(
  'estuarine',
  estuarine
);
