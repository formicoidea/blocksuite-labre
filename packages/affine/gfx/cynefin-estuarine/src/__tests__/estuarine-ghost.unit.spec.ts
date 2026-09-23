import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ARROWHEADS,
  AXIS_LABELS,
  AXIS_WIDTH,
  E_AXIS,
  LABEL_LETTER_SPACING,
  LABELS,
  REF_H,
  REF_W,
  T_AXIS,
} from '../estuarine/consts';
import {
  estuarine,
  estuarineCurves,
  estuarineFit,
  GHOST_ALPHA,
  GHOST_DASH,
} from '../estuarine/element-renderer';
import {
  EstuarineGhostOverlay,
  GHOST_DASH_TRAVEL,
  GHOST_DECAY_MS,
  GHOST_PEAK_ALPHA,
  GHOST_REVEAL_MS,
  GHOST_TOTAL_MS,
  ghostRevealFrame,
  prefersReducedMotion,
} from '../estuarine/ghost-overlay';

/**
 * `Path2D` does not exist under Node, which is the entire reason the curves are
 * built in a LAZY memo instead of at import time (`element-renderer.ts`).
 * Stubbing it here, AFTER the module has been imported, is what pins that: if
 * the memo ever moves back to module scope, importing this spec throws before a
 * single test runs.
 */
class FakePath2D {
  constructor(readonly d: string) {}
}

vi.stubGlobal('Path2D', FakePath2D);

type Point = [number, number];

interface StrokeRecord {
  path: unknown;
  alpha: number;
  dash: readonly number[];
  lineWidth: number;
  strokeStyle: string;
  /** The ambient scale the path was stroked under — `[sx, sy]`. */
  scale: Point;
}

interface FillTextRecord {
  text: string;
  alpha: number;
  at: Point;
  font: string;
  letterSpacing: string;
  /** Text must never be drawn under a non-unit scale: it would be squashed. */
  scale: Point;
}

/** One `beginPath()`…`stroke()`/`fill()` run, as the points it visited. */
interface SubPathRecord {
  points: Point[];
  lineWidth: number;
  scale: Point;
  filled: boolean;
}

/**
 * A 2D context stand-in that records what the renderer actually asked for.
 *
 * It emulates `save`/`restore` over the state these tests are about:
 *
 * - the alpha and the dash, because the ghost's translucency and dashing must
 *   NOT leak onto the legend drawn right after it;
 * - the accumulated `scale`, because the whole resize fix is a claim about
 *   WHICH space each mark is drawn in — the curves inside the stretch, the
 *   axes and every word outside it, in element coordinates.
 */
