import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  evaluateCheckup,
  evaluateRules,
  type ValidationRule,
} from '../extensions/validation.js';

/**
 * The `reachability` family: can you get here from the start?
 *
 * The first family that builds a GRAPH, and the first whose verdict about one
 * element depends on elements arbitrarily far away from it. Two decisions carry
 * the suite: a board with NO root is total silence (the missing root is another
 * rule's finding, raised once, on the frame), and the walk follows arcs forward
 * only — a step that merely points back at the chain is exactly the mistake this
 * exists to find.
 */

const ROLES: RoleDefs = {
  'test:frame': { id: 'test:frame', kind: 'node', labelKey: 'test.frame' },
  'test:node': { id: 'test:node', kind: 'node', labelKey: 'test.node' },
  'test:start': {
    id: 'test:start',
    parent: 'test:node',
    kind: 'node',
    labelKey: 'test.start',
  },
  // A specialisation of the root role: a timer start is still a start.
  'test:timer-start': {
    id: 'test:timer-start',
    parent: 'test:start',
    kind: 'node',
    labelKey: 'test.timer-start',
  },
  'test:task': {
    id: 'test:task',
    parent: 'test:node',
    kind: 'node',
    labelKey: 'test.task',
  },
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

/** "Every step of the process is reachable from a start event." */
const REACHABLE: ValidationRule = {
  id: 'test.unreachable-step',
  framework: 'test',
  family: 'reachability',
  severity: 'warning',
  roles: ROLES,
  messageKey: 'com.labre.test.unreachable-step',
  version: 1,
  backgroundRole: 'test:frame',
  reachability: {
    rootRole: 'test:start',
    subjectRole: 'test:task',
    edgeRole: 'test:flow',
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

/** start → a → b, plus whatever else the case needs. */
const chain = () => [
  frame(),
  node('start', 'test:start'),
  node('a', 'test:task'),
  node('b', 'test:task'),
  edge('f1', 'start', 'a'),
  edge('f2', 'a', 'b'),
];

describe('walking the graph from every root at once', () => {
  it('says nothing about a chain that hangs off the start', () => {
    expect(ids(REACHABLE, chain())).toEqual([]);
  });

  it('indicts a step nothing leads to', () => {
    expect(ids(REACHABLE, [...chain(), node('orphan', 'test:task')])).toEqual([
      'orphan',
    ]);
  });

  it('indicts a whole detached branch, one finding per step', () => {
    expect(
      ids(REACHABLE, [
        ...chain(),
        node('x', 'test:task'),
        node('y', 'test:task'),
        edge('f3', 'x', 'y'),
      ])
    ).toEqual(['x', 'y']);
  });

  it('reaches a step from a SECOND root', () => {
    expect(
      ids(REACHABLE, [
        ...chain(),
        node('start-2', 'test:start'),
        node('c', 'test:task'),
        edge('f3', 'start-2', 'c'),
      ])
    ).toEqual([]);
  });

  it('follows a specialisation of the edge role', () => {
    expect(
      ids(REACHABLE, [
        frame(),
        node('start', 'test:start'),
        node('a', 'test:task'),
        edge('f1', 'start', 'a', 'test:conditional-flow'),
      ])
    ).toEqual([]);
  });

  it('leaves from a specialisation of the root role', () => {
    expect(
      ids(REACHABLE, [
        frame(),
        node('start', 'test:timer-start'),
        node('a', 'test:task'),
        edge('f1', 'start', 'a'),
      ])
    ).toEqual([]);
  });

  it('never indicts a root, even when the subject role covers it', () => {
    // `test:start` specialises `test:node`, so a rule whose subject is the
    // parent has its own roots among its subjects. Seeding the roots into the
    // visited set is what makes that fall out instead of needing a second test.
    const broad: ValidationRule = {
      ...REACHABLE,
      reachability: {
        rootRole: 'test:start',
        subjectRole: 'test:node',
        edgeRole: 'test:flow',
      },
    };

    expect(
      ids(broad, [frame(), node('start', 'test:start'), node('a', 'test:task')])
    ).toEqual(['a']);
  });

  it('terminates on a cycle, and still finds what hangs off it', () => {
    expect(
      ids(REACHABLE, [
        ...chain(),
        // b loops back to a: a genuine cycle inside the reachable part.
        edge('f3', 'b', 'a'),
        node('orphan', 'test:task'),
        // ...and a cycle that is NOT reachable from the start.
        node('p', 'test:task'),
        node('q', 'test:task'),
        edge('f4', 'p', 'q'),
        edge('f5', 'q', 'p'),
      ])
    ).toEqual(['orphan', 'p', 'q']);
  });

  it('attributes the finding to the frame the orphan was drawn on', () => {
    const found = run(REACHABLE, [...chain(), node('orphan', 'test:task')]);

    expect(found[0].backgroundId).toBe('frame');
  });
});

describe('what the walk refuses to follow', () => {
  it('follows arcs FORWARD only', () => {
    // A step that merely points back at the chain is not reachable from it.
    // An undirected walk would certify exactly the mistake this rule exists for.
    expect(
      ids(REACHABLE, [
        ...chain(),
        node('back', 'test:task'),
        edge('f3', 'back', 'b'),
      ])
    ).toEqual(['back']);
  });

  it('does not follow a relation of another role', () => {
    expect(
      ids(REACHABLE, [
        ...chain(),
        node('m', 'test:task'),
        edge('f3', 'b', 'm', 'test:message'),
      ])
    ).toEqual(['m']);
  });

  it('does not follow an edge with a free end', () => {
    expect(
      ids(REACHABLE, [
        frame(),
        node('start', 'test:start'),
        node('a', 'test:task'),
        edge('f1', 'start', null),
      ])
    ).toEqual(['a']);
  });

  it('does not follow a connector carrying no role', () => {
    const free = element('free', [0, 0, 10, 10], {
      source: { id: 'start' },
      target: { id: 'a' },
    });

    expect(
      ids(REACHABLE, [
        frame(),
        node('start', 'test:start'),
        node('a', 'test:task'),
        free,
      ])
    ).toEqual(['a']);
  });
});

describe('the silence when there is no root', () => {
  it('says NOTHING at all on a board carrying no start', () => {
    // The load-bearing decision. Every step is unreachable, so the alternative
    // is a wall of brackets whose single real cause — no start event — is
    // `role-count`'s finding, raised once, on the frame.
    expect(
      ids(REACHABLE, [
        frame(),
        node('a', 'test:task'),
        node('b', 'test:task'),
        edge('f1', 'a', 'b'),
      ])
    ).toEqual([]);
  });

  it('says nothing on a board carrying no subject either', () => {
    expect(ids(REACHABLE, [frame(), node('start', 'test:start')])).toEqual([]);
  });
});

describe('the family is agnostic about WHEN it runs', () => {
  it('answers the same question at the on-demand moment', () => {
    // A framework that finds a traversal too expensive for the drawing path
    // declares `moment: 'on-demand'` and changes nothing else — the moment is
    // the rule's to choose, and the family never reads it.
    const later: ValidationRule = { ...REACHABLE, moment: 'on-demand' };
    const board = [...chain(), node('orphan', 'test:task')];

    expect(evaluateRules([later], board)).toEqual([]);
    expect(
      evaluateCheckup([later], board).map(v => v.elementIds.join('+'))
    ).toEqual(['orphan']);
  });
});

/**
 * `implicitRoots`: a subject nothing points at is a beginning.
 *
 * A notation whose explicit start marker is OPTIONAL has a second, silent way of
 * saying where the work begins: draw the artefact and point nothing at it. Two
 * branches running side by side, only one of them marked, are both well-formed —
 * and the declared reading would report the whole of the unmarked branch as
 * unreachable, a wall of brackets over a drawing that is right.
 *
 * What survives is the only real defect: a ring entered from nowhere. Every
 * artefact in it has an incoming edge, so it is not an implicit root; nothing
 * outside points into it, so no walk reaches it; and the work it describes can
 * never begin.
 */
describe('the subjects nothing points at', () => {
  const OPEN: ValidationRule = {
    ...REACHABLE,
    id: 'test.unreachable-step-open',
    reachability: {
      rootRole: 'test:start',
      subjectRole: 'test:task',
      edgeRole: 'test:flow',
      implicitRoots: true,
    },
  };

  /** u1 → u2, with nothing pointing at u1: a branch with no start marker. */
  const unmarked = () => [
    frame(),
    node('u1', 'test:task'),
    node('u2', 'test:task'),
    edge('fu', 'u1', 'u2'),
  ];

  /** p → q → p, entered from nowhere. */
  const ring = () => [
    node('p', 'test:task'),
    node('q', 'test:task'),
    edge('f4', 'p', 'q'),
    edge('f5', 'q', 'p'),
  ];

  it('leaves a whole start-less chain alone', () => {
    // The declared reading says nothing here either — but only because the
    // zero-root gate saves it, and the gate stops applying the moment ONE start
    // marker exists anywhere on the board. This reading needs no gate.
    expect(ids(OPEN, unmarked())).toEqual([]);
  });

  it('leaves an unmarked branch alone BESIDE a marked one', () => {
    // The case the declared reading gets wrong: one start marker on the board
    // lifts the gate, and the unmarked branch lights up end to end.
    const board = [...chain(), ...unmarked().slice(1)];

    expect(ids(REACHABLE, board)).toEqual(['u1', 'u2']);
    expect(ids(OPEN, board)).toEqual([]);
  });

  it('indicts a ring entered from nowhere', () => {
    // Every artefact in it has an incoming edge, so none is an implicit root,
    // and nothing outside points in. The work can never begin — and this is the
    // only defect the open reading still reports.
    expect(ids(OPEN, [...chain(), ...ring()])).toEqual(['p', 'q']);
  });

  it('indicts a ring beside an UNMARKED branch', () => {
    // No start marker anywhere: the branch roots itself, and the ring cannot.
    expect(ids(OPEN, [...unmarked(), ...ring()])).toEqual(['p', 'q']);
  });

  it('indicts a subject fed only by an edge with a DANGLING source', () => {
    // The second shape of the residual, and the one the prose used to omit: the
    // edge points at `s`, so `s` is not an implicit root; its source is on no
    // board, so nothing ever leaves from it. Neither a root nor reachable.
    //
    // The broken edge is `relation-endpoints`' subject; this family reports the
    // consequence. Inherited from the declared reading, not introduced by the
    // flag — the assertion below says so.
    const board = [
      ...chain(),
      node('s', 'test:task'),
      edge('fg', 'ghost', 's'),
    ];

    expect(ids(OPEN, board)).toEqual(['s']);
    expect(ids(REACHABLE, board)).toEqual(['s']);
  });

  it('indicts a subject fed only by an element OUTSIDE the walk', () => {
    // Same shape, a different cause: the source exists but carries a role that
    // is neither the root role nor the subject role, so the walk never enqueues
    // it and never leaves from it.
    const board = [
      ...chain(),
      node('note', 'test:frame'),
      node('s', 'test:task'),
      edge('fn', 'note', 's'),
    ];

    expect(ids(OPEN, board)).toEqual(['s']);
    expect(ids(REACHABLE, board)).toEqual(['s']);
  });

  it('says nothing about a board that is NOTHING BUT a ring', () => {
    // The gate, at its edge. Every subject is pointed at, so there is no root of
    // either kind, and the rule says nothing at all — the same total silence the
    // declared reading gives a board with no start marker.
    //
    // Deliberate, and worth knowing before writing a rule on this flag: the
    // finding above needs SOMETHING on the board to be a beginning. In practice
    // a ring is drawn beside the work it belongs to, which is either case
    // above; a document consisting solely of a ring is a fragment, and the
    // family treats fragments the way it treats sketches.
    expect(ids(OPEN, [frame(), ...ring()])).toEqual([]);
  });

  it('says nothing about a ring something points INTO', () => {
    // One arc from the marked chain, and the whole ring is reachable.
    expect(ids(OPEN, [...chain(), ...ring(), edge('f6', 'b', 'p')])).toEqual(
      []
    );
  });

  it('treats a SELF-LOOP as pointed at, not as a beginning', () => {
    // Something does point at it — itself — so it is not an implicit root. A
    // ring of one, drawn beside work that does begin somewhere.
    expect(
      ids(OPEN, [
        ...chain(),
        node('solo', 'test:task'),
        edge('f6', 'solo', 'solo'),
      ])
    ).toEqual(['solo']);
  });

  it('still leaves from the DECLARED roots', () => {
    // The second kind of root is added to the first, never substituted for it:
    // a step reachable only through the start marker stays reachable.
    expect(ids(OPEN, chain())).toEqual([]);
  });

  it('never indicts a subject that is also a declared root', () => {
    // Seeded once, through the same `visited` guard: a start marker with an
    // incoming edge is not an implicit root, and is still a root.
    const broad: ValidationRule = {
      ...OPEN,
      reachability: {
        rootRole: 'test:start',
        subjectRole: 'test:node',
        edgeRole: 'test:flow',
        implicitRoots: true,
      },
    };

    expect(
      ids(broad, [
        frame(),
        node('start', 'test:start'),
        node('a', 'test:task'),
        edge('f1', 'a', 'start'),
      ])
    ).toEqual([]);
  });

  it('follows the inheritance chain on both kinds of root', () => {
    expect(
      ids(OPEN, [
        frame(),
        node('start', 'test:timer-start'),
        node('a', 'test:task'),
        edge('f1', 'start', 'a'),
        ...ring(),
      ])
    ).toEqual(['p', 'q']);
  });

  it('says nothing when every subject sits in a ring and there is no root', () => {
    // Zero roots of EITHER kind. The gate still holds, and the board where it
    // now fires is one where the question genuinely does not arise.
    const onlyRings = [frame(), ...ring()];
    const noRoots: ValidationRule = {
      ...OPEN,
      id: 'test.unreachable-step-gated',
      reachability: {
        rootRole: 'test:start',
        // Nothing on this board carries the subject role, so there is no
        // implicit root either — and no subject to report.
        subjectRole: 'test:frame',
        edgeRole: 'test:flow',
        implicitRoots: true,
      },
    };

    expect(ids(noRoots, onlyRings)).toEqual([]);
  });

  it('leaves the declared reading untouched', () => {
    // Absent or false is the original behaviour, to the finding: the flag adds
    // a way of starting, it does not change what "reachable" means.
    const off: ValidationRule = {
      ...OPEN,
      reachability: {
        rootRole: 'test:start',
        subjectRole: 'test:task',
        edgeRole: 'test:flow',
        implicitRoots: false,
      },
    };
    const board = [...chain(), node('orphan', 'test:task')];

    expect(ids(off, board)).toEqual(ids(REACHABLE, board));
    // ...and an orphan nothing points at IS an implicit root, so the open
    // reading has nothing to say about the very same board.
    expect(ids(OPEN, board)).toEqual([]);
  });
});
