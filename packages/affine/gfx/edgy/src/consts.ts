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
 * Bounding box of the three circles in reference coords (small padding). The
 * REF margins around it only exist for the facet name labels — when a diagram
 * hides them (`cropToCircles`), the renderer fits THIS box into the element
 * bounds instead, so the background hugs the Venn.
 */
export const CROP = (() => {
  const pad = 8;
  const ax = VENN.cx - 0.866 * VENN.r0; // Identity / Architecture centres
  const abY = VENN.cy - 0.5 * VENN.r0;
  const cY = VENN.cy + VENN.r0; // Experience centre
  const minX = ax - VENN.R - pad;
  const maxX = VENN.cx + 0.866 * VENN.r0 + VENN.R + pad;
  const minY = abY - VENN.R - pad;
  const maxY = cY + VENN.R + pad;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
})();

/**
 * Crop box KEEPING room for the three facet name labels (drawn outside the
 * circles): the circles box plus a fixed text allowance left/right and below.
 * Used when a cropped diagram still shows its labels.
 */
export const CROP_LABELED = (() => {
  const sideAllowance = 140; // label offset (10) + text width headroom
  const bottomAllowance = 35; // experience label below the bottom circle
  return {
    x: CROP.x - sideAllowance,
    y: CROP.y,
    w: CROP.w + 2 * sideAllowance,
    h: CROP.h + bottomAllowance,
  };
})();

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
