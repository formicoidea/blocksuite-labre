import {
  addBubble,
  addCloud,
  CLOUD,
  CM_BUBBLE,
  CM_RELATIONSHIPS,
  LABEL_COLOR,
} from '@labre/affine-gfx-ddd-shared';
import { PointStyle, StrokeStyle } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it, vi } from 'vitest';

import { CONTEXT_MAP_BACKGROUND } from '../background';
import { contextMapCommandsManifest } from '../commands-manifest';
import { CM_PATTERN_ROLE, CONTEXT_MAP_ROLE } from '../roles';
import { CONTEXT_MAP_SEED_BOUNDED_CONTEXT } from '../seeds';
import {
  CONTEXT_MAP_TOOLBOX,
  contextMapBoardElement,
  contextMapContextElement,
  contextMapRelationshipElement,
  contextMapSystemElements,
} from '../toolbox';

/**
 * The Context Map toolbar as pure builders (`docs/adr/0045`). What it would
 * have caught: a bounded context or a cloud built for a host that differs from
 * the one the palette places (another pill, a role on the group instead of the
 * shape, a group that is not last or misses a member), a board off its
 * declaration, a relationship drawn in another style than the tool it arms,
 * and a toolbar item a host cannot name the way the toolbar does.
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

describe('context map toolbox', () => {
  it('builds the board from its declaration', () => {
    expect(contextMapBoardElement({ x: 10, y: 20 })).toEqual({
      type: 'contextMap',
      id: 'board',
      role: CONTEXT_MAP_ROLE.board,
      resizeEnabled: CONTEXT_MAP_BACKGROUND.geometry.resizable,
      xywh: `[10,20,${CONTEXT_MAP_BACKGROUND.geometry.width},${CONTEXT_MAP_BACKGROUND.geometry.height}]`,
    });
  });

  it('builds a bounded context as the palette places it, role on the pill', () => {
    const { w, h } = CM_BUBBLE;
    const { added } = placed(surface =>
      addBubble(surface, 100, 50, 'Billing', CONTEXT_MAP_ROLE.context)
    );
    const built = contextMapContextElement(
      { x: 100 - w / 2, y: 50 - h / 2 },
      'Billing'
    );
    expect(built).toMatchObject({
      id: 'bounded-context',
      role: CONTEXT_MAP_ROLE.context,
      text: 'Billing',
    });
    expect(added).toEqual([asWritten(built)]);
    expect(contextMapContextElement({ x: 0, y: 0 }).text).toBe(
      CONTEXT_MAP_SEED_BOUNDED_CONTEXT[1]
    );
  });

  it('builds a cloud as the palette places it: polygon, name, group last', () => {
    const { w, h } = CLOUD;
    const { added, groups } = placed((surface, std) =>
      addCloud(surface, std, 100, 50, 'Legacy ERP', CONTEXT_MAP_ROLE.system)
    );
    const elements = contextMapSystemElements(
      { x: 100 - w / 2, y: 50 - h / 2 },
      'Legacy ERP',
      'erp'
    );
    const [cloud, caption, group] = elements;
    expect(cloud).toMatchObject({
      id: 'erp:cloud',
      shapeType: 'polygon',
      role: CONTEXT_MAP_ROLE.system,
    });
    expect(caption).toMatchObject({ type: 'text', text: 'Legacy ERP' });
    expect(caption?.role).toBeUndefined();
    expect(group).toEqual({
      type: 'group',
      id: 'erp:group',
      children: { 'erp:cloud': true, 'erp:caption': true },
    });
    expect(added).toEqual([asWritten(cloud!), asWritten(caption!)]);
    expect(groups).toEqual([['el-1', 'el-2']]);
  });

  it('draws each relationship in the style its tool is armed with', () => {
    for (const preset of CM_RELATIONSHIPS) {
      expect(
        contextMapRelationshipElement(preset.kind, 'a', 'b'),
        preset.kind
      ).toEqual({
        type: 'connector',
        role: CM_PATTERN_ROLE[preset.kind],
        mode: expect.anything(),
        stroke: LABEL_COLOR,
        strokeStyle: preset.dashed ? StrokeStyle.Dash : StrokeStyle.Solid,
        strokeWidth: 2,
        frontEndpointStyle: PointStyle.None,
        rearEndpointStyle: preset.upDown ? PointStyle.Arrow : PointStyle.None,
        source: { id: 'a' },
        target: { id: 'b' },
      });
    }
    expect(
      contextMapRelationshipElement('acl', 'a', 'b', ' traduit ').text
    ).toBe('traduit');
  });

  it('lists every toolbar entry, named by its toolbar command', () => {
    expect(CONTEXT_MAP_TOOLBOX.items.map(i => i.id)).toEqual([
      'board',
      'bounded-context',
      'system',
    ]);
    expect(CONTEXT_MAP_TOOLBOX.links.map(l => l.id)).toEqual([
      'partnership',
      'shared-kernel',
      'customer-supplier',
      'conformist',
      'acl',
      'ohs',
      'published-language',
      'separate-ways',
      'bbom',
    ]);
    const labels = new Set(contextMapCommandsManifest.map(r => r.labelKey));
    for (const entry of [
      ...CONTEXT_MAP_TOOLBOX.items,
      ...CONTEXT_MAP_TOOLBOX.links,
    ]) {
      expect(labels.has(entry.labelKey), entry.id).toBe(true);
    }
    // One manifest row per entry: nothing on the toolbar is missing here.
    expect(
      CONTEXT_MAP_TOOLBOX.items.length + CONTEXT_MAP_TOOLBOX.links.length
    ).toBe(contextMapCommandsManifest.length);
  });

  it('builds an item at the point it is given, group last', () => {
    for (const item of CONTEXT_MAP_TOOLBOX.items) {
      const elements = item.build({ x: 0, y: 0 }, { name: 'X' }, 'n');
      const last = elements.at(-1);
      if (elements.length > 1) {
        expect(last?.type, item.id).toBe('group');
        expect(Object.keys(last?.children as object)).toEqual(
          elements.slice(0, -1).map(e => e.id)
        );
      }
      expect(String(elements[0]?.xywh), item.id).toMatch(/^\[0,0,/);
    }
  });
});
