import type { WardleyNodeElementModel } from '@labre/affine-model';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { wardleyNode } from '../node/node-renderer';
import { recordingCtx, stubMatrix } from './canvas-stub';

/**
 * The circle under a Wardley node is the native shape renderer's (and its own
 * tests'); what this file is about is the glyph layer drawn on top of it.
 *
 * So `shape` is stubbed to a no-op and every operation the recorder sees is one
 * this renderer made.
 */

vi.mock('@labre/affine-gfx-shape', () => ({ shape: vi.fn() }));

/** The model fields the glyph layer reads, and nothing else. */
function nodeModel(
  kind: string,
  size: { w: number; h: number },
  strokeWidth = 4
): WardleyNodeElementModel {
  return {
    kind,
    rotate: 0,
    deserializedXYWH: [0, 0, size.w, size.h],
    strokeColor: '#111111',
    strokeWidth,
  } as unknown as WardleyNodeElementModel;
}

const rendererStub = {
  getColorValue: (color: string) => color,
} as unknown as Parameters<typeof wardleyNode>[3];

beforeAll(() => {
  // The renderer composes its own element-local frame with `DOMMatrix`, which
  // it reads at draw time — so replacing it here is early enough.
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = {
    fromMatrix: () => stubMatrix(),
  };
});

/** The three kinds that carry a glyph. */
const GLYPHS = ['anchor', 'method', 'ecosystem'] as const;

/**
 * A node dragged to nothing.
 *
 * The resize manager takes the absolute value of the dragged extents but sets
 * NO minimum size, and every radius of the glyph is a fraction of
 * `min(w, h) / 2 - strokeWidth / 2` — which goes NEGATIVE on a node smaller
 * than its own border, and lands exactly on ZERO when the two agree. `arc`
 * throws `IndexSizeError` on a negative radius rather than clamping, and since
 * the surface render loop wraps no renderer in a `try`, one such throw aborts
 * the rest of the frame and leaves the save stack unbalanced. Zero is worse
 * still: the ecosystem's hatch step is a fraction of the same radius, so its
 * loop would never advance.
 *
 * The stub throws the same way the browser does, so this is the real invariant
 * and not a paraphrase of it.
 */
describe('a Wardley node with no room for its glyph', () => {
  it('survives every degenerate size without asking for a negative radius', () => {
    const sizes = [
      { w: 0, h: 0 },
      { w: 1, h: 1 },
      { w: 1, h: 40 },
      { w: 40, h: 1 },
      // The node and its own border, to the unit: the radius is exactly 0.
      { w: 4, h: 4 },
    ];
    for (const kind of GLYPHS) {
      for (const size of sizes) {
        const rec = recordingCtx();
        const where = `${kind} ${size.w}x${size.h}`;
        expect(
          () =>
            wardleyNode(
              nodeModel(kind, size),
              rec.ctx,
              stubMatrix(),
              rendererStub,
              null as never,
              null as never
            ),
          where
        ).not.toThrow();
        for (const curve of rec.curves) {
          expect(curve.r, where).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('still draws the glyph as soon as there is room for one', () => {
    const rec = recordingCtx();
    wardleyNode(
      nodeModel('method', { w: 48, h: 40 }),
      rec.ctx,
      stubMatrix(),
      rendererStub,
      null as never,
      null as never
    );
    expect(rec.curves).toHaveLength(1);
    expect(rec.curves[0].r).toBeGreaterThan(0);
  });
});
