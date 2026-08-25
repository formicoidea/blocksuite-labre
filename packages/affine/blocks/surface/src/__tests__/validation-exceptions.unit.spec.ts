import { Bound } from '@labre/global/gfx';
import type {
  GfxPrimitiveElementModel,
  RoleDefs,
  ValidationException,
} from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  distinctByRule,
  elementExceptions,
  evaluateRules,
  grantException,
  hasException,
  liveViolations,
  revokeException,
  touchesVerdict,
  type ValidationRule,
  VERDICT_PROPS,
  verdictPropsOf,
  type Violation,
} from '../extensions/validation.js';

/**
 * PF8, engine half: an exception changes a violation's STATE, it never makes it
 * disappear.
 *
 * This suite owns the arbitration itself — who is covered, by which scope, and
 * what a grant or a revoke writes on an element. What only a real editor can
 * answer (the bubble's actions, the round trip, the duplicate, the flag cycle)
 * is in `packages/integration-test/.../wardley-validation-exceptions.spec.ts`.
 */

const ROLES: RoleDefs = {
  'test:frame': { id: 'test:frame', kind: 'node', labelKey: 'test.frame' },
  'test:node': { id: 'test:node', kind: 'node', labelKey: 'test.node' },
};

const RULE_A: ValidationRule = {
  id: 'test.node-outside-frame',
  framework: 'test',
  family: 'element-in-background',
  severity: 'warning',
  appliesTo: 'test:node',
  roles: ROLES,
  messageKey: 'com.labre.test.node-outside-frame',
  version: 1,
  backgroundRole: 'test:frame',
};

/** A second rule on the same role, so "one rule at a time" can be checked. */
const RULE_B: ValidationRule = {
  ...RULE_A,
  id: 'test.node-outside-frame-bis',
  messageKey: 'com.labre.test.node-outside-frame-bis',
};

/**
 * Element stand-in. `validationExceptions` is a plain writable property here,
 * which is exactly what the `@field()` accessor presents to the engine — the
 * Y.Map plumbing behind it is the integration suite's business.
 *
 * `clearField` stands in for the real one: the accessor's `undefined` is
 * indistinguishable from an absent key on a plain object, which is precisely
 * the illusion the real implementation has to break in the document.
 */
function element(
  id: string,
  xywh: [number, number, number, number],
  role?: string,
  validationExceptions?: ValidationException[]
): GfxPrimitiveElementModel {
  const stub = {
    id,
    type: 'test',
    role,
    validationExceptions,
    clearField(prop: string) {
      delete (stub as Record<string, unknown>)[prop];
    },
    get elementBound() {
      return new Bound(...xywh);
    },
  };
  return stub as unknown as GfxPrimitiveElementModel;
}

const frame = (exceptions?: ValidationException[]) =>
  element('frame', [0, 0, 1000, 1000], 'test:frame', exceptions);

/** A second map, far enough that "nearest" is never in doubt. */
const otherFrame = (exceptions?: ValidationException[]) =>
  element('frame-b', [40000, 0, 1000, 1000], 'test:frame', exceptions);

const offFrame = (id: string, exceptions?: ValidationException[]) =>
  element(id, [5000, 5000, 40, 40], 'test:node', exceptions);

/** Parked just outside the SECOND map, so it belongs to that one. */
const offOtherFrame = (id: string, exceptions?: ValidationException[]) =>
  element(id, [41500, 5000, 40, 40], 'test:node', exceptions);

const except = (ruleId: string): ValidationException => ({ ruleId, at: 1 });

const evaluate = (
  elements: GfxPrimitiveElementModel[],
  rules: readonly ValidationRule[] = [RULE_A]
) => evaluateRules(rules, elements);

describe('an exception changes a violation’s state, never its existence', () => {
  it('still reports a finding the user has excused', () => {
    const violations = evaluate([frame(), offFrame('n1', [except(RULE_A.id)])]);

    // The board stays honest: zero hidden violations (PF8.3).
    expect(violations).toHaveLength(1);
    expect(violations[0].exemption).toBe('element');
  });

  it('leaves a live finding unmarked', () => {
    const [violation] = evaluate([frame(), offFrame('n1')]);
    expect(violation.exemption).toBeUndefined();
  });

  it('takes the excused finding out of the canvas affordance', () => {
    const violations = evaluate([
      frame(),
      offFrame('excused', [except(RULE_A.id)]),
      offFrame('live'),
    ]);

    // `liveViolations` is the whole of the canvas behaviour: the flash and the
    // bracket only ever see what is still asking for something.
    const live = liveViolations(violations);
    expect(live).toHaveLength(1);
    expect(live[0].elementIds).toEqual(['live']);
  });
});

