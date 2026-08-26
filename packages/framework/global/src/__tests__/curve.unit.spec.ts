import { describe, expect, test } from 'vitest';

import { getBezierNearestPoint, getBezierParameters } from '../gfx/curve.js';
import { PointLocation } from '../gfx/model/index.js';

describe('getBezierParameters', () => {
  test('degrades on an empty path instead of throwing', () => {
    const params = getBezierParameters([]);

    expect(params).toHaveLength(4);
    expect(params).toEqual([
      new PointLocation(),
      new PointLocation(),
      new PointLocation(),
      new PointLocation(),
    ]);
    // Degenerate curve at the origin — every evaluation stays finite.
    expect(getBezierNearestPoint(params, [3, 4])).toEqual([0, 0]);
  });

  test('should handle single-point path', () => {
    const point = new PointLocation([10, 20]);

    expect(getBezierParameters([point])).toEqual([point, point, point, point]);
  });
});
