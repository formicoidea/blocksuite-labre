import { describe, expect, it, vi } from 'vitest';

import type {
  BackgroundInstanceZonesDef,
  FrameworkBackgroundDef,
} from '../framework-background/index.js';
import {
  backgroundInstanceZones,
  backgroundLabelHits,
  createFrameworkBackgroundRenderer,
} from '../framework-background/index.js';

/**
 * Zones an INSTANCE declares (PF2.1, tranche B3).
 *
 * The declared zones of `framework-background.unit.spec.ts` are the framework's
 * and identical on every element of it. These are the user's own partition of
 * their own frame — the BPMN pool's lanes, arriving next tranche — and the
 * contract this file pins down is threefold: sizes are WEIGHTS and nothing else,
 * a malformed row costs one band and never the frame, and a declaration that
 * says nothing about instance zones paints exactly what it painted before.
 */

/* -------------------------------------------------------------------------- */
/* Harness                                                                     */
/* -------------------------------------------------------------------------- */

function stub() {
  const segments: Array<[number, number, number, number]> = [];
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  const texts: Array<{
    text: string;
    x: number;
    y: number;
    font: string;
    align: string;
    baseline: string;
    color: string;
  }> = [];
  const dashes: number[][] = [];
  const strokes: Array<[string, number]> = [];
  /** Every painting operation, in order — paint ORDER is a contract too. */
  const ops: string[] = [];
  let mx = 0;
  let my = 0;

  const ctx = {
    fillStyle: '' as string,
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn((x: number, y: number) => {
      mx = x;
      my = y;
    }),
    lineTo: vi.fn((x: number, y: number) => {
      segments.push([mx, my, x, y]);
      mx = x;
      my = y;
    }),
    arcTo: vi.fn(),
    fill: vi.fn(() => ops.push('fill')),
    stroke: vi.fn(() => {
      ops.push('stroke');
      strokes.push([ctx.strokeStyle, ctx.lineWidth]);
    }),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      ops.push('fillRect');
      rects.push({ x, y, w, h });
    }),
    setLineDash: vi.fn((d: number[]) => {
      if (d.length) dashes.push(d);
    }),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number) => {
      ops.push('fillText');
      texts.push({
        text,
        x,
        y,
        font: ctx.font,
        align: ctx.textAlign,
        baseline: ctx.textBaseline,
        color: ctx.fillStyle,
      });
    }),
    createLinearGradient: vi.fn(() => ({ addColorStop: () => {} })),
  };

  return { ctx, segments, rects, texts, dashes, strokes, ops };
}

const matrix = () => {
  const m = { translateSelf: () => m, rotateSelf: () => m };
  return m as unknown as DOMMatrix;
};

function paint(
  def: FrameworkBackgroundDef,
  model: Record<string, unknown> = {},
  w = 400,
  h = 300
) {
  const rec = stub();
  const render = createFrameworkBackgroundRenderer(def) as unknown as (
    m: unknown,
    c: unknown,
    x: unknown
  ) => void;
  render(
    { deserializedXYWH: [0, 0, w, h], rotate: 0, ...model },
    rec.ctx,
    matrix()
  );
  return rec;
}

/** A plot of 400 × 300 offset by (20, 10): every ratio below is exact. */
const geometry = {
  width: 440,
  height: 320,
  lockAspectRatio: false,
  resizable: true,
  margin: { top: 10, right: 20, bottom: 10, left: 20 },
};

const LABEL_STYLE = { size: 13, color: '#262626', weight: 600 };

const LANES: BackgroundInstanceZonesDef = {
  prop: 'lanes',
  stack: 'y',
  idPrefix: 'lane',
  divider: { color: '#262626', width: 1.5 },
  label: { style: LABEL_STYLE },
};

/** A framework whose instances partition their plot into horizontal bands. */
const BANDED: FrameworkBackgroundDef = {
  type: 'banded',
  geometry,
  instanceZones: LANES,
};

