import {
  backgroundLabelHits,
  backgroundSize,
} from '@labre/affine-block-surface';
import { describe, expect, it } from 'vitest';

import { BPMN_POOL_BACKGROUND } from '../background';
import { bpmnPool } from '../element-renderer';
import { BPMN_ROLE } from '../roles';
import { recordingCtx, stubMatrix } from './canvas-stub';

/**
 * The BPMN pool, reimplemented on the framework-background primitive, with NO
 * regression.
 *
 * The old imperative renderer is gone, so it cannot be diffed against. What
 * proves the absence of regression is this file: every coordinate below is the
 * LITERAL the deleted ninety-line `element-renderer.ts` produced, read off it
 * operation by operation and never recomputed from the declaration under test.
 * Change the declaration and these fail; change both and the review sees a
 * deliberate visual change.
 *
 * ## What the old renderer did, in order
 *
 * ```
 * band = min(28, w); inset = 1.5 / 2
 * fillStyle = '#f4f4f5';  fillRect(0, 0, band, h)
 * strokeStyle = '#262626'; lineWidth = 1.5; lineJoin = 'round'
 * roundedRect(inset, inset, w - 1.5, h - 1.5, 6); stroke()
 * moveTo(band, 0); lineTo(band, h); stroke()
 * if (name && band > 12):
 *   translate(band / 2, h / 2); rotate(-90°)
 *   fillStyle = '#262626'; font = '600 15px Inter, sans-serif'
 *   textAlign = 'center'; textBaseline = 'middle'; fillText(name, 0, 0)
 * ```
 *
 * ## The four knowing differences
 *
 * 1. **the card is now filled white**, where the old renderer left it
 *    transparent. The only one of the four that is VISIBLE, and the only one
 *    that is a decision rather than a consequence: taken by the PO at the
 *    red-zone review of 26/08/2026, on the ground that a pool is a map
 *    background and every map background paints an opaque card. A pool dropped
 *    over existing strokes now covers them — which is what a Wardley map
 *    dropped over them has always done;
 * 2. the band divider is now stroked BEFORE the frame instead of after. Same
 *    colour, same width, and they meet at two points on a rounded corner-free
 *    edge — nothing on the canvas can tell;
 * 3. `lineJoin = 'round'` is no longer set. The path is a rounded rectangle
 *    whose only joins are tangent to its arcs, and the divider is one straight
 *    segment: the property had nothing to act on;
 * 4. the participant name is no longer HIDDEN on a pool narrower than twelve
 *    model units. A pool that narrow is smaller than one character of its own
 *    name, and the primitive has no vocabulary for "give up below this size" —
 *    the band itself still clamps to the element, as it always did.
 */

const W = 560;
const H = 200;

function pool(over: Record<string, unknown> = {}) {
  return {
    deserializedXYWH: [0, 0, W, H],
    rotate: 0,
    name: 'Customer',
    resizeEnabled: true,
    ...over,
  };
}

const render = (model: Record<string, unknown>) => {
  const rec = recordingCtx();
  (bpmnPool as unknown as (m: unknown, c: unknown, x: unknown) => void)(
    model,
    rec.ctx,
    stubMatrix()
  );
  return rec;
};

