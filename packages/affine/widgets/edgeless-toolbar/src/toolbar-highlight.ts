/**
 * The toolbar's buttons as the keyboard walks them: the quick tools on show,
 * then every senior tool, including the ones paged out of the senior window.
 */
export interface ToolbarRow {
  /** Quick tools rendered in the row (the hidden ones live in "more"). */
  quick: number;
  /** Senior tools, all of them. */
  senior: number;
  /** First senior tool on show. */
  scroll: number;
  /** How many senior tools the window shows. */
  size: number;
}

export interface ToolbarHighlight {
  /** `-1` when nothing is highlighted. */
  index: number;
  /** The senior window's first tool, moved so `index` is on show. */
  scroll: number;
}

/**
 * The senior window's first tool once `senior` is on show: unchanged when it
 * already is, else the least move that brings it in — the page the walk of
 * `stepToolbarHighlight` turns to when it reaches that tool.
 */
export function seniorScrollToShow(
  senior: number,
  row: Pick<ToolbarRow, 'scroll' | 'size'>
): number {
  const size = Math.max(1, row.size);
  if (senior < row.scroll) return senior;
  if (senior >= row.scroll + size) return senior - size + 1;
  return row.scroll;
}

/**
 * Step the toolbar highlight by one button, wrapping at both ends — the same
 * walk an open sub-menu does (`EdgelessCommandMenu.cycle`): nothing
 * highlighted yet, forwards lands on the first button and backwards on the
 * last. A senior tool paged out of the window pages it in, so the keyboard
 * reaches every framework the pointer reaches.
 */
export function stepToolbarHighlight(
  index: number,
  dir: 1 | -1,
  row: ToolbarRow
): ToolbarHighlight {
  const total = row.quick + row.senior;
  if (total === 0) return { index: -1, scroll: row.scroll };
  const entry = dir === 1 ? 0 : total - 1;
  const next =
    index < 0 || index >= total ? entry : (index + dir + total) % total;
  if (next < row.quick) return { index: next, scroll: row.scroll };
  return { index: next, scroll: seniorScrollToShow(next - row.quick, row) };
}
