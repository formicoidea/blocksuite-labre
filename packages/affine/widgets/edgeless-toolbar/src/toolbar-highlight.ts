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
  const senior = next - row.quick;
  const size = Math.max(1, row.size);
  if (senior < row.scroll) return { index: next, scroll: senior };
  if (senior >= row.scroll + size) {
    return { index: next, scroll: senior - size + 1 };
  }
  return { index: next, scroll: row.scroll };
}
