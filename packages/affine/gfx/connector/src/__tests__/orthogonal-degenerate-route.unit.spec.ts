/**
 * The orthogonal router threw "Failed to get line intersections for
 * getNextPoint" (unhandled BlockSuiteError in prod, 2026-09-09 and
 * 2026-10-02) and a TypeError in pushGapMidPoint when an end fell outside its
 * bound: element [0,0,0,0] (defaults of #318) without anchor hence the [0,0]
 * sentinel, stored position outside [0,1], NaN or flat xywh. A route never
 * throws; it degrades to a direct or empty path without writing.
 *
 * The router is driven twice: directly (`generateOrthogonalConnectorPath`,
 * the exact input `getNextPoint` received) and end to end through
 * `ConnectorPathGenerator.updatePath`, the call `connector-watcher.ts` makes
 * inside a `queueMicrotask` — where a throw escapes every handler.
 *
 * The elements are stubs carrying the default geometry of
 * `GfxPrimitiveElementModel` (bound polygon), i.e. what a non-shape element
 * offers the router: no `ShapeElementModel`, so no shape-specific anchor.
 * `getBoundWithRotation` needs `DOMRect`, hence the DOM environment; it also
 * needs `DOMQuad` for a rotated element, which happy-dom lacks, so the rotated
 * case drives the router with the rotated bound it would receive.
 *
 * @vitest-environment happy-dom
 */
import type {
  Connection,
  LocalConnectorElementModel,
} from '@labre/affine-model';
import { ConnectorMode } from '@labre/affine-model';
import type { IVec, XYWH } from '@labre/global/gfx';
import {
  Bound,
  getBoundFromPoints,
  getPointsFromBoundWithRotation,
  linePolygonIntersects,
  PointLocation,
  polygonGetPointTangent,
  polygonNearestPoint,
  rotatePoints,
} from '@labre/global/gfx';
import type { GfxModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { ConnectorPathGenerator, PathGenerator } from '../connector-manager';

function stubElement(xywh: XYWH, rotate = 0): GfxModel {
  const bound = Bound.fromXYWH(xywh);
  const polygon = () => getPointsFromBoundWithRotation({ ...bound, rotate });
  return {
    xywh: bound.serialize(),
    rotate,
    getLineIntersections: (start: IVec, end: IVec) =>
      linePolygonIntersects(start, end, polygon()),
    getNearestPoint: (point: IVec) => polygonNearestPoint(polygon(), point),
    getRelativePointLocation: (relative: IVec) => {
      const point = bound.getRelativePoint(relative);
      const rotated = rotatePoints([point], bound.center, rotate)[0];
      const outline = rotatePoints(bound.points, bound.center, rotate);
      return new PointLocation(
        rotated,
        polygonGetPointTangent(outline, rotated)
      );
    },
  } as unknown as GfxModel;
}

function makeConnector(
  source: Connection,
  target: Connection
): LocalConnectorElementModel {
  return {
    mode: ConnectorMode.Orthogonal,
    source,
    target,
    xywh: '[10,20,100,50]',
    path: [],
    updatingPath: false,
  } as unknown as LocalConnectorElementModel;
}

function expectFinite(points: ArrayLike<number>[]) {
  expect(
    points.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))
  ).toBe(true);
}

const B: XYWH = [800, 300, 100, 80];

describe('PathGenerator.generateOrthogonalConnectorPath on degenerate input', () => {
  const endBound = Bound.fromXYWH(B);
  const endPoint = new PointLocation([800, 340]);

  it.each<[string, Bound | null, IVec]>([
    [
      'start [0,0] against a bound at 500,300',
      new Bound(500, 300, 100, 80),
      [0, 0],
    ],
    ['start at maxX + 1', new Bound(500, 300, 100, 80), [601, 340]],
    ['start at maxX + 0.001', new Bound(500, 300, 100, 80), [600.001, 340]],
    ['NaN bound', new Bound(NaN, 300, 100, 80), [500, 340]],
    ['NaN point', new Bound(500, 300, 100, 80), [NaN, 340]],
    [
      'zero-size bound with the point on it',
      new Bound(500, 300, 0, 0),
      [500, 300],
    ],
    ['h = 0 with w > 0', new Bound(500, 300, 100, 0), [550, 300]],
    ['[0,0,0,0] with the point at its centre', new Bound(0, 0, 0, 0), [0, 0]],
  ])('%s: no throw, finite points', (_label, startBound, start) => {
    const router = new PathGenerator();
    let path: IVec[] = [];
    expect(() => {
      path = router.generateOrthogonalConnectorPath({
        startBound,
        endBound,
        startPoint: new PointLocation(start),
        endPoint,
      });
    }).not.toThrow();
    expectFinite(path);
  });
});

