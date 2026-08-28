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
 * {@link INNER_FONT_SIZE} is the TITLE and is the native shape's own inner text,
 * so it is a creation-time property the author can change from the shape
 * toolbar. The other two are painted by the node renderer and are fixed: they
 * are notation, not typography — the type line is smaller than the name on every
 * C4 diagram ever drawn, and letting it grow past it would say the wrong thing.
 */
export const INNER_FONT_SIZE = 10 * STENCIL_SCALE;
export const TYPE_FONT_SIZE = 6 * STENCIL_SCALE;
export const DESCRIPTION_FONT_SIZE = 8 * STENCIL_SCALE;

/**
 * Where the two painted tiers sit, as multiples of their OWN font size.
 *
 * Measured off the stencil's baselines rather than chosen: the name's baseline
 * and the type line's are 1.167em of the name apart, and the description opens
 * 2.187em of its own size below the type line — that gap is the BLANK LINE the
 * stencil leaves between the two, and it is what keeps a sentence from reading
 * as a fourth tier of the heading. Expressed as ratios so every one of them
 * survives a user changing the title's font size.
 */
export const TYPE_LINE_GAP = 1;
export const DESCRIPTION_GAP = 1.7;
export const DESCRIPTION_LINE_HEIGHT = 1.19;

/** Side inset the two painted tiers wrap inside, as a fraction of the width. */
export const TIER_SIDE_INSET = 0.06;

/**
 * Where the person's body top edge sits, as a fraction of the whole silhouette
 * — `47.767 / 122.18`, the head's clear height over the total.
 *
 * The renderer derives the same edge from the head RADIUS instead
 * (`PERSON.bodyTopPerHead`), which is the form that survives an element dragged
 * to an aspect ratio the head has to be clamped at; the two agree exactly at the
 * stencil's own proportions. This one is what the creation site needs: it has a
 * box and no glyph, and it has to know where the words can go.
 */
export const PERSON_BODY_TOP = 47.767 / 122.18;

/**
 * The title's top margin INSIDE its body, as a fraction of the body height.
 *
 * The stencil's name sits with its line box 15.2 units under the body's top edge
 * of a 74.409-tall body, on every kind — the person's included, whose text is
 * laid out in the body rather than in the silhouette (its `v:textRect` is the
 * body box exactly). Which is why this is a fraction of the BODY and the caller
 * adds {@link PERSON_BODY_TOP} on top for the two people.
 */
export const TITLE_TOP_MARGIN = 15.2 / 74.409;

/**
 * Default node sizes (model units) per kind.
 *
 * ## One footprint, and one exception the stencil itself draws
 *
 * The reference model gives every element the SAME box — `106.3 × 74.409`, a
 * `v:textRect` repeated verbatim on the system, the container, the component,
 * the database, the phone and the browser window. At ×2 that is
 * {@link NODE_BOX}: 212 × 148, and eight of the nine kinds take it exactly. A
 * row of C4 elements lining up without anybody arranging them is not a
 * convenience, it is what makes a level readable.
 *
 * `person` and `person-ext` are the exception, and it is the FILE's exception,
 * not a preference. Their silhouette is one path (`mID 1`) whose head arc is
 * drawn with `large-arc-flag=1` about a centre 21.26 units ABOVE the body's top
 * edge — so the head stands 47.77 units clear of a body that is itself the
 * standard 74.409 tall, and the whole person measures 106.3 × 122.18. The
 * stencil's own sheet shows it: the person's group is translated 23.88 further
 * down the page than the system beside it, precisely to make room. At ×2 that is
 * 212 × 244.
 *
 * Forcing a person into 212 × 148 was considered and rejected: the head is a
 * CIRCLE (`rx 26.362`, `ry 26.504`) and stays one only at the silhouette's own
 * aspect ratio — squeezed into a box 1.43 times wider than it is tall, it
 * becomes a flat ellipse, which is the one thing about a C4 person everybody
 * recognises and the one thing that would then be wrong.
 */
export const NODE_BOX = {
  w: 106.3 * STENCIL_SCALE,
  h: 74.409 * STENCIL_SCALE,
} as const;

/** The person's full silhouette — head included. See {@link NODE_SIZE}. */
export const PERSON_BOX = {
  w: 106.3 * STENCIL_SCALE,
  h: 122.18 * STENCIL_SCALE,
} as const;

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
 * The size a fresh board is created at, and the room its furniture takes.
 *
 * The Context Map board's own numbers: a C4 diagram is the same kind of object —
 * a sheet you spread out and add boxes to as the system is discovered — so it
 * starts at the same size and grows the same way. The top margin is deeper than
 * the other three because that is where the title is written.
 */
export const BOARD_REF_WIDTH = 1400;
export const BOARD_REF_HEIGHT = 900;
export const BOARD_MARGIN = 24;
export const BOARD_TITLE_MARGIN = 56;

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
