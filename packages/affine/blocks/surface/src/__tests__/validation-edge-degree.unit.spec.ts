import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  evaluateRules,
  type ValidationRule,
} from '../extensions/validation.js';

/**
 * The `edge-degree` family: how many typed relations may arrive at, and leave,
 * one node.
 *
 * A node is the subject and a COUNT is the evidence, so nothing below depends on
 * where anything is drawn — every case is about the persisted `source → target`
 * pairs on the board. The two properties the suite is really about: an edge that
 * relates nothing counts for nothing, and a rule written on a parent role counts
 * every specialisation of it.
 */

const ROLES: RoleDefs = {
  'test:frame': { id: 'test:frame', kind: 'node', labelKey: 'test.frame' },
  'test:event': { id: 'test:event', kind: 'node', labelKey: 'test.event' },
  // A specialisation, so a rule written on the parent covers it for free.
  'test:start': {
    id: 'test:start',
    parent: 'test:event',
    kind: 'node',
    labelKey: 'test.start',
  },
  'test:task': { id: 'test:task', kind: 'node', labelKey: 'test.task' },
  'test:flow': { id: 'test:flow', kind: 'edge', labelKey: 'test.flow' },
  // An edge specialising the counted one — a conditional flow is still a flow.
  'test:conditional-flow': {
    id: 'test:conditional-flow',
    parent: 'test:flow',
    kind: 'edge',
    labelKey: 'test.conditional-flow',
  },
  // Another relation entirely: it must not be counted by a rule about flows.
  'test:message': {
    id: 'test:message',
    kind: 'edge',
    labelKey: 'test.message',
  },
};

/** "A start event begins the process": nothing arrives, exactly one leaves. */
const START_DEGREE: ValidationRule = {
  id: 'test.start-degree',
  framework: 'test',
  family: 'edge-degree',
  severity: 'warning',
  appliesTo: 'test:event',
  roles: ROLES,
  messageKey: 'com.labre.test.start-degree',
  version: 1,
  backgroundRole: 'test:frame',
  degree: {
    edgeRole: 'test:flow',
    maxIn: 0,
    minOut: 1,
    maxOut: 1,
    tooManyIn: { messageKey: 'com.labre.test.start-degree.too-many-in' },
    tooFewOut: { messageKey: 'com.labre.test.start-degree.too-few-out' },
    tooManyOut: { messageKey: 'com.labre.test.start-degree.too-many-out' },
  },
};

function element(
  id: string,
  xywh: [number, number, number, number],
  props: Record<string, unknown> = {}
): GfxPrimitiveElementModel {
  const stub = {
    id,
    type: 'test',
    ...props,
    get elementBound() {
      return new Bound(...xywh);
    },
  };
  return stub as unknown as GfxPrimitiveElementModel;
}

const frame = (id = 'frame') =>
  element(id, [0, 0, 1000, 1000], { role: 'test:frame' });

const node = (id: string, role: string) =>
  element(id, [50, 50, 20, 20], { role });

/**
 * An edge, as the engine reads one. `role` absent is a free connector, and an
 * end given as `null` is one the user released over empty canvas.
 */
const edge = (
  id: string,
  sourceId: string | null,
  targetId: string | null,
  role = 'test:flow'
) =>
  element(id, [0, 0, 100, 100], {
    role,
    source: sourceId === null ? { position: [10, 10] } : { id: sourceId },
    target: targetId === null ? { position: [90, 90] } : { id: targetId },
  });

const run = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  evaluateRules([rule], elements);

const ids = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  run(rule, elements).map(violation => violation.elementIds.join('+'));

