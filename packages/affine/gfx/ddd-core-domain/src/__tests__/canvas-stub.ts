import { vi } from 'vitest';

/**
 * A canvas-context stub that records what a background renderer DREW, not how
 * it drew it: rounded-rect paths, straight segments, filled rects, gradients
 * and text with its font, alignment and colour.
 *
 * Recording the output rather than the calls is what lets a test assert
 * literal coordinates and survive a rewrite of the renderer — which is exactly
 * what the Core Domain Chart's move onto the framework-background primitive is.
 *
 * A copy of `gfx/wardley/src/__tests__/canvas-stub.ts`, deliberately: a test
 * harness is not API, and making this package depend on another framework's
 * private test folder to get one would be a worse coupling than the duplication.
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
  color: string;
  vertical: boolean;
}

export interface RecordedGradient {
  from: [number, number];
  to: [number, number];
  stops: Array<[number, string]>;
}

export function recordingCtx() {
  const segments: Segment[] = [];
  const arcs: number[][] = [];
  const rects: FilledRect[] = [];
  const texts: RecordedText[] = [];
  const gradients: RecordedGradient[] = [];
  const dashes: number[][] = [];
  const fills: string[] = [];
  const strokes: string[] = [];
  const transform: Array<[string, ...number[]]> = [];

  let mx = 0;
  let my = 0;
  // Vertical text is drawn at the origin of a translated + rotated frame.
  let frame: { x: number; y: number } | null = null;
  let rotated = false;

  const ctx = {
    fillStyle: '' as string | RecordedGradient,
    strokeStyle: '',
    lineWidth: 0,
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
    fill: vi.fn(() => {
      if (typeof ctx.fillStyle === 'string') fills.push(ctx.fillStyle);
    }),
    stroke: vi.fn(() => {
      strokes.push(ctx.strokeStyle);
    }),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      if (typeof ctx.fillStyle === 'string') {
        rects.push({ x, y, w, h, fill: ctx.fillStyle });
      }
    }),
    setLineDash: vi.fn((dash: number[]) => {
      if (dash.length) dashes.push(dash);
    }),
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
      texts.push({
        text,
        x: rotated && frame ? frame.x : x,
        y: rotated && frame ? frame.y : y,
        font: ctx.font,
        align: ctx.textAlign,
        color: typeof ctx.fillStyle === 'string' ? ctx.fillStyle : '<gradient>',
        vertical: rotated,
      });
    }),
    createLinearGradient: vi.fn(
      (x0: number, y0: number, x1: number, y1: number) => {
        const gradient: RecordedGradient = {
          from: [x0, y0],
          to: [x1, y1],
          stops: [],
        };
        gradients.push(gradient);
        return {
          ...gradient,
          addColorStop: (offset: number, color: string) =>
            gradient.stops.push([offset, color]),
        };
      }
    ),
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
    rects,
    texts,
    gradients,
    dashes,
    fills,
    strokes,
    transform,
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
