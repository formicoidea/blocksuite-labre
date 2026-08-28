import type { BpmnNodeKind } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { BPMN_XML_OF_KIND, exportBpmnXml } from '../export';
import { BPMN_KIND_OF_XML, importBpmnXml } from '../import';
import { BPMN_XML_IMPORT } from '../interchange';
import { BPMN_ROLE } from '../roles';
import { ALL_KINDS, boardFromProps, collaborationBoard } from './board-stub';

/**
 * The BPMN 2.0 XML import (`docs/adr/0012`, D1–D6).
 *
 * Plain strings and plain objects, no editor and no DI — the reader is a pure
 * function of a string, which is the property P3 exists to protect and the
 * reason this file can exist at all.
 *
 * What is asserted, and in this order of importance:
 *
 * 1. the **fixed point** — a board exported, read back and exported again is
 *    byte-identical. It is the ADR's headline guarantee and the only assertion
 *    here that fails when any of the others is quietly wrong;
 * 2. the **three states** on a file Labre did not write: what was drawn, what
 *    was kept verbatim, what was kept and will not be written back;
 * 3. the **degenerate** files, because an importer meets those on its first
 *    afternoon in the wild.
 *
 * The escaped-label round trip is NOT here: happy-dom's `DOMParser` decodes
 * neither numeric character references nor `&apos;` in an attribute value, so
 * this environment cannot tell a label that survived from one that did not. It
 * runs in chromium, in `integration-test/src/__tests__/edgeless/bpmn.spec.ts`.
 */

/* ── The table, read backwards ────────────────────────────────────────── */

describe('the kind table, inverted', () => {
  it('answers every one of the seventeen kinds, and is injective', () => {
    // Derived from `BPMN_XML_OF_KIND`, so it cannot drift from the writer —
    // but a table with two kinds on one (element, trigger) pair would collapse
    // silently into sixteen answers and lose one artefact on every import.
    expect(BPMN_KIND_OF_XML.size).toBe(ALL_KINDS.length);

    for (const kind of ALL_KINDS) {
      const mapping = BPMN_XML_OF_KIND[kind];
      const key = `${mapping.element}#${mapping.eventDefinition ?? ''}`;
      expect(BPMN_KIND_OF_XML.get(key), kind).toBe(kind);
    }
  });

  it('tells the four triggered events from their plain siblings', () => {
    const kindOf = (element: string, trigger?: string) =>
      BPMN_KIND_OF_XML.get(`${element}#${trigger ?? ''}`);

    expect(kindOf('startEvent')).toBe('startEvent');
    expect(kindOf('startEvent', 'messageEventDefinition')).toBe(
      'startEventMessage'
    );
    expect(kindOf('startEvent', 'timerEventDefinition')).toBe(
      'startEventTimer'
    );
    expect(kindOf('endEvent', 'messageEventDefinition')).toBe(
      'endEventMessage'
    );
    expect(kindOf('endEvent', 'terminateEventDefinition')).toBe(
      'endEventTerminate'
    );
    // An Analytic trigger on a start event is not one of ours, and inventing a
    // nearest match would be the guess this whole ADR forbids.
    expect(kindOf('startEvent', 'signalEventDefinition')).toBeUndefined();
    expect(kindOf('boundaryEvent')).toBeUndefined();
  });
});

/* ── The fixed point ──────────────────────────────────────────────────── */

