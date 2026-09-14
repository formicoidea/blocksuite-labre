import type { UmlNodeKind } from '@labre/affine-model';

import { UML_SIGNAL_POINT } from '../component.js';
import type { GlyphBox } from './paint.js';
import {
  cross,
  hollowDisc,
  inkDisc,
  solidPolygon,
  withInkFill,
} from './paint.js';

/**
 * The ACTIVITY glyphs (§15.3.4 control nodes, §16.3.4 signals, §16.10.4 time
 * events) — the marks an activity diagram is routed by.
 *
 * Split out of `node-renderer.ts` because the behaviour families roughly
 * doubled the pack's glyph count, and a 900-line renderer is a file nobody
 * reads the middle of. The renderer still owns the branch — which kind gets
 * which picture, and the `never` that proves every kind gets one — and this
 * file owns the drawing.
 *
 * Three kinds of the activity family are NOT here, and that is the same
 * distinction `presets.ts` draws: an `action` is the native rounded rect of
 * §15.3.4, a `decision` the native diamond, an `object-node` the plain native
 * rect. The shape layer draws all three, and a glyph painted over them would be
 * inventing a notation.
 *
 * Every proportion below is a fraction of the glyph's own box, so a mark dragged
 * to any size stays the mark it is — the rule the whole pack follows.
 */

/** The kinds this module draws. */
export type UmlActGlyphKind =
  | 'initial'
  | 'activity-final'
  | 'flow-final'
  | 'fork'
  | 'send-signal'
  | 'accept-event'
  | 'time-event';

/**
 * The bull inside an activity final's ring (§15.3.4), as a fraction of the outer
 * radius.
 *
 * A touch over half: §15.3.4's figure draws a solid disc with a clear moat round
 * it, and a bull much larger than this closes the moat up at the sizes a control
 * node is actually drawn at (28 units).
 */
const BULLSEYE_BULL = 0.52;

/**
 * The reach of a flow final's cross (§15.3.4), as a fraction of the rim radius.
 *
 * Short of the rim rather than touching it: the X is drawn INSIDE the circle,
 * and arms that met the rim would read as a circle quartered rather than as a
 * circle with a cross in it.
 */
const FLOW_FINAL_CROSS = 0.62;

/**
 * Paint one activity mark, in the element-local frame, with `fillStyle` /
 * `strokeStyle` / `lineWidth` already set from the model.
 */
export function paintActGlyph(
  kind: UmlActGlyphKind,
  ctx: CanvasRenderingContext2D,
  box: GlyphBox
): void {
  const { x0, y0, x1, y1, bw, bh, w, h } = box;
  const cx = w / 2;
  const cy = h / 2;
  // One radius from whichever dimension is the tighter, so every round mark
  // stays ROUND at any aspect ratio the element is dragged to — the rule the
  // actor's head and the interface ball already follow.
  const radius = Math.min(bw, bh) / 2;

  switch (kind) {
    // ── The initial node: a filled disc (§15.3.4) ──────────────────────────
    // Shared with the state machine family, which draws the identical disc and
    // means the identical thing by it (§14.2.4) — one kind, one role, one
    // picture, and the role def records the sharing.
    case 'initial':
      inkDisc(ctx, cx, cy, radius);
      return;

    // ── The activity final: a bullseye (§15.3.4) ──────────────────────────
    // A ring with a solid bull in it. Drawn rim first so the bull lands ON the
    // paper the rim encloses rather than under it.
    case 'activity-final':
      hollowDisc(ctx, cx, cy, radius);
      inkDisc(ctx, cx, cy, radius * BULLSEYE_BULL);
      return;

    // ── The flow final: a circle with an X in it (§15.3.4) ────────────────
    // The one final that stops a single flow rather than the whole activity,
    // and the cross is the entire difference on the page.
    case 'flow-final':
      hollowDisc(ctx, cx, cy, radius);
      cross(ctx, cx, cy, radius * FLOW_FINAL_CROSS);
      return;

    // ── The fork / join: a filled bar (§15.3.4) ───────────────────────────
    // The WHOLE inset box, because the element IS the bar: its default
    // footprint is 120 × 10 and dragging it longer is how an author fits more
    // outgoing flows onto it. Ink-filled, since §15.3.4 draws a solid segment
    // and a hollow one would read as a very flat box.
    case 'fork':
      if (bw > 0 && bh > 0) {
        withInkFill(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y0);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x0, y1);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      }
      return;

    // ── The send signal: a convex pentagon (§16.3.4) ──────────────────────
    // A rectangle with its right edge pulled out to a POINT — an arrow head
    // saying the signal leaves here. The point's depth is `UML_SIGNAL_POINT`,
    // the same number `component.ts` pulls the label box back by, so the name
    // can never run out through the tip.
    case 'send-signal': {
      const point = w * UML_SIGNAL_POINT;
      solidPolygon(ctx, [
        [x0, y0],
        [Math.max(x0, x1 - point), y0],
        [x1, cy],
        [Math.max(x0, x1 - point), y1],
        [x0, y1],
      ]);
      return;
    }

    // ── The accept event: a concave pentagon (§16.3.4) ────────────────────
    // The same rectangle with its left edge pushed IN to a notch — a socket
    // saying the event arrives here. The mirror of the shape above, which is
    // exactly how a reader tells a send from a receive at a glance.
    case 'accept-event': {
      const point = w * UML_SIGNAL_POINT;
      solidPolygon(ctx, [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
        [Math.min(x1, x0 + point), cy],
      ]);
      return;
    }

    // ── The time event: an hourglass (§16.10.4) ───────────────────────────
    // Two triangles meeting at a point in the middle of the box. Drawn as two
    // closed paths rather than one crossed one, because a single bow-tie path
    // fills by the even-odd rule on some canvases and by the non-zero rule on
    // others — and an hourglass that is sometimes hollow is not a notation.
    case 'time-event':
      if (bw > 0 && bh > 0) {
        solidPolygon(ctx, [
          [x0, y0],
          [x1, y0],
          [cx, cy],
        ]);
        solidPolygon(ctx, [
          [cx, cy],
          [x1, y1],
          [x0, y1],
        ]);
      }
      return;
  }

  /**
   * Every kind this module claims is drawn above. Narrowed to `never` only if
   * the switch is exhaustive over {@link UmlActGlyphKind}, so a kind added to
   * the union without a picture of its own stops the build rather than silently
   * painting nothing.
   */
  const unhandled: never = kind;
  void unhandled;
}

/** Whether the node renderer should hand this kind to {@link paintActGlyph}. */
export function isActGlyphKind(kind: UmlNodeKind): kind is UmlActGlyphKind {
  return (
    kind === 'initial' ||
    kind === 'activity-final' ||
    kind === 'flow-final' ||
    kind === 'fork' ||
    kind === 'send-signal' ||
    kind === 'accept-event' ||
    kind === 'time-event'
  );
}
