import { describe, expect, it } from 'vitest';

import {
  BPMN_CENTRE_ANCHORED,
  BpmnNodeElementModel,
  type BpmnNodeKind,
} from '../index.js';

/**
 * Why this spec exists: every BPMN node answered `centerAnchorOnly === true`,
 * which switched off the native connector anchors, so a sequence flow could
 * only aim at the middle of a node — the user could not pick which corner of a
 * gateway or which side of a task a flow leaves by. The rule is now per kind
 * (`BPMN_CENTRE_ANCHORED`): flow objects, data shapes and annotations keep the
 * anchors of their outline, a group (which no flow attaches to, BPMN 2.0.2
 * §10.4) stays centre-only, and a kind this build does not know keeps the old
 * answer.
 *
 * A getter, not a stored prop: nothing here is written to a document. Built
 * detached, the way the UML model spec builds its nodes.
 */
function detached(kind: string): BpmnNodeElementModel {
  const element = Object.create(BpmnNodeElementModel.prototype) as Record<
    string,
    unknown
  >;
  element.yMap = { doc: null };
  element._preserved = new Map<string, unknown>([['kind', kind]]);
  element._local = new Map<string, unknown>();
  return element as unknown as BpmnNodeElementModel;
}

const ANCHORED_BY_OUTLINE: BpmnNodeKind[] = [
  'startEvent',
  'startEventMessage',
  'startEventTimer',
  'endEvent',
  'endEventMessage',
  'endEventTerminate',
  'task',
  'taskUser',
  'taskService',
  'subProcess',
  'callActivity',
  'gatewayExclusive',
  'gatewayParallel',
  'dataObject',
  'dataStore',
  'textAnnotation',
];

describe('where a connector may attach to a BPMN node', () => {
  it.each(ANCHORED_BY_OUTLINE)('offers the outline anchors of %s', kind => {
    expect(detached(kind).centerAnchorOnly).toBe(false);
  });

  it('keeps a group centre-only — no flow attaches to a group', () => {
    expect(detached('group').centerAnchorOnly).toBe(true);
  });

  it('answers what it always answered for a kind it does not know', () => {
    expect(detached('choreographyTask').centerAnchorOnly).toBe(true);
  });

  it('decides every kind, and only those', () => {
    expect(Object.keys(BPMN_CENTRE_ANCHORED).sort()).toEqual(
      [...ANCHORED_BY_OUTLINE, 'group'].sort()
    );
  });
});
