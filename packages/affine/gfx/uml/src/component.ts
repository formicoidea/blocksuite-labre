import type { UmlNodeKind } from '@labre/affine-model';

import { UML_BODY_FONT_SIZE, UML_NAME_FONT_SIZE } from './consts.js';
import { UML_ROLE, UML_ROLE_OF_KIND } from './roles.js';

/**
 * A UML component — the SHAPE and its own words, grouped.
 *
 * ## Why a UML artefact is several elements
 *
 * UML 2.5.1 draws a classifier as a rectangle divided into COMPARTMENTS
 * (§9.2.4, §11.4.4): the name on top, the attributes under a line, the
 * operations under a second one. Those compartments are not decoration — they
 * are three separate statements about the same classifier, and an author edits
 * them one at a time.
 *
 * The library already knows how to draw that: the same arrangement C4 arrived
 * at through the PO's recette of 28/08/2026 (`gfx/c4/src/component.ts`), which
 * R15/R16 then generalised into a rule. A component is a native `group` holding
 * a `umlNode` shape that carries NO inner text and one canvas `text` element per
 * compartment, each stamped with its own role. One click selects the classifier,
 * a second descends into the compartment under the pointer, and every gesture
 * the editor already has works on it.
 *
 * ## This module
 *
 * The two questions that arrangement raises, both PURE and both free of `std`
 * and of Yjs, so the creation site, the node renderer, the exporter and a test
 * all answer them the same way:
 *
 *  - **where do the compartments go**, given a node's box
 *    ({@link umlCompartmentBoxes}) — and, as a by-product nobody else can
 *    compute, WHERE THE SEPARATORS ARE, which is what the renderer strokes;
 *  - **which words belong to which shape**, given a group and a flat element
 *    list ({@link umlComponentSiblings}) — resolved by group membership plus the
 *    role stamped on each text, never by position in `children`.
 *
 * The role stays on the SHAPE and on each text; the group carries none
 * (`roles.ts`).
 */

/* ── The metrics ───────────────────────────────────────────────────────── */

/**
 * The gap between a compartment's words and the line that closes it, and
 * between the words and the outline of the box.
 *
 * One number for the top, the bottom and — through {@link UML_TIER_SIDE_INSET}
 * — the sides, because UML draws one: the specification's figures are typeset
 * with a single uniform padding inside every compartment, and a second value
 * would read as a distinction between compartments that the notation never
 * makes.
 */
export const UML_TIER_MARGIN = 8;

/**
 * The side padding, as a FRACTION of the box width rather than the absolute
 * {@link UML_TIER_MARGIN}.
 *
 * A UML box is resized far more often horizontally than vertically — an author
 * widens a class to fit `+ findByCustomerId(id : CustomerId) : Order`, they do
 * not make it taller to fit a longer word. A proportional inset keeps the text
 * column looking deliberate at every width; an absolute one would leave a
 * 200-unit box looking padded and a 600-unit box looking unpadded.
 */
export const UML_TIER_SIDE_INSET = 0.08;

/**
 * Line height, as a multiple of the font size — the one number that turns
 * "three lines of attributes" into a height.
 */
export const UML_TIER_LINE_HEIGHT = 1.4;

/**
 * The gap between the NAME and the line under it.
 *
 * Smaller than {@link UML_TIER_MARGIN} on purpose: the name compartment of a
 * fresh classifier holds one line and, for an interface or an enumeration, a
 * keyword line above it (§9.5.4 — `«interface»`), and that pair has to read as
 * one heading rather than as a block floating in an over-tall compartment.
 */
export const UML_NAME_GAP = 6;

/**
 * How many lines the ATTRIBUTES compartment is sized for.
 *
 * Three, because that is what a default 200 × 120 box leaves room for once the
 * name compartment and the margins are taken out, and because a classifier with
 * three attributes and one or two operations is the shape of nearly every class
 * anybody draws first. The operations compartment takes whatever is left, which
 * is the one tier that must never be sized in lines: it is the bottom of the
 * box, and a box an author has dragged taller has dragged it taller FOR the
 * operations.
 */
export const UML_ATTRIBUTE_LINES = 3;

