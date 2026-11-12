/** The largest list start CommonMark reads back: nine digits. */
const MAX_LIST_START = 999_999_999;

/**
 * The `start` a new numbered list node writes on export, or `undefined` to
 * write none. A numbered list may not start at 1 (it continues after a
 * paragraph or a code block, or was typed as `3.`): its first block's stored
 * `order` is that number, and the Markdown and HTML imports read it back from
 * `start`, so both exports must write it (#658, upstream AFFiNE#15726).
 *
 * A list at 1, without an order, or with a non-integer one (a hand-edited
 * document) writes nothing and exports exactly as before. So does one past
 * nine digits: the typing shortcut accepts any number of digits
 * (`list/src/markdown.ts`), but a `1234567890.` start reads back as a
 * paragraph, where a list restarting at 1 reads back as a list.
 */
export function listStartNumber(
  props: Record<string, unknown>
): number | undefined {
  const order = props.order;
  if (props.type !== 'numbered' || typeof order !== 'number') return undefined;
  return Number.isInteger(order) && order > 1 && order <= MAX_LIST_START
    ? order
    : undefined;
}
