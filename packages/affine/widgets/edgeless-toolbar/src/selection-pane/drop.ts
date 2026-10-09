import type { SelectionPaneNode } from '@labre/affine-block-surface';

/**
 * Where a row dragged in the selection pane lands — the pure half of the
 * pane's drag, kept apart from the DOM so the rule reads in one place.
 *
 * The pane shows a FLAT list of rows, and a gap between two of them can mean
 * several places at once: the gap under a group's last member is also the gap
 * after the group. A drag only ever moves a row inside its own sibling list
 * (a layer row among the layers, an element among the rows of its group or
 * layer — dropping INTO a layer is the layer header's business), so the gap is
 * read as the one slot it offers in THAT list, or as none.
 */

/** A visible row, as the drop rule reads it. */
export interface PaneDropRow {
  node: SelectionPaneNode;
  depth: number;
  /** The row it is listed under, `''` at the top level. */
  parent: string;
}

/** The sibling lists of the tree BEFORE any filter, keyed by parent id. */
export interface PaneLists {
  readonly lists: ReadonlyMap<string, readonly SelectionPaneNode[]>;
  readonly parentOf: ReadonlyMap<string, string>;
}

export function paneLists(full: readonly SelectionPaneNode[]): PaneLists {
  const lists = new Map<string, readonly SelectionPaneNode[]>();
  const parentOf = new Map<string, string>();
  const walk = (list: readonly SelectionPaneNode[], parent: string) => {
    lists.set(parent, list);
    for (const node of list) {
      parentOf.set(node.id, parent);
      if (node.children) walk(node.children, node.id);
    }
  };
  walk(full, '');
  return { lists, parentOf };
}

/** A place in one sibling list. */
export interface PaneSlot {
  /** The list's parent id, `''` at the top level. */
  parent: string;
  /** Position in the FULL list, 0 being the top. */
  index: number;
  /** How deep that list's rows sit, for the drop line's indent. */
  depth: number;
}

/**
 * The slot that the visible gap `gap` — between `rows[gap - 1]` and
 * `rows[gap]` — offers in the list `parent`, or `null`.
 *
 * The gap is "before" the row under it when that row is in the list; else
 * "after" the row above it, or after any ancestor of that row whose subtree
 * ends at this gap (dropping under a group's last member, or a layer's, means
 * after the group or the layer). Positions are read in the FULL list, so a
 * filtered view never computes a neighbour it is not showing.
 */
export function paneSlotAtGap(
  rows: readonly PaneDropRow[],
  gap: number,
  parent: string,
  { lists, parentOf }: PaneLists
): PaneSlot | null {
  const list = lists.get(parent);
  if (!list) return null;
  const above = rows[gap - 1];
  const below = rows[gap];
  const depthOf = (id: string) => rows.find(row => row.node.id === id)?.depth;

  if (below && below.parent === parent) {
    const index = list.findIndex(node => node.id === below.node.id);
    if (index !== -1) return { parent, index, depth: below.depth };
  }
  if (!above || below?.parent === above.node.id) return null;

  // The ancestors the row under the gap is still inside: the gap does not
  // end their subtree.
  const open = new Set<string>();
  for (let id = below?.parent ?? ''; id !== ''; id = parentOf.get(id) ?? '') {
    open.add(id);
  }

  let id = above.node.id;
  let listedIn = above.parent;
  for (;;) {
    if (listedIn === parent) {
      const index = list.findIndex(node => node.id === id);
      const depth = depthOf(id);
      if (index === -1 || depth === undefined) return null;
      return { parent, index: index + 1, depth };
    }
    if (listedIn === '' || open.has(listedIn)) return null;
    id = listedIn;
    listedIn = parentOf.get(id) ?? '';
  }
}

/**
 * What a drop at `index` of `list` writes for the dragged rows `dragged` (one
 * id, or the set a multi-row drag moves): the model they land directly ABOVE
 * (`null` = the bottom of their stack), or `null` when the slot is refused.
 *
 * `stackOf(id)` names the model that stands for a row in the dragged rows'
 * own stack — itself, or the frame it belongs to when the dragged row is a
 * loose element and that row is a frame's member (a frame's members paint
 * together, right above it) — or `undefined` for a row that is not in that
 * stack at all. A slot is refused when neither neighbour is in the stack, or
 * when both stand for the same model: the inside of a frame's block of rows,
 * where a loose element cannot be put. A row that stands for a dragged model
 * (a dragged frame's member) moves with it, so it is no neighbour either.
 */
export function paneDropAbove(
  list: readonly SelectionPaneNode[],
  index: number,
  dragged: string | ReadonlySet<string>,
  stackOf: (id: string) => string | undefined
): { above: string | null } | null {
  const moving = typeof dragged === 'string' ? new Set([dragged]) : dragged;
  const stays = (node: SelectionPaneNode) =>
    !moving.has(node.id) && !moving.has(stackOf(node.id) ?? '');
  const before = list.slice(0, index).filter(stays);
  const after = list.slice(index).filter(stays);
  const upper = before.length
    ? stackOf(before[before.length - 1].id)
    : undefined;
  const lower = after.length ? stackOf(after[0].id) : undefined;
  if (upper === undefined && lower === undefined) return null;
  if (upper !== undefined && upper === lower) return null;
  for (const node of after) {
    const model = stackOf(node.id);
    if (model !== undefined) return { above: model };
  }
  return { above: null };
}
