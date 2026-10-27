/**
 * Fitting a background label to the room it is given: cut it, or wrap it.
 *
 * A pool's participant name and its lane names are written ALONG a band — the
 * participant band and the lane strip of the BPMN pool. A name longer than the
 * band used to run past its end, across the frame and into the next lane,
 * because the primitive drew every text with a single `fillText` and never
 * measured it. Two answers live here, both opt-in per declaration:
 *
 * - `'ellipsis'` cuts the words to ONE line with "…" (PR #532);
 * - `'wrap'` breaks them on words into several lines stacked ACROSS the band,
 *   and the band grows to hold them (`band-widths.ts`), up to a declared
 *   `maxLines`, past which the last line is cut with "…" all the same. The PO
 *   asked for this one over the cut (2026-10-27): a band that thickens with its
 *   name reads as a title, a cut name reads as a bug.
 *
 * Either way the STORED name stays whole (the rename editor shows it in full),
 * and nothing is written to the document: the band's thickness is derived at
 * paint time from what is painted.
 *
 * Measured on the context the label is painted on, with the font already set,
 * so the fit matches what is drawn — on screen and in the SVG export, which
 * paints through these same renderers with real text metrics. The text package
 * has its own `truncateTextByWidth`, but `gfx/text` sits above this package and
 * cannot be imported from it; this is the same idea, measured by the context.
 */

/** The mark a cut label ends with. */
export const BACKGROUND_TEXT_ELLIPSIS = '…';

/**
 * Model units kept clear at each end of the room a fitted label is given, so a
 * cut name never touches the frame it is written against. A wrapped label keeps
 * the same clearance on each side ACROSS its band.
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

/**
 * `words` broken on whitespace into at most `maxLines` lines of at most `room`
 * units each, in the context's current font.
 *
 * Greedy, which is what every text renderer in the product does: a word goes
 * on the current line while the line still fits. A single word wider than the
 * room keeps a line of its own and is cut with "…" — a lane named by one long
 * identifier still shows its start rather than nothing. When the words do not
 * fit in `maxLines`, the last line takes everything left over and is cut, so
 * the "…" says there is more, exactly as the one-line cut always did.
 *
 * Empty for empty or blank words and for a room with no width: there is
 * nothing to draw, and no line to make a band thicker for.
 */
export function wrapToWidth(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  words: string,
  room: number,
  maxLines: number
): string[] {
  if (!(room > 0)) return [];
  const tokens = words.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const limit = Math.max(1, Math.floor(maxLines));

  const lines: string[] = [];
  let current = '';
  let i = 0;
  for (; i < tokens.length; i++) {
    const candidate = current ? `${current} ${tokens[i]}` : tokens[i];
    if (!current || ctx.measureText(candidate).width <= room) {
      current = candidate;
      continue;
    }
    if (lines.length === limit - 1) break;
    lines.push(current);
    current = tokens[i];
  }
  // Out of lines with words still waiting: the last line carries them all, and
  // the cut below ends it with "…".
  if (i < tokens.length) current = [current, ...tokens.slice(i)].join(' ');
  lines.push(current);

  return lines
    .map(line => ellipsizeToWidth(ctx, line, room))
    .filter(line => line !== '');
}
