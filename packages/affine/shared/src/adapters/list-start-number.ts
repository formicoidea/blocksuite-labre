import type { BlockSnapshot, NodeProps } from '@labre/store';

/** The largest list number CommonMark reads back: nine digits. */
const MAX_LIST_NUMBER = 999_999_999;

/** A list block as a snapshot walker visits it: what the rule reads. */
type ListBlockAt = Pick<NodeProps<BlockSnapshot>, 'node' | 'parent' | 'index'>;

/**
 * How many items the list opened at `o` holds: `o` itself and the siblings
 * after it of the same flavour and list type, which a written list merges.
 */
function itemCount(o: ListBlockAt): number {
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
 * The number a numbered list opened at `o` starts from when it is written
 * out (#658, upstream AFFiNE#15726), or `undefined` to write no start, which
 * reads as 1. A numbered list may not start at 1: it continues after a
 * paragraph or a code block, or was typed as `3.`, and its first block's
 * stored `order` is that number.
 *
 * A list at 1, without an order, or with a non-integer one (a hand-edited
 * document) has no start. Neither has one whose LAST number would pass nine
 * digits: the items are numbered from the start (`999999999.` then
 * `1000000000.`), CommonMark reads no list number past nine digits, so the
 * overflowing item would fold into the one before it; the `1234567890. `
 * typing shortcut takes any number of digits (`list/src/markdown.ts`). One
 * rule for every format, though an HTML `<ol start>` has no limit: the
 * formats of one document then number a list alike, and an HTML copy pasted
 * into a Markdown tool converts without the overflow.
 */
export function listStartNumber(o: ListBlockAt): number | undefined {
  const { type, order } = o.node.props;
  if (type !== 'numbered' || typeof order !== 'number') return undefined;
  if (!Number.isInteger(order) || order <= 1) return undefined;
  return order + itemCount(o) - 1 <= MAX_LIST_NUMBER ? order : undefined;
}
