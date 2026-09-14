import { describe, expect, it } from 'vitest';

import {
  UML_ATTACH_TOLERANCE,
  type UmlSourceElement,
  umlBoxGap,
  umlHostOf,
  umlModelFrom,
} from '../model';
import { UML_ROLE } from '../roles';

/**
 * The two GEOMETRIC readings phase 2 added to `model.ts`, and nothing else.
 *
 * Every other question this module answers is about an element and a FRAME —
 * which sheet is it on, which package contains it — and those are exercised
 * through the exporters. These two are different in kind: they measure one
 * element against ANOTHER element, and they are the whole of what the canvas has
 * to say about a port's owner (§11.3.4) and about which component a lollipop
 * names an interface of (§10.4.4, §11.6.4). A whiteboard holds no link for
 * either, so if the reading is wrong the file is wrong and nothing else notices.
 *
 * The fixtures are plain records, which is the point of `UmlSourceElement`: the
 * reader takes structural objects, so a sheet is a handful of literals and not a
 * surface.
 */

/* ── A surface, as plain records ──────────────────────────────────────── */

type Box = [number, number, number, number];

const diagram = (kind = 'cmp'): UmlSourceElement => ({
  id: 'd1',
  type: 'umlDiagram',
  kind,
  name: 'Sheet',
  xywh: '[0,0,1400,900]',
});

/** One artefact: its shape, its one written tier, and the group joining them. */
function artefact(
  id: string,
  kind: string,
  role: string,
  box: Box,
  words: { name?: string; label?: string } = {}
): UmlSourceElement[] {
  const children: UmlSourceElement[] = [
    { id, type: 'umlNode', kind, role, xywh: `[${box.join(',')}]` },
  ];
  if (words.name !== undefined) {
    children.push({
      id: `${id}-name`,
      type: 'text',
      role: UML_ROLE.name,
      text: words.name,
    });
  }
  if (words.label !== undefined) {
    children.push({
      id: `${id}-label`,
      type: 'text',
      role: UML_ROLE.label,
      text: words.label,
    });
  }
  return [
    ...children,
    {
      id: `${id}-group`,
      type: 'group',
      childIds: children.map(child => child.id),
    },
  ];
}

const component = (id: string, box: Box, name: string) =>
  artefact(id, 'component', UML_ROLE.component, box, { name });

const cube = (id: string, box: Box, name: string) =>
  artefact(id, 'node', UML_ROLE.node, box, { name });

const port = (id: string, box: Box, label: string) =>
  artefact(id, 'port', UML_ROLE.port, box, { label });

const lollipop = (id: string, box: Box, label: string) =>
  artefact(id, 'provided-interface', UML_ROLE['provided-interface'], box, {
    label,
  });

const socket = (id: string, box: Box, label: string) =>
  artefact(id, 'required-interface', UML_ROLE['required-interface'], box, {
    label,
  });

const read = (elements: UmlSourceElement[]) =>
  umlModelFrom(diagram(), [diagram(), ...elements]);

/* ── The measure itself ───────────────────────────────────────────────── */

describe('the gap between two boxes', () => {
  it('is zero when they touch or overlap', () => {
    const box = { x: 0, y: 0, w: 100, h: 100 };
    expect(umlBoxGap(box, { x: 100, y: 0, w: 50, h: 50 })).toBe(0);
    expect(umlBoxGap(box, { x: 50, y: 50, w: 100, h: 100 })).toBe(0);
    // Contained, which is §11.3.4's other sanctioned drawing for a port.
    expect(umlBoxGap(box, { x: 40, y: 40, w: 10, h: 10 })).toBe(0);
  });

  it('is measured edge to edge, never centre to centre', () => {
    // A lollipop is thirty units across and a component two hundred: "nearest
    // centre" would hand the glyph to whichever box happens to be squattest.
    expect(
      umlBoxGap({ x: 0, y: 0, w: 10, h: 10 }, { x: 40, y: 0, w: 10, h: 10 })
    ).toBe(30);
  });
});

