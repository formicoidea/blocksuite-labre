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
 *
 * Since the compartment watcher this is the DEFAULT rather than the sizing: a
 * caller that has read the tier passes its real line count
 * ({@link UmlTierLines}), and three is what a caller who has not read it gets —
 * the stencil's own shape, which is every classifier's until somebody types.
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
 * The DEPTH of the 3-D cube a node, a device and an execution environment are
 * drawn as (§19.4.4), as a fraction of the box's shorter side.
 *
 * A fraction of the SHORTER side rather than of the width, because the depth is
 * drawn at 45° in both directions: taking it from the width alone would make a
 * cube dragged wide and flat lose its top face off the top of the element.
 *
 * Exported for the reason {@link UML_PACKAGE_TAB} is: the renderer draws the
 * three faces from this number and {@link umlCompartmentBoxes} writes the name
 * INSIDE the front one, so a name floating over the cube's roof is what happens
 * when two files each pick their own depth. 12% is the proportion §19.4.4's own
 * figures show — enough to read as a solid, little enough to leave the front
 * face the size of a box.
 */
export const UML_CUBE_DEPTH = 0.12;

/**
 * How many lines the name written in a cube's front face is sized for.
 *
 * Two, because a deployment target's seed is a keyword line over an instance
 * name — `«device»` over `:Device` (§19.4.4) — which is the same pair a
 * classifier's name compartment holds and the same reason it gets two lines.
 */
const CUBE_LABEL_LINES = 2;

/**
 * The gap between a glyph too small to write in and the name written BESIDE it.
 *
 * Three kinds are in that position, and all three by the notation's own doing: a
 * port is a small square on a border (§11.3.4), and the ball and socket of
 * §10.4.4 are a curve on a stub. None of them has an inside, so the label goes
 * next to the picture — which is exactly how the specification's figures write
 * them.
 */
export const UML_BESIDE_LABEL_GAP = 6;

/**
 * How wide that label is allowed to be before it wraps.
 *
 * An absolute rather than a fraction, unlike every other measurement here,
 * because it is measuring the WORDS and not the glyph: a port dragged twice as
 * big is a bigger square with the same name beside it, and a name column scaled
 * to a 16-unit square would be four characters wide.
 */
export const UML_BESIDE_LABEL_WIDTH = 120;

/**
 * How deep the POINT of a signal pentagon bites into its box (§16.3.4), as a
 * fraction of the width.
 *
 * Exported for the reason {@link UML_PACKAGE_TAB} is: the renderer draws the
 * pentagon from this number and {@link umlCompartmentBoxes} pulls the label box
 * back out of the point by it, so a signal's name cannot end up running out
 * through the tip. One number, two readers.
 *
 * The same depth for both shapes, because §16.3.4 draws the same pentagon twice
 * and merely turns it: a send signal's point sticks OUT of the right edge, an
 * accept event's bites IN from the left, and a reader tells them apart by which
 * way the arrow of the silhouette runs. Two depths would make the pair look like
 * two unrelated shapes.
 */
export const UML_SIGNAL_POINT = 0.16;

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

/**
 * How many LINES each compartment actually holds — the one thing a box cannot
 * tell you.
 *
 * {@link umlCompartmentBoxes} is otherwise a pure function of a rectangle, and
 * that was enough for as long as every classifier was assumed to hold the
 * stencil it was born with: one name line, three attributes, and the operations
 * taking the rest. An author who types five attributes into the second tier has
 * overflowed it — the words run through the separator under them and out the
 * bottom of the box — and nothing in a rectangle says so.
 *
 * So the counts are passed IN, from whoever has read the tiers
 * ({@link umlTierLineCount}), and every field is optional: a caller that knows
 * nothing about the words gets exactly the layout this module has always
 * returned. `UmlCompartmentWatcher` is what supplies them after an edit
 * commits, and the node renderer is what keeps the separators where the tiers
 * then are.
 *
 * `operations` is read by {@link umlStackHeight} and NOT by
 * {@link umlCompartmentBoxes}, and that asymmetry is the notation's: the
 * operations compartment is the bottom of the box and always takes whatever is
 * left (§11.4.4), so its line count says how tall the box must BE, never how
 * tall the compartment is drawn.
 */
export interface UmlTierLines {
  name?: number;
  attributes?: number;
  operations?: number;
}

/** A tier's line count, floored at one line, or the notation's default. */
const tierLines = (lines: number | undefined, fallback: number): number =>
  lines === undefined ? fallback : Math.max(1, Math.floor(lines));

