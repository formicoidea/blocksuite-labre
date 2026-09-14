import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';

import {
  UML_CARD,
  UML_DIAGRAM_BOX,
  UML_DIAGRAM_MARGIN,
  UML_FONT_FAMILY,
  UML_FRAME_BAND_HEIGHT,
  UML_FRAME_BORDER_WIDTH,
  UML_FRAME_HEADING_FONT_SIZE,
  UML_FRAME_INK,
  UML_NAME_FONT_SIZE,
  UML_SUBJECT_BORDER_WIDTH,
  UML_SUBJECT_BOX,
  UML_SUBJECT_MARGIN,
} from './consts.js';
import { UML_ROLE } from './roles.js';

/**
 * The two UML frames, DECLARED (the `FrameworkBackgroundDef` primitive).
 *
 * There is no UML drawing code for either of them: the primitive paints these
 * declarations, and would paint any other framework's the same way
 * (`docs/adr/0009` on why a framework declares rather than draws). The ONE thing
 * UML asks for that the primitive has no vocabulary for — the cut-corner heading
 * tag of Annex A — is a decorator over the renderer these produce, and it lives
 * in `frame-tag.ts` rather than in a new field of the declaration language.
 */

/* ── The diagram frame ─────────────────────────────────────────────────── */

/**
 * The UML diagram frame: a white card with a square border and a heading band
 * across its top.
 *
 * **No axes and no zones**, like the C4 board this is modelled on and for the
 * same reason: a UML diagram is a GRAPH. A class drawn top left says nothing
 * more than one drawn bottom right, and graduating the card would invent a frame
 * of reference UML does not have — and then judge people against it.
 *
 * ## The heading is `heading`, not `name` — and that is the whole difference
 *
 * A C4 board writes its title, which is free text. Annex A writes `<kind>
 * <name>`: a class diagram called Orders reads `class Orders`, and only the
 * second word is the author's. So the label binds the model's DERIVED
 * {@link UmlDiagramElementModel.heading} — the two halves joined — and the
 * rename gesture writes `name` alone (`element-view.ts`). Binding `heading`
 * directly would let an editor write the joined string back into a getter, which
 * would either throw or, worse, re-prefix the kind on every rename.
 *
 * ## Why the band paints NOTHING
 *
 * It declares no fill and no divider, which is not an oversight: Annex A draws a
 * frame as one rectangle with a tag in its corner, and a rule ruled across the
 * sheet under the heading would be a line the notation does not have. The band
 * exists to place the words and to reserve the top margin; what a reader SEES
 * there is the tag, and what a user AIMS at is the tag — which is the affordance
 * the C4 board needed its painted strip for.
 *
 * The model's own carve-out (`UmlDiagramElementModel.includesPoint`) still picks
 * the whole band, so a click anywhere along the top margin selects the sheet
 * rather than falling through to the canvas. That is deliberately WIDER than
 * what is painted, and it is the one place the two disagree: the alternative is
 * a frame whose corner tag is the only selectable part of a 44-unit strip that
 * is plainly part of the sheet.
 */
export const UML_DIAGRAM_FRAME: FrameworkBackgroundDef = {
  type: 'umlDiagram',
  role: UML_ROLE.diagram,
  geometry: {
    // Wide and free: a diagram grows sideways as the model is discovered, so
    // neither dimension is locked to the other and the handles are offered from
    // the start.
    width: UML_DIAGRAM_BOX.w,
    height: UML_DIAGRAM_BOX.h,
    lockAspectRatio: false,
    resizable: true,
    // Only the top margin is deep: it IS the heading band, and the band's height
    // is the margin it covers rather than a second number beside it. Declared in
    // `@labre/affine-model` because the frame's hit test reads it too.
    margin: {
      top: UML_FRAME_BAND_HEIGHT,
      right: UML_DIAGRAM_MARGIN,
      bottom: UML_DIAGRAM_MARGIN,
      left: UML_DIAGRAM_MARGIN,
    },
  },
  chrome: {
    fontFamily: UML_FONT_FAMILY,
    palette: {
      card: UML_CARD,
      frame: UML_FRAME_INK,
    },
    surface: {
      fill: '@card',
      border: {
        color: '@frame',
        width: UML_FRAME_BORDER_WIDTH,
        // Square: Annex A's frame is a plain rectangle, and a rounded one would
        // read as a note or a card rather than as the sheet's own edge.
        radius: 0,
      },
    },
    sideBands: [
      {
        // No `fill` and no `divider` — see the note above. The band is where the
        // heading goes, and the tag drawn round it is what a reader sees.
        side: 'top',
        label: {
          id: 'heading',
          // The DERIVED `<kind> <name>`, so the frame says what it is before it
          // says what it is called. The rename writes `name`; see the view.
          prop: 'heading',
          // `y: 0` is the top of the plot, i.e. the band's INNER edge; a
          // negative `dy` walks back UP into the band, where the words go. A
          // third of the band leaves the baseline low enough for the tag drawn
          // round it to clear the descenders.
          anchor: { x: 0, y: 0, dy: -UML_FRAME_BAND_HEIGHT / 3 },
          style: {
            size: UML_FRAME_HEADING_FONT_SIZE,
            weight: 600,
            color: '@frame',
          },
        },
      },
    ],
  },
};

