/**
 * Ambient types for `svgcanvas` (2.6.0), which ships no `.d.ts` and no
 * `exports` map — hence the deep, Node-resolvable specifier. Keep imports on
 * `'svgcanvas/dist/svgcanvas.esm.js'`: the bare `'svgcanvas'` specifier lands
 * on the CJS `main`, which the published ESM bundles cannot resolve.
 *
 * Deliberately minimal. `Context` is a 2D context that records into an SVG DOM
 * instead of pixels and poses as its own canvas (`ctx.canvas === ctx`), so the
 * few call sites that need it as a `CanvasRenderingContext2D` cast once rather
 * than carry a hand-written copy of the whole 2D API.
 */
declare module 'svgcanvas/dist/svgcanvas.esm.js' {
  export interface SvgCanvasContextOptions {
    width: number;
    height: number;
    /** The document the SVG nodes are created in. Defaults to `document`. */
    document?: Document;
    /** A real 2D context to delegate `measureText` to. One is made if absent. */
    ctx?: CanvasRenderingContext2D;
    enableMirroring?: boolean;
    debug?: boolean;
  }

  export class Context {
    constructor(options: SvgCanvasContextOptions);

    readonly width: number;

    readonly height: number;

    /** Points back at the instance, so it can be handed to canvas consumers. */
    canvas: Context;

    /** The document built so far, serialized. */
    getSerializedSvg(fixNamedEntities?: boolean): string;

    /** The live root `<svg>` node. */
    getSvg(): SVGSVGElement;

    /** Everything else is the 2D API, reached through a cast. */
    [key: string]: unknown;
  }

  export class Element {}
}