describe('an exception is strictly local (PF8.2)', () => {
  it('says nothing about another element', () => {
    const violations = evaluate([
      frame(),
      offFrame('excused', [except(RULE_A.id)]),
      offFrame('other'),
    ]);

    const byId = new Map(violations.map(v => [v.elementIds[0], v]));
    expect(byId.get('excused')?.exemption).toBe('element');
    expect(byId.get('other')?.exemption).toBeUndefined();
  });

  it('says nothing about another rule on the same element', () => {
    const violations = evaluate(
      [frame(), offFrame('n1', [except(RULE_A.id)])],
      [RULE_A, RULE_B]
    );

    const byRule = new Map(violations.map(v => [v.ruleId, v]));
    expect(byRule.get(RULE_A.id)?.exemption).toBe('element');
    expect(byRule.get(RULE_B.id)?.exemption).toBeUndefined();
  });

  it('ignores an exception naming a rule that is not the one being evaluated', () => {
    const violations = evaluate([
      frame(),
      offFrame('n1', [except('some.other.rule')]),
    ]);
    expect(violations[0].exemption).toBeUndefined();
  });
});

describe('a finding names the background it was measured against', () => {
  it('carries the id of the only map on the board', () => {
    const [violation] = evaluate([frame(), offFrame('n1')]);
    expect(violation.backgroundId).toBe('frame');
  });

  it('names the NEAREST map when the board carries several', () => {
    const violations = evaluate([
      frame(),
      otherFrame(),
      offFrame('near-a'),
      offOtherFrame('near-b'),
    ]);

    const byId = new Map(violations.map(v => [v.elementIds[0], v]));
    // The identity nothing downstream could reconstruct: by the time the
    // finding reaches the bubble, "which map was the user working on" is only
    // answerable because evaluation wrote it down.
    expect(byId.get('near-a')?.backgroundId).toBe('frame');
    expect(byId.get('near-b')?.backgroundId).toBe('frame-b');
  });

  it('measures the gap to the EDGE, so a big map does not lose its own element', () => {
    // 20 units off the right edge of the big map, 60 off the small one. By
    // centre distance the small map wins by a mile (the big map's centre is 900
    // units away) and the element is attributed to a map it is nowhere near.
    const big = element('big', [0, 0, 1600, 900], 'test:frame');
    const small = element('small', [1700, 300, 100, 100], 'test:frame');
    const stray = element('stray', [1620, 400, 40, 24], 'test:node');

    expect(evaluate([big, small, stray])[0].backgroundId).toBe('big');
  });

  it('is not fooled by the order the two maps are declared in', () => {
    const big = element('big', [0, 0, 1600, 900], 'test:frame');
    const small = element('small', [1700, 300, 100, 100], 'test:frame');
    const stray = element('stray', [1620, 400, 40, 24], 'test:node');

    expect(evaluate([small, big, stray])[0].backgroundId).toBe('big');
  });

  it('breaks an exact tie by id, never by iteration order', () => {
    // Two maps, symmetric about the element: the gap is identical, so geometry
    // has nothing left to say. `backgroundId` decides where a PERSISTED
    // decision is written, so the answer cannot come from the order a Map
    // rebuilt from a Y.Map happens to be walked in.
    const left = element('aaa', [0, 0, 100, 100], 'test:frame');
    const right = element('bbb', [300, 0, 100, 100], 'test:frame');
    const middle = element('mid', [180, 0, 40, 100], 'test:node');

    expect(evaluate([left, right, middle])[0].backgroundId).toBe('aaa');
    expect(evaluate([right, left, middle])[0].backgroundId).toBe('aaa');
  });
});