function fakeCtx() {
  const strokes: StrokeRecord[] = [];
  const fillTexts: FillTextRecord[] = [];
  const paths: SubPathRecord[] = [];
  let current: Point[] = [];
  const setLineDash = vi.fn((dash: number[]) => {
    ctx.__dash = dash;
  });
  const stack: {
    alpha: number;
    dash: readonly number[];
    scale: Point;
  }[] = [];

  const scaleNow = (): Point => [ctx.__sx, ctx.__sy];

  /** Close the sub-path being built and file it. */
  const flush = (filled: boolean) => {
    if (current.length === 0) return;
    paths.push({
      points: current,
      lineWidth: ctx.lineWidth,
      scale: scaleNow(),
      filled,
    });
    current = [];
  };

  const ctx = {
    __dash: [] as readonly number[],
    __sx: 1,
    __sy: 1,
    globalAlpha: 1,
    lineWidth: 0,
    strokeStyle: '',
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    lineCap: '',
    lineJoin: '',
    lineDashOffset: 0,
    letterSpacing: '0px',
    setLineDash,
    save: vi.fn(() => {
      stack.push({
        alpha: ctx.globalAlpha,
        dash: ctx.__dash,
        scale: scaleNow(),
      });
    }),
    restore: vi.fn(() => {
      const state = stack.pop();
      if (!state) return;
      ctx.globalAlpha = state.alpha;
      ctx.__dash = state.dash;
      [ctx.__sx, ctx.__sy] = state.scale;
    }),
    setTransform: vi.fn(() => {
      ctx.__sx = 1;
      ctx.__sy = 1;
    }),
    translate: vi.fn(),
    scale: vi.fn((x: number, y: number) => {
      ctx.__sx *= x;
      ctx.__sy *= y;
    }),
    rotate: vi.fn(),
    beginPath: vi.fn(() => {
      current = [];
    }),
    closePath: vi.fn(),
    moveTo: vi.fn((x: number, y: number) => {
      current.push([x, y]);
    }),
    lineTo: vi.fn((x: number, y: number) => {
      current.push([x, y]);
    }),
    fill: vi.fn(() => flush(true)),
    stroke: vi.fn((path?: unknown) => {
      // The axes are stroked with no argument; only the curves pass a path.
      if (path === undefined) {
        flush(false);
        return;
      }
      strokes.push({
        path,
        alpha: ctx.globalAlpha,
        dash: ctx.__dash,
        lineWidth: ctx.lineWidth,
        strokeStyle: ctx.strokeStyle,
        scale: scaleNow(),
      });
    }),
    fillText: vi.fn((text: string, x: number, y: number) => {
      fillTexts.push({
        text,
        alpha: ctx.globalAlpha,
        at: [x, y],
        font: ctx.font,
        letterSpacing: ctx.letterSpacing,
        scale: scaleNow(),
      });
    }),
  };

  return { ctx, strokes, fillTexts, paths, setLineDash };
}

/** A DOMMatrix stand-in: the renderer only chains and hands it back. */
function fakeMatrix() {
  const matrix = {
    translateSelf: () => matrix,
    rotateSelf: () => matrix,
  };
  return matrix;
}

function fakeMap(overrides: Record<string, unknown> = {}) {
  return {
    deserializedXYWH: [0, 0, REF_W, REF_H],
    rotate: 0,
    showLiminal: true,
    showVolatile: true,
    showCounterfactual: true,
    showAxisLabels: false,
    ...overrides,
  };
}

function render(model: Record<string, unknown>) {
  const harness = fakeCtx();
  // The renderer takes a renderer, a rough canvas and a viewport bound too, and
  // touches none of the three.
  estuarine(
    model as never,
    harness.ctx as never,
    fakeMatrix() as never,
    undefined as never,
    undefined as never,
    undefined as never
  );
  return harness;
}

describe('estuarine ghost — renderer', () => {
  it('strokes every visible curve dashed and translucent', () => {
    const { strokes, setLineDash } = render(fakeMap());

    expect(strokes).toHaveLength(3);
    for (const stroke of strokes) {
      expect(stroke.alpha).toBe(GHOST_ALPHA);
      expect(stroke.dash).toEqual([...GHOST_DASH]);
    }
    // One `setLineDash` per curve, and never with a solid pattern.
    expect(setLineDash).toHaveBeenCalledTimes(3);
    for (const call of setLineDash.mock.calls) {
      expect(call[0]).toEqual([...GHOST_DASH]);
    }
  });

  it('strokes only the curves whose toggle is on', () => {
    const { strokes, setLineDash } = render(
      fakeMap({ showLiminal: false, showCounterfactual: false })
    );

    expect(strokes).toHaveLength(1);
    expect(strokes[0].path).toBe(estuarineCurves()[1].path);
    expect(setLineDash).toHaveBeenCalledTimes(1);
  });

  it('draws nothing at all when every toggle is off', () => {
    const { strokes, fillTexts, setLineDash } = render(
      fakeMap({
        showLiminal: false,
        showVolatile: false,
        showCounterfactual: false,
      })
    );

    expect(strokes).toHaveLength(0);
    expect(fillTexts).toHaveLength(0);
    expect(setLineDash).not.toHaveBeenCalled();
  });

  it('leaves the legends solid — a name is not a boundary', () => {
    const { fillTexts } = render(fakeMap());

    expect(fillTexts.map(entry => entry.text)).toEqual([
      'LIMINAL',
      'VOLATILE',
      'COUNTER FACTUAL',
    ]);
    for (const entry of fillTexts) expect(entry.alpha).toBe(1);
  });

  it('paints the legend the user renamed, not the one it shipped with', () => {
    // Issue #355: a legend is renamed by double-clicking it, and everything
    // downstream of the canvas — the reading panel, the SVG export — reads the
    // same `estuarineLegendText`, so a word that reaches `fillText` reaches
    // them too. The other two are untouched: one prop per legend.
    const { fillTexts } = render(fakeMap({ liminalLabel: 'SEUIL' }));

    expect(fillTexts.map(entry => entry.text)).toEqual([
      'SEUIL',
      'VOLATILE',
      'COUNTER FACTUAL',
    ]);
  });

  it('builds each Path2D exactly once, on the first paint', () => {
    const first = estuarineCurves();
    render(fakeMap());
    expect(estuarineCurves()).toBe(first);
    expect(first.map(curve => curve.key)).toEqual([
      'liminal',
      'volatile',
      'counterfactual',
    ]);
  });
});

