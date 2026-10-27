import { DESCRIPTION_PLACEHOLDER } from './consts';
import { C4_ROLE } from './roles';
import { technologyOfTypeLine, TYPE_TECHNOLOGY_PLACEHOLDER } from './type-line';

export { type C4TierBox, type C4TierBoxes, c4TierBoxes } from './tier-boxes';

/* ── Which text belongs to which node ──────────────────────────────────── */

/**
 * The little a resolution needs to know about a text element — an id, a role,
 * and whatever it says.
 *
 * `text` is `unknown` because on a real element it is a `Y.Text` and in a test
 * it is a string, and this module has no business knowing which: it is read
 * through {@link c4TierText}, which stringifies whatever it is given. That is
 * also what keeps this file free of a Yjs import.
 */
export interface C4TierElement {
  id: string;
  role?: string;
  text?: unknown;
}

/** The little a resolution needs to know about a group. */
export interface C4ComponentGroup {
  id: string;
  childIds: readonly string[];
}

/** The three tiers of one node's component — any of them may be absent. */
export interface C4ComponentTiers {
  title?: C4TierElement;
  typeLine?: C4TierElement;
  description?: C4TierElement;
}

/**
 * The tiers of the component a node belongs to — `{}` when it belongs to none.
 *
 * ## Group membership, then roles
 *
 * The group answers "which words are THIS node's" — two containers side by side
 * both have a `[Container: …]` under them, and only the grouping says which is
 * which. The role then answers "which of these words is the type line", which
 * position in `children` cannot: a group's child order is an implementation
 * detail that a reorder, a copy or a regroup rewrites, while a role is written
 * on the element and travels with it.
 *
 * ## What a bare node resolves to, and why that is the right answer
 *
 * `{}` — no name, no technology, no description. Which is exactly what happens
 * to a node whose group was released (native "ungroup"), to one whose texts were
 * deleted, and to one drawn before this change. None of those is an error and
 * none of them is guessed at: an element with no words on it states nothing, and
 * the export says so by writing nothing. The picture is still a C4 element — the
 * role is on the shape and survives everything.
 *
 * The NAME is the one tier with somewhere else to look, and only for the last of
 * those three: an element drawn before the title became a child keeps its name
 * in the shape's own inner text. See {@link c4StatedName}.
 *
 * The FIRST group holding the node wins, and the first text of each role in it.
 * Groups nest, so a component grouped again inside a bigger group has two
 * ancestors; document order picks the one written first, which is the innermost
 * the creation site made.
 */
export function c4ComponentTiers(
  nodeId: string,
  groups: readonly C4ComponentGroup[],
  texts: readonly C4TierElement[]
): C4ComponentTiers {
  const siblings = new Set(c4ComponentSiblings(nodeId, groups));
  if (siblings.size === 0) return {};

  const tiers: C4ComponentTiers = {};
  for (const text of texts) {
    if (!siblings.has(text.id)) continue;
    if (text.role === C4_ROLE.title) tiers.title ??= text;
    else if (text.role === C4_ROLE['type-line']) tiers.typeLine ??= text;
    else if (text.role === C4_ROLE.description) tiers.description ??= text;
  }
  return tiers;
}

/**
 * Everything grouped with this element — `[]` when it is grouped with nothing.
 *
 * The other direction of the same question {@link c4ComponentTiers} asks, and
 * the one the commit hook needs: given a type line somebody has just finished
 * typing into, which shape does it belong to, so its kind can supply the word?
 *
 * The element itself is among the siblings, which is what the id list actually
 * says and what saves the caller from reasoning about whether it was excluded.
 */
export function c4ComponentSiblings(
  elementId: string,
  groups: readonly C4ComponentGroup[]
): readonly string[] {
  const group = groups.find(candidate =>
    candidate.childIds.includes(elementId)
  );
  return group ? group.childIds : [];
}

/* ── What a tier actually states ───────────────────────────────────────── */

/** Whatever a tier says, as a plain trimmed string. */
export function c4TierText(tier: C4TierElement | undefined): string {
  const value = tier?.text;
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * The NAME a component states — its `c4:title` tier if it has one, and the
 * shape's own inner text if it has not.
 *
 * ## No placeholder suppression, unlike the other two
 *
 * A fresh element's title reads `Container`, and that goes into the export
 * verbatim. It is not a prompt standing in for a value the way
 * `[Container: technology]` is: an unnamed container IS a container, and
 * `Container(x, "Container")` is a true statement about a box somebody drew and
 * has not named yet. Blanking it would hand the reader `?` instead — less
 * information, not more honesty. The other two tiers suppress their prompts
 * because "built with a technology called technology" is not true of anything.
 *
 * ## The fallback, and who needs it
 *
 * An element drawn before 28/08/2026 keeps its name in the SHAPE's native inner
 * text, which is where that iteration put it, and it has no title child at all.
 * That is the whole of the compatibility story and it costs one `??`: nothing is
 * migrated, nothing is rewritten, and such an element exports exactly as it
 * always did. The test is EXISTENCE of the tier, not whether it is empty — a
 * component whose title the author deliberately cleared has been cleared, and
 * reaching past it to a shape text that is not there either would say nothing
 * different anyway.
 */
export function c4StatedName(
  tiers: C4ComponentTiers,
  shapeText: unknown
): string {
  if (tiers.title) return c4TierText(tiers.title);
  return shapeText === null || shapeText === undefined
    ? ''
    : String(shapeText).trim();
}

/**
 * The technology a component STATES — `''` when it states none.
 *
 * The one place the creation placeholder is read as "nothing yet". Every tier
 * exists from the moment a component is drawn, so an element nobody has typed on
 * carries a literal `[Container: technology]`; exporting that as a technology
 * would put the word "technology" in the technology slot of a file somebody is
 * about to paste into a renderer.
 *
 * Deliberately NOT done in `technologyOfTypeLine`, which the commit hook also
 * calls: normalising the placeholder to "nothing" would let a focus-and-blur
 * silently rewrite `[Container: technology]` to `[Container]` and eat the
 * stencil's own prompt. Reading and rewriting are different questions, and only
 * the reader gets to be opinionated.
 *
 * The comparison is on the WORD rather than on the whole line, so it holds for
 * every kind and for a placeholder an author moved brackets around.
 */
export function c4StatedTechnology(tier: C4TierElement | undefined): string {
  const technology = technologyOfTypeLine(c4TierText(tier));
  return technology.toLowerCase() === TYPE_TECHNOLOGY_PLACEHOLDER
    ? ''
    : technology;
}

/** The description a component STATES — `''` for the untouched placeholder. */
export function c4StatedDescription(tier: C4TierElement | undefined): string {
  const description = c4TierText(tier);
  return description.toLowerCase() === DESCRIPTION_PLACEHOLDER
    ? ''
    : description;
}
