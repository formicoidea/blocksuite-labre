import { ConnectorElementModel, ConnectorMode } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

/**
 * A degraded connector (see PR #90): an endpoint references a vanished
 * element, so the path is empty while the last bound is kept — the element
 * stays indexed and thus hoverable where the user last saw it. Hit-testing
 * must degrade instead of throwing (`getElementByPoint` calls
 * `includesPoint` on every mouse move).
 *
 * The model needs full store scaffolding to instantiate, and the hit-test
 * methods only read plain accessors — so they are exercised on a stub via
 * the prototype.
 */
const proto = ConnectorElementModel.prototype;

function degraded(mode: ConnectorMode): ConnectorElementModel {
  return {
    mode,
    absolutePath: [],
    x: 10,
    y: 20,
    w: 100,
    h: 50,
    strokeWidth: 4,
    hasLabel: () => false,
    labelIncludesPoint: () => false,
  } as unknown as ConnectorElementModel;
}

const MODES = [
  ['Straight', ConnectorMode.Straight],
  ['Orthogonal', ConnectorMode.Orthogonal],
  ['Curve', ConnectorMode.Curve],
] as const;

describe('degraded connector (empty path) hit-testing', () => {
  it.each(MODES)('%s: includesPoint misses instead of throwing', (_l, mode) => {
    expect(proto.includesPoint.call(degraded(mode), 15, 25)).toBe(false);
  });

  it.each(MODES)(
    '%s: includesPoint misses near the world origin too',
    (_l, mode) => {
      // Without the model-level guard, the zero-length-path fallback in
      // getBezierParameters degenerates the curve to [0,0] — and a degraded
      // Curve connector becomes hoverable within a stroke-width of the WORLD
      // ORIGIN, wherever its bound is. The guard must miss there as well.
      expect(proto.includesPoint.call(degraded(mode), 2, 3)).toBe(false);
    }
  );

  it.each(MODES)(
    '%s: getNearestPoint falls back to the element origin',
    (_l, mode) => {
      expect(proto.getNearestPoint.call(degraded(mode), [0, 0])).toEqual([
        10, 20,
      ]);
    }
  );

  it.each(MODES)(
    '%s: getPointByOffsetDistance falls back to the bound center',
    (_l, mode) => {
      expect(proto.getPointByOffsetDistance.call(degraded(mode), 0.5)).toEqual([
        60, 45,
      ]);
    }
  );

  it.each(MODES)(
    '%s: getOffsetDistanceByPoint falls back to the midpoint',
    (_l, mode) => {
      expect(proto.getOffsetDistanceByPoint.call(degraded(mode), [0, 0])).toBe(
        0.5
      );
    }
  );
});