describe('the map scope is ONE map, not the document (PF8.4)', () => {
  it('excuses every element that map frames when the map carries the exception', () => {
    const violations = evaluate([
      frame([except(RULE_A.id)]),
      offFrame('n1'),
      offFrame('n2'),
    ]);

    expect(violations).toHaveLength(2);
    expect(violations.every(v => v.exemption === 'map')).toBe(true);
  });

  it('says nothing about the map next to it', () => {
    const violations = evaluate([
      frame([except(RULE_A.id)]),
      otherFrame(),
      offFrame('near-a'),
      offOtherFrame('near-b'),
    ]);

    const byId = new Map(violations.map(v => [v.elementIds[0], v]));
    expect(byId.get('near-a')?.exemption).toBe('map');
    // A board of an architect carries several maps. An arbitration made on one
    // is not an arbitration on the document.
    expect(byId.get('near-b')?.exemption).toBeUndefined();
  });

  it('dies with the map that carries it, leaving the other intact', () => {
    const a = frame([except(RULE_A.id)]);
    const b = otherFrame([except(RULE_A.id)]);
    const nearA = offFrame('near-a');
    const nearB = offOtherFrame('near-b');
    expect(
      evaluate([a, b, nearA, nearB]).every(v => v.exemption === 'map')
    ).toBe(true);

    // Map A deleted: its arbitration goes with it, B's is untouched. Elements
    // that were near A now fall to the only map left.
    const after = evaluate([b, nearA, nearB]);
    const byId = new Map(after.map(v => [v.elementIds[0], v]));
    expect(byId.get('near-b')?.exemption).toBe('map');
    expect(byId.get('near-a')?.backgroundId).toBe('frame-b');
  });

  it('does not leak to another rule', () => {
    const violations = evaluate(
      [frame([except(RULE_A.id)]), offFrame('n1')],
      [RULE_A, RULE_B]
    );

    const byRule = new Map(violations.map(v => [v.ruleId, v]));
    expect(byRule.get(RULE_A.id)?.exemption).toBe('map');
    expect(byRule.get(RULE_B.id)?.exemption).toBeUndefined();
  });

  it('reports the narrower scope when both cover the same finding', () => {
    // Revoking then walks outward — element first, map second — so each click
    // visibly changes the state instead of appearing to do nothing.
    const violations = evaluate([
      frame([except(RULE_A.id)]),
      offFrame('n1', [except(RULE_A.id)]),
    ]);
    expect(violations[0].exemption).toBe('element');
  });

  it('never lets an exception on a plain element reach the map scope', () => {
    // A neutral element carrying the exception is not the frame, and excuses
    // nobody but itself — the map scope is a property of the MAP.
    const violations = evaluate([
      frame(),
      element('note', [5000, 6000, 40, 40], undefined, [except(RULE_A.id)]),
      offFrame('n1'),
    ]);

    expect(violations).toHaveLength(1);
    expect(violations[0].exemption).toBeUndefined();
  });
});

describe('granting and revoking', () => {
  it('writes rule id and timestamp, and no author when there is none', () => {
    const el = offFrame('n1');
    grantException(el, RULE_A.id, undefined, 1234);

    expect(el.validationExceptions).toEqual([{ ruleId: RULE_A.id, at: 1234 }]);
    // Absent, not empty: an unknown author must not become a stored blank.
    expect('author' in (el.validationExceptions as object[])[0]).toBe(false);
  });

  it('records the author when the host knows one', () => {
    const el = offFrame('n1');
    grantException(el, RULE_A.id, 'alice', 1234);

    expect(el.validationExceptions).toEqual([
      { ruleId: RULE_A.id, at: 1234, author: 'alice' },
    ]);
  });

  it('never doubles up on the same rule', () => {
    const el = offFrame('n1');
    grantException(el, RULE_A.id, undefined, 1);
    grantException(el, RULE_A.id, undefined, 2);

    expect(elementExceptions(el)).toHaveLength(1);
    expect(elementExceptions(el)[0].at).toBe(1);
  });

  it('keeps the exceptions of other rules on revoke', () => {
    const el = offFrame('n1');
    grantException(el, RULE_A.id, undefined, 1);
    grantException(el, RULE_B.id, undefined, 2);
    revokeException(el, RULE_A.id);

    expect(hasException(el, RULE_A.id)).toBe(false);
    expect(hasException(el, RULE_B.id)).toBe(true);
  });

  it('removes the field entirely when the last exception is revoked', () => {
    const el = offFrame('n1');
    grantException(el, RULE_A.id, undefined, 1);
    revokeException(el, RULE_A.id);

    // Not "set to undefined" — GONE. Assigning `undefined` through the
    // `@field()` setter would leave the key in the Y.Map. The stand-in models
    // that difference with a real `delete`; the document-level proof is in the
    // integration suite, which reads the Y.Map itself.
    expect('validationExceptions' in (el as object)).toBe(false);
    expect(el.validationExceptions).toBeUndefined();
  });

  it('restores the violation once revoked', () => {
    const el = offFrame('n1');
    grantException(el, RULE_A.id, undefined, 1);
    expect(evaluate([frame(), el])[0].exemption).toBe('element');

    revokeException(el, RULE_A.id);
    expect(evaluate([frame(), el])[0].exemption).toBeUndefined();
  });

  it('assigns a NEW array rather than mutating the stored one', () => {
    // The `@field()` setter is what reaches the Y.Map: an in-place push would
    // never fire it, and the arbitration would live in the tab and nowhere else.
    const el = offFrame('n1');
    grantException(el, RULE_A.id, undefined, 1);
    const first = el.validationExceptions;
    grantException(el, RULE_B.id, undefined, 2);

    expect(el.validationExceptions).not.toBe(first);
    expect(first).toHaveLength(1);
  });
});

