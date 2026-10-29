import type { Row } from '../view-manager/row.js';
import type { GroupTrait } from './trait.js';

/** Where a view draws a row: its group (`undefined` ungrouped), its index. */
export type RowLocation = {
  groupKey: string | undefined;
  rowIndex: number;
  rowId: string;
};

/**
 * The visible, unfolded groups of a view in drawing order, or the view's own
 * rows as one keyless group when it is not grouped.
 */
function drawnGroups(
  groupTrait: GroupTrait,
  rows: readonly Row[]
): { key: string | undefined; rows: readonly Row[] }[] {
  const groups = groupTrait.visibleGroups$.peek();
  if (!groups) return [{ key: undefined, rows }];
  return groups.filter(group => !groupTrait.collapsed$(group.key).peek());
}

/**
 * Where `rowId` is drawn, in the coordinates a table or a kanban selection
 * names: the visible group holding it and its index there. `undefined` when
 * no unfolded group draws it (filtered out, or in a hidden or folded group).
 */
export function locateRow(
  groupTrait: GroupTrait,
  rows: readonly Row[],
  rowId: string
): RowLocation | undefined {
  for (const group of drawnGroups(groupTrait, rows)) {
    const rowIndex = group.rows.findIndex(row => row.rowId === rowId);
    if (rowIndex >= 0) return { groupKey: group.key, rowIndex, rowId };
  }
  return undefined;
}

/** The first row a view draws, top of its first unfolded group. */
export function firstDrawnRow(
  groupTrait: GroupTrait,
  rows: readonly Row[]
): RowLocation | undefined {
  for (const group of drawnGroups(groupTrait, rows)) {
    const first = group.rows[0];
    if (first) return { groupKey: group.key, rowIndex: 0, rowId: first.rowId };
  }
  return undefined;
}
