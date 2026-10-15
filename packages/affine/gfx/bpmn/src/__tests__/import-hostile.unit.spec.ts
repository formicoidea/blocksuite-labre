import { InterchangeImportError } from '@labre/affine-block-surface/interchange';
import { describe, expect, it } from 'vitest';

import { BPMN_IMPORT_ERRORS, importBpmnXml } from '../import';

/**
 * GUARD — the BPMN reader against a hostile file, with no DOM behind it (ADR
 * 0012, P3 as amended 2026-10-14).
 *
 * The reader used to parse with `DOMParser`, so what a DTD could do depended
 * on whichever DOM the caller had installed: happy-dom refused it as malformed,
 * jsdom refused the external entity and left the internal ones unamplified.
 * Since it reads with the surface's `readXml`, the answer is the library's own
 * and the same everywhere: a `DOCTYPE` is skipped, NO entity it declares is
 * expanded, nothing is fetched, and a `&name;` stays those characters.
 *
 * The first three files are the P0 import spike's
 * (`labre/docs/spikes/import-edge/fixtures/`), verbatim. Would have caught: a
 * reader that starts expanding declared entities (the billion laughs is 10^9
 * characters), resolving an external one (`file:///etc/passwd`), or recursing
 * on the depth of a file (a stack overflow is an uncaught `RangeError`, not a
 * refusal a server can answer with a key).
 */

const BILLION_LAUGHS = `<?xml version="1.0"?>
<!DOCTYPE definitions [
  <!ENTITY a0 "lol">
  <!ENTITY a1 "&a0;&a0;&a0;&a0;&a0;&a0;&a0;&a0;&a0;&a0;">
  <!ENTITY a2 "&a1;&a1;&a1;&a1;&a1;&a1;&a1;&a1;&a1;&a1;">
  <!ENTITY a3 "&a2;&a2;&a2;&a2;&a2;&a2;&a2;&a2;&a2;&a2;">
  <!ENTITY a4 "&a3;&a3;&a3;&a3;&a3;&a3;&a3;&a3;&a3;&a3;">
  <!ENTITY a5 "&a4;&a4;&a4;&a4;&a4;&a4;&a4;&a4;&a4;&a4;">
  <!ENTITY a6 "&a5;&a5;&a5;&a5;&a5;&a5;&a5;&a5;&a5;&a5;">
  <!ENTITY a7 "&a6;&a6;&a6;&a6;&a6;&a6;&a6;&a6;&a6;&a6;">
  <!ENTITY a8 "&a7;&a7;&a7;&a7;&a7;&a7;&a7;&a7;&a7;&a7;">
  <!ENTITY a9 "&a8;&a8;&a8;&a8;&a8;&a8;&a8;&a8;&a8;&a8;">
]>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D"><process id="P"><task id="T" name="&a9;" /></process></definitions>
`;

const XXE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE definitions [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D">
  <process id="P"><task id="T" name="&xxe;" /></process>
</definitions>
`;

const ORDER = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Defs_Order" targetNamespace="https://example.org/bpmn">
  <process id="P_Order" isExecutable="false">
    <startEvent id="S" name="Order received" />
    <task id="T1" name="Check stock" />
    <exclusiveGateway id="G" name="In stock?" />
    <task id="T2" name="Ship" />
    <endEvent id="E" name="Done" />
    <sequenceFlow id="F1" sourceRef="S" targetRef="T1" />
    <sequenceFlow id="F2" sourceRef="T1" targetRef="G" />
    <sequenceFlow id="F3" sourceRef="G" targetRef="T2" name="yes" />
    <sequenceFlow id="F4" sourceRef="T2" targetRef="E" />
  </process>
  <bpmndi:BPMNDiagram id="Di">
    <bpmndi:BPMNPlane id="Pl" bpmnElement="P_Order">
      <bpmndi:BPMNShape id="S_di" bpmnElement="S"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="T1_di" bpmnElement="T1"><dc:Bounds x="190" y="78" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="G_di" bpmnElement="G"><dc:Bounds x="345" y="93" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="T2_di" bpmnElement="T2"><dc:Bounds x="450" y="78" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="E_di" bpmnElement="E"><dc:Bounds x="610" y="100" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>
`;

const namesOf = (elements: readonly Record<string, unknown>[]) =>
  elements.map(element => element.text).filter(text => text);

describe('a hostile .bpmn, read with no DOM', () => {
  it('reads the spike’s ordinary file whole', () => {
    const { elements, report } = importBpmnXml(ORDER);
    expect(namesOf(elements)).toEqual(
      expect.arrayContaining([
        'Order received',
        'Check stock',
        'In stock?',
        'Ship',
        'Done',
      ])
    );
    expect(report.mapped).toBeGreaterThanOrEqual(9);
  });

  it('expands no entity of a billion laughs', () => {
    const started = performance.now();
    const { elements } = importBpmnXml(BILLION_LAUGHS);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(namesOf(elements)).toEqual(['&a9;']);
    expect(JSON.stringify(elements)).not.toContain('lol');
  });

  it('resolves no external entity', () => {
    const { elements } = importBpmnXml(XXE);
    expect(namesOf(elements)).toEqual(['&xxe;']);
    expect(JSON.stringify(elements)).not.toMatch(/root:|passwd/);
  });

  it('refuses a malformed file with the static key, a DOCTYPE or not', () => {
    for (const source of [
      '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"><process>',
      `<!DOCTYPE x [<!ENTITY a "b">]><definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"><process id="P"></definitions>`,
    ]) {
      let thrown: unknown;
      try {
        importBpmnXml(source);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(InterchangeImportError);
      expect((thrown as InterchangeImportError).messageKey).toBe(
        BPMN_IMPORT_ERRORS.malformedXml[0]
      );
    }
  });

  it('reads a vendor extension nested 20 000 deep without recursing', () => {
    const depth = 20_000;
    const source = `<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:x="urn:x" id="D"><process id="P"><task id="T" name="Deep"><extensionElements>${'<x:n>'.repeat(depth)}${'</x:n>'.repeat(depth)}</extensionElements></task></process></definitions>`;
    const { elements } = importBpmnXml(source);
    expect(namesOf(elements)).toEqual(['Deep']);
    // The extension is carried verbatim, all of it.
    expect(JSON.stringify(elements).split('<x:n').length - 1).toBe(depth);
  });
});
