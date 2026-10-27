import { backgroundSize } from '@labre/affine-block-surface';
import {
  addDot,
  addMarker,
  CD_SUBDOMAINS,
  DOT_SIZE,
  MARKER_SIZE,
  MOVEMENT_COLOR,
  TEAM_TOPOLOGIES,
} from '@labre/affine-gfx-ddd-shared';
import { ConnectorMode, PointStyle, StrokeStyle } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import { activateMovement, createCoreDomainChart } from '../actions';
import { coreDomainCommandsManifest } from '../commands-manifest';
import { CORE_DOMAIN_BACKGROUND } from '../core-domain/background';
import { CORE_DOMAIN_ROLE, markerRole, subdomainRole } from '../roles';
import {
  CORE_DOMAIN_TOOLBOX,
  coreDomainChartElement,
  coreDomainMarkerElements,
  coreDomainMovementElement,
  coreDomainSubdomainElements,
} from '../toolbox';

/**
 * The Core Domain Chart toolbar as pure builders (`docs/adr/0045`). What it
 * would have caught: a sub-domain dot or a Team Topologies marker built for a
 * host that differs from the one the palette places (another fill, a role on
 * the group or the caption instead of the ellipse or the square, a group that
 * is not last or misses a member), a chart off its declaration, a movement
 * drawn in another style than the tool it arms, and a toolbar item a host
 * cannot name the way the toolbar does.
 */

/** What the palette's prefab hands `surface.addElement`, in order. */
function placed(write: (surface: never, std: BlockStdScope) => void) {
  const added: Record<string, unknown>[] = [];
  const surface = {
    addElement: vi.fn((props: Record<string, unknown>) => {
      added.push(props);
      return `el-${added.length}`;
    }),
  } as never;
  const groups: string[][] = [];
  const std = {
    command: {
      exec: (_command: unknown, { elements }: { elements: string[] }) => {
        groups.push(elements);
        return [null, { groupId: 'group' }];
      },
    },
  } as unknown as BlockStdScope;
  write(surface, std);
  return { added, groups };
}

/** A builder's element as the prefab writes it: no local id, the label as a `Y.Text`. */
function asWritten({ id: _local, ...props }: Record<string, unknown>) {
  if (typeof props.text !== 'string' || props.type !== 'shape') return props;
  return { ...props, text: expect.anything() };
}

/** The members a builder writes, the group left to the group command. */
const members = (elements: Record<string, unknown>[]) =>
  elements.filter(e => e.type !== 'group').map(asWritten);