/**
 * How many lines a tier's text holds: the number of `\n` in it, plus one.
 *
 * Takes the VALUE rather than the element, for the reason {@link umlTierText}
 * does — a `Y.Text` on a model, a string in a fixture — and counts the same way
 * a canvas text element WRAPS: it does not. A canvas tier is laid out line per
 * line from the text's own newlines, so the author's newlines are the lines.
 *
 * ponytail: a line longer than the tier is wide is still ONE line here, and the
 * renderer will let it run out through the side. Measuring a wrapped line needs
 * a font context — `getFontString` + a canvas measurer — and that is a
 * measurement this module (pure, free of `std` and of the DOM) cannot make.
 * Raise the ceiling when an author complains about width, not before: the
 * overflow that actually bites is vertical, because a tier that grows downward
 * crosses the separator under it.
 *
 * An empty tier is one line, which is `\n`-count + 1 and also what §14.2.4
 * wants: a state's behaviour compartment is seeded EMPTY and is still ruled off.
 */
export function umlTierLineCount(text: unknown): number {
  if (text === null || text === undefined) return 1;
  return String(text).split('\n').length;
}

/** The kinds drawn as a divided rectangle — everything with a compartment. */
const COMPARTMENTED = new Set<UmlNodeKind>([
  'class',
  'interface',
  'enumeration',
  'object',
  // §11.6.4 and §19.3.4 draw both as a rectangle with a name over a body, the
  // icon in the corner being the only thing that tells them from a class. Two
  // tiers, one separator — the object's layout exactly.
  'component',
  'artifact',
  // §14.2.4 draws a state as a round-cornered rectangle with a NAME
  // COMPARTMENT over its internal activities (`entry /`, `do /`, `exit /`),
  // ruled off by a line — the object's layout with rounded corners. The one
  // behaviour kind that is a divided box rather than a picture or a mark.
  'state',
]);

/**
 * The kinds whose second tier is a BODY rather than a feature list — a name
 * compartment, one separator, and everything below it.
 *
 * Three different statements sharing one layout, and it is worth saying why they
 * are not one: an object's second tier holds SLOTS (§9.8.4 — an instance has
 * values, not behaviour), a component's holds its parts or its realized
 * interfaces (§11.6.4), an artifact's holds what the file contains (§19.3.4).
 * The notation draws them the same way, so this module does; the ROLE on the
 * text element is what keeps them apart for everybody else.
 */
const ONE_SPLIT = new Set<UmlNodeKind>([
  'object',
  'component',
  'artifact',
  // A state's second tier holds its INTERNAL ACTIVITIES (§14.2.4) — the
  // `entry / …`, `do / …`, `exit / …` lines a machine runs while it rests
  // there. A fourth statement on the same layout, and the role on the text is
  // again what keeps it apart from the other three.
  //
  // A fresh state's behaviour tier arrives EMPTY, which §14.2.4's own figures
  // draw: a named state with a ruled-off compartment waiting to be filled. The
  // alternative — hiding the rule until somebody types — would mean deciding
  // the layout from the text, which no pure function of a box can do.
  'state',
]);

/** The three deployment targets, drawn as the same cube (§19.4.4). */
const CUBES = new Set<UmlNodeKind>(['node', 'device', 'execution-environment']);

/**
 * The three glyphs with no INSIDE, whose name is therefore written next to them
 * — outside the element's own box, which nothing else in this module does.
 *
 * Exported because that is a fact a caller has to know: a port's label is the
 * one tier that makes the GROUP bigger than the shape it belongs to, and a test
 * or a layout asserting "every tier is inside its node" has to say which three
 * kinds the notation exempts (§11.3.4, §10.4.4).
 */
