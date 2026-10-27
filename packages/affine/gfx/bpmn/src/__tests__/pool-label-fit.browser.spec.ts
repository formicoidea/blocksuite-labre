import { describe, expect, it } from 'vitest';

import { POOL_BAND_WIDTH, POOL_LANE_BAND_WIDTH } from '../consts';
import { bpmnPool } from '../element-renderer';
import {
  bpmnInPoolTitleBand,
  bpmnPoolBands,
  bpmnPoolLayout,
  bpmnPoolTargetAt,
} from '../pool-hit';

/**
 * Why this spec exists: a pool's title bands GROW with their names, with real
 * Chromium text metrics — the same metrics the SVG export measures with.
 *
 * History: the participant name (and a lane's) used to run out of its band;
 * PR #532 cut it with "…"; the PO asked instead for the band to thicken as the
 * name needs more lines, and for every lane strip to take the thickness of the
 * widest (2026-10-27). The pool now declares `fit: 'wrap'` on both. This spec
 * would catch:
 *
 * - a long participant name drawn on one line, cut, or in a band that did not
 *   widen to hold its lines;
 * - a short name that widens its band anyway;
 * - two lanes with strips of different widths, or a lane strip that did not
 *   widen for a long name;
 * - a name past its `maxLines` drawn whole rather than cut with "…";
 * - a rename target (`pool-hit.ts`) narrower than the band painted, i.e. a
 *   double-click on the outer line of a long name that renames nothing.
 */

const W = 560;
const H = 200;
const PAD = 4;

function paint(model: Record<string, unknown>) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const drawn: Array<{ text: string; font: string }> = [];
  const rects: Array<[number, number, number, number]> = [];
  /** Vertical strokes, as `[x, top, bottom]`. */
  const verticals: Array<[number, number, number]> = [];
  const fillText = ctx.fillText.bind(ctx);
  ctx.fillText = (text: string, x: number, y: number) => {
    drawn.push({ text, font: ctx.font });
    fillText(text, x, y);
  };
  const fillRect = ctx.fillRect.bind(ctx);
  ctx.fillRect = (x: number, y: number, w: number, h: number) => {
    rects.push([x, y, w, h]);
    fillRect(x, y, w, h);
  };
  let from: [number, number] = [0, 0];
  const moveTo = ctx.moveTo.bind(ctx);
  ctx.moveTo = (x: number, y: number) => {
    from = [x, y];
    moveTo(x, y);
  };
  const lineTo = ctx.lineTo.bind(ctx);
  ctx.lineTo = (x: number, y: number) => {
    if (x === from[0] && y !== from[1]) verticals.push([x, from[1], y]);
    lineTo(x, y);
  };
  const pool = {
    deserializedXYWH: [0, 0, W, H],
    rotate: 0,
    resizeEnabled: true,
    ...model,
  };
  (bpmnPool as unknown as (m: unknown, c: unknown, x: unknown) => void)(
    pool,
    ctx,
    new DOMMatrix()
  );
  const width = (text: string, font: string) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
  return { drawn, rects, verticals, width, pool };
}

/** The participant band is the first rect painted from the card's left edge. */
const bandWidth = (rects: Array<[number, number, number, number]>) =>
  rects.find(([x, y, , h]) => x === 0 && y === 0 && h === H)?.[2];

const LONG =
  'Group procurement, supplier onboarding and contract management office';

/** Two lines up the 200-unit band of a 200-unit pool. */
const TWO_LINES = 'Group procurement and supplier office';

/** Far more than three lines up a 200-unit band. */
const ENDLESS = Array.from({ length: 6 }, () => LONG).join(' ');

describe('a participant band that grows with its name', () => {
  it('wraps a long name onto lines side by side, and widens the band', () => {
    const { drawn, rects, width } = paint({ name: TWO_LINES });

    expect(drawn.length).toBeGreaterThan(1);
    expect(drawn.length).toBeLessThanOrEqual(3);
    // Every word is there, in order: wrapped, not cut.
    expect(drawn.map(d => d.text).join(' ')).toBe(TWO_LINES);
    for (const line of drawn) {
      // Each line runs up a band the height of the pool, clear of both ends.
      expect(width(line.text, line.font)).toBeLessThanOrEqual(H - 2 * PAD);
    }
    expect(bandWidth(rects)).toBeGreaterThan(POOL_BAND_WIDTH);
  });

  it('keeps a name that fits on one line, in the declared band', () => {
    const { drawn, rects } = paint({ name: 'Customer' });
    expect(drawn.map(d => d.text)).toEqual(['Customer']);
    expect(bandWidth(rects)).toBe(POOL_BAND_WIDTH);
  });

  it('cuts a name past three lines with "…" on the last', () => {
    const { drawn } = paint({ name: ENDLESS });
    expect(drawn).toHaveLength(3);
    expect(drawn[2].text.endsWith('…')).toBe(true);
  });

  it('aims the rename at the band as painted', () => {
    const { rects, pool } = paint({ name: ENDLESS });
    const painted = bandWidth(rects)!;
    // The hit test measures headless; it must land on the same band.
    expect(bpmnPoolLayout(pool).margin.left).toBe(painted);
    // Beyond the zoom-grown target a short name would get (44, capped at 56),
    // inside the painted band: the outer line of a three-line name.
    const x = painted - 2;
    expect(x).toBeGreaterThan(2 * POOL_BAND_WIDTH);
    expect(bpmnInPoolTitleBand(pool, [x, H / 2], 1)).toBe(true);
    expect(bpmnPoolTargetAt(pool, [x, H / 2], 1)).toEqual({
      kind: 'participant',
    });
  });
});

describe('lane strips that share the widest name', () => {
  it('widens EVERY strip to what the longest lane name needs', () => {
    const { drawn, verticals, pool } = paint({
      name: 'Customer',
      lanes: [
        { id: 'a', name: LONG, size: 1 },
        { id: 'b', name: 'Ops', size: 1 },
      ],
    });
    const [, ...lanes] = drawn.map(d => d.text);
    // Two lines at most for a lane, the last cut: 100 units of lane is far
    // too short for the whole of LONG.
    expect(lanes).toHaveLength(3);
    expect(lanes[1].endsWith('…')).toBe(true);
    expect(lanes[2]).toBe('Ops');

    // The strip dividers: one per lane, on ONE vertical line past the
    // declared strip.
    const strip = verticals.filter(([x]) => x > POOL_BAND_WIDTH);
    expect(strip).toHaveLength(2);
    expect(strip[0][0]).toBe(strip[1][0]);
    expect(strip[0][0]).toBeGreaterThan(POOL_BAND_WIDTH + POOL_LANE_BAND_WIDTH);

    // And the hit test aims at those very strips.
    const bands = bpmnPoolBands(pool)!.bands;
    expect(bands.map(b => b.strip!.x + b.strip!.w)).toEqual([
      strip[0][0],
      strip[0][0],
    ]);
  });

  it('keeps the declared strip while every lane name fits one line', () => {
    const { verticals } = paint({
      name: 'Customer',
      lanes: [
        { id: 'a', name: 'Sales', size: 1 },
        { id: 'b', name: 'Ops', size: 1 },
      ],
    });
    const strip = verticals.filter(([x]) => x > POOL_BAND_WIDTH);
    expect(strip.map(([x]) => x)).toEqual([
      POOL_BAND_WIDTH + POOL_LANE_BAND_WIDTH,
      POOL_BAND_WIDTH + POOL_LANE_BAND_WIDTH,
    ]);
  });
});
