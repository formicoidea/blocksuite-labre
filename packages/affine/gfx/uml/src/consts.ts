import type { UmlNodeKind } from '@labre/affine-model';
// The lifeline's column height is a MODEL constant (the element's own bound
// override reads it), and it is also this file's footprint for the kind — so it
// is imported as well as re-exported below.
import { UML_LIFELINE_SPINE } from '@labre/affine-model';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';

/**
 * Visual constants for the UML pack.
 *
 * UML is the opposite of C4 on the one question that matters here: C4's stencil
 * IS a colour code — four blues for four levels — whereas UML 2.5.1 defines no
 * palette at all. Every figure in the specification is black lines on white
 * paper, and what distinguishes a class from an interface from an enumeration
 * is the KEYWORD written above the name, not a hue. So this file states no
 * colours of its own: it names four neutrals off the shared notation scale
 * (R33) and leaves the meaning where the spec puts it, in the shape and the
 * words.
 *
 * Every value here is a creation-time DEFAULT. A UML node is a native shape, so
 * each of these becomes an ordinary editable property the moment the element is
 * placed — exactly as in BPMN and C4.
 */

/* ── The four neutrals ──────────────────────────────────────────────────── */

/**
 * Artefact ink: every node outline, every compartment separator, every glyph
 * (the package tab, the note's fold, the actor's stick figure) and the text
 * written inside an artefact.
 *
 * One ink for all of it, because UML draws one: the notation's contrast is
 * between the LINES and the paper, and a second artefact grey would read as a
 * distinction the spec never makes.
 */
export const UML_INK = NOTATION_NEUTRALS.ink;

/**
 * Background structure: the diagram frame's border, its heading tag and the
 * subject's outline and name — the furniture the diagram is drawn ON, as
 * opposed to the diagram itself.
 */
export const UML_FRAME_INK = NOTATION_NEUTRALS.frameInk;

/** The paper: the diagram frame's card fill, and the fill of a boxed node. */
export const UML_CARD = NOTATION_NEUTRALS.cardFill;

/**
 * Secondary strokes — the divider under the heading band. Lighter than
 * {@link UML_FRAME_INK} so that the band reads as a strip of the same sheet
 * rather than as a second frame drawn inside the first.
 */
export const UML_DIVIDER = NOTATION_NEUTRALS.divider;

/* ── Weights ───────────────────────────────────────────────────────────── */

/**
 * Every relationship is drawn at the same weight — the notation distinguishes
 * them by their ENDS (hollow triangle, hollow or filled diamond, open arrow)
 * and by solid versus dashed, never by thickness. See the edge style table in
 * `actions.ts`.
 */
export const UML_EDGE_WIDTH = 2;

/** Every node outline, at the same weight as every line: UML draws one pen. */
export const UML_NODE_STROKE_WIDTH = 2;

/* ── Type ──────────────────────────────────────────────────────────────── */

/** The same family every other framework in the library writes in. */
export const UML_FONT_FAMILY = 'Inter, sans-serif';

/**
 * The name compartment, and the two tiers under it.
 *
 * A two-step ladder rather than C4's three, because a classifier has two kinds
 * of words in it: its NAME (with its keyword line, §11.4.4) and its FEATURES —
 * attributes and operations, which are the same sort of statement at the same
 * size. Both are creation-time defaults an author can climb off.
 */
export const UML_NAME_FONT_SIZE = 16;
export const UML_BODY_FONT_SIZE = 13;

/* ── The diagram frame ─────────────────────────────────────────────────── */

/**
 * The bite taken out of the heading tag's top-right corner, in model units.
 *
 * UML 2.5.1 Annex A draws the frame heading in a rectangle with one corner cut
 * off — the pentagon that tells a reader, at a glance and before reading a
 * word, that they are looking at a diagram frame and not at a box in the
 * drawing. 12 units against a 44-unit band is the proportion the Annex's own
 * figures show.
 */
export const UML_FRAME_TAG_CUT = 12;

