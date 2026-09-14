import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';

import {
  UML_CARD,
  UML_DIAGRAM_BOX,
  UML_DIAGRAM_MARGIN,
  UML_DIVIDER,
  UML_FONT_FAMILY,
  UML_FRAME_BAND_HEIGHT,
  UML_FRAME_BORDER_WIDTH,
  UML_FRAME_HEADING_FONT_SIZE,
  UML_FRAME_INK,
  UML_NAME_FONT_SIZE,
  UML_PARTITION_BAND,
  UML_PARTITION_BORDER_WIDTH,
  UML_PARTITION_BOX,
  UML_PARTITION_MARGIN,
  UML_REGION_BAND,
  UML_REGION_BORDER_WIDTH,
  UML_REGION_BOX,
  UML_REGION_MARGIN,
  UML_REGION_RADIUS,
  UML_SUBJECT_BORDER_WIDTH,
  UML_SUBJECT_BOX,
  UML_SUBJECT_MARGIN,
} from './consts.js';
import { UML_ROLE } from './roles.js';

/**
 * The four UML frames, DECLARED (the `FrameworkBackgroundDef` primitive): the
 * diagram sheet of Annex A, the use case subject of §18.1.4, the activity
 * partition of §15.6.4 (in its two orientations) and the composite state of
 * §14.2.4.
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

/* ── The partition ─────────────────────────────────────────────────────── */

/**
 * The activity PARTITION (§15.6.4): the swimlane drawn across an activity
 * diagram saying who is responsible for the actions inside it.
 *
 * TRANSPARENT, like the subject and for exactly the same reason: it is drawn
 * over a flow that is already there, and an opaque card would hide the very
 * actions it is attributing. Membership is geometry at read time (R11) — an
 * action belongs to the lane its centre is in.
 *
 * ## Two declarations rather than one with a variant
 *
 * `FrameworkBackgroundDef.variantProp` exists and would look like the answer,
 * but it does not reach the two things an orientation has to change here. A
 * variant selects which WASHES and which ZONES are painted (`BackgroundWashDef
 * .variants`, `BackgroundZoneDef.variants`); a side band declares no variants
 * at all, and the band's THICKNESS is the geometry's margin on that side, which
 * is a single fixed inset per declaration. So a vertical lane and a horizontal
 * one differ in two fields the variant mechanism cannot vary —
 * `sideBands[0].side` and which of `margin.top` / `margin.left` is deep — and
 * the honest way to say that is two declarations, picked in the renderer by the
 * element's own `orientation`.
 *
 * The alternative — teaching `variants` to side bands and margins — is a change
 * to the declaration LANGUAGE for one framework's convenience, and the language
 * grows when a second framework asks (`BackgroundSideBandDef`'s own note on why
 * it offers only `left` and `top`).
 *
 * ## The band is painted, unlike the diagram frame's
 *
 * The sheet's heading band paints nothing because Annex A draws a tag in the
 * corner and no rule across the page. A swimlane's header is the opposite:
 * §15.6.4 draws it as a titled strip ruled off from the lane below it, and that
 * rule is what makes a column of actions read as belonging to somebody. So both
 * declarations below carry a `divider` — the lighter of the two frame inks, so
 * the strip reads as part of the same lane rather than as a second frame drawn
 * inside the first. Still no `fill`: a tint would be a colour code UML does not
 * have (R33), and it would tint whatever the lane is drawn over.
 */
function partitionFrame(
  side: 'top' | 'left',
  margin: { top: number; right: number; bottom: number; left: number }
): FrameworkBackgroundDef {
  return {
    type: 'umlPartition',
    role: UML_ROLE.partition,
    geometry: {
      width: UML_PARTITION_BOX.w,
      height: UML_PARTITION_BOX.h,
      // A lane is stretched round whatever it has been drawn about, in
      // whichever direction the flow runs.
      lockAspectRatio: false,
      resizable: true,
      margin,
    },
    chrome: {
      fontFamily: UML_FONT_FAMILY,
      palette: {
        frame: UML_FRAME_INK,
        divider: UML_DIVIDER,
      },
      surface: {
        // NO fill: see the header. This is a transparent frame.
        border: {
          color: '@frame',
          width: UML_PARTITION_BORDER_WIDTH,
          // Square: §15.6.4 draws a partition as a plain rectangle, and a
          // rounded one would read as a composite state.
          radius: 0,
        },
      },
      sideBands: [
        {
          side,
          divider: { color: '@divider', width: UML_PARTITION_BORDER_WIDTH },
          label: {
            id: 'name',
            // The author's own words: a lane is named after whoever owns it,
            // so there is no vocabulary to fall back to.
            prop: 'name',
            // The plot's top-left corner is the band's INNER corner, so a
            // negative delta walks back into the band, where the words go. A
            // third of the band leaves the baseline clear of the descenders —
            // the diagram frame's own arithmetic, on whichever edge the band
            // is. The horizontal lane also needs a `dy`, because its anchor is
            // a BASELINE and the plot's top is the top of the words.
            anchor:
              side === 'top'
                ? { x: 0, y: 0, dy: -UML_PARTITION_BAND / 3 }
                : {
                    x: 0,
                    y: 0,
                    dx: -UML_PARTITION_BAND + UML_PARTITION_BAND / 4,
                    dy: UML_NAME_FONT_SIZE,
                  },
            style: {
              size: UML_NAME_FONT_SIZE,
              weight: 600,
              color: '@frame',
            },
          },
        },
      ],
    },
  };
}

