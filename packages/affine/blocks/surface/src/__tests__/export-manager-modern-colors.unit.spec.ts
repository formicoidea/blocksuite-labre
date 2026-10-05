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

/** The private html2canvas wrapper every block of an edgeless export goes through. */
const rasterise = (element: HTMLElement) =>
  (
    stub as unknown as {
      _html2canvas(element: HTMLElement): Promise<HTMLCanvasElement>;
    }
  )._html2canvas(element);

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

  it('rasterises an element painted in oklch() through a CSS variable', async () => {
    const element = mount(
      '--probe-fill: oklch(0.7 0.1 200); background-color: var(--probe-fill); color: oklch(0.3 0.05 260); border: 1px solid oklch(0.5 0.1 30);'
    );

    const canvas = await rasterise(element);

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBeGreaterThan(0);
  });

  it('rasterises an element painted with color-mix(in srgb, …)', async () => {
    const element = mount(
      'background-color: color-mix(in srgb, #1f2328 20%, transparent); box-shadow: 0 1px 2px color-mix(in srgb, black 30%, transparent);'
    );

    const canvas = await rasterise(element);

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('rasterises when the page background itself is oklch()', async () => {
    const previous = document.body.style.background;
    document.body.style.background = 'oklch(0.7 0.1 200)';
    cleanups.push(() => {
      document.body.style.background = previous;
    });
    const element = mount('background-color: #ffffff;');

    const canvas = await rasterise(element);

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('keeps the colour: the oklch fill lands on the canvas as its sRGB value', async () => {
    const element = mount('background-color: oklch(0.628 0.2577 29.23);');

    const canvas = await rasterise(element);
    const ctx = canvas.getContext('2d')!;
    // A corner pixel: the middle holds the glyphs of the text.
    const [r, g, b] = ctx.getImageData(1, 1, 1, 1).data;

    // oklch(0.628 0.2577 29.23) is sRGB red.
    expect(r).toBeGreaterThan(240);
    expect(g).toBeLessThan(20);
    expect(b).toBeLessThan(20);
  });
});
