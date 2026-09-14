import type { UmlNodeKind } from '@labre/affine-model';
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
};