describe('the round trip is a fixed point', () => {
  const NAME = 'Order to cash';

  it('exports, reads back and exports again to the very same bytes', () => {
    // The ADR's headline guarantee: `export(import(export(board)))` is
    // byte-identical to `export(board)` for a board built from the mapped
    // vocabulary. Every id in the second file is one the FIRST file handed
    // over — that is D3's whole point, and this string comparison is the only
    // test that can tell an id that was given back from one that was minted to
    // look like it.
    const { board: drawn } = collaborationBoard();
    const first = exportBpmnXml(drawn, { name: NAME });

    const { elements } = importBpmnXml(first);
    const second = exportBpmnXml(boardFromProps(elements), { name: NAME });

    expect(second).toBe(first);
  });

  it('reports a Labre file as wholly mapped: nothing carried, nothing lost', () => {
    // The other half of the same claim, and the one a user reads. A file this
    // library wrote must come back with an EMPTY middle column: an attribute
    // the writer writes and the reader carries would be a slow leak — the
    // payload growing by a few keys on every round trip, for ever.
    const { board: drawn } = collaborationBoard();
    const { report } = importBpmnXml(exportBpmnXml(drawn, { name: NAME }));

    expect(report.carried).toBe(0);
    expect(report.quarantined).toBe(0);
    expect(report.notes).toEqual([]);
    // Two pools, two lanes, eighteen artefacts, three arrows.
    expect(report.mapped).toBe(2 + 2 + drawn.nodes.length + 3);
    expect(report.sourceVersion).toBe('2.0 (Labre)');
  });

  it('gives every element back the id the file called it', () => {
    const { board: drawn } = collaborationBoard();
    const { elements } = importBpmnXml(exportBpmnXml(drawn, { name: NAME }));

    const ids = elements.map(
      element =>
        (element.interchange as Record<string, { id?: string }>).bpmn.id
    );
    // The exporter's own minted names, verbatim — not the surface ids they were
    // derived from, which the file never carried and the reader must not guess.
    expect(ids).toContain('Participant_pool-sales');
    expect(ids).toContain('n-task');
    expect(ids).toContain('Flow_c-seq');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rebuilds the two pools, their lanes and every artefact', () => {
    const { board: drawn } = collaborationBoard();
    const { elements } = importBpmnXml(exportBpmnXml(drawn, { name: NAME }));

    const pools = elements.filter(element => element.type === 'bpmnPool');
    expect(pools.map(pool => pool.name)).toEqual(['Sales', 'Supplier']);
    expect(
      (pools[0].lanes as { name: string; size: number }[]).map(
        lane => lane.name
      )
    ).toEqual(['Front office', 'Back office']);
    // Equal bands come back equal: the weight is the band's drawn height, and
    // two halves of the same pool are the same number whatever it is.
    const sizes = (pools[0].lanes as { size: number }[]).map(lane => lane.size);
    expect(sizes[0]).toBe(sizes[1]);
    expect(pools[1].lanes).toBeUndefined();

    // Every kind, back as itself, and the role re-stamped from the element
    // name rather than remembered from anywhere.
    const nodes = elements.filter(element => element.type === 'bpmnNode');
    const kinds = new Set(nodes.map(node => node.kind as BpmnNodeKind));
    for (const kind of ALL_KINDS) expect(kinds.has(kind), kind).toBe(true);
    const task = nodes.find(node => node.text === 'Label task');
    expect(task?.role).toBe(BPMN_ROLE.task);

    const connectors = elements.filter(element => element.type === 'connector');
    expect(connectors.map(edge => edge.role)).toEqual([
      BPMN_ROLE.sequenceFlow,
      BPMN_ROLE.messageFlow,
      BPMN_ROLE.association,
    ]);
    // A message flow that came in named is still named.
    expect(connectors[1].text).toBe('Order');
  });

  it('is the capability the registry declares, not a second door', () => {
    expect(BPMN_XML_IMPORT.id).toBe('bpmn:bpmn:import');
    expect(BPMN_XML_IMPORT.direction).toBe('import');
    // The SAME format object as the export declares: `bpmn` is the key foreign
    // matter rides under, and a reader and a writer that disagreed about it
    // would write payloads the other could not find.
    expect(BPMN_XML_IMPORT.format.id).toBe('bpmn');
    expect(BPMN_XML_IMPORT.format.tier).toBe('semantic');
    // The registry's `run` IS the pure function, with nothing wrapped round it.
    expect(BPMN_XML_IMPORT.run).toBe(importBpmnXml);
  });
});

/* ── A file Labre did not write ───────────────────────────────────────── */

/**
 * A small `.bpmn` in bpmn.io's own dialect, hand-written rather than generated.
 *
 * Everything in it is a case: the `bpmn2:` prefix nobody else uses, a
 * `camunda:` extension on a task, a `bioc:` colour on a shape, a
 * `boundaryEvent` (Analytic vocabulary Labre does not draw), a `documentation`
 * child, an `<import>` at document scope, and an `exporter` pair to read the
 * version off.
 */
const FOREIGN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
    xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
    xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"
    id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn"
    exporter="Camunda Modeler" exporterVersion="5.0.0">
  <bpmn2:import importType="http://www.w3.org/2001/XMLSchema" location="shared.xsd" namespace="http://shared" />
  <bpmn2:collaboration id="Collaboration_0">
    <bpmn2:participant id="Participant_0x9k2j" name="Retailer" processRef="Process_0" />
  </bpmn2:collaboration>
  <bpmn2:process id="Process_0" isExecutable="true" camunda:historyTimeToLive="30">
    <bpmn2:startEvent id="StartEvent_1" name="Order in">
      <bpmn2:outgoing>Flow_1</bpmn2:outgoing>
    </bpmn2:startEvent>
    <bpmn2:userTask id="Activity_1" name="Pick the goods" camunda:assignee="demo">
      <bpmn2:documentation>Two people, one trolley.</bpmn2:documentation>
      <bpmn2:extensionElements>
        <camunda:properties>
          <camunda:property name="sla" value="24h" />
        </camunda:properties>
      </bpmn2:extensionElements>
    </bpmn2:userTask>
    <bpmn2:boundaryEvent id="Boundary_1" name="Too slow" attachedToRef="Activity_1">
      <bpmn2:timerEventDefinition id="Timer_1" />
    </bpmn2:boundaryEvent>
    <bpmn2:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Activity_1" />
    <bpmn2:sequenceFlow id="Flow_esc" name="too late" sourceRef="Boundary_1" targetRef="StartEvent_1" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Collaboration_0">
      <bpmndi:BPMNShape id="Shape_p" bpmnElement="Participant_0x9k2j" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="600" height="250" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_s" bpmnElement="StartEvent_1">
        <dc:Bounds x="212" y="152" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_a" bpmnElement="Activity_1" bioc:stroke="#831311" bioc:fill="#ffcdd2">
        <dc:Bounds x="300" y="130" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_b" bpmnElement="Boundary_1">
        <dc:Bounds x="382" y="192" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_1" bpmnElement="Flow_1">
        <di:waypoint x="248" y="170" />
        <di:waypoint x="300" y="170" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_esc" bpmnElement="Flow_esc">
        <di:waypoint x="400" y="228" />
        <di:waypoint x="230" y="188" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>
