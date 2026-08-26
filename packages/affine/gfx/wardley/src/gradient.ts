import type { BackgroundWashDef } from '@labre/affine-block-surface';

/**
 * Curve-driven gradient backgrounds (Slice C). Each analytic background is a
 * smooth mathematical curve (piecewise asymmetric Gaussian bells); the gradient
 * opacity at each evolution position X follows that curve, normalised between
 * its own min and max — i.e. the gradient is strongest where the curve peaks and
 * fades to nothing at its minimum. Validated against the reference images at
 * `../wardley-mockups/gradient-backgrounds.html`.
 *
 * The curves are TABULATED ONCE, here, at module load: what the declaration
 * ships — and what the primitive paints — is a table of `[offset, alpha]`
 * stops, not a function. Nothing is evaluated at paint time, and the wash is
 * data like the rest of the declaration (PF2.1).
 */

const bell = (x: number, mu: number, s: number) =>
  Math.exp(-0.5 * ((x - mu) / s) ** 2);
const asym = (x: number, mu: number, sL: number, sR: number) =>
  Math.exp(-0.5 * ((x - mu) / (x < mu ? sL : sR)) ** 2);

// Opportunity — differential value (green): early peak + long decay.
const fDiff = (x: number) => asym(x, 0.175, 0.24, 0.36);
const DIFF_DOM: readonly [number, number] = [0, 0.86];
// Opportunity — operational value (red): bump centred on commodity.
const fOper = (x: number) => asym(x, 0.85, 0.1, 0.075);
const OPER_DOM: readonly [number, number] = [0.62, 1];
// Benefit / investment (signed): big positive bell − small negative bell.
const fBen = (x: number) =>
  asym(x, 0.49, 0.17, 0.24) - 0.42 * bell(x, 0.1, 0.075);

// Evolution-gradient — Simon Wardley's classic evolution presentation: a
// symmetric grey "U", strong at both evolution extremes (uncharted /
// industrialised), fading to white through the build middle.
const fGrey = (x: number) => {
  const left = Math.max(0, (0.26 - x) / 0.26);
  const right = Math.max(0, (x - 0.64) / 0.36);
  return Math.max(left, right);
};

function rangeOf(fn: (x: number) => number, x0: number, x1: number) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= 240; i++) {
    const v = fn(x0 + ((x1 - x0) * i) / 240);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return { lo, hi };
}
const RG = rangeOf(fDiff, DIFF_DOM[0], DIFF_DOM[1]);
const RR = rangeOf(fOper, OPER_DOM[0], OPER_DOM[1]);
const RB = rangeOf(fBen, 0, 1);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const norm = (v: number, lo: number, hi: number) =>
  hi > lo ? (v - lo) / (hi - lo) : 0;

export const GRADIENT_GREEN = '#1f9e4d';
export const GRADIENT_RED = '#d6455d';
const GRADIENT_GREY = '#7c8389';
/** Validated peak opacity for the green/red variants. */
const GRADIENT_MAX_OPACITY = 0.45;
/** Peak opacity for the grey evolution-gradient variant. */
const GREY_MAX_OPACITY = 0.38;

/**
 * Tabulate one opacity profile as gradient stops spanning the plot width:
 * 49 samples inside [x0, x1], bracketed by a zero stop wherever the profile
 * does not reach the edge of the plot.
 */
function stopTable(
  opacityFn: (x: number) => number,
  x0: number,
  x1: number,
  maxOp: number = GRADIENT_MAX_OPACITY
): Array<readonly [number, number]> {
  const eps = 0.001;
  const stops: Array<readonly [number, number]> = [];
  if (x0 > eps) stops.push([Math.max(0, x0 - eps), 0]);
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const x = x0 + ((x1 - x0) * i) / N;
    stops.push([clamp01(x), clamp01(opacityFn(x)) * maxOp]);
  }
  if (x1 < 1 - eps) stops.push([Math.min(1, x1 + eps), 0]);
  return stops;
}

// benefit: green where the curve is positive, red where negative.
const BEN_MAX_POS = RB.hi;
const BEN_MAX_NEG = -RB.lo;

/**
 * The washes the Wardley declaration ships, in painting order. Only those whose
 * `variants` name the background's current `variant` are painted, and only
 * while `showGradient` is on — so `classic` paints none of them and the frame
 * stays plain white, exactly as before.
 */
export const WARDLEY_WASHES: readonly BackgroundWashDef[] = [
  {
    id: 'evolution-grey',
    variants: ['evolution-gradient'],
    visibleProp: 'showGradient',
    color: GRADIENT_GREY,
    stops: stopTable(fGrey, 0, 1, GREY_MAX_OPACITY),
  },
  {
    id: 'opportunity-differential',
    variants: ['opportunity'],
    visibleProp: 'showGradient',
    color: GRADIENT_GREEN,
    stops: stopTable(
      x => norm(fDiff(x), RG.lo, RG.hi),
      DIFF_DOM[0],
      DIFF_DOM[1]
    ),
  },
  {
    id: 'opportunity-operational',
    variants: ['opportunity'],
    visibleProp: 'showGradient',
    color: GRADIENT_RED,
    stops: stopTable(
      x => norm(fOper(x), RR.lo, RR.hi),
      OPER_DOM[0],
      OPER_DOM[1]
    ),
  },
  {
    id: 'benefit-positive',
    variants: ['benefit'],
    visibleProp: 'showGradient',
    color: GRADIENT_GREEN,
    stops: stopTable(x => Math.max(0, fBen(x)) / BEN_MAX_POS, 0, 1),
  },
  {
    id: 'benefit-investment',
    variants: ['benefit'],
    visibleProp: 'showGradient',
    color: GRADIENT_RED,
    stops: stopTable(x => Math.max(0, -fBen(x)) / BEN_MAX_NEG, 0, 1),
  },
];
