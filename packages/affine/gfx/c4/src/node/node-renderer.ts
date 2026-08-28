import {
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import { shape as shapeRenderer } from '@labre/affine-gfx-shape';
import {
  type C4NodeElementModel,
  type C4NodeKind,
  DefaultTheme,
} from '@labre/affine-model';

/**
 * Renderer for a C4 node.
 *
 * The body (rounded rectangle) is drawn by REUSING the native shape renderer —
 * so stroke width, colours, inner text and theme behave exactly like a native
 * shape, and the node's label is the native inner text, multi-line and centred,
 * exactly as a BPMN task's is. On top of it this file paints only what the
 * official stencil draws and a rectangle cannot be:
 *
 *  - `person` / `person-ext` — a circular head with a rounded body block under
 *    it. The glyph draws the BODY too: the silhouette is not a native shape, so
 *    the rect underneath is created unfilled and unstroked;
 *  - `database`             — a cylinder, same treatment, same reason;
 *  - `mobile`               — a phone bezel down the leading edge, painted OVER
 *    the native body;
 *  - `browser`              — a chrome band across the top with three dots in
 *    it, likewise over the native body.
 *
 * `system`, `system-ext`, `container` and `component` are bare: the stencil
 * draws them as plain rounded rectangles, and what tells them apart is the
 * COLOUR they are created in (`NODE_PALETTE`) plus the role stamped on them.
 * That is C4's own answer, and it is why this pack has nine kinds and five
 * element roles rather than nine glyphs.
 *
 * Both fill and stroke are read off the MODEL, never off the palette table:
 * a node's colours are editable from the shape toolbar like any other shape's,
 * and a glyph that painted the table's blue would silently ignore the user's own
 * choice. The palette is what the creation site SEEDS them with.
 *
 * Mirrors the BPMN node renderer.
 */

/**
 * The kinds C4 draws BARE — a plain native shape with nothing on it.
 *
 * Written as the short list rather than the long one, so that the glyph kinds
 * are DERIVED from the model's union instead of restated beside it: a kind added
 * to `C4NodeKind` is a glyph kind by default, and the exhaustiveness check at the
 * bottom of this file then refuses to compile until it is drawn.
 */
const BARE_KINDS = {
  system: true,
  'system-ext': true,
  container: true,
  component: true,
} as const;

type C4BareKind = keyof typeof BARE_KINDS;

/** Every kind this file has to paint something for. */
type C4GlyphKind = Exclude<C4NodeKind, C4BareKind>;

const isBare = (kind: C4NodeKind): kind is C4BareKind =>
  Object.hasOwn(BARE_KINDS, kind);

const TAU = Math.PI * 2;

/**
 * Trace a rounded rectangle, and say whether there was one to trace.
 *
 * An element can be dragged to nothing: the resize manager takes the absolute
 * value of the dragged extents but sets no minimum size, and every dimension
 * here has the stroke width subtracted from it first — so a 2-unit border on a
 * 1-unit box gives -0.5. `arcTo` throws `IndexSizeError` on a negative radius
 * rather than clamping, and the surface render loop wraps no renderer in a
 * `try`, so one such throw aborts the rest of the frame with an unbalanced save
 * stack. Returning `false` lets the caller skip the fill and the stroke too,
 * rather than painting a degenerate path.
 */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): boolean {
  if (!(w > 0) || !(h > 0)) return false;
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  return true;
}

