import { describe, expect, it, vi } from 'vitest';

import { coreDomain } from '../core-domain/element-renderer';
import {
  aggregateTemplateCategory,
  contextMapTemplateCategory,
  coreDomainTemplateCategory,
  eventStormingTemplateCategory,
} from '../templates';
import {
  CD_SUBDOMAINS,
  CM_RELATIONSHIPS,
  ES_HOTSPOT,
  ES_STICKIES,
} from '../shared/consts';

const HEX = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;

describe('ddd shared presets', () => {
  it('every Event Storming sticky has hex fill + text colours', () => {
    for (const s of ES_STICKIES) {
      expect(s.fill).toMatch(HEX);
      expect(s.text).toMatch(HEX);
      expect(s.label.length).toBeGreaterThan(0);
    }
    expect(ES_HOTSPOT.fill).toMatch(HEX);
  });

  it('exposes the nine context-map relationship patterns', () => {
    expect(CM_RELATIONSHIPS).toHaveLength(9);
    const kinds = CM_RELATIONSHIPS.map(r => r.kind);
    expect(new Set(kinds).size).toBe(9); // no duplicate units across the menu
    expect(kinds).toContain('acl');
    expect(kinds).toContain('bbom');
  });

  it('every Core Domain sub-domain has a hex fill', () => {
    for (const d of CD_SUBDOMAINS) expect(d.fill).toMatch(HEX);
  });
});

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

describe('ddd template categories', () => {
  it('contributes one section per senior button plus a standalone aggregate', () => {
    expect(eventStormingTemplateCategory.name).toBe('Event Storming');
    expect(coreDomainTemplateCategory.name).toBe('Core Domain Chart');
    expect(contextMapTemplateCategory.name).toBe('Context Map');
    expect(aggregateTemplateCategory.name).toBe('Aggregate Design Canvas');

    const names = (c: { templates: unknown }) =>
      (c.templates as { name?: string }[]).map(t => t.name);
    // each section catalogues its own components
    expect(names(eventStormingTemplateCategory)).toContain(
      'Event Storming — Hotspot'
    );
    expect(names(coreDomainTemplateCategory)).toContain('Core Domain Chart');
    expect(names(contextMapTemplateCategory)).toContain(
      'Context Map — Cloud / System'
    );
    expect(names(aggregateTemplateCategory)).toEqual(['Aggregate Design Canvas']);
  });
});
