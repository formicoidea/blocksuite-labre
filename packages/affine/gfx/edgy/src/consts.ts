/**
 * Visual constants for the EDGY "Enterprise Design Facets" diagram.
 *
 * The whole diagram is authored in a FIXED reference coordinate space
 * (`REF_W × REF_H`, matching the validated mockup) and the renderer scales it
 * uniformly to the element bounds — so the three circles always stay circular
 * and the pictos/labels keep their relative proportions at any size.
 */

/** Reference design size (the validated mockup canvas). */
export const REF_W = 680;
export const REF_H = 400;

/** Circle geometry in reference coords. */
export const VENN = {
  cx: REF_W / 2,
  cy: 176,
  /** Circle radius. */
  R: 95,
  /** Distance of each circle centre from the diagram centre. */
  r0: 56,
} as const;

/** Saturated facet + intersection colours (faithful to the official icons). */
export const COLORS = {
  identity: '#00ea4e',
  architecture: '#034cee',
  experience: '#ff0056',
  organisation: '#00caf4',
  brand: '#ffa500',
  product: '#cf00ff',
  center: '#ffffff',
  separator: '#ffffff',
  picto: '#ffffff',
} as const;

/** Fixed picto line width + label font. */
export const PICTO_STROKE = 2.4;
export const LABEL_FONT_SIZE = 15;
export const FONT_FAMILY = 'Inter, sans-serif';

/**
 * Uniform fit of the reference design into an element of size `w × h`: the
 * scale factor plus the centering offsets (letterboxed). Shared by the renderer
 * (to draw) and the view (to map clicks back into reference coords).
 */
export function refScale(w: number, h: number) {
  const s = Math.min(w / REF_W, h / REF_H);
  return { s, ox: (w - REF_W * s) / 2, oy: (h - REF_H * s) / 2 };
}

/**
 * The three circles, and nothing else: their exact bounding box in reference
 * coords. Both crop boxes below are this box plus what each of them has to make
 * room for, so the two can never disagree about where the Venn is.
 */
const CIRCLES = (() => {
  const ax = VENN.cx - 0.866 * VENN.r0; // Identity / Architecture centres
  const abY = VENN.cy - 0.5 * VENN.r0;
  const cY = VENN.cy + VENN.r0; // Experience centre
  return {
    minX: ax - VENN.R,
    maxX: VENN.cx + 0.866 * VENN.r0 + VENN.R,
    minY: abY - VENN.R,
    maxY: cY + VENN.R,
  };
})();

/**
 * Bounding box of the three circles in reference coords, with just enough
 * padding to see their outline. When a diagram hides its facet names
 * (`cropToCircles` without `showLabels`) the renderer fits THIS box into the
 * element bounds, so the background hugs the Venn.
 *
 * ## Why the padding is 2.5 and not the 8 it was
 *
 * The padding is the ONLY empty band such a board has, and it is spent at the
 * element's scale, not at the reference one. The EDGY dynamic template draws
 * its board at `DYN_SCALE = 4.8`, so eight reference units of padding were
 * **32.4 model units** of nothing on each of the four sides — the board a user
 * has to catch by its border (R37) sat a good inch away from the circles, which
 * is what the recette of 23/09/2026 reported. 2.5 leaves 1.25 past the circles'
 * own 2.5-wide outline, i.e. 6 model units at the dynamic board's scale and
 * under 2 at a facets board's.
 *
 * `templates/dynamic.ts` places every element of the dynamic board in
 * coordinates relative to this box (`dynToModel`) and sizes the board from it,
 * so the template follows in the same breath: both are derived here, and a
 * freshly inserted template is aligned by construction. A board built from the
 * OLD template keeps its `xywh` and sees the Venn grow 3.8 % inside it — see
 * the changeset.
 */
export const CROP = (() => {
  const pad = 2.5;
  return {
    x: CIRCLES.minX - pad,
    y: CIRCLES.minY - pad,
    w: CIRCLES.maxX - CIRCLES.minX + 2 * pad,
    h: CIRCLES.maxY - CIRCLES.minY + 2 * pad,
  };
})();

/**
 * How far past the circles each side of the labelled box has to reach, in REF
 * units. MEASURED on the canvas, in the shipped wording, at
 * {@link LABEL_FONT_SIZE}; each number is that reach plus 4 or 5 units of
 * gutter.
 *
 * It used to be one symmetric number — `sideAllowance = 140` either side of the
 * padded box, `bottomAllowance = 35` under it — and the three words are not
 * symmetric at all. "Identity" is written right-aligned 10 left of the left
 * circle and reaches 63.6 past the circles; "Architecture" is written
 * left-aligned 10 right of the right circle and reaches 98.1; "Experience"
 * hangs 29.2 below the bottom one (a `middle` baseline plus the descender of
 * its "p"); and above them there is no word at all, only the 1.25 of circle
 * stroke. So a facets diagram was born inside 126.6 model units of nothing on
 * its left and 74.8 on its right — and a framework background is caught by its
 * border and by nothing else
 * (`model/src/elements/framework-background/hit-test.ts`), which put the
 * catchable edge a seventh of the board away from anything drawn.
 *
 * ## Why constants rather than a measurement at paint time
 *
 * Because the three names are EDITABLE props of the element (`identityLabel` &
 * co) and `cropLabeledScale` is not only what the renderer draws through —
 * `element-view.ts` maps every click back through it too. Deriving the box from
 * the current text would rescale and re-centre the whole Venn on each
 * keystroke, and move the click mapping under the user's finger while they
 * type; two boards of the same size would also draw their circles at two
 * different sizes. The allowance is furniture: it is measured once, here.
 *
 * A name rewritten to something much longer than the vocabulary therefore
 * reaches past the element's edge. It paints (the surface clips nothing); only
 * the SVG export, which crops to the `xywh`, would cut it.
 */
const LABEL_ALLOWANCE = {
  /** No word up there: the circle's own stroke, and room to see it. */
  top: 5,
  /** "Identity", right-aligned, reaching left of the circles. */
  left: 68,
  /** "Architecture", left-aligned, reaching right of them. */
  right: 103,
  /** "Experience", under the bottom circle, descender included. */
  bottom: 32,
} as const;

/**
 * Crop box KEEPING room for the three facet name labels (drawn outside the
 * circles): the circles plus {@link LABEL_ALLOWANCE}, which is asymmetric
 * because the words are. Used when a cropped diagram still shows its labels.
 */
export const CROP_LABELED = {
  x: CIRCLES.minX - LABEL_ALLOWANCE.left,
  y: CIRCLES.minY - LABEL_ALLOWANCE.top,
  w: CIRCLES.maxX - CIRCLES.minX + LABEL_ALLOWANCE.left + LABEL_ALLOWANCE.right,
  h: CIRCLES.maxY - CIRCLES.minY + LABEL_ALLOWANCE.top + LABEL_ALLOWANCE.bottom,
};

function fitScale(box: { x: number; y: number; w: number; h: number }) {
  return (w: number, h: number) => {
    const s = Math.min(w / box.w, h / box.h);
    return {
      s,
      ox: (w - box.w * s) / 2 - box.x * s,
      oy: (h - box.h * s) / 2 - box.y * s,
    };
  };
}

/** `refScale` variant fitting the cropped circles box (see {@link CROP}). */
export const cropScale = fitScale(CROP);

/** `refScale` variant fitting the circles + facet labels box. */
export const cropLabeledScale = fitScale(CROP_LABELED);
