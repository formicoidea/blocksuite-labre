import { type UmlNodeKind, umlLifelineHeadRect } from '@labre/affine-model';

import { UML_LIFELINE_DASH, UML_LIFELINE_SPINE_WIDTH } from '../consts.js';
import type { GlyphBox } from './paint.js';
import { cross, line, solidRect } from './paint.js';

/**
 * The INTERACTION glyphs (§17.2.4, §17.3.4) — the two marks a sequence diagram
 * is drawn out of that the shape layer cannot draw.
 *
 * A third module beside `act-glyphs.ts` and `stm-glyphs.ts`, for the reason
 * those two exist: the renderer owns the BRANCH — which kind gets which picture
 * — and the drawing lives beside the other drawings of its own family.
 *
 * The `execution` of §17.2.4 is deliberately NOT here. It is a thin FILLED
 * RECTANGLE on a lifeline's spine, which is exactly what a native rect is, so
 * the shape layer fills it, strokes it, hit-tests it and re-themes it and this
 * file paints nothing over it — the same call `object-node` and `action` make.
 *
 * ## The lifeline is the one glyph bigger than its own element
 *
 * Everywhere else in this pack a picture is drawn inside the box it belongs to.
 * §17.3.4 makes that impossible: what a message attaches to is the dashed
 * SPINE, so the element has to be the narrow column the spine runs down (16
 * units — see `UML_NODE_BOX.lifeline`), and the named head over its top is 160.
 * The head therefore overflows the element by 72 units on each side, which is
 * why `UmlNodeElementModel` overrides `elementBound` and `includesPoint` and
 * why both of them, the label layout in `component.ts` and the drawing below
 * all read ONE function — {@link umlLifelineHeadRect}, in the model, where the
 * overrides can reach it.
 */

/** The kinds this module draws. */
export type UmlSdGlyphKind = 'lifeline' | 'destruction';

/**
 * The reach of a destruction's cross, as a fraction of the box's half-diagonal.
 *
 * The whole box, near enough: §17.2.4 draws the X as a bare cross with nothing
 * round it, so — unlike a flow final, whose arms stop short of a rim they are
 * drawn inside — there is nothing here for it to stay clear of.
 */
const DESTRUCTION_REACH = 0.98;

/**
 * Paint one interaction mark, in the element-local frame, with `fillStyle` /
 * `strokeStyle` / `lineWidth` already set from the model.
 */
export function paintSdGlyph(
  kind: UmlSdGlyphKind,
  ctx: CanvasRenderingContext2D,
  box: GlyphBox
): void {
  const { x0, y0, bw, bh, w, h } = box;

  switch (kind) {
    // ── The lifeline: a named head over a dashed spine (§17.3.4) ──────────
    case 'lifeline': {
      const head = umlLifelineHeadRect({ deserializedXYWH: [0, 0, w, h] });
      if (!head) return;

      // The head is the BODY: a lifeline is created unfilled and unstroked
      // (`presets.ts`), so the glyph fills with the element's own `fillColor`
      // and outlines with its `strokeColor` — which is what keeps it
      // recolourable from the ordinary shape toolbar. Drawn at the head's own
      // rectangle and not at the inset one: the inset belongs to the COLUMN,
      // which is 16 units wide and is not what is being outlined here.
      solidRect(ctx, head.x, head.y, head.w, head.h);

      // …and the spine, down the column's centre from the head's bottom edge.
      // DASHED, and that is the whole notation: an unbroken line would read as
      // a relationship rather than as the passage of time (§17.3.4). Lighter
      // than the head, because it is a line and the head is a box.
      const cx = w / 2;
      const top = head.y + head.h;
      if (h > top) {
        const dash = ctx.getLineDash();
        const width = ctx.lineWidth;
        ctx.setLineDash([...UML_LIFELINE_DASH]);
        ctx.lineWidth = UML_LIFELINE_SPINE_WIDTH;
        try {
          line(ctx, cx, top, cx, h);
        } finally {
          ctx.setLineDash(dash);
          ctx.lineWidth = width;
        }
      }
      return;
    }

    // ── The destruction: a bare X (§17.2.4) ───────────────────────────────
    // Two strokes and nothing else — the mark that says this participant's
    // life ends here. The same drawing as `terminate` (§14.2.4) and kept a
    // separate kind for the reason the roles are separate: a terminate kills a
    // state MACHINE, a destruction ends one participant in one conversation.
    case 'destruction':
      if (bw > 0 && bh > 0) {
        cross(
          ctx,
          x0 + bw / 2,
          y0 + bh / 2,
          (Math.min(bw, bh) / 2) * DESTRUCTION_REACH
        );
      }
      return;
  }

  /**
   * Every kind this module claims is drawn above — narrowed to `never` only if
   * the switch is exhaustive over {@link UmlSdGlyphKind}, so a kind added to
   * the union without a picture stops the build rather than painting nothing.
   */
  const unhandled: never = kind;
  void unhandled;
}

/** Whether the node renderer should hand this kind to {@link paintSdGlyph}. */
export function isSdGlyphKind(kind: UmlNodeKind): kind is UmlSdGlyphKind {
  return kind === 'lifeline' || kind === 'destruction';
}
