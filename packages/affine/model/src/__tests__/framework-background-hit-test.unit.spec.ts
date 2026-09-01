import { Bound } from '@labre/global/gfx';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  BpmnPoolElementModel,
  CynefinElementModel,
  EdgyBoardElementModel,
  EdgyFacetsElementModel,
  EstuarineElementModel,
  ShapeElementModel,
  WardleyBackgroundElementModel,
} from '../index.js';

/**
 * A framework background is picked by its BORDER, not by its whole area
 * (issue #194).
 *
 * The bug this file pins: a background hit-tested over its full rectangle
 * competes with its own content for every click. Above in the paint order it
 * wins outright (`getElementByPoint` keeps the topmost hit — a board created
 * after the shape it covers swallowed 100% of the clicks on that shape); below,
 * it fills every gap the content leaves (the interior of an unfilled shape, the
 * space beside a small node), which is where the "one time in two" came from.
 *
 * Built detached rather than through a surface: a `@field()` accessor reads
 * `yMap` when the map has a doc and the element's preserved props otherwise, so
 * a bare object with those two is enough to exercise the real getters — and the
 * real `includesPoint` — without a workspace, a store or a Yjs document. Same
 * harness the C4 model spec uses.
 */
function detached<T>(
  Ctor: new (...args: never[]) => T,
  props: Record<string, unknown> = {}
): T {
  const element = Object.create(Ctor.prototype) as Record<string, unknown>;
  element.yMap = { doc: null };
  element._preserved = new Map<string, unknown>(Object.entries(props));
  // The cache the derived `x` / `y` / `w` / `h` getters memoise into.
  element._local = new Map<string, unknown>();
  return element as unknown as T;
}

/**
 * The 2-D affine pair `getPointsFromBoundWithRotation` composes a rotation
 * with.
 *
 * happy-dom ships `DOMMatrix` / `DOMPoint` as names without geometry —
 * `matrixTransform` is simply absent — so the rotation branch of the shared
 * helper cannot run under the test environment. These are the three operations
 * it uses and nothing more; the browser's own implementations do the same
 * arithmetic, which is what makes asserting rotation here worth anything. Same
 * approach the BPMN and C4 renderer specs take for `DOMMatrix`.
 */
class StubMatrix {
  constructor(
    public a = 1,
    public b = 0,
    public c = 0,
    public d = 1,
    public e = 0,
    public f = 0
  ) {}

  translateSelf(tx: number, ty: number) {
    this.e += this.a * tx + this.c * ty;
    this.f += this.b * tx + this.d * ty;
    return this;
  }

  rotateSelf(deg: number) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const { a, b, c, d } = this;
    this.a = a * cos + c * sin;
    this.b = b * cos + d * sin;
    this.c = c * cos - a * sin;
    this.d = d * cos - b * sin;
    return this;
  }
}

class StubPoint {
  constructor(
    public x = 0,
    public y = 0
  ) {}

  matrixTransform(m: StubMatrix) {
    return {
      x: m.a * this.x + m.c * this.y + m.e,
      y: m.b * this.x + m.d * this.y + m.f,
    };
  }
}

beforeAll(() => {
  const global = globalThis as Record<string, unknown>;
  global.DOMMatrix = StubMatrix;
  global.DOMPoint = StubPoint;
});

/** A 1600 × 900 map at the origin — the Wardley background's own default box. */
const MAP = { xywh: '[0,0,1600,900]', rotate: 0 };

/** What the picking path passes: ten screen pixels, at the current zoom. */
const PICK = { hitThreshold: 10, zoom: 1 };