/**
 * How much shorter the tag is than the band it is drawn in — the air under it,
 * which is what makes it read as a label PINNED to the frame rather than as a
 * second rectangle sharing its top edge.
 */
export const UML_FRAME_TAG_FOOT = 8;

/** The heading's own size, and the frame's line. */
export const UML_FRAME_HEADING_FONT_SIZE = 20;
export const UML_FRAME_BORDER_WIDTH = 1.5;

/**
 * The frame's other three margins — the plot's inset from its own border.
 *
 * Also the tag's horizontal PADDING: the heading is written at the plot's left
 * edge, so a tag padded by the same number is a tag with its words centred in
 * it, and the two cannot drift because there is one number.
 */
export const UML_DIAGRAM_MARGIN = 24;

/**
 * The band the heading tag is written in — the frame's TOP MARGIN, owned by
 * `@labre/affine-model` because the frame's hit test reads it too (a diagram is
 * clickable by its heading band as well as by its border).
 *
 * Re-exported here so this file stays the one place a reader looks for the
 * pack's metrics, exactly as `consts.ts` in the C4 pack re-exports
 * `C4_BOARD_TITLE_BAND_HEIGHT`.
 */
export { UML_FRAME_BAND_HEIGHT } from '@labre/affine-model';

/** The size a fresh diagram frame is created at — a Context Map sheet's own. */
export const UML_DIAGRAM_BOX = { w: 1400, h: 900 } as const;

/**
 * The size a fresh subject is created at (§18.1.4) — a C4 boundary's own
 * footprint, because it is the same kind of object: a rectangle drawn round
 * part of a diagram that is already there.
 */
export const UML_SUBJECT_BOX = { w: 520, h: 360 } as const;

/**
 * The subject's inset, equal on all four sides: unlike a diagram frame it has
 * no furniture to make room for — §18.1.4 writes its name INSIDE the top-left
 * corner, over the drawing, exactly as a C4 boundary writes its own.
 */
export const UML_SUBJECT_MARGIN = 12;

/** The subject's outline: solid and thin — §18.1.4 draws no dash and no tint. */
export const UML_SUBJECT_BORDER_WIDTH = 1.5;

/* ── Node footprints ───────────────────────────────────────────────────── */

/**
 * Default node sizes (model units) per kind. TOTAL over {@link UmlNodeKind} by
 * its type, so a kind added to the model cannot land without a footprint.
 *
 * The four compartmented kinds share ONE box — a class, an interface, an
 * enumeration and an object are the same rectangle with different words in it,
 * and a row of them lining up without anybody arranging them is what makes a
 * class diagram readable. 200 × 120 fits a name line plus three feature lines
 * at the sizes above with the margins `component.ts` lays out.
 *
 * The other four are the shapes the notation draws rather than boxes:
 *
 *  - `package` is taller by the height of its tab (§12.2.4);
 *  - `note` is smaller and squarer — it holds a sentence, not a signature
 *    list (Annex A);
 *  - `actor` is the stick figure's own aspect ratio, tall and narrow: squeezed
 *    into a wide box the head stops being a circle, which is the one thing
 *    about a UML actor everybody recognises (§18.1.4);
 *  - `use-case` is the ellipse, wide and shallow so a verb phrase fits across
 *    its widest chord rather than in its corners, which it has none of.
 *
 * ## The phase-2 footprints
 *
 * A `component` is the class box's own 200 × 120: §11.6.4 draws it as the same
 * rectangle with an icon in the corner, and a component diagram lines its boxes
 * up beside a class diagram's without anybody resizing anything.
 *
 * The rest are their pictures' own proportions:
 *
 *  - `port` is a SMALL SQUARE (§11.3.4) — 16 × 16, the one footprint in the pack
 *    that is not big enough to write in, which is why its label is placed beside
 *    it rather than inside it (`component.ts`);
 *  - the two interface glyphs are 60 × 40, tall enough for a ball or a socket
 *    over the stub that carries it (§10.4.4) and no wider than the glyph needs —
 *    their names are written beside them too;
 *  - `artifact` is the note's 180 × 100: a file name over a line or two of what
 *    it holds, which is the same amount of writing (§19.3.4);
 *  - the three cubes share 220 × 140 (§19.4.4). Wider and taller than a class
 *    box because the 3-D depth eats into both: the FRONT FACE — the only part a
 *    name can be written in — is what has to end up the size of a box.
 */
