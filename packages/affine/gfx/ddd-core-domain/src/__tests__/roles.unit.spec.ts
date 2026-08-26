import { CD_SUBDOMAINS, TEAM_TOPOLOGIES } from '@labre/affine-gfx-ddd-shared';
import { roleIsA } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import { coreDomainCommands } from '../commands';
import {
  CORE_DOMAIN_ROLE,
  CORE_DOMAIN_ROLES,
  markerRole,
  subdomainRole,
} from '../roles';

type Added = Record<string, unknown>;

/**
 * Minimal std / GfxController stand-in: the creation commands only need a
 * surface that records the props they post, a viewport centre, and no-op
 * grouping / selection / tool switching.
 */
function fakeStd() {
  const added: Added[] = [];
  let toolOptions: Record<string, unknown> | undefined;
  let lastProps: Record<string, unknown> | undefined;
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
  };

  const std = {
    get: (_identifier: unknown) => {
      // Both `GfxControllerIdentifier` and `EditPropsStore` come through here;
      // the props store is the only one with a `recordLastProps`.
      return Object.assign(gfx, {
        recordLastProps: (_type: string, props: Record<string, unknown>) => {
          lastProps = props;
        },
      });
    },
    getOptional: () => undefined,
    command: { exec: () => [{}, { groupId: 'group-0' }] },
  };

  return {
    std: std as never,
    added,
    lastToolOptions: () => toolOptions,
    lastConnectorProps: () => lastProps,
  };
}

const run = (id: string, std: never) => {
  const command = coreDomainCommands.find(
    c => c.id === `ddd-core-domain.${id}`
  );
  expect(command, `command ${id}`).toBeDefined();
  (command!.run as unknown as (s: never) => void)(std);
};

describe('the Core Domain role vocabulary', () => {
  it('indexes every declared role by its own id', () => {
    for (const id of Object.values(CORE_DOMAIN_ROLE)) {
      expect(CORE_DOMAIN_ROLES[id]?.id).toBe(id);
    }
    expect(CORE_DOMAIN_ROLES[CORE_DOMAIN_ROLE.movement].kind).toBe('edge');
    expect(CORE_DOMAIN_ROLES[CORE_DOMAIN_ROLE.chart].kind).toBe('node');
  });

  it('makes the five presets specialisations of one sub-domain role', () => {
    for (const preset of CD_SUBDOMAINS) {
      expect(
        roleIsA(
          subdomainRole(preset.kind),
          CORE_DOMAIN_ROLE.subdomain,
          CORE_DOMAIN_ROLES
        )
      ).toBe(true);
    }
    // A role is itself; the parent is not one of its children.
    expect(
      roleIsA(
        CORE_DOMAIN_ROLE.subdomain,
        CORE_DOMAIN_ROLE.subdomain,
        CORE_DOMAIN_ROLES
      )
    ).toBe(true);
    expect(
      roleIsA(
        CORE_DOMAIN_ROLE.subdomain,
        CORE_DOMAIN_ROLE.outsourced,
        CORE_DOMAIN_ROLES
      )
    ).toBe(false);
  });

  it('makes the three markers one family of their own', () => {
    for (const preset of TEAM_TOPOLOGIES) {
      const role = markerRole(preset.kind);
      expect(CORE_DOMAIN_ROLES[role]?.kind).toBe('node');
      // Named and coloured by the preset the palette draws with, not restated.
      expect(CORE_DOMAIN_ROLES[role]?.labelFallback).toBe(preset.label);
      expect(roleIsA(role, CORE_DOMAIN_ROLE.marker, CORE_DOMAIN_ROLES)).toBe(
        true
      );
    }
  });

  it('keeps the chart, the movement and the markers out of the sub-domain family', () => {
    // A rule written on `core-domain:subdomain` must never match the frame it
    // measures against, nor the arrow between two of them — nor an annotation
    // parked beside one. `core-domain.overlapping-artefacts` pairs
    // `[subdomain, subdomain]`, and a marker put against the dot it comments on
    // is a marker doing its job, not two dots hiding each other.
    for (const role of [
      CORE_DOMAIN_ROLE.chart,
      CORE_DOMAIN_ROLE.movement,
      CORE_DOMAIN_ROLE.marker,
      ...TEAM_TOPOLOGIES.map(preset => markerRole(preset.kind)),
    ]) {
      expect(roleIsA(role, CORE_DOMAIN_ROLE.subdomain, CORE_DOMAIN_ROLES)).toBe(
        false
      );
    }
    // And the other way round: the marker family owns no sub-domain either.
    expect(
      roleIsA(
        CORE_DOMAIN_ROLE.bcCurrent,
        CORE_DOMAIN_ROLE.marker,
        CORE_DOMAIN_ROLES
      )
    ).toBe(false);
  });

  it('states the verb and the gesture of the movement edge (ADR 0010)', () => {
    const movement = CORE_DOMAIN_ROLES[CORE_DOMAIN_ROLE.movement];
    expect(movement.direction?.verbFallback).toBe('is moving to');
    expect(movement.direction?.gestureHintFallback).toContain(
      'current position'
    );
    // A node role has no business declaring one.
    expect(CORE_DOMAIN_ROLES[CORE_DOMAIN_ROLE.chart].direction).toBeUndefined();
  });

  it('is a null-prototype table', () => {
    expect(CORE_DOMAIN_ROLES['toString']).toBeUndefined();
  });
});