/** A VERTICAL partition — a column, its name written across the top. */
export const UML_PARTITION_FRAME_V: FrameworkBackgroundDef = partitionFrame(
  'top',
  {
    top: UML_PARTITION_BAND,
    right: UML_PARTITION_MARGIN,
    bottom: UML_PARTITION_MARGIN,
    left: UML_PARTITION_MARGIN,
  }
);

/** A HORIZONTAL partition — a row, its name written down the left edge. */
export const UML_PARTITION_FRAME_H: FrameworkBackgroundDef = partitionFrame(
  'left',
  {
    top: UML_PARTITION_MARGIN,
    right: UML_PARTITION_MARGIN,
    bottom: UML_PARTITION_MARGIN,
    left: UML_PARTITION_BAND,
  }
);

/**
 * The declaration a partition element is painted and hit-tested by — the one
 * place the `orientation` prop is turned into a picture.
 *
 * A function rather than a lookup repeated at each call site, so the renderer,
 * the view and the band helpers cannot disagree about which of the two a lane
 * is: all three ask this.
 *
 * An orientation this build has never heard of falls back to the VERTICAL
 * declaration rather than painting nothing — the same promise
 * `UmlDiagramElementModel.heading` makes about an unknown kind: a document
 * written by a newer build still draws a lane.
 */
export function umlPartitionFrame(model: {
  orientation?: string;
}): FrameworkBackgroundDef {
  return model.orientation === 'horizontal'
    ? UML_PARTITION_FRAME_H
    : UML_PARTITION_FRAME_V;
}

/* ── The composite state ───────────────────────────────────────────────── */

/**
 * The COMPOSITE STATE (§14.2.4): the round-cornered rectangle drawn round the
 * sub-states of a state that has a machine of its own inside it.
 *
 * Transparent, band on the top, and ROUNDED — which is the whole point of it.
 * §14.2.4 draws every state with rounded corners, simple or composite, and a
 * square frame round a sub-machine would read as a partition or as a subject.
 * `surface.border.radius` is in MODEL UNITS here (the primitive draws the card
 * in the units the element is), unlike the node preset's fractional `radius`,
 * so the number comes from `UML_REGION_RADIUS` rather than from
 * `UML_NODE_RADIUS`.
 *
 * ## One region, and the ceiling stated
 *
 * ORTHOGONAL regions — a composite state cut into concurrent regions by dashed
 * separators (§14.2.4, Figure 14.8) — are not drawn. That is an INSTANCE
 * PARTITION in the declaration language (`instanceZones`, the mechanism the
 * BPMN pool's lanes use), and it arrives the day the notation is asked for
 * rather than as a field added here in a hurry. See `UmlRegionElementModel`.
 */
export const UML_REGION_FRAME: FrameworkBackgroundDef = {
  type: 'umlRegion',
  role: UML_ROLE.region,
  geometry: {
    width: UML_REGION_BOX.w,
    height: UML_REGION_BOX.h,
    lockAspectRatio: false,
    resizable: true,
    margin: {
      top: UML_REGION_BAND,
      right: UML_REGION_MARGIN,
      bottom: UML_REGION_MARGIN,
      left: UML_REGION_MARGIN,
    },
  },
  chrome: {
    fontFamily: UML_FONT_FAMILY,
    palette: {
      frame: UML_FRAME_INK,
      divider: UML_DIVIDER,
    },
    surface: {
      // NO fill: a composite state is drawn over the sub-machine it holds.
      border: {
        color: '@frame',
        width: UML_REGION_BORDER_WIDTH,
        radius: UML_REGION_RADIUS,
      },
    },
    sideBands: [
      {
        side: 'top',
        // The rule under the name is §14.2.4's own: a composite state's name
        // compartment is ruled off from the region below it, exactly as a
        // simple state's name is ruled off from its internal activities.
        divider: { color: '@divider', width: UML_REGION_BORDER_WIDTH },
        label: {
          id: 'name',
          prop: 'name',
          anchor: { x: 0, y: 0, dy: -UML_REGION_BAND / 3 },
          style: {
            size: UML_NAME_FONT_SIZE,
            weight: 600,
            color: '@frame',
          },
        },
      },
    ],
  },
};
