import { recordAction } from '@labre/affine-block-surface';
import { ConnectorMode, type UmlNodeKind } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import {
  activateUmlEdge,
  createUmlClassifier,
  createUmlDiagram,
  createUmlFragment,
  createUmlInteractionUse,
  createUmlNode,
  createUmlPartition,
  createUmlRegion,
  createUmlSubject,
  type UmlClassifierKind,
  type UmlGlyphKind,
} from '../actions';
import { umlCommandsManifest } from '../commands-manifest';
import { UML_EDGE_WIDTH, UML_INK, UML_NODE_BOX } from '../consts';
import { UML_EDGE_STYLE, type UmlEdgeRole } from '../edge-styles';
import { UML_PLANTUML_IMPORT } from '../interchange';
import {
  UML_ATTRIBUTES_SEED,
  UML_NAME_SEED,
  UML_OPERATIONS_SEED,
  UML_SLOTS_SEED,
  UML_UNLABELLED_KINDS,
} from '../keywords';
import { UML_FRAME_BOX, umlNodeProps } from '../presets';
import { UML_ROLE } from '../roles';
import {
  UML_TOOLBOX,
  umlFrameElement,
  umlNodeElements,
  umlRelationElement,
} from '../toolbox';

/**
 * UML's toolbar as pure builders (`docs/adr/0045`). What it would have caught:
 * an artefact built for a host that differs from the one the toolbar draws (a
 * shape without the preset's props, a tier with the wrong role, a mark given a
 * word or a group, a group that is not last or does not hold every member), an
 * importer that assembles a class its own way again, a frame born without its
 * kind or operator, a relationship drawn in another line than its tool arms,
 * and a toolbar item a host cannot reach or name the way the toolbar does.
 */

const KINDS = Object.keys(UML_NODE_BOX) as UmlNodeKind[];
const EDGES = Object.keys(UML_EDGE_STYLE) as UmlEdgeRole[];

/** Every node kind, through whichever creation path the toolbar uses. */
const CLASSIFIERS = new Set<UmlNodeKind>([
  'class',
  'interface',
  'enumeration',
  'object',
  'component',
  'artifact',
  'state',
]);
const createKind = (std: BlockStdScope, kind: UmlNodeKind) =>
  CLASSIFIERS.has(kind)
    ? createUmlClassifier(std, kind as UmlClassifierKind)
    : createUmlNode(std, kind as UmlGlyphKind);

/** A record or a built element, minus what only the writer decides. */
function body(element: Record<string, unknown>) {
  const {
    id: _id,
    index: _index,
    children: _children,
    interchange: _interchange,
    ...rest
  } = element;
  return Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  );
}

