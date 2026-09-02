import type { C4BoundaryVariant, C4NodeKind } from '@labre/affine-model';

/**
 * Visual constants for the C4 pack.
 *
 * Unlike BPMN — a black-and-white notation where the SHAPE carries the meaning
 * and colour is decoration — C4's official stencil is a colour code: the four
 * levels are four blues, from the near-navy of a person down to the pale wash of
 * a component, and anything outside the scope of the diagram is grey. That is
 * the one thing a reader uses to tell a container from a component when both are
 * rounded rectangles with words in them, so the palette below IS the notation
 * and is written down as data rather than left to whoever draws next.
 *
 * Every hex, every size and every radius below is read off the PO's own
 * reference model — the Visio-exported `C4Model_default.svg` stencil — rather
 * than approximated, and the file's units are carried through at ×2 so that a
 * default node is a comfortable size on a canvas. Where a number is a fraction
 * of the node box rather than an absolute, it lives in the renderer beside the
 * path it shapes. Every value here is a creation-time DEFAULT; each one is an
 * editable shape property afterwards, exactly as in BPMN.
 */

/** The stencil's own unit → model unit factor. Every absolute below is ×2. */
export const STENCIL_SCALE = 2;

/** One kind's three colours: the body, the line round it, and the words in it. */
export interface C4NodePaint {
  fill: string;
  /** The border — the fill, taken a step darker. */
  border: string;
  /** The inner text, chosen for contrast against {@link fill}. */
  text: string;
}

const WHITE = '#ffffff';
const BLACK = '#000000';

/**
 * The grey every EXTERNAL element is drawn in — a person or a system somebody
 * else owns. One grey for both, because "outside the scope of this diagram" is
 * one statement and the level of the thing outside it is not the point.
 */
const EXTERNAL: C4NodePaint = {
  fill: '#999999',
  border: '#8b8b8b',
  text: WHITE,
};

/**
 * The palette, per kind. TOTAL over {@link C4NodeKind} by its type, so a kind
 * added to the model cannot land without being given a colour.
 *
 * The four levels run light as they go IN: a person is the darkest thing on the
 * page (#08427b), a software system one step lighter (#1168bd), every container
 * lighter again (#438dd5) and a component palest of all (#85bbf0) — which is
 * also the one that takes black text, because white on that wash is unreadable.
 * `database`, `mobile` and `browser` are CONTAINERS and take the container's
 * colour exactly: what makes them different is the silhouette the renderer
 * draws, never the level, and a fourth blue would say otherwise.
 *
 * Every border is the stencil's own darker shade of its fill, lifted verbatim
 * from the reference model's stylesheet (`.st1`, `.st5`, `.st6`, `.st7`,
 * `.st22`) rather than darkened by eye — which is what makes the two decorated
 * containers work at all: `mobile` and `browser` paint their BEZEL in the border
 * colour and their SCREEN in the fill, so the pair has to be the stencil's pair.
 */
export const NODE_PALETTE: Record<C4NodeKind, C4NodePaint> = {
  person: { fill: '#08427b', border: '#073b6f', text: WHITE },
  'person-ext': EXTERNAL,
  system: { fill: '#1168bd', border: '#1864ad', text: WHITE },
  'system-ext': EXTERNAL,
  container: { fill: '#438dd5', border: '#3d81c3', text: WHITE },
  database: { fill: '#438dd5', border: '#3d81c3', text: WHITE },
  mobile: { fill: '#438dd5', border: '#3d81c3', text: WHITE },
  browser: { fill: '#438dd5', border: '#3d81c3', text: WHITE },
  component: { fill: '#85bbf0', border: '#78a8d8', text: BLACK },
};

/** Border weight of every node — one line (stencil `stroke-width:1`), ×2. */
export const NODE_STROKE_WIDTH = 2;

