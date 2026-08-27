import {
  type BpmnLane,
  BpmnNodeElementModel,
  type BpmnNodeKind,
  BpmnPoolElementModel,
  ConnectorElementModel,
} from '@labre/affine-model';
import {
  ActionPlacement,
  type ToolbarActionGenerator,
} from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { bpmnCommands } from '../commands';
import { POOL_BAND_WIDTH } from '../consts';
import {
  BPMN_NS,
  BPMN_XML_OF_KIND,
  type BpmnExportBoard,
  exportBpmnXml,
  toNcName,
} from '../export';
import { BPMN_ROLE } from '../roles';
import { bpmnPoolToolbarConfig } from '../toolbar/config';

/**
 * The BPMN 2.0 XML export.
 *
 * Plain stubs and no editor, because the serializer is a pure function and the
 * whole point of putting it in a module of its own was that this file could
 * exist. What is asserted is the SHAPE of the document — the namespaces, the
 * nesting the XSD requires, which artefact becomes which element, and that
 * everything semantic is drawn — rather than a golden string: a golden file
 * would fail on every whitespace change and pass on every structural one, which
 * is exactly backwards.
 *
 * No XSD validation dependency. `DOMParser` answers well-formedness, and the
 * structural assertions below answer the rest; the human recette imports the
 * file into bpmn.io, which is the only oracle that knows what "renders" means.
 */

const POOL_W = 560;
const POOL_H = 200;
const BAND = POOL_BAND_WIDTH;

/** The seventeen kinds, read off the mapping so the list cannot drift. */
const ALL_KINDS = Object.keys(BPMN_XML_OF_KIND) as BpmnNodeKind[];

/* ── Stubs ────────────────────────────────────────────────────────────── */

