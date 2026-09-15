import { rotatePoint } from '@labre/global/gfx';

/**
 * The LIFELINE's geometry — the two numbers a lifeline is drawn, selected and
 * hit-tested from (UML 2.5.1 §17.3.4).
 *
 * Declared HERE, in the model, and re-exported by `@labre/affine-gfx-uml`, for
 * the reason {@link UML_FRAME_BAND_HEIGHT} and {@link UML_PARTITION_BAND} are:
 * the element's own `elementBound` and `includesPoint` read them (a lifeline's
 * HEAD overflows the column the element actually is), and `affine-model` cannot
 * reach into the package where the renderer lives. One pair of numbers, owned by
 * the layer that the model, the renderer and the label layout can all read.
 *
 * ## Why a lifeline is a narrow column and not a head-shaped box
 *
 * §17.3.4 draws a lifeline as a named rectangle with a dashed vertical line
 * falling out of its bottom edge, down the whole height of the interaction. The
 * thing a message ATTACHES to is that line, never the rectangle — so the element
 * is the COLUMN (16 wide, {@link UML_LIFELINE_SPINE} tall), whose native
 * perimeter puts every connector anchor on the spine's own x, and the head is
 * painted over its top by the glyph layer.
 *
 * The consequence is the one thing this module exists to fix: the head is 160
 * wide against a 16-wide element, so it hangs 72 units off each side of the box
 * the platform knows about. Selection, hit testing and frame fitting would all
 * stop at the column — a user would see a named box and be unable to click it.
 * {@link umlLifelineHeadRect} is the shared answer, read by the model's two
 * overrides and by the renderer alike.
 */
export const UML_LIFELINE_HEAD = { w: 160, h: 48 } as const;

/**
 * How tall a fresh lifeline's COLUMN is — the head plus the dashed spine under
 * it, in model units.
 *
 * 600 is a sheet's worth of conversation: at the 40-unit rhythm a sequence
 * diagram's messages are drawn on, it holds a dozen or so exchanges before the
 * author has to drag it longer. Which is the one resize a lifeline ever wants —
 * a longer spine, never a wider one.
 */
export const UML_LIFELINE_SPINE = 600;

/** What a lifeline geometry question needs of an element: its box. */
export interface UmlLifelineGeometry {
  deserializedXYWH: readonly number[];
  rotate?: number;
}

/** A rectangle in the element's own (unrotated) local frame. */
export interface UmlLifelineRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The head box, in ELEMENT-LOCAL model units — the named rectangle §17.3.4
 * draws at the top of the lifeline, centred on the column and flush with its
 * top.
 *
 * `null` when there is nothing to draw: a column dragged to nothing.
 *
 * Never NARROWER than the column: a lifeline dragged wider than 160 units is a
 * lifeline whose head is the whole of it, which is the only reading that keeps
 * the head a box round the spine rather than a stripe down the middle of one.
 * Clamped in height for the same reason the frame's heading band is — a column
 * shorter than its own head keeps a head, cut down to what there is.
 */
export function umlLifelineHeadRect(
  model: UmlLifelineGeometry
): UmlLifelineRect | null {
  const [, , w, h] = model.deserializedXYWH;
  if (!(w > 0) || !(h > 0)) return null;

  const width = Math.max(UML_LIFELINE_HEAD.w, w);
  const height = Math.min(UML_LIFELINE_HEAD.h, h);
  if (!(width > 0) || !(height > 0)) return null;

  return { x: (w - width) / 2, y: 0, w: width, h: height };
}

/**
 * Whether a CANVAS point lies in the lifeline's head.
 *
 * The rotation is undone about the element's centre before anything is
 * measured, exactly as {@link umlInNameBand} does it: the head is axis-aligned
 * INSIDE the lifeline, never on the canvas.
 */
export function umlInLifelineHead(
  model: UmlLifelineGeometry,
  x: number,
  y: number
): boolean {
  const head = umlLifelineHeadRect(model);
  if (!head) return false;

  const [ex, ey, w, h] = model.deserializedXYWH;
  let lx = x - ex;
  let ly = y - ey;
  const rotate = model.rotate ?? 0;
  if (rotate) {
    const [ux, uy] = rotatePoint([x, y], [ex + w / 2, ey + h / 2], -rotate);
    lx = ux - ex;
    ly = uy - ey;
  }

  return (
    lx >= head.x &&
    lx <= head.x + head.w &&
    ly >= head.y &&
    ly <= head.y + head.h
  );
}