/**
 * Corner radius of each kind's OUTER body, in model units.
 *
 * A table rather than one number, because the stencil is not uniform and the
 * difference is legible: `system`, `system-ext`, `container` and `component` are
 * plain `<rect>`s with **no `rx` at all** — square corners — while the two
 * decorated containers are rounded, the phone noticeably (`rx="4.252"`) and the
 * browser window barely (`rx="1.4173"`). The three glyph-bodied kinds carry `0`
 * because their native rect paints nothing: a person's shoulders and a
 * cylinder's lid are curves the glyph draws itself, in proportion to the box.
 *
 * This corrects the pack's first pass, which rounded every kind at 10 — a
 * plausible house style, and one the reference model does not draw.
 */
export const NODE_RADIUS: Record<C4NodeKind, number> = {
  person: 0,
  'person-ext': 0,
  system: 0,
  'system-ext': 0,
  container: 0,
  database: 0,
  mobile: 4.252 * STENCIL_SCALE,
  browser: 1.4173 * STENCIL_SCALE,
  component: 0,
};

/**
 * The three text tiers, at the stencil's own sizes (10 / 6 / 8) ×2.
 *
 * All three are creation-time DEFAULTS the author can change afterwards, and all
 * three are now CANVAS TEXT ELEMENTS: since the PO's recette of 28/08/2026 a C4
 * component is a group holding the shape and its three lines of words — the
 * name included — so every tier is ordinary text with its own toolbar rather
 * than something a renderer painted and nobody could type on.
 *
 * The name was the shape's native inner text for one iteration and is not any
 * more, which is the second half of that recette: two kinds of text in one
 * component meant two editors, two toolbars and two sets of rules for the same
 * three lines. Now there is one of each.
 *
 * The ladder 20 / 16 / 12 is the notation and not typography — the type line is
 * smaller than the name on every C4 diagram ever drawn — but it is a ladder an
 * author can climb off, which is the price of letting them write on the picture.
 */
export const TITLE_FONT_SIZE = 10 * STENCIL_SCALE;
export const TYPE_FONT_SIZE = 6 * STENCIL_SCALE;
export const DESCRIPTION_FONT_SIZE = 8 * STENCIL_SCALE;

/**
 * One line box, as a multiple of its own font size — what the creation site
 * measures a tier's HEIGHT in.
 *
 * The stencil states its tiers as baselines, which is the right unit for a
 * renderer painting into a box and the wrong one for a creation site placing an
 * element: a text element is a rectangle, and where its first baseline lands
 * inside that rectangle is the text renderer's business, not this file's. So the
 * stencil's baseline steps are re-read here as line boxes, which is the same
 * geometry counted from the other end.
 */
export const TIER_LINE_HEIGHT = 1.2;

/**
 * How many lines each of the two wrapping tiers opens with.
 *
 * The title gets TWO, and that is what grew the element (see {@link NODE_BOX}):
 * "Internet Banking System" is 23 characters, and 23 characters at 20px do not
 * fit across 187 units of usable width. A one-line title box would have meant
 * every real system name spilling out of its own tier on the day it was typed —
 * which is precisely the cramped stack the PO's recette was about.
 *
 * The description gets two as well, which is what the stencil's own sentences
 * run to. Neither is a limit: a longer text wraps inside the tier's width and
 * grows the box downward, and the group grows with it, so a component keeps
 * containing its own words.
 */
export const TITLE_LINES = 2;
export const DESCRIPTION_LINES = 2;

/**
 * The vertical rhythm of the stack, in model units.
 *
 * Absolutes rather than multiples of a font size, and deliberately so: what the
 * eye reads here is the SPACE between three blocks of different sizes, and a gap
 * expressed as 0.7em of whichever tier happens to be below it changes meaning
 * every time somebody resizes one of them. These three numbers are the layout.
 *
 * The two gaps are different on purpose. The name and its type line are ONE
 * heading — `Web Application` / `[Container: Java]` is a single statement over
 * two lines — so they sit close. The description is a different statement, and
 * the wider gap under the type line is the stencil's own blank line: it is what
 * keeps a sentence from reading as a fourth tier of the heading.
 *
 * {@link TIER_MARGIN} is equal top and bottom, which is what makes the stack sit
 * in its box rather than in the top of it.
 */
export const TIER_MARGIN = 24;
export const TITLE_TYPE_GAP = 8;
export const TYPE_DESCRIPTION_GAP = 16;

/** Side inset the three text tiers sit within, as a fraction of the node width. */
export const TIER_SIDE_INSET = 0.06;

