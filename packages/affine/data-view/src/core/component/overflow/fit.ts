/**
 * Which items of an overflowing row are drawn, from measured widths (the
 * view bar's tabs, ADR 0035 B11, labre PRD REQ-DB-7: "as many tabs as the
 * width allows, the rest under N more").
 *
 * - Everything fits: every item is drawn and the trailing slot holds only
 *   what it holds when nothing is hidden (`trailing`, the "+" of the view
 *   bar).
 * - Otherwise the trailing slot also holds the "N more" button
 *   (`moreExtra` wider), and the items are drawn in order while they fit,
 *   stopping at the first that does not: the order of the row is the order
 *   of the views, never reshuffled to pack more in.
 * - The `pinned` item (the current view) is always drawn, even alone and
 *   wider than the room: a view you are looking at never hides under "more".
 *   Its room is reserved first, so it takes the place of the last item that
 *   would have fitted.
 *
 * Returns the drawn indices in ascending order.
 */
export function fitOverflow(input: {
  widths: readonly number[];
  container: number;
  trailing: number;
  moreExtra: number;
  pinned?: number;
}): number[] {
  const { widths, container, trailing, moreExtra } = input;
  const pinned =
    input.pinned !== undefined &&
    input.pinned >= 0 &&
    input.pinned < widths.length
      ? input.pinned
      : -1;
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total + trailing <= container) {
    return widths.map((_, index) => index);
  }
  const budget = container - trailing - moreExtra;
  const drawn: number[] = [];
  let used = pinned >= 0 ? (widths[pinned] ?? 0) : 0;
  for (let index = 0; index < widths.length; index++) {
    if (index === pinned) continue;
    const width = widths[index] ?? 0;
    if (used + width > budget) break;
    drawn.push(index);
    used += width;
  }
  if (pinned >= 0) {
    drawn.push(pinned);
    drawn.sort((a, b) => a - b);
  }
  return drawn;
}
