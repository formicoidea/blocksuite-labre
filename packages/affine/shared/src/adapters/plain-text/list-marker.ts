import type { BlockSnapshot, NodeProps } from '@labre/store';

const LIST_FLAVOUR = 'affine:list';

/** The largest list number CommonMark reads back: nine digits. */
const MAX_LIST_NUMBER = 999_999_999;

/**
 * How many items the list opened at `o` holds: `o` itself and the siblings
 * after it of the same list type, which the exports merge into that list.
 */
function itemCount(o: NodeProps<BlockSnapshot>): number {
  const siblings = o.parent?.node.children;
  if (!siblings || o.index === null) return 1;
  let count = 1;
  for (let i = o.index + 1; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (
      sibling.flavour !== o.node.flavour ||
      sibling.props.type !== o.node.props.type
    ) {
      break;
    }
    count++;
  }
  return count;
}

/**
 * The number a numbered list opened at `o` starts from on export, or
 * `undefined` for 1. Its first block's stored `order` (a list continuing
 * after a paragraph, or typed as `3.`), unless the list's LAST number would
 * pass nine digits: CommonMark reads no list number past nine digits, so the
 * Markdown export writes no start then, and the plain text numbers alike.
 * The same rule as the Markdown and HTML exports (#658, upstream
 * AFFiNE#15726).
 */
function listStartNumber(o: NodeProps<BlockSnapshot>): number | undefined {
  const { type, order } = o.node.props;
  if (type !== 'numbered' || typeof order !== 'number') return undefined;
  if (!Number.isInteger(order) || order <= 1) return undefined;
  return order + itemCount(o) - 1 <= MAX_LIST_NUMBER ? order : undefined;
}

/**
 * The number of the numbered item at `o`, counted the way the Markdown export
 * numbers it: the start of its run of numbered siblings, plus its place in
 * that run (stored `order`s past the first item are not read).
 */
function itemNumber(o: NodeProps<BlockSnapshot>): number {
  const siblings = o.parent?.node.children;
  if (!siblings || o.index === null) return listStartNumber(o) ?? 1;
  let first = o.index;
  while (
    first > 0 &&
    siblings[first - 1].flavour === LIST_FLAVOUR &&
    siblings[first - 1].props.type === 'numbered'
  ) {
    first--;
  }
  const start =
    listStartNumber({
      node: siblings[first],
      next: siblings[first + 1] ?? null,
      parent: o.parent,
      prop: o.prop,
      index: first,
    }) ?? 1;
  return start + o.index - first;
}

/**
 * What the Markdown export writes before the text of the item at `o`, minus
 * the bullet character: `1. ` for a numbered item, two characters for any
 * other. A nested list is indented by that width, as Markdown indents it.
 */
function markdownMarkerWidth(o: NodeProps<BlockSnapshot>): number {
  return o.node.props.type === 'numbered' ? `${itemNumber(o)}. `.length : 2;
}

/**
 * The prefix of a list item in plain text (the export and the `text/plain`
 * copy): its indentation, then its marker. A bulleted item writes `- `, a
 * numbered one `1. ` from its list's start, a to-do `[ ] ` or `[x] `, and a
 * toggle `- `, the bullet the Markdown export writes for it (Markdown has no
 * toggle). A sub-list is indented the way the Markdown export indents it, by
 * the width of each parent item's marker (2 under a bullet, 3 under `1. `),
 * so the text pasted into a Markdown tool keeps its nesting.
 */
export function listPlainTextPrefix(o: NodeProps<BlockSnapshot>): string {
  let indent = 0;
  for (let parent = o.parent; parent; parent = parent.parent) {
    if (parent.node.flavour !== LIST_FLAVOUR) break;
    indent += markdownMarkerWidth(parent);
  }
  const { type, checked } = o.node.props;
  let marker = '- ';
  if (type === 'numbered') marker = `${itemNumber(o)}. `;
  else if (type === 'todo') marker = checked === true ? '[x] ' : '[ ] ';
  return ' '.repeat(indent) + marker;
}
