import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  evaluateRules,
  type ValidationRule,
} from '../extensions/validation.js';
import type { FrameworkBackgroundDef } from '../framework-background/index.js';

/**
 * The `role-count` family: how many of one artefact ONE instance of the frame
 * must carry.
 *
 * The finding is anchored on the FRAME, because no single element is the
 * mistake — there are none, or there are three. Two properties carry the whole
 * suite: the tally is per instance (a board with two pools holds two
 * independent answers), and attribution is CONTAINMENT ONLY, so an artefact
 * floating beside a pool never satisfies a requirement about what is in it.
 */

const ROLES: RoleDefs = {
  'test:pool': { id: 'test:pool', kind: 'node', labelKey: 'test.pool' },
  'test:event': { id: 'test:event', kind: 'node', labelKey: 'test.event' },
  // A specialisation, so a rule written on the parent counts it too.
  'test:timer-event': {
    id: 'test:timer-event',
    parent: 'test:event',
    kind: 'node',
    labelKey: 'test.timer-event',
  },
  'test:task': { id: 'test:task', kind: 'node', labelKey: 'test.task' },
  // The pair the GUARD is about: each is optional on its own, and only their
  // pairing is normative. Both specialise `test:event`, so the rules above keep
  // counting them.
  'test:start': {
    id: 'test:start',
    parent: 'test:event',
    kind: 'node',
    labelKey: 'test.start',
  },
  'test:end': {
    id: 'test:end',
    parent: 'test:event',
    kind: 'node',
    labelKey: 'test.end',
  },
  'test:terminate-end': {
    id: 'test:terminate-end',
    parent: 'test:end',
    kind: 'node',
    labelKey: 'test.terminate-end',
  },
};

/**
 * A pool whose plot is inset by 100 units on the LEFT — the title band a
 * swimlane notation writes its name in. The inset is there on purpose: an
 * artefact lying on the band is inside the element box and outside the plot, and
 * the suite says which of the two decides.
 */
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

