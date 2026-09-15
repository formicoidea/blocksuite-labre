import { vi } from 'vitest';

/**
 * A canvas-context stub that records what a background renderer DREW, not how
 * it drew it: rounded-rect paths, straight segments, filled rects and text with
 * its font, alignment, baseline and colour.
 *
 * Recording the output rather than the calls is what lets a test assert literal
 * coordinates and survive a rewrite of the renderer — which is exactly what the
 * pool's move onto the framework-background primitive is.
 *
 * A copy of `gfx/c4/src/__tests__/canvas-stub.ts` (itself a copy of BPMN's,
 * itself a copy of the Core Domain Chart's, itself a copy of Wardley's),
 * deliberately: a test harness is not API, and making this package depend on
 * another framework's private test folder to get one would be a worse coupling
 * than the duplication.
 *
 * Unchanged from C4's, including the three behaviours this pack leans on: `arc`
 * and `ellipse` THROW on a negative radius exactly as Canvas2D does, the paint
 * ORDER is recorded — the package tab is drawn BEFORE the body whose top edge
 * closes the join — and `measureText` is deterministic, which is what lets the
 * diagram frame's heading TAG be measured in a test at all.
 */

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RoundRect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

export interface FilledRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

export interface RecordedText {
  text: string;
  x: number;
  y: number;
  font: string;
  align: string;
  baseline: string;
  color: string;
  vertical: boolean;
}

/** A circular or elliptical arc, as the node glyphs draw them. */
export interface Curve {
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** Arc angles in radians when the curve came from `arc` (absent for `ellipse`). */
  start?: number;
  end?: number;
}

