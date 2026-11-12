import type { BlockSnapshot, NodeProps } from '@labre/store';

import { listStartNumber } from '../list-start-number.js';

const LIST_FLAVOUR = 'affine:list';

/**
 * The number of the numbered item at `o`: the start of its run of numbered
 * siblings (`listStartNumber` of the first), plus its place in that run;
 * stored `order`s past the first item are not read.
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
      parent: o.parent,
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
