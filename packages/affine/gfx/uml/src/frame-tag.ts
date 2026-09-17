import type {
  BackgroundRect,
  ElementRenderer,
  FrameworkBackgroundDef,
} from '@labre/affine-block-surface';
import {
  backgroundLabelText,
  createFrameworkBackgroundRenderer,
} from '@labre/affine-block-surface';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';

/**
 * The cut-corner heading tag of UML 2.5.1 Annex A, as a DECORATOR over a
 * framework-background renderer.
 *
 * ## Why a decorator and not a new field of the declaration language
 *
 * The background primitive draws cards, bands, washes, zones, axes and labels.
 * The pentagon Annex A pins to the top-left corner of every diagram frame is
 * none of those: it is one shape, in one notation, and teaching
 * `FrameworkBackgroundDef` to describe a polygon with a bitten corner would put
 * a UML-shaped hole in a language six other frameworks share. So the frame keeps
 * declaring its band and its label exactly like every other background, and this
 * wrapper adds the outline after the fact — the same seam the BPMN pool's lane
 * separators and the C4 node's glyphs use, one level up.
 *
 * The tag carries NO words of its own. The heading is drawn by the declaration,
 * from the declaration's anchor, in the declaration's font; this file only
 * measures it and draws a box round it. A tag that wrote its own text would be
 * the same string painted twice, by two files, which is how a heading comes to
 * be drawn in one place and clicked in another.
 *
 * ## The matrix trap
 *
 * `createFrameworkBackgroundRenderer` composes the element-local frame by
 * MUTATING the matrix it is handed (`matrix.translateSelf(...).rotateSelf(...)`)
 * and then calls `setTransform` with it. Reading the matrix after the base has
 * run therefore yields a frame that has already been translated and rotated
 * once, and composing on top of it rotates the tag twice — which is invisible on
 * an upright frame and wildly wrong on a rotated one. The copy below is taken
 * BEFORE the base renderer is called, which is the same precaution
 * `gfx/c4/src/node/node-renderer.ts` documents for the shape renderer.
 */

export interface UmlFrameTagOptions {
  /**
   * The model prop the heading is read from — the same one the declaration's
   * band label binds, so the tag measures the string that is actually painted.
   */
  prop: string;
  /** The band the tag is drawn in: the frame's top margin. */
  bandHeight: number;
  /** How much shorter than the band the tag is — the air under it. */
  foot: number;
  /** Horizontal padding either side of the measured heading. */
  padding: number;
  /** The bite out of the bottom-right corner. */
  cut: number;
  /** Ink and weight of the outline — the frame's own. */
  stroke: string;
  lineWidth: number;
}

/**
 * The tag's box, in ELEMENT-LOCAL model units — everything but the corner bite.
 *
 * Split out and exported so the geometry can be asserted without a canvas, and
 * so a future gesture (aim at the tag, not at the band) has one place to ask.
 * `null` when there is nothing to draw: a frame dragged to nothing, or a heading
 * of no words at all.
 */
export function umlFrameTagRect(
  width: number,
  height: number,
  textWidth: number,
  opts: UmlFrameTagOptions
): BackgroundRect | null {
  if (!(width > 0) || !(height > 0)) return null;
  if (!(textWidth > 0)) return null;

  const inset = opts.lineWidth / 2;
  // Clamped to the element on both axes: a frame dragged shorter than its own
  // heading keeps a tag, cut down to what there is, exactly as the band is.
  const w = Math.min(textWidth + opts.padding * 2, width - inset * 2);
  const h = Math.min(opts.bandHeight - opts.foot, height - inset * 2);
  if (!(w > 0) || !(h > 0)) return null;

  return { x: inset, y: inset, w, h };
}

/**
 * Wrap a frame declaration's renderer so the heading is drawn inside Annex A's
 * pentagon.
 *
 * Stroke only, in the frame's own ink: the tag is an outline pinned to the
 * sheet's corner, and filling it would hide the card behind the words — which
 * matters the moment a user drags an element under the heading.
 */
export function withUmlFrameTag<T extends GfxPrimitiveElementModel>(
  def: FrameworkBackgroundDef,
  opts: UmlFrameTagOptions
): ElementRenderer<T> {
  const base = createFrameworkBackgroundRenderer<T>(def);
  const family = def.chrome?.fontFamily ?? 'Inter, sans-serif';
  const label = def.chrome?.sideBands?.find(
    band => band.label?.prop === opts.prop
  )?.label;

  return (model, ctx, matrix, renderer, rc, bound) => {
    const [, , w, h] = model.deserializedXYWH;
    const cx = w / 2;
    const cy = h / 2;

    // BEFORE the base renderer — see the note at the top of this file.
    const tagMatrix = DOMMatrix.fromMatrix(matrix)
      .translateSelf(cx, cy)
      .rotateSelf(model.rotate)
      .translateSelf(-cx, -cy);

    base(model, ctx, matrix, renderer, rc, bound);

    if (!label) return;

    const words = backgroundLabelText(
      label,
      model as unknown as Record<string, unknown>
    );
    if (!words) return;

    ctx.setTransform(tagMatrix);
    // The declaration's own font, so the box fits the glyphs that were painted
    // rather than the glyphs this file would have chosen.
    const weight = label.style.weight ? `${label.style.weight} ` : '';
    ctx.font = `${weight}${label.style.size}px ${label.style.family ?? family}`;
    const textWidth = ctx.measureText(words).width;

    const rect = umlFrameTagRect(w, h, textWidth, opts);
    if (!rect) return;

    const { x, y } = rect;
    const right = x + rect.w;
    const bottom = y + rect.h;
    // The bite can be no larger than the box it is taken out of — a tag squeezed
    // by a short heading or a squashed frame degrades to a triangle rather than
    // folding back on itself.
    const cut = Math.max(0, Math.min(opts.cut, rect.w, rect.h));

    ctx.strokeStyle = opts.stroke;
    ctx.lineWidth = opts.lineWidth;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(right, y);
    ctx.lineTo(right, bottom - cut);
    ctx.lineTo(right - cut, bottom);
    ctx.lineTo(x, bottom);
    ctx.closePath();
    ctx.stroke();
  };
}
