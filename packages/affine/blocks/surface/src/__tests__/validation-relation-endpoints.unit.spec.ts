import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  evaluateRules,
  type ValidationProfile,
  type ValidationRule,
} from '../extensions/validation.js';

/**
 * The `relation-endpoints` family: WHAT a typed edge may run between, and how
 * many times.
 *
 * The first family that reads nothing but MEANING — the persisted
 * `source → target` pair and the roles at the two ends — so every case below is
 * about a sentence somebody drew, never about where they drew it. The two
 * hardest requirements have a describe block each: an end outside the rule's
 * alphabet is SILENCE, and a self-loop is silence unless the framework asked.
 */

const ROLES: RoleDefs = {
  'test:frame': { id: 'test:frame', kind: 'node', labelKey: 'test.frame' },
  'test:actor': { id: 'test:actor', kind: 'node', labelKey: 'test.actor' },
  'test:command': { id: 'test:command', kind: 'node', labelKey: 'test.command' },
  'test:aggregate': {
    id: 'test:aggregate',
    kind: 'node',
    labelKey: 'test.aggregate',
  },
  // A specialisation, so a triplet written on the parent covers it for free.
  'test:aggregate-root': {
    id: 'test:aggregate-root',
    parent: 'test:aggregate',
    kind: 'node',
    labelKey: 'test.aggregate-root',
  },
  // Cited by no triplet: the artefact somebody drops on the board to say
  // "there is something here".
  'test:hotspot': { id: 'test:hotspot', kind: 'node', labelKey: 'test.hotspot' },
  'test:flow': { id: 'test:flow', kind: 'edge', labelKey: 'test.flow' },
  'test:relation': {
    id: 'test:relation',
    kind: 'edge',
    labelKey: 'test.relation',
  },
  'test:acl': {
    id: 'test:acl',
    parent: 'test:relation',
    kind: 'edge',
    labelKey: 'test.acl',
  },
  'test:conformist': {
    id: 'test:conformist',
    parent: 'test:relation',
    kind: 'edge',
    labelKey: 'test.conformist',
  },
};

/** The grammar half: an actor issues a command, a command lands on an aggregate. */
const GRAMMAR: ValidationRule = {
  id: 'test.forbidden-arc',
  framework: 'test',
  family: 'relation-endpoints',
  severity: 'warning',
  roles: ROLES,
  messageKey: 'com.labre.test.forbidden-arc',
  version: 1,
  backgroundRole: 'test:frame',
  endpoints: {
    edgeRole: 'test:flow',
    allowed: [
      { source: 'test:actor', edge: 'test:flow', target: 'test:command' },
      { source: 'test:command', edge: 'test:flow', target: 'test:aggregate' },
    ],
    offMatrix: { messageKey: 'com.labre.test.off-matrix' },
    selfLoop: { messageKey: 'com.labre.test.self-loop' },
    duplicate: { messageKey: 'com.labre.test.duplicate' },
  },
};