describe('a framework background is picked by its border', () => {
  it('misses the interior and hits the border band', () => {
    const map = detached(WardleyBackgroundElementModel, MAP);

    // The bug, stated: the middle of the map is not the map.
    expect(map.includesPoint(800, 450, PICK)).toBe(false);
    // Nor is anywhere else the user actually works.
    expect(map.includesPoint(400, 200, PICK)).toBe(false);
    expect(map.includesPoint(1500, 800, PICK)).toBe(false);

    // The band straddles the outline, like a shape's stroke: five units inside
    // the left edge, five units outside it, and on the top edge too.
    expect(map.includesPoint(5, 450, PICK)).toBe(true);
    expect(map.includesPoint(-5, 450, PICK)).toBe(true);
    expect(map.includesPoint(800, 4, PICK)).toBe(true);
    expect(map.includesPoint(1596, 450, PICK)).toBe(true);

    // And it stops where it says it stops.
    expect(map.includesPoint(40, 450, PICK)).toBe(false);
    expect(map.includesPoint(-40, 450, PICK)).toBe(false);
  });

  it('keeps the band the same width on screen at any zoom', () => {
    const map = detached(WardleyBackgroundElementModel, MAP);

    // Zoomed IN 2×: ten screen pixels are five model units.
    expect(map.includesPoint(4, 450, { hitThreshold: 10, zoom: 2 })).toBe(true);
    expect(map.includesPoint(8, 450, { hitThreshold: 10, zoom: 2 })).toBe(
      false
    );

    // Zoomed OUT to a quarter: ten screen pixels are forty model units — the
    // band a user aims at is the same band whatever the viewport is doing.
    expect(map.includesPoint(30, 450, { hitThreshold: 10, zoom: 0.25 })).toBe(
      true
    );
    expect(map.includesPoint(50, 450, { hitThreshold: 10, zoom: 0.25 })).toBe(
      false
    );
  });

  it('follows the border round a ROTATED background', () => {
    // A 200 × 100 map turned a quarter turn: it now measures 100 × 200 about
    // the same centre (100, 50), so its left edge is at x = 50, not x = 0.
    const map = detached(WardleyBackgroundElementModel, {
      xywh: '[0,0,200,100]',
      rotate: 90,
    });

    expect(map.includesPoint(50, 50, PICK)).toBe(true);
    expect(map.includesPoint(150, 50, PICK)).toBe(true);
    expect(map.includesPoint(100, -48, PICK)).toBe(true);
    // Where the UNrotated edge used to be, there is now nothing.
    expect(map.includesPoint(0, 50, PICK)).toBe(false);
    expect(map.includesPoint(100, 50, PICK)).toBe(false);
  });

  it('still answers for the whole extent when asked about the drag', () => {
    const map = detached(WardleyBackgroundElementModel, MAP);

    // `ignoreTransparent: false` is how the default tool asks "is the pointer
    // on this element" to decide whether a press on an ALREADY-SELECTED element
    // starts a move. An unfilled shape answers the same two ways for the same
    // reason, so a selected background is still dragged from anywhere inside.
    expect(
      map.includesPoint(800, 450, { ...PICK, ignoreTransparent: false })
    ).toBe(true);
    expect(
      map.includesPoint(-40, 450, { ...PICK, ignoreTransparent: false })
    ).toBe(false);
  });

  it('leaves the lasso alone', () => {
    const map = detached(WardleyBackgroundElementModel, MAP);

    // A rubber band drawn around the map still takes it…
    expect(map.containsBound(new Bound(-50, -50, 1700, 1000))).toBe(true);
    // …and one grazing its left edge still crosses it. Both read BOUNDS, not
    // points, so this fix cannot reach them — which is the point of asserting
    // it here rather than trusting that it does not.
    expect(map.intersectsBound(new Bound(-50, 400, 100, 100))).toBe(true);
  });

  it('runs the same test in the four models that are not subclasses', () => {
    // These four implement the geometry themselves rather than inheriting the
    // primitive (the frame manager treats a `FrameworkBackgroundElementModel`
    // specially, so re-parenting them would change more than hit testing).
    // They share the LOGIC instead, and this is what says so.
    const standalone = [
      detached(EdgyBoardElementModel, MAP),
      detached(EdgyFacetsElementModel, MAP),
      detached(CynefinElementModel, MAP),
      detached(EstuarineElementModel, MAP),
    ];

    for (const element of standalone) {
      expect(element.includesPoint(800, 450, PICK)).toBe(false);
      expect(element.includesPoint(5, 450, PICK)).toBe(true);
      expect(
        element.includesPoint(800, 450, { ...PICK, ignoreTransparent: false })
      ).toBe(true);
    }
  });
});