describe('what the creation sites stamp', () => {
  it('stamps the chart role and the declared resize policy on a new chart', () => {
    const { std, added } = fakeStd();
    run('addChart', std);

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      type: 'coreDomain',
      role: CORE_DOMAIN_ROLE.chart,
      resizeEnabled: true,
      xywh: '[-450,-410,900,820]',
    });
  });

  it('stamps each preset role on the DOT, never on its label', () => {
    for (const preset of CD_SUBDOMAINS) {
      const { std, added } = fakeStd();
      const id = `add${preset.kind[0].toUpperCase()}${preset.kind.slice(1)}`;
      run(id, std);

      const dot = added.find(p => p.shapeType === 'ellipse');
      expect(dot?.role).toBe(subdomainRole(preset.kind));
      // The name beside it is a name, not an artefact.
      for (const text of added.filter(p => p.type === 'text')) {
        expect(text.role).toBeUndefined();
      }
    }
  });

  it('stamps each marker role on the SQUARE, never on its letter or caption', () => {
    for (const preset of TEAM_TOPOLOGIES) {
      const { std, added } = fakeStd();
      const id = `add${preset.kind[0].toUpperCase()}${preset.kind.slice(1)}`;
      run(id, std);

      const square = added.find(p => p.type === 'shape');
      expect(square?.role, preset.kind).toBe(markerRole(preset.kind));
      // The letter inside it and the name beside it are glyph and caption.
      for (const text of added.filter(p => p.type === 'text')) {
        expect(text.role).toBeUndefined();
      }
    }
  });

  it('turns the movement into a typed, pre-styled connector gesture', () => {
    const { std, added, lastToolOptions, lastConnectorProps } = fakeStd();
    run('addMovement', std);

    // Nothing is dropped on the canvas any more: the user draws it.
    expect(added).toEqual([]);
    expect(lastToolOptions()?.role).toBe(CORE_DOMAIN_ROLE.movement);
    expect(lastConnectorProps()).toMatchObject({ stroke: '#ff3333' });
  });

  it('keeps every telemetry `element` value untouched', () => {
    expect(coreDomainCommands.map(c => c.telemetry?.element)).toEqual([
      'background',
      'subdomain:bigBet',
      'subdomain:platform',
      'subdomain:outsourced',
      'subdomain:bcCurrent',
      'subdomain:bcFuture',
      'team-topology:collaboration',
      'team-topology:xaas',
      'team-topology:facilitating',
      'movement',
    ]);
  });
});
