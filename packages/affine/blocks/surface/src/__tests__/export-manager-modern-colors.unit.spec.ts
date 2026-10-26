import { ImageProxyService } from '@labre/affine-shared/adapters';
import { afterEach, describe, expect, it } from 'vitest';

import { ExportManager } from '../extensions/export-manager/export-manager.js';

/**
 * The PNG/PDF export rasterises blocks with html2canvas 1.4.1, whose colour
 * parser knows hex, rgb(a), hsl(a) and keywords — and throws on anything else
 * ("Attempting to parse an unsupported color function \"oklch\""). A host
 * theme written in `oklch()`, or the library's own `color-mix(in srgb, …)`
 * (which Chrome computes to `color(srgb …)`), aborted the whole export. This
 * suite runs in Chromium, so the computed styles are the real ones.
 *
 * Same stub std as `export-manager-image-proxy.unit.spec.ts`: nothing but the
 * image proxy seam the export already reads.
 */
const stub = new ExportManager({
  get: (key: unknown) => {
    if (key !== ImageProxyService) {
      throw new Error(`unexpected lookup ${String(key)}`);
    }
    return { imageProxyURL: '' };
  },
} as never);

/**
 * Deadline of each case, in place of the package's 500 ms default.
 *
 * Each case awaits html2canvas itself (no poll, no fixed delay), and it clones
 * the whole document into an iframe before painting: 70–110 ms alone, the
 * first case also paying the dynamic import. The browser suite shares one page
 * across files (`isolate: false`) and the full parallel unit run starves it,
 * which once pushed a case past 500 ms. A deadline is for a hang, not for a
 * slow machine.
 */
const RASTERISE_TIMEOUT_MS = 5_000;

/** The private html2canvas wrapper every block of an edgeless export goes through. */
const rasterise = (element: HTMLElement) =>
  (
    stub as unknown as {
      _html2canvas(
        element: HTMLElement,
        options?: { logging?: boolean }
      ): Promise<HTMLCanvasElement>;
    }
  )
    // html2canvas logs every stage by default, and in browser mode each line
    // crosses to the runner: load the assertions do not need.
    ._html2canvas(element, { logging: false });

describe('the canvas export survives modern colour syntax', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup());
  });

  const mount = (style: string) => {
    const element = document.createElement('div');
    element.setAttribute('style', `width: 40px; height: 20px; ${style}`);
    element.textContent = 'note';
    document.body.append(element);
    cleanups.push(() => element.remove());
    return element;
  };

  it(
    'rasterises an element painted in oklch() through a CSS variable',
    async () => {
      const element = mount(
        '--probe-fill: oklch(0.7 0.1 200); background-color: var(--probe-fill); color: oklch(0.3 0.05 260); border: 1px solid oklch(0.5 0.1 30);'
      );

      const canvas = await rasterise(element);

      expect(canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(canvas.width).toBeGreaterThan(0);
    },
    RASTERISE_TIMEOUT_MS
  );

  it(
    'rasterises an element painted with color-mix(in srgb, …)',
    async () => {
      const element = mount(
        'background-color: color-mix(in srgb, #1f2328 20%, transparent); box-shadow: 0 1px 2px color-mix(in srgb, black 30%, transparent);'
      );

      const canvas = await rasterise(element);

      expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    },
    RASTERISE_TIMEOUT_MS
  );

  it(
    'rasterises when the page background itself is oklch()',
    async () => {
      const previous = document.body.style.background;
      document.body.style.background = 'oklch(0.7 0.1 200)';
      cleanups.push(() => {
        document.body.style.background = previous;
      });
      const element = mount('background-color: #ffffff;');

      const canvas = await rasterise(element);

      expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    },
    RASTERISE_TIMEOUT_MS
  );

  it(
    'keeps the colour: the oklch fill lands on the canvas as its sRGB value',
    async () => {
      const element = mount('background-color: oklch(0.628 0.2577 29.23);');

      const canvas = await rasterise(element);
      const ctx = canvas.getContext('2d')!;
      // A corner pixel: the middle holds the glyphs of the text.
      const [r, g, b] = ctx.getImageData(1, 1, 1, 1).data;

      // oklch(0.628 0.2577 29.23) is sRGB red.
      expect(r).toBeGreaterThan(240);
      expect(g).toBeLessThan(20);
      expect(b).toBeLessThan(20);
    },
    RASTERISE_TIMEOUT_MS
  );
});
