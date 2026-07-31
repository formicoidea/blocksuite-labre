import { spotlightSet } from '@labre/affine-block-surface';
import type { ConnectorElementModel } from '@labre/affine-model';
import { describe, expect, it, vi } from 'vitest';

import { REF_W, VENN } from '../consts';
import { edgyBoard } from '../board-renderer';
import { edgy } from '../element-renderer';
import { NODE_SIZE } from '../node/consts';
import {
  EDGY_DYNAMIC_NODES,
  EDGY_DYNAMIC_RELATIONS,
  edgyDynamicTemplate,
  edgyTemplateCategory,
} from '../templates';

// ── shared stubs (same approach as the wardley renderer spec) ──────────

function fakeCtx() {
  const ctx = {
    fillStyle: '' as string | CanvasGradient,
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    lineCap: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    setTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    roundRect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, spies: ctx };
}

function fakeMatrix() {
  const m = { translateSelf: () => m, rotateSelf: () => m };
  return m as unknown as DOMMatrix;
}

// ── template composition ───────────────────────────────────────────────

type ElementsJSON = Record<string, Record<string, unknown>>;

const elements = (
  edgyDynamicTemplate.content as unknown as {
    blocks: { children: { props: { elements: ElementsJSON } }[] };
  }
).blocks.children[0].props.elements;

const byType = (type: string) =>
  Object.values(elements).filter(el => el.type === type);

describe('EDGY dynamic template', () => {
  it('is registered in the EDGY template category', () => {
    const templates = edgyTemplateCategory.templates;
    expect(Array.isArray(templates)).toBe(true);
    expect(
      (templates as { name: string }[]).some(t => t.name === 'EDGY dynamic')
    ).toBe(true);
  });

  it('contains the background (without writings), 12 nodes and 24 connectors', () => {
    expect(byType('edgy')).toHaveLength(1);
    expect(byType('edgyNode')).toHaveLength(12);
    expect(byType('connector')).toHaveLength(24);

    const bg = byType('edgy')[0];
    expect(bg.showLabels).toBe(false);
    expect(bg.showPictos).toBe(false);
  });

  it('labels every connector with its canonical verb, attached to valid nodes', () => {
    const nodeKeys = new Set(Object.keys(EDGY_DYNAMIC_NODES));
    const connectors = Object.values(elements).filter(
      el => el.type === 'connector'
    );

    const verbs = connectors.map(el => {
      const text = el.text as { delta: { insert: string }[] };
      // hasLabel() requires labelXYWH — without it the verb never shows.
      expect(el.labelXYWH).toBeDefined();
      expect(nodeKeys.has((el.source as { id: string }).id)).toBe(true);
      expect(nodeKeys.has((el.target as { id: string }).id)).toBe(true);
      return text.delta.map(d => d.insert).join('');
    });

    expect(verbs.sort()).toEqual(
      EDGY_DYNAMIC_RELATIONS.map(([, , verb]) => verb).sort()
    );
  });

  it('places every node fully inside its Venn zone', () => {
    // Derive the actual background geometry from the template data.
    const bg = byType('edgy')[0];
    const [, , w] = JSON.parse(bg.xywh as string) as number[];
    const k = w / REF_W;
    const R = VENN.R * k;
    const cx = VENN.cx * k;
    const cy = VENN.cy * k;
    const r0 = VENN.r0 * k;
    const A = { x: cx - 0.866 * r0, y: cy - 0.5 * r0 }; // Identity
    const B = { x: cx + 0.866 * r0, y: cy - 0.5 * r0 }; // Architecture
    const C = { x: cx, y: cy + r0 }; // Experience

    // Which circles each element must be fully inside (and fully outside the
    // others): facet elements in their exclusive crescent, intersections in
    // their lens.
    const ZONES: Record<string, string> = {
      content: 'A',
      purpose: 'A',
      story: 'A',
      process: 'B',
      asset: 'B',
      capability: 'B',
      task: 'C',
      journey: 'C',
      channel: 'C',
      organisation: 'AB',
      brand: 'AC',
      product: 'BC',
    };

    for (const [key, node] of Object.entries(EDGY_DYNAMIC_NODES)) {
      const nw = node.w ?? NODE_SIZE[node.kind].w;
      const nh = NODE_SIZE[node.kind].h;
      const corners = [
        [node.cx - nw / 2, node.cy - nh / 2],
        [node.cx + nw / 2, node.cy - nh / 2],
        [node.cx - nw / 2, node.cy + nh / 2],
        [node.cx + nw / 2, node.cy + nh / 2],
      ];
      for (const [circle, center] of [
        ['A', A],
        ['B', B],
        ['C', C],
      ] as const) {
        const mustBeInside = ZONES[key].includes(circle);
        for (const [x, y] of corners) {
          const d = Math.hypot(x - center.x, y - center.y);
          expect(
            mustBeInside ? d < R : d > R,
            `${key} corner (${x},${y}) should be ${mustBeInside ? 'inside' : 'outside'} circle ${circle} (d=${d.toFixed(1)}, R=${R})`
          ).toBe(true);
        }
      }
    }
  });
});

