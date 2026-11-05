import { describe, expect, it } from 'vitest';

import type {
  BackgroundTextDef,
  BackgroundTextStyle,
  FrameworkBackgroundDef,
} from '../framework-background/index.js';
import {
  backgroundBandWidths,
  backgroundLabelHits,
  backgroundSizedStyle,
} from '../framework-background/index.js';

/**
 * Why this spec exists: `sizeProp`, the author's own font size for a declared
 * text or for an instance's zone names (ADR 0049, the BPMN pool's title sizes).
 *
 * A size is read in three places — the band widths, the renderer, the hit
 * boxes — through one resolver, `backgroundSizedStyle`. This spec would catch:
 *
 * - a stored value trusted as it is: a zero, a negative, a NaN, a string from
 *   a damaged or hostile document must paint the declared size, never a band
 *   of zero or an `NaNpx` font;
 * - a declaration with no `sizeProp` paying for the feature (a copied style
 *   instead of the declared object);
 * - a band that keeps its declared thickness while its label is painted
 *   larger, or a hit box cut for the declared size instead of the painted one.
 *
 * Text is measured at a fixed 6 units per code point, so every number below is
 * arithmetic: one line of size S needs 1.2 S + 8 units of band.
 */

const measure = (text: string) => Array.from(text).length * 6;

const STYLE: BackgroundTextStyle = { size: 10, color: '#111111' };
const BIG = 30;

const LABEL: BackgroundTextDef = {
  id: 'who',
  prop: 'who',
  sizeProp: 'whoSize',
  anchor: { x: 0, y: 0.5, dx: -10 },
  style: { ...STYLE, baseline: 'middle' },
  vertical: true,
  fit: 'wrap',
  maxLines: 3,
};

const SIZED: FrameworkBackgroundDef = {
  type: 'sized',
  geometry: {
    width: 400,
    height: 200,
    lockAspectRatio: false,
    resizable: true,
    margin: { top: 0, right: 0, bottom: 0, left: 20 },
  },
  instanceZones: {
    prop: 'zones',
    stack: 'y',
    idPrefix: 'zone',
    label: {
      style: STYLE,
      sizeProp: 'zoneSize',
      band: { width: 20 },
      fit: 'wrap',
      maxLines: 2,
    },
  },
  chrome: {
    fontFamily: 'Demo',
    sideBands: [{ side: 'left', label: LABEL }],
  },
};

const ZONES = [{ id: 'a', name: 'Sales', size: 1 }];

describe('backgroundSizedStyle', () => {
  it('returns the declared style itself when nothing overrides it', () => {
    expect(backgroundSizedStyle(STYLE, undefined, { whoSize: BIG })).toBe(
      STYLE
    );
    expect(backgroundSizedStyle(STYLE, 'whoSize', {})).toBe(STYLE);
    expect(backgroundSizedStyle(STYLE, 'whoSize', { whoSize: 10 })).toBe(STYLE);
  });

  it('applies a stored size, and only the size', () => {
    expect(backgroundSizedStyle(STYLE, 'whoSize', { whoSize: BIG })).toEqual({
      ...STYLE,
      size: BIG,
    });
  });

  it.each([
    ['zero', 0],
    ['a negative', -12],
    ['NaN', Number.NaN],
    ['Infinity', Infinity],
    ['a string', '30'],
    ['null', null],
  ])('ignores %s and paints the declared size', (_, value) => {
    expect(backgroundSizedStyle(STYLE, 'whoSize', { whoSize: value })).toBe(
      STYLE
    );
  });
});

describe('a sized label in the band resolver and the hit boxes', () => {
  it('leaves the declared band alone when no size is stored', () => {
    const layout = backgroundBandWidths(
      SIZED,
      { who: 'Ann', zones: ZONES },
      400,
      200,
      measure
    );
    // One line of size 10: 12 + 8 = 20, the declared width exactly.
    expect(layout.margin.left).toBe(20);
    expect(layout.zoneBandWidth).toBe(20);
  });

  it('thickens each band to hold its label at the stored size', () => {
    const layout = backgroundBandWidths(
      SIZED,
      { who: 'Ann', whoSize: BIG, zones: ZONES, zoneSize: BIG },
      400,
      200,
      measure
    );
    // One line of size 30: 36 + 8.
    expect(layout.margin.left).toBeCloseTo(44);
    expect(layout.zoneBandWidth).toBeCloseTo(44);
  });

  it('cuts the hit box for the size painted, not the declared one', () => {
    const plain = backgroundLabelHits(
      SIZED,
      { who: 'Ann' },
      400,
      200,
      null,
      measure
    );
    const sized = backgroundLabelHits(
      SIZED,
      { who: 'Ann', whoSize: BIG },
      400,
      200,
      null,
      measure
    );
    const across = (hit: { minX: number; maxX: number }) => hit.maxX - hit.minX;
    const along = (hit: { minY: number; maxY: number }) => hit.maxY - hit.minY;
    expect(across(sized[0])).toBeGreaterThan(across(plain[0]));
    expect(along(sized[0])).toBeGreaterThan(along(plain[0]));
  });
});
