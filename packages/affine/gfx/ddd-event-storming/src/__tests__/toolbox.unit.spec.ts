import { backgroundSize } from '@labre/affine-block-surface';
import {
  ES_HOTSPOT,
  ES_STICKIES,
  LABEL_COLOR,
  STICKY_SIZE,
} from '@labre/affine-gfx-ddd-shared';
import { ConnectorMode, PointStyle, StrokeStyle } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { EVENT_STORMING_BACKGROUND } from '../background';
import { eventStormingCommands } from '../commands';
import { eventStormingCommandsManifest } from '../commands-manifest';
import {
  ES_ROLE,
  ES_STICKY_ROLE,
  type EventStormingStickyKind,
} from '../roles';
import { AGGREGATE_SIZE } from '../sticky-size';
import {
  EVENT_STORMING_TOOLBOX,
  eventStormingBoardElement,
  eventStormingFlowElement,
  eventStormingStickyElements,
} from '../toolbox';

/**
 * The Event Storming toolbar as pure builders (`docs/adr/0045`). What it would
 * have caught: a sticky built for a host that differs from the one the
 * toolbar places (another colour or size, the aggregate at the standard size,
 * a hotspot that is not a diamond, the role on the shadow or the group, a
 * group that is not last or misses a member), a board off its declaration, a
 * flow drawn in another style than the tool its entry arms, and a toolbar item
 * a host cannot name the way the toolbar does.
 */

const CENTRE = { x: 500, y: 300 };

/**
 * Run a toolbar command against an editor reduced to what the command
 * touches: what it hands `surface.addElement` in order, the members it groups,
 * and the options it arms a tool with. No translation provider, so a seed is
 * its English fallback.
 */
function runCommand(command: string) {
  const added: Record<string, unknown>[] = [];
  const groups: string[][] = [];
  const armed: Record<string, unknown>[] = [];
  const gfx = {
    surface: {
      addElement: (props: Record<string, unknown>) => {
        added.push(props);
        return `el-${added.length}`;
      },
    },
    viewport: { centerX: CENTRE.x, centerY: CENTRE.y },
    doc: { captureSync: () => {} },
    tool: {
      setTool: (_tool: unknown, options: Record<string, unknown>) => {
        armed.push(options);
      },
    },
    selection: { set: () => {} },
  };
  const std = {
    get: () => gfx,
    getOptional: () => null,
    command: {
      exec: (_command: unknown, { elements }: { elements: string[] }) => {
        groups.push(elements);
        return [null, { groupId: 'group' }];
      },
    },
  } as unknown as BlockStdScope;
  const descriptor = eventStormingCommands.find(
    c => c.id === `ddd-event-storming.${command}`
  );
  expect(descriptor, command).toBeDefined();
  void descriptor?.run(std, {
    surface: 'senior-menu',
    source: 'toolbar:general',
  });
  return { added, groups, armed };
}

/** A builder's element as the prefab writes it: no local id, the label as a `Y.Text`. */
function asWritten({ id: _local, ...props }: Record<string, unknown>) {
  if (typeof props.text !== 'string' || props.type !== 'shape') return props;
  return { ...props, text: expect.anything() };
}

const STICKY_KINDS: EventStormingStickyKind[] = [
  ...ES_STICKIES.map(preset => preset.kind),
  'hotspot',
];

const commandOf = (kind: string) =>
  `add${kind[0]?.toUpperCase()}${kind.slice(1)}`;

