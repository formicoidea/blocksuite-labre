import { describe, expect, it } from 'vitest';

import { c4CommandsManifest } from '../commands-manifest';
import { NODE_LABEL, NODE_SIZE } from '../consts';
import { c4NodeProps } from '../presets';
import { C4_BOUNDARY_ROLE, C4_ROLE } from '../roles';
import {
  C4_TOOLBOX,
  c4BoundaryElement,
  c4NodeElements,
  c4RelationshipElement,
} from '../toolbox';
import { C4_TYPE_PLACEHOLDER } from '../type-line';

/**
 * C4's toolbar as pure builders (`docs/adr/0045`). What it would have caught:
 * a component built for a host that differs from the toolbar's (a shape
 * without the preset's props, a tier missing its role, a group that is not
 * last or does not hold every member), a boundary whose role and variant
 * disagree, a relationship drawn in another style than the tool's, and a
 * toolbar item a host cannot name the way the toolbar does.
 */
describe('c4 toolbox', () => {
  it('builds a component as the toolbar does: shape, three tiers, group last', () => {
    const elements = c4NodeElements(
      'container',
      { x: 100, y: 50 },
      { title: 'API', technology: 'Java', description: 'Sert les commandes' },
      'api'
    );
    const [shape, title, typeLine, description, group] = elements;
    const { w, h } = NODE_SIZE.container;
    expect(shape).toEqual({
      ...c4NodeProps('container', { xywh: `[100,50,${w},${h}]` }),
      id: 'api:shape',
    });
    expect([title, typeLine, description].map(t => [t?.role, t?.text])).toEqual(
      [
        [C4_ROLE.title, 'API'],
        [C4_ROLE['type-line'], '[Container: Java]'],
        [C4_ROLE.description, 'Sert les commandes'],
      ]
    );
    expect(group).toEqual({
      type: 'group',
      id: 'api:group',
      children: {
        'api:shape': true,
        'api:title': true,
        'api:type-line': true,
        'api:description': true,
      },
    });
  });

  it('seeds an unnamed component with the toolbar English prompts', () => {
    const [, title, typeLine] = c4NodeElements('person', { x: 0, y: 0 });
    expect(title?.text).toBe(NODE_LABEL.person);
    expect(typeLine?.text).toBe(C4_TYPE_PLACEHOLDER.person);
  });

  it('writes a boundary role and variant together, and a relationship as the tool', () => {
    expect(
      c4BoundaryElement('container', { x: 0, y: 0 }, 'Boutique')
    ).toMatchObject({
      type: 'c4Boundary',
      role: C4_BOUNDARY_ROLE.container,
      variant: 'container',
      name: 'Boutique',
    });
    expect(c4RelationshipElement('a', 'b', 'utilise')).toMatchObject({
      type: 'connector',
      role: C4_ROLE.relationship,
      source: { id: 'a' },
      target: { id: 'b' },
      text: 'utilise',
    });
  });

  it('lists every toolbar artefact, named by its toolbar command', () => {
    // The toolbar's own order (`c4CommandsManifest`), every node kind once.
    expect(C4_TOOLBOX.items.map(i => i.id)).toEqual([
      'board',
      'person',
      'person-ext',
      'system',
      'system-ext',
      'container',
      'component',
      'database',
      'mobile',
      'browser',
      'system-boundary',
      'container-boundary',
    ]);
    expect(C4_TOOLBOX.items.filter(i => i.id in NODE_SIZE).length).toBe(
      Object.keys(NODE_SIZE).length
    );
    const labels = new Set(c4CommandsManifest.map(r => r.labelKey));
    for (const item of [...C4_TOOLBOX.items, ...C4_TOOLBOX.links]) {
      expect(labels.has(item.labelKey), item.id).toBe(true);
    }
  });
});
