import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';

import {
  BOARD_BORDER_WIDTH,
  BOARD_CARD_BORDER,
  BOARD_CARD_FILL,
  BOARD_CORNER_RADIUS,
  BOARD_MARGIN,
  BOARD_REF_HEIGHT,
  BOARD_REF_WIDTH,
  BOARD_TITLE_COLOR,
  BOARD_TITLE_FONT_SIZE,
  BOARD_TITLE_MARGIN,
  BOUNDARY_CORNER_RADIUS,
  BOUNDARY_DASH,
  BOUNDARY_MARGIN,
  BOUNDARY_NAME_COLOR,
  BOUNDARY_NAME_FONT_SIZE,
  BOUNDARY_NAME_INSET,
  BOUNDARY_REF_HEIGHT,
  BOUNDARY_REF_WIDTH,
  BOUNDARY_STROKE,
  BOUNDARY_WIDTH,
  FONT_FAMILY,
} from './consts';
import { C4_ROLE } from './roles';

/**
 * The two C4 frames, DECLARED (the `FrameworkBackgroundDef` primitive).
 *
 * There is no C4 drawing code for either of them: the primitive paints these
 * declarations, and would paint any other framework's the same way
 * (`docs/adr/0009` on why a framework declares rather than draws).
 */

/* ── The board ─────────────────────────────────────────────────────────── */

/**
 * The C4 board: a titled white card, and nothing else.
 *
 * **No axes and no zones**, exactly like the Context Map board this is modelled
 * on, and for the same reason: a C4 diagram is a GRAPH, not a chart. A system
 * drawn top left says nothing more than one drawn bottom right, and graduating
 * the card would invent a frame of reference C4 does not have — and then judge
 * people against it.
 *
 * What the declaration is for here is the ROLE, the geometry and the TITLE:
 * `c4:board` is what a rule frames its subjects against, and the title is what
 * says which of the four levels this particular sheet is drawing.
 *
 * ## Why the title is declared as a zone label
 *
 * The primitive knows three places words can come from: a side band's label, a
 * zone's label and an axis' title (`backgroundTexts`). A board has no band and
 * no axis, so a single full-plot zone — no fill, no tint, nothing painted but
 * its name — is what carries the title. That keeps it on the ONE walk both the
 * renderer and the hit tester use, which is what makes the words the user
 * double-clicks the same words they see (`C4BoardView`).
 */
export const C4_BOARD_BACKGROUND: FrameworkBackgroundDef = {
  type: 'c4Board',
  role: C4_ROLE.board,
  geometry: {
    // Wide and free, the Context Map board's own call: a C4 diagram grows
    // sideways as the system is discovered, so neither dimension is locked to
    // the other and the handles are offered from the start.
    width: BOARD_REF_WIDTH,
    height: BOARD_REF_HEIGHT,
    lockAspectRatio: false,
    resizable: true,
    // Only the top margin is deep: that is where the title is written.
    margin: {
      top: BOARD_TITLE_MARGIN,
      right: BOARD_MARGIN,
      bottom: BOARD_MARGIN,
      left: BOARD_MARGIN,
    },
  },
  zones: [
    {
      id: 'title',
      // The whole plot, and nothing painted over it: this zone exists to carry
      // a label, not to tint a region. Reported by the audit as one zone
      // covering the board, which is the honest answer — a C4 board has exactly
      // one region and it is the board.
      rect: { x: 0, y: 0, w: 1, h: 1 },
      label: {
        id: 'name',
        // The user's own words, and only those: a diagram is titled by whoever
        // draws it, so there is no vocabulary to fall back to and no `labelKey`
        // to declare. Same call the BPMN pool's participant name makes.
        prop: 'name',
        // `y: 0` is the top of the plot; a negative `dy` walks back UP into the
        // title margin, where the words are written.
        anchor: { x: 0, y: 0, dy: -BOARD_TITLE_MARGIN / 3 },
        style: {
          size: BOARD_TITLE_FONT_SIZE,
          weight: 600,
          color: '@title',
        },
      },
    },
  ],
  chrome: {
    fontFamily: FONT_FAMILY,
    palette: {
      card: BOARD_CARD_FILL,
      cardBorder: BOARD_CARD_BORDER,
      title: BOARD_TITLE_COLOR,
    },
    surface: {
      fill: '@card',
      border: {
        color: '@cardBorder',
        width: BOARD_BORDER_WIDTH,
        radius: BOARD_CORNER_RADIUS,
      },
    },
  },
};