function fakePool(
  id: string,
  bound: [number, number, number, number],
  options: { name?: string; lanes?: BpmnLane[] } = {}
): BpmnPoolElementModel {
  const pool = Object.create(BpmnPoolElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(pool, {
    id: { value: id, enumerable: true },
    name: { value: options.name, enumerable: true },
    lanes: { value: options.lanes, enumerable: true },
    elementBound: { value: new Bound(...bound) },
  });
  return pool as unknown as BpmnPoolElementModel;
}

function fakeNode(
  id: string,
  kind: BpmnNodeKind,
  bound: [number, number, number, number],
  text?: string
): BpmnNodeElementModel {
  const node = Object.create(BpmnNodeElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(node, {
    id: { value: id, enumerable: true },
    kind: { value: kind, enumerable: true },
    text: { value: text, enumerable: true },
    elementBound: { value: new Bound(...bound) },
  });
  return node as unknown as BpmnNodeElementModel;
}

function fakeConnector(
  id: string,
  role: string | undefined,
  ends: { source?: string; target?: string } = {},
  options: { text?: string; path?: [number, number][] } = {}
): ConnectorElementModel {
  const connector = Object.create(ConnectorElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(connector, {
    id: { value: id, enumerable: true },
    role: { value: role, enumerable: true },
    text: { value: options.text, enumerable: true },
    absolutePath: { value: options.path ?? [], enumerable: true },
    source: {
      value: ends.source === undefined ? {} : { id: ends.source },
      enumerable: true,
    },
    target: {
      value: ends.target === undefined ? {} : { id: ends.target },
      enumerable: true,
    },
  });
  return connector as unknown as ConnectorElementModel;
}

const board = (partial: Partial<BpmnExportBoard>): BpmnExportBoard => ({
  pools: [],
  nodes: [],
  connectors: [],
  ...partial,
});

/* ── Reading the result back ──────────────────────────────────────────── */

/** Parses, and FAILS on a parse error rather than returning a broken tree. */
function parse(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const error = doc.querySelector('parsererror');
  expect(error?.textContent ?? null, 'XML is not well-formed').toBeNull();
  return doc;
}

/**
 * Elements by local name AND namespace URI — prefixes are not the contract.
 *
 * Walked by hand rather than through `getElementsByTagNameNS`, which happy-dom
 * does not implement for a parsed XML document: it returns an empty list for
 * every namespaced query, which would make each of these assertions pass by
 * asserting nothing.
 */
function all(root: Document | Element, ns: string, local: string): Element[] {
  const found: Element[] = [];
  const walk = (element: Element) => {
    if (element.namespaceURI === ns && element.localName === local) {
      found.push(element);
    }
    for (const child of Array.from(element.children)) walk(child);
  };
  const start =
    'documentElement' in root ? (root as Document).documentElement : root;
  if (start) walk(start as Element);
  return found;
}

const model = (doc: Document | Element, local: string) =>
  all(doc, BPMN_NS.model, local);
const di = (doc: Document | Element, local: string) =>
  all(doc, BPMN_NS.bpmndi, local);

const attr = (element: Element, name: string) => element.getAttribute(name);

/* ── The composed board ───────────────────────────────────────────────── */

/**
 * Two participants, one of them divided in two lanes, every artefact the pack
 * draws, and one arrow of each kind between them.
 *
 * Built once and read by several tests, because it is the case the export
 * exists for: anything simpler would let a whole half of the format go
 * unexercised.
 */
function collaborationBoard() {
  const front: BpmnLane = { id: 'lane-front', name: 'Front office', size: 1 };
  const back: BpmnLane = { id: 'lane-back', name: 'Back office', size: 1 };
  const sales = fakePool('pool-sales', [0, 0, POOL_W, POOL_H], {
    name: 'Sales',
    lanes: [front, back],
  });
  const supplier = fakePool('pool-supplier', [0, 300, POOL_W, POOL_H], {
    name: 'Supplier',
  });

  // One of each kind, alternating between the two lanes of the first pool so
  // that `flowNodeRef` has something to get wrong.
  const nodes = ALL_KINDS.map((kind, index) =>
    fakeNode(
      `n-${kind}`,
      kind,
      [BAND + 5 + index * 28, index % 2 === 0 ? 40 : 150, 12, 12],
      `Label ${kind}`
    )
  );
  // …and one task in the other pool, so the message flow has somewhere to land.
  const remote = fakeNode('n-remote', 'task', [BAND + 20, 340, 12, 12], 'Ship');
  nodes.push(remote);

  const connectors = [
    fakeConnector('c-seq', BPMN_ROLE.sequenceFlow, {
      source: 'n-startEvent',
      target: 'n-task',
    }),
    fakeConnector(
      'c-msg',
      BPMN_ROLE.messageFlow,
      { source: 'n-task', target: 'n-remote' },
      { text: 'Order' }
    ),
    fakeConnector('c-assoc', BPMN_ROLE.association, {
      source: 'n-textAnnotation',
      target: 'n-task',
    }),
  ];

  return {
    board: board({ pools: [sales, supplier], nodes, connectors }),
    lanes: { front, back },
  };
}

/* ── Tests ────────────────────────────────────────────────────────────── */

describe('a two-participant collaboration', () => {
  const { board: composed } = collaborationBoard();
  const xml = exportBpmnXml(composed, { name: 'Order to cash' });
  const doc = parse(xml);

  it('is a well-formed `definitions` in the four spec namespaces', () => {
    const root = doc.documentElement;
    expect(root.localName).toBe('definitions');
    expect(root.namespaceURI).toBe(BPMN_NS.model);
    // The URIs are the contract; the prefixes are not (bpmn.io writes the same
    // two DD namespaces as `omgdi` / `omgdc`).
    expect(attr(root, 'xmlns:bpmndi')).toBe(BPMN_NS.bpmndi);
    expect(attr(root, 'xmlns:di')).toBe(BPMN_NS.di);
    expect(attr(root, 'xmlns:dc')).toBe(BPMN_NS.dc);
    // The ONE attribute `definitions` requires.
    expect(attr(root, 'targetNamespace')).toBeTruthy();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('gives every pool a participant and a process, wired to each other', () => {
    const participants = model(doc, 'participant');
    expect(participants.map(p => attr(p, 'name'))).toEqual([
      'Sales',
      'Supplier',
    ]);

    const processIds = new Set(model(doc, 'process').map(p => attr(p, 'id')));
    for (const participant of participants) {
      expect(processIds.has(attr(participant, 'processRef'))).toBe(true);
    }
    // Two pools and nothing outside them, so exactly two processes: the
    // participant-less one is minted on first use and there was no orphan.
    expect(processIds.size).toBe(2);
  });

  it('puts the message flow under the collaboration, never in a process', () => {
    const collaboration = model(doc, 'collaboration');
    expect(collaboration).toHaveLength(1);

    const flows = model(doc, 'messageFlow');
    expect(flows).toHaveLength(1);
    expect(flows[0].parentElement?.localName).toBe('collaboration');
    expect(attr(flows[0], 'name')).toBe('Order');
    // `participant*` strictly before `messageFlow*`, per `tCollaboration`.
    const children = Array.from(collaboration[0].children).map(
      c => c.localName
    );
    expect(children).toEqual(['participant', 'participant', 'messageFlow']);
  });

  it('draws the plane on the COLLABORATION, not on a process', () => {
    // A plane pointing at a process draws the flow and none of the pools.
    const plane = di(doc, 'BPMNPlane');
    expect(plane).toHaveLength(1);
    const collaborationId = attr(model(doc, 'collaboration')[0], 'id');
    expect(attr(plane[0], 'bpmnElement')).toBe(collaborationId);
  });

  it('writes a flat laneSet whose flowNodeRefs match `bpmnLaneOf`', () => {
    const laneSets = model(doc, 'laneSet');
    // Only the divided pool has one.
    expect(laneSets).toHaveLength(1);
    expect(laneSets[0].parentElement?.localName).toBe('process');

    const lanes = model(laneSets[0], 'lane');
    expect(lanes.map(l => attr(l, 'name'))).toEqual([
      'Front office',
      'Back office',
    ]);
    // Flat: the pack draws no nested lane, so no `childLaneSet` is written.
    expect(model(doc, 'childLaneSet')).toHaveLength(0);

    // `flowNodeRef` is an ELEMENT whose text is the IDREF.
    const refs = lanes.map(lane =>
      model(lane, 'flowNodeRef').map(ref => ref.textContent)
    );
    const flowNodes = ALL_KINDS.filter(
      kind => BPMN_XML_OF_KIND[kind].slot === 'flowNode'
    );
    // The composed board alternates by declaration index, and only the flow
    // NODES may be referenced: a data reference and an artifact are flow
    // elements that are not flow nodes.
    const expectedFront = flowNodes.filter(
      kind => ALL_KINDS.indexOf(kind) % 2 === 0
    ).length;
    const expectedBack = flowNodes.length - expectedFront;
    expect(refs[0]).toHaveLength(expectedFront);
    expect(refs[1]).toHaveLength(expectedBack);

    // Every reference resolves to a flow node of the same process.
    const laneProcess = laneSets[0].parentElement!;
    const ids = new Set(
      Array.from(laneProcess.children).map(child => attr(child, 'id'))
    );
    for (const id of refs.flat()) expect(ids.has(id)).toBe(true);
  });

  it('orders each process laneSet → flowElement → artifact, as the XSD does', () => {
    const process = model(doc, 'laneSet')[0].parentElement!;
    const order = Array.from(process.children).map(child => child.localName);
    expect(order[0]).toBe('laneSet');

    const artifacts = ['textAnnotation', 'group', 'association'];
    const firstArtifact = order.findIndex(name => artifacts.includes(name));
    expect(firstArtifact).toBeGreaterThan(0);
    // Nothing that is not an artifact appears after the first one.
    expect(order.slice(firstArtifact).every(n => artifacts.includes(n))).toBe(
      true
    );
  });

  it('maps every one of the seventeen kinds onto its BPMN element', () => {
    // A loop over the WHOLE table, so a kind added to the pack without a
    // mapping fails the build and a kind mapped onto the wrong element fails
    // here. The expectations are spelled out rather than read back off
    // `BPMN_XML_OF_KIND`, which would only prove the table equals itself.
    const expected: Record<BpmnNodeKind, string> = {
      startEvent: 'startEvent',
      startEventMessage: 'startEvent',
      startEventTimer: 'startEvent',
      endEvent: 'endEvent',
      endEventMessage: 'endEvent',
      endEventTerminate: 'endEvent',
      task: 'task',
      taskUser: 'userTask',
      taskService: 'serviceTask',
      subProcess: 'subProcess',
      callActivity: 'callActivity',
      gatewayExclusive: 'exclusiveGateway',
      gatewayParallel: 'parallelGateway',
      dataObject: 'dataObjectReference',
      dataStore: 'dataStoreReference',
      textAnnotation: 'textAnnotation',
      group: 'group',
    };
    expect(Object.keys(expected).sort()).toEqual([...ALL_KINDS].sort());

    for (const kind of ALL_KINDS) {
      expect(BPMN_XML_OF_KIND[kind].element, kind).toBe(expected[kind]);
      // …and the element is actually in the document, carrying that node's id.
      const found = model(doc, expected[kind]).some(element =>
        (attr(element, 'id') ?? '').includes(toNcName(`n-${kind}`))
      );
      expect(found, `${kind} is missing from the document`).toBe(true);
    }
  });

  it('gives the four triggered events their event definition, and no other', () => {
    const definitions: Record<string, string[]> = {
      messageEventDefinition: [],
      timerEventDefinition: [],
      terminateEventDefinition: [],
    };
    for (const name of Object.keys(definitions)) {
      definitions[name] = model(doc, name).map(
        element => element.parentElement?.localName ?? ''
      );
    }
    // A message START and a message END: both carry the same definition, and
    // the parent is what tells them apart.
    expect(definitions.messageEventDefinition.sort()).toEqual([
      'endEvent',
      'startEvent',
    ]);
    expect(definitions.timerEventDefinition).toEqual(['startEvent']);
    expect(definitions.terminateEventDefinition).toEqual(['endEvent']);

    // The plain start and end carry none: three start events in all, one of
    // which has no child.
    const bare = model(doc, 'startEvent').filter(e => e.children.length === 0);
    expect(bare).toHaveLength(1);
  });

  it('backs the data object with a `dataObject`, and the group with a category', () => {
    const reference = model(doc, 'dataObjectReference')[0];
    const objectId = attr(reference, 'dataObjectRef');
    expect(objectId).toBeTruthy();
    expect(model(doc, 'dataObject').map(o => attr(o, 'id'))).toContain(
      objectId
    );
    // Both are flow elements of the same process.
    expect(reference.parentElement?.localName).toBe('process');

    const group = model(doc, 'group')[0];
    // `group` carries NO name attribute — the label lives on the categoryValue.
    expect(attr(group, 'name')).toBeNull();
    const valueId = attr(group, 'categoryValueRef');
    const value = model(doc, 'categoryValue').find(
      element => attr(element, 'id') === valueId
    );
    expect(value).toBeDefined();
    expect(attr(value!, 'value')).toBe('Label group');
    // `category` is a ROOT element, a direct child of `definitions`.
    expect(value!.parentElement?.localName).toBe('category');
    expect(value!.parentElement?.parentElement?.localName).toBe('definitions');
  });

  it('writes the annotation text as a child element, not an attribute', () => {
    const annotation = model(doc, 'textAnnotation')[0];
    expect(attr(annotation, 'textFormat')).toBe('text/plain');
    expect(model(annotation, 'text')[0]?.textContent).toBe(
      'Label textAnnotation'
    );
  });

  it('draws every semantic element: a shape or an edge for each', () => {
    const drawn = new Set(
      [...di(doc, 'BPMNShape'), ...di(doc, 'BPMNEdge')].map(element =>
        attr(element, 'bpmnElement')
      )
    );

    // Everything a reader can see on the canvas. The `dataObject` behind a
    // reference is deliberately NOT among them — DI attaches to the reference.
    const drawable = [
      ...model(doc, 'participant'),
      ...ALL_KINDS.flatMap(kind => {
        const name = BPMN_XML_OF_KIND[kind].element;
        return model(doc, name).filter(element =>
          (attr(element, 'id') ?? '').includes(toNcName(`n-${kind}`))
        );
      }),
      ...model(doc, 'sequenceFlow'),
      ...model(doc, 'messageFlow'),
      ...model(doc, 'association'),
    ];
    expect(drawable.length).toBeGreaterThan(20);
    for (const element of drawable) {
      expect(
        drawn.has(attr(element, 'id')),
        `${element.localName} ${attr(element, 'id')} is not drawn`
      ).toBe(true);
    }

    // A shape carries exactly one `dc:Bounds`; an edge at least two waypoints.
    for (const shape of di(doc, 'BPMNShape')) {
      expect(all(shape, BPMN_NS.dc, 'Bounds')).toHaveLength(1);
    }
    for (const edge of di(doc, 'BPMNEdge')) {
      expect(all(edge, BPMN_NS.di, 'waypoint').length).toBeGreaterThanOrEqual(
        2
      );
    }
  });

  it('flags the pool horizontal, the sub-process collapsed, the X visible', () => {
    const shapeFor = (id: string) =>
      di(doc, 'BPMNShape').find(shape =>
        (attr(shape, 'bpmnElement') ?? '').includes(toNcName(id))
      );

    const pool = di(doc, 'BPMNShape').find(
      shape => attr(shape, 'isHorizontal') === 'true'
    );
    expect(pool).toBeDefined();

    expect(attr(shapeFor('n-subProcess')!, 'isExpanded')).toBe('false');
    expect(attr(shapeFor('n-gatewayExclusive')!, 'isMarkerVisible')).toBe(
      'true'
    );
    // …and nothing else claims either flag.
    expect(
      di(doc, 'BPMNShape').filter(s => attr(s, 'isMarkerVisible') === 'true')
    ).toHaveLength(1);
  });

  it('translates the drawing so no coordinate is negative', () => {
    // Spec §12.3: DI coordinates are relative to the plane origin, and the
    // union of the nested bounds is deemed to sit AT it. A canvas lets a user
    // drag left of zero; the export does not pass that on.
    const numbers = [
      ...all(doc, BPMN_NS.dc, 'Bounds').flatMap(b => [
        Number(attr(b, 'x')),
        Number(attr(b, 'y')),
      ]),
      ...all(doc, BPMN_NS.di, 'waypoint').flatMap(p => [
        Number(attr(p, 'x')),
        Number(attr(p, 'y')),
      ]),
    ];
    expect(numbers.every(value => value >= 0)).toBe(true);
    // And the top-left really is at the origin, not merely non-negative.
    expect(Math.min(...numbers)).toBe(0);
  });

  it('keeps the shape of the drawing while it moves it', () => {
    const negative = exportBpmnXml(
      board({
        pools: [fakePool('p', [-1000, -500, POOL_W, POOL_H], { name: 'P' })],
        nodes: [fakeNode('n', 'task', [-900, -400, 40, 20])],
      })
    );
    const shifted = parse(negative);
    const bounds = all(shifted, BPMN_NS.dc, 'Bounds');
    // Pool at (0,0), task 100 right and 100 down of it — the offsets it had.
    expect([attr(bounds[0], 'x'), attr(bounds[0], 'y')]).toEqual(['0', '0']);
    expect([attr(bounds[1], 'x'), attr(bounds[1], 'y')]).toEqual([
      '100',
      '100',
    ]);
  });
});

describe('a board with no pool', () => {
  const xml = exportBpmnXml(
    board({
      nodes: [
        fakeNode('n1', 'startEvent', [0, 0, 30, 30], 'Go'),
        fakeNode('n2', 'task', [100, 0, 60, 40], 'Do the thing'),
      ],
      connectors: [
        fakeConnector('c1', BPMN_ROLE.sequenceFlow, {
          source: 'n1',
          target: 'n2',
        }),
      ],
    }),
    { name: 'Solo' }
  );
  const doc = parse(xml);

  it('is a single process and no collaboration at all', () => {
    expect(model(doc, 'collaboration')).toHaveLength(0);
    expect(model(doc, 'participant')).toHaveLength(0);
    const processes = model(doc, 'process');
    expect(processes).toHaveLength(1);
    expect(attr(processes[0], 'name')).toBe('Solo');
    // The plane then points at the process, which is the only thing there is.
    expect(attr(di(doc, 'BPMNPlane')[0], 'bpmnElement')).toBe(
      attr(processes[0], 'id')
    );
  });

  it('drops a message flow, which has no collaboration to live in', () => {
    // Dropped rather than demoted to a sequence flow: "sends a message to" and
    // "is followed by" are two different sentences, and the export refuses to
    // substitute one for the other.
    const lonely = parse(
      exportBpmnXml(
        board({
          nodes: [
            fakeNode('n1', 'task', [0, 0, 30, 30]),
            fakeNode('n2', 'task', [100, 0, 30, 30]),
          ],
          connectors: [
            fakeConnector('c', BPMN_ROLE.messageFlow, {
              source: 'n1',
              target: 'n2',
            }),
          ],
        })
      )
    );
    expect(model(lonely, 'messageFlow')).toHaveLength(0);
    expect(model(lonely, 'sequenceFlow')).toHaveLength(0);
  });
});

describe('what the export refuses to say', () => {
  it('says nothing about a NEUTRAL connector', () => {
    // A connector with no role states nothing (`docs/adr/0010`), so it is not
    // an untyped sequence flow — it is not a flow.
    const doc = parse(
      exportBpmnXml(
        board({
          nodes: [
            fakeNode('a', 'task', [0, 0, 30, 30]),
            fakeNode('b', 'task', [100, 0, 30, 30]),
          ],
          connectors: [
            fakeConnector('plain', undefined, { source: 'a', target: 'b' }),
          ],
        })
      )
    );
    expect(model(doc, 'sequenceFlow')).toHaveLength(0);
    expect(model(doc, 'association')).toHaveLength(0);
    expect(di(doc, 'BPMNEdge')).toHaveLength(0);
  });

  it('says nothing about an element that is not a BPMN artefact', () => {
    // A connector attached to a sticky note has no id in this document to
    // point at, and `sourceRef` is required — so the arrow cannot be written.
    const doc = parse(
      exportBpmnXml(
        board({
          nodes: [fakeNode('a', 'task', [0, 0, 30, 30])],
          connectors: [
            fakeConnector('c', BPMN_ROLE.sequenceFlow, {
              source: 'a',
              target: 'some-sticky-note',
            }),
          ],
        })
      )
    );
    expect(model(doc, 'sequenceFlow')).toHaveLength(0);
    expect(model(doc, 'task')).toHaveLength(1);
  });

  it('skips a dangling edge, which has no source or no target to name', () => {
    const doc = parse(
      exportBpmnXml(
        board({
          nodes: [fakeNode('a', 'task', [0, 0, 30, 30])],
          connectors: [
            fakeConnector('half', BPMN_ROLE.sequenceFlow, { source: 'a' }),
            fakeConnector('none', BPMN_ROLE.association, {}),
          ],
        })
      )
    );
    expect(model(doc, 'sequenceFlow')).toHaveLength(0);
    expect(model(doc, 'association')).toHaveLength(0);
  });

  it('omits `name` entirely rather than writing an empty one', () => {
    const doc = parse(
      exportBpmnXml(board({ nodes: [fakeNode('a', 'task', [0, 0, 30, 30])] }))
    );
    expect(model(doc, 'task')[0].hasAttribute('name')).toBe(false);
  });
});

describe('ids', () => {
  it('turns a surface id into a valid NCName', () => {
    // `xsd:ID` means NCName: no leading digit, no colon, no space. Surface ids
    // are nanoid-shaped and routinely break both of the first two.
    expect(toNcName('7abc')).toBe('_7abc');
    expect(toNcName('a:b c/d')).toBe('a_b_c_d');
    expect(toNcName('')).toBe('_');
    expect(toNcName('ok-id.2')).toBe('ok-id.2');
  });

  it('keeps every id in the document distinct, however they collide', () => {
    // Two surface ids that sanitize to the same NCName, plus one that collides
    // with a prefix the exporter mints for itself.
    const doc = parse(
      exportBpmnXml(
        board({
          pools: [fakePool('sales', [0, 0, POOL_W, POOL_H], { name: 'S' })],
          nodes: [
            fakeNode('a:b', 'task', [BAND + 10, 20, 20, 20]),
            fakeNode('a/b', 'task', [BAND + 60, 20, 20, 20]),
            fakeNode('Process_sales', 'task', [BAND + 110, 20, 20, 20]),
          ],
        })
      )
    );
    const ids = Array.from(doc.getElementsByTagName('*'))
      .map(element => element.getAttribute('id'))
      .filter((id): id is string => id !== null);
    expect(ids.length).toBeGreaterThan(5);
    expect(new Set(ids).size).toBe(ids.length);
    // …and each is a valid NCName.
    for (const id of ids) expect(id).toMatch(/^[A-Za-z_][A-Za-z0-9_.\-]*$/);
  });
});

describe('an empty board', () => {
  const doc = parse(exportBpmnXml(board({})));

  it('is still a valid, empty BPMN document', () => {
    expect(doc.documentElement.localName).toBe('definitions');
    // A process with zero flow elements is legal (`tProcess`), and a
    // `definitions` with no process at all is a document about nothing.
    expect(model(doc, 'process')).toHaveLength(1);
    expect(model(doc, 'process')[0].children).toHaveLength(0);
    expect(model(doc, 'collaboration')).toHaveLength(0);
    const plane = di(doc, 'BPMNPlane');
    expect(plane).toHaveLength(1);
    expect(attr(plane[0], 'bpmnElement')).toBe(
      attr(model(doc, 'process')[0], 'id')
    );
    expect(plane[0].children).toHaveLength(0);
  });
});

/* ── The command ──────────────────────────────────────────────────────── */

/**
 * A `std` holding just enough for the export guard: a selection, and an empty
 * answer for every optional service — a command registry it does not have, a
 * translation catalogue it does not have.
 */
function fakeStd(selected: unknown[], options: { readonly?: boolean } = {}) {
  const gfx = { selection: { selectedElements: selected } };
  return {
    store: { readonly: options.readonly === true },
    get: () => gfx,
    getOptional: () => undefined,
    provider: { getAll: () => new Map() },
  } as unknown as BlockStdScope;
}

describe('the export command', () => {
  const descriptor = bpmnCommands.find(c => c.id === 'bpmn.exportXml');

  it('declares itself as a selection-scoped action on the pool', () => {
    expect(descriptor).toBeDefined();
    expect(descriptor!.kind).toBe('action');
    expect(descriptor!.owner).toBe('bpmn');
    expect(descriptor!.scope).toBe('edgeless');
    expect(descriptor!.category).toBe('swimlanes');
    expect(descriptor!.availability).toBe('selection');
    expect(descriptor!.iconKey).toBeTruthy();
    expect(descriptor!.telemetry).toEqual({
      framework: 'bpmn',
      element: 'pool:export-xml',
    });
  });

  it('stays out of the senior sub-menu and lives in the "⋮"', () => {
    // It draws nothing, so it is not what the sub-menu is for; it stays in the
    // catalogue because the catalogue is the TOTAL surface (`registry.unit`).
    expect(descriptor!.surfaces).not.toContain('senior-menu');
    expect(descriptor!.surfaces).toContain('catalogue');
    expect(descriptor!.surfaces).toContain('contextual-toolbar');
    expect(descriptor!.surfaces).toContain('palette');
    expect(descriptor!.surfaces).toContain('agent');
  });

  it('offers itself when a pool is selected, and only then', () => {
    expect(descriptor!.when?.(fakeStd([]))).toBe(false);
    expect(
      descriptor!.when?.(fakeStd([fakeNode('a', 'task', [0, 0, 10, 10])]))
    ).toBe(false);
    expect(
      descriptor!.when?.(fakeStd([fakePool('p', [0, 0, POOL_W, POOL_H])]))
    ).toBe(true);
  });

  it('sits in the pool toolbar’s "⋮" and invokes the command by id', () => {
    // Not a primary button: it is the rarest thing anybody does to a pool, and
    // `ActionPlacement.More` is the single flag `renderToolbar` partitions the
    // row on. Declared here rather than restated — the entry INVOKES the
    // command, so there is one behaviour, one guard and one telemetry emission
    // whether it is reached from the "⋮", the palette or the agent.
    // Typed as a generator entry, which is what it declares itself to be: the
    // config's `actions` is a heterogeneous tuple, and the narrowing a `find`
    // gives back is the union of everything on the row.
    const entry = bpmnPoolToolbarConfig.actions.find(
      action => action.id === 'z.export-xml'
    ) as unknown as ToolbarActionGenerator | undefined;
    expect(entry).toBeDefined();
    expect(entry!.placement).toBe(ActionPlacement.More);

    // A menu line is drawn from `label`, not from a tooltip: the "⋮" is already
    // words, and a tooltip repeating them would be the same sentence twice.
    const std = fakeStd([fakePool('p', [0, 0, POOL_W, POOL_H])]);
    const generated = entry!.generate({ std } as never);
    expect(generated?.label).toBe('Export BPMN XML');
    expect(typeof generated?.run).toBe('function');

    // And it is gated on the command being REGISTERED, so the `bpmn` flag being
    // off removes the entry rather than greying it (`docs/adr/0009`).
    const when = entry!.when;
    expect(typeof when === 'function' && when({ std } as never)).toBe(false);
  });

  it('still offers itself on a READ-ONLY document', () => {
    // Unlike the lane gestures, which are about to write: an export reads, and
    // a published read-only process is exactly the board somebody wants to
    // take to bpmn.io.
    const pool = fakePool('p', [0, 0, POOL_W, POOL_H]);
    expect(descriptor!.when?.(fakeStd([pool], { readonly: true }))).toBe(true);
  });
});
