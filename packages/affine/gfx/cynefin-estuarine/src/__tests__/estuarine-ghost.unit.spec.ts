import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  estuarine,
  estuarineCurves,
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

interface StrokeRecord {
  path: unknown;
  alpha: number;
  dash: readonly number[];
  lineWidth: number;
  strokeStyle: string;
}

interface FillTextRecord {
  text: string;
  alpha: number;
}

/**
 * A 2D context stand-in that records what the renderer actually asked for.
 *
 * It emulates `save`/`restore` over the two pieces of state this test is about
 * — the alpha and the dash — because the whole claim being checked is that the
 * ghost's translucency and dashing do NOT leak onto the legend drawn right
 * after it.
 */
function fakeCtx() {
  const strokes: StrokeRecord[] = [];
  const fillTexts: FillTextRecord[] = [];
  const setLineDash = vi.fn((dash: number[]) => {
    ctx.__dash = dash;
  });
  const stack: { alpha: number; dash: readonly number[] }[] = [];

  const ctx = {
    __dash: [] as readonly number[],
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
      stack.push({ alpha: ctx.globalAlpha, dash: ctx.__dash });
    }),
    restore: vi.fn(() => {
      const state = stack.pop();
      if (!state) return;
      ctx.globalAlpha = state.alpha;
      ctx.__dash = state.dash;
    }),
    setTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn((path?: unknown) => {
      // The axes are stroked with no argument; only the curves pass a path.
      if (path === undefined) return;
      strokes.push({
        path,
        alpha: ctx.globalAlpha,
        dash: ctx.__dash,
        lineWidth: ctx.lineWidth,
        strokeStyle: ctx.strokeStyle,
      });
    }),
    fillText: vi.fn((text: string) => {
      fillTexts.push({ text, alpha: ctx.globalAlpha });
    }),
  };

  return { ctx, strokes, fillTexts, setLineDash };
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
    deserializedXYWH: [0, 0, 690, 801],
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
