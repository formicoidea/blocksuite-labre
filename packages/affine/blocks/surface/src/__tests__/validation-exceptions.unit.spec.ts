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
  type ValidationRule,
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
 */
function element(
  id: string,
  xywh: [number, number, number, number],
  role?: string,
  validationExceptions?: ValidationException[]
): GfxPrimitiveElementModel {
  return {
    id,
    type: 'test',
    role,
    validationExceptions,
    get elementBound() {
      return new Bound(...xywh);
    },
  } as unknown as GfxPrimitiveElementModel;
}

const frame = (exceptions?: ValidationException[]) =>
  element('frame', [0, 0, 1000, 1000], 'test:frame', exceptions);

const offFrame = (id: string, exceptions?: ValidationException[]) =>
  element(id, [5000, 5000, 40, 40], 'test:node', exceptions);

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

describe('the map scope (PF8.4)', () => {
  it('excuses every element the map frames when the map carries the exception', () => {
    const violations = evaluate([
      frame([except(RULE_A.id)]),
      offFrame('n1'),
      offFrame('n2'),
    ]);

    expect(violations).toHaveLength(2);
    expect(violations.every(v => v.exemption === 'map')).toBe(true);
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

  it('returns to undefined when the last exception is revoked', () => {
    const el = offFrame('n1');
    grantException(el, RULE_A.id, undefined, 1);
    revokeException(el, RULE_A.id);

    // Indistinguishable from an element that never had one — the same reason
    // the field's default is never written.
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