describe('counting the relations that reach a node', () => {
  it('says nothing about a start event with one flow leaving it', () => {
    expect(
      ids(START_DEGREE, [
        frame(),
        node('start', 'test:start'),
        node('task', 'test:task'),
        edge('f1', 'start', 'task'),
      ])
    ).toEqual([]);
  });

  it('indicts a start event something points at', () => {
    const found = run(START_DEGREE, [
      frame(),
      node('start', 'test:start'),
      node('task', 'test:task'),
      edge('f1', 'start', 'task'),
      edge('f2', 'task', 'start'),
    ]);

    expect(found.map(violation => violation.elementIds)).toEqual([['start']]);
    expect(found[0].messageKey).toBe('com.labre.test.start-degree.too-many-in');
  });

  it('indicts a start event nothing leaves', () => {
    const found = run(START_DEGREE, [
      frame(),
      node('start', 'test:start'),
      node('task', 'test:task'),
    ]);

    expect(found.map(violation => violation.elementIds)).toEqual([['start']]);
    expect(found[0].messageKey).toBe('com.labre.test.start-degree.too-few-out');
  });

  it('indicts a start event two flows leave', () => {
    const found = run(START_DEGREE, [
      frame(),
      node('start', 'test:start'),
      node('a', 'test:task'),
      node('b', 'test:task'),
      edge('f1', 'start', 'a'),
      edge('f2', 'start', 'b'),
    ]);

    expect(found[0].messageKey).toBe(
      'com.labre.test.start-degree.too-many-out'
    );
  });

  it('names the offending node and nothing else', () => {
    // Not the edges that made the count wrong: the fix is on the node — or on
    // one of several links, and naming all of them would put a bracket on every
    // arrow of a fan-out.
    expect(
      ids(START_DEGREE, [
        frame(),
        node('start', 'test:start'),
        node('a', 'test:task'),
        node('b', 'test:task'),
        edge('f1', 'start', 'a'),
        edge('f2', 'start', 'b'),
      ])
    ).toEqual(['start']);
  });

  it('raises ONE finding for a node that breaks two bounds at once', () => {
    // Something arrives AND two things leave. One situation, one bracket.
    const found = run(START_DEGREE, [
      frame(),
      node('start', 'test:start'),
      node('a', 'test:task'),
      node('b', 'test:task'),
      edge('f0', 'a', 'start'),
      edge('f1', 'start', 'a'),
      edge('f2', 'start', 'b'),
    ]);

    expect(found).toHaveLength(1);
    // In, then out: the fixed order the family declares.
    expect(found[0].messageKey).toBe('com.labre.test.start-degree.too-many-in');
  });

  it('attributes the finding to the frame it was drawn on', () => {
    const found = run(START_DEGREE, [
      frame('pool'),
      node('start', 'test:start'),
    ]);

    expect(found[0].backgroundId).toBe('pool');
  });

  it('falls back to the rule’s own words for a bound with none', () => {
    const noWords: ValidationRule = {
      ...START_DEGREE,
      degree: { edgeRole: 'test:flow', minOut: 1 },
    };

    expect(
      run(noWords, [frame(), node('start', 'test:start')])[0].messageKey
    ).toBe('com.labre.test.start-degree');
  });
});

describe('what an edge-degree rule refuses to count', () => {
  it('does not count a flow with a free end', () => {
    // The user has grabbed a link and not dropped it: it relates nothing, so it
    // must not make a start event legal for the length of the gesture.
    expect(
      ids(START_DEGREE, [
        frame(),
        node('start', 'test:start'),
        edge('f1', 'start', null),
      ])
    ).toEqual(['start']);
  });

  it('counts the end that survives when the other one is gone', () => {
    // The empty result IS the count: `minOut: 1` is satisfied, so the edge was
    // read. A dangling id counts against nobody, but the node at THIS end really
    // does have a relation leaving it and no gesture on that node changes it —
    // the family counts the ends, never the survivors. Deliberately unlike the
    // three families whose subject is the RELATION, which drop such an edge
    // whole because half a sentence is not a sentence.
    expect(
      ids(START_DEGREE, [
        frame(),
        node('start', 'test:start'),
        edge('f1', 'start', 'deleted'),
      ])
    ).toEqual([]);
  });

  it('does not count a relation of another role', () => {
    expect(
      ids(START_DEGREE, [
        frame(),
        node('start', 'test:start'),
        node('task', 'test:task'),
        edge('f1', 'start', 'task'),
        edge('m1', 'task', 'start', 'test:message'),
      ])
    ).toEqual([]);
  });

  it('does not count a connector carrying no role at all', () => {
    const free = element('free', [0, 0, 10, 10], {
      source: { id: 'task' },
      target: { id: 'start' },
    });

    expect(
      ids(START_DEGREE, [
        frame(),
        node('start', 'test:start'),
        node('task', 'test:task'),
        edge('f1', 'start', 'task'),
        free,
      ])
    ).toEqual([]);
  });

  it('evaluates nothing, and warns, for a rule declaring no bound', () => {
    const empty: ValidationRule = {
      ...START_DEGREE,
      id: 'test.no-bound',
      degree: { edgeRole: 'test:flow' },
    };

    expect(ids(empty, [frame(), node('start', 'test:start')])).toEqual([]);
  });
});

describe('the vocabulary an edge-degree rule speaks', () => {
  it('covers a specialisation of the subject role', () => {
    // The rule is written on `test:event`; the element carries `test:start`.
    expect(ids(START_DEGREE, [frame(), node('start', 'test:start')])).toEqual([
      'start',
    ]);
  });

  it('counts a specialisation of the edge role', () => {
    // A conditional flow is a flow: it must satisfy `minOut` like any other.
    expect(
      ids(START_DEGREE, [
        frame(),
        node('start', 'test:start'),
        node('task', 'test:task'),
        edge('f1', 'start', 'task', 'test:conditional-flow'),
      ])
    ).toEqual([]);
  });

  it('counts a SELF-LOOP on both sides', () => {
    // The document says one edge leaves this node and one arrives at it, and so
    // does the count. Whether a loop is legal at all is another family's
    // question — a count that ignored loops would launder a node past `maxIn`.
    const found = run(START_DEGREE, [
      frame(),
      node('start', 'test:start'),
      edge('loop', 'start', 'start'),
    ]);

    expect(found[0].messageKey).toBe('com.labre.test.start-degree.too-many-in');
  });

  it('says nothing on a board carrying no subject at all', () => {
    expect(ids(START_DEGREE, [frame(), node('task', 'test:task')])).toEqual([]);
  });
});
