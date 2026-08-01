import { WardleyNodeElementModel } from '@labre/affine-model';
import { roleIsA } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import {
  activateWardleyConnector,
  createWardleyInertia,
  createWardleyMarket,
  createWardleyNode,
  createWardleyPipeline,
} from '../actions';
import { createWardleyLegend } from '../legend';
import { WARDLEY_ROLE, WARDLEY_ROLES } from '../roles';
import { wardleyTemplateCategory as wardleyTemplates } from '../templates';

type Added = Record<string, unknown>;

/**
 * Minimal GfxController stand-in: the creation actions only need a surface
 * that records the props they post, a viewport centre, and no-op grouping /
 * selection / telemetry.
 */
function fakeGfx() {
  const added: Added[] = [];
  let toolOptions: Record<string, unknown> | undefined;
  let n = 0;

  const gfx = {
    surface: {
      addElement: (props: Added) => {
        added.push(props);
        return `el-${n++}`;
      },
      getElementsByType: () => [],
    },
    viewport: { centerX: 0, centerY: 0 },
    doc: { captureSync: vi.fn() },
    tool: {
      setTool: (_tool: unknown, options?: Record<string, unknown>) => {
        toolOptions = options;
      },
    },
    selection: { set: vi.fn() },
    std: {
      getOptional: () => undefined,
      get: () => ({ recordLastProps: vi.fn() }),
      command: { exec: () => [{}, { groupId: 'group-0' }] },
    },
  };

  return {
    gfx: gfx as never,
    added,
    lastToolOptions: () => toolOptions,
  };
}

const roleOf = (added: Added[], type: string, kind?: string) =>
  added.find(p => p.type === type && (kind === undefined || p.kind === kind))
    ?.role;

describe('wardley role vocabulary', () => {
  it('indexes every declared role by its own id', () => {
    for (const id of Object.values(WARDLEY_ROLE)) {
      expect(WARDLEY_ROLES[id]?.id).toBe(id);
    }
    expect(WARDLEY_ROLES[WARDLEY_ROLE.dependency].kind).toBe('edge');
    expect(WARDLEY_ROLES[WARDLEY_ROLE.component].kind).toBe('node');
  });

  it('market and ecosystem specialise component (data hierarchy)', () => {
    expect(
      roleIsA(WARDLEY_ROLE.market, WARDLEY_ROLE.component, WARDLEY_ROLES)
    ).toBe(true);
    expect(
      roleIsA(WARDLEY_ROLE.ecosystem, WARDLEY_ROLE.component, WARDLEY_ROLES)
    ).toBe(true);
    // A role is itself.
    expect(
      roleIsA(WARDLEY_ROLE.component, WARDLEY_ROLE.component, WARDLEY_ROLES)
    ).toBe(true);
    // …but the relation is not symmetric: a component is NOT a market.
    expect(
      roleIsA(WARDLEY_ROLE.component, WARDLEY_ROLE.market, WARDLEY_ROLES)
    ).toBe(false);
    // The anchor is a role of its own, not a component.
    expect(
      roleIsA(WARDLEY_ROLE.anchor, WARDLEY_ROLE.component, WARDLEY_ROLES)
    ).toBe(false);
  });

  it('treats a neutral or unknown role as nothing', () => {
    expect(roleIsA(undefined, WARDLEY_ROLE.component, WARDLEY_ROLES)).toBe(
      false
    );
    expect(
      roleIsA('cynefin:chaotic', WARDLEY_ROLE.component, WARDLEY_ROLES)
    ).toBe(false);
    expect(roleIsA('cynefin:chaotic', 'cynefin:chaotic', WARDLEY_ROLES)).toBe(
      true
    );
  });
});

describe('wardley creation sites post the role', () => {
  it('stamps the role of a single-circle node next to its kind', () => {
    const { gfx, added } = fakeGfx();
    createWardleyNode(gfx, 'anchor');

    const node = added.find(p => p.type === 'wardleyNode')!;
    expect(node.kind).toBe('anchor');
    expect(node.role).toBe(WARDLEY_ROLE.anchor);
    // The label is a generalist text element, so its ROLE is the only thing
    // that says it names an artefact — which is what W3 is written on (PF13.6,
    // revising the "labels stay neutral" half of #71). A free text the user
    // typed elsewhere still carries none.
    expect(roleOf(added, 'text')).toBe(WARDLEY_ROLE.label);
  });

  it('stamps the pipeline body and its handle', () => {
    const { gfx, added } = fakeGfx();
    createWardleyPipeline(gfx);

    expect(roleOf(added, 'wardleyNode', 'pipeline')).toBe(
      WARDLEY_ROLE.pipeline
    );
    expect(roleOf(added, 'wardleyNode', 'handle')).toBe(WARDLEY_ROLE.handle);
  });

  it('stamps the market circle, and leaves its glyph wiring neutral', () => {
    const { gfx, added } = fakeGfx();
    createWardleyMarket(gfx);

    expect(roleOf(added, 'wardleyNode', 'market')).toBe(WARDLEY_ROLE.market);
    // The three inner dots and the triangle between them are part of the
    // market GLYPH, not artefacts the user placed: neutral, both of them. A
    // role on the dots would make every market report an overlap with itself
    // (W3), which is the same reason the triangle never had one.
    expect(roleOf(added, 'wardleyNode', 'component')).toBeUndefined();
    expect(roleOf(added, 'connector')).toBeUndefined();
  });

  it('stamps the inertia bar, which has no element type of its own', () => {
    const { gfx, added } = fakeGfx();
    createWardleyInertia(gfx);

    expect(added).toHaveLength(1);
    // A plain filled rect on the canvas — the role is the whole of what makes
    // it inertia, and what W2 is written on (PF13.5).
    expect(added[0].type).toBe('shape');
    expect(added[0].role).toBe(WARDLEY_ROLE.inertia);
  });

  it('leaves generalist artefacts neutral, at the creation site', () => {
    // The other half of proportionality, asserted where the decision is MADE
    // rather than only where it is evaluated: a creation site that started
    // stamping a role on the market's glyph wiring, or on a legend glyph,
    // would put phantom artefacts under every rule written on roles.
    const { gfx, added } = fakeGfx();
    createWardleyMarket(gfx);

    const neutral = added.filter(el => el.role === undefined);
    // The three inner dots and the three triangle connectors: the market
    // glyph's own wiring, and nothing else on the board.
    expect(neutral).toHaveLength(6);
    for (const el of neutral) {
      expect(['wardleyNode', 'connector']).toContain(el.type);
    }
  });

  it('types both connector tools — dependency, and change arrow', () => {
    const link = fakeGfx();
    activateWardleyConnector(link.gfx, 'link');
    expect(link.lastToolOptions()?.role).toBe(WARDLEY_ROLE.dependency);

    // Revision of #71 (PF13.4): the change arrow is no longer neutral. Two
    // roles, neither specialising the other — W1 is about where an arrow
    // points and must never fall on a dependency.
    const arrow = fakeGfx();
    activateWardleyConnector(arrow.gfx, 'arrow');
    expect(arrow.lastToolOptions()?.role).toBe(WARDLEY_ROLE.changeArrow);
  });
});