describe('the BPMN pool declaration', () => {
  it('declares the geometry a fresh pool is created at', () => {
    expect(BPMN_POOL_BACKGROUND.geometry).toEqual({
      width: 560,
      height: 200,
      lockAspectRatio: false,
      resizable: true,
      margin: { top: 0, right: 0, bottom: 0, left: 28 },
    });
  });

  it('creates every pool at that size, whatever is already on the board', () => {
    // Unlike a map, a pool is NOT grown to cover its neighbours: lanes sit side
    // by side, and `actions.ts` still writes 560 × 200 by hand.
    expect(backgroundSize(BPMN_POOL_BACKGROUND)).toEqual({
      width: 560,
      height: 200,
    });
  });

  it('stamps the pool role, so rules can frame against it', () => {
    expect(BPMN_POOL_BACKGROUND.type).toBe('bpmnPool');
    // The literal, not the constant: this is the value a document carries, and
    // the creation site stamps the same one from the same vocabulary.
    expect(BPMN_POOL_BACKGROUND.role).toBe('bpmn:pool');
    expect(BPMN_POOL_BACKGROUND.role).toBe(BPMN_ROLE.pool);
  });

  it('declares no frame of reference at all', () => {
    // A pool is a participant, not a chart: position inside the lane means
    // nothing, and an axis here would invent a semantic BPMN puts on the flows.
    expect(BPMN_POOL_BACKGROUND.axes).toBeUndefined();
    expect(BPMN_POOL_BACKGROUND.zones).toBeUndefined();
    expect(BPMN_POOL_BACKGROUND.chrome?.washes).toBeUndefined();
  });

  it('offers the participant name for in-place editing, and nothing else', () => {
    const hits = backgroundLabelHits(BPMN_POOL_BACKGROUND, pool(), W, H);
    expect(hits.map(h => [h.id, h.prop, h.text])).toEqual([
      ['name', 'name', 'Customer'],
    ]);
  });
});

