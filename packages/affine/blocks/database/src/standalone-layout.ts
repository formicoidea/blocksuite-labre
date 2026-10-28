import { getScrollContainer } from '@labre/affine-shared/utils';

/** What the measure reads of the database block element. */
export type StandaloneCandidate = HTMLElement & {
  readonly rootComponent: Element | null;
};

/**
 * Whether a database block is drawn as the page itself rather than inside a
 * text (ADR 0035 amendment of 2026-10-28): a full page whose heading is the
 * database's name and whose only scroller holds both.
 *
 * Two facts measured in the DOM, never stored and never read from a prop:
 * - the block's parent block element is the root component: inline, a
 *   database always sits in a note; the full page's root
 *   (`affine-database-page-root`) renders the block directly;
 * - its scroll container holds a `<doc-title>` whose `body-block-id` names
 *   this block (`<doc-title .bodyBlockId>`, reflected): the page heading the
 *   host composed above it. Without one, the page renders the database as
 *   inline, its own title row shown.
 *
 * The parent test comes first: it fails at once for every inline database,
 * so a text page never pays for the scroll-container walk.
 */
export function isStandaloneDatabase(
  element: StandaloneCandidate,
  blockId: string
): boolean {
  const root = element.rootComponent;
  if (!root) return false;
  if (element.parentElement?.closest('[data-block-id]') !== root) return false;
  const container = getScrollContainer(element);
  return !!container.querySelector(
    `doc-title[body-block-id="${CSS.escape(blockId)}"]`
  );
}