export const UML_NODE_BOX: Record<UmlNodeKind, { w: number; h: number }> = {
  class: { w: 200, h: 120 },
  interface: { w: 200, h: 120 },
  enumeration: { w: 200, h: 120 },
  object: { w: 200, h: 120 },
  package: { w: 200, h: 130 },
  note: { w: 180, h: 100 },
  actor: { w: 80, h: 120 },
  'use-case': { w: 200, h: 90 },
  component: { w: 200, h: 120 },
  port: { w: 16, h: 16 },
  'provided-interface': { w: 60, h: 40 },
  'required-interface': { w: 60, h: 40 },
  artifact: { w: 180, h: 100 },
  node: { w: 220, h: 140 },
  device: { w: 220, h: 140 },
  'execution-environment': { w: 220, h: 140 },
  // ── The activity footprints (phase 2) ──────────────────────────────────
  // An `action` is WIDER AND SHALLOWER than a class box: §15.3.4 writes a verb
  // phrase in it — "Vérifier le stock", one line — where a classifier holds a
  // signature list. 160 × 60 is the box that phrase fits across rather than
  // down, and it is the module a whole activity diagram is measured in.
  action: { w: 160, h: 60 },
  // The control nodes are DOTS AND BARS, not boxes: every one of them is sized
  // to its own picture, because none of them has words inside it.
  //
  //  - `initial` is the filled disc, 24 across — small enough to read as a
  //    marker rather than as a node, big enough to aim at;
  //  - `activity-final` and `flow-final` are 28, a touch larger because both
  //    are a circle with something INSIDE it (a second disc, a cross) and a
  //    24-unit ring would close up;
  //  - `decision` is the diamond, square by construction so it stays a diamond;
  //  - `fork` is the bar — 120 long and 10 thick, the one footprint in the pack
  //    that is deliberately degenerate in one dimension (§15.3.4 draws a line
  //    segment, and a bar as tall as it is wide would read as a box).
  initial: { w: 24, h: 24 },
  'activity-final': { w: 28, h: 28 },
  'flow-final': { w: 28, h: 28 },
  decision: { w: 48, h: 48 },
  fork: { w: 120, h: 10 },
  // §15.4.4: a plain rectangle carrying a value. Narrower than an action,
  // because it holds a NOUN — `Commande [validée]` — and taller than nothing,
  // because the optional `[state]` goes on a second line.
  'object-node': { w: 140, h: 60 },
  // §16.3.4: the two pentagons. The action's own 160 × 60, so a signal sent in
  // the middle of a flow lines up with the actions either side of it without
  // anybody resizing anything — the point of the shape is the silhouette, not
  // the size.
  'send-signal': { w: 160, h: 60 },
  'accept-event': { w: 160, h: 60 },
  // §16.10.4: the hourglass. TALL and narrow, which is what an hourglass is —
  // and small, because its words are written beside it rather than in it
  // (`component.ts`), there being no inside to write in.
  'time-event': { w: 40, h: 56 },
  // ── The state machine footprints (phase 2) ─────────────────────────────
  // §14.2.4: a state is the biggest box of the two behaviour families, because
  // it is the only one with a COMPARTMENT — a name over the internal activities
  // (`entry /`, `do /`, `exit /`), which is three lines under a heading.
  state: { w: 180, h: 90 },
  // The bullseye, drawn exactly like `activity-final` and therefore exactly its
  // size: two shapes a reader is meant to recognise as the same picture must
  // not arrive at different sizes.
  'final-state': { w: 28, h: 28 },
  // The pseudostates, every one of them a small mark:
  //
  //  - `choice` is the diamond again, at 40 rather than the decision's 48 —
  //    §14.2.4 draws it smaller, and the difference is what keeps an activity's
  //    decision and a machine's choice from being mistaken for one another;
  //  - `junction` is the smallest mark in the pack at 16, a filled dot that
  //    merely joins lines;
  //  - the two histories are 28, the circle that has to hold an `H` or an `H*`;
  //  - `entry-point` and `exit-point` are 20 — a hollow circle and a crossed
  //    one, drawn ON the border of a composite state, so they are sized like
  //    the port they behave like (§11.3.4's 16 plus room for the cross);
  //  - `terminate` is the bare X, at the finals' own 28 so a machine's three
  //    end marks are one size.
  choice: { w: 40, h: 40 },
  junction: { w: 16, h: 16 },
  'shallow-history': { w: 28, h: 28 },
  'deep-history': { w: 28, h: 28 },
  'entry-point': { w: 20, h: 20 },
  'exit-point': { w: 20, h: 20 },
  terminate: { w: 28, h: 28 },
  // ── The interaction footprints (phase 3) ───────────────────────────────
  // §17.3.4: a lifeline is a NARROW TALL COLUMN — the element IS the spine, and
  // the head is painted over its top by the glyph layer (see
  // {@link UML_LIFELINE_HEAD}). 16 wide so a message's native perimeter anchors
  // land 8 units either side of the dashed line rather than 80, which is the
  // whole reason the element is not head-shaped; 600 tall because that is a
  // sheet's worth of conversation at the 40-unit rhythm messages are drawn on.
  //
  // The one footprint in the pack that is SMALLER than its own picture, and the
  // model says so in as many words: `UmlNodeElementModel.elementBound` and
  // `.includesPoint` both widen to the head.
  lifeline: { w: 16, h: UML_LIFELINE_SPINE },
  // §17.2.4: the ExecutionSpecification, a thin bar sat ON the spine. 12 wide —
  // a touch narrower than the 16-unit column, so a bar dropped on a lifeline
  // reads as sitting on the line rather than as replacing it. 80 tall is two
  // messages' worth of "busy", which is what an author drags longer or shorter.
  execution: { w: 12, h: 80 },
  // §17.2.4: the destruction X. A SQUARE, like every other bare cross in the
  // pack (`terminate`, `flow-final`), at the size a mark drawn over a 16-unit
  // column has to be to be seen against it.
  destruction: { w: 24, h: 24 },
};