/**
 * The resize contract (PO recette, 26/08/2026).
 *
 * The map used to be letterboxed: stretch the background and the drawing kept
 * its authored proportions, centred, with axes that stopped well short of the
 * new edges. An Estuarine map is a coordinate system — more room means more
 * plane — so both directions now follow the element, while nothing that would
 * be DAMAGED by stretching (stroke widths, arrowheads, words) is stretched.
 */
describe('estuarine — a stretched map stretches', () => {
  /** Size of the sub-path the axes are stroked as: e then t, four points. */
  const axesOf = (paths: SubPathRecord[]) =>
    paths.find(path => !path.filled && path.points.length === 4);

  const headsOf = (paths: SubPathRecord[]) => paths.filter(path => path.filled);

  /**
   * The three triangles EXACTLY as the official SVG draws them, transcribed
   * here as plain numbers rather than rebuilt from {@link ARROWHEADS}.
   *
   * On purpose: these literals are the only thing in the suite that still
   * knows what the shipped drawing looks like. `ARROWHEADS` was rewritten from
   * three absolute vertices into an axis-anchored declaration, and a spec that
   * recomputed the expectation from the new declaration would have agreed with
   * any transcription error. Vertex order is the renderer's walk — tip, then
   * the base across the axis.
   */
  const AUTHORED_HEADS: Point[][] = [
    // e — top
    [
      [43.5, 72],
      [30, 100],
      [57, 100],
    ],
    // e — bottom
    [
      [43.5, 785],
      [57, 758],
      [30, 758],
    ],
    // t — right
    [
      [643, 649],
      [613, 636],
      [613, 662],
    ],
  ];

  /** The authored baseline of each italic axis letter, `e` then `t`. */
  const AUTHORED_LETTERS: Point[] = [
    [14, 138],
    [580, 685],
  ];

  const scaled = (points: Point[][], k: number) =>
    points.map(head => head.map(([x, y]) => [x * k, y * k]));

  it('is exactly the authored drawing at the authored ratio', () => {
    const { paths, fillTexts, strokes } = render(
      fakeMap({ showAxisLabels: true })
    );

    // The e axis over the full authored height, the t axis over its width.
    expect(axesOf(paths)?.points).toEqual([
      [E_AXIS.x, E_AXIS.y1],
      [E_AXIS.x, E_AXIS.y2],
      [T_AXIS.x1, T_AXIS.y],
      [T_AXIS.x2, T_AXIS.y],
    ]);
    expect(axesOf(paths)?.lineWidth).toBeCloseTo(AXIS_WIDTH, 9);

    // Three arrowheads, vertex for vertex where the SVG put them.
    expect(headsOf(paths).map(head => head.points)).toEqual(AUTHORED_HEADS);

    // Every legend on its authored anchor, at its authored size.
    expect(fillTexts.map(entry => entry.at)).toEqual([
      [LABELS.liminal.x, LABELS.liminal.y],
      [LABELS.volatile.x, LABELS.volatile.y],
      [LABELS.counterfactual.x, LABELS.counterfactual.y],
      ...AUTHORED_LETTERS,
    ]);
    expect(fillTexts[0].font).toContain(`${LABELS.liminal.size}px`);
    expect(fillTexts[4].font).toContain(`${AXIS_LABELS.size}px`);

    // And the curves stroked at their nominal width, unit scale, no letterbox.
    for (const stroke of strokes) expect(stroke.scale).toEqual([1, 1]);
    expect(strokes.map(stroke => stroke.lineWidth)).toEqual(
      estuarineCurves().map(curve => curve.width)
    );
  });

  it('scales the whole drawing when the ratio is kept', () => {
    const { paths, fillTexts, strokes } = render(
      fakeMap({
        deserializedXYWH: [0, 0, REF_W * 3, REF_H * 3],
        showAxisLabels: true,
      })
    );

    // Three times the authored coordinates, everywhere: no letterbox offset
    // has to be added or subtracted, which is what makes this a pure scale-up
    // of the picture that shipped before the fix.
    expect(axesOf(paths)?.points).toEqual([
      [E_AXIS.x * 3, E_AXIS.y1 * 3],
      [E_AXIS.x * 3, E_AXIS.y2 * 3],
      [T_AXIS.x1 * 3, T_AXIS.y * 3],
      [T_AXIS.x2 * 3, T_AXIS.y * 3],
    ]);
    expect(axesOf(paths)?.lineWidth).toBeCloseTo(AXIS_WIDTH * 3, 9);
    expect(headsOf(paths).map(head => head.points)).toEqual(
      scaled(AUTHORED_HEADS, 3)
    );
    // Birth size is this very case (`MAP_SCALE = 1.2`): a map that has not been
    // stretched paints the authored picture, only bigger. Including the letters.
    expect(fillTexts.slice(3).map(entry => entry.at)).toEqual(
      AUTHORED_LETTERS.map(([x, y]) => [x * 3, y * 3])
    );
    expect(fillTexts[0].at).toEqual([
      LABELS.liminal.x * 3,
      LABELS.liminal.y * 3,
    ]);
    expect(fillTexts[0].font).toContain(`${LABELS.liminal.size * 3}px`);
    for (const stroke of strokes) expect(stroke.scale).toEqual([3, 3]);
    expect(strokes[0].lineWidth).toBeCloseTo(estuarineCurves()[0].width, 9);
  });

  it('runs the time axis to the real width when pulled sideways', () => {
    const { paths } = render(
      fakeMap({ deserializedXYWH: [0, 0, REF_W * 2, REF_H] })
    );
    const axes = axesOf(paths);

    // The t axis now covers twice the reference span — the same FRACTION of a
    // width that doubled — instead of stopping where the old letterbox left it.
    expect(axes?.points[2]).toEqual([T_AXIS.x1 * 2, T_AXIS.y]);
    expect(axes?.points[3]).toEqual([T_AXIS.x2 * 2, T_AXIS.y]);
    expect((T_AXIS.x2 * 2) / (REF_W * 2)).toBeCloseTo(T_AXIS.x2 / REF_W, 9);

    // The e axis keeps the untouched height, at the stretched x.
    expect(axes?.points[0]).toEqual([E_AXIS.x * 2, E_AXIS.y1]);
    expect(axes?.points[1]).toEqual([E_AXIS.x * 2, E_AXIS.y2]);
  });

  /**
   * The ratios a user actually reaches by dragging a corner, plus the mild one
   * the suite already covered. 1600 × 400 and 400 × 1600 are the two shapes the
   * bug report was filed on: one pulls the t axis far past the isotropic scale,
   * the other does the same to the e axis, so together they catch the defect
   * whichever axis it lands on.
   */
  const RATIOS: [number, number][] = [
    [REF_W, REF_H],
    [REF_W * 2, REF_H],
    [1600, 400],
    [400, 1600],
  ];

  /**
   * GUARD (issue #390 / bug F). Would have caught: an arrowhead whose tip is
   * anchored proportionally while its base is rebuilt at the isotropic scale.
   * That mix left a 29-unit gap between the t axis and its head at 1600 × 400
   * and buried the head 17 units inside the stroke at 400 × 1600 — the head
   * only sat right where `sx === sy === strokeScale`.
   */
  it('welds every arrowhead to the end of its axis, at every ratio', () => {
    for (const [w, h] of RATIOS) {
      const { paths } = render(fakeMap({ deserializedXYWH: [0, 0, w, h] }));
      const heads = headsOf(paths);
      const axes = axesOf(paths);
      const k = estuarineFit(w, h).strokeScale;
      const at = `${w}×${h}`;

      expect(heads, at).toHaveLength(3);
      // The four axis endpoints the stroke visits: e top, e bottom, t right.
      // (`points[2]` is the t axis's LEFT end, which carries no head.)
      const ends = [axes!.points[0], axes!.points[1], axes!.points[3]];

      heads.forEach((head, index) => {
        const spec = ARROWHEADS[index];
        const [dx, dy] = spec.dir;
        const [end, [tipX, tipY], v1, v2] = [ends[index], ...head.points];
        /** Distance from the axis end, measured ALONG the axis, outwards. */
        const along = (p: Point) => (p[0] - end[0]) * dx + (p[1] - end[1]) * dy;
        /** Distance from the axis, measured ACROSS it. */
        const across = (p: Point) =>
          (p[0] - end[0]) * -dy + (p[1] - end[1]) * dx;

        // The tip is a FIXED distance past the end of the stroke…
        expect(along([tipX, tipY]), `tip ${at}`).toBeCloseTo(spec.tip * k, 9);
        expect(across([tipX, tipY]), `tip ${at}`).toBeCloseTo(0, 9);
        // …and the base a fixed distance SHORT of it, so the stroke always
        // dies inside the triangle. Negative — an overlap, never a gap.
        for (const v of [v1, v2]) {
          expect(along(v), `base ${at}`).toBeCloseTo(-spec.overlap * k, 9);
        }
        expect(across(v1), `base ${at}`).toBeCloseTo(-spec.halfWidth * k, 9);
        expect(across(v2), `base ${at}`).toBeCloseTo(spec.halfWidth * k, 9);
      });
    }
  });

  /**
   * GUARD (issue #390 / bug F). Would have caught: axis letters placed at
   * absolute authored coordinates projected by `sx`/`sy` while the glyph was
   * typed at the isotropic scale — the `t` climbing onto its own axis at
   * 1600 × 400 (gap −83 instead of −36) and falling away from it at 400 × 1600.
   */
  it('keeps each axis letter a constant gap from its axis', () => {
    for (const [w, h] of RATIOS) {
      const { paths, fillTexts } = render(
        fakeMap({ deserializedXYWH: [0, 0, w, h], showAxisLabels: true })
      );
      const axes = axesOf(paths);
      const k = estuarineFit(w, h).strokeScale;
      const at = `${w}×${h}`;

      // The letters are the last two words painted: `e`, then `t`.
      const letters = fillTexts.slice(3);
      expect(
        letters.map(entry => entry.text),
        at
      ).toEqual(['e', 't']);

      // `e` names the TOP of the e axis, `t` the RIGHT end of the t axis.
      const anchors = [axes!.points[0], axes!.points[3]];
      const specs = [AXIS_LABELS.e, AXIS_LABELS.t];

      letters.forEach((entry, index) => {
        // The gap rides the very factor the glyph does — so it is the SAME
        // gap, in glyph widths, on a map pulled either way.
        expect(entry.at[0] - anchors[index][0], `${at} x`).toBeCloseTo(
          specs[index].dx * k,
          9
        );
        expect(entry.at[1] - anchors[index][1], `${at} y`).toBeCloseTo(
          specs[index].dy * k,
          9
        );
        // Element coordinates, so the glyphs come out of the font undistorted.
        expect(entry.scale, at).toEqual([1, 1]);
        expect(entry.font, at).toContain(`${AXIS_LABELS.size * k}px`);
      });
    }
  });

  it('never draws a word inside the stretch', () => {
    const { fillTexts } = render(
      fakeMap({
        deserializedXYWH: [0, 0, REF_W * 2, REF_H],
        showAxisLabels: true,
      })
    );
    const { sx, sy, strokeScale } = estuarineFit(REF_W * 2, REF_H);

    /** The three LEGENDS: authored anchor, then authored size. */
    const expected = [
      [LABELS.liminal.x, LABELS.liminal.y, LABELS.liminal.size],
      [LABELS.volatile.x, LABELS.volatile.y, LABELS.volatile.size],
      [
        LABELS.counterfactual.x,
        LABELS.counterfactual.y,
        LABELS.counterfactual.size,
      ],
    ];

    // Three legends and the two axis letters, checked just above.
    expect(fillTexts).toHaveLength(expected.length + 2);
    fillTexts.slice(0, expected.length).forEach((entry, index) => {
      const [x, y, size] = expected[index];
      // Element coordinates, so the glyphs come out of the font undistorted.
      expect(entry.scale).toEqual([1, 1]);
      // A legend names a CURVE, not an axis end, so its anchor stays the
      // proportional one: it has to travel with the boundary it names.
      expect(entry.at[0]).toBeCloseTo(x * sx, 9);
      expect(entry.at[1]).toBeCloseTo(y * sy, 9);
      // One size, from BOTH factors: strictly between what the narrow side
      // and the wide side would each have given on their own.
      expect(entry.font).toContain(`${size * strokeScale}px`);
      expect(size * strokeScale).toBeGreaterThan(size * sy);
      expect(size * strokeScale).toBeLessThan(size * sx);
    });

    // Letter-spacing rides the same isotropic factor as the glyphs.
    expect(fillTexts[0].letterSpacing).toBe(
      `${LABEL_LETTER_SPACING * strokeScale}px`
    );
    for (const entry of fillTexts) expect(entry.scale).toEqual([1, 1]);
  });

  it('stretches the curves and thins the pen to compensate', () => {
    const w = REF_W * 2;
    const { strokes } = render(fakeMap({ deserializedXYWH: [0, 0, w, REF_H] }));
    const fit = estuarineFit(w, REF_H);

    expect(fit.sx).toBeCloseTo(2, 9);
    expect(fit.sy).toBeCloseTo(1, 9);
    expect(strokes).toHaveLength(3);
    for (const [index, stroke] of strokes.entries()) {
      // A boundary is negotiated ACROSS the plane: it covers the whole map.
      expect(stroke.scale[0]).toBeCloseTo(2, 9);
      expect(stroke.scale[1]).toBeCloseTo(1, 9);
      // The pen is narrowed so the stretch does not fatten the ghost.
      expect(stroke.lineWidth).toBeCloseTo(
        estuarineCurves()[index].width * fit.curveLineScale,
        9
      );
      expect(fit.curveLineScale).toBeLessThan(1);
    }
  });
});

