import {
  SHAPE_TEXT_PADDING,
  SHAPE_TEXT_VERTICAL_PADDING,
  TextFitMode,
} from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { INNER_FONT_SIZE, LABEL_MIN_FONT_SIZE, NODE_SIZE } from '../consts';
import { importBpmnXml } from '../import';
import { bpmnLabelFit, bpmnNodeProps } from '../presets';

/**
 * Labels that fit the box the FILE gave them (#184).
 *
 * The defect this pins is the one visible to the naked eye on the first import
 * of a real `.bpmn`: a task label broken in the middle of a word ("Étudie / r
 * le dossie / r") and an event name sprawling far outside its circle. Neither
 * is reachable from the palette, because the palette draws at
 * {@link NODE_SIZE} and the pack's type is calibrated against exactly that; a
 * file draws to its own author's scale — bpmn.io's normative 100×80 task and
 * 36-unit event — and the shape's native 20-unit horizontal inset leaves 60
 * units of line in the first and NEGATIVE room in the second.
 *
 * Everything here is arithmetic on props: no canvas, no renderer, no measuring.
 * What the fit owes is that it stops asking for type the box was never going to
 * hold; the last unit of fitting is `TextFitMode.Contained`, which the renderer
 * finishes at paint time with the real font metrics.
 */

/** bpmn.io's normative sizes — what nearly every `.bpmn` in the wild carries. */
const FOREIGN_TASK = { w: 100, h: 80 };
const FOREIGN_EVENT = { w: 36, h: 36 };

/** The line box a label actually gets: the extent, minus its margin per side. */
const lineBox = (props: Record<string, unknown>, w: number, h: number) => {
  const [vertical, horizontal] = (props.padding as
    | [number, number]
    | undefined) ?? [SHAPE_TEXT_VERTICAL_PADDING, SHAPE_TEXT_PADDING];
  return { w: w - horizontal * 2, h: h - vertical * 2 };
};

describe('bpmnLabelFit — the typography a foreign box asks for', () => {
  it('changes nothing at the pack’s own size', () => {
    // The importer and the palette must land the same element for the same box,
    // which is the whole doctrine of `presets.ts`: a file that happens to draw
    // a task at 120×72 gets the drawn task's type, inset and all.
    const fit = bpmnLabelFit('task', NODE_SIZE.task.w, NODE_SIZE.task.h);

    expect(fit.fontSize).toBe(INNER_FONT_SIZE);
    expect(fit.padding).toEqual([
      SHAPE_TEXT_VERTICAL_PADDING,
      SHAPE_TEXT_PADDING,
    ]);
  });

  it('shrinks the type and the margin with the box, and keeps a usable line', () => {
    const task = bpmnLabelFit('task', FOREIGN_TASK.w, FOREIGN_TASK.h);
    const event = bpmnLabelFit('startEvent', FOREIGN_EVENT.w, FOREIGN_EVENT.h);

    for (const [fit, box] of [
      [task, FOREIGN_TASK],
      [event, FOREIGN_EVENT],
    ] as const) {
      expect(fit.fontSize).toBeLessThan(INNER_FONT_SIZE);
      expect(fit.fontSize).toBeGreaterThanOrEqual(LABEL_MIN_FONT_SIZE);
      // THE regression: the shape's native inset is 20 units per side, so a
      // 36-unit event used to be handed a line box of -4 units and broke its
      // label one character at a time.
      expect(box.w - fit.padding[1] * 2).toBeGreaterThan(0);
      expect(box.h - fit.padding[0] * 2).toBeGreaterThan(0);
    }

    // A smaller symbol never asks for bigger type than a larger one.
    expect(event.fontSize).toBeLessThanOrEqual(task.fontSize);
  });

  it('never inflates the type for a file drawn bigger than the pack', () => {
    const fit = bpmnLabelFit(
      'task',
      NODE_SIZE.task.w * 2,
      NODE_SIZE.task.h * 2
    );

    expect(fit.fontSize).toBe(INNER_FONT_SIZE);
    expect(fit.padding).toEqual([
      SHAPE_TEXT_VERTICAL_PADDING,
      SHAPE_TEXT_PADDING,
    ]);
  });

  it('answers a degenerate box with the pack’s own type, not NaN', () => {
    // A `dc:Bounds` of zeros — or of `NaN`, which is what a non-numeric
    // attribute parses to — is junk, and junk reaches an importer on its first
    // afternoon in the wild. Every value written into a document has to be a
    // number the store can hold, and the honest answer for a box that says
    // nothing is the drawn artefact's own type rather than a shrunken guess at
    // a size nobody gave.
    for (const box of [
      [0, 0],
      [Number.NaN, Number.NaN],
      [-100, -80],
    ] as const) {
      const fit = bpmnLabelFit('task', box[0], box[1]);

      expect(fit.fontSize).toBe(INNER_FONT_SIZE);
      expect(fit.fontSize).toBeGreaterThanOrEqual(LABEL_MIN_FONT_SIZE);
      expect(fit.padding).toEqual([
        SHAPE_TEXT_VERTICAL_PADDING,
        SHAPE_TEXT_PADDING,
      ]);
      expect(fit.textFitMode).toBe(TextFitMode.Contained);
    }
  });
});

