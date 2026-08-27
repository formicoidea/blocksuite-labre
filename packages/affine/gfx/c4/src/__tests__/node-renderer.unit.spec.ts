import type { C4NodeElementModel, C4NodeKind } from '@labre/affine-model';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { NODE_SIZE } from '../consts';
import { c4Node } from '../node/node-renderer';
import { recordingCtx, stubMatrix } from './canvas-stub';

/**
 * The native shape body is somebody else's renderer (and its own tests): what
 * this file is about is the GLYPH layer on top of it — the four silhouettes a
 * rounded rectangle cannot be, and the two bands painted over one.
 *
 * So `shape` is stubbed to a no-op and every operation the recorder sees is one
 * this renderer made. The assertions are about WHAT was drawn — how many
 * straight runs, how many round ones, what was filled and in which of the
 * model's two (editable) colours — rather than about coordinates, which are a
 * matter of taste and would make every nudge to a glyph a test failure.
 */

vi.mock('@labre/affine-gfx-shape', () => ({ shape: vi.fn() }));

const STROKE = '#2e6295';
const FILL = '#438dd5';

/** The model fields the glyph layer reads, and nothing else. */
function nodeModel(
  kind: C4NodeKind,
  rotate = 0,
  size: { w: number; h: number } = NODE_SIZE[kind]
): C4NodeElementModel {
  return {
    kind,
    rotate,
    deserializedXYWH: [0, 0, size.w, size.h],
    strokeColor: STROKE,
    fillColor: FILL,
    strokeWidth: 2,
  } as unknown as C4NodeElementModel;
}

/** A canvas renderer, reduced to the one method the glyph layer calls. */
const rendererStub = {
  getColorValue: (color: string) => color,
} as unknown as Parameters<typeof c4Node>[3];

beforeAll(() => {
  // The renderer composes its own element-local frame with `DOMMatrix`, which
  // the DOM stub does not carry a usable one of. Read at draw time, never at
  // import time, so replacing it here is early enough.
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = {
    fromMatrix: () => stubMatrix(),
  };
});

let rec: ReturnType<typeof recordingCtx>;

beforeEach(() => {
  rec = recordingCtx();
});

/** Draw one kind and hand back what the canvas saw. */
function draw(kind: C4NodeKind, rotate = 0, size?: { w: number; h: number }) {
  c4Node(
    nodeModel(kind, rotate, size),
    rec.ctx,
    stubMatrix(),
    rendererStub,
    // roughjs canvas and bounds: the glyph layer passes them straight through
    // to the (stubbed) shape renderer and never touches them.
    null as never,
    null as never
  );
  return rec;
}

const ALL_KINDS = [
  'person',
  'person-ext',
  'system',
  'system-ext',
  'container',
  'database',
  'mobile',
  'browser',
  'component',
] as const satisfies readonly C4NodeKind[];

/**
 * The kinds C4 draws BARE — a plain rounded rectangle and nothing on it.
 *
 * Four of the nine, which is the pack's whole shape: three of C4's four levels
 * are the same box, and what tells them apart is the COLOUR they are created in
 * plus the role stamped on them. A glyph here would be inventing a notation.
 */
const BARE = ['system', 'system-ext', 'container', 'component'] as const;