/* ── The subject ───────────────────────────────────────────────────────── */

/**
 * The use case SUBJECT (§18.1.4): a plain rectangle with its name written inside
 * the top-left corner, drawn round the use cases a system offers.
 *
 * TRANSPARENT, like the C4 boundary and for the same reason: it is drawn OVER a
 * diagram, round elements that are already there, and an opaque card would hide
 * the very thing it is pointing at. So it declares a border and no fill, which
 * the primitive paints as an unfilled frame — and the consequence is the reverse
 * of the usual one: a subject dropped over existing use cases does NOT cover
 * them, and is hit nowhere but on its own frame band and its name.
 *
 * SOLID, unlike that boundary, and this is where the two notations part company:
 * C4's stencil dashes its boundary, §18.1.4 draws one unbroken rectangle. A dash
 * here would say "logical grouping" in a notation where a subject is a
 * SYSTEM — the thing whose behaviour the use cases are, with the actors
 * deliberately outside it.
 *
 * The name is written TOP-left rather than the boundary's bottom-left: that is
 * where the specification's figures put it, and it is also the corner a use case
 * ellipse is least likely to reach into, ellipses having no corners of their own.
 *
 * No variant and no second tier: §18.1.4 gives the subject one rectangle and one
 * name — no dashed flavour, no keyword line — so there is nothing here for a
 * variant to select between.
 */
export const UML_SUBJECT_FRAME: FrameworkBackgroundDef = {
  type: 'umlSubject',
  role: UML_ROLE.subject,
  geometry: {
    width: UML_SUBJECT_BOX.w,
    height: UML_SUBJECT_BOX.h,
    // A subject is stretched round whatever it has been drawn about, which is
    // never the same shape twice.
    lockAspectRatio: false,
    resizable: true,
    margin: {
      top: UML_SUBJECT_MARGIN,
      right: UML_SUBJECT_MARGIN,
      bottom: UML_SUBJECT_MARGIN,
      left: UML_SUBJECT_MARGIN,
    },
  },
  zones: [
    {
      id: 'name',
      rect: { x: 0, y: 0, w: 1, h: 1 },
      label: {
        id: 'name',
        // The author's own words, and only those: a subject is named by whoever
        // draws it, so there is no vocabulary to fall back to.
        prop: 'name',
        // Top-left INSIDE the plot. The anchor is a BASELINE, so `dy` is one
        // line down from the plot's top edge — written at the size the name
        // compartment of a classifier uses, because it is the same kind of word.
        anchor: { x: 0, y: 0, dy: UML_NAME_FONT_SIZE },
        style: {
          size: UML_NAME_FONT_SIZE,
          weight: 600,
          color: '@frame',
        },
      },
    },
  ],
  chrome: {
    fontFamily: UML_FONT_FAMILY,
    palette: {
      frame: UML_FRAME_INK,
    },
    surface: {
      // NO fill — see the note above. This is the transparent one.
      border: {
        color: '@frame',
        width: UML_SUBJECT_BORDER_WIDTH,
        radius: 0,
      },
    },
  },
};
