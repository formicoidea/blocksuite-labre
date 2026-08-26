import { describe, expect, it } from 'vitest';

import {
  GfxBlockComponent,
  toGfxBlockComponent,
} from '../../view/element/gfx-block-component.js';

/**
 * The CSS transform of a gfx block, upstream #14074.
 *
 * A block painted on the canvas is placed by a `translate`/`scale` computed
 * from the viewport. When the whole editor lives inside a container the host
 * has scaled — an embedded edgeless doc at a zoom other than 1 — that container
 * scales the block a second time, so the translation has to be expressed in the
 * container's own (already scaled) space. `viewScale` is what the viewport
 * reports for that outer scale; leaving it out puts every non-canvas block
 * (notes, images, anything extending `GfxBlockComponent`) off its element and
 * away from the canvas elements it should sit beside.
 */

/** `getCSSTransform` reads the viewport and the model's bound, nothing else. */
function transformFor(options: {
  translate: [number, number];
  zoom: number;
  viewScale: number;
  bound: [number, number, number, number];
}) {
  const [translateX, translateY] = options.translate;
  const stub = {
    gfx: {
      viewport: {
        translateX,
        translateY,
        zoom: options.zoom,
        viewScale: options.viewScale,
      },
    },
    model: { xywh: `[${options.bound.join(',')}]` },
  };

  return GfxBlockComponent.prototype.getCSSTransform.call(
    stub as unknown as GfxBlockComponent
  );
}

describe('gfx block CSS transform', () => {
  it('places a block from the viewport when the host is not scaled', () => {
    const transform = transformFor({
      translate: [100, 50],
      zoom: 2,
      viewScale: 1,
      bound: [10, 20, 100, 100],
    });

    // x: 100 + (10 * 2 - 10) = 110, y: 50 + (20 * 2 - 20) = 70
    expect(transform).toBe('translate(110px, 70px) scale(2)');
  });

  it('states the placement in the scaled space of a scaled host', () => {
    const transform = transformFor({
      translate: [100, 50],
      zoom: 2,
      viewScale: 4,
      bound: [10, 20, 100, 100],
    });

    // Everything the container will scale by 4 is stated at a quarter of its
    // unscaled value: x: 100/4 + (10*2)/4 - 10 = 20, y: 50/4 + (20*2)/4 - 20 = 2.5.
    expect(transform).toBe('translate(20px, 2.5px) scale(0.5)');
  });

  it('gives a converted block the same transform as a native one', () => {
    class Base {
      declare gfx: unknown;
      declare model: unknown;
    }
    const Converted = toGfxBlockComponent(
      Base as unknown as Parameters<typeof toGfxBlockComponent>[0]
    ) as unknown as { prototype: { getCSSTransform: () => string } };
    const stub = {
      gfx: {
        viewport: { translateX: 100, translateY: 50, zoom: 2, viewScale: 4 },
      },
      model: { xywh: '[10,20,100,100]' },
    };

    expect(Converted.prototype.getCSSTransform.call(stub as never)).toBe(
      'translate(20px, 2.5px) scale(0.5)'
    );
  });
});