describe('which box a glyph is drawn against', () => {
  const hosts = [
    { id: 'outer', bounds: { x: 0, y: 0, w: 400, h: 400 } },
    { id: 'inner', bounds: { x: 100, y: 100, w: 100, h: 100 } },
  ];

  it('prefers the most-nested host, as the two writers do for containment', () => {
    // §11.6.4's white-box view nests a component inside a component, and a port
    // on the inner one's border is at a gap of zero from both.
    expect(umlHostOf({ x: 195, y: 140, w: 16, h: 16 }, hosts)?.id).toBe(
      'inner'
    );
  });

  it('takes nothing beyond the tolerance', () => {
    const far = { x: 900, y: 900, w: 16, h: 16 };
    expect(umlHostOf(far, hosts)).toBeUndefined();
    // …and the tolerance is a couple of grid steps, not a neighbourhood.
    expect(
      umlHostOf({ x: 400 + UML_ATTACH_TOLERANCE, y: 10, w: 16, h: 16 }, hosts)
        ?.id
    ).toBe('outer');
    expect(
      umlHostOf(
        { x: 400 + UML_ATTACH_TOLERANCE + 1, y: 10, w: 16, h: 16 },
        hosts
      )
    ).toBeUndefined();
  });

  it('answers nothing for a glyph with no box at all', () => {
    expect(umlHostOf(undefined, hosts)).toBeUndefined();
  });
});

/* ── A port's owner (§11.3.4) ─────────────────────────────────────────── */

describe('a port', () => {
  it('belongs to the component whose border it straddles', () => {
    const model = read([
      ...component('k1', [100, 100, 200, 120], '«component»\nCart'),
      ...port('p1', [292, 140, 16, 16], 'http'),
    ]);
    expect(model.components[0].ports.map(each => each.id)).toEqual(['p1']);
    expect(model.ports[0].ownerId).toBe('k1');
    expect(model.ports[0].name).toBe('http');
  });

  it('belongs to it when drawn INSIDE the rectangle too', () => {
    // §11.3.4 sanctions both: "either overlapping the boundary of the rectangle
    // symbol … or it may be shown inside the rectangle symbol".
    const model = read([
      ...component('k1', [100, 100, 200, 120], 'Cart'),
      ...port('p1', [150, 150, 16, 16], 'http'),
    ]);
    expect(model.ports[0].ownerId).toBe('k1');
  });

  it('belongs to nothing when it is drawn against nothing', () => {
    // No owner is invented: a `uml:Port` on a component the author never drew it
    // on is a statement nobody made.
    const model = read([
      ...component('k1', [100, 100, 200, 120], 'Cart'),
      ...port('p1', [800, 600, 16, 16], 'http'),
    ]);
    expect(model.ports[0].ownerId).toBeUndefined();
    expect(model.components[0].ports).toEqual([]);
    // …and it is still on the sheet: the list is every port drawn, not every
    // port the file will carry.
    expect(model.ports).toHaveLength(1);
  });

  it('is read on a cube too, and owned by no component', () => {
    // §11.3.4 speaks of an EncapsulatedClassifier and §19.4.2 makes a Node a
    // Class, so the square is legitimate on a cube — and `uml:Port` is an
    // `ownedAttribute` of a component, so the file carries the drawing nowhere.
    const model = read([
      ...cube('n1', [100, 100, 220, 160], 'AppServer'),
      ...port('p1', [312, 160, 16, 16], 'jdbc'),
    ]);
    expect(model.ports[0].ownerId).toBe('n1');
    expect(model.components).toEqual([]);
  });
});

/* ── An interface glyph's component (§10.4.4, §11.6.4) ────────────────── */