/**
 * How far a PORT's centre may sit from its component's outline before
 * `uml.port-on-border` speaks — the tolerance of the `border-proximity` rule
 * (ADR 0024).
 *
 * The glyph's own side, and derived from it rather than restated: §11.3.4 draws
 * a port as a small square ON the boundary, and what makes that reading legible
 * is the square's own footprint against the line, not the size of the component
 * behind it. Three drawings, and the constant is chosen so each gets the answer
 * the eye gives:
 *
 *  - HALF IN, HALF OUT — the clause's own preferred picture. The centre is on
 *    the line, distance 0, and nothing is said.
 *  - TANGENT INSIDE, the square just clear of the edge. The centre is 8 units
 *    in, half the glyph, well under the tolerance: also silence, because that is
 *    a port an author drew on the border and a tool arguing with it is a tool
 *    switched off.
 *  - PUSHED IN BY ITS OWN SIZE, the square a full 16 units clear of the edge.
 *    The centre is 24 units in, past the tolerance, and the finding falls. That
 *    is the drawing the PO made on the recette of 2026-09-16: a port dragged
 *    into the middle of its component, which §11.3.4 gives no meaning at all.
 *
 * Deliberately NOT `UML_ATTACH_TOLERANCE` (`model.ts`), which is 24 and measures
 * something else: an edge-to-edge GAP, used to decide which box a glyph belongs
 * to when the exporters need an owner. This one measures a centre against a
 * line, and the two numbers answering two questions is better than one number
 * quietly meaning both.
 */
