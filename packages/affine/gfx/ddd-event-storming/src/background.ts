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

/**
 * The one word this board writes on itself, and it is written BIG: 64 units
 * (PO recette, 26/08/2026).
 *
 * Sixteen was chart-label size — right for a graduation, wrong for the only
 * thing a 3200-wide roll declares. At the zoom where a whole Big Picture fits on
 * screen the word vanished exactly like the hairline trait did before it was
 * drawn at six; the title now reads at the same distance as the axis it names.
 * Sized WITH the trait rather than beside it, and everything that has to make
 * room for it — the bottom margin, the title's own offset — is derived from this
 * number below.
 */
const AXIS_TEXT = { size: 64, color: '@axis' } as const;

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
    //
    // The bottom is the exception, and it is the WORD that sets it: a 64-unit
    // title cannot be hung under a six-unit trait inside 56 units of paper —
    // its cap height alone eats some 47 of them and its descender wants a dozen
    // more. 104 is the title's offset below the trait plus a descender's worth
    // of air, so the word sits between the trait and the card edge touching
    // neither. Nothing else reads this number: the board declares no zones, and
    // the stickies are placed by hand.
    margin: { top: 32, right: 32, bottom: 104, left: 32 },
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
      // Drawn HEAVY, and deliberately heavier than any other axis in the
      // library (PO recette, 26/08/2026). On a 3200-wide roll the timeline is
      // not decoration beside the plot, it IS the frame of reference — the one
      // thing the board declares and the one thing a rule measures against —
      // and at the zoom where a whole Big Picture fits on screen a hairline
      // simply disappears under the frieze. Six model units survive that.
      //
      // The head is sized WITH the line rather than left at its default: the
      // renderer takes `arrowSize` as the head's LENGTH and spreads the base
      // half that either side, so head width tracks head length. At 6× the
      // stroke the triangle still reads as the end of this line and not as a
      // separate mark — the same register as Wardley's 11-on-2, given room to
      // scale up with the stroke.
      arrowSize: 36,
      stroke: { color: '@axis', width: 6 },
      title: {
        id: 'timeAxisTitle',
        labelKey: 'com.labre.event-storming.background.axis.time',
        fallback: 'Time',
        // Pushed down with the SIZE, not just with the stroke.
        //
        // The renderer draws every background text on an `alphabetic`
        // baseline, so `dy` positions the foot of the word and everything
        // above it has to fit between the trait and that baseline: the trait
        // grows three units below its centre (half of six) and the cap height
        // of a 64-unit Inter is about 47. 72 clears both and leaves roughly the
        // 23 units of air the 16-unit title used to have — the gap reads the
        // same, it is simply no longer proportional to a word four times
        // bigger. Below the baseline, the descender (~16) stops 16 units short
        // of the 104-unit bottom margin, so the card edge is clear too.
        anchor: { x: 1, y: 1, dx: -8, dy: 72 },
        style: AXIS_TEXT,
        align: 'right',
      },
    },
  ],
};