describe('a lollipop and a socket', () => {
  it('name the provided and required interfaces of the box they touch', () => {
    const model = read([
      ...component('k1', [100, 100, 200, 120], '«component»\nCart'),
      ...lollipop('l1', [310, 120, 40, 30], 'IOrder'),
      ...socket('s1', [310, 180, 40, 30], 'IPayment'),
    ]);
    expect(model.components[0].provided).toEqual(['IOrder']);
    expect(model.components[0].required).toEqual(['IPayment']);
    // The glyphs themselves are NOT artefacts of the model: §10.4.4 draws each
    // as a notation for a relationship, and both writers turn it into one.
    expect(model.classifiers).toEqual([]);
  });

  it('reach the component through the PORT they are attached to', () => {
    // §11.3.4: "A provided Interface may be shown using the lollipop notation
    // attached to the Port."
    const model = read([
      ...component('k1', [100, 100, 200, 120], 'Cart'),
      ...port('p1', [292, 140, 16, 16], 'http'),
      ...lollipop('l1', [316, 138, 40, 30], 'IOrder'),
    ]);
    expect(model.components[0].provided).toEqual(['IOrder']);
  });

  it('say nothing when they are drawn against nothing', () => {
    const model = read([
      ...component('k1', [100, 100, 200, 120], 'Cart'),
      ...lollipop('l1', [800, 600, 40, 30], 'IOrder'),
    ]);
    expect(model.components[0].provided).toEqual([]);
  });

  it('say nothing when the author has not named them', () => {
    const model = read([
      ...component('k1', [100, 100, 200, 120], 'Cart'),
      ...lollipop('l1', [310, 120, 40, 30], '  '),
    ]);
    expect(model.components[0].provided).toEqual([]);
  });

  it('splits the several interfaces §11.3.4 lists on one ball', () => {
    // "If there are multiple Interfaces associated with a Port, these Interfaces
    // may be listed on the one Interface lollipop, separated by commas."
    const model = read([
      ...component('k1', [100, 100, 200, 120], 'Cart'),
      ...lollipop('l1', [310, 120, 40, 30], 'OrderEntry, Tracking'),
    ]);
    expect(model.components[0].provided).toEqual(['OrderEntry', 'Tracking']);
  });

  it('never lists one interface twice on one component', () => {
    const model = read([
      ...component('k1', [100, 100, 200, 120], 'Cart'),
      ...lollipop('l1', [310, 100, 40, 30], 'IOrder'),
      ...lollipop('l2', [310, 180, 40, 30], 'IOrder'),
    ]);
    expect(model.components[0].provided).toEqual(['IOrder']);
  });
});

/* ── The structural relations ─────────────────────────────────────────── */

describe('the structural relations', () => {
  const edge = (id: string, role: string, from: string, to: string) => ({
    id,
    type: 'connector',
    role,
    source: { id: from },
    target: { id: to },
    xywh: '[0,0,0,0]',
  });

  it('read a deploy, a manifest and a communication path off their roles', () => {
    const model = read([
      ...artefact('f1', 'artifact', UML_ROLE.artifact, [100, 400, 200, 120], {
        name: '«artifact»\ncart.jar',
      }),
      ...component('k1', [100, 100, 200, 120], 'Cart'),
      ...cube('n1', [500, 100, 220, 160], 'AppServer'),
      ...artefact('n2', 'device', UML_ROLE.device, [800, 100, 220, 160], {
        name: '«device»\nDBServer',
      }),
      edge('e1', UML_ROLE.deploy, 'f1', 'n1'),
      edge('e2', UML_ROLE.manifest, 'f1', 'k1'),
      edge('e3', UML_ROLE['communication-path'], 'n1', 'n2'),
    ]);
    expect(model.relations.map(relation => relation.kind)).toEqual([
      'deploy',
      'manifest',
      'communication-path',
    ]);
    expect(model.artifacts.map(each => each.name)).toEqual(['cart.jar']);
    expect(model.nodes.map(each => each.kind)).toEqual(['node', 'device']);
    expect(model.warnings).toEqual([]);
  });

  it('resolves an end dropped on a GROUP, as the connector tool records it', () => {
    // Every part of a node's group is connectable and all of them look alike to
    // the person drawing: each answers for its shape.
    const model = read([
      ...artefact('f1', 'artifact', UML_ROLE.artifact, [100, 400, 200, 120], {
        name: 'cart.jar',
      }),
      ...cube('n1', [500, 100, 220, 160], 'AppServer'),
      edge('e1', UML_ROLE.deploy, 'f1-group', 'n1-name'),
    ]);
    expect(model.relations).toEqual([
      { kind: 'deploy', sourceId: 'f1', targetId: 'n1' },
    ]);
  });
});

/* ── The behaviour sheets (§15.2.4, §14.2.4) ──────────────────────────── */

/** The same flat reading, on a frame that declares the kind under test. */
const readOn = (kind: string, elements: UmlSourceElement[]) =>
  umlModelFrom(diagram(kind), [diagram(kind), ...elements]);

const action = (id: string, box: Box, label: string) =>
  artefact(id, 'action', UML_ROLE.action, box, { label });

const stateBox = (
  id: string,
  box: Box,
  name: string,
  behaviours?: string
): UmlSourceElement[] => {
  const parts = artefact(id, 'state', UML_ROLE.state, box, { name });
  if (behaviours === undefined) return parts;
  // §14.2.4.4's internal activities live in the SECOND tier, which is the one a
  // class writes its properties in — `uml:attributes`, reused because a state's
  // compartment is the second one down.
  const tier: UmlSourceElement = {
    id: `${id}-attrs`,
    type: 'text',
    role: UML_ROLE.attributes,
    text: behaviours,
  };
  const group = parts[parts.length - 1];
  return [
    ...parts.slice(0, -1),
    tier,
    {
      ...group,
      childIds: [...(group.childIds ?? []), tier.id],
    },
  ];
};

