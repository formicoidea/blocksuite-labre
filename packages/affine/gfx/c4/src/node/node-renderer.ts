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

import { NODE_RADIUS } from '../consts';

/**
 * Renderer for a C4 node — the glyph layer, and nothing else.
 *
 * Every path, radius and offset below is read off the PO's reference model
 * (`C4Model_default.svg`, a Visio export of the official stencil) and expressed
 * as a FRACTION of the node box, so a resized element keeps the stencil's own
 * proportions instead of the stencil's own pixels.
 *
 * ## What the native shape does, and what this file does
 *
 * The native shape renderer runs FIRST and owns the fill, the stroke, the theme
 * and the TITLE — the element's inner text, editable in place exactly like any
 * other shape's. This file then paints, in the element-local frame, only the
 * silhouettes a rectangle cannot be: `person` / `person-ext` (a circular head
 * fused into a strongly rounded body), `database` (a cylinder), `mobile` (a
 * phone: a dark bezel with a lighter screen inset in it, a speaker slot and a
 * button) and `browser` (a window: a dark frame, a chrome band with three dots
 * and an address bar, and a lighter screen under it). For all five the native
 * rect is created unfilled and unstroked — the glyph IS the body.
 *
 * ## The two tiers this file no longer paints
 *
 * It used to paint the type line and the description under the title, off two
 * fields on the model. It does not any more, and the difference is the PO's
 * recette of 28/08/2026: a C4 component is the shape and its own words, GROUPED
 * — the type line and the description are real canvas TEXT elements, created
 * beside the shape and edited in place like any other text. Painted tiers could
 * only ever be read, and a picture an architect cannot type on is a form waiting
 * to be invented. `actions.ts` places them; the text renderer draws them.
 *
 * `system`, `system-ext`, `container` and `component` have no glyph at all: the
 * stencil draws them as plain SQUARE-cornered rectangles, and what tells them
 * apart is the COLOUR they are created in (`NODE_PALETTE`) plus the role stamped
 * on them. That is C4's own answer, and it is why this pack has nine kinds and
 * five element roles rather than nine glyphs.
 *
 * Both fill and stroke are read off the MODEL, never off the palette table: a
 * node's colours are editable from the shape toolbar like any other shape's, and
 * a glyph that painted the table's blue would silently ignore the user's own
 * choice. The palette is what the creation site SEEDS them with.
 */

/**
 * The kinds C4 draws BARE — a plain native shape with nothing on it.
 *
 * Written as the short list rather than the long one, so that the glyph kinds
 * are DERIVED from the model's union instead of restated beside it: a kind added
 * to `C4NodeKind` is a glyph kind by default, and the exhaustiveness check at the
 * bottom of {@link paintGlyph} then refuses to compile until it is drawn.
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

/* ── The stencil's geometry, as fractions of the node box ──────────────── */

/**
 * The person (`mID 1`), measured off its single path.
 *
 * The head arc runs between `x=68.89` and `x=37.41` on the body's top edge with
 * `rx=26.362`, `ry=26.504` and `large-arc-flag=1`; solving the SVG centre
 * equation puts its centre 21.263 units ABOVE that edge, so the head stands
 * `26.504 + 21.263 = 47.767` clear of a body 74.409 tall — a silhouette 122.18
 * tall in total, which is what {@link PERSON_BOX} is twice.
 */
const PERSON = {
  /** Head radius, as a fraction of the box width, and of its height. */
  headOfWidth: 26.362 / 106.3,
  headOfHeight: 26.504 / 122.18,
  /** Where the body's top edge sits, as a multiple of the head radius. */
  bodyTopPerHead: 47.767 / 26.433,
  /** The body's corner radius (`19.842`), as a fraction of the box width. */
  radiusOfWidth: 19.842 / 106.3,
} as const;

/** The cylinder's lid and floor: `ry ≈ 9.97` of a 74.409-tall box. */
const DATABASE_RY = 9.97 / 74.409;

/** The phone (`mID 6`): a screen inset in a bezel, a speaker slot, a button. */
const MOBILE = {
  screen: {
    x: 9.2126 / 106.3,
    y: 2.766 / 74.409,
    w: 87.874 / 106.3,
    h: 68.882 / 74.409,
  },
  screenRadius: 1.4173 / 106.3,
  /** The home button, centred in the LEFT bezel column. */
  button: { x: 4.985 / 106.3, y: 38.039 / 74.409, r: 3.0301 / 106.3 },
  /** The speaker slot, a vertical line down the RIGHT bezel column. */
  speaker: { x: 101.411 / 106.3, y0: 29.851 / 74.409, y1: 44.561 / 74.409 },
} as const;

/** The browser window (`mID 11`): a chrome band over a screen. */
const BROWSER = {
  screen: {
    x: 2.126 / 106.3,
    y: 9.214 / 74.409,
    w: 102.05 / 106.3,
    h: 63.071 / 74.409,
  },
  screenRadius: 1.4173 / 106.3,
  dot: { y: 4.766 / 74.409, r: 3.0301 / 106.3 },
  dotsX: [6.5001 / 106.3, 13.978 / 106.3, 21.455 / 106.3],
  bar: {
    x: 26.169 / 106.3,
    y: 1.731 / 74.409,
    w: 77.862 / 106.3,
    h: 6.07 / 74.409,
    r: 2.8346 / 106.3,
  },
} as const;

/* ── Paths ─────────────────────────────────────────────────────────────── */

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

/** Fill and outline a rounded rectangle, skipping a degenerate one entirely. */
function fillStrokeRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (!roundedRectPath(ctx, x, y, w, h, r)) return;
  ctx.fill();
  ctx.stroke();
}

/* ── The glyphs ────────────────────────────────────────────────────────── */

