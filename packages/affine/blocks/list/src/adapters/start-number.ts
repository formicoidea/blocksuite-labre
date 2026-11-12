import type { BlockSnapshot, NodeProps } from '@labre/store';

/** The largest list number CommonMark reads back: nine digits. */
const MAX_LIST_NUMBER = 999_999_999;

/**
 * How many items the list opened at `o` holds: `o` itself and the siblings
 * after it of the same list type, which both exports merge into that list.
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
 * The `start` a new numbered list node writes on export, or `undefined` to
 * write none. A numbered list may not start at 1 (it continues after a
 * paragraph or a code block, or was typed as `3.`): its first block's stored
 * `order` is that number, and the Markdown and HTML imports read it back from
 * `start`, so both exports must write it (#658, upstream AFFiNE#15726).
 *
 * A list at 1, without an order, or with a non-integer one (a hand-edited
 * document) writes nothing and exports exactly as before. So does one whose
 * LAST number would pass nine digits: Markdown numbers the items from the
 * start (`999999999.` then `1000000000.`), CommonMark reads no list number
 * past nine digits, so the overflowing item would fold into the one before
 * it, and the `1234567890. ` typing shortcut takes any number of digits
 * (`list/src/markdown.ts`). One rule for both formats, though `<ol start>`
 * has no limit: the two exports of a document then number it alike, and an
 * HTML copy pasted into a Markdown tool converts without the overflow.
 */
export function listStartNumber(
  o: NodeProps<BlockSnapshot>
): number | undefined {
  const { type, order } = o.node.props;
  if (type !== 'numbered' || typeof order !== 'number') return undefined;
  if (!Number.isInteger(order) || order <= 1) return undefined;
  return order + itemCount(o) - 1 <= MAX_LIST_NUMBER ? order : undefined;
}
