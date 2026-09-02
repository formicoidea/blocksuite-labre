import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';

import {
  BOARD_BAND_FILL,
  BOARD_BORDER_WIDTH,
  BOARD_CARD_BORDER,
  BOARD_CARD_FILL,
  BOARD_CORNER_RADIUS,
  BOARD_MARGIN,
  BOARD_REF_HEIGHT,
  BOARD_REF_WIDTH,
  BOARD_TITLE_COLOR,
  BOARD_TITLE_FONT_SIZE,
  BOUNDARY_CORNER_RADIUS,
  BOUNDARY_DASH,
  BOUNDARY_MARGIN,
  BOUNDARY_NAME_COLOR,
  BOUNDARY_NAME_FONT_SIZE,
  BOUNDARY_NAME_INSET,
  BOUNDARY_REF_HEIGHT,
  BOUNDARY_REF_WIDTH,
  BOUNDARY_STROKE,
  BOUNDARY_TYPE_FONT_SIZE,
  BOUNDARY_TYPE_STEP,
  BOUNDARY_WIDTH,
  C4_BOARD_TITLE_BAND_HEIGHT,
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
 * ## Why the title is declared as a BAND label
 *
 * The primitive knows three places words can come from: a side band's label, a
 * zone's label and an axis' title (`backgroundTexts`). The title used to be a
 * zone's, on the reasoning that a board has no band — a single full-plot zone
 * that painted nothing and existed only to carry a name.
 *
 * It has a band now, and the band is the honest carrier. The deep top margin
 * was ALWAYS the header strip; painting it says so, and once it is painted the
 * name written in it is the band's name in exactly the sense the BPMN pool's
 * participant name is. Nothing else moved: `margin.top` is the same number
 * under its own name (`C4_BOARD_TITLE_BAND_HEIGHT`, declared beside the model
 * that hit-tests against it), the anchor is the same anchor, and the words land
 * on the same pixels — they are simply reached through the ONE walk the
 * renderer and the hit tester share, one entry earlier in it.
 *
 * The zone went with the label it carried. A zone that tints nothing and names
 * nothing is a region the audit reports and no reader can see; the board's one
 * region is the board, which is what the frame already says.
 *
 * ## Why the band is painted at all
 *
 * Because a background is picked by its border and by nothing else (issue
 * #194), and the recette of 02/09/2026 found the consequence: the title had
 * become unreachable. A single click on it selected nothing, and the only thing
 * still answering a double-click was the tight box of the drawn glyphs. The
 * carve-out that fixes it is in the model (`C4BoardElementModel.includesPoint`)
 * — and a strip that is clickable has to be VISIBLE, or it is a target nobody
 * can aim at. So the band is painted for the same reason it is picked.
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
    // Only the top margin is deep: it IS the title band, and the band's height
    // is the margin it covers rather than a second number beside it.
    margin: {
      top: C4_BOARD_TITLE_BAND_HEIGHT,
      right: BOARD_MARGIN,
      bottom: BOARD_MARGIN,
      left: BOARD_MARGIN,
    },
  },
  chrome: {
    fontFamily: FONT_FAMILY,
    palette: {
      card: BOARD_CARD_FILL,
      cardBorder: BOARD_CARD_BORDER,
      band: BOARD_BAND_FILL,
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
    sideBands: [
      {
        // The header strip, across the top: the C4 title is written top-left,
        // so the band a reader sees is the sheet's masthead and not a gutter.
        // The pool's is on the left because a participant name runs up its
        // side; the direction is the notation's, the mechanism is the same one.
        side: 'top',
        fill: '@band',
        // The card's own line, so the strip reads as the frame continued rather
        // than as a different KIND of rule drawn across the sheet.
        divider: { color: '@cardBorder', width: BOARD_BORDER_WIDTH },
        label: {
          id: 'name',
          // The user's own words, and only those: a diagram is titled by whoever
          // draws it, so there is no vocabulary to fall back to and no `labelKey`
          // to declare. Same call the BPMN pool's participant name makes.
          prop: 'name',
          // `y: 0` is the top of the plot, i.e. the band's INNER edge; a
          // negative `dy` walks back UP into the band, where the words are
          // written. Unchanged from the day the title was a zone's label — the
          // anchor is in plot ratios either way, so the title has not moved.
          anchor: { x: 0, y: 0, dy: -C4_BOARD_TITLE_BAND_HEIGHT / 3 },
          style: {
            size: BOARD_TITLE_FONT_SIZE,
            weight: 600,
            color: '@title',
          },
        },
      },
    ],
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
 * ## The variant, and the bracket line it decides
 *
 * The stencil writes TWO lines in that corner: the author's name, and under it
 * the level — `[Software System]` or `[Container]`. The second is derived from
 * the variant and is therefore VOCABULARY, declared with a `labelKey` and no
 * `prop`: it is translatable through the host's catalogue, and it is not offered
 * to the in-place editor, because what kind of boundary this is was said by
 * picking the tool rather than by typing.
 *
 * `variantProp` names {@link C4BoundaryElementModel.variantOrDefault} rather
 * than `variant` itself, and that is the whole trick. `variant` is OPTIONAL: an
 * unstated one stringifies to `"undefined"`, matches no declared variant and
 * would paint NOTHING — which is exactly why this declaration used to declare no
 * `variantProp` at all and let the creation site's default NAME carry the
 * distinction. The derived getter applies the documented default (`'system'`)
 * before the gate sees it, so every boundary — including every one already on
 * disk, which stored nothing — reads as a real variant and gets its line.
 *
 * The default NAME still lives at the creation site (`BOUNDARY_LABEL` in
 * `consts.ts`) and is still the author's from that moment on: renaming a
 * boundary never contradicts its variant, and never silences its bracket line.
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
  // The level this instance encloses, with the optional field's documented
  // default already applied — see the note above on why it is the DERIVED
  // getter and not `variant` itself.
  variantProp: 'variantOrDefault',
  zones: [
    {
      id: 'name',
      rect: { x: 0, y: 0, w: 1, h: 1 },
      label: {
        id: 'name',
        prop: 'name',
        // Bottom-left INSIDE the plot — the corner C4 writes a boundary's name
        // in, and the one corner of a frame that is least likely to have an
        // element sitting in it. It sits one bracket-line step up, because the
        // line below it is the level.
        anchor: {
          x: 0,
          y: 1,
          dy: -(BOUNDARY_NAME_INSET + BOUNDARY_TYPE_STEP),
        },
        style: {
          size: BOUNDARY_NAME_FONT_SIZE,
          weight: 600,
          color: '@name',
        },
      },
    },
    // …and the bracket line under it, one zone per variant. Two zones rather
    // than one label with two wordings because a zone carries exactly one
    // label, and the gate that picks between them is the zone's own `variants`
    // — which `backgroundTexts` propagates onto the label it carries.
    ...(['system', 'container'] as const).map(variant => ({
      id: `type-${variant}`,
      variants: [variant],
      rect: { x: 0, y: 0, w: 1, h: 1 },
      label: {
        id: `type-${variant}`,
        // NO `prop`: this is vocabulary, so it is translatable and it is not
        // offered to the in-place editor. The fallback is the stencil's own
        // wording, brackets included.
        labelKey: `com.labre.c4.boundary.type.${variant}`,
        fallback: variant === 'system' ? '[Software System]' : '[Container]',
        anchor: { x: 0, y: 1, dy: -BOUNDARY_NAME_INSET },
        style: {
          size: BOUNDARY_TYPE_FONT_SIZE,
          color: '@name',
        },
      },
    })),
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
