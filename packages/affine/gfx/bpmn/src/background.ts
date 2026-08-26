import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';

import {
  POOL_BAND_FILL,
  POOL_BAND_WIDTH,
  POOL_CARD_FILL,
  POOL_CORNER_RADIUS,
  POOL_FONT_FAMILY,
  POOL_FRAME_COLOR,
  POOL_FRAME_WIDTH,
  POOL_LANE_BAND_WIDTH,
  POOL_LANE_NAME_FONT_SIZE,
  POOL_NAME_COLOR,
  POOL_NAME_FONT_SIZE,
  POOL_REF_HEIGHT,
  POOL_REF_WIDTH,
} from './consts';
import { BPMN_ROLE } from './roles';

/**
 * The BPMN pool, DECLARED (the `FrameworkBackgroundDef` primitive).
 *
 * This file is the whole of what makes a pool look like a pool. There is no
 * BPMN drawing code left: the primitive paints this declaration, and would
 * paint any other framework's the same way — what used to be ninety lines of
 * `ctx.fillRect` / `ctx.arcTo` / `ctx.rotate` is now data a reviewer can read.
 *
 * Nothing here changes the DOCUMENT. The persisted element type is still
 * `bpmnPool` and its props are untouched — `name`, `resizeEnabled`, `rotate`,
 * `xywh` — they are simply named by the declaration instead of being read by
 * hand-written drawing code. A pool authored before this file existed opens
 * with the same frame, the same band and the same participant name.
 *
 * ## No frame of reference
 *
 * A pool declares no axis and no zone, and that is deliberate: a pool is a
 * PARTICIPANT, not a chart. Nothing about where a task sits inside the lane
 * means anything — left-to-right is the sequence flow's business, and the flow
 * says so with an arrow. Declaring a time axis here would invent a semantic
 * BPMN puts on the connectors, and then judge people against it.
 *
 * ## The band
 *
 * The left margin IS the name band: `margin.left` is both the room the flow
 * area gives up and the width of the strip the participant name is written in
 * (see `BackgroundSideBandDef`).
 *
 * ## The lanes
 *
 * A lane (couloir) is NOT a second element type, and it is not a band either:
 * it is a slice of THIS pool's plot, so it is declared as an instance partition
 * (`BackgroundInstanceZonesDef`) read off the pool's own `lanes` prop. How many
 * there are, what they are called and how the height is shared between them is
 * a property of this pool; that a pool CAN be sliced that way is the property
 * of BPMN declared here.
 *
 * Which is also why the lanes are not zones: a `zones` entry is part of the
 * framework and identical on every element of it, and no two pools have the
 * same lanes.
 *
 * Each lane wears its own title band inside the pool's — a narrower strip, no
 * fill, one divider, the name turned on its side, exactly as BPMN 2.0 draws it.
 * The strip is CHROME inside the lane and not a smaller lane: a task dropped on
 * a lane's title band is in that lane, because in BPMN the band belongs to it.
 */

/** The colour code: every colour named once, never repeated as a hex. */
const PALETTE = {
  card: POOL_CARD_FILL,
  frame: POOL_FRAME_COLOR,
  band: POOL_BAND_FILL,
  name: POOL_NAME_COLOR,
} as const;

export const BPMN_POOL_BACKGROUND: FrameworkBackgroundDef = {
  type: 'bpmnPool',
  // The pool is a first-class role: rules frame against `bpmn:pool`, never
  // against the `bpmnPool` element type. Same vocabulary the creation site
  // stamps (`actions.ts`) and the templates ship, named once in `roles.ts`.
  role: BPMN_ROLE.pool,
  geometry: {
    width: POOL_REF_WIDTH,
    height: POOL_REF_HEIGHT,
    // A lane is stretched in one direction all the time — long and thin as the
    // process grows sideways, tall only when it has to hold more. Locking the
    // proportion would fight the hand on every drag.
    lockAspectRatio: false,
    resizable: true,
    margin: { top: 0, right: 0, bottom: 0, left: POOL_BAND_WIDTH },
  },
  instanceZones: {
    prop: 'lanes',
    // Horizontal bands, top to bottom in array order: a lane runs ALONG the
    // flow, and the flow runs left to right.
    stack: 'y',
    // A namespace, so a lane the user calls `early` can never shadow a
    // framework zone of that name. A pool declares no zones today; the
    // separation is what makes that stay true if it ever does.
    idPrefix: 'lane',
    // The same stroke as the band divider — the two lines meet at the band's
    // inner edge, and a lane separator that did not match would read as a
    // different KIND of line rather than the same frame continued.
    divider: { color: '@frame', width: POOL_FRAME_WIDTH },
    label: {
      // The BAND placement: a title strip at the lane's leading edge with the
      // name turned on its side, which is how BPMN 2.0 draws a lane and how
      // bpmn.io, Camunda and Visio all render one. The corner placement this
      // used to declare put the name across the lane's top-left instead; the
      // PO's visual recette (2026-08-26) settled it against the corner on
      // notation rather than taste — a reader who knows BPMN reads a strip as a
      // lane title and a floating corner word as a note.
      //
      // No fill: the strip is the participant band's subordinate, and a second
      // grey gutter beside it would leave the flow area looking inset twice.
      band: {
        width: POOL_LANE_BAND_WIDTH,
        // The frame's own line again, as the band divider is: every rule on a
        // pool is the same stroke, so the lanes read as the frame continued.
        divider: { color: '@frame', width: POOL_FRAME_WIDTH },
      },
      style: {
        size: POOL_LANE_NAME_FONT_SIZE,
        color: '@name',
        weight: 600,
      },
    },
  },
  chrome: {
    fontFamily: POOL_FONT_FAMILY,
    palette: PALETTE,
    // An opaque white card, like every other framework background (PO recette,
    // 26/08/2026). The hand-written renderer left the pool transparent, on the
    // reasoning that a lane is a frame you drop nodes INTO; the review settled
    // it the other way, and settled it on identity: a pool is a map background,
    // so it paints a card, and a board where one framework's backdrop is
    // see-through and every other one is not reads as a bug.
    //
    // The consequence is the standard framework-background behaviour, not a
    // pool quirk: dropping a pool over strokes already on the canvas covers
    // them, exactly as dropping a Wardley map over them does. The user's answer
    // is the same in both cases — send the background to the back.
    surface: {
      fill: '@card',
      border: {
        color: '@frame',
        width: POOL_FRAME_WIDTH,
        radius: POOL_CORNER_RADIUS,
      },
    },
    sideBands: [
      {
        side: 'left',
        fill: '@band',
        divider: { color: '@frame', width: POOL_FRAME_WIDTH },
        label: {
          id: 'name',
          // The user's own words, and only those: a participant is named by
          // whoever draws the process, so there is no vocabulary to fall back
          // to and no `labelKey` to declare.
          prop: 'name',
          // `x: 0` is the inner edge of the band; half a band width back from
          // it is the middle of the strip.
          anchor: { x: 0, y: 0.5, dx: -POOL_BAND_WIDTH / 2 },
          style: {
            size: POOL_NAME_FONT_SIZE,
            weight: 600,
            color: '@name',
            // Centred ACROSS the band, not sitting on a baseline inside it.
            baseline: 'middle',
          },
          // Read bottom-to-top, as the spec draws a vertical pool name.
          vertical: true,
        },
      },
    ],
  },
};
