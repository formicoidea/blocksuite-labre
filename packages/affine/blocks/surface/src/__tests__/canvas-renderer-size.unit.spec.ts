import type { SurfaceBlockModel, Viewport } from '@labre/std/gfx';
import type { BlockStdScope } from '@labre/std';
import { signal } from '@preact/signals-core';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { CanvasRenderer } from '../renderer/canvas-renderer.js';

/**
 * The size of the surface canvas, upstream #14015.
 *
 * A surface can live inside a container the host itself has scaled — an
 * embedded edgeless doc drawn at a zoom other than 1 is the everyday case. The
 * viewport reports that outer scale as `viewScale`, and its `width`/`height`
 * come from `getBoundingClientRect()`, so they are already multiplied by it.
 * Sizing the canvas from those numbers and then letting the container scale it
 * a second time makes the canvas overflow (or under-fill) its own block: the
 * frameworks painted on it — Wardley, EDGY, DDD, Cynefin — end up drawn past
 * the block's edge. The canvas therefore carries the inverse scale itself, so
 * every drawing operation stays in the surface's own coordinate space.
 */

/** The construction path of `CanvasRenderer` only touches these members. */
function rendererFor(viewport: { viewScale: number }) {
  const fakeViewport = {
    width: 800,
    height: 600,
    viewScale: viewport.viewScale,
    viewportUpdated: new Subject(),
    sizeUpdated: new Subject(),
    zooming$: new Subject<boolean>(),
  } as unknown as Viewport;

  const fakeSurface = {
    elementAdded: new Subject(),
    elementRemoved: new Subject(),
    elementUpdated: new Subject(),
    localElementAdded: new Subject(),
    localElementDeleted: new Subject(),
    localElementUpdated: new Subject(),
  } as unknown as SurfaceBlockModel;

  // The renderer resolves the gfx controller to watch the drag signal, which
  // tells it when a stacking canvas may stop growing with the dragged element.
  const fakeStd = {
    get: () => ({ tool: { dragging$: signal(false) } }),
  } as unknown as BlockStdScope;

  return new CanvasRenderer({
    std: fakeStd,
    viewport: fakeViewport,
    layerManager: { layers: [], getCanvasLayers: () => [] } as never,
    gridManager: {} as never,
    surfaceModel: fakeSurface,
  });
}

/**
 * `attach` sizes the canvas once against a container that is deliberately left
 * out of the document, so the refresh frame it schedules never paints.
 */
function attachedCanvas(viewScale: number) {
  const renderer = rendererFor({ viewScale });
  renderer.attach(document.createElement('div'));
  return renderer.canvas;
}

describe('surface canvas size', () => {
  it('keeps the CSS size the viewport reports', () => {
    const canvas = attachedCanvas(1);

    expect(canvas.style.width).toBe('800px');
    expect(canvas.style.height).toBe('600px');
  });

  it('undoes the container scale a scaled host applies to it', () => {
    const canvas = attachedCanvas(2);

    expect(canvas.style.transform).toBe('scale(0.5)');
    // The browser reports the origin in its own normalized order.
    expect(canvas.style.transformOrigin).toBe('left top');
  });

  it('leaves an unscaled host at its own scale', () => {
    const canvas = attachedCanvas(1);

    expect(canvas.style.transform).toBe('scale(1)');
  });
});
