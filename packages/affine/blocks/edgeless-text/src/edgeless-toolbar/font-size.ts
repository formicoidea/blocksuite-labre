import { Bound } from '@labre/global/gfx';

/**
 * An edgeless text block has no `fontSize` prop — its visual text size is
 * `scale` applied to the page base font size (`--affine-font-base`, 15px).
 * The toolbar size selector converts between that scale and the pixel size
 * users actually reason about.
 */
export const EDGELESS_TEXT_BASE_FONT_SIZE = 15;

export function sizeFromScale(scale: number): number {
  return Math.round(scale * EDGELESS_TEXT_BASE_FONT_SIZE);
}

export function scaleFromSize(size: number): number {
  return size / EDGELESS_TEXT_BASE_FONT_SIZE;
}

/**
 * Rescale a block bound the same way corner (ratio-locked) resizing does:
 * top-left anchored, width and height proportional to the scale. This keeps
 * the real layout size (`w / scale`) untouched, so the text wrapping does not
 * change — only the rendered size does.
 */
export function boundForScale(
  bound: Bound,
  oldScale: number,
  newScale: number
): Bound {
  const ratio = newScale / oldScale;
  return new Bound(bound.x, bound.y, bound.w * ratio, bound.h * ratio);
}
