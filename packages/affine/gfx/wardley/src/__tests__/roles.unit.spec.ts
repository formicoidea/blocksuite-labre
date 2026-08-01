import { roleIsA } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import {
  activateWardleyConnector,
  createWardleyInertia,
  createWardleyMarket,
  createWardleyNode,
  createWardleyPipeline,
} from '../actions';
import { WARDLEY_ROLE, WARDLEY_ROLES } from '../roles';

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
    // The label is a generalist text element: it stays neutral.
    expect(roleOf(added, 'text')).toBeUndefined();
  });

  it('stamps the pipeline body and its handle', () => {
    const { gfx, added } = fakeGfx();
    createWardleyPipeline(gfx);

    expect(roleOf(added, 'wardleyNode', 'pipeline')).toBe(
      WARDLEY_ROLE.pipeline
    );
    expect(roleOf(added, 'wardleyNode', 'handle')).toBe(WARDLEY_ROLE.handle);
  });

  it('stamps the market circle and its inner components', () => {
    const { gfx, added } = fakeGfx();
    createWardleyMarket(gfx);

    expect(roleOf(added, 'wardleyNode', 'market')).toBe(WARDLEY_ROLE.market);
    expect(roleOf(added, 'wardleyNode', 'component')).toBe(
      WARDLEY_ROLE.component
    );
    // The triangle wiring is part of the market glyph, not a user-drawn
    // dependency: neutral.
    expect(roleOf(added, 'connector')).toBeUndefined();
  });

  it('leaves generalist artefacts neutral', () => {
    const { gfx, added } = fakeGfx();
    createWardleyInertia(gfx);

    expect(added).toHaveLength(1);
    expect(added[0].type).toBe('shape');
    expect(added[0]).not.toHaveProperty('role');
  });

  it('activates the link tool for a typed dependency edge, the arrow neutral', () => {
    const link = fakeGfx();
    activateWardleyConnector(link.gfx, 'link');
    expect(link.lastToolOptions()?.role).toBe(WARDLEY_ROLE.dependency);

    const arrow = fakeGfx();
    activateWardleyConnector(arrow.gfx, 'arrow');
    expect(arrow.lastToolOptions()?.role).toBeUndefined();
  });
});