describe('a BPMN pool is picked by its border and its title bands', () => {
  /** The reference pool: 560 × 200, a 28-unit participant band on the left. */
  const POOL = { xywh: '[0,0,560,200]', rotate: 0 };

  const LANES = [
    { id: 'a', name: 'Sales', size: 1 },
    { id: 'b', name: 'Back office', size: 2 },
  ];

  it('takes the participant band, and nothing else without lanes', () => {
    const pool = detached(BpmnPoolElementModel, POOL);

    // The band is the strip the participant name is written up: it is the pool
    // rather than the process drawn on it, so it stays clickable — the
    // convention bpmn.io, Camunda and Visio all follow.
    expect(pool.includesPoint(14, 100, PICK)).toBe(true);
    expect(pool.includesPoint(27, 190, PICK)).toBe(true);
    // Just past it, with no lane strip to continue it.
    expect(pool.includesPoint(40, 100, PICK)).toBe(false);
    // The flow area is the process, and belongs to what is drawn on it.
    expect(pool.includesPoint(280, 100, PICK)).toBe(false);
    // The border is still the border.
    expect(pool.includesPoint(555, 100, PICK)).toBe(true);
  });

  it('adds the lane strip once the pool has a lane', () => {
    const pool = detached(BpmnPoolElementModel, { ...POOL, lanes: LANES });

    // 28 (participant) + 24 (lanes) — one strip, whatever the lanes' weights
    // are: the bands partition the full height between them with no gap.
    expect(pool.includesPoint(40, 100, PICK)).toBe(true);
    expect(pool.includesPoint(51, 20, PICK)).toBe(true);
    expect(pool.includesPoint(51, 180, PICK)).toBe(true);
    expect(pool.includesPoint(70, 100, PICK)).toBe(false);
  });

  it('offers no lane strip for a partition that paints none', () => {
    // A size of zero is dropped by `backgroundInstanceZones` and paints no
    // band, so it must not make one clickable either.
    const pool = detached(BpmnPoolElementModel, {
      ...POOL,
      lanes: [{ id: 'a', name: 'Sales', size: 0 }],
    });

    expect(pool.includesPoint(40, 100, PICK)).toBe(false);
    expect(pool.includesPoint(14, 100, PICK)).toBe(true);
  });

  it('turns the bands with the pool', () => {
    // Half a turn about the centre (280, 100): the participant band is now the
    // strip on the RIGHT of the canvas.
    const pool = detached(BpmnPoolElementModel, { ...POOL, rotate: 180 });

    expect(pool.includesPoint(540, 100, PICK)).toBe(true);
    expect(pool.includesPoint(20, 100, PICK)).toBe(false);
  });
});

describe('the picking regression the recette reported', () => {
  /**
   * `getElementByPoint` filters the candidates by `includesPoint` and keeps the
   * TOPMOST survivor. Mirrored here in the two lines that matter, over real
   * models, with the board painted ABOVE the shape — the exact stack of the
   * report: an EDGY Outcome placed first, an EDGY board dropped on top of it.
   */
  const pick = (
    candidates: { includesPoint: (...args: never[]) => boolean }[],
    x: number,
    y: number
  ) =>
    candidates.filter(element =>
      (element.includesPoint as (...a: unknown[]) => boolean)(x, y, PICK)
    );

  it('gives the click to the element, not to the board above it', () => {
    const shape = detached(ShapeElementModel, {
      shapeType: 'rect',
      filled: true,
      xywh: '[700,400,200,100]',
      rotate: 0,
    });
    const board = detached(EdgyBoardElementModel, {
      xywh: '[0,0,1600,900]',
      rotate: 0,
    });

    // Paint order, back to front: the shape first, the board dropped over it.
    const stack = [shape, board];
    const centre = pick(stack as never, 800, 450);

    // The board is no longer even a candidate at the shape's centre, so the
    // topmost survivor is the shape — whatever the z-order says.
    expect(centre).toEqual([shape]);
  });

  it('still gives the board its border', () => {
    const shape = detached(ShapeElementModel, {
      shapeType: 'rect',
      filled: true,
      xywh: '[700,400,200,100]',
      rotate: 0,
    });
    const board = detached(EdgyBoardElementModel, {
      xywh: '[0,0,1600,900]',
      rotate: 0,
    });

    expect(pick([shape, board] as never, 5, 450)).toEqual([board]);
  });
});