/** The same, stacked the other way. */
const COLUMNED: FrameworkBackgroundDef = {
  type: 'columned',
  geometry,
  instanceZones: { ...LANES, stack: 'x' },
};

/* -------------------------------------------------------------------------- */
/* The accessor                                                                */
/* -------------------------------------------------------------------------- */

describe('the zones an instance declares', () => {
  it('shares the plot in proportion to the weights, top to bottom', () => {
    const zones = backgroundInstanceZones(BANDED, {
      lanes: [
        { id: 'a', name: 'Sales', size: 1 },
        { id: 'b', name: 'Ops', size: 2 },
        { id: 'c', name: 'Legal', size: 1 },
      ],
    });

    expect(zones).toEqual([
      { id: 'lane:a', name: 'Sales', rect: { x: 0, y: 0, w: 1, h: 0.25 } },
      { id: 'lane:b', name: 'Ops', rect: { x: 0, y: 0.25, w: 1, h: 0.5 } },
      { id: 'lane:c', name: 'Legal', rect: { x: 0, y: 0.75, w: 1, h: 0.25 } },
    ]);
  });

  it('reads the weights as ratios of their sum, not as lengths', () => {
    // Ten times the numbers, the same partition: `2` means "twice the other
    // one" and never "two of something".
    const tenfold = backgroundInstanceZones(BANDED, {
      lanes: [
        { id: 'a', size: 10 },
        { id: 'b', size: 20 },
        { id: 'c', size: 10 },
      ],
    });
    expect(tenfold.map(z => z.rect.h)).toEqual([0.25, 0.5, 0.25]);
  });

  it('keeps the array order — a partition is a sequence, not a set', () => {
    const zones = backgroundInstanceZones(BANDED, {
      lanes: [
        { id: 'z', size: 1 },
        { id: 'a', size: 1 },
      ],
    });
    expect(zones.map(z => z.id)).toEqual(['lane:z', 'lane:a']);
  });

  it('gives a single zone the whole plot', () => {
    expect(
      backgroundInstanceZones(BANDED, { lanes: [{ id: 'only', size: 7 }] })
    ).toEqual([{ id: 'lane:only', rect: { x: 0, y: 0, w: 1, h: 1 } }]);
  });

  it('stacks the other way round on a `x` declaration', () => {
    const zones = backgroundInstanceZones(COLUMNED, {
      lanes: [
        { id: 'a', size: 1 },
        { id: 'b', size: 3 },
      ],
    });
    expect(zones).toEqual([
      { id: 'lane:a', rect: { x: 0, y: 0, w: 0.25, h: 1 } },
      { id: 'lane:b', rect: { x: 0.25, y: 0, w: 0.75, h: 1 } },
    ]);
  });

  it('namespaces the ids, so a lane cannot shadow a framework zone', () => {
    const zones = backgroundInstanceZones(
      { ...BANDED, zones: [{ id: 'early', rect: { x: 0, y: 0, w: 1, h: 1 } }] },
      { lanes: [{ id: 'early', size: 1 }] }
    );
    expect(zones.map(z => z.id)).toEqual(['lane:early']);
  });

  it('reports nothing at all for a framework that declares no partition', () => {
    const plain: FrameworkBackgroundDef = { type: 'plain', geometry };
    // Not even when the model happens to carry a prop by that name.
    expect(
      backgroundInstanceZones(plain, { lanes: [{ id: 'a', size: 1 }] })
    ).toEqual([]);
  });

  it('reports nothing for a missing, empty or malformed prop', () => {
    expect(backgroundInstanceZones(BANDED, {})).toEqual([]);
    expect(backgroundInstanceZones(BANDED, { lanes: [] })).toEqual([]);
    expect(backgroundInstanceZones(BANDED, { lanes: null })).toEqual([]);
    expect(backgroundInstanceZones(BANDED, { lanes: 'two' })).toEqual([]);
    expect(backgroundInstanceZones(BANDED, { lanes: { id: 'a' } })).toEqual([]);
  });

  it('drops an entry that is not a zone at all, quietly', () => {
    // No id, no zone: there is nothing to report it AS, and nothing to warn
    // about either — a half-written row is a row the user is still writing.
    const zones = backgroundInstanceZones(BANDED, {
      lanes: [null, 3, { size: 1 }, { id: '', size: 1 }, { id: 'a', size: 1 }],
    });
    expect(zones.map(z => z.id)).toEqual(['lane:a']);
  });

  it('drops a zone with no extent, and says so once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A distinct `type` per assertion: the warn-once set is module-wide, which
    // is the whole point of it — a renderer runs on every frame.
    const def = { ...BANDED, type: 'sized' };
    const model = {
      lanes: [
        { id: 'a', size: 1 },
        { id: 'zero', size: 0 },
        { id: 'negative', size: -2 },
        { id: 'nan', size: Number.NaN },
        { id: 'infinite', size: Number.POSITIVE_INFINITY },
        { id: 'wordy', size: '3' },
        { id: 'b', size: 1 },
      ],
    };

    const zones = backgroundInstanceZones(def, model);
    // The survivors share the whole plot: dropping a row redistributes its
    // space rather than leaving a hole where it was.
    expect(zones).toEqual([
      { id: 'lane:a', rect: { x: 0, y: 0, w: 1, h: 0.5 } },
      { id: 'lane:b', rect: { x: 0, y: 0.5, w: 1, h: 0.5 } },
    ]);
    expect(warn).toHaveBeenCalledTimes(5);
    expect(warn.mock.calls.map(c => String(c[0]))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('"sized" instance zone "zero"'),
        expect.stringContaining('"sized" instance zone "negative"'),
      ])
    );

    // Painting the same broken partition again says nothing more.
    warn.mockClear();
    expect(backgroundInstanceZones(def, model)).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reports nothing when every entry was dropped', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      backgroundInstanceZones(
        { ...BANDED, type: 'all-broken' },
        {
          lanes: [
            { id: 'a', size: 0 },
            { id: 'b', size: -1 },
          ],
        }
      )
    ).toEqual([]);
    warn.mockRestore();
  });
});

