import { describe, expect, it, vi } from 'vitest';

import { coreDomain } from '../core-domain/element-renderer';
import { coreDomainTemplateCategory } from '../templates';

const renderChart = coreDomain as unknown as (
  model: unknown,
  ctx: CanvasRenderingContext2D,
  matrix: DOMMatrix
) => void;

function fakeCtx() {
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
  };
  return ctx as unknown as CanvasRenderingContext2D & {
    fillRect: ReturnType<typeof vi.fn>;
    fillText: ReturnType<typeof vi.fn>;
  };
}

function fakeMatrix() {
  const m = {
    translateSelf: () => m,
    rotateSelf: () => m,
  };
  return m as unknown as DOMMatrix;
}

function chartModel(showZones = true, showLabels = true) {
  return {
    deserializedXYWH: [0, 0, 900, 820],
    rotate: 0,
    showZones,
    showLabels,
  } as never;
}

describe('core domain chart renderer', () => {
  it('draws the four zone bands and the zone names by default', () => {
    const ctx = fakeCtx();
    renderChart(chartModel(), ctx, fakeMatrix());
    expect(ctx.fillRect).toHaveBeenCalledTimes(4); // four translucent bands
    expect(ctx.fillText).toHaveBeenCalledWith('Core', expect.any(Number), expect.any(Number));
    expect(ctx.stroke).toHaveBeenCalled(); // axes
  });

  it('hides the bands when showZones is false', () => {
    const ctx = fakeCtx();
    renderChart(chartModel(false, true), ctx, fakeMatrix());
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('hides the axis titles when showLabels is false', () => {
    const ctx = fakeCtx();
    renderChart(chartModel(true, false), ctx, fakeMatrix());
    const labels = ctx.fillText.mock.calls.map(c => c[0]);
    expect(labels).not.toContain('Business differentiation');
  });
});

describe('core domain template category', () => {
  it('catalogues the chart background', () => {
    expect(coreDomainTemplateCategory.name).toBe('Core Domain Chart');
    const names = (coreDomainTemplateCategory.templates as { name?: string }[]).map(
      t => t.name
    );
    expect(names).toContain('Core Domain Chart');
  });
});