const glyph = (id: string, kind: string, role: string, box: Box) =>
  artefact(id, kind, role, box);

const swimlane = (
  id: string,
  box: Box,
  name: string,
  orientation?: string
): UmlSourceElement => ({
  id,
  type: 'umlPartition',
  role: UML_ROLE.partition,
  name,
  ...(orientation ? { orientation } : {}),
  xywh: `[${box.join(',')}]`,
});

const composite = (id: string, box: Box, name: string): UmlSourceElement => ({
  id,
  type: 'umlRegion',
  role: UML_ROLE.region,
  name,
  xywh: `[${box.join(',')}]`,
});

const flow = (
  id: string,
  role: string,
  from: string,
  to: string,
  text?: string
): UmlSourceElement => ({
  id,
  type: 'connector',
  role,
  source: { id: from },
  target: { id: to },
  ...(text === undefined ? {} : { text }),
  xywh: '[0,0,0,0]',
});

describe('an activity sheet', () => {
  it('reads the ten glyphs and the two flows off their roles', () => {
    const model = readOn('act', [
      ...glyph('i', 'initial', UML_ROLE.initial, [100, 100, 24, 24]),
      ...action('a', [200, 100, 180, 80], 'Receive order'),
      ...glyph(
        'o',
        'object-node',
        UML_ROLE['object-node'],
        [500, 100, 160, 60]
      ),
      ...glyph(
        'z',
        'activity-final',
        UML_ROLE['activity-final'],
        [800, 100, 32, 32]
      ),
      flow('e1', UML_ROLE['control-flow'], 'i', 'a'),
      flow('e2', UML_ROLE['object-flow'], 'a', 'o'),
      flow('e3', UML_ROLE['control-flow'], 'a', 'z'),
    ]);
    const [activity] = model.activities;
    expect(activity.nodes.map(node => node.kind)).toEqual([
      'initial',
      'action',
      'object-node',
      'activity-final',
    ]);
    expect(activity.edges.map(edge => edge.kind)).toEqual([
      'control-flow',
      'object-flow',
      'control-flow',
    ]);
    // …and the sheet holds no state machine at all.
    expect(model.stateMachines).toEqual([]);
    expect(model.warnings).toEqual([]);
  });

  it('reads §15.2.4’s guard and weight off the arrow’s one label', () => {
    const model = readOn('act', [
      ...action('a', [100, 100, 180, 80], 'Pick'),
      ...action('b', [500, 100, 180, 80], 'Pack'),
      flow(
        'e',
        UML_ROLE['control-flow'],
        'a',
        'b',
        'ready [stock > 0] {weight = 2}'
      ),
    ]);
    expect(model.activities[0].edges[0]).toEqual({
      kind: 'control-flow',
      sourceId: 'a',
      targetId: 'b',
      name: 'ready',
      guard: 'stock > 0',
      weight: '2',
    });
    // The same connector is still a RELATION, carrying its label untouched: the
    // edges are projected from that one pass, never read a second time.
    expect(model.relations[0].label).toBe('ready [stock > 0] {weight = 2}');
  });

  it('puts each action in the lane whose box holds its centre', () => {
    const model = readOn('act', [
      swimlane('lane1', [100, 100, 400, 700], 'Sales'),
      swimlane('lane2', [500, 100, 400, 700], 'Warehouse', 'horizontal'),
      ...action('a', [140, 200, 180, 80], 'Take the order'),
      ...action('b', [540, 200, 180, 80], 'Pick the goods'),
      // …and one drawn between the lanes, which belongs to nobody.
      ...action('c', [1000, 200, 180, 80], 'Invoice'),
    ]);
    const [activity] = model.activities;
    expect(
      activity.partitions.map(lane => [lane.name, lane.orientation])
    ).toEqual([
      ['Sales', 'vertical'],
      ['Warehouse', 'horizontal'],
    ]);
    expect(activity.partitions.map(lane => lane.nodeIds)).toEqual([
      ['a'],
      ['b'],
    ]);
    // The two readings hold the same fact, which is why they cannot disagree.
    const partitionOf = new Map(
      activity.nodes.map(node => [node.id, node.partitionId])
    );
    expect(partitionOf.get('a')).toBe('lane1');
    expect(partitionOf.get('b')).toBe('lane2');
    expect(partitionOf.get('c')).toBeUndefined();
  });

  it('writes no lane membership when no lane is drawn', () => {
    const model = readOn('act', [...action('a', [140, 200, 180, 80], 'Pick')]);
    expect(model.activities[0].partitions).toEqual([]);
    expect(model.activities[0].nodes[0].partitionId).toBeUndefined();
  });
});

