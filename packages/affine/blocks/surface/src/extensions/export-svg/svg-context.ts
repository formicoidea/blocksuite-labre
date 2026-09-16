import { Context } from 'svgcanvas/dist/svgcanvas.esm.js';

/**
 * A 2D context that records an SVG document instead of pixels, shaped so the
 * existing canvas renderers can paint into it unchanged.
 */
export interface SvgContext {
  /** What the element renderers draw into. */
  ctx: CanvasRenderingContext2D;
  /** What `new RoughCanvas(...)` takes: `getContext('2d')` returns {@link ctx}. */
  canvas: HTMLCanvasElement;
  /** The finished document, with `viewBox`, `width`/`height` in px and `xmlns`. */
  serialize(): string;
}

/** The slice of svgcanvas' private surface the path shim reaches into. */
interface SvgCanvasInternals {
  /** The SVG node the next `fill`/`stroke`/`clip` will style. */
  __currentElement: SVGElement;
  /** The `d` accumulated by `moveTo`/`lineTo`/… , already in root space. */
  __currentDefaultPath: string;
  /** Writes the current (or given) matrix onto a node as `transform="…"`. */
  __applyTransformation(element: SVGElement, matrix?: DOMMatrix): void;
  beginPath(): void;
  lineWidth: number;
  fill(): void;
  stroke(): void;
  clip(): void;
}

type PathOp = 'clip' | 'fill' | 'stroke';

const PATH_OPS: readonly PathOp[] = ['fill', 'stroke', 'clip'];

/** Marks a {@link RecordingPath2D} and carries what it recorded. */
const RECORDED_D: unique symbol = Symbol('labre.export-svg.recorded-d');

interface RecordedPath {
  [RECORDED_D]: string;
}

/** A `Path2D` that also remembers itself as an SVG `d`, in the caller's space. */
export type RecordingPath2D = Path2D & RecordedPath & { readonly d: string };

type RecordingPath2DConstructor = new (
  source?: Path2D | string
) => RecordingPath2D;

function isRecordingPath(value: unknown): value is RecordingPath2D {
  return (
    typeof (value as RecordedPath | null | undefined)?.[RECORDED_D] === 'string'
  );
}

/**
 * The SVG `d` of a path argument, or `undefined` when it cannot be read.
 *
 * Duck-typed on a string `d` so it covers both paths this module recorded and
 * the native ones `taggedPath2D` tagged — a renderer is free to memoise those,
 * and a memo built during an ordinary canvas paint must still be readable here.
 */
function readablePathD(value: unknown): string | undefined {
  const d = (value as { d?: unknown } | null | undefined)?.d;
  return typeof d === 'string' ? d : undefined;
}

/** A path argument whose geometry is unreadable: a bare native `Path2D`. */
function isOpaquePath(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    readablePathD(value) === undefined
  );
}

function isEvenOdd(value: unknown): boolean {
  return value === 'evenodd';
}

function unsupported(method: string): Error {
  return new Error(
    `SVG export: Path2D.${method}() is not recorded. Add it to RecordingPath2D ` +
      `in extensions/export-svg/svg-context.ts, or draw it on the context directly.`
  );
}

let recordingPath2D: RecordingPath2DConstructor | undefined;

/**
 * Built on first use rather than at import time: it extends the platform
 * `Path2D`, which does not exist under Node, and merely importing this module
 * must not throw there (same arrangement as `gfx/cynefin-estuarine`'s lazy
 * curves).
 *
 * It EXTENDS `Path2D` on purpose. A renderer is free to memoise the paths it
 * builds (`gfx/cynefin-estuarine` does), so an instance created while the shim
 * is installed can outlive the export and be handed to a real canvas context
 * later — which only works if it is a genuine `Path2D` as well.
 */