describe('bpmnNodeProps — the fit is asked for, never guessed', () => {
  const DRAWN = `[0,0,${NODE_SIZE.task.w},${NODE_SIZE.task.h}]`;
  const FOREIGN = `[0,0,${FOREIGN_TASK.w},${FOREIGN_TASK.h}]`;

  it('leaves a node drawn from the palette exactly as it was', () => {
    const props = bpmnNodeProps('task', { xywh: DRAWN, text: 'Task' });

    expect(props.fontSize).toBe(INNER_FONT_SIZE);
    expect(props.textFitMode).toBe(TextFitMode.Overflow);
    // Not a defaulted key: a drawn artefact puts no inset of its own in the
    // Y.Map and keeps the shape's.
    expect(Object.keys(props)).not.toContain('padding');
  });

  it('writes no fit for a foreign box with no label to put in it', () => {
    // An unnamed event is the commonest artefact in any file. Nothing to fit,
    // and the element stays byte-comparable with a drawn one.
    const props = bpmnNodeProps('startEvent', {
      xywh: `[0,0,${FOREIGN_EVENT.w},${FOREIGN_EVENT.h}]`,
      fitLabel: true,
    });

    expect(props.fontSize).toBe(INNER_FONT_SIZE);
    expect(props.textFitMode).toBe(TextFitMode.Overflow);
    expect(Object.keys(props)).not.toContain('padding');
  });

  it('fits a labelled foreign box, and leaves its geometry alone', () => {
    const props = bpmnNodeProps('task', {
      xywh: FOREIGN,
      text: 'Étudier le dossier',
      fitLabel: true,
    });

    expect(props.textFitMode).toBe(TextFitMode.Contained);
    expect(props.fontSize).toBeLessThan(INNER_FONT_SIZE);
    // The fit is typographic and nothing else: the box is the file's, and a
    // reader that resized it would re-export somebody else's diagram redrawn.
    expect(props.xywh).toBe(FOREIGN);
    expect(props.text).toBe('Étudier le dossier');
  });
});

/* ── The file from the report ─────────────────────────────────────────── */

/**
 * The recette's own case: a pool, a start event, a task and an end event, at
 * bpmn.io's normative sizes and with the accented French labels that made the
 * defect visible.
 */
const MINIMAL = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
    xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
    id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <collaboration id="Collaboration_1">
    <participant id="Participant_1" name="Assureur" processRef="Process_1" />
  </collaboration>
  <process id="Process_1" isExecutable="false">
    <startEvent id="Start_1" name="Demande reçue" />
    <task id="Task_1" name="Étudier le dossier" />
    <endEvent id="End_1" name="Contrat émis" />
    <sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1" />
  </process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="S_p" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="600" height="250" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="S_start" bpmnElement="Start_1">
        <dc:Bounds x="212" y="152" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="S_task" bpmnElement="Task_1">
        <dc:Bounds x="300" y="130" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="S_end" bpmnElement="End_1">
        <dc:Bounds x="460" y="152" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="E_1" bpmnElement="Flow_1">
        <di:waypoint x="248" y="170" />
        <di:waypoint x="300" y="170" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="E_2" bpmnElement="Flow_2">
        <di:waypoint x="400" y="170" />
        <di:waypoint x="460" y="170" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>
`;

describe('a minimal file, imported', () => {
  const { elements } = importBpmnXml(MINIMAL, {});
  const nodes = elements.filter(
    element => element.type === 'bpmnNode'
  ) as Array<Record<string, unknown>>;
  const boxOf = (node: Record<string, unknown>) => {
    const [, , w, h] = JSON.parse(String(node.xywh)) as number[];
    return { w, h };
  };

  it('reads the three artefacts with their accented names', () => {
    expect(nodes.map(node => node.text)).toEqual([
      'Demande reçue',
      'Étudier le dossier',
      'Contrat émis',
    ]);
  });

  it('gives every label a line box inside the shape that carries it', () => {
    for (const node of nodes) {
      const box = boxOf(node);
      const line = lineBox(node, box.w, box.h);

      expect(node.textFitMode, String(node.text)).toBe(TextFitMode.Contained);
      expect(line.w, String(node.text)).toBeGreaterThan(0);
      expect(line.h, String(node.text)).toBeGreaterThan(0);
      // …and a line box the label is actually inside: at the fitted size, the
      // shape renderer's `Contained` pass has room to shrink into.
      expect(line.w, String(node.text)).toBeGreaterThanOrEqual(
        Number(node.fontSize)
      );
    }
  });

  it('asks for type that shrinks with the symbol, never under the floor', () => {
    const [start, task, end] = nodes.map(node => Number(node.fontSize));

    expect(task).toBeLessThan(INNER_FONT_SIZE);
    expect(start).toBeLessThanOrEqual(task);
    expect(start).toBe(end);
    for (const size of [start, task, end]) {
      expect(size).toBeGreaterThanOrEqual(LABEL_MIN_FONT_SIZE);
    }
  });

  it('keeps the geometry the file drew, to the unit', () => {
    // The fit is visual and the reader's contract is not: every box below is
    // the file's own, so a re-export writes the author's diagram back rather
    // than a redrawn one.
    expect(nodes.map(node => node.xywh)).toEqual([
      '[212,152,36,36]',
      '[300,130,100,80]',
      '[460,152,36,36]',
    ]);
  });
});