describe('what wakes a re-evaluation', () => {
  it('reacts to a verdict prop being DELETED, not just written', () => {
    // `syncElementFromY` fills `props` for add/update only; a delete — which is
    // exactly what an undo of an exception produces — fills `oldValues` alone.
    // Reading `props` on its own leaves the board showing a finding as excused
    // when the document no longer says so, with a dead Revoke on it.
    expect(
      touchesVerdict({ props: {}, oldValues: { validationExceptions: [] } })
    ).toBe(true);
  });

  it('still reacts to an ordinary write', () => {
    expect(touchesVerdict({ props: { xywh: '[0,0,1,1]' }, oldValues: {} })).toBe(
      true
    );
  });

  it('stays asleep for a prop that cannot change a verdict', () => {
    // `SpotlightManager` writes `opacity` on every element it dims.
    expect(
      touchesVerdict({ props: { opacity: 0.3 }, oldValues: { opacity: 1 } })
    ).toBe(false);
  });

  it('assumes the worst when the payload says nothing', () => {
    // A missed re-evaluation is a board that lies; a spurious one is a
    // debounce tick.
    expect(touchesVerdict({})).toBe(true);
  });

  /**
   * A framework can make one more prop verdict-bearing (PO, 25/08/2026).
   *
   * Hiding the part of a background that DRAWS a frontier changes every verdict
   * measured against that frontier, so the toggle has to wake the engine — and
   * the engine has to learn about it from the declarations it was handed, never
   * from a prop name written into this file.
   */
  describe('the props a framework adds', () => {
    const stroke = { color: '#000', width: 1 };

    /** A rule framed against a background whose graduations are gated. */
    const GATED: ValidationRule = {
      ...RULE_A,
      id: 'test.on-transition',
      background: {
        type: 'test',
        geometry: {
          width: 100,
          height: 100,
          lockAspectRatio: false,
          resizable: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        },
        axes: [
          {
            id: 'evolution',
            orientation: 'horizontal',
            at: 1,
            stroke,
            ticks: {
              ticks: [{ at: 0.5 }],
              stroke,
              visibleProp: 'showColumns',
            },
          },
        ],
      },
    };

    it('adds the visibility props of the registered backgrounds', () => {
      const props = verdictPropsOf([RULE_A, GATED]);

      expect(props.has('showColumns')).toBe(true);
      // …on top of, never instead of, the ones that hold for every framework.
      for (const constant of VERDICT_PROPS) expect(props.has(constant)).toBe(true);
    });

    it('adds nothing for a framework that declares no toggle', () => {
      expect(verdictPropsOf([RULE_A])).toEqual(new Set(VERDICT_PROPS));
      expect(verdictPropsOf([])).toEqual(new Set(VERDICT_PROPS));
    });

    it('wakes the engine on that prop, and on that prop only', () => {
      const watched = verdictPropsOf([GATED]);

      expect(touchesVerdict({ props: { showColumns: false } }, watched)).toBe(
        true
      );
      // A toggle nobody's rule measures against is still just a colour.
      expect(touchesVerdict({ props: { showCornerLabels: false } }, watched)).toBe(
        false
      );
      // And with the framework absent, the same write changes no verdict.
      expect(touchesVerdict({ props: { showColumns: false } })).toBe(false);
    });
  });
});

describe('robustness of the stored value', () => {
  it('treats a malformed value from a peer as no exception at all', () => {
    const el = element('n1', [5000, 5000, 40, 40], 'test:node');
    (el as unknown as { validationExceptions: unknown }).validationExceptions =
      'not an array';

    expect(elementExceptions(el)).toEqual([]);
    expect(evaluate([frame(), el])[0].exemption).toBeUndefined();
  });
});

describe('what the bubble collapses to', () => {
  it('lets a live finding win the line over an excused one of the same rule', () => {
    const live: Violation = {
      ruleId: RULE_A.id,
      elementIds: ['a'],
      severity: 'warning',
      messageKey: RULE_A.messageKey,
    };
    const excused: Violation = { ...live, elementIds: ['b'], exemption: 'element' };

    // Two members of one group, one excused and one not: the line has to read
    // "this rule still applies here".
    expect(distinctByRule([excused, live])).toEqual([live]);
    expect(distinctByRule([live, excused])).toEqual([live]);
  });

  it('keeps the exception when every finding of the rule is excused', () => {
    const excused: Violation = {
      ruleId: RULE_A.id,
      elementIds: ['a'],
      severity: 'warning',
      messageKey: RULE_A.messageKey,
      exemption: 'map',
    };
    expect(distinctByRule([excused])).toEqual([excused]);
  });
});