function getRecordingPath2D(): RecordingPath2DConstructor {
  if (recordingPath2D) return recordingPath2D;

  const Base = globalThis.Path2D;
  if (!Base) {
    throw new Error('SVG export: Path2D is unavailable in this environment.');
  }

  class RecordingPath2DImpl extends Base {
    [RECORDED_D] = '';

    get d(): string {
      return this[RECORDED_D];
    }

    constructor(source?: Path2D | string) {
      super(source);
      if (typeof source === 'string') {
        this[RECORDED_D] = source;
      } else if (isRecordingPath(source)) {
        this[RECORDED_D] = source[RECORDED_D];
      } else if (source) {
        throw unsupported('constructor(Path2D)');
      }
    }

    private _push(command: string) {
      this[RECORDED_D] += this[RECORDED_D] ? ` ${command}` : command;
    }

    override addPath(path: Path2D, transform?: DOMMatrix2DInit) {
      if (transform) throw unsupported('addPath(path, transform)');
      if (!isRecordingPath(path)) throw unsupported('addPath(Path2D)');
      super.addPath(path);
      this._push(path[RECORDED_D]);
    }

    override arc(): never {
      throw unsupported('arc');
    }

    override arcTo(): never {
      throw unsupported('arcTo');
    }

    override bezierCurveTo(
      cp1x: number,
      cp1y: number,
      cp2x: number,
      cp2y: number,
      x: number,
      y: number
    ) {
      super.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
      this._push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x} ${y}`);
    }

    override closePath() {
      super.closePath();
      this._push('Z');
    }

    override ellipse(): never {
      throw unsupported('ellipse');
    }

    override lineTo(x: number, y: number) {
      super.lineTo(x, y);
      this._push(`L ${x} ${y}`);
    }

    override moveTo(x: number, y: number) {
      super.moveTo(x, y);
      this._push(`M ${x} ${y}`);
    }

    override quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
      super.quadraticCurveTo(cpx, cpy, x, y);
      this._push(`Q ${cpx} ${cpy} ${x} ${y}`);
    }

    override rect(x: number, y: number, w: number, h: number) {
      super.rect(x, y, w, h);
      this._push(
        `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`
      );
    }

    override roundRect(): never {
      throw unsupported('roundRect');
    }
  }

  recordingPath2D =
    RecordingPath2DImpl as unknown as RecordingPath2DConstructor;
  return recordingPath2D;
}

/**
 * Runs `render` with `globalThis.Path2D` swapped for the recording subclass, so
 * the `new Path2D(d)` a renderer builds can be replayed into the SVG document.
 *
 * Swapping a global is safe here because the swap and the restore bracket a
 * SYNCHRONOUS call on a single-threaded runtime: no other code can run — let
 * alone observe `Path2D` — between the two, and the `finally` restores the
 * original even when a renderer throws.
 */
export function runWithRecordingPath2D<T>(render: () => T): T {
  const original = globalThis.Path2D;
  globalThis.Path2D = getRecordingPath2D() as unknown as typeof Path2D;
  try {
    return render();
  } finally {
    globalThis.Path2D = original;
  }
}

/**
 * Teaches `fill`/`stroke`/`clip` the two things svgcanvas drops on the floor:
 * the `Path2D` argument, and the fill rule.
 */
function installPathOps(ctx: SvgCanvasInternals) {
  for (const op of PATH_OPS) {
    const original = ctx[op];
    ctx[op] = (...args: unknown[]) => {
      const d = args.map(readablePathD).find(value => value !== undefined);
      const hasPath = d !== undefined;
      const evenOdd = args.some(isEvenOdd);

      if (hasPath) {
        // svgcanvas ignores Path2D arguments and always paints its "current
        // default path", so the path's `d` becomes exactly that.
        ctx.beginPath();
        ctx.__currentDefaultPath = d;
      } else if (args.some(isOpaquePath)) {
        // An untagged native Path2D. Nothing can read its geometry back, so
        // drop it loudly rather than let svgcanvas paint whatever path happened
        // to be current. `taggedPath2D` is the fix at the call site.
        ctx.beginPath();
        ctx.__currentDefaultPath = '';
        console.warn(
          'SVG export: an untagged Path2D cannot be read back; that shape is ' +
            'missing from the SVG. Build it with `taggedPath2D`.'
        );
      }

      // `clip()` moves this node into a <clipPath>, so grab it beforehand.
      const element = ctx.__currentElement;
      const lineWidth = ctx.lineWidth;

      original.call(ctx);

      if (hasPath) {
        // svgcanvas BAKES the current matrix into every coordinate it emits;
        // an injected `d` never went through that, so the matrix rides along
        // as a `transform` attribute instead…
        ctx.__applyTransformation(element);
        // …and the stroke width, which svgcanvas pre-multiplied by the matrix
        // scale, goes back to its raw value or the transform scales it twice.
        if (op === 'stroke') {
          element.setAttribute('stroke-width', `${lineWidth}`);
        }
      }

      if (evenOdd) {
        element.setAttribute(
          op === 'clip' ? 'clip-rule' : 'fill-rule',
          'evenodd'
        );
      }
    };
  }
}

/** Adds `viewBox` / `xmlns` / px units to the root `<svg>` if they are missing. */
function finishSvg(svg: string, width: number, height: number): string {
  return svg.replace(/<svg\b[^>]*>/, tag => {
    let out = tag;
    if (!/\sviewBox=/.test(out)) {
      out = out.replace(/^<svg/, `<svg viewBox="0 0 ${width} ${height}"`);
    }
    if (!/\sxmlns=/.test(out)) {
      out = out.replace(/^<svg/, `<svg xmlns="http://www.w3.org/2000/svg"`);
    }
    out = /\swidth=/.test(out)
      ? out.replace(/\swidth="[^"]*"/, ` width="${width}px"`)
      : out.replace(/^<svg/, `<svg width="${width}px"`);
    out = /\sheight=/.test(out)
      ? out.replace(/\sheight="[^"]*"/, ` height="${height}px"`)
      : out.replace(/^<svg/, `<svg height="${height}px"`);
    return out;
  });
}

/**
 * An SVG-emitting 2D context of `width` × `height` user units, ready to be
 * handed to {@link CanvasRenderer.renderBoundTo}.
 */
export function createSvgContext(width: number, height: number): SvgContext {
  const context = new Context({ width, height });
  const ctx = context as unknown as CanvasRenderingContext2D;

  // `RoughCanvas` takes the CANVAS and calls `getContext('2d')` on it.
  // svgcanvas already points `canvas` back at the context, so one method
  // closes the loop.
  context.getContext = () => ctx;
  // Text renderers temporarily attach a detached canvas to <body> to measure
  // RTL runs. This context is not a DOM node, so claim it is already attached.
  context.isConnected = true;
  // …and they set `dir` on the canvas before every text run; a no-op keeps
  // that call from reaching an object that is not an element.
  context.setAttribute = () => {};

  installPathOps(context as unknown as SvgCanvasInternals);

  return {
    ctx,
    canvas: ctx.canvas,
    serialize: () => finishSvg(context.getSerializedSvg(true), width, height),
  };
}