describe('a state machine sheet', () => {
  it('parses §14.2.4.4’s entry, do and exit lines, and keeps the rest', () => {
    const model = readOn('stm', [
      ...stateBox(
        's',
        [100, 100, 180, 90],
        'Draft',
        'entry / reserve()\ndo / poll()\nexit / release()\nsubmit [x > 0] / log()'
      ),
    ]);
    const [state] = model.stateMachines[0].states;
    expect(state.name).toBe('Draft');
    expect(state.entry).toEqual(['reserve()']);
    expect(state.doActivity).toEqual(['poll()']);
    expect(state.exit).toEqual(['release()']);
    // An INTERNAL TRANSITION is §14.2.4.4's next compartment and not one of the
    // three labels: kept verbatim rather than dropped.
    expect(state.lines).toEqual(['submit [x > 0] / log()']);
  });

  it('parses §14.2.4.8’s three parts off a transition’s label', () => {
    const model = readOn('stm', [
      ...stateBox('s1', [100, 100, 180, 90], 'Draft'),
      ...stateBox('s2', [500, 100, 180, 90], 'Placed'),
      flow(
        't',
        UML_ROLE.transition,
        's1',
        's2',
        'submit, all [stock > 0] / reserve()'
      ),
    ]);
    expect(model.stateMachines[0].transitions).toEqual([
      {
        sourceId: 's1',
        targetId: 's2',
        triggers: ['submit', 'all'],
        guard: 'stock > 0',
        effect: 'reserve()',
      },
    ]);
  });

  it('puts each vertex in the composite state whose box holds its centre', () => {
    const model = readOn('stm', [
      composite('c', [100, 100, 600, 500], 'Running'),
      composite('c2', [150, 150, 300, 200], 'Paused'),
      ...stateBox('inner', [200, 180, 180, 90], 'Held'),
      ...stateBox('outer', [900, 100, 180, 90], 'Idle'),
      ...glyph(
        'h',
        'shallow-history',
        UML_ROLE['shallow-history'],
        [500, 400, 28, 28]
      ),
    ]);
    const machine = model.stateMachines[0];
    // §14.2.4's nesting, most-nested first and strictly larger, so two boxes
    // drawn on top of each other cannot each claim the other.
    expect(
      machine.regions.map(region => [region.name, region.parentId])
    ).toEqual([
      ['Running', undefined],
      ['Paused', 'c'],
    ]);
    const regionOf = new Map(
      machine.states.map(state => [state.name, state.regionId])
    );
    expect(regionOf.get('Held')).toBe('c2');
    expect(regionOf.get('Idle')).toBeUndefined();
    expect(machine.pseudostates[0].regionId).toBe('c');
  });
});

describe('the two glyphs both behaviour sheets draw', () => {
  it('reads the disc and the bar by what the FRAME says it is', () => {
    // §15.3.4 and §14.2.4 draw the same filled disc and the same bar and mean
    // the same thing by each, so `roles.ts` gives each one role. An export has
    // to choose a metaclass all the same, and the sheet's own heading — which
    // Annex A makes a required part of the frame — is what chooses.
    const ink = [
      ...glyph('i', 'initial', UML_ROLE.initial, [100, 100, 24, 24]),
      ...glyph('f', 'fork', UML_ROLE.fork, [300, 100, 100, 8]),
    ];
    const asActivity = readOn('act', ink);
    expect(asActivity.activities[0].nodes.map(node => node.kind)).toEqual([
      'initial',
      'fork',
    ]);
    expect(asActivity.stateMachines).toEqual([]);

    const asMachine = readOn('stm', ink);
    expect(
      asMachine.stateMachines[0].pseudostates.map(each => each.kind)
    ).toEqual(['initial', 'fork']);
    expect(asMachine.activities).toEqual([]);
  });
});
