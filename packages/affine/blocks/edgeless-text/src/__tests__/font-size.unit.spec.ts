import { Bound } from '@labre/global/gfx';
import { describe, expect, test } from 'vitest';

import {
  boundForScale,
  EDGELESS_TEXT_BASE_FONT_SIZE,
  scaleFromSize,
  sizeFromScale,
} from '../edgeless-toolbar/font-size.js';

describe('size <-> scale mapping', () => {
  test('scale 1 maps to the base font size', () => {
    expect(sizeFromScale(1)).toBe(EDGELESS_TEXT_BASE_FONT_SIZE);
  });

  test('round-trips preset sizes', () => {
    for (const size of [16, 24, 32, 40, 64, 128]) {
      expect(sizeFromScale(scaleFromSize(size))).toBe(size);
    }
  });

  test('rounds arbitrary resize scales to a readable integer', () => {
    expect(sizeFromScale(1.5)).toBe(23);
    expect(sizeFromScale(0.4)).toBe(6);
  });
});

describe('boundForScale', () => {
  test('keeps the top-left anchor and scales extents, like corner resize', () => {
    const bound = boundForScale(new Bound(100, 200, 220, 60), 1, 2);
    expect([bound.x, bound.y, bound.w, bound.h]).toEqual([100, 200, 440, 120]);
  });

  test('preserves the real layout size so text wrapping is unchanged', () => {
    const oldScale = 1.5;
    const newScale = scaleFromSize(32);
    const bound = new Bound(0, 0, 330, 90);
    const next = boundForScale(bound, oldScale, newScale);
    expect(next.w / newScale).toBeCloseTo(bound.w / oldScale);
    expect(next.h / newScale).toBeCloseTo(bound.h / oldScale);
  });
});