describe('the pool the primitive paints', () => {
  it('paints the frame the old renderer painted', () => {
    const rec = render(pool());

    // The rounded rectangle, inset by half the frame width so the stroke sits
    // inside the element box: (0.75, 0.75, 558.5, 198.5), radius 6.
    expect(rec.paths).toEqual([
      { x: 0.75, y: 0.75, w: 558.5, h: 198.5, r: 6 },
      // Traced twice: the divider resets the current path between the two.
      { x: 0.75, y: 0.75, w: 558.5, h: 198.5, r: 6 },
    ]);
    expect(rec.strokes).toEqual(['#262626', '#262626']);
  });

  it('fills the card white, like every other framework background', () => {
    // Knowing difference 1, and the only visible one: the old renderer left the
    // pool transparent. The PO settled it the other way at the red-zone review
    // of 26/08/2026 — a pool IS a map background, so it paints a card.
    expect(render(pool()).fills).toEqual(['#ffffff']);
  });

  it('paints the name band and its divider where they have always been', () => {
    const rec = render(pool());

    expect(rec.rects).toEqual([{ x: 0, y: 0, w: 28, h: 200, fill: '#f4f4f5' }]);
    expect(rec.segments).toEqual([{ x1: 28, y1: 0, x2: 28, y2: 200 }]);
    expect(rec.dashes).toEqual([]);
  });

  it('writes the participant name up the middle of the band', () => {
    const rec = render(pool());

    // Operation for operation what the old renderer emitted: the origin of a
    // frame translated to the middle of the band and rotated a quarter turn.
    expect(rec.texts).toEqual([
      {
        text: 'Customer',
        x: 14,
        y: 100,
        font: '600 15px Inter, sans-serif',
        align: 'center',
        baseline: 'middle',
        color: '#262626',
        vertical: true,
      },
    ]);
  });

  it('paints in the order a card is dressed: fill, band, divider, frame, name', () => {
    // The band is part of the CARD, so it goes over the fill and under the
    // frame — a band painted over the frame would erase the left edge and read
    // as a broken pool.
    expect(render(pool()).ops).toEqual([
      'fill',
      'fillRect',
      'stroke',
      'stroke',
      'fillText',
    ]);
  });

  it('rotates the whole pool around its centre, as it always did', () => {
    expect(render(pool({ rotate: 45 })).transform).toEqual([
      ['translate', 280, 100],
      ['rotate', 45],
      ['translate', -280, -100],
    ]);
  });

  it('writes nothing when the participant has no name', () => {
    const rec = render(pool({ name: '' }));
    expect(rec.texts).toEqual([]);
    // …and the pool is still a pool: frame, band and divider are all there.
    expect(rec.rects).toHaveLength(1);
    expect(rec.strokes).toHaveLength(2);
  });

  it('clamps the band to a pool narrower than the band itself', () => {
    const rec = render(pool({ deserializedXYWH: [0, 0, 8, 200] }));
    expect(rec.rects).toEqual([{ x: 0, y: 0, w: 8, h: 200, fill: '#f4f4f5' }]);
    expect(rec.segments).toEqual([{ x1: 8, y1: 0, x2: 8, y2: 200 }]);
    // Knowing difference 3, pinned rather than hidden: the old renderer gave up
    // on the name below twelve units, the declaration still writes it — at the
    // anchor the band would have had. A pool that narrow is degenerate either
    // way; nothing else about it changed.
    expect(rec.texts.map(t => [t.text, t.x])).toEqual([['Customer', 14]]);
  });

  it('keeps the furniture at a fixed size however far the lane is stretched', () => {
    // Ratios scale, model units do not: a pool three times as wide has the same
    // 28-unit band and the same 15px name.
    const rec = render(pool({ deserializedXYWH: [0, 0, 1680, 200] }));
    expect(rec.rects).toEqual([{ x: 0, y: 0, w: 28, h: 200, fill: '#f4f4f5' }]);
    expect(rec.texts[0].x).toBe(14);
    expect(rec.texts[0].font).toBe('600 15px Inter, sans-serif');
  });

  /**
   * The guard the lane work is answerable to: EVERY assertion above is written
   * for a pool with no `lanes` key, which is every pool in every document
   * authored before B4. The lane title bands are painted from the model, so a
   * pool that carries none must reach the identical op stream — this states it
   * once, against the whole recording rather than against one field of it, so
   * a later change to the lane chrome cannot quietly alter an undivided pool.
   */
  it('paints an undivided pool exactly as it did before lanes existed', () => {
    const withoutKey = render(pool());
    const withEmptyKey = render(pool({ lanes: [] }));
    const withMalformedKey = render(pool({ lanes: 'nonsense' }));

    for (const rec of [withEmptyKey, withMalformedKey]) {
      expect(rec.ops).toEqual(withoutKey.ops);
      expect(rec.rects).toEqual(withoutKey.rects);
      expect(rec.segments).toEqual(withoutKey.segments);
      expect(rec.texts).toEqual(withoutKey.texts);
      expect(rec.strokes).toEqual(withoutKey.strokes);
      expect(rec.paths).toEqual(withoutKey.paths);
      expect(rec.dashes).toEqual(withoutKey.dashes);
    }
  });

  it('adds the lane band, and only the lane band, once a pool is divided', () => {
    const plain = render(pool());
    const divided = render(
      pool({
        lanes: [
          { id: 'a', name: 'Front office', size: 1 },
          { id: 'b', name: 'Back office', size: 1 },
        ],
      })
    );

    // The card is dressed exactly as before — fill, band, band divider, frame —
    // and the lane furniture is added at the two stages that own it: the
    // separators with the zones, the strips and their names with the labels,
    // after the participant's own.
    expect(divided.ops).toEqual([
      'fill',
      'fillRect',
      'stroke', // the participant band's divider
      'stroke', // the frame
      'stroke', // the separator between the two lanes
      'fillText', // the participant name
      'stroke', // lane 0's title strip
      'fillText',
      'stroke', // lane 1's title strip
      'fillText',
    ]);
    expect(divided.rects).toEqual(plain.rects);
    // …and what is added is the lane furniture: one separator between the two
    // lanes, plus one rule down each lane's own title strip.
    expect(divided.segments.slice(0, plain.segments.length)).toEqual(
      plain.segments
    );
    expect(divided.segments.slice(plain.segments.length)).toEqual([
      { x1: 28, y1: 100, x2: 560, y2: 100 },
      { x1: 52, y1: 0, x2: 52, y2: 100 },
      { x1: 52, y1: 100, x2: 52, y2: 200 },
    ]);

    // The two lane names, turned on their side and centred in their strips —
    // 28 (the participant band) + 24 / 2.
    expect(
      divided.texts.slice(1).map(t => [t.text, t.x, t.y, t.vertical])
    ).toEqual([
      ['Front office', 40, 50, true],
      ['Back office', 40, 150, true],
    ]);
  });
});