export const UML_BESIDE_LABEL_KINDS: ReadonlySet<UmlNodeKind> =
  new Set<UmlNodeKind>([
    'port',
    'provided-interface',
    'required-interface',
    // §16.10.4's hourglass is the fourth, and the notation puts it there too:
    // the time expression — `after (2 days)` — is written NEXT TO the glyph
    // because a 40 × 56 hourglass has no inside, exactly like a port.
    'time-event',
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
 * of the box — the tier an author of an object diagram actually types in. A
 * `component` (§11.6.4) and an `artifact` (§19.3.4) walk exactly the same path,
 * for exactly the same reason: a name over one body tier.
 *
 * ## The ones that are not boxes
 *
 * A package, a note, an actor, a use case, the three cubes and the three
 * interface glyphs are SHAPES the notation draws, not rectangles it divides, so
 * each returns a single label box positioned against its own picture and no
 * splits at all:
 *
 *  - **package** — under the tab, centred in the body (§12.2.4);
 *  - **note** — the inner rectangle, top-aligned and read left, because a note
 *    holds a sentence rather than a title (Annex A);
 *  - **actor** — under the stick figure, which is where §18.1.4 writes it;
 *  - **use case** — centred in the ellipse, the only shape with no corner to
 *    hang a label in;
 *  - **node / device / execution-environment** — inside the cube's FRONT FACE,
 *    the only one of its three faces that is not drawn at an angle (§19.4.4);
 *  - **port / provided-interface / required-interface / time-event** — BESIDE
 *    the glyph, and outside the element's own box: a small square, a ball on a
 *    stick and a 40-unit hourglass have no inside to write in (§11.3.4,
 *    §10.4.4, §16.10.4). The one place this module returns a tier that is not
 *    contained by the node it belongs to, and
 *    {@link UML_BESIDE_LABEL_KINDS} is how it says so out loud;
 *  - **action / object-node** — centred in the box, which is where §15.3.4 and
 *    §15.4.4 write a verb phrase and a value's name;
 *  - **send-signal / accept-event** — centred too, but pulled back out of the
 *    pentagon's POINT by {@link UML_SIGNAL_POINT}, so the words never run out
 *    through the tip (§16.3.4).
 *
 * ## The ones with no words at all
 *
 * The control nodes of §15.3.4 and the pseudostates of §14.2.4 are MARKS — a
 * disc, a bar, a bullseye, a cross — and carry no tier. They still get a box
 * back from here, centred, because a box is always computable from a box and a
 * second return shape would cost every caller a branch. What decides whether a
 * text element is ever created is `UML_UNLABELLED_KINDS` in `keywords.ts`, and
 * that is the one authority on the question.
 *
 * ## What this is not
 *
 * A creation-time answer, a render-time one and a commit-time one, and nothing
 * more. The compartments are real elements from the moment they are drawn: an
 * author who moves one has moved it, and nothing here runs on its own to put it
 * back. The margins are absolutes, so a node dragged taller keeps them where
 * they were and gives the extra height to the tier that takes "the rest".
 *
 * The commit-time caller is `UmlCompartmentWatcher` (`node/`), and it is the
 * one that passes `lines`: when an edit into a tier commits, it re-asks this
 * function where the compartments go now that the second one holds five lines
 * instead of three, grows the node if the answer no longer fits
 * ({@link umlStackHeight}) and writes the tiers to the boxes it gets back. It
 * is still not a layout engine — nothing runs between keystrokes, and nothing
 * reclaims height an author has dragged out.
 */
export function umlCompartmentBoxes(
  kind: UmlNodeKind,
  x: number,
  y: number,
  w: number,
  h: number,
  lines?: UmlTierLines
): UmlCompartmentBoxes {
  const inset = w * UML_TIER_SIDE_INSET;
  const width = w - inset * 2;
  const nameLine = UML_NAME_FONT_SIZE * UML_TIER_LINE_HEIGHT;
  const box = (top: number, height: number): UmlBox => ({
    x: x + inset,
    y: y + top,
    w: width,
    h: height,
  });

  if (!COMPARTMENTED.has(kind)) {
    // A glyph's label is placed against its PICTURE — beside a port, inside a
    // cube's front face, under a stick figure — and a picture has no stack to
    // grow. So `lines` is deliberately not read here: it would make an actor's
    // head and its name overlap the moment somebody typed a second line, and
    // the fix for that is a bigger element, not a taller label.
    return {
      name: glyphLabel(kind, { box, x, y, w, h, nameHeight: nameLine }),
      splits: [],
    };
  }

  // The walk. `top` is an offset from the node's top edge throughout, which is
  // also the unit `splits` is in — so a separator is simply the value of `top`
  // at the moment one compartment closes and the next opens.
  const nameHeight = nameLine * tierLines(lines?.name, 1);
  let top = UML_TIER_MARGIN;
  const name = box(top, nameHeight);
  top += nameHeight + UML_NAME_GAP;

  const splits = [top];

  if (ONE_SPLIT.has(kind)) {
    // A name over a single body tier, one line between them, and the body takes
    // everything down to the bottom margin: an instance's slots (§9.8.4), a
    // component's parts (§11.6.4), an artifact's contents (§19.3.4).
    return {
      name,
      attributes: box(top, Math.max(0, h - top - UML_TIER_MARGIN)),
      splits,
    };
  }

  const attributesHeight =
    UML_BODY_FONT_SIZE *
    UML_TIER_LINE_HEIGHT *
    tierLines(lines?.attributes, UML_ATTRIBUTE_LINES);
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

/**
 * How tall the node has to BE for the words its tiers hold to fit — `null` for
 * a kind that has no stack.
 *
 * The same walk as {@link umlCompartmentBoxes}, read the other way round: that
 * function is given a box and hands back where the compartments go, this one is
 * given the compartments and hands back the box they need. Both are here so
 * they cannot disagree, which is the whole reason the separators were computed
 * in this module in the first place.
 *
 * The last tier is the one difference between the two. `umlCompartmentBoxes`
 * gives the operations compartment (or a one-split kind's body) EVERYTHING left
 * down to the bottom margin, because a box an author has dragged taller has
 * dragged it taller for them; this returns the height at which "everything
 * left" is exactly the lines it holds, which is the smallest box that fits.
 *
 * `null` rather than a number for a package, an actor, a cube or a mark: those
 * are pictures the notation draws, not rectangles it divides, and there is no
 * honest answer to "how tall must this be" for a stick figure. It doubles as
 * the predicate — a caller that gets a number is looking at a divided box.
 */
export function umlStackHeight(
  kind: UmlNodeKind,
  lines: UmlTierLines
): number | null {
  if (!COMPARTMENTED.has(kind)) return null;

  const bodyLine = UML_BODY_FONT_SIZE * UML_TIER_LINE_HEIGHT;
  const head =
    UML_TIER_MARGIN +
    UML_NAME_FONT_SIZE * UML_TIER_LINE_HEIGHT * tierLines(lines.name, 1) +
    UML_NAME_GAP;

  if (ONE_SPLIT.has(kind)) {
    return head + bodyLine * tierLines(lines.attributes, 1) + UML_TIER_MARGIN;
  }

  return (
    head +
    bodyLine * tierLines(lines.attributes, UML_ATTRIBUTE_LINES) +
    bodyLine * tierLines(lines.operations, 1) +
    UML_TIER_MARGIN
  );
}

/** What a glyph kind's label needs to know about the element it belongs to. */
interface GlyphLabelSite {
  /** The insetted tier box, `top` and `height` offsets from the node's top. */
  box: (top: number, height: number) => UmlBox;
  x: number;
  y: number;
  w: number;
  h: number;
  nameHeight: number;
}

/** The single label box of every kind that is a picture, not a divided box. */
function glyphLabel(kind: UmlNodeKind, site: GlyphLabelSite): UmlBox {
  const { box, x, y, w, h, nameHeight } = site;

  if (CUBES.has(kind)) {
    // Inside the FRONT FACE, which is the only face a name can be written on:
    // the other two are drawn at 45° and words on them would be words on a
    // roof. Centred in it, with the same proportional gutter every other tier
    // gets — measured against the face's width, not the element's, or a cube
    // would look padded on the left and flush on the right (§19.4.4).
    const depth = Math.min(w, h) * UML_CUBE_DEPTH;
    const faceW = Math.max(0, w - depth);
    const faceH = Math.max(0, h - depth);
    const inset = faceW * UML_TIER_SIDE_INSET;
    const height = Math.min(nameHeight * CUBE_LABEL_LINES, faceH);
    return {
      x: x + inset,
      y: y + depth + (faceH - height) / 2,
      w: Math.max(0, faceW - inset * 2),
      h: height,
    };
  }

  if (UML_BESIDE_LABEL_KINDS.has(kind)) {
    // BESIDE the glyph, and deliberately outside the element's own box: a port
    // is a 16-unit square and a lollipop is a ball on a stick, so there is
    // nowhere in either of them for a word to go (§11.3.4, §10.4.4). To the
    // RIGHT and vertically centred on the glyph, which is how the
    // specification's own figures set them, and the one placement that reads
    // the same whichever border of a component the port has been dragged onto.
    return {
      x: x + w + UML_BESIDE_LABEL_GAP,
      y: y + (h - nameHeight) / 2,
      w: UML_BESIDE_LABEL_WIDTH,
      h: nameHeight,
    };
  }

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
    case 'send-signal':
    case 'accept-event': {
      // The pentagon's words are centred like an action's, then pulled back out
      // of the POINT: a send signal's tip sticks out to the right and an accept
      // event's notch bites in from the left, so each gives up one side
      // (§16.3.4). Measured with the same number the renderer draws the tip
      // from, so a name can never run out through it.
      const point = w * UML_SIGNAL_POINT;
      const height = Math.min(nameHeight * USE_CASE_LABEL_LINES, h);
      const inset = w * UML_TIER_SIDE_INSET;
      const left = kind === 'accept-event' ? x + point + inset : x + inset;
      return {
        x: left,
        y: y + (h - height) / 2,
        w: Math.max(0, w - point - inset * 2),
        h: height,
      };
    }
    default: {
      // The use case, the action, the object node, every mark that carries no
      // words at all, and anything a later phase adds without saying where its
      // label goes: centred, which is the answer that is never wrong.
      //
      // Clamped to the element, which the phase-2 marks made necessary: two
      // lines of 16px face is 45 units and a junction is 16 tall, so an
      // unclamped box would hang half of itself off the top of the dot and
      // break the one invariant every other tier keeps — a tier is inside the
      // node it belongs to, unless {@link UML_BESIDE_LABEL_KINDS} says
      // otherwise.
      const height = Math.min(nameHeight * USE_CASE_LABEL_LINES, h);
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