describe('core domain toolbox', () => {
  it('builds the chart from its declaration, as the toolbar posts it', () => {
    const { width, height } = backgroundSize(CORE_DOMAIN_BACKGROUND);
    const built = coreDomainChartElement({ x: 10, y: 20 });
    expect(built).toEqual({
      type: 'coreDomain',
      id: 'chart',
      role: CORE_DOMAIN_ROLE.chart,
      resizeEnabled: CORE_DOMAIN_BACKGROUND.geometry.resizable,
      xywh: `[10,20,${width},${height}]`,
    });
    const { added } = placed(surface =>
      createCoreDomainChart(surface, 10 + width / 2, 20 + height / 2)
    );
    expect(added).toEqual([asWritten(built)]);
  });

  it('builds each sub-domain dot as the palette places it, role on the ellipse', () => {
    const d = DOT_SIZE;
    for (const preset of CD_SUBDOMAINS) {
      const { added, groups } = placed((surface, std) =>
        addDot(
          surface,
          std,
          100,
          50,
          preset.fill,
          preset.label,
          subdomainRole(preset.kind)
        )
      );
      const built = coreDomainSubdomainElements(preset.kind, {
        x: 100 - d / 2,
        y: 50 - d / 2,
      });
      const [dot, caption, group] = built;
      expect(dot, preset.kind).toMatchObject({
        shapeType: 'ellipse',
        fillColor: preset.fill,
        role: subdomainRole(preset.kind),
      });
      expect(caption?.role, preset.kind).toBeUndefined();
      expect(caption?.text, preset.kind).toBe(preset.label);
      expect(group?.type, preset.kind).toBe('group');
      expect(added, preset.kind).toEqual(members(built));
      expect(groups, preset.kind).toEqual([['el-1', 'el-2']]);
    }
    expect(
      coreDomainSubdomainElements('bigBet', { x: 0, y: 0 }, ' Pricing ')[1]
        ?.text
    ).toBe('Pricing');
  });

  it('builds each marker as the palette places it, role on the square', () => {
    const s = MARKER_SIZE;
    for (const preset of TEAM_TOPOLOGIES) {
      const { added, groups } = placed((surface, std) =>
        addMarker(surface, std, 100, 50, {
          fill: preset.fill,
          letter: preset.letter,
          label: preset.label,
          role: markerRole(preset.kind),
        })
      );
      const built = coreDomainMarkerElements(preset.kind, {
        x: 100 - s / 2,
        y: 50 - s / 2,
      });
      const [square, letter, caption] = built;
      expect(square, preset.kind).toMatchObject({
        fillColor: preset.fill,
        role: markerRole(preset.kind),
      });
      expect(letter, preset.kind).toMatchObject({
        type: 'text',
        text: preset.letter,
      });
      expect(letter?.role, preset.kind).toBeUndefined();
      expect(caption?.text, preset.kind).toBe(preset.label);
      expect(added, preset.kind).toEqual(members(built));
      expect(groups, preset.kind).toEqual([['el-1', 'el-2', 'el-3']]);
    }
  });

  it('draws a movement in the style its tool is armed with', () => {
    const setTool = vi.fn();
    const std = {
      get: (id: unknown) =>
        id === GfxControllerIdentifier ? { tool: { setTool } } : undefined,
    } as unknown as BlockStdScope;
    activateMovement(std);
    const armed = setTool.mock.calls[0]?.[1] as {
      mode: ConnectorMode;
      role: string;
      style: Record<string, unknown>;
    };
    const built = coreDomainMovementElement('a', 'b');
    expect(built).toEqual({
      type: 'connector',
      role: CORE_DOMAIN_ROLE.movement,
      mode: ConnectorMode.Straight,
      stroke: MOVEMENT_COLOR,
      strokeStyle: StrokeStyle.Dash,
      strokeWidth: 2,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.Arrow,
      source: { id: 'a' },
      target: { id: 'b' },
    });
    expect(built).toMatchObject({
      mode: armed.mode,
      role: armed.role,
      ...armed.style,
    });
    expect(coreDomainMovementElement('a', 'b', ' 2027 ').text).toBe('2027');
  });

  it('lists every toolbar entry, named by its toolbar command', () => {
    expect(CORE_DOMAIN_TOOLBOX.items.map(i => i.id)).toEqual([
      'chart',
      'big-bet',
      'platform',
      'outsourced',
      'bc-current',
      'bc-future',
      'collaboration',
      'xaas',
      'facilitating',
    ]);
    expect(CORE_DOMAIN_TOOLBOX.links.map(l => l.id)).toEqual(['movement']);
    // The toolbar's own order, one manifest row per entry: nothing on the
    // toolbar is missing here, and each is named as its command is.
    expect(
      [...CORE_DOMAIN_TOOLBOX.items, ...CORE_DOMAIN_TOOLBOX.links].map(
        e => e.labelKey
      )
    ).toEqual(coreDomainCommandsManifest.map(r => r.labelKey));
  });

  it('builds an item at the point it is given, group last', () => {
    for (const item of CORE_DOMAIN_TOOLBOX.items) {
      const elements = item.build({ x: 0, y: 0 }, { name: 'X' }, 'n');
      const last = elements.at(-1);
      if (elements.length > 1) {
        expect(last?.type, item.id).toBe('group');
        expect(Object.keys(last?.children as object)).toEqual(
          elements.slice(0, -1).map(e => e.id)
        );
      }
      expect(String(elements[0]?.xywh), item.id).toMatch(/^\[0,0,/);
      expect(
        elements.every(e => String(e.id).startsWith('n')),
        item.id
      ).toBe(true);
    }
  });
});
