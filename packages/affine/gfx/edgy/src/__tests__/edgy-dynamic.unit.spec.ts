import { spotlightSet } from '@labre/affine-block-surface';
import type { ConnectorElementModel } from '@labre/affine-model';
import { describe, expect, it, vi } from 'vitest';

import { VENN } from '../consts';
import { edgyBoard } from '../board-renderer';
import { edgy } from '../element-renderer';
import { NODE_SIZE } from '../node/consts';
import { EDGY_ROLE, EDGY_VERB_ROLE } from '../roles';
import {
  DYN_SCALE,
  dynToModel,
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
    expect(bg.cropToCircles).toBe(true);
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

  it('stamps the background, the twelve elements and the verbs with their roles', () => {
    const bg = byType('edgy')[0];
    expect(bg.role).toBe(EDGY_ROLE.facets);

    for (const key of Object.keys(EDGY_DYNAMIC_NODES)) {
      expect(elements[key].role, `${key} carries no role`).toBe(
        EDGY_ROLE[key as keyof typeof EDGY_DYNAMIC_NODES]
      );
    }

    EDGY_DYNAMIC_RELATIONS.forEach(([, , verb], i) => {
      expect(elements[`rel${i}`].role).toBe(EDGY_VERB_ROLE[verb]);
    });
    // The verb ALSO stays a visible label: the role is what the engine reads,
    // the text is what the reader reads.
    expect(byType('connector').every(el => el.text !== undefined)).toBe(true);
  });

  it('leaves the illustrative templates neutral (no role, never evaluated)', () => {
    for (const name of [
      'Customer journey',
      'Service blueprint',
      'Organisation chart',
      'Facets overview',
    ]) {
      const template = edgyTemplateCategory.templates.find(
        t => (t as { name: string }).name === name
      )!;
      const els = (
        template.content as unknown as {
          blocks: { children: { props: { elements: ElementsJSON } }[] };
        }
      ).blocks.children[0].props.elements;
      for (const [key, el] of Object.entries(els)) {
        expect(el.role, `${name}/${key} should stay neutral`).toBeUndefined();
      }
    }
  });

  it('lays the twelve stamped nodes out with no overlap at all', () => {
    // `edgy.overlapping-artefacts` only sees ROLE-carrying elements, so the
    // dynamic template is the one factory layout it can judge. Its closest pair
    // must clear the rule's 4-unit penetration threshold with room to spare.
    const boxes = Object.entries(EDGY_DYNAMIC_NODES).map(([key, node]) => {
      const nw = node.w ?? NODE_SIZE[node.kind].w;
      const nh = NODE_SIZE[node.kind].h;
      const [mx, my] = dynToModel(node.cx, node.cy);
      return { key, x: mx - nw / 2, y: my - nh / 2, w: nw, h: nh };
    });

    let worst = -Infinity;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        // Penetration depth, the same min(overlapX, overlapY) the engine uses:
        // negative means the two boxes are apart along at least one axis.
        const depth = Math.min(
          Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
          Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        );
        worst = Math.max(worst, depth);
      }
    }
    expect(worst).toBeLessThanOrEqual(0);
  });

  it('places every node fully inside its Venn zone', () => {
    const R = VENN.R * DYN_SCALE;
    const toPoint = ([x, y]: [number, number]) => ({ x, y });
    const A = toPoint(
      dynToModel(VENN.cx - 0.866 * VENN.r0, VENN.cy - 0.5 * VENN.r0)
    ); // Identity
    const B = toPoint(
      dynToModel(VENN.cx + 0.866 * VENN.r0, VENN.cy - 0.5 * VENN.r0)
    ); // Architecture
    const C = toPoint(dynToModel(VENN.cx, VENN.cy + VENN.r0)); // Experience

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
      const [mx, my] = dynToModel(node.cx, node.cy);
      const corners = [
        [mx - nw / 2, my - nh / 2],
        [mx + nw / 2, my - nh / 2],
        [mx - nw / 2, my + nh / 2],
        [mx + nw / 2, my + nh / 2],
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
