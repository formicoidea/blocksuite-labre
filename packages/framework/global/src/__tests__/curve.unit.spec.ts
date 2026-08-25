import { describe, expect, test } from 'vitest';

import { getBezierNearestPoint, getBezierParameters } from '../gfx/curve.js';

describe('getBezierParameters', () => {
  test('degrades on an empty path instead of throwing', () => {
    const params = getBezierParameters([]);

    expect(params).toHaveLength(4);
    // Degenerate curve at the origin — every evaluation stays finite.
    expect(getBezierNearestPoint(params, [3, 4])).toEqual([0, 0]);
  });
});
