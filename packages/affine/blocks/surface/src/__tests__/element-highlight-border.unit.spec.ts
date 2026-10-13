/**
 * The selection pane's hover emphasis is the canvas's existing border, square
 * on the element's bounds, never a detached rounded ring with a gap (product
 * owner, P1 recette). This spec would have caught the 4px-gap, 4px-radius ring
 * the overlay first shipped with.
 */
import type { GfxController } from '@labre/std/gfx';
import { signal } from '@preact/signals-core';
import { describe, expect, test, vi } from 'vitest';

import { ElementHighlightOverlay } from '../renderer/element-highlight-overlay.js';

function fakeGfx(zoom: number) {
  return {
    std: { getOptional: () => null },
    viewport: { zoom },
    highlight: {
      highlighted$: signal(['a']),
      highlightedElements: [{ deserializedXYWH: [10, 20, 100, 50], rotate: 0 }],
    },
  } as unknown as GfxController;
}

function fakeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
  };
}

describe('element highlight border', () => {
  test('strokes the element bounds, square, with no gap', () => {
    const overlay = new ElementHighlightOverlay(fakeGfx(2));
    const ctx = fakeCtx();
    overlay.render(ctx as unknown as CanvasRenderingContext2D);
    expect(ctx.translate).toHaveBeenCalledWith(60, 45);
    expect(ctx.strokeRect).toHaveBeenCalledWith(-50, -25, 100, 50);
    expect(ctx.roundRect).not.toHaveBeenCalled();
    // 2 screen pixels whatever the zoom.
    expect(ctx.lineWidth).toBe(1);
    overlay.dispose();
  });
});