/**
 * Paint one glyph kind, in the element-local frame, with `fillStyle` /
 * `strokeStyle` / `lineWidth` already set from the model.
 *
 * @param inset half the stroke width — the body box is drawn inside it, so the
 * outline lands within the element's bounds rather than straddling them.
 */
function paintGlyph(
  kind: C4GlyphKind,
  ctx: CanvasRenderingContext2D,
  fill: string,
  stroke: string,
  w: number,
  h: number,
  inset: number
): void {
  const cx = w / 2;
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const bw = x1 - x0;
  const bh = y1 - y0;

  // ── The person: a head fused into a strongly rounded body ────────────
  if (kind === 'person' || kind === 'person-ext') {
    // A single radius from whichever dimension is the tighter, so the head stays
    // CIRCULAR at any aspect ratio the author drags the element to. At the
    // stencil's own ratio the two agree to within half a unit, which is the
    // whole reason the person keeps a box of its own.
    const headR = Math.max(
      0,
      Math.min(w * PERSON.headOfWidth, h * PERSON.headOfHeight)
    );
    const headY = y0 + headR;
    const bodyTop = y0 + headR * PERSON.bodyTopPerHead;

    // The head goes FIRST so the body covers its lower arc: what is left is a
    // head standing clear of a pair of shoulders, which is the stencil's own
    // person — its path draws exactly this, the body's top edge running into the
    // head arc and back out of it.
    if (headR > 0) {
      ctx.beginPath();
      ctx.arc(cx, headY, headR, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    fillStrokeRect(
      ctx,
      x0,
      bodyTop,
      bw,
      y1 - bodyTop,
      w * PERSON.radiusOfWidth
    );
    return;
  }

  // ── The database: a cylinder ─────────────────────────────────────────
  if (kind === 'database') {
    // Both radii subtract the stroke first, so both go NEGATIVE on an element
    // dragged narrower (or shorter) than its own border — and a negative radius
    // is the one thing `ellipse` throws on. Clamped where they are computed,
    // exactly as the BPMN data store's are.
    const rx = Math.max(0, bw / 2);
    const ry = Math.max(0, bh * DATABASE_RY);
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
    // The lid's own far edge, which the body path does not include — the rim the
    // stencil draws as two extra `.st10` arcs.
    ctx.beginPath();
    ctx.ellipse(mx, top, rx, ry, 0, 0, TAU);
    ctx.stroke();
    return;
  }

  // ── The two devices: a dark frame with a lighter screen inset in it ──
  // The stencil paints the OUTER rectangle in the darker of the node's two
  // colours and the screen in the lighter, which is the opposite of a band
  // painted over a body — so both are drawn here in full, and the native rect
  // under them paints nothing.
  ctx.fillStyle = stroke;
  ctx.strokeStyle = stroke;

  // Every INNER feature below is placed against the element box (`0…w`, `0…h`)
  // rather than against the stroke-inset one the outer rectangle uses. The
  // stencil states them that way — its screen has equal bezel columns left and
  // right — and shifting them by half a border would make those columns unequal
  // by exactly that half, which is visible at the sizes these are drawn at.
  if (kind === 'mobile') {
    fillStrokeRect(ctx, x0, y0, bw, bh, NODE_RADIUS.mobile);

    ctx.fillStyle = fill;
    fillStrokeRect(
      ctx,
      w * MOBILE.screen.x,
      h * MOBILE.screen.y,
      w * MOBILE.screen.w,
      h * MOBILE.screen.h,
      w * MOBILE.screenRadius
    );

    // The button, in the left bezel column…
    const buttonR = Math.max(0, w * MOBILE.button.r);
    if (buttonR > 0) {
      ctx.beginPath();
      ctx.arc(w * MOBILE.button.x, h * MOBILE.button.y, buttonR, 0, TAU);
      ctx.fill();
    }
    // …and the speaker slot down the right one.
    ctx.strokeStyle = fill;
    ctx.beginPath();
    ctx.moveTo(w * MOBILE.speaker.x, h * MOBILE.speaker.y0);
    ctx.lineTo(w * MOBILE.speaker.x, h * MOBILE.speaker.y1);
    ctx.stroke();
    return;
  }

  if (kind === 'browser') {
    fillStrokeRect(ctx, x0, y0, bw, bh, NODE_RADIUS.browser);

    ctx.fillStyle = fill;
    fillStrokeRect(
      ctx,
      w * BROWSER.screen.x,
      h * BROWSER.screen.y,
      w * BROWSER.screen.w,
      h * BROWSER.screen.h,
      w * BROWSER.screenRadius
    );

    // The three window dots, and the address bar beside them.
    const dotR = Math.max(0, w * BROWSER.dot.r);
    const dotY = h * BROWSER.dot.y;
    if (dotR > 0) {
      for (const dotX of BROWSER.dotsX) {
        ctx.beginPath();
        ctx.arc(w * dotX, dotY, dotR, 0, TAU);
        ctx.fill();
      }
    }
    fillStrokeRect(
      ctx,
      w * BROWSER.bar.x,
      h * BROWSER.bar.y,
      w * BROWSER.bar.w,
      h * BROWSER.bar.h,
      w * BROWSER.bar.r
    );
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

  // Native shape: fill, stroke, theme and the TITLE, all handled natively.
  shapeRenderer(model, ctx, matrix, renderer, rc, bound);

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

  ctx.setTransform(glyphMatrix);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const kind: C4NodeKind = model.kind;
  if (!isBare(kind)) {
    paintGlyph(kind, ctx, fill, stroke, w, h, strokeWidth / 2);
  }
};

export const C4NodeRendererExtension = ElementRendererExtension(
  'c4Node',
  c4Node
);
