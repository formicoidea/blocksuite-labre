import type { C4NodeKind } from '@labre/affine-model';

import {
  DESCRIPTION_FONT_SIZE,
  DESCRIPTION_LINES,
  DESCRIPTION_PLACEHOLDER,
  INNER_FONT_SIZE,
  PERSON_BODY_TOP,
  TIER_BLANK_LINE,
  TIER_LINE_HEIGHT,
  TIER_SIDE_INSET,
  TITLE_LINE_HEIGHT,
  TITLE_TOP_MARGIN,
  TYPE_FONT_SIZE,
} from './consts';
import { C4_ROLE } from './roles';
import { technologyOfTypeLine, TYPE_TECHNOLOGY_PLACEHOLDER } from './type-line';

/**
 * A C4 component — the SHAPE and its own words, grouped.
 *
 * ## What the PO's recette of 28/08/2026 changed
 *
 * A C4 element used to be one shape carrying a title, plus two fields edited in
 * a "Details" popover and painted underneath by the renderer. The verdict was
 * that the popover is the wrong mechanism: an architect writes ON the picture.
 * So a component is now a native `group` holding three elements —
 *
 *  1. the `c4Node` shape, whose native inner text is the TITLE;
 *  2. a canvas `text` element carrying the type line, `[Container: Java]`;
 *  3. a canvas `text` element carrying the description —
 *
 * and every one of the three is edited in place, on a double-click, exactly like
 * any other words on the canvas. There is no form left.
 *
 * ## This module
 *
 * The two questions that arise from that arrangement, both PURE and both free of
 * `std`, so the creation site, the exporter, the commit hook and a test all
 * answer them the same way:
 *
 *  - **where do the tiers go**, given a node's box ({@link c4TierBoxes});
 *  - **which text belongs to which node**, given a flat list of elements
 *    ({@link c4ComponentTiers}) — resolved by GROUP MEMBERSHIP plus the role
 *    stamped on each text, never by position in `children`.
 *
 * The role stays on the SHAPE alone; the group carries none (`roles.ts`).
 */

/* ── Where the tiers go ────────────────────────────────────────────────── */

/** A box in the same units and origin as the node's own. */
export interface C4TierBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface C4TierBoxes {
  typeLine: C4TierBox;
  description: C4TierBox;
}

/**
 * The two text boxes of a component, laid out against the node's own box.
 *
 * The stack is the stencil's: the name at roughly three-tenths of the height,
 * the type line opening where the name's line box closes, and the description a
 * blank line under that. Every step is a multiple of a font size rather than an
 * absolute, so the three tiers stay in proportion at whatever size the node is
 * created at — which is what a person needs, its box being 244 tall where every
 * other kind's is 148.
 *
 * The person's `bodyTop` is the one asymmetry and it is the stencil's: its head
 * stands clear ABOVE a body of the standard height, and its words are laid out
 * in the BODY (`v:textRect` is the body box exactly), so the whole stack starts
 * below the head rather than across it.
 *
 * A creation-time answer and nothing more. The tiers are real elements from the
 * moment they are drawn: an author who moves one has moved it, and nothing here
 * runs again to put it back.
 */
export function c4TierBoxes(
  kind: C4NodeKind,
  x: number,
  y: number,
  w: number,
  h: number
): C4TierBoxes {
  const bodyTop =
    kind === 'person' || kind === 'person-ext' ? h * PERSON_BODY_TOP : 0;
  const inset = w * TIER_SIDE_INSET;
  const width = w - inset * 2;

  // Where the title's own line box closes — the same arithmetic the creation
  // site pads the shape's inner text by, plus one line of it.
  const titleBottom =
    bodyTop +
    (h - bodyTop) * TITLE_TOP_MARGIN +
    INNER_FONT_SIZE * TITLE_LINE_HEIGHT;

  const typeHeight = TYPE_FONT_SIZE * TIER_LINE_HEIGHT;
  const descriptionTop =
    titleBottom + typeHeight + DESCRIPTION_FONT_SIZE * TIER_BLANK_LINE;

  return {
    typeLine: { x: x + inset, y: y + titleBottom, w: width, h: typeHeight },
    description: {
      x: x + inset,
      y: y + descriptionTop,
      w: width,
      h: DESCRIPTION_FONT_SIZE * TIER_LINE_HEIGHT * DESCRIPTION_LINES,
    },
  };
}

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

/** The two tiers of one node's component — either may be absent. */
export interface C4ComponentTiers {
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
 * `{}` — no tiers, no technology, no description. Which is exactly what happens
 * to a node whose group was released (native "ungroup"), to one whose texts were
 * deleted, and to one drawn before this change. None of those is an error and
 * none of them is guessed at: an element with no words under it states nothing
 * under it, and the export says so by writing nothing. The picture is still a
 * C4 element — the role is on the shape and survives everything — it has simply
 * stopped saying more than its name.
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
    if (text.role === C4_ROLE['type-line']) tiers.typeLine ??= text;
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
