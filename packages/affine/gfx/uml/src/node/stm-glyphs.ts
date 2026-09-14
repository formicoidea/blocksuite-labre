import type { UmlNodeKind } from '@labre/affine-model';

import { UML_FONT_FAMILY } from '../consts.js';
import type { GlyphBox } from './paint.js';
import { cross, glyphText, hollowDisc, inkDisc } from './paint.js';

/**
 * The STATE MACHINE glyphs (§14.2.4) — the final state and the seven
 * pseudostates a machine's transitions are routed through.
 *
 * The counterpart of `act-glyphs.ts`, and split out for the same reason. Two of
 * the family are NOT here: a `state` is the native rounded rect with a
 * compartment rule (drawn by the renderer's compartment branch, like a class),
 * and a `choice` is the native diamond. And one more is elsewhere entirely —
 * the INITIAL pseudostate is `act-glyphs.ts`'s filled disc, because §14.2.4 and
 * §15.3.4 draw the same disc and mean the same thing by it.
 */

/** The kinds this module draws. */
export type UmlStmGlyphKind =
  | 'final-state'
  | 'junction'
  | 'shallow-history'
  | 'deep-history'
  | 'entry-point'
  | 'exit-point'
  | 'terminate';

/**
 * The bull inside a final state's ring, as a fraction of the outer radius.
 *
 * The activity final's own number, and deliberately the same one: §14.2.4 and
 * §15.3.4 draw the identical bullseye, and a reader who sees two different
 * proportions on two diagrams will look for a meaning in the difference.
 * The ROLES keep them apart for the audit; the picture must not.
 */
const BULLSEYE_BULL = 0.52;

/** The reach of an exit point's and a terminate's cross, against the mark. */
const CROSS_REACH = 0.66;

/**
 * How big the `H` of a history pseudostate is drawn, as a fraction of the
 * circle's radius.
 *
 * Sized off the mark rather than off a font constant, so a history dragged
 * bigger carries a bigger letter — and sized to sit INSIDE the rim: `H*` is two
 * characters wide, so the number is the one that keeps the deeper of the two
 * from touching the circle it is written in.
 */
const HISTORY_LETTER = 0.95;

/**
 * Paint one state machine mark, in the element-local frame, with `fillStyle` /
 * `strokeStyle` / `lineWidth` already set from the model.
 */
export function paintStmGlyph(
  kind: UmlStmGlyphKind,
  ctx: CanvasRenderingContext2D,
  box: GlyphBox
): void {
  const { x0, y0, x1, y1, bw, bh, w, h } = box;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(bw, bh) / 2;

  switch (kind) {
    // ── The final state: a bullseye (§14.2.4) ─────────────────────────────
    // Drawn exactly as an activity final is, and a different metaclass all the
    // same: this one is a vertex a transition lands on, that one stops every
    // flow in an activity. The picture is shared; the role is not.
    case 'final-state':
      hollowDisc(ctx, cx, cy, radius);
      inkDisc(ctx, cx, cy, radius * BULLSEYE_BULL);
      return;

    // ── The junction: a small filled dot (§14.2.4) ────────────────────────
    // The smallest mark in the pack, and the plainest: it merely joins
    // transitions, so it is a disc and nothing else. Told from an INITIAL — the
    // same filled disc — by its size and by the edges running into it, which is
    // exactly how §14.2.4 distinguishes them.
    case 'junction':
      inkDisc(ctx, cx, cy, radius);
      return;

    // ── The two histories: a circle with H, or with H* (§14.2.4) ──────────
    // Shallow remembers which sub-state the machine was in; deep remembers the
    // whole nesting, and the star is the entire difference on the page.
    case 'shallow-history':
    case 'deep-history':
      hollowDisc(ctx, cx, cy, radius);
      glyphText(
        ctx,
        kind === 'deep-history' ? 'H*' : 'H',
        cx,
        cy,
        radius * HISTORY_LETTER,
        UML_FONT_FAMILY
      );
      return;

    // ── The entry point: a small hollow circle (§14.2.4) ──────────────────
    // Drawn ON the border of a composite state, saying "a transition may enter
    // the sub-machine here". Hollow, and that is the whole of it: an entry
    // point is a door, and a filled one would read as an initial node.
    case 'entry-point':
      hollowDisc(ctx, cx, cy, radius);
      return;

    // ── The exit point: the same circle with a cross in it (§14.2.4) ──────
    case 'exit-point':
      hollowDisc(ctx, cx, cy, radius);
      cross(ctx, cx, cy, radius * CROSS_REACH);
      return;

    // ── The terminate: a bare X (§14.2.4) ─────────────────────────────────
    // No circle, no box: §14.2.4 draws two crossed strokes and nothing else,
    // and a rim round them would make it an exit point. The mark spans the
    // whole element rather than a circle inscribed in it, so it reads at the
    // small sizes a pseudostate is drawn at.
    case 'terminate':
      if (bw > 0 && bh > 0) {
        // Corner to corner of the inset box, which is what "a bare X" is — and
        // it stays an X at any aspect ratio, unlike a cross measured from one
        // radius.
        crossBox(ctx, x0, y0, x1, y1);
      }
      return;
  }

  /**
   * Every kind this module claims is drawn above — `never` here only if the
   * switch is exhaustive over {@link UmlStmGlyphKind}.
   */
  const unhandled: never = kind;
  void unhandled;
}

/** The two diagonals of a rectangle, corner to corner. */
function crossBox(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y0);
  ctx.lineTo(x0, y1);
  ctx.stroke();
}

/** Whether the node renderer should hand this kind to {@link paintStmGlyph}. */
export function isStmGlyphKind(kind: UmlNodeKind): kind is UmlStmGlyphKind {
  return (
    kind === 'final-state' ||
    kind === 'junction' ||
    kind === 'shallow-history' ||
    kind === 'deep-history' ||
    kind === 'entry-point' ||
    kind === 'exit-point' ||
    kind === 'terminate'
  );
}
