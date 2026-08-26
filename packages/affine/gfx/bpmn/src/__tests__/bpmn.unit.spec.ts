import { describe, expect, it, vi } from 'vitest';

import {
  EVENT_END,
  EVENT_START,
  END_WIDTH,
  NEUTRAL_STROKE,
  NODE_LABEL,
  NODE_SIZE,
  START_WIDTH,
} from '../consts';
import { bpmnPool } from '../element-renderer';
import { BPMN_ROLE, BPMN_ROLE_OF_KIND } from '../roles';
import { bpmnTemplateCategory } from '../templates';

// The pool renderer only reads (model, ctx, matrix); cast to call with those.
const renderPool = bpmnPool as unknown as (
  model: unknown,
  ctx: CanvasRenderingContext2D,
  matrix: DOMMatrix
) => void;

describe('bpmn style-C constants', () => {
  it('defines a size and label for every node kind', () => {
    const kinds = ['startEvent', 'endEvent', 'task', 'gatewayExclusive'] as const;
    for (const kind of kinds) {
      expect(NODE_SIZE[kind].w).toBeGreaterThan(0);
      expect(NODE_SIZE[kind].h).toBeGreaterThan(0);
      expect(typeof NODE_LABEL[kind]).toBe('string');
    }
  });

  it('only the task carries an inner label', () => {
    expect(NODE_LABEL.task).toBe('Task');
    expect(NODE_LABEL.startEvent).toBe('');
    expect(NODE_LABEL.endEvent).toBe('');
    expect(NODE_LABEL.gatewayExclusive).toBe('');
  });

  it('accents events only: green thin start, red thick end, neutral task/gateway', () => {
    expect(EVENT_START).toMatch(/^#/);
    expect(EVENT_END).toMatch(/^#/);
    expect(EVENT_START).not.toBe(EVENT_END);
    // End ring is heavier than the start ring (BPMN line weights).
    expect(END_WIDTH).toBeGreaterThan(START_WIDTH);
    expect(NEUTRAL_STROKE).toBe('#262626');
  });
});

/** Minimal canvas-context stub recording only what the pool renderer touches. */
function fakeCtx() {
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
  };
  return ctx as unknown as CanvasRenderingContext2D & { fillText: ReturnType<typeof vi.fn> };
}

/** Chainable identity matrix stub (the renderer only calls *Self mutators). */
function fakeMatrix() {
  const m = {
    translateSelf: () => m,
    rotateSelf: () => m,
  };
  return m as unknown as DOMMatrix;
}

function poolModel(name: string, w = 560, h = 200) {
  return { deserializedXYWH: [0, 0, w, h], rotate: 0, name } as never;
}

describe('bpmn pool renderer', () => {
  it('draws the frame and the participant name when present', () => {
    const ctx = fakeCtx();
    renderPool(poolModel('Customer'), ctx, fakeMatrix());
    expect(ctx.fillRect).toHaveBeenCalled(); // name band
    expect(ctx.stroke).toHaveBeenCalled(); // frame + divider
    expect(ctx.fillText).toHaveBeenCalledWith('Customer', 0, 0);
  });

  it('skips the name when empty', () => {
    const ctx = fakeCtx();
    renderPool(poolModel(''), ctx, fakeMatrix());
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('skips the name when the pool is too narrow for the band', () => {
    const ctx = fakeCtx();
    renderPool(poolModel('Customer', 8), ctx, fakeMatrix());
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});

/**
 * A shipped template is factory content: it is the first BPMN process most
 * users ever see. It must therefore produce the SAME typed artefacts the
 * toolbox does, or a process started from a preset would read differently from
 * a hand-drawn one.
 */
describe('bpmn templates carry the toolbox roles', () => {
  // The category may declare its templates lazily; BPMN's are a plain array,
  // and the walk below needs them in hand.
  const { templates } = bpmnTemplateCategory;
  if (typeof templates === 'function') {
    throw new Error('bpmn templates went lazy — teach this spec to await them');
  }

  /** One surface element of a shipped card, keyed by the id the snapshot gives it. */
  type TemplateElement = Record<string, unknown> & { id: string };

  /** Every surface element of every shipped card. */
  const templateElements: TemplateElement[] = templates.flatMap(template => {
    const surface = (
      template.content as unknown as {
        blocks: { children: { props: { elements: Record<string, unknown> } }[] };
      }
    ).blocks.children[0];
    return Object.entries(surface.props.elements).map(
      ([id, element]): TemplateElement => ({
        ...(element as Record<string, unknown>),
        id,
      })
    );
  });

  it('finds the seven cards and every element in them', () => {
    // If this ever drops to zero the assertions below become vacuous, which is
    // the failure mode a corpus test is most likely to die of.
    expect(templates).toHaveLength(7);
    expect(templateElements.length).toBeGreaterThanOrEqual(19);
  });

  it('stamps every node with the role its kind means', () => {
    const nodes = templateElements.filter(el => el.type === 'bpmnNode');
    expect(nodes.length).toBeGreaterThanOrEqual(10);
    for (const node of nodes) {
      expect(node.role, `${node.id} (${String(node.kind)})`).toBe(
        BPMN_ROLE_OF_KIND[node.kind as keyof typeof BPMN_ROLE_OF_KIND]
      );
    }
  });

  it('stamps every pool with the frame role', () => {
    const pools = templateElements.filter(el => el.type === 'bpmnPool');
    expect(pools).toHaveLength(2);
    for (const pool of pools) expect(pool.role).toBe(BPMN_ROLE.pool);
  });

  it('types the BOUND connectors, and only those', () => {
    const connectors = templateElements.filter(el => el.type === 'connector');
    expect(connectors).toHaveLength(7);
    for (const connector of connectors) {
      const ends = connector as {
        source?: { id?: string };
        target?: { id?: string };
      };
      const bound = Boolean(ends.source?.id) && Boolean(ends.target?.id);
      // A typed edge claims "this is followed by that". The free arrow of the
      // "Sequence flow" card is attached to neither end, so it has no this and
      // no that to say it about, and it stays neutral (`docs/adr/0010`).
      expect(connector.role, connector.id).toBe(
        bound ? BPMN_ROLE.sequenceFlow : undefined
      );
    }
    expect(connectors.filter(c => c.role === undefined)).toHaveLength(1);
  });
});
