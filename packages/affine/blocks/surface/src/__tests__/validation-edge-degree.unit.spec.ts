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
  // A branching artefact, and one specialisation of it: the subject of the
  // disjunctive bound.
  'test:gateway': {
    id: 'test:gateway',
    kind: 'node',
    labelKey: 'test.gateway',
  },
  'test:exclusive-gateway': {
    id: 'test:exclusive-gateway',
    parent: 'test:gateway',
    kind: 'node',
    labelKey: 'test.exclusive-gateway',
  },
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

/**
 * `eitherMin`: the bound that asks for one thing OR the other.
 *
 * The four per-direction bounds are conjunctive — declare two and the subject
 * must satisfy both — and a whole class of normative shape says the opposite. A
 * branching artefact must either split or merge; doing either is enough, and
 * doing neither is a node somebody drew and never gave a job to. `minIn: 2`
 * would indict every split and `minOut: 2` every merge, so no conjunction of the
 * four expresses it.
 */
describe('a bound satisfied by either side', () => {
  /** "A gateway either splits or merges." */
  const BRANCHES: ValidationRule = {
    id: 'test.gateway-branches',
    framework: 'test',
    family: 'edge-degree',
    severity: 'warning',
    appliesTo: 'test:gateway',
    roles: ROLES,
    messageKey: 'com.labre.test.gateway-branches',
    version: 1,
    backgroundRole: 'test:frame',
    degree: {
      edgeRole: 'test:flow',
      eitherMin: 2,
      neither: { messageKey: 'com.labre.test.gateway-branches.neither' },
    },
  };

  /** A gateway wired with `into` flows arriving and `outOf` flows leaving. */
  const wired = (into: number, outOf: number) => {
    const board: GfxPrimitiveElementModel[] = [
      frame(),
      node('g', 'test:gateway'),
    ];
    for (let i = 0; i < into; i++) {
      board.push(node(`in-${i}`, 'test:task'), edge(`fi-${i}`, `in-${i}`, 'g'));
    }
    for (let i = 0; i < outOf; i++) {
      board.push(
        node(`out-${i}`, 'test:task'),
        edge(`fo-${i}`, 'g', `out-${i}`)
      );
    }
    return board;
  };

  it('indicts a gateway that neither splits nor merges', () => {
    // One in, one out: the artefact decides nothing.
    const found = run(BRANCHES, wired(1, 1));

    expect(found.map(violation => violation.elementIds)).toEqual([['g']]);
    expect(found[0].messageKey).toBe('com.labre.test.gateway-branches.neither');
  });

  it('says nothing about a gateway that MERGES', () => {
    expect(ids(BRANCHES, wired(2, 0))).toEqual([]);
  });

  it('says nothing about a gateway that SPLITS', () => {
    expect(ids(BRANCHES, wired(0, 2))).toEqual([]);
  });

  it('says nothing when one side alone clears the bound', () => {
    // Three in, one out is a merge with a continuation, and legal: the bound is
    // reached on a side, which is all it asks.
    expect(ids(BRANCHES, wired(3, 1))).toEqual([]);
  });

  it('indicts a gateway nothing is wired to at all', () => {
    expect(ids(BRANCHES, wired(0, 0))).toEqual(['g']);
  });

  it('falls back to the rule’s own words when it declares none', () => {
    const bare: ValidationRule = {
      ...BRANCHES,
      degree: { edgeRole: 'test:flow', eitherMin: 2 },
    };

    expect(run(bare, wired(1, 1))[0].messageKey).toBe(
      'com.labre.test.gateway-branches'
    );
  });

  it('covers a specialisation of the subject role', () => {
    const board = wired(1, 1).map(el =>
      el.id === 'g' ? node('g', 'test:exclusive-gateway') : el
    );

    expect(ids(BRANCHES, board)).toEqual(['g']);
  });

  it('is on its own enough to make the rule evaluable', () => {
    // The "no bound at all" warning must not fire for a rule whose only bound
    // is the disjunction.
    expect(ids(BRANCHES, wired(2, 2))).toEqual([]);
  });
});

describe('the disjunction beside the four conjunctive bounds', () => {
  /** A gateway that must branch, and may not take more than two in. */
  const CAPPED: ValidationRule = {
    id: 'test.gateway-capped',
    framework: 'test',
    family: 'edge-degree',
    severity: 'warning',
    appliesTo: 'test:gateway',
    roles: ROLES,
    messageKey: 'com.labre.test.gateway-capped',
    version: 1,
    backgroundRole: 'test:frame',
    degree: {
      edgeRole: 'test:flow',
      maxIn: 2,
      eitherMin: 2,
      tooManyIn: { messageKey: 'com.labre.test.gateway-capped.too-many-in' },
      neither: { messageKey: 'com.labre.test.gateway-capped.neither' },
    },
  };

  const wired = (into: number, outOf: number) => {
    const board: GfxPrimitiveElementModel[] = [
      frame(),
      node('g', 'test:gateway'),
    ];
    for (let i = 0; i < into; i++) {
      board.push(node(`in-${i}`, 'test:task'), edge(`fi-${i}`, `in-${i}`, 'g'));
    }
    for (let i = 0; i < outOf; i++) {
      board.push(
        node(`out-${i}`, 'test:task'),
        edge(`fo-${i}`, 'g', `out-${i}`)
      );
    }
    return board;
  };

  it('lets both bounds be satisfied at once', () => {
    expect(ids(CAPPED, wired(2, 1))).toEqual([]);
  });

  it('still enforces the per-direction cap on a gateway that branches', () => {
    // Three in clears the disjunction and breaks the cap: the conjunctive bound
    // is not switched off by the disjunctive one being met.
    const found = run(CAPPED, wired(3, 0));

    expect(found[0].messageKey).toBe(
      'com.labre.test.gateway-capped.too-many-in'
    );
  });

  it('reports ONE finding for a gateway that breaks the disjunction', () => {
    const found = run(CAPPED, wired(1, 1));

    expect(found).toHaveLength(1);
    expect(found[0].messageKey).toBe('com.labre.test.gateway-capped.neither');
  });

  it('prefers the per-direction sentence when both bounds fail', () => {
    // One in, nothing out: `minOut: 1` fails AND the disjunction fails. The
    // finding names the side the user has to act on — "nothing leaves here" is
    // actionable, "neither side has enough" is a puzzle — and there is exactly
    // one of it.
    const both: ValidationRule = {
      ...CAPPED,
      id: 'test.gateway-both',
      degree: {
        edgeRole: 'test:flow',
        minOut: 1,
        eitherMin: 2,
        tooFewOut: { messageKey: 'com.labre.test.gateway-both.too-few-out' },
        neither: { messageKey: 'com.labre.test.gateway-both.neither' },
      },
    };
    const found = run(both, wired(1, 0));

    expect(found).toHaveLength(1);
    expect(found[0].messageKey).toBe('com.labre.test.gateway-both.too-few-out');
  });
});
