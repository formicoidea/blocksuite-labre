import { describe, expect, it, vi } from 'vitest';

import type {
  BackgroundTextDef,
  FrameworkBackgroundDef,
} from '../framework-background/index.js';
import {
  backgroundBandWidths,
  backgroundInstanceZoneBand,
  backgroundInstanceZones,
  backgroundLabelHits,
  backgroundPlot,
  createFrameworkBackgroundRenderer,
  wrapToWidth,
} from '../framework-background/index.js';

/**
 * Why this spec exists: `fit: 'wrap'`, the band that GROWS with its label.
 *
 * PR #532 cut a BPMN pool's participant and lane names with "…" when they were
 * longer than their band. The PO wanted the band to thicken instead, the name
 * wrapping onto lines side by side across it, and every lane strip of a pool to
 * share the thickness its most demanding name needs (2026-10-27). This spec
 * would catch:
 *
 * - a band that stays at its declared width while the name needs more lines,
 *   or one that grows for a name that fits on one line;
 * - lane strips of different widths in one instance (staggered leading edges);
 * - a name past `maxLines` drawn whole instead of cut with "…";
 * - a renderer and a hit box disagreeing about where the grown band is, which
 *   is a rename double-click landing beside the name it aimed at;
 * - a declaration that never asked for wrapping paying for a measurement.
 *
 * Text is measured at a fixed 6 units per code point, so every number below is
 * arithmetic; the browser spec in `gfx/bpmn` holds the same with real metrics.
 */

const measure = (text: string) => Array.from(text).length * 6;
const ctxLike = {
  measureText: (text: string) => ({ width: measure(text) }) as TextMetrics,
};
const measureFn = vi.fn((text: string, _font: string) => measure(text));

/** Size 10: a line height of 12 (×1.2), so N lines need 12N + 8 units. */
const LABEL: BackgroundTextDef = {
  id: 'who',
  prop: 'who',
  // Half the DECLARED band width in from the plot edge: the middle of the band.
  anchor: { x: 0, y: 0.5, dx: -10 },
  style: { size: 10, color: '#111111', baseline: 'middle' },
  vertical: true,
  fit: 'wrap',
  maxLines: 3,
};

const WRAPPED: FrameworkBackgroundDef = {
  type: 'wrapped',
  geometry: {
    width: 400,
    height: 100,
    lockAspectRatio: false,
    resizable: true,
    margin: { top: 0, right: 0, bottom: 0, left: 20 },
  },
  instanceZones: {
    prop: 'zones',
    stack: 'y',
    idPrefix: 'zone',
    label: {
      style: { size: 10, color: '#111111' },
      band: { width: 20, divider: { color: '#000000', width: 1 } },
      fit: 'wrap',
      maxLines: 2,
    },
  },
  chrome: {
    fontFamily: 'Demo',
    sideBands: [
      {
        side: 'left',
        fill: '#eeeeee',
        divider: { color: '#000000', width: 1 },
        label: LABEL,
      },
    ],
  },
};

/** Three lines at 92 units of room (100 tall, 4 clear at each end). */
const LONG = 'Group procurement and supplier office';

function paint(model: Record<string, unknown>, w = 400, h = 100) {
  const rects: Array<[number, number, number, number]> = [];
  const segments: Array<[number, number, number, number]> = [];
  const texts: Array<{ text: string; x: number; y: number }> = [];
  let frame: [number, number] | null = null;
  let mx = 0;
  let my = 0;
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: (x: number, y: number) => {
      mx = x;
      my = y;
    },
    lineTo: (x: number, y: number) => {
      segments.push([mx, my, x, y]);
    },
    arcTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: (x: number, y: number, rw: number, rh: number) =>
      rects.push([x, y, rw, rh]),
    setLineDash: vi.fn(),
    save: vi.fn(),
    restore: () => {
      frame = null;
    },
    translate: (x: number, y: number) => {
      frame = [x, y];
    },
    rotate: vi.fn(),
    measureText: (text: string) => ({ width: measure(text) }),
    fillText: (text: string, x: number, y: number) =>
      texts.push(frame ? { text, x: frame[0], y: frame[1] } : { text, x, y }),
  };
  const matrix = { translateSelf: () => matrix, rotateSelf: () => matrix };
  const render = createFrameworkBackgroundRenderer(WRAPPED) as unknown as (
    m: unknown,
    c: unknown,
    x: unknown
  ) => void;
  render({ deserializedXYWH: [0, 0, w, h], rotate: 0, ...model }, ctx, matrix);
  return { rects, segments, texts };
}