/** The pair half: no matrix at all, only how many relations one couple may carry. */
const PAIRS: ValidationRule = {
  id: 'test.incompatible-patterns',
  framework: 'test',
  family: 'relation-endpoints',
  severity: 'warning',
  roles: ROLES,
  messageKey: 'com.labre.test.incompatible-patterns',
  version: 1,
  endpoints: {
    edgeRole: 'test:relation',
    exclusivePairs: [['test:acl', 'test:conformist']],
    exclusive: { messageKey: 'com.labre.test.exclusive' },
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

const frame = (id = 'frame', at: [number, number] = [0, 0]) =>
  element(id, [at[0], at[1], 1000, 1000], { role: 'test:frame' });

/**
 * A node on the frame. Where it sits never decides anything here — this family
 * reads roles and the persisted ends, and no coordinate takes part — so the
 * position only serves the attribution, i.e. which frame contains it.
 */
const node = (id: string, role: string, at: [number, number] = [50, 50]) =>
  element(id, [at[0], at[1], 20, 20], { role });

/**
 * An edge, as the engine reads one: two ends holding an id. `role` absent is a
 * free connector, and an end given as `null` is one the user released over
 * empty canvas.
 */
const edge = (
  id: string,
  sourceId: string | null,
  targetId: string | null,
  role?: string
) =>
  element(id, [0, 0, 100, 100], {
    ...(role !== undefined ? { role } : {}),
    source: sourceId === null ? { position: [10, 10] } : { id: sourceId },
    target: targetId === null ? { position: [90, 90] } : { id: targetId },
  });

const ids = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  evaluateRules([rule], elements).map(violation =>
    violation.elementIds.join('+')
  );

describe('the sentences a framework sanctions', () => {
  it('says nothing about a relation that is in the matrix', () => {
    expect(
      ids(GRAMMAR, [
        frame(),
        node('a', 'test:actor'),
        node('c', 'test:command'),
        edge('e1', 'a', 'c', 'test:flow'),
      ])
    ).toEqual([]);
  });

  it('indicts one that is not, in the words of that mode of failure', () => {
    const [violation] = evaluateRules(
      [GRAMMAR],
      [
        frame(),
        node('g', 'test:aggregate'),
        node('c', 'test:command'),
        // Backwards: an aggregate does not issue a command.
        edge('e1', 'g', 'c', 'test:flow'),
      ]
    );

    expect(violation.ruleId).toBe(GRAMMAR.id);
    // Four ways of failing, four sentences — never the rule's own catch-all.
    expect(violation.messageKey).toBe('com.labre.test.off-matrix');
    expect(violation.severity).toBe('warning');
  });

  it('reads the order of the sentence, not the pair', () => {
    // `actor → command` is sanctioned; the same two artefacts the other way
    // round are not, and no move of either could make it right.
    expect(
      ids(GRAMMAR, [
        frame(),
        node('a', 'test:actor'),
        node('c', 'test:command'),
        edge('e1', 'c', 'a', 'test:flow'),
      ])
    ).toEqual(['a+c+e1']);
  });

  it('covers a specialisation through its parent role', () => {
    // `command → aggregate` is written once and holds for the aggregate ROOT,
    // which nothing in the matrix mentions.
    expect(
      ids(GRAMMAR, [
        frame(),
        node('c', 'test:command'),
        node('r', 'test:aggregate-root'),
        edge('e1', 'c', 'r', 'test:flow'),
      ])
    ).toEqual([]);
  });

  it('names the edge and both its ends, always in the same order', () => {
    // `[edge, source, target]` sorted: the same situation reports the same way
    // whichever order the surface happened to be walked in, and the edge is in
    // there because reversing the relation is one of the two honest fixes.
    const [violation] = evaluateRules(
      [GRAMMAR],
      [
        frame(),
        node('m', 'test:aggregate'),
        node('a', 'test:command'),
        edge('z-edge', 'm', 'a', 'test:flow'),
      ]
    );

    expect(violation.elementIds).toEqual(['a', 'm', 'z-edge']);
  });

  it('attributes the finding to the map the relation is drawn on', () => {
    // A board carries several maps, and the map-wide arbitration has to be
    // written on the right one.
    const far: [number, number] = [40000, 0];
    const violations = evaluateRules(
      [GRAMMAR],
      [
        frame('bg1'),
        node('g1', 'test:aggregate'),
        node('c1', 'test:command'),
        edge('e1', 'g1', 'c1', 'test:flow'),
        frame('bg2', far),
        node('g2', 'test:aggregate', [far[0] + 50, far[1] + 50]),
        node('c2', 'test:command', [far[0] + 50, far[1] + 50]),
        edge('e2', 'g2', 'c2', 'test:flow'),
      ]
    );

    expect(
      Object.fromEntries(
        violations.map(violation => [
          violation.elementIds.find(id => id.startsWith('e')),
          violation.backgroundId,
        ])
      )
    ).toEqual({ e1: 'bg1', e2: 'bg2' });
  });

  it('attributes it to the SMALLER id when two frames contain the source', () => {
    // A framework's own chart dropped on a big canvas frame contains the same
    // artefact twice, and the finding carries a map-wide arbitration: taking
    // whichever of the two the walk met first would have made where that
    // arbitration lives depend on the order a `Y.Map` was rebuilt in.
    const outer = element('bg-a', [0, 0, 1000, 1000], { role: 'test:frame' });
    const inner = element('bg-z', [0, 0, 400, 400], { role: 'test:frame' });
    const board = (...frames: GfxPrimitiveElementModel[]) => [
      ...frames,
      node('g', 'test:aggregate'),
      node('c', 'test:command'),
      edge('e1', 'g', 'c', 'test:flow'),
    ];

    expect(evaluateRules([GRAMMAR], board(inner, outer))[0].backgroundId).toBe(
      'bg-a'
    );
    // ...and the very same answer from the other end of the walk.
    expect(evaluateRules([GRAMMAR], board(outer, inner))[0].backgroundId).toBe(
      'bg-a'
    );
  });

  it('needs no frame on the board at all', () => {
    // The frame buys attribution, never the verdict: a grammar mistake is a
    // grammar mistake on blank canvas too.
    const [violation] = evaluateRules(
      [GRAMMAR],
      [
        node('g', 'test:aggregate'),
        node('c', 'test:command'),
        edge('e1', 'g', 'c', 'test:flow'),
      ]
    );

    expect(violation.messageKey).toBe('com.labre.test.off-matrix');
    expect(violation.backgroundId).toBeUndefined();
  });
});

describe('what the family stays silent about', () => {
  const surface = (...extra: GfxPrimitiveElementModel[]) => [
    frame(),
    node('a', 'test:actor'),
    node('c', 'test:command'),
    node('g', 'test:aggregate'),
    node('h', 'test:hotspot'),
    ...extra,
  ];

  it('an edge carrying no role — a free connector is not a claim', () => {
    expect(ids(GRAMMAR, surface(edge('e1', 'g', 'a')))).toEqual([]);
  });

  it('an edge carrying ANOTHER role', () => {
    expect(
      ids(GRAMMAR, surface(edge('e1', 'g', 'a', 'test:relation')))
    ).toEqual([]);
  });

  it('an edge with a free end — it relates nothing', () => {
    expect(ids(GRAMMAR, surface(edge('e1', 'g', null, 'test:flow')))).toEqual(
      []
    );
    expect(ids(GRAMMAR, surface(edge('e2', null, 'a', 'test:flow')))).toEqual(
      []
    );
  });

  it('an end whose element is gone — a dangling id says nothing', () => {
    expect(
      ids(GRAMMAR, surface(edge('e1', 'g', 'deleted-yesterday', 'test:flow')))
    ).toEqual([]);
  });

  /**
   * THE requirement that makes this family shippable (see
   * `RelationEndpointsDef.allowed`): a flow onto an artefact the grammar never
   * mentions is somebody sketching, and a tool that answered "that arc is
   * forbidden" would be indicting the act of thinking out loud.
   */
  describe('an end outside the alphabet of the matrix', () => {
    it('says nothing about a flow onto a hotspot', () => {
      expect(ids(GRAMMAR, surface(edge('e1', 'c', 'h', 'test:flow')))).toEqual(
        []
      );
      expect(ids(GRAMMAR, surface(edge('e2', 'h', 'c', 'test:flow')))).toEqual(
        []
      );
    });

    it('says nothing about a flow onto a neutral shape', () => {
      const scribble = element('free', [10, 10, 20, 20]);
      expect(
        ids(GRAMMAR, surface(scribble, edge('e1', 'c', 'free', 'test:flow')))
      ).toEqual([]);
    });

    it('and the silence is TOTAL — not the loop, not the duplicate', () => {
      const strict: ValidationRule = {
        ...GRAMMAR,
        endpoints: {
          ...GRAMMAR.endpoints!,
          forbidSelfLoop: true,
          forbidDuplicate: true,
        },
      };
      expect(
        ids(strict, surface(edge('e1', 'h', 'h', 'test:flow')))
      ).toEqual([]);
      expect(
        ids(
          strict,
          surface(
            edge('e1', 'c', 'h', 'test:flow'),
            edge('e2', 'c', 'h', 'test:flow')
          )
        )
      ).toEqual([]);
    });
  });
});

describe('a relation that loops back onto itself', () => {
  const loop = [
    frame(),
    node('c', 'test:command'),
    edge('e1', 'c', 'c', 'test:flow'),
  ];

  it('is silence while the framework has not asked', () => {
    // ...and the silence covers the matrix too: `command → command` is not a
    // sanctioned sentence, and indicting the loop for THAT would be a verdict
    // nobody meant.
    expect(ids(GRAMMAR, loop)).toEqual([]);
  });

  it('is a finding, in its own words, when it has', () => {
    const strict: ValidationRule = {
      ...GRAMMAR,
      endpoints: { ...GRAMMAR.endpoints!, forbidSelfLoop: true },
    };
    const [violation] = evaluateRules([strict], loop);

    expect(violation.messageKey).toBe('com.labre.test.self-loop');
    // Two ids, not three: the source and the target are the same element.
    expect(violation.elementIds).toEqual(['c', 'e1']);
  });
});

describe('the same relation drawn twice', () => {
  const twice = (...roles: string[]) => [
    frame(),
    node('c', 'test:command'),
    node('g', 'test:aggregate'),
    ...roles.map((role, i) => edge(`e${i + 1}`, 'c', 'g', role)),
  ];

  it('is silence while the framework has not asked', () => {
    expect(ids(GRAMMAR, twice('test:flow', 'test:flow'))).toEqual([]);
  });

  const strict: ValidationRule = {
    ...GRAMMAR,
    endpoints: { ...GRAMMAR.endpoints!, forbidDuplicate: true },
  };

  it('indicts every copy after the first, and only those', () => {
    const violations = evaluateRules(
      [strict],
      twice('test:flow', 'test:flow', 'test:flow')
    );

    // The first relation is not a duplicate of anything; the two copies are.
    expect(violations.map(v => v.elementIds.join('+'))).toEqual([
      'c+e2+g',
      'c+e3+g',
    ]);
    expect(violations[0].messageKey).toBe('com.labre.test.duplicate');
  });

  it('reads the ORDER of the relation, so A→B and B→A are two sentences', () => {
    expect(
      ids(strict, [
        frame(),
        node('c', 'test:command'),
        node('g', 'test:aggregate'),
        edge('e1', 'c', 'g', 'test:flow'),
        edge('e2', 'g', 'c', 'test:flow'),
      ])
      // `aggregate → command` is off the matrix, and an edge already indicted
      // for what it says is not indicted again for saying it twice.
    ).toEqual(['c+e2+g']);
    expect(
      evaluateRules(
        [strict],
        [
          frame(),
          node('c', 'test:command'),
          node('g', 'test:aggregate'),
          edge('e1', 'c', 'g', 'test:flow'),
          edge('e2', 'g', 'c', 'test:flow'),
        ]
      )[0].messageKey
    ).toBe('com.labre.test.off-matrix');
  });
});

describe('two relations that may not coexist', () => {
  const between = (first: string, second: string) => [
    frame(),
    node('x', 'test:command'),
    node('y', 'test:aggregate'),
    edge('e1', 'x', 'y', first),
    edge('e2', 'y', 'x', second),
  ];

  it('indicts the couple whichever way round it is declared', () => {
    // The role pair is unordered, and so is the pair of artefacts: the two
    // relations are drawn from opposite ends here.
    const forwards = evaluateRules([PAIRS], between('test:acl', 'test:conformist'));
    const backwards = evaluateRules([PAIRS], between('test:conformist', 'test:acl'));

    expect(forwards).toHaveLength(1);
    expect(backwards).toHaveLength(1);
    expect(forwards[0].messageKey).toBe('com.labre.test.exclusive');
  });

  it('names both relations AND both ends', () => {
    // Either link is a legitimate resolution, so neither may be left out; the
    // pair of artefacts is what makes the two of them one situation.
    const [violation] = evaluateRules(
      [PAIRS],
      between('test:acl', 'test:conformist')
    );

    expect(violation.elementIds).toEqual(['e1', 'e2', 'x', 'y']);
  });

  it('says nothing about two compatible relations', () => {
    expect(ids(PAIRS, between('test:acl', 'test:acl'))).toEqual([]);
  });

  it('says nothing about the same two patterns between DIFFERENT couples', () => {
    expect(
      ids(PAIRS, [
        frame(),
        node('x', 'test:command'),
        node('y', 'test:aggregate'),
        node('z', 'test:aggregate'),
        edge('e1', 'x', 'y', 'test:acl'),
        edge('e2', 'x', 'z', 'test:conformist'),
      ])
    ).toEqual([]);
  });

  it('writes the finding on ONE frame when the two ends sit on two', () => {
    // Each relation is attributed by its OWN source node, so a couple drawn
    // across two maps carries two frames — and the finding carries a map-wide
    // arbitration, which has to land somewhere a reload will find it again.
    // The smaller id, the house tie-break, whichever end each link starts from
    // and whichever order the surface was walked in.
    const framed: ValidationRule = { ...PAIRS, backgroundRole: 'test:frame' };
    const straddling = (first: string, second: string) => [
      element('bg-a', [0, 0, 1000, 1000], { role: 'test:frame' }),
      element('bg-z', [40000, 0, 1000, 1000], { role: 'test:frame' }),
      node('x', 'test:command'),
      node('y', 'test:aggregate', [40050, 50]),
      // `e1` sorts first and starts from the node on the LATER frame, which is
      // exactly the case reading the first relation's frame gets wrong.
      edge('e1', 'y', 'x', first),
      edge('e2', 'x', 'y', second),
    ];

    expect(
      evaluateRules([framed], straddling('test:conformist', 'test:acl'))[0]
        .backgroundId
    ).toBe('bg-a');
    expect(
      evaluateRules([framed], straddling('test:acl', 'test:conformist'))[0]
        .backgroundId
    ).toBe('bg-a');
  });

  it('reports one finding for one situation, however many pairs cover it', () => {
    // A pair written on a parent role and one on its specialisation are two
    // declarations of the same requirement, not two findings.
    const twice: ValidationRule = {
      ...PAIRS,
      endpoints: {
        ...PAIRS.endpoints!,
        exclusivePairs: [
          ['test:acl', 'test:conformist'],
          ['test:acl', 'test:relation'],
        ],
      },
    };

    expect(
      evaluateRules([twice], between('test:acl', 'test:conformist'))
    ).toHaveLength(1);
  });
});

describe('a matrix that sanctions nothing', () => {
  /**
   * `allowed: []` is a matrix that says NOTHING about the shape of a relation,
   * which is the same claim as declaring none — and emphatically not "no end is
   * in the alphabet, so the rule never speaks". Read the second way it would
   * silence the loop and the duplicate too, and a framework that forbids both
   * and lists no sentence would ship a rule that can never fire.
   */
  const LOOPS_ONLY: ValidationRule = {
    ...GRAMMAR,
    id: 'test.loops-only',
    endpoints: {
      ...GRAMMAR.endpoints!,
      allowed: [],
      forbidSelfLoop: true,
      forbidDuplicate: true,
    },
  };

  it('judges no sentence — every relation is off nobody’s matrix', () => {
    expect(
      ids(LOOPS_ONLY, [
        frame(),
        node('g', 'test:aggregate'),
        node('c', 'test:command'),
        // Backwards under the real grammar, and none of an empty one's business.
        edge('e1', 'g', 'c', 'test:flow'),
      ])
    ).toEqual([]);
  });

  it('still forbids the loop', () => {
    const [violation] = evaluateRules(
      [LOOPS_ONLY],
      [frame(), node('c', 'test:command'), edge('e1', 'c', 'c', 'test:flow')]
    );

    expect(violation.messageKey).toBe('com.labre.test.self-loop');
  });

  it('still forbids the copy', () => {
    const violations = evaluateRules(
      [LOOPS_ONLY],
      [
        frame(),
        node('c', 'test:command'),
        node('g', 'test:aggregate'),
        edge('e1', 'c', 'g', 'test:flow'),
        edge('e2', 'c', 'g', 'test:flow'),
      ]
    );

    expect(violations.map(v => v.elementIds.join('+'))).toEqual(['c+e2+g']);
    expect(violations[0].messageKey).toBe('com.labre.test.duplicate');
  });
});

describe('a profile that switches the rule off', () => {
  const OFF: ValidationProfile = {
    id: 'test.off',
    framework: 'test',
    labelKey: 'com.labre.test.profile.off',
    isDefault: true,
    rules: { [GRAMMAR.id]: 'off' },
  };

  it('reports nothing, and never walks the surface', () => {
    // `'off'` means the rule is skipped, not that its findings are filtered
    // afterwards: the family is what reads the ends, so counting those reads
    // says whether it ran.
    let reads = 0;
    const counted = {
      id: 'e1',
      type: 'test',
      role: 'test:flow',
      get source() {
        reads += 1;
        return { id: 'g' };
      },
      target: { id: 'c' },
      get elementBound() {
        return new Bound(0, 0, 100, 100);
      },
    } as unknown as GfxPrimitiveElementModel;

    const surface = [
      frame(),
      node('g', 'test:aggregate'),
      node('c', 'test:command'),
      counted,
    ];

    expect(evaluateRules([GRAMMAR], surface, [OFF])).toEqual([]);
    expect(reads).toBe(0);
    // ...and the very same board raises without the profile, so the silence
    // above is the profile's doing and not the fixture's.
    expect(evaluateRules([GRAMMAR], surface)).toHaveLength(1);
  });
});
