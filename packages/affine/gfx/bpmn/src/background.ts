import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';

import {
  POOL_BAND_FILL,
  POOL_BAND_WIDTH,
  POOL_CORNER_RADIUS,
  POOL_FONT_FAMILY,
  POOL_FRAME_COLOR,
  POOL_FRAME_WIDTH,
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
 * (see `BackgroundSideBandDef`). Lanes are still out of scope — a lane is a
 * subdivision of the pool, which is a second element type, not a band.
 */

/** The colour code: every colour named once, never repeated as a hex. */
const PALETTE = {
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
  chrome: {
    fontFamily: POOL_FONT_FAMILY,
    palette: PALETTE,
    // No fill: a pool is a FRAME the user drops nodes into, and a card painted
    // white would hide whatever was already drawn under it.
    surface: {
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
