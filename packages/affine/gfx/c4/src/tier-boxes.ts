import type { C4NodeKind } from '@labre/affine-model';

import {
  DESCRIPTION_FONT_SIZE,
  DESCRIPTION_LINES,
  PERSON_BODY_TOP,
  TIER_LINE_HEIGHT,
  TIER_MARGIN,
  TIER_SIDE_INSET,
  TITLE_FONT_SIZE,
  TITLE_LINES,
  TITLE_TYPE_GAP,
  TYPE_DESCRIPTION_GAP,
  TYPE_FONT_SIZE,
} from './consts';

// Editor-free on purpose: the toolbox (`toolbox.ts`, `docs/adr/0045`) lays
// a component's tiers out with this, from the `./interchange` graph that
// `interchange-headless.unit.spec.ts` keeps free of the editor.

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
  title: C4TierBox;
  typeLine: C4TierBox;
  description: C4TierBox;
}

/**
 * The three text boxes of a component, laid out against the node's own box.
 *
 * ## The rhythm
 *
 * A margin, the name over two lines, a small gap, the type line, a wider gap,
 * the description over two, and the same margin again — which is exactly what
 * {@link NODE_BOX} is tall enough for, because the box is derived from this
 * stack rather than the stack fitted into the box. So the default element is
 * neither cramped nor half empty, and the two gaps say what they mean: the name
 * and its type line are one heading, the sentence under them is a second
 * statement.
 *
 * The tiers are stacked by walking DOWN — each one placed under the last plus
 * its gap — rather than by six independent offsets. Six offsets is six chances
 * for two tiers to overlap; a walk cannot produce one.
 *
 * ## The person
 *
 * `bodyTop` is the one asymmetry and it is the stencil's: a person's head stands
 * clear ABOVE a body of the standard height, and its words are laid out in the
 * BODY (`v:textRect` is the body box exactly), so the whole stack starts below
 * the head rather than across it.
 *
 * ## What this is not
 *
 * A creation-time answer and nothing more. The tiers are real elements from the
 * moment they are drawn: an author who moves one has moved it, and nothing here
 * runs again to put it back. It is also proportional in the one direction that
 * matters — a node dragged taller keeps its margins where they were, because
 * they are absolutes; only the person's head, which is a picture, scales.
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

  let top = bodyTop + TIER_MARGIN;
  const tier = (fontSize: number, lines: number, gapAfter: number) => {
    const box = {
      x: x + inset,
      y: y + top,
      w: width,
      h: fontSize * TIER_LINE_HEIGHT * lines,
    };
    top += box.h + gapAfter;
    return box;
  };

  return {
    title: tier(TITLE_FONT_SIZE, TITLE_LINES, TITLE_TYPE_GAP),
    typeLine: tier(TYPE_FONT_SIZE, 1, TYPE_DESCRIPTION_GAP),
    description: tier(DESCRIPTION_FONT_SIZE, DESCRIPTION_LINES, 0),
  };
}