/* -------------------------------------------------------------------------- */
/* The renderer                                                                */
/* -------------------------------------------------------------------------- */

const THREE = {
  lanes: [
    { id: 'a', name: 'Sales', size: 1 },
    { id: 'b', name: 'Ops', size: 2 },
    { id: 'c', size: 1 },
  ],
};

describe('the partition the primitive paints', () => {
  it('draws N−1 dividers, at the internal boundaries only', () => {
    // Plot: x 20 → 420, y 10 → 310, so 300 units of height shared 1:2:1.
    const rec = paint(BANDED, THREE, 440, 320);

    // Two lines for three bands: the outer edges belong to the plot, and a
    // line there would double the frame already drawn round it.
    expect(rec.segments).toEqual([
      [20, 85, 420, 85],
      [20, 235, 420, 235],
    ]);
    expect(rec.strokes).toEqual([
      ['#262626', 1.5],
      ['#262626', 1.5],
    ]);
  });

  it('draws no divider at all for a single zone', () => {
    expect(paint(BANDED, { lanes: [{ id: 'a', size: 1 }] }).segments).toEqual(
      []
    );
  });

  it('draws the dividers of a `x` partition across the other axis', () => {
    const rec = paint(COLUMNED, THREE, 440, 320);
    expect(rec.segments).toEqual([
      [120, 10, 120, 310],
      [320, 10, 320, 310],
    ]);
  });

  it('honours a dashed divider, and puts the dash back', () => {
    const rec = paint(
      {
        ...BANDED,
        instanceZones: {
          ...LANES,
          divider: { color: '#000000', width: 1, dash: [4, 4] },
        },
      },
      THREE,
      440,
      320
    );
    expect(rec.dashes).toEqual([[4, 4]]);
  });

  it('writes each zone name at the top-left of its own band', () => {
    const rec = paint(BANDED, THREE, 440, 320);

    // Default insets: 8 in from the plot's left edge, 18 below the band's top.
    expect(rec.texts).toEqual([
      {
        text: 'Sales',
        x: 28,
        y: 28,
        font: '600 13px Inter, sans-serif',
        align: 'left',
        baseline: 'alphabetic',
        color: '#262626',
      },
      {
        text: 'Ops',
        x: 28,
        y: 103,
        font: '600 13px Inter, sans-serif',
        align: 'left',
        baseline: 'alphabetic',
        color: '#262626',
      },
    ]);
  });

  it('writes nothing for an unnamed zone — a band is not an empty label', () => {
    const rec = paint(BANDED, {
      lanes: [
        { id: 'a', size: 1 },
        { id: 'b', name: '', size: 1 },
      ],
    });
    expect(rec.texts).toEqual([]);
    // …and the partition is still a partition: the divider is there.
    expect(rec.segments).toHaveLength(1);
  });

  it('honours the declared offsets when the framework states them', () => {
    const rec = paint(
      {
        ...BANDED,
        instanceZones: {
          ...LANES,
          label: { style: LABEL_STYLE, dx: 0, dy: 40 },
        },
      },
      THREE,
      440,
      320
    );
    expect(rec.texts.map(t => [t.x, t.y])).toEqual([
      [20, 50],
      [20, 125],
    ]);
  });

  it('writes no name at all when the declaration asks for none', () => {
    const rec = paint(
      {
        ...BANDED,
        instanceZones: { prop: 'lanes', stack: 'y', idPrefix: 'lane' },
      },
      THREE
    );
    expect(rec.texts).toEqual([]);
    expect(rec.segments).toEqual([]);
  });

  it('keeps the furniture at a fixed size however far the frame is stretched', () => {
    // Ratios scale, model units do not: the dividers move, the 13px name and
    // its 8/18 insets do not.
    const rec = paint(BANDED, THREE, 440, 620);
    expect(rec.segments[0][1]).toBe(160);
    expect(rec.texts[0]).toMatchObject({
      x: 28,
      y: 28,
      font: '600 13px Inter, sans-serif',
    });
  });

  it('paints the dividers under the names, in the pipeline order', () => {
    expect(paint(BANDED, THREE, 440, 320).ops).toEqual([
      'fill', // the default white card
      'stroke',
      'stroke',
      'fillText',
      'fillText',
    ]);
  });

  it('offers no zone name for in-place editing', () => {
    // Renderer-side by construction (see `labels.ts`): the hit-test walk takes
    // the declaration alone, so a name it never returns can never be drawn in
    // one place and clicked in another. Zones are renamed through the
    // framework's own tooling.
    expect(backgroundLabelHits(BANDED, THREE, 440, 320)).toEqual([]);
  });
});

describe('a declaration that says nothing about instance zones', () => {
  /** The same framework, minus the one field. */
  const PLAIN: FrameworkBackgroundDef = {
    type: 'plain',
    geometry,
    zones: [
      { id: 'left', rect: { x: 0, y: 0, w: 0.5, h: 1 }, fill: '#eeeeee' },
    ],
    axes: [
      {
        id: 'a',
        orientation: 'horizontal',
        at: 1,
        stroke: { color: '#000000', width: 1 },
      },
    ],
  };

  it('paints the picture it painted before instance zones existed', () => {
    // The regression that matters: the field is new, so every framework in the
    // library is on this path, and the op stream must be identical down to the
    // operation — a model carrying a `lanes` prop included.
    const before = paint(PLAIN, {}, 440, 320);
    const withProp = paint(PLAIN, THREE, 440, 320);

    expect(before.ops).toEqual(['fill', 'fillRect', 'stroke']);
    expect(withProp.ops).toEqual(before.ops);
    expect(withProp.rects).toEqual(before.rects);
    expect(withProp.segments).toEqual(before.segments);
    expect(withProp.texts).toEqual(before.texts);
    expect(withProp.dashes).toEqual(before.dashes);
  });
});
