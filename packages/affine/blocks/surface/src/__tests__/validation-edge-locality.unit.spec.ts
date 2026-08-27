import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  evaluateRules,
  type ValidationRule,
} from '../extensions/validation.js';
import type { FrameworkBackgroundDef } from '../framework-background/index.js';

/**
 * The `edge-locality` family: a relation constrained relative to the frames its
 * two ends sit on.
 *
 * The canonical pair of a swimlane notation, and the reason the family exists at
 * all: in the legal case and the illegal one the two ends carry exactly the same
 * ROLES, so no grammar rule can tell them apart — only the attribution can. One
 * relation must stay inside a single frame, the other only exists between two.
 *
 * Every silence below is the same principle: an end the frames say nothing about
 * is a draft, and a tool that indicted a draft would be indicting the act of
 * sketching.
 */

const ROLES: RoleDefs = {
  'test:pool': { id: 'test:pool', kind: 'node', labelKey: 'test.pool' },
  'test:task': { id: 'test:task', kind: 'node', labelKey: 'test.task' },
  'test:flow': { id: 'test:flow', kind: 'edge', labelKey: 'test.flow' },
  'test:conditional-flow': {
    id: 'test:conditional-flow',
    parent: 'test:flow',
    kind: 'edge',
    labelKey: 'test.conditional-flow',
  },
  'test:message': {
    id: 'test:message',
    kind: 'edge',
    labelKey: 'test.message',
  },
};

/** A pool with a title band on the left, as in the `role-count` suite. */
const POOL: FrameworkBackgroundDef = {
  type: 'test',
  role: 'test:pool',
  geometry: {
    width: 1000,
    height: 400,
    lockAspectRatio: false,
    resizable: true,
    margin: { top: 0, right: 0, bottom: 0, left: 100 },
  },
};

/** "A sequence flow stays inside one pool." */
const SAME: ValidationRule = {
  id: 'test.flow-stays-in-pool',
  framework: 'test',
  family: 'edge-locality',
  severity: 'warning',
  roles: ROLES,
  messageKey: 'com.labre.test.flow-stays-in-pool',
  version: 1,
  backgroundRole: 'test:pool',
  background: POOL,
  locality: { edgeRole: 'test:flow', mode: 'same-background' },
};

