import type { BpmnNodeKind } from '@labre/affine-model';
import {
  ActionPlacement,
  type ToolbarActionGenerator,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { bpmnExportFilename } from '../actions';
import { bpmnCommands } from '../commands';
import { BPMN_NS, BPMN_XML_OF_KIND, exportBpmnXml, toNcName } from '../export';
import { BPMN_ROLE } from '../roles';
import { bpmnPoolToolbarConfig } from '../toolbar/config';
import {
  ALL_KINDS,
  BAND,
  board,
  collaborationBoard,
  fakeConnector,
  fakeNode,
  fakePool,
  POOL_H,
  POOL_W,
} from './board-stub';

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

/* ── Tests ────────────────────────────────────────────────────────────── */

describe('a two-participant collaboration', () => {
  const { board: composed } = collaborationBoard();
  const xml = exportBpmnXml(composed, { name: 'Order to cash' });
  const doc = parse(xml);

  it('is a well-formed `definitions` in the four spec namespaces', () => {
    const root = doc.documentElement;
    expect(root.localName).toBe('definitions');
    // The ONE attribute `definitions` requires.
    expect(attr(root, 'targetNamespace')).toBeTruthy();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('writes the four namespace URIs the spec defines, character for character', () => {
    // LITERALS, and deliberately not `BPMN_NS.*`. Every other assertion in this
    // file reads the document through those constants, which proves the output
    // agrees with them and NOTHING about whether they are the spec's — an
    // adversarial review swapped `di` for `dc`, and then substituted the stale
    // `.../BPMNDI/1.0.0` erratum that this module's own doc comment warns
    // against, and the whole suite stayed green both times.
    //
    // Four strings, typed out once, from §15.3.1 and Annex B. This is the line
    // that fails if anybody edits them.
    const root = doc.documentElement;
    expect(root.namespaceURI).toBe(
      'http://www.omg.org/spec/BPMN/20100524/MODEL'
    );
    expect(attr(root, 'xmlns:bpmn')).toBe(
      'http://www.omg.org/spec/BPMN/20100524/MODEL'
    );
    expect(attr(root, 'xmlns:bpmndi')).toBe(
      'http://www.omg.org/spec/BPMN/20100524/DI'
    );
    expect(attr(root, 'xmlns:di')).toBe(
      'http://www.omg.org/spec/DD/20100524/DI'
    );
    expect(attr(root, 'xmlns:dc')).toBe(
      'http://www.omg.org/spec/DD/20100524/DC'
    );

    // …and the elements really are IN them, so a declaration nobody uses would
    // not pass either. The prefixes are not the contract (bpmn.io writes the
    // same two DD namespaces as `omgdi` / `omgdc`); the URIs are.
    expect(di(doc, 'BPMNDiagram')[0]?.namespaceURI).toBe(
      'http://www.omg.org/spec/BPMN/20100524/DI'
    );
    expect(
      all(doc, 'http://www.omg.org/spec/DD/20100524/DC', 'Bounds').length
    ).toBeGreaterThan(0);
    expect(
      all(doc, 'http://www.omg.org/spec/DD/20100524/DI', 'waypoint').length
    ).toBeGreaterThan(0);
  });

  it('says which end is the source, on all three kinds of flow', () => {
    // The highest-consequence property in the module and the cheapest to lose:
    // reversing `sourceRef`/`targetRef` on every flow leaves a well-formed
    // document, unchanged DI, and a process that reads backwards in bpmn.io.
    // The composed board draws start → task, task → remote, annotation → task.
    const idOf = (surfaceId: string) => toNcName(surfaceId);

    const sequence = model(doc, 'sequenceFlow')[0];
    expect(attr(sequence, 'sourceRef')).toBe(idOf('n-startEvent'));
    expect(attr(sequence, 'targetRef')).toBe(idOf('n-task'));

    const message = model(doc, 'messageFlow')[0];
    expect(attr(message, 'sourceRef')).toBe(idOf('n-task'));
    expect(attr(message, 'targetRef')).toBe(idOf('n-remote'));

    // An association carries no direction — `associationDirection="None"` — but
    // the two ends are still the two ends the author drew, and a reader (or a
    // tool laying the line out) is entitled to that.
    const association = model(doc, 'association')[0];
    expect(attr(association, 'sourceRef')).toBe(idOf('n-textAnnotation'));
    expect(attr(association, 'targetRef')).toBe(idOf('n-task'));
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

    // Everything a reader can see on the canvas — the LANES included, which is
    // what the live recette caught: a lane with no shape is a subdivision the
    // model knows about and no tool draws. The `dataObject` behind a reference
    // is deliberately NOT among them: DI attaches to the reference.
    const drawable = [
      ...model(doc, 'participant'),
      ...model(doc, 'lane'),
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

  it('draws each lane: a BPMNShape tiling the pool, not just a laneSet', () => {
    // The gap the live recette found. The laneSet and its `flowNodeRef`s were
    // already right, and bpmn.io drew the pool with NO subdivisions at all —
    // because a lane is a DiagramElement like any other, and a tool draws what
    // the plane describes. Without this assertion the model can be perfect and
    // the picture wrong.
    const laneIds = model(doc, 'lane').map(lane => attr(lane, 'id'));
    expect(laneIds).toHaveLength(2);

    const shapes = laneIds.map(id =>
      di(doc, 'BPMNShape').find(shape => attr(shape, 'bpmnElement') === id)
    );
    expect(shapes.every(shape => shape !== undefined)).toBe(true);

    const bounds = shapes.map(shape => {
      const box = all(shape!, BPMN_NS.dc, 'Bounds')[0];
      return {
        x: Number(attr(box, 'x')),
        y: Number(attr(box, 'y')),
        w: Number(attr(box, 'width')),
        h: Number(attr(box, 'height')),
      };
    });

    // `isHorizontal` is meaningful on exactly two things — a pool and a lane.
    for (const shape of shapes) {
      expect(attr(shape!, 'isHorizontal')).toBe('true');
    }

    // The bands tile the pool's PLOT: they start after the participant name
    // band, span the rest of its width, and between them cover its full height
    // with no gap and no overlap. (Pool "Sales" is [0, 0, POOL_W, POOL_H] and
    // the two lanes are of equal weight.)
    for (const band of bounds) {
      expect(band.x).toBe(BAND);
      expect(band.w).toBe(POOL_W - BAND);
    }
    expect(bounds[0].y).toBe(0);
    expect(bounds[0].h).toBe(POOL_H / 2);
    expect(bounds[1].y).toBe(bounds[0].y + bounds[0].h);
    expect(bounds[1].h).toBe(POOL_H / 2);
    // …which is also bpmn-js's own convention to within our band width: it lays
    // its lanes out 30 units right of the participant, and ours is 28.
    expect(Math.abs(BAND - 30)).toBeLessThanOrEqual(2);
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

/**
 * What happens to things drawn BESIDE the pools — the second gap the live
 * recette found.
 *
 * A process with no participant has no shape on a collaboration plane, so
 * bpmn-js imports its contents and draws none of them: an annotation dropped
 * next to the pools used to vanish. `tCollaboration` ends on `artifact*`, which
 * is a legal and drawable home for exactly the three things that were
 * disappearing.
 */
describe('a collaboration with things drawn outside every pool', () => {
  /** One pool, plus an annotation, a group and a stray task beside it. */
  const orphanBoard = () => {
    const pool = fakePool('pool-a', [0, 0, POOL_W, POOL_H], { name: 'Sales' });
    const inside = fakeNode('inside', 'task', [BAND + 20, 60, 60, 40], 'Work');
    return board({
      pools: [pool],
      nodes: [
        inside,
        // Far to the right of the pool: outside its plot on the centre test.
        fakeNode('note', 'textAnnotation', [900, 40, 120, 40], 'SLA 24h'),
        fakeNode('lasso', 'group', [900, 120, 200, 120], 'Later'),
        fakeNode('stray', 'task', [900, 300, 120, 60], 'Orphan task'),
      ],
      connectors: [
        fakeConnector('link', BPMN_ROLE.association, {
          source: 'note',
          target: 'inside',
        }),
      ],
    });
  };

  const doc = parse(exportBpmnXml(orphanBoard(), { name: 'Board' }));
  const collaboration = model(doc, 'collaboration')[0];

  it('puts orphan ARTIFACTS on the collaboration, where they are drawn', () => {
    expect(model(doc, 'textAnnotation')[0].parentElement).toBe(collaboration);
    expect(model(doc, 'group')[0].parentElement).toBe(collaboration);
  });

  it('puts a cross-scope association on the collaboration too', () => {
    // Its two ends are in different scopes — an annotation beside the pools,
    // a task inside one — so it belongs to neither, and the collaboration is
    // the common ancestor that can legally hold it. Filing it with its source
    // would have put it in a process that cannot draw it.
    const association = model(doc, 'association')[0];
    expect(association.parentElement).toBe(collaboration);
    // And both references still resolve, by id, within the one document.
    const ids = new Set(
      Array.from(doc.getElementsByTagName('*')).map(e => e.getAttribute('id'))
    );
    expect(ids.has(attr(association, 'sourceRef'))).toBe(true);
    expect(ids.has(attr(association, 'targetRef'))).toBe(true);
  });

  it('keeps `participant* → messageFlow* → artifact*`, as tCollaboration does', () => {
    const order = Array.from(collaboration.children).map(c => c.localName);
    expect(order).toEqual([
      'participant',
      'textAnnotation',
      'group',
      'association',
    ]);
  });

  it('still needs a participant-less process for an orphan FLOW NODE', () => {
    // The honest limit, pinned so it is a decision rather than a surprise: a
    // task is a flow element and has no home on a collaboration. It is written
    // correctly and any tool reading the MODEL will find it — but bpmn-js has
    // no participant to draw it in, so it is not rendered. The alternatives are
    // to invent a pool the author never drew or to drop the element, and the
    // export refuses both.
    const processes = model(doc, 'process');
    expect(processes).toHaveLength(2);
    const unassigned = processes.find(p => !attr(p, 'id')?.includes('pool'))!;
    expect(Array.from(unassigned.children).map(c => attr(c, 'id'))).toEqual([
      'stray',
    ]);
    // It is not referenced by any participant — that is exactly what makes it
    // undrawable, and what the PR body documents.
    const referenced = model(doc, 'participant').map(p =>
      attr(p, 'processRef')
    );
    expect(referenced).not.toContain(attr(unassigned, 'id'));
  });

  it('mints no participant-less process when only artifacts fall outside', () => {
    const clean = parse(
      exportBpmnXml(
        board({
          pools: [fakePool('p', [0, 0, POOL_W, POOL_H], { name: 'P' })],
          nodes: [
            fakeNode('in', 'task', [BAND + 20, 60, 60, 40]),
            fakeNode('note', 'textAnnotation', [900, 40, 120, 40], 'Aside'),
          ],
        })
      )
    );
    // One pool, one process. The annotation needed no process invented for it.
    expect(model(clean, 'process')).toHaveLength(1);
    expect(model(clean, 'textAnnotation')[0].parentElement?.localName).toBe(
      'collaboration'
    );
  });

  it('leaves an artifact drawn ON a pool in that pool’s process', () => {
    // The rule is about what falls OUTSIDE, not about artifacts in general: an
    // annotation drawn on a participant belongs with the work it is about.
    const inside = parse(
      exportBpmnXml(
        board({
          pools: [fakePool('p', [0, 0, POOL_W, POOL_H], { name: 'P' })],
          nodes: [fakeNode('note', 'textAnnotation', [BAND + 20, 60, 60, 40])],
        })
      )
    );
    expect(model(inside, 'textAnnotation')[0].parentElement?.localName).toBe(
      'process'
    );
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

/**
 * What a label made of hostile characters does to the file.
 *
 * The failure mode this guards is the worst one the module has: an unescaped
 * `&` or `<` in a pool name produces a file that is not well-formed, the user
 * downloads it, and NO BPMN tool can open it. Nothing else in the product
 * breaks that visibly, and until an adversarial review deleted the escaper and
 * watched the suite stay green, nothing here noticed.
 */
describe('labels that fight the format', () => {
  const HOSTILE = 'Q&A <test> "quote" \'apos\'';

  const hostileBoard = () =>
    board({
      pools: [fakePool('p', [0, 0, POOL_W, POOL_H], { name: HOSTILE })],
      nodes: [
        fakeNode('t', 'task', [BAND + 20, 60, 60, 40], HOSTILE),
        fakeNode('n', 'textAnnotation', [BAND + 120, 60, 60, 40], HOSTILE),
        fakeNode('g', 'group', [BAND + 220, 60, 60, 40], HOSTILE),
      ],
      connectors: [
        fakeConnector('c', BPMN_ROLE.sequenceFlow, {
          source: 't',
          target: 'n',
        }),
      ],
    });

  it('escapes the reserved characters, literally, in every attribute', () => {
    const xml = exportBpmnXml(hostileBoard(), { name: HOSTILE });
    // The escaped form, spelled out — not "it parses", which a serializer that
    // dropped the label entirely would also satisfy.
    expect(xml).toContain(
      'name="Q&amp;A &lt;test&gt; &quot;quote&quot; &apos;apos&apos;"'
    );
    // …and no raw reserved character survives inside a quoted value.
    expect(xml).not.toContain('name="Q&A');
    expect(xml).not.toContain('<test>');
  });

  it('escapes it on every carrier, not just the one that was looked at', () => {
    // The label reaches the file through four different attributes and one
    // element, and each of them is a separate line of code that could forget.
    const xml = exportBpmnXml(hostileBoard(), { name: HOSTILE });
    const escaped = 'Q&amp;A &lt;test&gt; &quot;quote&quot; &apos;apos&apos;';

    // `participant/@name`, the flow node's `@name`, the collaboration's `@name`,
    // and the group's label — which lives on `categoryValue/@value`, not on a
    // `name` the group does not have.
    expect(xml).toContain(
      `<bpmn:participant id="Participant_p" name="${escaped}"`
    );
    expect(xml).toContain(`<bpmn:task id="t" name="${escaped}"`);
    expect(xml).toContain(`value="${escaped}"`);
    // …and character DATA, escaped differently and deliberately: the quotes and
    // the apostrophe need no reference inside an element.
    expect(xml).toContain(
      '<bpmn:text>Q&amp;A &lt;test&gt; "quote" \'apos\'</bpmn:text>'
    );
    // The document still parses, which is the whole point of the exercise.
    expect(parse(xml)).toBeTruthy();
  });

  it('keeps a MULTI-LINE label multi-line, in an attribute', () => {
    // XML 1.0 §3.3.3: attribute-value normalization replaces a literal newline,
    // CR or tab in an attribute value with a SPACE, in every conformant parser.
    // Only a character reference survives it. A two-line task name is ordinary
    // on this canvas — it is how a task fits in its box — so writing it raw
    // loses the author's line break silently, with no warning anywhere.
    //
    // Asserted on the OUTPUT rather than on a round trip, because happy-dom's
    // `DOMParser` decodes neither numeric references nor `&apos;` in attribute
    // values — it would report the loss this test exists to prevent whether or
    // not the loss happened. The genuine round trip runs in chromium, in
    // `integration-test/src/__tests__/edgeless/bpmn.spec.ts`.
    const label = 'Check the\nstock\tnow';
    const xml = exportBpmnXml(
      board({ nodes: [fakeNode('t', 'task', [0, 0, 60, 40], label)] })
    );
    expect(xml).toContain('name="Check the&#10;stock&#9;now"');
    expect(parse(xml)).toBeTruthy();
  });

  it('keeps a multi-line annotation multi-line, in character data', () => {
    // The other half, and the reason the two escapers are two: inside an
    // element, whitespace is content and a newline needs no reference at all.
    const label = 'First line\nSecond line';
    const doc = parse(
      exportBpmnXml(
        board({
          nodes: [fakeNode('n', 'textAnnotation', [0, 0, 60, 40], label)],
        })
      )
    );
    expect(model(model(doc, 'textAnnotation')[0], 'text')[0].textContent).toBe(
      label
    );
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

  it('keeps accented letters, which NCName has always allowed', () => {
    // Folding them to `_` was lossier than the format requires, and it showed
    // where a human actually reads these: two ids one accent apart came out
    // differing only by the minter's `_2` suffix in bpmn.io's properties panel.
    expect(toNcName('tâche-1')).toBe('tâche-1');
    expect(toNcName('Ökonomie')).toBe('Ökonomie');
    expect(toNcName('工程')).toBe('工程');
    // …and an accented opener is still a valid opener, so no `_` is prefixed.
    expect(toNcName('École')).toBe('École');
  });

  it('gives two lanes with the SAME stored id two distinct xsd:IDs', () => {
    // A hand-edited or badly-merged document can carry a repeated lane id. Two
    // `lane` elements sharing an `id` is invalid — `xsd:ID` is unique across the
    // whole document — so the minter has to see each band, not each distinct
    // key.
    const doc = parse(
      exportBpmnXml(
        board({
          pools: [
            fakePool('p', [0, 0, POOL_W, POOL_H], {
              name: 'P',
              lanes: [
                { id: 'dup', name: 'One', size: 1 },
                { id: 'dup', name: 'Two', size: 1 },
              ],
            }),
          ],
        })
      )
    );
    const laneIds = model(doc, 'lane').map(lane => attr(lane, 'id'));
    expect(laneIds).toHaveLength(2);
    expect(new Set(laneIds).size).toBe(2);
    // …and each still gets its own shape, pointing at its own id.
    const drawn = di(doc, 'BPMNShape').map(s => attr(s, 'bpmnElement'));
    for (const id of laneIds) expect(drawn).toContain(id);
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
            // A surface id that collides with an id the exporter mints for
            // itself. Retargeted when the satellite ids started being derived
            // from the id an element SETTLED on rather than from its surface id
            // (ADR 0012 D3, as implemented): the process of pool `sales` is now
            // `Process_Participant_sales`, so `Process_sales` collides with
            // nothing and this fixture would have stopped testing anything.
            fakeNode('Process_Participant_sales', 'task', [
              BAND + 110,
              20,
              20,
              20,
            ]),
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

describe('what the file is called', () => {
  const named = (title?: string, poolName?: string) =>
    bpmnExportFilename({
      store: {
        id: 'doc-1',
        workspace: { meta: { getDocMeta: () => ({ title }) } },
      },
      get: () => ({
        selection: {
          selectedElements: poolName
            ? [fakePool('p', [0, 0, POOL_W, POOL_H], { name: poolName })]
            : [],
        },
      }),
    } as unknown as BlockStdScope);

  it('prefers the document title, then the pool, then a last resort', () => {
    expect(named('Order to cash', 'Sales')).toBe('Order to cash');
    expect(named(undefined, 'Sales')).toBe('Sales');
    expect(named()).toBe('process');
  });

  it('replaces the characters a file system reserves', () => {
    expect(named('a/b:c*d?e"f<g>h|i')).toBe('a-b-c-d-e-f-g-h-i');
  });

  it('trims a trailing dot, which would eat the extension', () => {
    // Windows strips trailing dots and spaces from a name, so `Order.` +
    // `.bpmn` is how a file arrives called `Order.bpmn`… or `Order`, depending
    // on who is doing the stripping. Neither is what the author asked for.
    expect(named('Order to cash.')).toBe('Order to cash');
    expect(named('Trailing space ')).toBe('Trailing space');
    // …and a title made of nothing else still yields a usable name.
    expect(named('...')).toBe('process');
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