describe('uml toolbox: artefacts', () => {
  it('builds a class as the toolbar does: shape, three tiers, group last', () => {
    const elements = umlNodeElements(
      'class',
      { x: 100, y: 50 },
      {
        name: 'Order',
        attributes: '+ id : OrderId\n+ total : Money',
        operations: '+ pay() : Receipt',
      },
      'order'
    );
    const [shape, name, attributes, operations, group, ...rest] = elements;
    const { w, h } = UML_NODE_BOX.class;
    expect(rest).toEqual([]);
    expect(shape).toEqual({
      ...umlNodeProps('class', { xywh: `[100,50,${w},${h}]` }),
      id: 'order:shape',
    });
    expect(
      [name, attributes, operations].map(t => [t?.id, t?.role, t?.text])
    ).toEqual([
      ['order:name', UML_ROLE.name, 'Order'],
      [
        'order:attributes',
        UML_ROLE.attributes,
        '+ id : OrderId\n+ total : Money',
      ],
      ['order:operations', UML_ROLE.operations, '+ pay() : Receipt'],
    ]);
    expect(group).toEqual({
      type: 'group',
      id: 'order:group',
      children: {
        'order:shape': true,
        'order:name': true,
        'order:attributes': true,
        'order:operations': true,
      },
    });
  });

  it.each(KINDS)('places a %s as the toolbar action does', kind => {
    // The action draws around the recording's (0, 0) viewport centre.
    const { w, h } = UML_NODE_BOX[kind];
    const { records } = recordAction(std => createKind(std, kind));
    const built = umlNodeElements(kind, { x: -w / 2, y: -h / 2 });
    expect(records.map(body)).toEqual(built.map(body));
    // The group holds every other element, under the ids the surface minted.
    const group = records.find(r => r.type === 'group');
    if (UML_UNLABELLED_KINDS.has(kind)) {
      expect(records).toHaveLength(1);
      expect(group).toBeUndefined();
      return;
    }
    expect(records.at(-1)).toBe(group);
    expect(Object.keys(group?.children as object).sort()).toEqual(
      records
        .slice(0, -1)
        .map(r => r.id)
        .sort()
    );
  });

  it('seeds an unnamed artefact with the toolbar English seeds', () => {
    const tiers = (kind: UmlNodeKind) =>
      umlNodeElements(kind, { x: 0, y: 0 })
        .filter(e => e.type === 'text')
        .map(e => e.text);
    expect(tiers('class')).toEqual([
      UML_NAME_SEED.class,
      UML_ATTRIBUTES_SEED,
      UML_OPERATIONS_SEED,
    ]);
    expect(tiers('object')).toEqual([UML_NAME_SEED.object, UML_SLOTS_SEED]);
    // A state's behaviour compartment is born empty (§14.2.4).
    expect(tiers('state')).toEqual([UML_NAME_SEED.state, '']);
    expect(tiers('actor')).toEqual([UML_NAME_SEED.actor]);
  });

  it('writes an empty compartment when told to, never an empty name', () => {
    const [, name, attributes, operations] = umlNodeElements(
      'class',
      { x: 0, y: 0 },
      { name: '  ', attributes: '+ id : int\n', operations: '' }
    );
    expect(name?.text).toBe(UML_NAME_SEED.class);
    expect(attributes?.text).toBe('+ id : int');
    expect(operations?.text).toBe('');
  });

  it('builds a mark as the shape alone', () => {
    expect(
      umlNodeElements('fork', { x: 0, y: 0 }, { name: 'ignored' })
    ).toEqual([
      {
        ...umlNodeProps('fork', {
          xywh: `[0,0,${UML_NODE_BOX.fork.w},${UML_NODE_BOX.fork.h}]`,
        }),
        id: 'fork:shape',
      },
    ]);
  });

  it('is the assembly the PlantUML importer writes a class through', () => {
    const { elements } = UML_PLANTUML_IMPORT.run(
      '@startuml\nclass Order {\n+ id : OrderId\n+ pay() : Receipt\n}\n@enduml',
      {}
    );
    const shape = elements.find(e => e.type === 'umlNode');
    const tiers = elements.filter(e => e.type === 'text');
    const [x, y] = JSON.parse(shape?.xywh as string) as number[];
    const built = umlNodeElements(
      'class',
      { x: x ?? 0, y: y ?? 0 },
      Object.fromEntries(
        tiers.map(t => [
          (t.role as string).replace('uml:', ''),
          t.text as string,
        ])
      )
    );
    const imported = [
      shape,
      ...tiers,
      elements.find(e => e.type === 'group'),
    ] as Record<string, unknown>[];
    expect(imported.map(body)).toEqual(built.map(body));
  });
});

describe('uml toolbox: frames', () => {
  const ACTIONS: Record<string, (std: BlockStdScope) => void> = {
    diagram: std => createUmlDiagram(std),
    subject: createUmlSubject,
    partition: createUmlPartition,
    region: createUmlRegion,
    fragment: std => createUmlFragment(std),
    'interaction-use': createUmlInteractionUse,
  };

  it.each(Object.keys(ACTIONS))(
    'places a %s as the toolbar action does',
    id => {
      const item = UML_TOOLBOX.items.find(i => i.id === id);
      const { records } = recordAction(ACTIONS[id]!);
      const built = item!.build({ x: -item!.size.w / 2, y: -item!.size.h / 2 });
      expect(records.map(body)).toEqual(built.map(body));
      expect(built[0]?.id).toBe(id);
    }
  );

  it('names a frame, guards a fragment and refers an interaction use', () => {
    expect(umlFrameElement('umlSubject', { x: 0, y: 0 }, 'Billing')).toEqual({
      type: 'umlSubject',
      role: UML_ROLE.subject,
      name: 'Billing',
      xywh: `[0,0,${UML_FRAME_BOX.umlSubject.w},${UML_FRAME_BOX.umlSubject.h}]`,
      id: 'umlSubject',
    });
    expect(
      umlFrameElement('umlDiagram', { x: 0, y: 0 }, undefined, 'd', {
        kind: 'sd',
      })
    ).toMatchObject({ name: 'Diagram', kind: 'sd', role: UML_ROLE.diagram });
    const fragment = UML_TOOLBOX.items.find(i => i.id === 'fragment');
    expect(fragment?.build({ x: 0, y: 0 })[0]).not.toHaveProperty('name');
    expect(
      fragment?.build({ x: 0, y: 0 }, { name: '[stock > 0]' })[0]
    ).toMatchObject({ operator: 'alt', name: '[stock > 0]' });
    const ref = UML_TOOLBOX.items.find(i => i.id === 'interaction-use');
    expect(
      ref?.build({ x: 0, y: 0 }, { name: 'Authenticate' }, 'auth')[0]
    ).toMatchObject({
      type: 'umlFragment',
      operator: 'ref',
      name: 'Authenticate',
      id: 'auth',
    });
  });
});