/**
 * The height of the three tiers and the two gaps between them — the number the
 * default element size is DERIVED from rather than fitted to.
 *
 * 48 + 8 + 14.4 + 16 + 38.4 = 124.8. Written as the sum it is so that changing
 * a font size or a gap moves the box with it: a rhythm and a footprint that can
 * disagree is a rhythm that will.
 */
export const TIER_STACK_HEIGHT =
  TITLE_FONT_SIZE * TIER_LINE_HEIGHT * TITLE_LINES +
  TITLE_TYPE_GAP +
  TYPE_FONT_SIZE * TIER_LINE_HEIGHT +
  TYPE_DESCRIPTION_GAP +
  DESCRIPTION_FONT_SIZE * TIER_LINE_HEIGHT * DESCRIPTION_LINES;

/**
 * The sentence a fresh description prompts the author with.
 *
 * The stencil's own placeholder, and a PROMPT rather than a value: every tier of
 * a C4 component exists from the moment it is drawn (PO arbitration,
 * 28/08/2026), so the author meets three lines of stencil rather than a box and
 * two invisible slots somebody has to tell them about. The exporter compares
 * against it to decide that nothing has been stated yet — see
 * `C4_TYPE_PLACEHOLDER` in `type-line.ts` for the same call on the other tier.
 */
export const DESCRIPTION_PLACEHOLDER = 'description';

/**
 * How far the person's head stands clear ABOVE its body, in model units.
 *
 * The stencil's own `47.767` at ×2, solved off the silhouette path (`mID 1`):
 * its head arc is drawn with `large-arc-flag=1` about a centre 21.26 units above
 * the body's top edge, with `ry=26.504`, so the head clears the body by the sum
 * of the two. Independent of how tall the BODY is, which is what lets the body
 * grow with the text rhythm below without moving the head.
 */
export const PERSON_HEAD_CLEARANCE = 47.767 * STENCIL_SCALE;

/**
 * Default node sizes (model units) per kind.
 *
 * ## One footprint, and one exception the stencil itself draws
 *
 * The reference model gives every element the SAME box — `106.3 × 74.409`, a
 * `v:textRect` repeated verbatim on the system, the container, the component,
 * the database, the phone and the browser window. Seven of the nine kinds take
 * one footprint, and a row of C4 elements lining up without anybody arranging
 * them is not a convenience, it is what makes a level readable.
 *
 * ## Why the box is taller than the stencil's, and by exactly how much
 *
 * The WIDTH is the stencil's, untouched: `106.3 × 2 = 212.6`. Widening it would
 * change every glyph with it — a person's head radius is derived from the width
 * — and the reference proportions are the one thing the recette of 27/08 was
 * about.
 *
 * The HEIGHT is derived from the words instead, which is the PO's call of
 * 28/08/2026: grow the shapes if that is what it takes to have room to write.
 * `74.409 × 2 = 148.8` was the stencil's textRect for a box holding a name it
 * could paint in a single line at whatever size it liked. This one holds three
 * REAL text elements, at fixed sizes, with margins and gaps a reader can see —
 * and the title alone needs two lines, because a system name is routinely longer
 * than 187 units of usable width at 20px. So the height is
 * {@link TIER_STACK_HEIGHT} plus a margin at each end: **212.6 × 172.8**, up
 * from 212.6 × 148.8.
 *
 * Derived rather than chosen, so the box can never disagree with what it holds:
 * change a tier's size or a gap and the footprint follows.
 *
 * ## The person
 *
 * `person` and `person-ext` are the exception, and it is the FILE's exception,
 * not a preference. Their silhouette is one path (`mID 1`) whose head arc is
 * drawn about a centre above the body's top edge, so the head stands
 * {@link PERSON_HEAD_CLEARANCE} clear of a body that is itself the standard box.
 * The stencil's own sheet shows it: the person's group is translated further
 * down the page than the system beside it, precisely to make room. The body
 * grows with everything else, so the person is now **212.6 × 268.3**.
 *
 * Forcing a person into the boxed footprint was considered and rejected: the
 * head is a CIRCLE (`rx 26.362`, `ry 26.504`) and stays one only at the
 * silhouette's own aspect ratio — squeezed into a box far wider than it is tall
 * it becomes a flat ellipse, which is the one thing about a C4 person everybody
 * recognises and the one thing that would then be wrong.
 */