/** "A pool holds exactly one start event." */
const ONE_START: ValidationRule = {
  id: 'test.one-start-event',
  framework: 'test',
  family: 'role-count',
  severity: 'warning',
  roles: ROLES,
  messageKey: 'com.labre.test.one-start-event',
  version: 1,
  backgroundRole: 'test:pool',
  background: POOL,
  roleCount: {
    subject: 'test:event',
    min: 1,
    max: 1,
    tooFew: { messageKey: 'com.labre.test.one-start-event.too-few' },
    tooMany: { messageKey: 'com.labre.test.one-start-event.too-many' },
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

const pool = (id: string, at: [number, number] = [0, 0]) =>
  element(id, [at[0], at[1], 1000, 400], { role: 'test:pool' });

/** An artefact, placed by the coordinate of its top-left corner. */
const node = (id: string, role: string, at: [number, number]) =>
  element(id, [at[0], at[1], 20, 20], { role });

/** Inside the plot of a pool at the origin: x 100…1000, y 0…400. */
const INSIDE: [number, number] = [200, 100];

const run = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  evaluateRules([rule], elements);

const ids = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  run(rule, elements).map(violation => violation.elementIds.join('+'));

describe('counting what one frame holds', () => {
  it('says nothing about a pool holding exactly one', () => {
    expect(
      ids(ONE_START, [
        pool('pool'),
        node('start', 'test:event', INSIDE),
        node('task', 'test:task', [400, 100]),
      ])
    ).toEqual([]);
  });

  it('indicts the POOL, not an element, when it holds none', () => {
    const found = run(ONE_START, [
      pool('pool'),
      node('task', 'test:task', INSIDE),
    ]);

    expect(found.map(violation => violation.elementIds)).toEqual([['pool']]);
    expect(found[0].messageKey).toBe('com.labre.test.one-start-event.too-few');
  });

  it('indicts the pool when it holds two', () => {
    const found = run(ONE_START, [
      pool('pool'),
      node('a', 'test:event', INSIDE),
      node('b', 'test:event', [400, 200]),
    ]);

    expect(found.map(violation => violation.elementIds)).toEqual([['pool']]);
    expect(found[0].messageKey).toBe('com.labre.test.one-start-event.too-many');
  });

  it('writes the frame as the finding’s own background', () => {
    // What makes a map-wide arbitration land on THIS pool and no other.
    expect(run(ONE_START, [pool('pool')])[0].backgroundId).toBe('pool');
  });

  it('counts each pool on its own', () => {
    // One conformant, one empty: a tally over the whole surface would call both
    // of them right.
    expect(
      ids(ONE_START, [
        pool('left'),
        pool('right', [2000, 0]),
        node('start', 'test:event', INSIDE),
      ])
    ).toEqual(['right']);
  });

  it('counts a specialisation of the subject role', () => {
    expect(
      ids(ONE_START, [pool('pool'), node('t', 'test:timer-event', INSIDE)])
    ).toEqual([]);
  });

  it('falls back to the rule’s own words for a bound with none', () => {
    const bare: ValidationRule = {
      ...ONE_START,
      roleCount: { subject: 'test:event', min: 1 },
    };

    expect(run(bare, [pool('pool')])[0].messageKey).toBe(
      'com.labre.test.one-start-event'
    );
  });

  it('is covered by an exception granted on the pool', () => {
    // The pool IS the indicted element here, so the narrower scope is the one
    // that fires — and it is the same gesture and the same element a map-wide
    // arbitration would be written on. An arbitration made on one pool still
    // says nothing about the pool next to it, which is the whole point of
    // anchoring the finding on the frame.
    const excused = element('pool', [0, 0, 1000, 400], {
      role: 'test:pool',
      validationExceptions: [{ ruleId: ONE_START.id, at: 1 }],
    });

    expect(run(ONE_START, [excused])[0].exemption).toBe('element');
    expect(run(ONE_START, [pool('pool')])[0].exemption).toBeUndefined();
  });
});

describe('what counts as being IN a frame', () => {
  it('does not count an artefact floating beside the pool', () => {
    // The decisive case. `attributeBackground`'s nearest-fallback would let this
    // one satisfy "this pool has a start event" from outside the pool.
    expect(
      ids(ONE_START, [pool('pool'), node('start', 'test:event', [1200, 100])])
    ).toEqual(['pool']);
  });

  it('does not count an artefact lying on the pool’s title band', () => {
    // Inside the element box, outside the PLOT: the band is where the pool
    // writes its own name, not where the process happens.
    expect(
      ids(ONE_START, [pool('pool'), node('start', 'test:event', [20, 100])])
    ).toEqual(['pool']);
  });

  it('reads the CENTRE, so an artefact half over the edge is out', () => {
    // Centre at x = 95, five units short of the plot.
    expect(
      ids(ONE_START, [pool('pool'), node('start', 'test:event', [85, 100])])
    ).toEqual(['pool']);
  });

  it('gives an artefact inside two frames to the SMALLER id', () => {
    // Ties never depend on the order the surface happened to be walked in: the
    // answer decides which frame a persisted arbitration is written on. The
    // overlapping pool is listed FIRST here, and still loses.
    expect(
      ids(ONE_START, [
        pool('pool-z'),
        pool('pool-a'),
        node('start', 'test:event', INSIDE),
      ])
    ).toEqual(['pool-z']);
  });
});

describe('when a role-count rule stays silent', () => {
  it('says nothing on a board carrying no frame at all', () => {
    // A process sketched before anybody drew a pool is a sketch.
    expect(ids(ONE_START, [node('start', 'test:event', INSIDE)])).toEqual([]);
  });

  it('says nothing about an artefact inside no frame', () => {
    // It is counted by nobody, and whether being off the frame is itself a
    // mistake is `element-in-background`'s question.
    expect(
      ids(ONE_START, [
        pool('pool'),
        node('start', 'test:event', INSIDE),
        node('stray', 'test:event', [3000, 3000]),
      ])
    ).toEqual([]);
  });

  it('evaluates nothing, and warns, for a rule declaring neither bound', () => {
    const bare: ValidationRule = {
      ...ONE_START,
      id: 'test.no-bound',
      roleCount: { subject: 'test:event' },
    };

    expect(ids(bare, [pool('pool')])).toEqual([]);
  });

  it('evaluates nothing, and warns, for a rule naming no frame role', () => {
    // `backgroundsOf` answers `[]` both for "this rule names no frame" and for
    // "this board carries none", and the second is a legitimate silence. A rule
    // that never fires and never says why is not.
    const frameless: ValidationRule = {
      ...ONE_START,
      id: 'test.no-frame-role',
      backgroundRole: undefined,
    };

    expect(ids(frameless, [pool('pool')])).toEqual([]);
  });

  it('counts against the element box when the plot has COLLAPSED', () => {
    // A pool dragged narrower than its own margins yields a negative-extent
    // plot, which contains no point anywhere. Left alone the tally would read
    // zero and `min: 1` would answer "this pool holds no start event" while
    // pointing at one that visibly holds one — a false accusation whose only
    // remedy, widen the pool, is nowhere in the sentence.
    const narrow = element('pool', [0, 0, 80, 400], { role: 'test:pool' });

    expect(
      ids(ONE_START, [narrow, node('start', 'test:event', [30, 100])])
    ).toEqual([]);
  });

  it('measures against the element box when the rule declares no geometry', () => {
    // `backgroundRole` alone is a complete declaration for a family that only
    // asks which frame something is on — so the title band is plot like the
    // rest of the box, and this artefact counts.
    const noDef: ValidationRule = { ...ONE_START, background: undefined };

    expect(
      ids(noDef, [pool('pool'), node('start', 'test:event', [20, 100])])
    ).toEqual([]);
  });
});

/**
 * `ifPresent`: a bound that only applies while the frame holds something else.
 *
 * Whole families of artefact are optional on their own and normative in PAIRS. A
 * sketch may legitimately show neither a beginning nor an end; what it may not
 * show is one without the other. An unconditional `min: 1` would state the wrong
 * thing twice — indicting the legitimate sketch, in the name of a requirement
 * the notation does not make — so the pairing is written as a bound plus a
 * guard, and the two directions are two rules.
 */
describe('a bound armed by another artefact', () => {
  /** "If the pool shows where the work ENDS, it must show where it starts." */
  const START_IF_END: ValidationRule = {
    ...ONE_START,
    id: 'test.start-if-end',
    messageKey: 'com.labre.test.start-if-end',
    roleCount: {
      subject: 'test:start',
      ifPresent: 'test:end',
      min: 1,
      tooFew: { messageKey: 'com.labre.test.start-if-end.too-few' },
    },
  };

  it('says nothing about a pool holding NEITHER', () => {
    // The legitimate sketch, and the whole reason the guard exists: an
    // unconditional `min: 1` would indict this board.
    expect(
      ids(START_IF_END, [pool('pool'), node('t', 'test:task', INSIDE)])
    ).toEqual([]);
  });

  it('indicts a pool holding an end and no start', () => {
    const found = run(START_IF_END, [
      pool('pool'),
      node('end', 'test:end', INSIDE),
    ]);

    expect(found.map(violation => violation.elementIds)).toEqual([['pool']]);
    expect(found[0].messageKey).toBe('com.labre.test.start-if-end.too-few');
  });

  it('says nothing about a pool holding both', () => {
    expect(
      ids(START_IF_END, [
        pool('pool'),
        node('start', 'test:start', INSIDE),
        node('end', 'test:end', [400, 200]),
      ])
    ).toEqual([]);
  });

  it('says nothing about a pool holding only a start', () => {
    // The other direction is a DIFFERENT rule's business, mirrored. This one
    // has nothing to say, because nothing armed it.
    expect(
      ids(START_IF_END, [pool('pool'), node('start', 'test:start', INSIDE)])
    ).toEqual([]);
  });

  it('arms each pool on its own', () => {
    // One pool holds an end and no start; the other holds neither. Only the
    // first is judged — the guard is per instance, like the tally it gates.
    expect(
      ids(START_IF_END, [
        pool('left'),
        pool('right', [2000, 0]),
        node('end', 'test:end', INSIDE),
      ])
    ).toEqual(['left']);
  });

  it('is armed by a specialisation of the guard role', () => {
    expect(
      ids(START_IF_END, [pool('pool'), node('e', 'test:terminate-end', INSIDE)])
    ).toEqual(['pool']);
  });

  it('is NOT armed by a guard element floating beside the pool', () => {
    // Containment only, on the same reading the subjects are counted with: an
    // artefact off the frame no more arms a requirement about it than it
    // satisfies one.
    expect(
      ids(START_IF_END, [pool('pool'), node('end', 'test:end', [1200, 100])])
    ).toEqual([]);
  });

  it('is NOT armed by a guard element on the pool’s title band', () => {
    expect(
      ids(START_IF_END, [pool('pool'), node('end', 'test:end', [20, 100])])
    ).toEqual([]);
  });

  it('mirrors, so the two directions are two rules', () => {
    const END_IF_START: ValidationRule = {
      ...START_IF_END,
      id: 'test.end-if-start',
      roleCount: { subject: 'test:end', ifPresent: 'test:start', min: 1 },
    };
    const startOnly = [pool('pool'), node('start', 'test:start', INSIDE)];

    expect(ids(START_IF_END, startOnly)).toEqual([]);
    expect(ids(END_IF_START, startOnly)).toEqual(['pool']);
  });

  it('gates a MAXIMUM as readily as a minimum', () => {
    const atMostOne: ValidationRule = {
      ...START_IF_END,
      id: 'test.one-start-if-end',
      roleCount: { subject: 'test:start', ifPresent: 'test:end', max: 1 },
    };
    const twoStarts = [
      node('a', 'test:start', INSIDE),
      node('b', 'test:start', [400, 200]),
    ];

    // Two starts and no end: nothing armed the bound.
    expect(ids(atMostOne, [pool('pool'), ...twoStarts])).toEqual([]);
    // ...and the same two starts, with an end to arm it.
    expect(
      ids(atMostOne, [
        pool('pool'),
        ...twoStarts,
        node('end', 'test:end', [700, 200]),
      ])
    ).toEqual(['pool']);
  });

  it('counts an element that is both subject and guard on both readings', () => {
    // Nothing forbids a vocabulary where the two roles overlap. A rule counting
    // `test:event` guarded by `test:event` is armed by its own subject, so a
    // pool holding one is armed and compliant, and a pool holding none is
    // neither armed nor judged.
    const selfGuarded: ValidationRule = {
      ...START_IF_END,
      id: 'test.self-guarded',
      roleCount: { subject: 'test:event', ifPresent: 'test:event', min: 2 },
    };

    expect(ids(selfGuarded, [pool('pool')])).toEqual([]);
    expect(
      ids(selfGuarded, [pool('pool'), node('one', 'test:event', INSIDE)])
    ).toEqual(['pool']);
    expect(
      ids(selfGuarded, [
        pool('pool'),
        node('one', 'test:event', INSIDE),
        node('two', 'test:event', [400, 200]),
      ])
    ).toEqual([]);
  });
});