/* ── The boundary ──────────────────────────────────────────────────────── */

/**
 * The C4 boundary: a dashed rectangle with its name in the bottom-left corner.
 *
 * The one background in the library that is deliberately TRANSPARENT. Every
 * other one is a card you put things on — a Wardley map, a pool, a board — and
 * the PO's recette of 26/08/2026 settled that they all paint white. A boundary
 * is the opposite object: it is drawn OVER a diagram, round elements that are
 * already there, and an opaque card would hide the very thing it is pointing at.
 * So it declares a border and no fill, which the primitive paints as an unfilled
 * frame.
 *
 * The consequence is worth stating because it is the reverse of the usual one: a
 * boundary dropped over existing elements does NOT cover them, and it is not
 * hit anywhere but on its own frame area — it is a lasso, in the same sense
 * BPMN's group is.
 *
 * ## The dash
 *
 * Declared, not drawn: `surface.border.dash` was added to the primitive for this
 * (see `BackgroundSurfaceDef`). It is the whole distinction between a boundary
 * and a board at a glance, so it belongs where the rest of the frame is
 * declared, in data a reviewer can read.
 *
 * ## The variant
 *
 * `variantProp` is deliberately NOT declared. A variant gates pieces of the
 * declaration by matching a model prop, and `variant` is OPTIONAL on the
 * element — an unstated one reads as the string `"undefined"`, matches no
 * variant and would paint NOTHING at all. Since the two variants are the same
 * dashed rectangle and differ only in the wording a fresh boundary is NAMED
 * with, that wording lives at the creation site instead (`BOUNDARY_LABEL` in
 * `consts.ts`), and this file simply draws whatever `name` says. Laziest wiring
 * that cannot paint a blank frame.
 */
export const C4_BOUNDARY_BACKGROUND: FrameworkBackgroundDef = {
  type: 'c4Boundary',
  role: C4_ROLE.boundary,
  geometry: {
    width: BOUNDARY_REF_WIDTH,
    height: BOUNDARY_REF_HEIGHT,
    // A boundary is stretched to fit whatever it has been drawn round, which is
    // never the same shape twice.
    lockAspectRatio: false,
    resizable: true,
    margin: {
      top: BOUNDARY_MARGIN,
      right: BOUNDARY_MARGIN,
      bottom: BOUNDARY_MARGIN,
      left: BOUNDARY_MARGIN,
    },
  },
  zones: [
    {
      id: 'name',
      rect: { x: 0, y: 0, w: 1, h: 1 },
      label: {
        id: 'name',
        prop: 'name',
        // Bottom-left INSIDE the plot — the corner C4 writes a boundary's name
        // in, and the one corner of a frame that is least likely to have an
        // element sitting in it.
        anchor: { x: 0, y: 1, dy: -BOUNDARY_NAME_INSET },
        style: {
          size: BOUNDARY_NAME_FONT_SIZE,
          weight: 600,
          color: '@name',
        },
      },
    },
  ],
  chrome: {
    fontFamily: FONT_FAMILY,
    palette: {
      frame: BOUNDARY_STROKE,
      name: BOUNDARY_NAME_COLOR,
    },
    surface: {
      // NO fill — see the note above. This is the transparent one.
      border: {
        color: '@frame',
        width: BOUNDARY_WIDTH,
        radius: BOUNDARY_CORNER_RADIUS,
        dash: BOUNDARY_DASH,
      },
    },
  },
};