/**
 * The share of a `package` box its TAB occupies, top-left (§12.2.4).
 *
 * A fraction rather than an absolute, because the tab is part of the DRAWING:
 * a package dragged to twice the height is the same folder, twice as big, and a
 * tab pinned to 26 units would turn into a sliver. Exported so the node
 * renderer strokes the tab exactly where the name compartment stops, rather
 * than the two agreeing by coincidence.
 */
export const UML_PACKAGE_TAB = 0.2;

/**
 * The share of an `actor` box the STICK FIGURE occupies, measured from the top
 * (§18.1.4 — the figure, and its name written underneath it).
 *
 * Exported for the same reason as {@link UML_PACKAGE_TAB}: the renderer draws
 * the figure ABOVE this line and {@link umlCompartmentBoxes} puts the name
 * BELOW it, and a head overlapping its own label is what happens when two files
 * each pick their own number.
 */
export const UML_ACTOR_FIGURE = 0.74;

/**
 * How many lines a use case's label is sized for.
 *
 * Two, where every other label gets one: a use case is named with a VERB PHRASE
 * (§18.1.4 — "Passer une commande", "Consulter le solde"), which is the longest
 * label in the pack, and it is centred in an ELLIPSE, whose widest chord is the
 * only place two lines fit comfortably.
 */
const USE_CASE_LABEL_LINES = 2;

/* ── Where the compartments go ─────────────────────────────────────────── */

/** A box in the same units and origin as the node's own. */
export interface UmlBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The written compartments of one node, plus the separators between them.
 *
 * `attributes` and `operations` are optional because most of the pack has
 * neither: a package, a note, an actor and a use case carry ONE label and no
 * compartment at all (§12.2.4, §18.1.4, Annex A), and an object carries a name
 * and its slots but no operations (§9.8.4 — an instance has values, not
 * behaviour).
 *
 * `splits` are offsets DOWN FROM THE TOP of the node's box, in model units, and
 * they are the renderer's whole instruction: stroke a full-width line at each.
 * They are returned from here rather than recomputed there because they are not
 * a second fact — a separator IS the boundary between two compartments, and two
 * files deriving it separately is how a line ends up crossing the words it was
 * supposed to sit under.
 */
export interface UmlCompartmentBoxes {
  name: UmlBox;
  attributes?: UmlBox;
  operations?: UmlBox;
  splits: number[];
}

/** The kinds drawn as a divided rectangle — everything with a compartment. */
const COMPARTMENTED = new Set<UmlNodeKind>([
  'class',
  'interface',
  'enumeration',
  'object',
]);

/**
 * The compartments of a node, laid out against its own box.
 *
 * ## The rhythm of a classifier
 *
 * A margin, the name over one line, a small gap, THE LINE, three lines of
 * attributes, THE SECOND LINE, and the operations take the rest down to the
 * bottom margin. Which is exactly what a 200 × 120 box is tall enough for,
 * because the box was derived from this stack (`consts.ts`) rather than the
 * stack fitted into the box — so a fresh class is neither cramped nor half
 * empty.
 *
 * The tiers are stacked by walking DOWN, each placed under the last, rather
 * than by six independent offsets: six offsets is six chances for two
 * compartments to overlap, and a walk cannot produce one.
 *
 * An `object` walks the same path and stops one tier early: §9.8.4 draws an
 * instance specification as a name compartment over a SLOT compartment, and
 * there is no third. So it gets one split, not two, and the slots take the rest
 * of the box — the tier an author of an object diagram actually types in.
 *
 * ## The four that are not boxes
 *
 * A package, a note, an actor and a use case are SHAPES the notation draws, not
 * rectangles it divides, so each returns a single label box positioned against
 * its own picture and no splits at all:
 *
 *  - **package** — under the tab, centred in the body (§12.2.4);
 *  - **note** — the inner rectangle, top-aligned and read left, because a note
 *    holds a sentence rather than a title (Annex A);
 *  - **actor** — under the stick figure, which is where §18.1.4 writes it;
 *  - **use case** — centred in the ellipse, the only shape with no corner to
 *    hang a label in.
 *
 * ## What this is not
 *
 * A creation-time answer and a render-time one, and nothing more. The
 * compartments are real elements from the moment they are drawn: an author who
 * moves one has moved it, and nothing here runs again to put it back. The
 * margins are absolutes, so a node dragged taller keeps them where they were
 * and gives the extra height to the tier that takes "the rest".
 */