describe('estuarineFit', () => {
  it('collapses to a single factor at the authored ratio', () => {
    for (const k of [0.5, 1, 4]) {
      const fit = estuarineFit(REF_W * k, REF_H * k);
      expect(fit.sx).toBeCloseTo(k, 9);
      expect(fit.sy).toBeCloseTo(k, 9);
      expect(fit.strokeScale).toBeCloseTo(k, 9);
      // No compensation to make: nothing is deformed.
      expect(fit.curveLineScale).toBeCloseTo(1, 9);
    }
  });

  it('follows each side independently once the ratio breaks', () => {
    const fit = estuarineFit(REF_W * 2, REF_H / 2);
    expect(fit.sx).toBeCloseTo(2, 9);
    expect(fit.sy).toBeCloseTo(0.5, 9);
    // Geometric mean: a map stretched one way and squashed the other keeps a
    // stroke of the size it had.
    expect(fit.strokeScale).toBeCloseTo(1, 9);
    expect(fit.curveLineScale).toBeCloseTo(1 / 1.25, 9);
  });
});

describe('ghostRevealFrame', () => {
  it('paints nothing at the very start of the reveal', () => {
    expect(ghostRevealFrame(0)).toEqual({
      alpha: 0,
      dashOffset: 0,
      done: false,
    });
  });

  it('is half lit and half marched at mid-course', () => {
    const frame = ghostRevealFrame(GHOST_REVEAL_MS / 2);
    expect(frame.alpha).toBeCloseTo(GHOST_PEAK_ALPHA / 2, 6);
    expect(frame.dashOffset).toBeCloseTo(-GHOST_DASH_TRAVEL / 2, 6);
    expect(frame.done).toBe(false);
  });

  it('peaks exactly at the end of the reveal, march complete', () => {
    const frame = ghostRevealFrame(GHOST_REVEAL_MS);
    expect(frame.alpha).toBeCloseTo(GHOST_PEAK_ALPHA, 6);
    expect(frame.dashOffset).toBeCloseTo(-GHOST_DASH_TRAVEL, 6);
    expect(frame.done).toBe(false);
  });

  it('decays without marching any further', () => {
    const frame = ghostRevealFrame(GHOST_REVEAL_MS + GHOST_DECAY_MS / 2);
    expect(frame.alpha).toBeCloseTo(GHOST_PEAK_ALPHA / 2, 6);
    expect(frame.dashOffset).toBeCloseTo(-GHOST_DASH_TRAVEL, 6);
    expect(frame.done).toBe(false);
  });

  it('is over at the total duration, and stays over', () => {
    for (const elapsed of [GHOST_TOTAL_MS, GHOST_TOTAL_MS + 1, 1e9]) {
      expect(ghostRevealFrame(elapsed)).toEqual({
        alpha: 0,
        dashOffset: 0,
        done: true,
      });
    }
  });

  it('answers a clock that went backwards instead of trusting it', () => {
    for (const elapsed of [-1, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(ghostRevealFrame(elapsed)).toEqual({
        alpha: 0,
        dashOffset: 0,
        done: false,
      });
    }
  });
});

describe('reduced motion', () => {
  let overlay: EstuarineGhostOverlay;

  const stubMotion = (reduce: boolean) => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: reduce, media: query }))
    );
  };

  beforeEach(() => {
    overlay = new EstuarineGhostOverlay({} as never);
  });

  it('reads the media query and reports the preference', () => {
    stubMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    stubMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('assumes motion is fine where `matchMedia` does not exist', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('makes a reveal a complete no-op — the ghost is already the end state', () => {
    stubMotion(true);
    overlay.reveal('map-1');
    expect(overlay.isAnimating(performance.now())).toBe(false);
    overlay.dispose();
  });

  it('animates when the user has asked for nothing', () => {
    stubMotion(false);
    overlay.reveal('map-1');
    expect(overlay.isAnimating(performance.now())).toBe(true);
    overlay.dispose();
    // Disposing forgets every reveal: no clock survives the surface.
    expect(overlay.isAnimating(performance.now())).toBe(false);
  });

  it('is re-read at every reveal, never cached', () => {
    stubMotion(false);
    overlay.reveal('map-1');
    expect(overlay.isAnimating(performance.now())).toBe(true);

    overlay.clear();
    stubMotion(true);
    overlay.reveal('map-2');
    expect(overlay.isAnimating(performance.now())).toBe(false);
    overlay.dispose();
  });
});