describe('event storming toolbox', () => {
  it('builds the board the toolbar places, from its declaration', () => {
    const { width, height } = backgroundSize(EVENT_STORMING_BACKGROUND);
    const built = eventStormingBoardElement({
      x: CENTRE.x - width / 2,
      y: CENTRE.y - height / 2,
    });
    expect(built).toEqual({
      type: 'eventStorming',
      id: 'board',
      role: ES_ROLE.board,
      resizeEnabled: EVENT_STORMING_BACKGROUND.geometry.resizable,
      xywh: `[${CENTRE.x - width / 2},${CENTRE.y - height / 2},${width},${height}]`,
    });
    expect(runCommand('addBoard').added).toEqual([asWritten(built)]);
  });

  it('builds every sticky as the toolbar places it: shadow, face, group last', () => {
    for (const kind of STICKY_KINDS) {
      const side = kind === 'aggregate' ? AGGREGATE_SIZE : STICKY_SIZE;
      const { added, groups } = runCommand(commandOf(kind));
      const elements = eventStormingStickyElements(kind, {
        x: CENTRE.x - side / 2,
        y: CENTRE.y - side / 2,
      });
      const [shadow, face, group] = elements;
      expect(elements, kind).toHaveLength(3);
      expect(added, kind).toEqual([asWritten(shadow!), asWritten(face!)]);
      expect(groups, kind).toEqual([['el-1', 'el-2']]);
      // The role rides on the FACE: the shadow is ink, the group a container.
      expect(face?.role, kind).toBe(ES_STICKY_ROLE[kind]);
      expect(shadow?.role, kind).toBeUndefined();
      expect(group, kind).toEqual({
        type: 'group',
        id: `${String(face?.id).split(':')[0]}:group`,
        children: { [String(shadow?.id)]: true, [String(face?.id)]: true },
      });
      expect(face?.xywh, kind).toBe(
        `[${CENTRE.x - side / 2},${CENTRE.y - side / 2},${side},${side}]`
      );
      expect(face?.shapeType, kind).toBe(
        kind === 'hotspot' ? 'diamond' : 'rect'
      );
    }
  });

  it('writes the name it is given, or the English seed', () => {
    const [, face] = eventStormingStickyElements(
      'domainEvent',
      { x: 0, y: 0 },
      ' Order placed '
    );
    expect(face?.text).toBe('Order placed');
    const seeded = (kind: EventStormingStickyKind) =>
      eventStormingStickyElements(kind, { x: 0, y: 0 }, ' ')[1]?.text;
    expect(seeded('readModel')).toBe('Read model');
    expect(seeded('hotspot')).toBe(ES_HOTSPOT.label);
  });

  it('draws a flow in the style its tool is armed with', () => {
    const { armed } = runCommand('addFlow');
    expect(armed).toHaveLength(1);
    const built = eventStormingFlowElement('a', 'b');
    expect(built).toEqual({
      type: 'connector',
      role: ES_ROLE.flow,
      mode: ConnectorMode.Straight,
      stroke: LABEL_COLOR,
      strokeStyle: StrokeStyle.Solid,
      strokeWidth: 2,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.Arrow,
      source: { id: 'a' },
      target: { id: 'b' },
    });
    const { style, role, mode } = armed[0] as {
      style: Record<string, unknown>;
      role: string;
      mode: ConnectorMode;
    };
    expect({ role, mode, ...style }).toEqual({
      role: built.role,
      mode: built.mode,
      stroke: built.stroke,
      strokeStyle: built.strokeStyle,
      strokeWidth: built.strokeWidth,
      frontEndpointStyle: built.frontEndpointStyle,
      rearEndpointStyle: built.rearEndpointStyle,
    });
    expect(eventStormingFlowElement('a', 'b', ' then ').text).toBe('then');
  });

  it('lists every toolbar entry, named by its toolbar command', () => {
    expect(EVENT_STORMING_TOOLBOX.items.map(i => i.id)).toEqual([
      'board',
      'domain-event',
      'command',
      'aggregate',
      'actor',
      'constraint',
      'policy',
      'read-model',
      'external-system',
      'hotspot',
    ]);
    expect(EVENT_STORMING_TOOLBOX.links.map(l => l.id)).toEqual(['flow']);
    // In the toolbar's own order, each under its command's label.
    expect(
      [...EVENT_STORMING_TOOLBOX.items, ...EVENT_STORMING_TOOLBOX.links].map(
        entry => entry.labelKey
      )
    ).toEqual(eventStormingCommandsManifest.map(row => row.labelKey));
    expect(
      EVENT_STORMING_TOOLBOX.items.find(i => i.id === 'aggregate')?.size
    ).toEqual({ w: AGGREGATE_SIZE, h: AGGREGATE_SIZE });
  });

  it('builds an item at the point it is given, group last', () => {
    for (const item of EVENT_STORMING_TOOLBOX.items) {
      const elements = item.build({ x: 0, y: 0 }, { name: 'X' }, 'n');
      const last = elements.at(-1);
      if (elements.length > 1) {
        expect(last?.type, item.id).toBe('group');
        expect(Object.keys(last?.children as object)).toEqual(
          elements.slice(0, -1).map(e => e.id)
        );
      }
      const face = elements.find(e => e.role !== undefined);
      expect(String(face?.xywh), item.id).toMatch(/^\[0,0,/);
      expect(
        elements.every(e => String(e.id).startsWith('n')),
        item.id
      ).toBe(true);
    }
  });
});
