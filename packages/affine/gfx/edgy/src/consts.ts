/**
 * Visual constants for the EDGY "Enterprise Design Facets" diagram.
 *
 * The whole diagram is authored in a FIXED reference coordinate space
 * (`REF_W × REF_H`, matching the validated mockup) and the renderer scales it
 * uniformly to the element bounds — so the three circles always stay circular
 * and the pictos/labels keep their relative proportions at any size.
 */

import { refScale as fitReference } from '@labre/affine-block-surface';

import { REF_H, REF_W } from './facets-crop';

// The reference geometry lives in an editor-free file (`facets-crop.ts`) so the
// toolbox can size a facets background without the surface index; every
// binding is re-exported here unchanged.
export {
  CROP,
  CROP_LABELED,
  cropLabeledScale,
  cropScale,
  REF_H,
  REF_W,
  VENN,
} from './facets-crop';

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
 *
 * The fit itself is the library's ({@link fitReference}, R37): only the
 * reference size is this framework's business.
 */
export function refScale(w: number, h: number) {
  return fitReference(w, h, REF_W, REF_H);
}