describe('wrapToWidth', () => {
  it('breaks on words, greedily, within the room', () => {
    expect(wrapToWidth(ctxLike, LONG, 92, 3)).toEqual([
      'Group',
      'procurement and',
      'supplier office',
    ]);
  });

  it('cuts the last line with "…" past maxLines', () => {
    const lines = wrapToWidth(ctxLike, `${LONG} in Lyon`, 92, 3);
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe('supplier offic…');
    expect(measure(lines[2])).toBeLessThanOrEqual(92);
  });

  it('gives a single over-long word its own line, cut', () => {
    expect(wrapToWidth(ctxLike, 'Supercalifragilistic', 60, 2)).toEqual([
      'Supercali…',
    ]);
  });

  it('has nothing to say for blank words or no room', () => {
    expect(wrapToWidth(ctxLike, '   ', 92, 3)).toEqual([]);
    expect(wrapToWidth(ctxLike, 'Client', 0, 3)).toEqual([]);
  });
});

describe('a side band that grows with its wrapped label', () => {
  it('keeps the declared width for a name on one line', () => {
    const layout = backgroundBandWidths(
      WRAPPED,
      { who: 'Client' },
      400,
      100,
      measureFn
    );
    // One line needs 12 + 8 = 20: exactly the declared band, no growth.
    expect(layout.margin.left).toBe(20);
    expect(layout.labels.get(LABEL)).toEqual({
      lines: ['Client'],
      shift: [0, 0],
    });
  });

  it('thickens to lines × line height + padding, and recentres the label', () => {
    const layout = backgroundBandWidths(
      WRAPPED,
      { who: LONG },
      400,
      100,
      measureFn
    );
    expect(layout.margin.left).toBe(3 * 12 + 8);
    // Half the growth back: the label stays in the middle of the band.
    expect(layout.labels.get(LABEL)?.shift).toEqual([-12, 0]);
  });

  it('paints the grown band, its divider and the lines across it', () => {
    const { rects, segments, texts } = paint({ who: LONG });
    expect(rects).toContainEqual([0, 0, 44, 100]);
    expect(segments).toContainEqual([44, 0, 44, 100]);
    // Centred on the band's middle (22), one line height apart, first line
    // nearest the card edge.
    expect(texts).toEqual([
      { text: 'Group', x: 10, y: 50 },
      { text: 'procurement and', x: 22, y: 50 },
      { text: 'supplier office', x: 34, y: 50 },
    ]);
  });

  it('offers a rename box round every painted line', () => {
    const model = { who: LONG };
    // Measured headless, as a hit test is: the box follows the same resolver.
    const layout = backgroundBandWidths(WRAPPED, model, 400, 100);
    const lines = layout.labels.get(LABEL)?.lines ?? [];
    expect(lines.length).toBeGreaterThan(1);
    const middle = layout.margin.left / 2;
    const spread = ((lines.length - 1) / 2) * 12;

    const [hit] = backgroundLabelHits(WRAPPED, model, 400, 100);
    expect(hit.minX).toBeLessThanOrEqual(middle - spread);
    expect(hit.maxX).toBeGreaterThanOrEqual(middle + spread);
  });

  it('measures nothing for a declaration that never asked to wrap', () => {
    const plain: FrameworkBackgroundDef = {
      ...WRAPPED,
      instanceZones: undefined,
      chrome: {
        sideBands: [{ side: 'left', label: { ...LABEL, fit: 'ellipsis' } }],
      },
    };
    measureFn.mockClear();
    const layout = backgroundBandWidths(
      plain,
      { who: LONG },
      400,
      100,
      measureFn
    );
    expect(measureFn).not.toHaveBeenCalled();
    expect(layout.margin).toBe(plain.geometry.margin);
  });
});

describe('instance-zone strips that share the widest wrapped name', () => {
  const ZONES = [
    { id: 'a', name: 'Ops', size: 1 },
    // 60 units in a 42-unit room: two lines, 2 × 12 + 8 = 32.
    { id: 'b', name: 'Sales team', size: 1 },
  ];

  it('gives every strip the thickness the most demanding name needs', () => {
    const model = { who: 'Client', zones: ZONES };
    const layout = backgroundBandWidths(WRAPPED, model, 400, 100, measureFn);
    expect(layout.zoneBandWidth).toBe(32);
    expect(layout.zoneLines.get('zone:b')).toEqual(['Sales', 'team']);

    const plot = backgroundPlot(WRAPPED, 400, 100, layout.margin);
    const widths = backgroundInstanceZones(WRAPPED, model).map(
      zone =>
        backgroundInstanceZoneBand(WRAPPED, zone, plot, layout.zoneBandWidth)?.w
    );
    expect(widths).toEqual([32, 32]);
  });

  it('paints both strip dividers on one line', () => {
    const { segments } = paint({ who: 'Client', zones: ZONES });
    // Plot edge 20, strip 32: both dividers at x = 52, one per lane.
    expect(segments).toContainEqual([52, 0, 52, 50]);
    expect(segments).toContainEqual([52, 50, 52, 100]);
  });

  it('keeps the declared strip when every name fits on one line', () => {
    const layout = backgroundBandWidths(
      WRAPPED,
      { zones: [{ id: 'a', name: 'Ops', size: 1 }] },
      400,
      100,
      measureFn
    );
    expect(layout.zoneBandWidth).toBe(20);
  });
});
