import { getFontString, wrapText } from '@labre/affine-gfx-text';

import type { UmlTierWrap } from '../component.js';

/** The type face a canvas text element is painted in. */
export interface UmlTierFace {
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: string;
  fontWeight?: string;
}

/**
 * How the canvas renderer would break ONE line of this tier at `width`.
 *
 * The one DOM-aware measurement in the UML pack, and it is deliberately the
 * renderer's own: `getFontString` builds the very string the text renderer sets
 * on the canvas context and `wrapText` is the very function it wraps with
 * (`gfx/text`'s `element-renderer`), so a compartment sized from this holds
 * exactly the lines the reader ends up seeing. A re-implementation here — a
 * word-break of our own, a line height of our own — would agree with the picture
 * on the day it was written and drift on the first change to either.
 *
 * ## Why it is a function of the LINE and not of the tier
 *
 * Because that is the seam {@link umlTierLineCount} needs to stay pure: it owns
 * "the author's newlines are lines too", this owns "and this one is painted as
 * three". Splitting them is what lets the counting be tested against a fake
 * wrapper in a `happy-dom` unit run, where `measureText` answers nothing useful.
 *
 * `width` is the COMPARTMENT's width — `w - 2 × inset` on the node — and not the
 * tier element's current one: the text editor shrink-wraps the element it is
 * mounted on while the author types, so the box on the model at commit time is
 * the size of the words rather than of the compartment they are going back into.
 *
 * `undefined` for an element that states no face and for a width no text could
 * be laid out in, and that is the honest answer rather than a guard: an element
 * with no font is one nothing has painted, so there is no wrapping it HAS, and
 * {@link umlTierLineCount} falls back to the author's own newlines — which is
 * exactly what a pure fixture wants to be measured by.
 */
export function umlTierWrapper(
  face: UmlTierFace,
  width: number
): UmlTierWrap | undefined {
  const { fontFamily, fontSize, fontStyle, fontWeight } = face;
  if (!fontFamily || typeof fontSize !== 'number' || !fontWeight) {
    return undefined;
  }
  if (!(width > 0)) return undefined;

  const font = getFontString({
    fontFamily,
    fontSize,
    fontStyle: fontStyle ?? 'normal',
    fontWeight,
  });
  return line => wrapText(line, font, width).split('\n').length;
}
