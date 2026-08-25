import { GfxBlockComponent } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { overlayScale, toOverlayCoord } from '../../utils/dom/viewport.js';

/**
 * Overlays drawn over the canvas — the selection rectangle, the resize handles,
 * the remote cursors, the text editors mounted on an element — have to land on
 * the block they decorate. `GfxBlockComponent.getCSSTransform` is where a block
 * states its own placement, so it is the reference these helpers must agree
 * with, `viewScale` included (upstream #14862, on top of #14074).
 */
type FakeViewport = {
  viewportX: number;
  viewportY: number;
  zoom: number;
  viewScale: number;
};

/** Where a gfx block ends up, in the CSS pixels of the edgeless container. */
function blockCssPosition(
  viewport: FakeViewport,
  x: number,
  y: number
): [number, number] {
  const transform = GfxBlockComponent.prototype.getCSSTransform.call({
    gfx: {
      viewport: {
        ...viewport,
        translateX: -viewport.viewportX * viewport.zoom,
        translateY: -viewport.viewportY * viewport.zoom,
      },
    },
    model: { xywh: `[${x},${y},100,50]` },
  } as never);

  const [translateX, translateY] = /translate\(([^)]+)\)/
    .exec(transform)![1]
    .split(',')
    .map(part => Number.parseFloat(part));

  // The element is laid out at its model position and moved by the transform.
  return [x + translateX, y + translateY];
}

/** The scale the same block wears. */
function blockCssScale(viewport: FakeViewport) {
  const transform = GfxBlockComponent.prototype.getCSSTransform.call({
    gfx: {
      viewport: { ...viewport, translateX: 0, translateY: 0 },
    },
    model: { xywh: '[0,0,100,50]' },
  } as never);

  return Number.parseFloat(/scale\(([^)]+)\)/.exec(transform)![1]);
}

describe('toOverlayCoord', () => {
  test('maps a model point to the container pixels of an unscaled host', () => {
    const viewport = { viewportX: 100, viewportY: 50, zoom: 2, viewScale: 1 };
    expect(toOverlayCoord(viewport, 150, 100)).toEqual([100, 100]);
  });

  test('states the placement in the scaled space of a scaled host', () => {
    const viewport = { viewportX: 100, viewportY: 50, zoom: 2, viewScale: 4 };
    expect(toOverlayCoord(viewport, 150, 100)).toEqual([25, 25]);
  });

  test('lands exactly where the block it decorates is drawn', () => {
    for (const viewScale of [1, 0.5, 4]) {
      const viewport = {
        viewportX: -320,
        viewportY: 87.5,
        zoom: 0.75,
        viewScale,
      };

      for (const [x, y] of [
        [0, 0],
        [640, -120],
        [12.5, 33.25],
      ]) {
        const [overlayX, overlayY] = toOverlayCoord(viewport, x, y);
        const [blockX, blockY] = blockCssPosition(viewport, x, y);
        expect(overlayX).toBeCloseTo(blockX);
        expect(overlayY).toBeCloseTo(blockY);
      }
    }
  });
});

describe('overlayScale', () => {
  test('is the scale the decorated block itself wears', () => {
    for (const viewScale of [1, 0.5, 4]) {
      const viewport = { viewportX: 0, viewportY: 0, zoom: 1.5, viewScale };
      expect(overlayScale(viewport)).toBeCloseTo(blockCssScale(viewport));
    }
  });
});
