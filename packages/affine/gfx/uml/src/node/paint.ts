/**
 * The painting primitives every UML glyph is built out of, and the box they are
 * all measured against.
 *
 * Lifted out of `node-renderer.ts` when the behaviour artefacts of phase 2
 * arrived: a disc, a ring, a bar and a cross are drawn by the activity glyphs
 * and by the state machine glyphs alike, and three files each with their own
 * `line()` is three places for one of them to grow a rounded cap.
 *
 * Nothing here knows what a UML artefact is. Each function takes an already-
 * configured context — `fillStyle`, `strokeStyle` and `lineWidth` set from the
 * MODEL, never from a table — and a rectangle in the element-local frame.
 */

export const TAU = Math.PI * 2;

/**
 * The rectangle a glyph is drawn inside: the element box, inset by half the
 * stroke width so an outline lands within the element's bounds rather than
 * straddling them.
 *
 * Both the inset box (`x0…y1`, `bw`, `bh`) and the RAW element size (`w`, `h`)
 * are carried, because glyphs need both: an outline is drawn inside the inset,
 * while every proportion `component.ts` also reads — the package's tab, the
 * cube's depth, the pentagon's point — is a fraction of the element, so that
 * the renderer and the layout cannot disagree about where a label goes.
 */
export interface GlyphBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** The inset box's own width and height. */
  bw: number;
  bh: number;
  /** The element's width and height, before the stroke inset. */
  w: number;
  h: number;
}

/**
 * Draw the four sides of a rectangle as an explicit path.
 *
 * `ctx.rect` would be one call — and would record nothing a test about WHERE a
 * glyph was drawn can read, on this pack's canvas recorder or on a reviewer's
 * screen. The four segments are the shape.
 */
export function rectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

/** …and paint it as a body: the element's fill, then the element's outline. */
export function solidRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (!(w > 0) || !(h > 0)) return;
  rectPath(ctx, x, y, w, h);
  ctx.fill();
  ctx.stroke();
}

/** Draw one straight segment, skipping a degenerate one. */
export function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** A closed polygon, filled with the element's paper and outlined in its ink. */
export function solidPolygon(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[]
): void {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * A circle filled with the element's paper and outlined in its ink — the hollow
 * mark: an activity final's outer ring, a flow final's rim, an entry point.
 */
export function hollowDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  if (!(r > 0)) return;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

/**
 * A circle filled with the element's INK — the solid mark: an initial node, a
 * junction, the bull of a bullseye.
 *
 * The fill is swapped to the stroke colour and put back, rather than the caller
 * doing it: a glyph that forgot to restore it would paint every later mark in
 * the wrong colour, and the bug would show up two shapes away from its cause.
 * The colour is still the MODEL's — a node recoloured from the shape toolbar
 * recolours its solid marks with it.
 */
export function inkDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  if (!(r > 0)) return;
  withInkFill(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
  });
}

/** The same swap, for a solid mark that is not a circle (the fork's bar). */
export function withInkFill(
  ctx: CanvasRenderingContext2D,
  draw: () => void
): void {
  const paper = ctx.fillStyle;
  ctx.fillStyle = ctx.strokeStyle;
  try {
    draw();
  } finally {
    ctx.fillStyle = paper;
  }
}

/**
 * The two diagonals of a square centred on `(cx, cy)` with half-diagonal `r` —
 * the X of a flow final, an exit point and a terminate.
 */
export function cross(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  if (!(r > 0)) return;
  // 45°, so the arms reach the rim of the circle they are drawn inside rather
  // than a square inscribed in it: the cross of §15.3.4 touches its own rim.
  const d = r * Math.SQRT1_2;
  line(ctx, cx - d, cy - d, cx + d, cy + d);
  line(ctx, cx + d, cy - d, cx - d, cy + d);
}

/**
 * One centred word, in the element's ink — the `H` and `H*` of §14.2.4's history
 * pseudostates, and the only text this pack's glyph layer writes.
 *
 * Text and not a drawn letterform, because it IS a letter: §14.2.4 writes `H`
 * inside the circle, and a path traced by hand would be this pack drawing a
 * typeface. Sized off the mark rather than off a constant, so a history dragged
 * bigger carries a bigger letter.
 */
export function glyphText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  size: number,
  fontFamily: string
): void {
  if (!(size > 0)) return;
  const paper = ctx.fillStyle;
  const font = ctx.font;
  const align = ctx.textAlign;
  const baseline = ctx.textBaseline;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.font = `600 ${size}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try {
    ctx.fillText(text, cx, cy);
  } finally {
    ctx.fillStyle = paper;
    ctx.font = font;
    ctx.textAlign = align as CanvasTextAlign;
    ctx.textBaseline = baseline as CanvasTextBaseline;
  }
}
