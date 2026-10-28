import type { WardleyNodeElementModel } from '@labre/affine-model';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import {
  WARDLEY_METHOD,
  WARDLEY_METHOD_TAG_ID,
  WARDLEY_NATURE,
  WARDLEY_NATURE_TAG_ID,
} from '../natures';
import { METHOD_FAMILY_COLOR, NODE_FILL } from '../node/consts';
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

/**
 * A method node's ring follows its `wardley:method` tag (ADR 0046): the
 * family's hue on the line, the phase in the fill. What these pin is the
 * contract both ways — a tagged node paints the method, and a node with no
 * method tag paints exactly what it painted before the tag existed, so every
 * map drawn with the "colour = phase" palette keeps its colours.
 */
describe('the ring of a component + method', () => {
  /** A method node carrying `tags`, on a real `Y.Doc` (see `natures`). */
  function methodNode(tags?: Record<string, string[]>) {
    const model = nodeModel('method', { w: 40, h: 40 }, 1) as unknown as {
      tags?: Y.Map<string[]>;
    };
    if (tags) {
      const doc = new Y.Doc();
      const map = doc.getMap('tags') as Y.Map<string[]>;
      doc.transact(() => {
        for (const [k, v] of Object.entries(tags)) map.set(k, v);
      });
      model.tags = map;
    }
    return model as unknown as WardleyNodeElementModel;
  }

  function paint(model: WardleyNodeElementModel) {
    const rec = recordingCtx();
    wardleyNode(
      model,
      rec.ctx,
      stubMatrix(),
      rendererStub,
      null as never,
      null as never
    );
    return rec;
  }

  it('without a method tag, paints only the inner component, as before', () => {
    const cases: Array<Record<string, string[]> | undefined> = [
      undefined,
      // A nature alone says nothing about the method.
      { [WARDLEY_NATURE_TAG_ID]: [WARDLEY_NATURE.activity] },
      // A value no pack of this version names: no colour is guessed.
      { [WARDLEY_METHOD_TAG_ID]: ['wardley:method/retired'] },
    ];
    for (const tags of cases) {
      const rec = paint(methodNode(tags));
      expect(rec.ellipses, JSON.stringify(tags)).toEqual([]);
      expect(rec.fills).toEqual([NODE_FILL]);
      expect(rec.strokes).toEqual(['#111111']);
    }
  });

  it('paints the ring over the native ellipse, on its own path', () => {
    const rec = paint(
      methodNode({ [WARDLEY_METHOD_TAG_ID]: [WARDLEY_METHOD.buy] })
    );
    // The shape renderer insets half a stroke: 40 wide, 1 thick → 19.5.
    expect(rec.ellipses).toEqual([{ x: 20, y: 20, rx: 19.5, ry: 19.5 }]);
  });

  it('an uncharted method is the family hue as an outline on the paper', () => {
    const rec = paint(
      methodNode({ [WARDLEY_METHOD_TAG_ID]: [WARDLEY_METHOD.build] })
    );
    // Paper under the ring, then the inner component's own paper.
    expect(rec.fills).toEqual([NODE_FILL, NODE_FILL]);
    expect(rec.strokes).toEqual([
      METHOD_FAMILY_COLOR['buying-policy'],
      '#111111',
    ]);
    expect(rec.lineWidths[0]).toBe(2);
  });

  it('a transitional method fills the ring at 40 %', () => {
    const rec = paint(
      methodNode({ [WARDLEY_METHOD_TAG_ID]: [WARDLEY_METHOD.lean] })
    );
    const hue = METHOD_FAMILY_COLOR['project-management'];
    expect(rec.fills).toEqual([NODE_FILL, `${hue}66`, NODE_FILL]);
    expect(rec.strokes[0]).toBe(hue);
    expect(rec.lineWidths[0]).toBe(1.5);
  });

  it('an industrialized method fills the ring in full', () => {
    const rec = paint(
      methodNode({ [WARDLEY_METHOD_TAG_ID]: [WARDLEY_METHOD.townPlanners] })
    );
    const hue = METHOD_FAMILY_COLOR.attitudes;
    expect(rec.fills).toEqual([NODE_FILL, hue, NODE_FILL]);
    expect(rec.strokes[0]).toBe(hue);
  });

  it('never paints the ring thinner than the rim of the node', () => {
    const model = methodNode({ [WARDLEY_METHOD_TAG_ID]: [WARDLEY_METHOD.buy] });
    (model as unknown as { strokeWidth: number }).strokeWidth = 3;
    expect(paint(model).lineWidths[0]).toBe(3);
  });
});