export function umlCompartmentBoxes(
  kind: UmlNodeKind,
  x: number,
  y: number,
  w: number,
  h: number
): UmlCompartmentBoxes {
  const inset = w * UML_TIER_SIDE_INSET;
  const width = w - inset * 2;
  const nameHeight = UML_NAME_FONT_SIZE * UML_TIER_LINE_HEIGHT;
  const box = (top: number, height: number): UmlBox => ({
    x: x + inset,
    y: y + top,
    w: width,
    h: height,
  });

  if (!COMPARTMENTED.has(kind)) {
    return { name: glyphLabel(kind, box, h, nameHeight), splits: [] };
  }

  // The walk. `top` is an offset from the node's top edge throughout, which is
  // also the unit `splits` is in — so a separator is simply the value of `top`
  // at the moment one compartment closes and the next opens.
  let top = UML_TIER_MARGIN;
  const name = box(top, nameHeight);
  top += nameHeight + UML_NAME_GAP;

  const splits = [top];

  if (kind === 'object') {
    // An instance specification: name over slots, one line between them, and
    // the slots take everything down to the bottom margin (§9.8.4).
    return {
      name,
      attributes: box(top, Math.max(0, h - top - UML_TIER_MARGIN)),
      splits,
    };
  }

  const attributesHeight =
    UML_BODY_FONT_SIZE * UML_TIER_LINE_HEIGHT * UML_ATTRIBUTE_LINES;
  const attributes = box(top, attributesHeight);
  top += attributesHeight;
  splits.push(top);

  return {
    name,
    attributes,
    operations: box(top, Math.max(0, h - top - UML_TIER_MARGIN)),
    splits,
  };
}

/** The single label box of the four kinds that are a picture, not a box. */
function glyphLabel(
  kind: UmlNodeKind,
  box: (top: number, height: number) => UmlBox,
  h: number,
  nameHeight: number
): UmlBox {
  switch (kind) {
    case 'package': {
      const tab = h * UML_PACKAGE_TAB;
      return box(tab + (h - tab - nameHeight) / 2, nameHeight);
    }
    case 'note':
      // The whole inner rectangle: a note is words first and a shape second,
      // and its text starts at the top because it is a paragraph.
      return box(UML_TIER_MARGIN, Math.max(0, h - UML_TIER_MARGIN * 2));
    case 'actor':
      return box(h * UML_ACTOR_FIGURE, nameHeight);
    default: {
      // The use case, and anything a later phase adds without saying where its
      // label goes: centred, which is the answer that is never wrong.
      const height = nameHeight * USE_CASE_LABEL_LINES;
      return box((h - height) / 2, height);
    }
  }
}

/* ── Which words belong to which shape ─────────────────────────────────── */

/**
 * The little a resolution needs to know about an element — an id, a role, and
 * whatever it says.
 *
 * `text` is `unknown` because on a real element it is a `Y.Text` and in a test
 * it is a string, and this module has no business knowing which: it is read
 * through {@link umlTierText}, which stringifies whatever it is given. That is
 * also what keeps this file free of a Yjs import.
 */
export interface UmlComponentElement {
  id: string;
  role?: string;
  text?: unknown;
}

/** The little a resolution needs to know about a group. */
export interface UmlComponentGroup {
  id: string;
  childIds: readonly string[];
}

/**
 * One classifier's shape and its written compartments, resolved.
 *
 * Every field is optional, and that is the honest answer rather than a
 * defensive one: a group whose texts were deleted, one whose shape was deleted,
 * and a group an author made out of two unrelated boxes all exist, and none of
 * them is an error. What a caller does with a missing tier — write nothing,
 * fall back to the shape's own inner text — is the caller's decision, and the
 * exporter and the node view make different ones.
 */
export interface UmlComponent {
  node?: UmlComponentElement;
  name?: UmlComponentElement;
  attributes?: UmlComponentElement;
  operations?: UmlComponentElement;
  label?: UmlComponentElement;
}