describe('ConnectorPathGenerator.updatePath on degenerate elements', () => {
  it.each<[string, XYWH, Connection, XYWH, Connection]>([
    [
      'non-shape [500,300,0,0] → b',
      [500, 300, 0, 0],
      { id: 'a' },
      B,
      { id: 'b' },
    ],
    ['[0,0,0,0] → b', [0, 0, 0, 0], { id: 'a' }, B, { id: 'b' }],
    [
      'target in negative coordinates',
      [0, 0, 0, 0],
      { id: 'a' },
      [-900, -700, 100, 80],
      { id: 'b' },
    ],
    [
      'stored position [1.5, 0.5]',
      [500, 300, 100, 80],
      { id: 'a', position: [1.5, 0.5] },
      B,
      { id: 'b' },
    ],
    [
      'stored position [-0.2, 0.5]',
      [500, 300, 100, 80],
      { id: 'a', position: [-0.2, 0.5] },
      B,
      { id: 'b' },
    ],
    [
      'stored position [0.5, 1.2]',
      [500, 300, 100, 80],
      { id: 'a', position: [0.5, 1.2] },
      B,
      { id: 'b' },
    ],
    [
      '[0,0,0,0] with stored position [0.5, 0.5]',
      [0, 0, 0, 0],
      { id: 'a', position: [0.5, 0.5] },
      B,
      { id: 'b', position: [0, 0.5] },
    ],
    ['h = 0 with w > 0', [500, 300, 100, 0], { id: 'a' }, B, { id: 'b' }],
  ])(
    '%s: no throw, still drawn, endpoints untouched',
    (_l, a, source, b, target) => {
      const elements: Record<string, GfxModel> = {
        a: stubElement(a),
        b: stubElement(b),
      };
      const connector = makeConnector(
        structuredClone(source),
        structuredClone(target)
      );

      expect(() =>
        ConnectorPathGenerator.updatePath(connector, null, id => elements[id])
      ).not.toThrow();

      // Every case here has a finite point at each end: the connector stays
      // drawn, as a direct elbow, rather than vanishing.
      expect(connector.path.length).toBeGreaterThanOrEqual(2);
      expectFinite(connector.path);
      // The stored endpoints are never rewritten by a reroute: only the
      // `@local` path and xywh change.
      expect(connector.source).toEqual(source);
      expect(connector.target).toEqual(target);
      expect(connector.updatingPath).toBe(false);
    }
  );
});

describe('ConnectorPathGenerator.updatePath keeps the happy routes', () => {
  it.each<[string, Record<string, GfxModel>, Connection, Connection]>([
    [
      'two separate elements',
      { a: stubElement([0, 0, 100, 80]), b: stubElement(B) },
      { id: 'a' },
      { id: 'b' },
    ],
    [
      'coincident points',
      { a: stubElement([0, 0, 100, 80]), b: stubElement(B) },
      { id: 'a', position: [1, 0.5] },
      { id: 'a', position: [1, 0.5] },
    ],
    [
      'equal bounds',
      { a: stubElement(B), b: stubElement(B) },
      { id: 'a' },
      { id: 'b' },
    ],
    [
      'nested element',
      {
        a: stubElement([0, 0, 1000, 800]),
        b: stubElement([400, 300, 100, 80]),
      },
      { id: 'a' },
      { id: 'b' },
    ],
    [
      'self loop',
      { a: stubElement(B) },
      { id: 'a', position: [1, 0.5] },
      { id: 'a', position: [0.5, 0] },
    ],
  ])('%s: a drawn, finite path', (_label, elements, source, target) => {
    const connector = makeConnector(source, target);

    ConnectorPathGenerator.updatePath(
      connector,
      null,
      id => elements[id] ?? null
    );

    expect(connector.path.length).toBeGreaterThanOrEqual(2);
    expectFinite(connector.path);
  });
});

describe('PathGenerator.generateOrthogonalConnectorPath keeps a rotated end', () => {
  it('routes from an anchor inside the rotated bound (the ray-cast branch)', () => {
    const rect = new Bound(0, 0, 100, 80);
    const outline = getPointsFromBoundWithRotation({ ...rect, rotate: 45 });
    // The right edge midpoint of the rotated rect lies strictly inside the
    // axis-aligned bound the router receives: getNextPoint ray-casts it out.
    const [anchor] = rotatePoints([[100, 40]], rect.center, 45);
    const startPoint = new PointLocation(
      anchor,
      polygonGetPointTangent(outline, anchor)
    );
    const path = new PathGenerator().generateOrthogonalConnectorPath({
      startBound: getBoundFromPoints(outline),
      endBound: Bound.fromXYWH(B),
      startPoint,
      endPoint: new PointLocation([800, 340]),
    });

    expect(path.length).toBeGreaterThanOrEqual(3);
    expectFinite(path);
    // The router rounds to two decimals (downscalePrecision).
    expect(path[0][0]).toBeCloseTo(anchor[0], 2);
    expect(path[0][1]).toBeCloseTo(anchor[1], 2);
  });
});