export function recordingCtx() {
  const segments: Segment[] = [];
  const arcs: number[][] = [];
  const curves: Curve[] = [];
  const rects: FilledRect[] = [];
  const texts: RecordedText[] = [];
  const dashes: number[][] = [];
  const fills: string[] = [];
  const strokes: string[] = [];
  const transform: Array<[string, ...number[]]> = [];
  /** Every painting operation, in order — the paint ORDER is a contract too. */
  const ops: string[] = [];

  let mx = 0;
  let my = 0;
  /** The dash pattern currently in force — what `getLineDash` hands back. */
  let currentDash: number[] = [];
  // Vertical text is drawn at the origin of a translated + rotated frame.
  let frame: { x: number; y: number } | null = null;
  let rotated = false;

  const ctx = {
    fillStyle: '' as string,
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    setTransform: vi.fn((m: { ops: Array<[string, ...number[]]> }) => {
      transform.push(...m.ops);
    }),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn((x: number, y: number) => {
      mx = x;
      my = y;
    }),
    lineTo: vi.fn((x: number, y: number) => {
      segments.push({ x1: mx, y1: my, x2: x, y2: y });
      mx = x;
      my = y;
    }),
    arcTo: vi.fn((...args: number[]) => {
      arcs.push(args);
    }),
    // The node glyphs draw circles and ellipses (clock rim, terminate disc,
    // gear, cylinder lid). Recorded as CENTRE + RADII, which is what a test
    // about "is this thing round and where" wants to read.
    //
    // Both THROW on a negative radius, exactly as Canvas2D does — it raises
    // `IndexSizeError` rather than clamping or no-opping, and since the surface
    // render loop wraps no renderer in a `try`, one such throw aborts the rest
    // of the frame and leaves the save stack unbalanced. A stub that quietly
    // accepted -0.5 would let a renderer pass its tests and blank a real
    // canvas, so this one refuses the same way the browser does.
    arc: vi.fn(
      (x: number, y: number, r: number, start?: number, end?: number) => {
        if (r < 0) throw new Error(`IndexSizeError: negative radius ${r}`);
        // The angles ride along for the one glyph whose meaning is which half
        // of the circle is drawn: the socket, an open cup (see node-renderer).
        curves.push({ x, y, rx: r, ry: r, start, end });
      }
    ),
    ellipse: vi.fn((x: number, y: number, rx: number, ry: number) => {
      if (rx < 0 || ry < 0) {
        throw new Error(`IndexSizeError: negative radii ${rx}, ${ry}`);
      }
      curves.push({ x, y, rx, ry });
    }),
    fill: vi.fn(() => {
      ops.push('fill');
      fills.push(ctx.fillStyle);
    }),
    stroke: vi.fn(() => {
      ops.push('stroke');
      strokes.push(ctx.strokeStyle);
    }),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      ops.push('fillRect');
      rects.push({ x, y, w, h, fill: ctx.fillStyle });
    }),
    setLineDash: vi.fn((dash: number[]) => {
      currentDash = [...dash];
      if (dash.length) dashes.push(dash);
    }),
    /**
     * The counterpart Canvas2D has and the copies this file comes from never
     * needed: §17.3.4's lifeline spine is the pack's first DASHED glyph, and a
     * glyph that sets a dash puts the previous one back rather than clearing it
     * — a restore-to-empty would be a renderer deciding what its caller had.
     */
    getLineDash: vi.fn(() => [...currentDash]),
    save: vi.fn(),
    restore: vi.fn(() => {
      frame = null;
      rotated = false;
    }),
    translate: vi.fn((x: number, y: number) => {
      frame = { x, y };
    }),
    rotate: vi.fn(() => {
      rotated = true;
    }),
    fillText: vi.fn((text: string, x: number, y: number) => {
      ops.push('fillText');
      texts.push({
        text,
        x: rotated && frame ? frame.x : x,
        y: rotated && frame ? frame.y : y,
        font: ctx.font,
        align: ctx.textAlign,
        baseline: ctx.textBaseline,
        color: ctx.fillStyle,
        vertical: rotated,
      });
    }),
    /**
     * A deterministic text metric, so a wrap is a fact a test can assert.
     *
     * Half an em per character is roughly Inter's average advance and — much
     * more to the point — it is a pure function of the string and the font size,
     * which the real `measureText` is not: it depends on the fonts the machine
     * running the suite happens to have installed. A renderer that wraps on
     * measurement can only be tested against a measurement somebody decided.
     *
     * The font size is read out of `ctx.font`, which the renderer sets before
     * every tier, so two tiers at different sizes measure differently here just
     * as they do on a canvas.
     *
     * Read with a regex rather than `parseFloat`, unlike the copies this file
     * comes from: the CSS shorthand puts the WEIGHT first (`600 20px Inter`),
     * and a leading-number parse measures a bold heading at 600px. The UML
     * frame's heading is written at weight 600 and its tag is sized to the
     * measurement, so getting this wrong is a tag the width of the sheet.
     */
    measureText: vi.fn((text: string) => {
      const size = Number.parseFloat(/([\d.]+)px/.exec(ctx.font)?.[1] ?? '');
      return {
        width: text.length * (Number.isFinite(size) ? size : 10) * 0.5,
      } as TextMetrics;
    }),
    createLinearGradient: vi.fn(() => ({ addColorStop: () => {} })),
  };

  /** Rounded rectangles, reconstructed from the four `arcTo` of each path. */
  const paths: RoundRect[] = [];
  const collectPaths = () => {
    paths.length = 0;
    for (let i = 0; i + 3 < arcs.length; i += 4) {
      const a = arcs[i];
      const x = arcs[i + 2][0];
      paths.push({ x, y: a[1], w: a[0] - x, h: a[3] - a[1], r: a[4] });
    }
    return paths;
  };

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    segments,
    curves,
    rects,
    texts,
    dashes,
    fills,
    strokes,
    transform,
    ops,
    get paths() {
      return collectPaths();
    },
  };
}

/** Chainable matrix stub recording the transform the renderer composes. */
export function stubMatrix() {
  const ops: Array<[string, ...number[]]> = [];
  const m = {
    ops,
    translateSelf(x: number, y: number) {
      ops.push(['translate', x, y]);
      return m;
    },
    rotateSelf(deg: number) {
      ops.push(['rotate', deg]);
      return m;
    },
  };
  return m as unknown as DOMMatrix;
}
