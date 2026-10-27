import { estimateBackgroundText } from './band-widths.js';

/** `undefined` until first asked; `null` where there is no canvas to ask. */
let offscreen: CanvasRenderingContext2D | null | undefined;

/**
 * Measure background text with no painting context at hand — a hit test runs on
 * a pointer event, not inside a paint — for `backgroundBandWidths`.
 *
 * A module-level offscreen 2D context where a document exists, so a hit box is
 * measured with the same metrics the canvas paints with, and a band a long name
 * widened is aimed at where it is drawn; the estimate where there is no
 * document, or where the DOM is a test double that cannot measure.
 *
 * In a file of its own, out of the `./interchange` graph: `band-widths.ts` is
 * reachable from that headless entry and must not touch the DOM
 * (`interchange-headless.unit.spec.ts` in `affine/all`).
 */
export function measureBackgroundText(text: string, font: string): number {
  if (offscreen === undefined) {
    offscreen =
      typeof document === 'undefined'
        ? null
        : (document.createElement('canvas').getContext?.('2d') ?? null);
  }
  if (offscreen) {
    offscreen.font = font;
    const width = offscreen.measureText(text)?.width;
    if (typeof width === 'number' && Number.isFinite(width)) return width;
  }
  return estimateBackgroundText(text, font);
}