// ── facets renderer: showPictos gating ─────────────────────────────────

const renderEdgy = edgy as unknown as (
  model: unknown,
  ctx: CanvasRenderingContext2D,
  matrix: DOMMatrix
) => void;

function facetsModel(over: Record<string, unknown> = {}) {
  return {
    deserializedXYWH: [0, 0, 680, 400],
    rotate: 0,
    showLabels: false,
    showPictos: true,
    identityLabel: 'Identity',
    architectureLabel: 'Architecture',
    experienceLabel: 'Experience',
    ...over,
  } as never;
}

describe('edgy facets renderer', () => {
  it('skips the pictograms when showPictos is false', () => {
    const on = fakeCtx();
    renderEdgy(facetsModel(), on.ctx, fakeMatrix());
    const off = fakeCtx();
    renderEdgy(facetsModel({ showPictos: false }), off.ctx, fakeMatrix());

    // The Venn itself still draws (same base arc count), the picto arcs
    // (lens, network dots, sun) disappear.
    expect(off.spies.arc.mock.calls.length).toBeGreaterThan(0);
    expect(on.spies.arc.mock.calls.length).toBeGreaterThan(
      off.spies.arc.mock.calls.length
    );
    // No labels in either case (showLabels false).
    expect(on.spies.fillText).not.toHaveBeenCalled();
  });
});

// ── board renderer ─────────────────────────────────────────────────────

const renderBoard = edgyBoard as unknown as (
  model: unknown,
  ctx: CanvasRenderingContext2D,
  matrix: DOMMatrix
) => void;

describe('edgy board renderer', () => {
  it('draws a white rounded rectangle with a border', () => {
    const { ctx, spies } = fakeCtx();
    renderBoard(
      { deserializedXYWH: [0, 0, 1600, 1000], rotate: 0 } as never,
      ctx,
      fakeMatrix()
    );
    expect(spies.roundRect).toHaveBeenCalledTimes(1);
    expect(spies.fill).toHaveBeenCalled();
    expect(spies.stroke).toHaveBeenCalled();
  });
});

// ── spotlight connected set ────────────────────────────────────────────

type ConnectorStub = { id: string; type: string; source?: { id?: string }; target?: { id?: string } };
const connector = (id: string, src?: string, dst?: string): ConnectorStub => ({
  id,
  type: 'connector',
  source: { id: src },
  target: { id: dst },
});

describe('spotlightSet', () => {
  const c1 = connector('c1', 'n1', 'n2');
  const c2 = connector('c2', 'n3', 'n1');
  const byId = (id: string) =>
    [c1, c2].filter(
      c => c.source?.id === id || c.target?.id === id
    ) as unknown as ConnectorElementModel[];

  it('keeps a hovered node, its connectors and their endpoints', () => {
    const keep = spotlightSet(
      { id: 'n1', type: 'edgyNode' } as never,
      byId
    );
    expect(keep).toEqual(new Set(['n1', 'c1', 'n2', 'c2', 'n3']));
  });

  it('keeps a hovered connector and its two endpoints', () => {
    const keep = spotlightSet(c1 as never, byId);
    expect(keep).toEqual(new Set(['c1', 'n1', 'n2']));
  });

  it('keeps an isolated node alone', () => {
    const keep = spotlightSet(
      { id: 'lonely', type: 'edgyNode' } as never,
      () => []
    );
    expect(keep).toEqual(new Set(['lonely']));
  });
});
