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
 * The hexes are Structurizr's own defaults, which is what every C4 drawing in
 * the wild is calibrated against. Every value here is a creation-time DEFAULT;
 * each one is an editable shape property afterwards, exactly as in BPMN.
 */

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
  border: '#6b6b6b',
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
 */
export const NODE_PALETTE: Record<C4NodeKind, C4NodePaint> = {
  person: { fill: '#08427b', border: '#052e56', text: WHITE },
  'person-ext': EXTERNAL,
  system: { fill: '#1168bd', border: '#0b4884', text: WHITE },
  'system-ext': EXTERNAL,
  container: { fill: '#438dd5', border: '#2e6295', text: WHITE },
  database: { fill: '#438dd5', border: '#2e6295', text: WHITE },
  mobile: { fill: '#438dd5', border: '#2e6295', text: WHITE },
  browser: { fill: '#438dd5', border: '#2e6295', text: WHITE },
  component: { fill: '#85bbf0', border: '#5d9bd8', text: BLACK },
};

/** Border weight of every node — one line, as the stencil draws it. */
export const NODE_STROKE_WIDTH = 2;

/** Corner radius of the boxed kinds (system, container, component, …). */
export const NODE_RADIUS = 10;

/** Inner-text font size for a node label. */
export const INNER_FONT_SIZE = 16;

/**
 * Default node sizes (model units) per kind.
 *
 * Two sizes carry almost the whole pack, for the same reason BPMN's three do:
 * a C4 box holds a name, a technology and a sentence of description, so it is
 * WIDE and squat — 210 × 120 — and every boxed kind takes it, which is what
 * makes a row of containers line up without anybody arranging them.
 *
 * The two exceptions earn it by silhouette:
 *
 *  - `person` is TALLER than it is wide-ish (160 × 150) because a head sits
 *    above the body block, and the body still has to hold the same name;
 *  - `database` is 190 × 130 — a shade narrower and a shade taller than a box,
 *    which is what a cylinder needs to read as one rather than as a squashed
 *    rectangle with curves at the ends.
 *
 * `mobile` and `browser` keep the container's own size exactly: their band is
 * drawn INSIDE the box, so a phone that was smaller than its siblings would
 * claim a distinction the notation does not make.
 */
export const NODE_SIZE: Record<C4NodeKind, { w: number; h: number }> = {
  person: { w: 160, h: 150 },
  'person-ext': { w: 160, h: 150 },
  system: { w: 210, h: 120 },
  'system-ext': { w: 210, h: 120 },
  container: { w: 210, h: 120 },
  database: { w: 190, h: 130 },
  mobile: { w: 210, h: 120 },
  browser: { w: 210, h: 120 },
  component: { w: 210, h: 120 },
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

export const BOUNDARY_STROKE = '#6b6b6b';
export const BOUNDARY_WIDTH = 2;
export const BOUNDARY_CORNER_RADIUS = 10;
/** The dash, in model units: a long mark and a wide gap, as C4 draws it. */
export const BOUNDARY_DASH = [12, 8] as const;
export const BOUNDARY_NAME_FONT_SIZE = 15;
export const BOUNDARY_NAME_COLOR = '#4a4a4a';
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
 */
export const RELATIONSHIP_STROKE = '#707070';
export const RELATIONSHIP_WIDTH = 2;