`;

describe('a file written by another tool', () => {
  const result = importBpmnXml(FOREIGN, {});
  const { elements, report } = result;
  const payload = (element: (typeof elements)[number]) =>
    (element.interchange as Record<string, Record<string, unknown>>).bpmn;
  /** Carried attributes of one SCOPE — the source element they came off. */
  const attrsOf = (carried: Record<string, unknown>, scope: string) =>
    (carried.attrs as Record<string, Record<string, string>>)[scope] ?? {};
  /** Carried fragments filed under one scope: the element they were inside. */
  const childrenOf = (carried: Record<string, unknown>, scope: string) =>
    (carried.children as Record<string, string[]>)[scope] ?? [];
  const diOf = (carried: Record<string, unknown>, scope: string) =>
    (carried.di as Record<string, string[]>)[scope] ?? [];
  const pool = elements.find(element => element.type === 'bpmnPool')!;
  const nodes = elements.filter(element => element.type === 'bpmnNode');

  it('draws what it has an artefact for, and says which version it read', () => {
    expect(pool.name).toBe('Retailer');
    expect(pool.xywh).toBe('[160,80,600,250]');
    expect(nodes.map(node => node.kind)).toEqual(['startEvent', 'taskUser']);
    expect(nodes[1].text).toBe('Pick the goods');
    // The prefix is not the contract — this file says `bpmn2:` and means the
    // same namespace — and the version is what the file itself declares.
    expect(report.sourceVersion).toBe('2.0 (Camunda Modeler 5.0.0)');
  });

  it('keeps the vendor extension VERBATIM, on the element it was written on', () => {
    const task = payload(nodes[1]);
    expect(task.id).toBe('Activity_1');
    // An attribute in a foreign namespace, kept under the name the file used —
    // and under the SCOPE of the element that carried it, which for a task's
    // own attribute is `@self`.
    expect(attrsOf(task, '@self')['camunda:assignee']).toBe('demo');
    // …and a whole subtree, character for character, prefixes included: it is
    // meaningless under any other declaration.
    expect(childrenOf(task, '@self')).toContain(
      '<bpmn2:documentation>Two people, one trolley.</bpmn2:documentation>'
    );
    // …whitespace included, which is what "verbatim" means: the file's own
    // indentation is inside the fragment, so the assertion is on what it
    // CONTAINS rather than on a string that has been tidied up.
    const extension = childrenOf(task, '@self').find(child =>
      child.startsWith('<bpmn2:extensionElements>')
    );
    expect(extension).toContain('<camunda:property name="sla" value="24h" />');
    expect(extension).toContain('<camunda:properties>');
  });

  it('keeps a comment inside a carried fragment, which "verbatim" also means', () => {
    const { elements: read } = importBpmnXml(
      FOREIGN.replace(
        '<camunda:properties>',
        '<!-- the SLA is contractual --><camunda:properties>'
      ),
      {}
    );
    const task = read.filter(element => element.type === 'bpmnNode')[1];
    const extension = childrenOf(
      (task.interchange as Record<string, Record<string, unknown>>).bpmn,
      '@self'
    ).find(child => child.startsWith('<bpmn2:extensionElements>'));
    expect(extension).toContain('<!-- the SLA is contractual -->');
  });

  it('carries an Analytic flow node on the pool of its process', () => {
    // A boundary event is not in the descriptive profile and Labre draws none:
    // it is kept whole on the pool — the nearest mapped element — under the
    // scope of the element it was a CHILD of, which is where a writer has to
    // put it back, and with the shape that draws it under its own id.
    const carried = payload(pool);
    expect(
      childrenOf(carried, '@process').some(child =>
        child.startsWith('<bpmn2:boundaryEvent id="Boundary_1"')
      )
    ).toBe(true);
    expect(
      childrenOf(carried, '@process').some(child =>
        child.includes('<bpmn2:timerEventDefinition id="Timer_1" />')
      )
    ).toBe(true);
    expect(diOf(carried, 'Boundary_1')[0]).toContain(
      'bpmnElement="Boundary_1"'
    );

    // It is NOT on the canvas: no third node, and no rule will ever judge it.
    expect(nodes).toHaveLength(2);

    // …and the report names it, by the id the FILE gave it, which is the only
    // name it has: it has no Labre element of its own to be pointed at by.
    const note = report.notes.find(
      entry => entry.element === 'bpmn2:boundaryEvent'
    );
    expect(note?.kind).toBe('carried');
    expect(note?.sourceId).toBe('Boundary_1');
  });

  it('carries a flow onto a carried node too — never a connector with a dead end', () => {
    // The commonest Analytic construct in the wild: a boundary event and the
    // error path off it. The event is carried (above), so its flow has an end
    // that is on no canvas — and a connector pointing at an element nobody
    // created is a broken arrow the next export drops silently, which is the
    // fourth state D1 says does not exist.
    const carried = payload(pool);
    expect(
      childrenOf(carried, '@process').some(child =>
        child.startsWith('<bpmn2:sequenceFlow id="Flow_esc"')
      )
    ).toBe(true);
    // Its own edge goes with it, so the pair can be put back together.
    expect(diOf(carried, 'Flow_esc')[0]).toContain('bpmnElement="Flow_esc"');

    // Exactly one connector — the flow between the two DRAWN artefacts — and
    // every endpoint on the canvas resolves to something the import created.
    const connectors = elements.filter(element => element.type === 'connector');
    expect(connectors).toHaveLength(1);
    const ids = new Set(
      elements
        .map(
          element =>
            (element.interchange as Record<string, { id?: string }> | undefined)
              ?.bpmn?.id
        )
        .filter(Boolean)
    );
    for (const connector of connectors) {
      expect(ids.has((connector.source as { id: string }).id)).toBe(true);
      expect(ids.has((connector.target as { id: string }).id)).toBe(true);
    }

    // …and the report says so, naming the flow and the end it could not draw.
    const note = report.notes.find(entry => entry.sourceId === 'Flow_esc');
    expect(note?.kind).toBe('warning');
    expect(note?.message).toContain('Boundary_1');
  });

  it('carries the declarations a carried fragment cannot be read without', () => {
    const document = attrsOf(payload(pool), '@definitions');
    // `xmlns:camunda` and `xmlns:bioc` are not decoration: a `camunda:property`
    // fragment written back without them is not a document anybody can parse.
    expect(document['xmlns:camunda']).toBe(
      'http://camunda.org/schema/1.0/bpmn'
    );
    expect(document['xmlns:bioc']).toBe(
      'http://bpmn.io/schema/bpmn/biocolor/1.0'
    );
    // The four this library writes for itself are NOT carried: they would come
    // back on every round trip and grow the payload for ever.
    expect(document['xmlns:bpmn2']).toBeUndefined();
    expect(document['xmlns:dc']).toBeUndefined();
    // The process's own foreign attribute rides on the pool that draws it —
    // under the PROCESS's scope, not the participant's, because they are two
    // source elements and only one of them said this.
    expect(
      attrsOf(payload(pool), '@process')['camunda:historyTimeToLive']
    ).toBe('30');
    expect(attrsOf(payload(pool), '@self')['camunda:historyTimeToLive']).toBe(
      undefined
    );
  });

  it('keeps `isExecutable="true"`, which the writer would otherwise downgrade', () => {
    // The exporter writes `isExecutable="false"` on every process it writes, so
    // a file that says `true` is saying something Labre does not model. Read and
    // dropped, it would be a silent model downgrade on every round trip.
    expect(attrsOf(payload(pool), '@process').isExecutable).toBe('true');
  });

  it('quarantines the vendor colour, and says why', () => {
    const task = payload(nodes[1]);
    const held = task.quarantined as { fragment: string; reason: string }[];
    expect(held.map(entry => entry.fragment).sort()).toEqual([
      'bioc:fill="#ffcdd2"',
      'bioc:stroke="#831311"',
    ]);
    expect(held[0].reason).toMatch(/stroke and the fill/);

    const note = report.notes.find(entry => entry.element === 'bioc:fill');
    expect(note?.kind).toBe('quarantined');
    expect(note?.sourceId).toBe('Activity_1');
  });

  it('quarantines the body of an EXPANDED sub-process, and draws it collapsed', () => {
    // D5 case 2, both halves. The pack draws the collapsed form only, so a body
    // written back under a shape flagged `isExpanded="false"` would be a model
    // and a diagram that contradict each other — and the body is still in the
    // document, waiting for the chantier that learns to draw it.
    const expanded = wrap(
      `<bpmn:process id="Proc">` +
        `<bpmn:subProcess id="Sub_1" name="Handle">` +
        `<bpmn:documentation>why</bpmn:documentation>` +
        `<bpmn:task id="Inner_1" name="Inside" />` +
        `</bpmn:subProcess></bpmn:process>`,
      `<bpmndi:BPMNShape id="S_sub" bpmnElement="Sub_1" isExpanded="true"><dc:Bounds x="0" y="0" width="300" height="200" /></bpmndi:BPMNShape>` +
        `<bpmndi:BPMNShape id="S_in" bpmnElement="Inner_1"><dc:Bounds x="40" y="60" width="100" height="80" /></bpmndi:BPMNShape>`
    );
    const { elements, report } = importBpmnXml(expanded, {});
    const nodes = elements.filter(element => element.type === 'bpmnNode');
    // One artefact: the sub-process. The task inside it is not on the canvas.
    expect(nodes.map(node => node.kind)).toEqual(['subProcess']);

    const carried = (
      nodes[0].interchange as Record<
        string,
        {
          quarantined: { fragment: string; reason: string }[];
          children: Record<string, string[]>;
        }
      >
    ).bpmn;
    const held = carried.quarantined.map(entry => entry.fragment);
    expect(
      held.some(fragment => fragment.includes('<bpmn:task id="Inner_1"'))
    ).toBe(true);
    // …and the inner DIAGRAM with it, because a body without its shapes is not
    // something a later chantier could draw.
    expect(
      held.some(fragment => fragment.includes('bpmnElement="Inner_1"'))
    ).toBe(true);
    // The activity's own documentation is NOT the body: carried, not held.
    expect(carried.children['@self'].join('')).toContain(
      '<bpmn:documentation>why</bpmn:documentation>'
    );
    expect(
      report.notes.some(
        note => note.kind === 'quarantined' && note.element === 'bpmn:task'
      )
    ).toBe(true);

    // The other half, which is what makes the quarantine mean anything: the
    // re-export draws it collapsed and the body is nowhere in the file.
    const written = exportBpmnXml(boardFromProps(elements));
    expect(written).toContain('isExpanded="false"');
    expect(written).not.toContain('Inner_1');
  });

  it('quarantines a document-level <import>, on the pool that holds the residue', () => {
    const held = payload(pool).quarantined as { fragment: string }[];
    expect(held.some(entry => entry.fragment.startsWith('<bpmn2:import'))).toBe(
      true
    );
    expect(
      report.notes.some(
        entry => entry.kind === 'quarantined' && entry.element === 'import'
      )
    ).toBe(true);
  });

  it('counts the three states, and the counts are not the notes', () => {
    // A UI wants a headline it can render without walking a list; neither
    // derives from the other. Two colours and one import are quarantined.
    expect(report.quarantined).toBe(3);
    expect(report.carried).toBeGreaterThan(4);
    // The pool, the two artefacts, the flow. Not the boundary event.
    expect(report.mapped).toBe(4);
  });

  it('reads it back into a file every id of which came from the file', () => {
    // Not a fixed point — this file is not one Labre wrote, and it holds
    // vocabulary the writer has no element for — but the identity of what WAS
    // mapped survives, which is what a third-party tool needs to recognise its
    // own process after a round trip.
    const written = exportBpmnXml(boardFromProps(elements));
    expect(written).toContain('id="Participant_0x9k2j"');
    expect(written).toContain('id="Activity_1"');
    expect(written).toContain('id="StartEvent_1"');
    expect(written).toContain('id="Flow_1"');
    // …and the colours are not written back beside a shape Labre now owns.
    expect(written).not.toContain('bioc:');
  });
});

/* ── Lanes ────────────────────────────────────────────────────────────── */

const LANED = (refs: {
  front: string[];
  back: string[];
}) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
    xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="D" targetNamespace="urn:t">
  <bpmn:collaboration id="C">
    <bpmn:participant id="P" name="Sales" processRef="Proc" />
  </bpmn:collaboration>
  <bpmn:process id="Proc">
    <bpmn:laneSet id="LS">
      <bpmn:lane id="L1" name="Front office">
        ${refs.front.map(id => `<bpmn:flowNodeRef>${id}</bpmn:flowNodeRef>`).join('')}
      </bpmn:lane>
      <bpmn:lane id="L2" name="Back office">
        ${refs.back.map(id => `<bpmn:flowNodeRef>${id}</bpmn:flowNodeRef>`).join('')}
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:task id="T1" name="Up top" />
    <bpmn:task id="T2" name="Down below" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Dia">
    <bpmndi:BPMNPlane id="Pl" bpmnElement="C">
      <bpmndi:BPMNShape id="S_P" bpmnElement="P" isHorizontal="true">
        <dc:Bounds x="0" y="0" width="600" height="300" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="S_L1" bpmnElement="L1" isHorizontal="true">
        <dc:Bounds x="30" y="0" width="570" height="100" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="S_L2" bpmnElement="L2" isHorizontal="true">
        <dc:Bounds x="30" y="100" width="570" height="200" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="S_T1" bpmnElement="T1">
        <dc:Bounds x="100" y="20" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="S_T2" bpmnElement="T2">
        <dc:Bounds x="100" y="150" width="100" height="60" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;

describe('what came off which element', () => {
  /** Two lanes of one pool, each carrying the SAME foreign attribute. */
  const OWNED = LANED({ front: [], back: [] })
    .replace(
      'xmlns:di="http://www.omg.org/spec/DD/20100524/DI"',
      'xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:camunda="http://camunda.org/schema/1.0/bpmn"'
    )
    .replace(
      '<bpmn:lane id="L1" name="Front office">',
      '<bpmn:lane id="L1" name="Front office" camunda:owner="alice">'
    )
    .replace(
      '<bpmn:lane id="L2" name="Back office">',
      '<bpmn:lane id="L2" name="Back office" camunda:owner="bob">'
    );

  it('keeps two lanes’ identical foreign attributes apart, and counts both', () => {
    // The defect the first review of this importer found, pinned. SEVEN source
    // elements pour into a pool's payload — the participant, its process, the
    // laneSet, every lane, the shape that draws it, the collaboration and
    // `definitions` — so a map keyed by attribute name alone loses one of these
    // two owners into a PERSISTED value, and the report says two were kept.
    const { elements, report } = importBpmnXml(OWNED, {});
    const pool = elements.find(element => element.type === 'bpmnPool')!;
    const carried = (
      pool.interchange as Record<
        string,
        { attrs: Record<string, Record<string, string>> }
      >
    ).bpmn;

    expect(carried.attrs.L1['camunda:owner']).toBe('alice');
    expect(carried.attrs.L2['camunda:owner']).toBe('bob');
    // Two attributes and the `xmlns:camunda` that makes them legible: three,
    // and the count is the truth rather than a claim about it.
    expect(report.carried).toBe(3);
  });

  it('scopes by the element a fragment came off, so a writer knows where it goes', () => {
    const { elements } = importBpmnXml(OWNED, {});
    const pool = elements.find(element => element.type === 'bpmnPool')!;
    const carried = (
      pool.interchange as Record<string, { attrs: Record<string, unknown> }>
    ).bpmn;

    // A source id for a lane, an `@` role key for the parts of the document
    // that have no id worth naming. `@` is not an XML NameStartChar, so the two
    // vocabularies cannot collide however a file names its elements.
    expect(Object.keys(carried.attrs).sort()).toEqual([
      '@definitions',
      'L1',
      'L2',
    ]);
  });
});

describe('lanes', () => {
  it('derives each band’s weight from the height it was drawn at', () => {
    const { elements } = importBpmnXml(
      LANED({ front: ['T1'], back: ['T2'] }),
      {}
    );
    const pool = elements.find(element => element.type === 'bpmnPool')!;
    const lanes = pool.lanes as { id: string; name: string; size: number }[];
    // One third and two thirds, expressed as the heights themselves: the pool
    // shares its plot in proportion, so the ratio is what survives a resize.
    expect(lanes.map(lane => [lane.id, lane.name, lane.size])).toEqual([
      ['L1', 'Front office', 100],
      ['L2', 'Back office', 200],
    ]);
  });

  it('says nothing when the file’s lane membership agrees with the drawing', () => {
    const { report } = importBpmnXml(
      LANED({ front: ['T1'], back: ['T2'] }),
      {}
    );
    expect(report.notes.filter(note => note.kind === 'warning')).toEqual([]);
  });

  it('reads the DRAWING when `flowNodeRef` disagrees with it, and says so', () => {
    // Labre stores no lane membership: `bpmnLaneOf` derives it from the centre
    // of the artefact, and the audit, the rules and the exporter all read that
    // one function. Storing the file's opinion would be a second source of
    // truth the first drag contradicts — so the DI wins and the disagreement
    // goes in the report (D3).
    const { report } = importBpmnXml(
      LANED({ front: ['T1', 'T2'], back: [] }),
      {}
    );
    const note = report.notes.find(entry => entry.element === 'flowNodeRef');
    expect(note?.kind).toBe('warning');
    expect(note?.sourceId).toBe('T2');
    expect(note?.message).toContain('Front office');
    expect(note?.message).toContain('Back office');
  });

  it('splits equally when only SOME bands were drawn, and says it did', () => {
    // A drawn height and the fallback weight are not the same kind of number: a
    // band of 200 beside a band of 1 paints a hairline nobody drew. D4 gives a
    // shape with no diagram a deterministic position AND a note; a lane gets
    // the same treatment rather than a silent 0.5%.
    const half = LANED({ front: [], back: [] }).replace(
      /<bpmndi:BPMNShape id="S_L2"[\s\S]*?<\/bpmndi:BPMNShape>/,
      ''
    );
    const { elements, report } = importBpmnXml(half, {});
    const pool = elements.find(element => element.type === 'bpmnPool')!;
    expect((pool.lanes as { size: number }[]).map(lane => lane.size)).toEqual([
      1, 1,
    ]);
    const note = report.notes.find(
      entry => entry.kind === 'invented-layout' && entry.element === 'laneSet'
    );
    expect(note?.message).toContain('equal bands');
  });

  it('says so when the bands it was given do not tile the pool', () => {
    // Labre lays its bands end to end, so a file that drew a gap between two
    // lanes comes back with the gap closed. Defensible — `lanes` is a weight
    // list — and the picture changes, so it is said once.
    const gapped = LANED({ front: [], back: [] }).replace(
      '<dc:Bounds x="30" y="100" width="570" height="200" />',
      '<dc:Bounds x="30" y="180" width="570" height="120" />'
    );
    const { report } = importBpmnXml(gapped, {});
    expect(
      report.notes.some(
        note =>
          note.kind === 'invented-layout' &&
          /gap or an overlap/.test(note.message)
      )
    ).toBe(true);
  });

  it('flattens a nested lane set onto its leaves, and quarantines the nesting', () => {
    const nested = LANED({ front: [], back: [] }).replace(
      '<bpmn:lane id="L2" name="Back office">',
      `<bpmn:lane id="L2" name="Back office"><bpmn:childLaneSet id="CLS">` +
        `<bpmn:lane id="L2a" name="Picking" /></bpmn:childLaneSet>`
    );
    const { elements, report } = importBpmnXml(nested, {});
    const pool = elements.find(element => element.type === 'bpmnPool')!;
    const lanes = pool.lanes as { id: string; name: string }[];
    // The LEAF, named by its whole path: a pool's bands are one flat list, and
    // "Picking" alone would lose which office it is in.
    expect(lanes.map(lane => lane.name)).toEqual([
      'Front office',
      'Back office / Picking',
    ]);
    const held = (
      pool.interchange as Record<
        string,
        { quarantined?: { fragment: string }[] }
      >
    ).bpmn.quarantined!;
    expect(held[0].fragment).toContain('<bpmn:childLaneSet id="CLS">');
    expect(
      report.notes.some(
        note => note.kind === 'quarantined' && note.element === 'childLaneSet'
      )
    ).toBe(true);
  });
});

/* ── The degenerate files ─────────────────────────────────────────────── */

const wrap = (body: string, di = '') => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
    xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="D" targetNamespace="urn:t">
  ${body}
  <bpmndi:BPMNDiagram id="Dia"><bpmndi:BPMNPlane id="Pl" bpmnElement="Proc">${di}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

describe('the files an importer meets on its first afternoon', () => {
  it('reads an empty `definitions` as an empty board, not as an error', () => {
    const { elements, report } = importBpmnXml(wrap(''), {});
    expect(elements).toEqual([]);
    expect([report.mapped, report.carried, report.quarantined]).toEqual([
      0, 0, 0,
    ]);
  });

  it('mints a pool for a file that names no participant, and says it did', () => {
    // D6: a bare `process` is what a poolless Labre board exports as, and the
    // pool is the only thing there is for the document's residue to ride on.
    // It says on itself that it stands for a process, which is what tells the
    // exporter to write the poolless form back.
    const { elements, report } = importBpmnXml(
      wrap(
        `<bpmn:process id="Proc" name="Solo"><bpmn:task id="T" name="Do it" /></bpmn:process>`,
        `<bpmndi:BPMNShape id="S" bpmnElement="T"><dc:Bounds x="100" y="100" width="100" height="80" /></bpmndi:BPMNShape>`
      ),
      {}
    );
    const pool = elements.find(element => element.type === 'bpmnPool')!;
    const carried = (
      pool.interchange as Record<string, { id?: string; element?: string }>
    ).bpmn;
    expect(carried.element).toBe('process');
    expect(carried.id).toBe('Proc');
    // Big enough to hold the work: an artefact drawn outside every pool would
    // be exported into a participant-less process of its own.
    expect(pool.xywh).toBe('[32,60,208,160]');
    expect(
      report.notes.some(
        note => note.kind === 'invented-layout' && note.element === 'process'
      )
    ).toBe(true);

    // …and it comes back out as the poolless form it arrived as.
    const written = exportBpmnXml(boardFromProps(elements), { name: 'Solo' });
    expect(written).not.toContain('<bpmn:collaboration');
    expect(written).toContain('<bpmn:process id="Proc"');
    expect(written.match(/<bpmn:process /g)).toHaveLength(1);
  });

  it('places what the diagram did not, off to the side, and names each one', () => {
    const { elements, report } = importBpmnXml(
      wrap(
        `<bpmn:collaboration id="C"><bpmn:participant id="P" name="A" processRef="Proc" /></bpmn:collaboration>` +
          `<bpmn:process id="Proc"><bpmn:task id="T1" /><bpmn:task id="T2" /></bpmn:process>`
      ),
      {}
    );
    const nodes = elements.filter(element => element.type === 'bpmnNode');
    expect(nodes).toHaveLength(2);
    // Deterministic and disjoint: the same file always lands the same board.
    expect(nodes[0].xywh).not.toBe(nodes[1].xywh);
    const invented = report.notes.filter(
      note => note.kind === 'invented-layout'
    );
    expect(invented.map(note => note.sourceId)).toEqual(['P', 'T1', 'T2']);
  });

  it('leaves out a flow with only one end, and says which', () => {
    const { elements, report } = importBpmnXml(
      wrap(
        `<bpmn:process id="Proc"><bpmn:task id="T1" />` +
          `<bpmn:sequenceFlow id="F" sourceRef="T1" /></bpmn:process>`
      ),
      {}
    );
    expect(elements.filter(element => element.type === 'connector')).toEqual(
      []
    );
    const note = report.notes.find(entry => entry.sourceId === 'F');
    expect(note?.kind).toBe('warning');
  });

  it('imports both halves of a duplicated id, and names the second', () => {
    // `xsd:ID` is document-unique and a hand-merged file breaks it anyway.
    // Both are imported — dropping one would be the silent loss this ADR is
    // about — and the note says that the second cannot keep its name.
    const { elements, report } = importBpmnXml(
      wrap(
        `<bpmn:process id="Proc"><bpmn:task id="T" name="One" />` +
          `<bpmn:task id="T" name="Two" /></bpmn:process>`
      ),
      {}
    );
    expect(
      elements.filter(element => element.type === 'bpmnNode').map(n => n.text)
    ).toEqual(['One', 'Two']);
    const note = report.notes.find(entry => entry.kind === 'substituted-id');
    expect(note?.sourceId).toBe('T');

    // And the file that comes back out still has two distinct ids on it.
    const written = exportBpmnXml(boardFromProps(elements));
    const ids = [...written.matchAll(/<bpmn:task id="([^"]+)"/g)].map(
      m => m[1]
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('reads a trigger named by REFERENCE, and never as a plain event', () => {
    // §10.5.2 Table 10.82: a catch event may name its trigger by reference to a
    // root-level definition, and the spec is explicit that an event with NO
    // definition is a None event. Reading the by-reference form as a plain
    // start event would put a claim on the canvas the file did not make.
    const { elements } = importBpmnXml(
      wrap(
        `<bpmn:message id="Msg_1" name="Order" />` +
          `<bpmn:messageEventDefinition id="MsgDef_1" messageRef="Msg_1" />` +
          `<bpmn:process id="Proc"><bpmn:startEvent id="S" name="In">` +
          `<bpmn:eventDefinitionRef>MsgDef_1</bpmn:eventDefinitionRef>` +
          `</bpmn:startEvent></bpmn:process>`
      ),
      {}
    );
    const node = elements.find(element => element.type === 'bpmnNode')!;
    expect(node.kind).toBe('startEventMessage');
    expect(node.role).toBe(BPMN_ROLE.startEventMessage);
  });

  it('keeps an event whole when the trigger it references is not one it draws', () => {
    const { elements, report } = importBpmnXml(
      wrap(
        `<bpmn:signalEventDefinition id="SigDef_1" />` +
          `<bpmn:process id="Proc"><bpmn:startEvent id="S">` +
          `<bpmn:eventDefinitionRef>SigDef_1</bpmn:eventDefinitionRef>` +
          `</bpmn:startEvent></bpmn:process>`
      ),
      {}
    );
    // Not drawn as a None start event: carried, like every other trigger the
    // descriptive profile does not have a glyph for.
    expect(elements.filter(element => element.type === 'bpmnNode')).toEqual([]);
    const note = report.notes.find(entry => entry.sourceId === 'S');
    expect(note?.kind).toBe('warning');
    expect(note?.message).toContain('SigDef_1');
  });

  it('keeps a shape that draws something the file does not declare', () => {
    const { report, elements } = importBpmnXml(
      wrap(
        `<bpmn:process id="Proc"><bpmn:task id="T" /></bpmn:process>`,
        `<bpmndi:BPMNShape id="S_T" bpmnElement="T"><dc:Bounds x="0" y="0" width="100" height="80" /></bpmndi:BPMNShape>` +
          `<bpmndi:BPMNShape id="S_ghost" bpmnElement="Nothing_1"><dc:Bounds x="300" y="0" width="100" height="80" /></bpmndi:BPMNShape>`
      ),
      {}
    );
    // Broken in the source — nothing can resolve it — and still a node of the
    // file, so it is kept under the id it names and named in the report. D1 has
    // no state for "quietly forgotten".
    expect(
      elements.filter(element => element.type === 'bpmnNode')
    ).toHaveLength(1);
    const note = report.notes.find(entry => entry.sourceId === 'Nothing_1');
    expect(note?.kind).toBe('warning');
    const pool = elements.find(element => element.type === 'bpmnPool')!;
    expect(
      (pool.interchange as Record<string, { di: Record<string, string[]> }>)
        .bpmn.di.Nothing_1[0]
    ).toContain('bpmnElement="Nothing_1"');
  });

  it('throws on a `<definitions>` that is not BPMN’s — a `.dmn`, say', () => {
    // DMN's root element is also `<definitions>`. Without the NAMESPACE check
    // a decision model imports as an empty board, which is the "three zeroes
    // claiming an empty process" this reader promises never to return.
    expect(() =>
      importBpmnXml(
        `<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="d" />`,
        {}
      )
    ).toThrow(/not\s+in BPMN 2\.0's/);
  });

  it('throws on a file that is not well-formed', () => {
    expect(() =>
      importBpmnXml('<definitions><oops></definitions>', {})
    ).toThrow(/well-formed/);
  });

  it('throws on a document that is not a BPMN `definitions`', () => {
    expect(() =>
      importBpmnXml('<svg xmlns="http://www.w3.org/2000/svg" />', {})
    ).toThrow(/opens on <definitions>/);
  });

  it('declines a choreography whole, by name', () => {
    // D1's one refusal: half a choreography is not a smaller choreography.
    expect(() =>
      importBpmnXml(wrap('<bpmn:choreography id="Ch" />'), {})
    ).toThrow(/choreography/);
  });

  it('says out loud that a `mustUnderstand` extension was not understood', () => {
    const { report } = importBpmnXml(
      wrap(
        `<bpmn:extension definition="urn:x" mustUnderstand="true" />` +
          `<bpmn:process id="Proc"><bpmn:task id="T" /></bpmn:process>`
      ),
      {}
    );
    const note = report.notes.find(entry => entry.element === 'extension');
    expect(note?.kind).toBe('warning');
    expect(note?.message).toMatch(/may be wrong/);
  });
});