export const NODE_BOX = {
  w: 106.3 * STENCIL_SCALE,
  h: TIER_MARGIN * 2 + TIER_STACK_HEIGHT,
} as const;

/** The person's full silhouette — the standard body, plus the head above it. */
export const PERSON_BOX = {
  w: NODE_BOX.w,
  h: PERSON_HEAD_CLEARANCE + NODE_BOX.h,
} as const;

/**
 * Where the person's body top edge sits, as a fraction of the whole silhouette.
 *
 * Derived from the two boxes rather than restated as the stencil's own ratio, so
 * that growing the body cannot leave this pointing at the middle of the head.
 * The renderer derives the same edge from the head RADIUS instead
 * (`PERSON.bodyTopPerHead`), which is the form that survives an element dragged
 * to an aspect ratio the head has to be clamped at; the two agree at the default
 * size. This one is what the creation site needs: it has a box and no glyph, and
 * it has to know where the words can go.
 */
export const PERSON_BODY_TOP = PERSON_HEAD_CLEARANCE / PERSON_BOX.h;

export const NODE_SIZE: Record<C4NodeKind, { w: number; h: number }> = {
  person: PERSON_BOX,
  'person-ext': PERSON_BOX,
  system: NODE_BOX,
  'system-ext': NODE_BOX,
  container: NODE_BOX,
  database: NODE_BOX,
  mobile: NODE_BOX,
  browser: NODE_BOX,
  component: NODE_BOX,
};

/**
 * Default inner text per kind.
 *
 * Every kind carries one, unlike BPMN — where an event's meaning IS its glyph
 * and the spec puts its name outside the shape. Here the box is the same box at
 * three of the four levels, so a C4 element with nothing written in it says
 * nothing at all: the words are the artefact.
 */
export const NODE_LABEL: Record<C4NodeKind, string> = {
  person: 'Person',
  'person-ext': 'External person',
  system: 'Software system',
  'system-ext': 'External system',
  container: 'Container',
  database: 'Database',
  mobile: 'Mobile app',
  browser: 'Web app',
  component: 'Component',
};

/* ── The board ─────────────────────────────────────────────────────────── */

export const FONT_FAMILY = 'Inter, sans-serif';

/** The card — the same white every framework background paints. */
export const BOARD_CARD_FILL = '#ffffff';
export const BOARD_CARD_BORDER = '#d5d9e0';
export const BOARD_BORDER_WIDTH = 1.5;
export const BOARD_CORNER_RADIUS = 12;
export const BOARD_TITLE_FONT_SIZE = 20;
export const BOARD_TITLE_COLOR = '#262626';

/**
 * The header strip's own tint — a shade of the card, not a colour of its own.
 *
 * Sober on purpose, and the same intent as the pool's participant band
 * (`POOL_BAND_FILL`, `#f4f4f5`): the band has to be SEEN, because a strip a user
 * cannot see is a target they cannot aim at, and it must not read as a second
 * object sitting on the sheet. A hair lighter than the pool's, which is what it
 * takes to stay quiet under a 20-unit title rather than under a 13-unit one.
 */
export const BOARD_BAND_FILL = '#f7f8fa';

/**
 * The size a fresh board is created at, and the room its furniture takes.
 *
 * The Context Map board's own numbers: a C4 diagram is the same kind of object —
 * a sheet you spread out and add boxes to as the system is discovered — so it
 * starts at the same size and grows the same way. The top margin is deeper than
 * the other three because that is where the title is written — and, since the
 * title band, it IS the title band (`C4_BOARD_TITLE_BAND_HEIGHT`, re-exported
 * below from the model that owns it).
 */
export const BOARD_REF_WIDTH = 1400;
export const BOARD_REF_HEIGHT = 900;
export const BOARD_MARGIN = 24;