export const c4Node: ElementRenderer<C4NodeElementModel> = (
  model,
  ctx,
  matrix,
  renderer,
  rc,
  bound
) => {
  const [, , w, h] = model.deserializedXYWH;
  const cx = w / 2;
  const cy = h / 2;

  // Capture the element-local transform BEFORE the shape renderer mutates the
  // matrix, so the glyph can be drawn in the same space afterwards.
  const glyphMatrix = DOMMatrix.fromMatrix(matrix)
    .translateSelf(cx, cy)
    .rotateSelf(model.rotate)
    .translateSelf(-cx, -cy);

  // Native shape (fill / stroke / inner text / theme handled natively).
  shapeRenderer(model, ctx, matrix, renderer, rc, bound);

  const kind: C4NodeKind = model.kind;
  if (isBare(kind)) return;

  const stroke = renderer.getColorValue(
    model.strokeColor,
    DefaultTheme.shapeStrokeColor,
    true
  );
  const fill = renderer.getColorValue(
    model.fillColor,
    DefaultTheme.shapeFillColor,
    true
  );
  const strokeWidth = model.strokeWidth || 1;

  /** The smaller half-extent, the unit every glyph is sized against. */
  const unit = Math.max(0, Math.min(w, h));

  ctx.setTransform(glyphMatrix);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // The body box, inset by half the border so the stroke lands inside the
  // element rather than straddling its bounds.
  const half = strokeWidth / 2;
  const x0 = half;
  const y0 = half;
  const x1 = w - half;
  const y1 = h - half;

  // ── The person: a head, and a rounded body block under it ────────────
  if (kind === 'person' || kind === 'person-ext') {
    const headR = Math.max(0, unit * 0.16);
    const headY = y0 + headR;

    // The head goes FIRST so the body covers its lower arc: what is left is a
    // head sitting on a pair of shoulders, which is the stencil's own person.
    if (headR > 0) {
      ctx.beginPath();
      ctx.arc(cx, headY, headR, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    const bodyTop = headY + headR * 0.45;
    if (
      roundedRectPath(
        ctx,
        x0,
        bodyTop,
        x1 - x0,
        y1 - bodyTop,
        Math.max(0, unit * 0.12)
      )
    ) {
      ctx.fill();
      ctx.stroke();
    }
    return;
  }

  // ── The database: a cylinder ─────────────────────────────────────────
  if (kind === 'database') {
    // Both radii subtract the stroke first, so both go NEGATIVE on an element
    // dragged narrower (or shorter) than its own border — and a negative radius
    // is the one thing `ellipse` throws on. Clamped where they are computed,
    // exactly as the BPMN data store's are.
    const rx = Math.max(0, (x1 - x0) / 2);
    const ry = Math.max(0, (y1 - y0) * 0.14);
    const mx = (x0 + x1) / 2;
    const top = y0 + ry;
    const bottom = y1 - ry;
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x0, bottom);
    // Floor, left to right through the lowest point.
    ctx.ellipse(mx, bottom, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(x1, top);
    // Back up the front of the lid, right to left.
    ctx.ellipse(mx, top, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // The lid's own far edge, which the body path does not include.
    ctx.beginPath();
    ctx.ellipse(mx, top, rx, ry, 0, 0, TAU);
    ctx.stroke();
    return;
  }

  // ── The two decorated containers: a band over the native body ────────
  // Painted in the node's own STROKE colour — the darker of its two — so the
  // band reads as part of the frame rather than as a second element inside it.
  ctx.fillStyle = stroke;

  if (kind === 'mobile') {
    // The phone bezel: a thick strip down the leading edge, held clear of the
    // top and bottom so it does not poke out of the body's rounded corners.
    const bandW = Math.max(0, unit * 0.1);
    const vInset = Math.max(0, unit * 0.14);
    const bandH = y1 - y0 - vInset * 2;
    if (bandW > 0 && bandH > 0) {
      ctx.fillRect(x0, y0 + vInset, bandW, bandH);
    }
    return;
  }

  if (kind === 'browser') {
    // The chrome band across the top, with the three dots every browser
    // window has in one of its corners.
    const hInset = Math.max(0, unit * 0.1);
    const bandW = x1 - x0 - hInset * 2;
    const bandH = Math.max(0, unit * 0.18);
    if (!(bandW > 0) || !(bandH > 0)) return;

    const bandX = x0 + hInset;
    const bandY = y0 + Math.max(0, unit * 0.08);
    ctx.fillRect(bandX, bandY, bandW, bandH);

    const dotR = Math.max(0, Math.min(bandH * 0.16, bandW * 0.04));
    if (dotR <= 0) return;
    ctx.fillStyle = fill;
    const gap = dotR * 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(bandX + gap * (i + 1), bandY + bandH / 2, dotR, 0, TAU);
      ctx.fill();
    }
    return;
  }

  /**
   * Every glyph kind is drawn above, and this is what keeps that true: `kind` is
   * narrowed to `never` here only if the branches are exhaustive over
   * {@link C4GlyphKind}, so a kind added to the model's union without a picture
   * of its own stops the build.
   *
   * Which is the whole point of closing the last branch rather than letting it
   * fall through. A renderer that silently paints a browser band on somebody's
   * new artefact is worse than one that paints nothing: the first is a wrong
   * picture nobody is told about, the second is a missing one everybody sees.
   */
  const unhandled: never = kind;
  void unhandled;
};

export const C4NodeRendererExtension = ElementRendererExtension(
  'c4Node',
  c4Node
);
