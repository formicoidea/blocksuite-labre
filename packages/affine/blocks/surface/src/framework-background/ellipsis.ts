/**
 * Cutting a background label down to the room it is given.
 *
 * A pool's participant name and its lane names are written along a band that
 * holds exactly ONE line — the 28-unit participant band and the 24-unit lane
 * strip of the BPMN pool. A name longer than the band used to run past its end,
 * across the frame and into the next lane, because the primitive drew every
 * text with a single `fillText` and never measured it. Wrapping cannot help in
 * a one-line band, and growing the band would write geometry because somebody
 * typed a name; so the words are cut instead, with an ellipsis, and the STORED
 * name stays whole (the rename editor shows it in full).
 *
 * Measured on the context the label is painted on, with the font already set,
 * so the cut matches what is drawn — on screen and in the SVG export, which
 * paints through these same renderers with real text metrics. The text package
 * has its own `truncateTextByWidth`, but `gfx/text` sits above this package and
 * cannot be imported from it; this is the same idea, measured by the context.
 */

/** The mark a cut label ends with. */
export const BACKGROUND_TEXT_ELLIPSIS = '…';

/**
 * Model units kept clear at each end of the room a fitted label is given, so a
 * cut name never touches the frame it is written against.
 */
export const BACKGROUND_TEXT_FIT_PADDING = 4;

/**
 * `words` as drawn in at most `room` units of the context's current font: the
 * text itself when it fits, otherwise its longest prefix that still fits once
 * an ellipsis is appended, and nothing when even the ellipsis is too wide.
 *
 * Cut on code points, not UTF-16 units, so an emoji in a lane name is never
 * split into a lone surrogate.
 */
export function ellipsizeToWidth(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  words: string,
  room: number
): string {
  if (!words) return words;
  if (!(room > 0)) return '';
  if (ctx.measureText(words).width <= room) return words;
  if (ctx.measureText(BACKGROUND_TEXT_ELLIPSIS).width > room) return '';

  const chars = Array.from(words);
  // Binary search on the prefix length: the widest prefix whose ellipsized
  // form still fits. Width grows with the prefix, so the predicate is monotone.
  let lo = 0;
  let hi = chars.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = chars.slice(0, mid).join('') + BACKGROUND_TEXT_ELLIPSIS;
    if (ctx.measureText(candidate).width <= room) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join('').trimEnd() + BACKGROUND_TEXT_ELLIPSIS;
}