export const UML_PORT_BORDER_TOLERANCE = UML_NODE_BOX.port.w;

/* ── The two behaviour frames ──────────────────────────────────────────── */

/**
 * The size a fresh PARTITION is created at (§15.6.4), in its default VERTICAL
 * orientation: a column, as tall as the diagram frame it is dropped on and wide
 * enough for an action box (160) with air either side of it.
 *
 * A horizontal partition is created by transposing this, which the creation
 * site does rather than a second constant: a row is a column turned, and two
 * pairs of numbers would be two things to keep in step.
 */
export const UML_PARTITION_BOX = { w: 360, h: 900 } as const;

/**
 * The size a fresh composite state is created at (§14.2.4) — the subject's own
 * footprint, because it is the same kind of object: a rectangle drawn round a
 * handful of elements that are already there.
 */
export const UML_REGION_BOX = { w: 520, h: 320 } as const;

/**
 * The partition's and the region's inset from their own border — the room the
 * drawing gives up on the three sides that carry no band.
 *
 * The subject's 12, and for the same reason: both are transparent frames drawn
 * OVER work that is already there, so every unit of margin is a unit of that
 * work the frame's own furniture sits on top of.
 */
export const UML_PARTITION_MARGIN = 12;
export const UML_REGION_MARGIN = 12;

/** Both frames' outline: solid and thin, exactly as §15.6.4 and §14.2.4 draw them. */
export const UML_PARTITION_BORDER_WIDTH = 1.5;
export const UML_REGION_BORDER_WIDTH = 1.5;

/**
 * The corner radius of a composite state, in MODEL UNITS.
 *
 * §14.2.4 draws a state — simple or composite — as a ROUND-CORNERED rectangle,
 * and a composite state that came back square would read as a subject or a
 * partition rather than as the state it is. An absolute rather than a fraction,
 * unlike {@link UML_NODE_RADIUS}, because the framework-background declaration's
 * `border.radius` is in model units: the primitive draws the card, and the card
 * is measured in the units the element is.
 */
export const UML_REGION_RADIUS = 16;

/**
 * The name band of a partition and of a composite state — the strip each writes
 * its name in, owned by `@labre/affine-model` because both hit tests read it.
 *
 * Re-exported here so this file stays the one place a reader looks for the
 * pack's metrics, exactly as {@link UML_FRAME_BAND_HEIGHT} is.
 */
export { UML_PARTITION_BAND, UML_REGION_BAND } from '@labre/affine-model';

/* ── The interaction artefacts (phase 3) ───────────────────────────────── */

/**
 * The lifeline's head box and the height of its column, owned by
 * `@labre/affine-model` because the ELEMENT's own `elementBound` and
 * `includesPoint` read them: §17.3.4's head is 160 wide over a 16-wide column,
 * so the picture overflows the box the platform knows about and the model has
 * to say so.
 *
 * Re-exported here so this file stays the one place a reader looks for the
 * pack's metrics, exactly as {@link UML_FRAME_BAND_HEIGHT} is.
 */
export { UML_LIFELINE_HEAD, UML_LIFELINE_SPINE } from '@labre/affine-model';

/**
 * The dash pattern of a lifeline's SPINE, in model units (§17.3.4).
 *
 * 6 on, 6 off: even, because the spine is a TIMELINE rather than a relationship
 * — nothing about it points one way — and long enough to read as a dashed line
 * rather than as a dotted one at the zoom a whole sequence diagram is viewed
 * at.
 */
export const UML_LIFELINE_DASH = [6, 6] as const;

/** The spine's own weight: lighter than the head, which is a box and not a line. */
export const UML_LIFELINE_SPINE_WIDTH = 1.5;

/**
 * The size a fresh combined fragment is created at (§17.6.4).
 *
 * Wide enough to cover three lifelines at the 200-unit spacing a sequence
 * diagram is laid out on, and tall enough for the three or four exchanges an
 * `alt` is actually drawn round. The same pair the model seeds its `xywh` with,
 * and the declaration reads it from here.
 */
