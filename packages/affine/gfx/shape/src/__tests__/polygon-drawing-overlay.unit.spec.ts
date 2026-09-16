import type { GfxController } from '@labre/std/gfx';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { PolygonDrawingOverlay } from '../overlay/polygon-drawing-overlay.js';

/**
 * What the polygon preview paints BEFORE the first corner exists.
 *
 * Arming the tool — from the toolbar, from a framework's senior menu or from
 * the catalogue — leaves the canvas untouched until the first click, so the
 * only thing that can say "the board is waiting for a vertex" is a marker at
 * the pointer. The PO's recette of 16/09/2026 caught its absence.
 */

const STROKE = '#123456';

/** A canvas context reduced to the arcs it is asked to draw, in order. */
function recordingCtx() {
  const arcs: Array<{ x: number; y: number; r: number }> = [];

  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn((x: number, y: number, r: number) => {
      arcs.push({ x, y, r });
    }),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
  };

  return { ctx: ctx as unknown as CanvasRenderingContext2D, arcs };
}

/** The GfxController members `ToolOverlay` and this renderer actually touch. */
function fakeGfx(zoom = 1) {
  return {
    viewport: {
      zoom,
      viewportUpdated: new Subject<never>(),
      toModelCoord: (x: number, y: number) => [x, y],
    },
    tool: { lastMouseViewPos$: { value: { x: 0, y: 0 } } },
  } as unknown as GfxController;
}

function overlay(zoom = 1) {
  return new PolygonDrawingOverlay(fakeGfx(zoom), {
    strokeColor: STROKE,
    fillColor: '#abcdef',
  });
}

describe('the armed polygon tool, before any vertex is placed', () => {
  it('marks the next vertex at the pointer', () => {
    const { ctx, arcs } = recordingCtx();
    const o = overlay();
    // Exactly the state a pointer move over an armed, untouched tool leaves.
    o.cursorPos = [120, 80];

    o.render(ctx, null as never);

    expect(arcs).toEqual([
      { x: 120, y: 80, r: 4 },
      { x: 120, y: 80, r: 8 },
    ]);
    expect(ctx.strokeStyle).toBe(STROKE);
  });

  it('paints nothing while the pointer is off the canvas', () => {
    const { ctx, arcs } = recordingCtx();
    const o = overlay();
    // `pointerOut` never gave the overlay a position, or the tool was just
    // armed: a marker with nowhere to sit must not be invented at the origin.
    o.cursorPos = null;

    o.render(ctx, null as never);

    expect(arcs).toEqual([]);
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('keeps the ring the same size on screen at any zoom', () => {
    const { ctx, arcs } = recordingCtx();
    const o = overlay(2);
    o.cursorPos = [10, 10];

    o.render(ctx, null as never);

    expect(arcs[1].r).toBe(4);
  });

  it('gives way to the outline once a corner is placed', () => {
    const { ctx, arcs } = recordingCtx();
    const o = overlay();
    o.vertices = [[0, 0]];
    o.cursorPos = [50, 50];
    o.isDrawing = true;

    o.render(ctx, null as never);

    // The one placed vertex, and no hint at the cursor competing with the
    // rubber band that now points at it.
    expect(arcs).toEqual([{ x: 0, y: 0, r: 4 }]);
  });
});
