import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';
import { ES_STICKIES, FONT_FAMILY } from '@labre/affine-gfx-ddd-shared';

import { ES_ROLE } from './roles';

/**
 * The Event Storming board, DECLARED (the `FrameworkBackgroundDef` primitive).
 *
 * ## One axis, and only one
 *
 * Time, running left to right along the bottom. That is the entire frame of
 * reference Event Storming has, and declaring exactly it — no second axis, no
 * zones, no graduations — is what makes `es.against-timeline` a real rule
 * rather than a guess: a flow whose target sits to the LEFT of its source runs
 * against the only direction this board means anything in.
 *
 * The vertical is deliberately unnamed. On a real wall it is where a workshop
 * parks what it cannot place yet — a stack of hotspots above the frieze, a row
 * of read models below it — and a tool that quietly turned "higher" into a
 * scale would be inventing a semantic the framework does not have and then
 * judging people against it.
 *
 * ## Swimlanes: cut from v1
 *
 * The v2 shape is written down in `EventStormingBoardElementModel`: lanes are a
 * variant declaration plus a rule family that measures membership per band.
 * Painting the bands without the rule would be the vertical semantic above,
 * arrived at by accident.
 *
 * ## The palette
 *
 * The eight sticky colours, named. Nothing here paints them — the board is a
 * white card with an axis on it — and that is what a declared REFERENCE looks
 * like: the same precedent as the Wardley tone convention, so the day a
 * `tone-convention` rule asks "is this sticky drawn in one of the notation's
 * own colours" the answer is already written down, in one place, beside the
 * card it belongs to.
 */

/** Ink for the frame itself: the axis line and the word beside it. */
const AXIS_COLOR = '#6d6e71';
const CARD_BORDER = '#d5d9e0';

const AXIS_TEXT = { size: 16, color: '@axis' } as const;

/** The eight sticky fills, keyed by the kind the palette creates them under. */
const STICKY_PALETTE = Object.fromEntries(
  ES_STICKIES.map(preset => [preset.kind, preset.fill])
);

export const EVENT_STORMING_BACKGROUND: FrameworkBackgroundDef = {
  type: 'eventStorming',
  // The board is a first-class role: rules frame stickies against `es:board`,
  // never against the `eventStorming` element type.
  role: ES_ROLE.board,
  geometry: {
    // A Big Picture is WIDE — the timeline is the point — and it grows sideways
    // all morning as events are remembered. Neither dimension is locked to the
    // other and the handles are offered from the start, the opposite call from
    // the Wardley map, which is a frame you place things on rather than a roll
    // you unspool.
    width: 3200,
    height: 1400,
    lockAspectRatio: false,
    resizable: true,
    // Room under the plot for the axis line and its word; the same inset
    // elsewhere, so the roll reads as paper rather than as a chart.
    margin: { top: 32, right: 32, bottom: 56, left: 32 },
  },
  chrome: {
    fontFamily: FONT_FAMILY,
    palette: {
      card: '#ffffff',
      cardBorder: CARD_BORDER,
      axis: AXIS_COLOR,
      ...STICKY_PALETTE,
    },
    surface: {
      fill: '@card',
      border: { color: '@cardBorder', width: 1.5, radius: 12 },
    },
  },
  axes: [
    {
      id: 'time',
      orientation: 'horizontal',
      // Along the bottom of the plot, under the frieze rather than through it.
      at: 1,
      // Forward is RIGHT: later. The one fact `es.against-timeline` reads.
      arrow: 'forward',
      arrowSize: 10,
      stroke: { color: '@axis', width: 1.5 },
      title: {
        id: 'timeAxisTitle',
        labelKey: 'com.labre.event-storming.background.axis.time',
        fallback: 'Time',
        anchor: { x: 1, y: 1, dx: -8, dy: 34 },
        style: AXIS_TEXT,
        align: 'right',
      },
    },
  ],
};