describe('uml toolbox: relationships', () => {
  it.each(EDGES)('draws a %s in the line its tool is armed with', edge => {
    const { armedToolOptions } = recordAction(std =>
      activateUmlEdge(std, edge)
    );
    const { style, ...tool } = armedToolOptions as {
      style: Record<string, unknown>;
    };
    expect(umlRelationElement(edge, 'a', 'b')).toEqual({
      type: 'connector',
      ...tool,
      ...style,
      source: { id: 'a' },
      target: { id: 'b' },
    });
    expect(umlRelationElement(edge, 'a', 'b')).toMatchObject({
      role: UML_ROLE[edge],
      mode: ConnectorMode.Straight,
      stroke: UML_INK,
      strokeWidth: UML_EDGE_WIDTH,
      ...UML_EDGE_STYLE[edge],
    });
  });

  it('writes a label only when there is one', () => {
    expect(
      umlRelationElement('association', 'a', 'b', ' places ')
    ).toMatchObject({ text: 'places' });
    for (const link of UML_TOOLBOX.links) {
      expect(link.build('a', 'b')).not.toHaveProperty('text');
    }
  });
});

describe('uml toolbox: the list', () => {
  /** The rows that read or write a file and place nothing. */
  const INTERCHANGE = [
    'uml.exportPlantuml',
    'uml.exportXmi',
    'uml.importXmi',
    'uml.importPlantuml',
    'uml.importDrawio',
  ];

  it('lists every toolbar item that places something, in the toolbar order', () => {
    const placed = [...UML_TOOLBOX.items, ...UML_TOOLBOX.links];
    const rows = umlCommandsManifest.filter(r => !INTERCHANGE.includes(r.id));
    expect(placed).toHaveLength(rows.length);
    // Each item named by its toolbar command, every row reached once…
    expect(placed.map(i => i.labelKey).sort()).toEqual(
      rows.map(r => r.labelKey).sort()
    );
    for (const item of placed) {
      const row = rows.find(r => r.labelKey === item.labelKey);
      expect(item.labelFallback, item.id).toBe(row?.labelFallback);
    }
    // …in the toolbar's own order.
    const order = (ids: readonly { labelKey: string }[]) =>
      ids.map(i => rows.findIndex(r => r.labelKey === i.labelKey));
    for (const list of [UML_TOOLBOX.items, UML_TOOLBOX.links]) {
      const positions = order(list);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  it('reaches every node kind and every relationship once', () => {
    expect(
      UML_TOOLBOX.items
        .map(i => i.id)
        .filter(id => id in UML_NODE_BOX)
        .sort()
    ).toEqual([...KINDS].sort());
    expect(UML_TOOLBOX.links.map(l => l.id).sort()).toEqual([...EDGES].sort());
    expect(
      UML_TOOLBOX.items.filter(i => !(i.id in UML_NODE_BOX)).map(i => i.id)
    ).toEqual([
      'diagram',
      'subject',
      'partition',
      'region',
      'fragment',
      'interaction-use',
    ]);
  });

  it('offers the text slots each item writes', () => {
    const slots = (id: string) =>
      UML_TOOLBOX.items.find(i => i.id === id)?.texts;
    expect(slots('class')).toEqual(['name', 'attributes', 'operations']);
    expect(slots('object')).toEqual(['name', 'attributes']);
    expect(slots('state')).toEqual(['name', 'attributes']);
    expect(slots('actor')).toEqual(['name']);
    expect(slots('initial')).toEqual([]);
    expect(slots('diagram')).toEqual(['name']);
    expect(slots('interaction-use')).toEqual(['name']);
  });
});
