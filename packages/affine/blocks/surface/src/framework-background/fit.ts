/**
 * How a framework that draws a FIXED reference artwork puts it in its element.
 *
 * A declared background (`FrameworkBackgroundDef`) never needs this: it is made
 * of ratios of a plot and stretches with the element by construction. The
 * frameworks that reproduce an authored drawing — Cynefin, Estuarine, EDGY, the
 * DDD stencils — cannot stretch: circles would turn into ellipses and a
 * hand-drawn boundary into a smear. They fit the artwork uniformly instead and
 * centre what is left over.
 *
 * This was written three times over — `gfx/cynefin-estuarine/src/utils.ts`,
 * `gfx/ddd-shared/src/shared/utils.ts` and `gfx/edgy/src/consts.ts` — with the
 * same body each time. One source of truth (R37): the three call it, and a
 * board that crops itself onto its drawing
 * (`gfx/cynefin-estuarine/src/cynefin/crop.ts`) reads the very function the
 * renderer painted through, so the two can never disagree about where the
 * drawing is.
 */

/** A uniform fit: the scale, and the offsets that centre the letterbox. */
export interface RefFit {
  /** Scale from reference units to element units. */
  s: number;
  /** Left offset of the fitted artwork inside the element, in element units. */
  ox: number;
  /** Top offset of the fitted artwork inside the element, in element units. */
  oy: number;
}

/**
 * Uniform fit of a `refW × refH` reference design into a `w × h` box: the
 * scale factor plus the centring offsets (letterboxed), undistorted.
 *
 * The fitted artwork is `refW * s` by `refH * s` and shares the box's CENTRE —
 * `ox + refW * s / 2 === w / 2` — which is what lets a board crop itself onto
 * its drawing without the drawing moving, rotation included.
 */
export function refScale(
  w: number,
  h: number,
  refW: number,
  refH: number
): RefFit {
  const s = Math.min(w / refW, h / refH);
  return { s, ox: (w - refW * s) / 2, oy: (h - refH * s) / 2 };
}