describe('the C4 node glyph layer', () => {
  it('draws on every silhouette kind and on no other', () => {
    for (const kind of ALL_KINDS) {
      rec = recordingCtx();
      const { ops } = draw(kind);
      const expected = !(BARE as readonly string[]).includes(kind);
      expect(ops.length > 0, kind).toBe(expected);
    }
  });

  /**
   * An element can be dragged to nothing. The resize manager takes the absolute
   * value of the dragged extents but sets NO minimum size, so every glyph here
   * has to survive a node smaller than its own border — and `arc` / `ellipse`
   * throw `IndexSizeError` on a negative radius rather than clamping. Since the
   * surface render loop wraps no renderer in a `try`, one such throw does not
   * lose a shape: it aborts the rest of the frame and leaves the save stack
   * unbalanced.
   *
   * The stub throws the same way the browser does, so this is the real
   * invariant and not a paraphrase of it.
   */
  it('survives every degenerate size without asking for a negative radius', () => {
    const sizes = [
      { w: 1, h: 1 },
      { w: 2, h: 2 },
      { w: 1, h: 40 },
      { w: 40, h: 1 },
      { w: 0, h: 0 },
    ];
    for (const kind of ALL_KINDS) {
      for (const size of sizes) {
        rec = recordingCtx();
        const where = `${kind} ${size.w}x${size.h}`;
        expect(() => draw(kind, 0, size), where).not.toThrow();
        for (const curve of rec.curves) {
          expect(curve.rx, where).toBeGreaterThanOrEqual(0);
          expect(curve.ry, where).toBeGreaterThanOrEqual(0);
        }
        for (const rect of rec.rects) {
          expect(rect.w, where).toBeGreaterThanOrEqual(0);
          expect(rect.h, where).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('draws every outline in the node’s own stroke colour', () => {
    for (const kind of ALL_KINDS) {
      rec = recordingCtx();
      const { strokes } = draw(kind);
      for (const stroke of strokes) expect(stroke, kind).toBe(STROKE);
    }
  });

  it('sets up the element-local frame, rotation included', () => {
    const { transform } = draw('database', 45);
    const { w, h } = NODE_SIZE.database;
    expect(transform).toEqual([
      ['translate', w / 2, h / 2],
      ['rotate', 45],
      ['translate', -w / 2, -h / 2],
    ]);
  });

  it('draws both people as a head sitting on a body block', () => {
    for (const kind of ['person', 'person-ext'] as const) {
      rec = recordingCtx();
      const { curves, ops, fills } = draw(kind);
      // One round head...
      expect(curves, kind).toHaveLength(1);
      expect(curves[0].rx, kind).toBe(curves[0].ry);
      // ...and the head goes FIRST, so the body covers its lower arc: what is
      // left is a head on a pair of shoulders. Both are filled AND outlined,
      // because the silhouette is the glyph's own — the native rect under it
      // paints nothing.
      expect(ops, kind).toEqual(['fill', 'stroke', 'fill', 'stroke']);
      expect(fills, kind).toEqual([FILL, FILL]);
      // The head is centred, and in the upper half.
      const { w, h } = NODE_SIZE[kind];
      expect(curves[0].x, kind).toBe(w / 2);
      expect(curves[0].y, kind).toBeLessThan(h / 2);
    }
    // The external person is drawn identically — only its colours differ, and
    // those are the model's.
    rec = recordingCtx();
    const person = draw('person').curves;
    rec = recordingCtx();
    expect(draw('person-ext').curves).toEqual(person);
  });

  it('draws the database as a filled cylinder with a visible lid', () => {
    const { curves, fills, ops } = draw('database');
    // Floor, front of the lid, and the lid's own far edge.
    expect(curves).toHaveLength(3);
    for (const curve of curves) expect(curve.rx).toBeGreaterThan(curve.ry);
    expect(fills).toEqual([FILL]);
    expect(ops).toEqual(['fill', 'stroke', 'stroke']);
  });

  it('gives the mobile app a bezel down its leading edge', () => {
    const { rects, curves, ops } = draw('mobile');
    expect(ops).toEqual(['fillRect']);
    expect(curves).toHaveLength(0);
    expect(rects).toHaveLength(1);

    const [band] = rects;
    const { w, h } = NODE_SIZE.mobile;
    // A strip, not a block: taller than it is wide, on the left edge, and held
    // clear of the body's rounded corners.
    expect(band.h).toBeGreaterThan(band.w);
    expect(band.x).toBeLessThan(w / 4);
    expect(band.y).toBeGreaterThan(0);
    expect(band.y + band.h).toBeLessThan(h);
    // Painted in the node's darker colour, so it reads as part of the frame.
    expect(band.fill).toBe(STROKE);
  });

  it('gives the web app a chrome band with three dots in it', () => {
    const { rects, curves, ops } = draw('browser');
    expect(rects).toHaveLength(1);
    expect(curves).toHaveLength(3);
    expect(ops).toEqual(['fillRect', 'fill', 'fill', 'fill']);

    const [band] = rects;
    const { w, h } = NODE_SIZE.browser;
    // A band, not a bezel: wider than it is tall, across the top.
    expect(band.w).toBeGreaterThan(band.h);
    expect(band.y).toBeLessThan(h / 4);
    expect(band.fill).toBe(STROKE);

    // The dots sit inside the band, in the node's own fill so they read as
    // holes in the chrome rather than as three more elements.
    for (const dot of curves) {
      expect(dot.rx).toBe(dot.ry);
      expect(dot.rx).toBeGreaterThan(0);
      expect(dot.y).toBeGreaterThan(band.y);
      expect(dot.y).toBeLessThan(band.y + band.h);
      expect(dot.x).toBeLessThan(w / 2);
    }
  });
});