/** "A message flow only exists between two pools." */
const CROSS: ValidationRule = {
  ...SAME,
  id: 'test.message-crosses-pools',
  messageKey: 'com.labre.test.message-crosses-pools',
  locality: { edgeRole: 'test:message', mode: 'cross-background' },
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

const pool = (id: string, at: [number, number] = [0, 0]) =>
  element(id, [at[0], at[1], 1000, 400], { role: 'test:pool' });

const task = (id: string, at: [number, number]) =>
  element(id, [at[0], at[1], 20, 20], { role: 'test:task' });

const edge = (
  id: string,
  sourceId: string | null,
  targetId: string | null,
  role = 'test:flow'
) =>
  element(id, [0, 0, 2000, 400], {
    role,
    source: sourceId === null ? { position: [10, 10] } : { id: sourceId },
    target: targetId === null ? { position: [90, 90] } : { id: targetId },
  });

/** Two pools side by side, and one task in each of their plots. */
const twoPools = () => [
  pool('north'),
  pool('south', [0, 1000]),
  task('n1', [200, 100]),
  task('n2', [400, 100]),
  task('s1', [200, 1100]),
];

const run = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  evaluateRules([rule], elements);

const ids = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  run(rule, elements).map(violation => violation.elementIds.join('+'));

describe('a relation that must stay inside one frame', () => {
  it('says nothing about a flow between two artefacts of one pool', () => {
    expect(ids(SAME, [...twoPools(), edge('f', 'n1', 'n2')])).toEqual([]);
  });

  it('indicts a flow that leaves the pool it started in', () => {
    expect(ids(SAME, [...twoPools(), edge('f', 'n1', 's1')])).toEqual([
      'f+n1+s1',
    ]);
  });

  it('names the relation AND its two ends', () => {
    // The finding has two honest resolutions — move the artefact into the pool
    // it belongs to, or re-point the link — and the second is only reachable
    // from the edge.
    const found = run(SAME, [...twoPools(), edge('f', 'n1', 's1')]);

    expect(found[0].elementIds).toEqual(['f', 'n1', 's1']);
  });

  it('attributes the finding to the SOURCE’s pool', () => {
    // The relation-endpoints precedent: a relation belongs where it starts.
    expect(
      run(SAME, [...twoPools(), edge('f', 's1', 'n1')])[0].backgroundId
    ).toBe('south');
  });

  it('follows a specialisation of the edge role', () => {
    expect(
      ids(SAME, [...twoPools(), edge('f', 'n1', 's1', 'test:conditional-flow')])
    ).toEqual(['f+n1+s1']);
  });

  it('ignores a relation of another role entirely', () => {
    expect(
      ids(SAME, [...twoPools(), edge('m', 'n1', 's1', 'test:message')])
    ).toEqual([]);
  });
});

describe('a relation that must cross between two frames', () => {
  it('says nothing about a message flow between two pools', () => {
    expect(
      ids(CROSS, [...twoPools(), edge('m', 'n1', 's1', 'test:message')])
    ).toEqual([]);
  });

  it('indicts a message flow drawn inside one pool', () => {
    expect(
      ids(CROSS, [...twoPools(), edge('m', 'n1', 'n2', 'test:message')])
    ).toEqual(['m+n1+n2']);
  });
});

describe('when an edge-locality rule stays silent', () => {
  it('says nothing on a board carrying no frame at all', () => {
    // A process sketched before anybody drew a pool is a sketch, and this is
    // the family that would otherwise light such a board up end to end.
    expect(
      ids(SAME, [
        task('a', [200, 100]),
        task('b', [200, 1100]),
        edge('f', 'a', 'b'),
      ])
    ).toEqual([]);
  });

  it('says nothing when ONE end sits inside no frame', () => {
    // A task dropped beside the pool is a draft. Under `same-background` an
    // answer here would read "that flow leaves the pool", which is a claim
    // about a frame the artefact was never in.
    expect(
      ids(SAME, [
        ...twoPools(),
        task('stray', [3000, 3000]),
        edge('f', 'n1', 'stray'),
      ])
    ).toEqual([]);
  });

  it('says nothing when one end sits on a pool’s title band', () => {
    // Inside the element box, outside the plot: the same containment-only
    // reading `role-count` uses, so the two families never disagree about
    // where an artefact is.
    expect(
      ids(SAME, [
        ...twoPools(),
        task('band', [20, 100]),
        edge('f', 'n1', 'band'),
      ])
    ).toEqual([]);
  });

  it('says nothing about an end that sits nowhere under cross-background', () => {
    expect(
      ids(CROSS, [
        ...twoPools(),
        task('stray', [3000, 3000]),
        edge('m', 'n1', 'stray', 'test:message'),
      ])
    ).toEqual([]);
  });

  it('says nothing about a flow with a free end', () => {
    expect(ids(SAME, [...twoPools(), edge('f', 'n1', null)])).toEqual([]);
  });

  it('says nothing about an end whose element is gone', () => {
    expect(ids(SAME, [...twoPools(), edge('f', 'n1', 'deleted')])).toEqual([]);
  });

  it('says nothing about a SELF-LOOP, under either mode', () => {
    // One element compared with itself is always in its own frame, so it states
    // nothing about locality either way. Whether a loop is legal at all is
    // `relation-endpoints`' question, asked with its own flag.
    expect(ids(SAME, [...twoPools(), edge('f', 'n1', 'n1')])).toEqual([]);
    expect(
      ids(CROSS, [...twoPools(), edge('m', 'n1', 'n1', 'test:message')])
    ).toEqual([]);
  });

  it('says nothing about a connector carrying no role', () => {
    const free = element('free', [0, 0, 10, 10], {
      source: { id: 'n1' },
      target: { id: 's1' },
    });

    expect(ids(SAME, [...twoPools(), free])).toEqual([]);
  });
});