/**
 * The roles a SHAPE may carry — the values of `UML_ROLE_OF_KIND`, as a set.
 *
 * Derived rather than listed so a kind added to the pack is recognised here the
 * day its role is mapped, and not the day somebody notices that its words stop
 * resolving. Which of the eight it is does not matter to a resolution: it is
 * looking for "the shape in this group", and every node role answers that.
 */
const NODE_ROLES: ReadonlySet<string> = new Set(
  Object.values(UML_ROLE_OF_KIND)
);

/**
 * Everything one group holds, sorted into the shape and its tiers.
 *
 * ## Group membership, then roles
 *
 * The group answers "which words are THIS classifier's" — two classes side by
 * side both carry a `+ attribute : Type`, and only the grouping says which is
 * which. The role then answers "which of these words is the operations
 * compartment", which position in `children` cannot: a group's child order is
 * an implementation detail that a reorder, a copy or a regroup rewrites, while
 * a role is written on the element and travels with it.
 *
 * ## `name` and `label` are two fields, not one
 *
 * Because they are two roles, and the vocabulary means them differently: a
 * `uml:name` is the name of a CLASSIFIER, parsed by the grammar for keywords in
 * guillemets and for an abstract name in italics (§9.5.4); a `uml:label` is the
 * plain text of an actor or a use case, which is a name and nothing else. An
 * exporter that had to ask "is this the name field or the label field" of one
 * merged slot would be asking about the element's KIND, which the shape already
 * states. Keeping them apart costs one field and removes the question.
 *
 * The FIRST element of each role wins. A group holding two names is a group
 * somebody built by hand out of two components, and document order is the same
 * tie-break the export's geometric attribution uses.
 */
export function umlComponentSiblings(
  group: UmlComponentGroup,
  elements: readonly UmlComponentElement[]
): UmlComponent {
  const children = new Set(group.childIds);
  const component: UmlComponent = {};

  for (const element of elements) {
    if (!children.has(element.id)) continue;
    const role = element.role;
    if (role === undefined) continue;

    if (NODE_ROLES.has(role)) component.node ??= element;
    else if (role === UML_ROLE.name) component.name ??= element;
    else if (role === UML_ROLE.attributes) component.attributes ??= element;
    else if (role === UML_ROLE.operations) component.operations ??= element;
    else if (role === UML_ROLE.label) component.label ??= element;
  }

  return component;
}

/**
 * The group an element belongs to — `undefined` when it belongs to none.
 *
 * The other direction of the same question, and the one the node view needs:
 * given the shape somebody has just double-clicked, which group holds the text
 * to open an editor on? The C4 pack answers it with `c4ComponentSiblings(id,
 * groups)`; this returns the group itself rather than its id list, because the
 * next call is always {@link umlComponentSiblings}, which takes exactly that.
 *
 * The FIRST group holding the element wins. Groups nest, so a component grouped
 * again inside a bigger group has two ancestors; document order picks the one
 * written first, which is the innermost — the one the creation site made.
 */
export function umlGroupOf(
  elementId: string,
  groups: readonly UmlComponentGroup[]
): UmlComponentGroup | undefined {
  return groups.find(group => group.childIds.includes(elementId));
}

/**
 * The shape of a resolved component — its `umlNode`, or `undefined` for a group
 * that holds none.
 *
 * A one-line accessor with a name, rather than `component.node` at eleven call
 * sites, because the QUESTION is worth spelling: "which box are these words
 * about". The exporter asks it to read a `kind`, the renderer to read a
 * geometry, and a rule to read a role.
 */
export function umlNodeOfComponent(
  component: UmlComponent
): UmlComponentElement | undefined {
  return component.node;
}

/* ── What a tier actually says ─────────────────────────────────────────── */

/**
 * Whatever a tier says, as a plain trimmed string.
 *
 * Takes the VALUE rather than the element, because that is what every caller
 * has: a `Y.Text` off a model, a string off a fixture, `undefined` off a tier
 * that was never created. Stringifying here is what lets the grammar, the
 * exporter and the renderer stay free of a Yjs import — a `Y.Text` answers
 * `toString()` with its content, which is the whole of the coupling.
 */
export function umlTierText(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text).trim();
}