/**
 * The board's top margin lives in `@labre/affine-model`, beside the board model
 * that hit-tests against it (a board is clickable by its title band as well as
 * by its border — the same carve-out the BPMN pool makes, issues #194 / #197).
 * It is re-exported here so this file stays the one place a reader looks for a
 * board's metrics, and so the declaration keeps reading it from where it always
 * did — under its own name, since a margin that is a painted band is a band.
 */
export { C4_BOARD_TITLE_BAND_HEIGHT } from '@labre/affine-model';

/* ── The boundary ──────────────────────────────────────────────────────── */

/**
 * The boundary's frame and its name, at the stencil's own values ×2 (`.st20`
 * and `.st8` in the reference model).
 *
 * All four numbers changed with the PO's recette of 27/08/2026, and all four
 * were house style before it: the frame was a mid grey at weight 2 with rounded
 * corners, and the stencil draws `#444444` at weight 1 with SQUARE ones. The
 * name is black rather than grey and a size larger, which is what it takes to
 * read a boundary's name over the diagram it is drawn on top of.
 */
export const BOUNDARY_STROKE = '#444444';
export const BOUNDARY_WIDTH = 0.5 * STENCIL_SCALE;
export const BOUNDARY_CORNER_RADIUS = 0;
/** The dash, in model units: the stencil's `stroke-dasharray:7.5,4.5`, ×2. */
export const BOUNDARY_DASH = [
  7.5 * STENCIL_SCALE,
  4.5 * STENCIL_SCALE,
] as const;
export const BOUNDARY_NAME_FONT_SIZE = 10 * STENCIL_SCALE;
export const BOUNDARY_NAME_COLOR = '#000000';
/**
 * The bracket line under a boundary's name — `[Software System]`, `[Container]`
 * — at the stencil's own 6px ×2, on the same 1.917em baseline step it uses.
 *
 * Vocabulary, not user text: the words come from the declaration's `labelKey`
 * and are translatable through the host's catalogue, which is also what keeps
 * them out of the in-place editor. A boundary's NAME is the author's; what kind
 * of boundary it is, is the notation's.
 */
export const BOUNDARY_TYPE_FONT_SIZE = 6 * STENCIL_SCALE;
export const BOUNDARY_TYPE_STEP = 1.917 * BOUNDARY_TYPE_FONT_SIZE;
/** How far above the bottom edge of the plot the name's baseline sits. */
export const BOUNDARY_NAME_INSET = 8;

export const BOUNDARY_REF_WIDTH = 520;
export const BOUNDARY_REF_HEIGHT = 360;
/**
 * The boundary's inset. Small and equal on all four sides: unlike a board, a
 * boundary has no furniture to make room for — the name is written INSIDE the
 * bottom-left corner of the plot, over the diagram, exactly as C4 draws it.
 */
export const BOUNDARY_MARGIN = 12;

/**
 * The wording a fresh boundary is named with, per variant.
 *
 * The variant changes the DEFAULT NAME and nothing else: both are the same
 * dashed rectangle, and C4 tells them apart by what is written under the corner.
 * Read by the creation site (which writes `name`), never by the renderer — the
 * declaration draws whatever the user's own `name` says, so a boundary renamed
 * on the canvas keeps its words whatever its variant.
 */
export const BOUNDARY_LABEL: Record<C4BoundaryVariant, string> = {
  system: 'System boundary',
  container: 'Container boundary',
};

/* ── The relationship ──────────────────────────────────────────────────── */

/**
 * Relationship connector preset — the dashed arrow C4 draws between elements.
 *
 * DASHED and not solid, which is the stencil's own choice and worth keeping:
 * every line on a C4 diagram is a relationship, so the dash is not a
 * distinction between two kinds of line but the house style of the one kind
 * there is. Grey rather than black for the same reason the boundary is: the
 * boxes are the statement, the arrows are the grammar between them.
 *
 * `#444444` at weight 1.5 is the stencil's `.st15` (`stroke:#444444`,
 * `stroke-width:0.75`) at ×2, and it is the SAME grey the boundary frame is
 * drawn in — one neutral for everything that is not an element.
 */
export const RELATIONSHIP_STROKE = '#444444';
export const RELATIONSHIP_WIDTH = 0.75 * STENCIL_SCALE;
