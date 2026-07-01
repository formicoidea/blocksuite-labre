import { describe, expect, it, vi } from 'vitest';

import { MARGIN } from '../consts';
import { wardley } from '../element-renderer';

// The renderer only reads (model, ctx, matrix); cast to call with those.
const render = wardley as unknown as (
  model: unknown,
  ctx: CanvasRenderingContext2D,
  matrix: DOMMatrix
) => void;

type Seg = { x1: number; y1: number; x2: number; y2: number };

/**
 * Canvas-context stub recording the straight segments (moveTo→lineTo) the
 * renderer draws, plus enough surface for the gradient painter.
 */
function fakeCtx() {
  const segments: Seg[] = [];
  let mx = 0;
  let my = 0;
  const ctx = {
    fillStyle: '' as string | CanvasGradient,
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn((x: number, y: number) => {
      mx = x;
      my = y;
    }),
    lineTo: vi.fn((x: number, y: number) => {
      segments.push({ x1: mx, y1: my, x2: x, y2: y });
      mx = x;
      my = y;
    }),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    segments,
    createLinearGradient: ctx.createLinearGradient,
    fillRect: ctx.fillRect,
  };
}

/** Chainable identity matrix stub (renderer only calls *Self mutators). */
function fakeMatrix() {
  const m = { translateSelf: () => m, rotateSelf: () => m };
  return m as unknown as DOMMatrix;
}

/** Benefit background with every line-drawing overlay off unless overridden. */
function benefitModel(over: Record<string, unknown> = {}, w = 800, h = 600) {
  return {
    deserializedXYWH: [0, 0, w, h],
    rotate: 0,
    variant: 'benefit',
    showGradient: true,
    banded: false,
    showColumnDividers: false,
    showXAxis: false,
    showYAxis: false,
    showColumnLabels: false,
    showCornerLabels: false,
    showVisibilityLabels: false,
    ...over,
  } as never;
}

const H = 600;
const py0 = MARGIN.top;
const py1 = H - MARGIN.bottom;

const isHorizontal = (s: Seg) => s.y1 === s.y2 && s.x1 !== s.x2;

describe('wardley benefit background', () => {
  it('paints the gradient but no interior horizontal asymptote line', () => {
    const { ctx, segments, createLinearGradient, fillRect } = fakeCtx();
    render(benefitModel(), ctx, fakeMatrix());

    // Non-regression: the benefit gradient is still painted.
    expect(createLinearGradient).toHaveBeenCalled();
    expect(fillRect).toHaveBeenCalled();

    // Correction: with all overlays off, no horizontal line is drawn inside the
    // plot. The removed asymptote was exactly one such full-width segment at
    // ~30% up from the X axis (pre-fix this length was 1).
    const interiorH = segments.filter(
      s => isHorizontal(s) && s.y1 > py0 && s.y1 < py1
    );
    expect(interiorH).toHaveLength(0);
  });

  it('still draws the X axis when enabled (guard against over-deletion)', () => {
    const { ctx, segments } = fakeCtx();
    render(benefitModel({ showXAxis: true }), ctx, fakeMatrix());

    // The X axis is a legitimate horizontal segment at the plot bottom.
    const axis = segments.filter(
      s => isHorizontal(s) && Math.abs(s.y1 - py1) < 0.001
    );
    expect(axis.length).toBeGreaterThan(0);
  });
});