export const UML_FRAGMENT_BOX = { w: 600, h: 260 } as const;

/**
 * The fragment's inset from its own border on the three sides that carry no
 * tag — the subject's and the partition's 12, and for the same reason: a
 * transparent frame drawn over work that is already there spends every unit of
 * margin on somebody else's drawing.
 */
export const UML_FRAGMENT_MARGIN = 12;

/** Its outline: solid and thin, exactly as §17.6.4 draws it. */
export const UML_FRAGMENT_BORDER_WIDTH = 1.5;

/**
 * The dashed line between two operands (§17.6.4).
 *
 * A LONGER dash than the lifeline's, on purpose: the two are drawn on the same
 * sheet, crossing each other, and a reader has to tell "this participant exists
 * but is idle" from "the alternative below is a different case".
 */
export const UML_FRAGMENT_OPERAND_DASH = [10, 6] as const;

/**
 * The fragment's operator band — the strip its pentagon is drawn in, owned by
 * `@labre/affine-model` because the fragment's hit test reads it.
 *
 * Re-exported for the reason every other band is.
 */
export { UML_FRAGMENT_BAND } from '@labre/affine-model';

/**
 * The guard written in an operand's own corner, and its inset from the
 * operand's top-left.
 *
 * Smaller than a name: §17.6.4 writes `[x > 0]` as a condition, not as a
 * heading, and a guard set at the frame heading's 20px would compete with the
 * operator word two lines above it.
 */
export const UML_FRAGMENT_GUARD_FONT_SIZE = UML_BODY_FONT_SIZE;
export const UML_FRAGMENT_GUARD_INSET = 8;

/**
 * How close to an operand separator the pointer counts as being ON it, in model
 * units either side.
 *
 * The BPMN pool's own grab half-width, and deliberately: the two gestures are
 * the same gesture on the same kind of line, and a user who has learnt one
 * should not find the other fussier. 12 is wide enough to aim at with a mouse
 * and narrow enough that it does not swallow the messages drawn either side of
 * it.
 */
export const UML_OPERAND_GRAB = 12;

/**
 * The GUARD's rename target: the corner box a double-click on an operand's
 * `[condition]` has to land in.
 *
 * Deliberately a CORNER and not the whole band (see `board-hit.ts`): an
 * operand's guard is written over the messages it governs, so a zone covering
 * the operand would take every double-click meant for them. Wide enough for a
 * realistic condition at the guard's own size, and one line tall plus the inset
 * it is anchored by.
 */
export const UML_OPERAND_GUARD_WIDTH = 180;
export const UML_OPERAND_GUARD_HEIGHT =
  UML_FRAGMENT_GUARD_FONT_SIZE + UML_FRAGMENT_GUARD_INSET * 2;

/**
 * The smallest an operand may be dragged, in model units at the fragment's own
 * reference height — converted to a weight against that fragment's total, so a
 * fragment stretched taller keeps the same VISIBLE floor.
 *
 * 48 is the guard line plus room for one message under it: an operand smaller
 * than that holds nothing, and the separator that made it is no longer a
 * division of anything.
 */
export const UML_OPERAND_MIN_HEIGHT = 48;

/* ── Rounded artefacts ─────────────────────────────────────────────────── */

/**
 * The corner radius of an `action` and of a `state`, as the native shape
 * renderer reads it: a value below 1 is a FRACTION of the box's shorter side.
 *
 * The two round-cornered rectangles of the notation (§15.3.4, §14.2.4), and the
 * only two places this pack departs from `radius: 0`. That zero is not a house
 * style to be defended here — it is what §11.4.4 draws for a classifier — and
 * these two are what §15.3.4 and §14.2.4 draw for their own boxes. A square
 * action is an action that looks like a class.
 *
 * 0.12 of the shorter side: 7 units on a 160 × 60 action, 11 on a 180 × 90
 * state. Enough to be seen at a glance across a sheet, little enough that the
 * box is still a box.
 */
export const UML_NODE_RADIUS = 0.12;