describe('built-in templates are typed like hand-drawn maps', () => {
  /** Every surface element of every Wardley template, flattened. */
  type Snapshot = {
    blocks: { children: { props: { elements: Record<string, never> } }[] };
  };

  const templateElements = () =>
    (wardleyTemplates.templates as { content: unknown }[]).flatMap(t =>
      Object.values((t.content as Snapshot).blocks.children[0].props.elements)
    ) as Record<string, unknown>[];

  it('gives every template wardleyNode the role matching its kind', () => {
    const nodes = templateElements().filter(el => el.type === 'wardleyNode');
    const neutral = nodes.filter(node => node.role === undefined);

    // Guard against the selector silently matching nothing.
    expect(nodes.length).toBeGreaterThan(10);
    // The ONLY neutral nodes a template may contain are the market glyph's
    // three inner dots — one market template, one market composite. Pinned as
    // a COUNT rather than skipped: "every node that has a role has the right
    // one" would pass a template that quietly lost one.
    expect(neutral).toHaveLength(3);
    for (const node of nodes) {
      if (node.role === undefined) continue;
      expect(node.role).toBe(
        WARDLEY_ROLE[node.kind as keyof typeof WARDLEY_ROLE]
      );
    }
  });

  it('types every ARTEFACT NAME, and leaves annotations neutral', () => {
    const texts = templateElements().filter(el => el.type === 'text');
    const named = texts.filter(el => el.role === WARDLEY_ROLE.label);
    const neutral = texts.filter(el => el.role === undefined);

    expect(texts.length).toBeGreaterThan(20);
    // Two closed sets, and nothing outside them: a text is either the name of
    // an artefact (W3 is written on it) or a note, a legend or a map title,
    // which name nothing and are measured by nobody.
    expect(named.length + neutral.length).toBe(texts.length);
    expect(named.length).toBeGreaterThan(10);
    // The annotation texts of the canonical maps — titles, the numbered
    // callouts, the note panel. Pinned so that neutralising a NAME to silence
    // a finding cannot pass unnoticed.
    expect(neutral.length).toBeGreaterThan(0);
  });

  it('types template dependency links AND change arrows', () => {
    const connectors = templateElements().filter(
      el => el.type === 'connector'
    );
    const roles = new Set(connectors.map(c => c.role));

    expect(connectors.length).toBeGreaterThan(10);
    // Three possible answers: a dependency, a change arrow, or — for the
    // market glyph's own triangle — nothing at all.
    expect([...roles].sort()).toEqual([
      WARDLEY_ROLE.changeArrow,
      WARDLEY_ROLE.dependency,
      undefined,
    ]);
  });
});

describe('legend glyphs stay neutral', () => {
  it('creates real wardleyNode elements without any role', () => {
    const added: Added[] = [];
    // `instanceof` is what the legend uses to detect what to describe.
    // `kind` as an own data property, shadowing the `@field` accessor (which
    // would need a real surface).
    const present = (['component', 'market'] as const).map(kind =>
      Object.create(WardleyNodeElementModel.prototype, {
        kind: { value: kind },
      })
    );

    const gfx = {
      surface: { addElement: (props: Added) => (added.push(props), 'x') },
      getElementsByBound: () => present,
      selection: { set: vi.fn() },
    };
    const std = {
      get: () => gfx,
      store: { captureSync: vi.fn() },
      command: { exec: () => [{}, { groupId: 'g' }] },
    };
    const bg = { deserializedXYWH: [0, 0, 1600, 900], xywh: '[0,0,1600,900]' };

    createWardleyLegend(std as never, bg as never);

    const nodes = added.filter(el => el.type === 'wardleyNode');
    // The legend really does build wardley nodes…
    expect(nodes.length).toBeGreaterThan(0);
    // …and NONE of them is a map artefact: a legend documents the map, it is
    // not part of it. Typing these would add phantom components/markets to
    // every rule written against roles.
    for (const el of added) {
      expect(el).not.toHaveProperty('role');
    }
  });
});
