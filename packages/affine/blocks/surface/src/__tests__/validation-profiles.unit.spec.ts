import { Bound } from '@labre/global/gfx';
import type {
  GfxPrimitiveElementModel,
  RoleDefs,
  ValidationException,
} from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import {
  defaultProfileOf,
  evaluateRules,
  profileSeverity,
  type ValidationProfile,
  type ValidationRule,
} from '../extensions/validation.js';

/**
 * PF9, engine half: a profile is a level of requirement, chosen per root
 * instance, that decides how hard each rule of its framework bites — or that it
 * does not apply at all.
 *
 * This suite owns the resolution itself: which profile a finding is judged by,
 * what `'off'` costs, and what a change of profile does and does not touch.
 * What only a real editor can answer — the chip, the persistence, the round
 * trip, the duplicate — is in
 * `packages/integration-test/.../wardley-validation-profiles.spec.ts`.
 */

const ROLES: RoleDefs = {
  'test:frame': { id: 'test:frame', kind: 'node', labelKey: 'test.frame' },
  'test:node': { id: 'test:node', kind: 'node', labelKey: 'test.node' },
};

const RULE: ValidationRule = {
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

/** A second rule of the same framework, absent from every profile below. */
const UNLISTED_RULE: ValidationRule = {
  ...RULE,
  id: 'test.node-outside-frame-bis',
  severity: 'blocking-overridable',
  messageKey: 'com.labre.test.node-outside-frame-bis',
};

const PERMISSIVE: ValidationProfile = {
  id: 'test.sketch',
  framework: 'test',
  labelKey: 'com.labre.test.profile.sketch',
  isDefault: true,
  rules: { [RULE.id]: 'audit' },
};

const STRICT: ValidationProfile = {
  id: 'test.strict',
  framework: 'test',
  labelKey: 'com.labre.test.profile.strict',
  rules: { [RULE.id]: 'warning' },
};

const DISABLED: ValidationProfile = {
  id: 'test.off',
  framework: 'test',
  labelKey: 'com.labre.test.profile.off',
  rules: { [RULE.id]: 'off' },
};

const PROFILES = [PERMISSIVE, STRICT, DISABLED];

/**
 * The same framework with the rule switched off by DEFAULT.
 *
 * The short-circuit that makes `'off'` free can only fire when nothing on the
 * board can raise the rule, and a background naming no profile falls back to
 * the default — so the default has to be off too. Erring that way is
 * deliberate: a missed skip costs a linear pass, a wrong skip costs a rule that
 * silently stops firing.
 */
const OFF_BY_DEFAULT = [{ ...DISABLED, isDefault: true }, STRICT];

function element(
  id: string,
  xywh: [number, number, number, number],
  props: {
    role?: string;
    validationProfile?: string;
    validationExceptions?: ValidationException[];
  } = {}
): GfxPrimitiveElementModel {
  const stub = {
    id,
    type: 'test',
    role: props.role,
    validationProfile: props.validationProfile,
    validationExceptions: props.validationExceptions,
    clearField(prop: string) {
      delete (stub as Record<string, unknown>)[prop];
    },
    get elementBound() {
      return new Bound(...xywh);
    },
  };
  return stub as unknown as GfxPrimitiveElementModel;
}

const frame = (id = 'bg', profile?: string) =>
  element(id, [0, 0, 1000, 1000], {
    role: 'test:frame',
    ...(profile !== undefined ? { validationProfile: profile } : {}),
  });

const outside = (id: string, at = 5000, exceptions?: ValidationException[]) =>
  element(id, [at, at, 40, 40], {
    role: 'test:node',
    ...(exceptions ? { validationExceptions: exceptions } : {}),
  });

describe('a profile decides the severity of each rule', () => {
  it('demotes the rule to audit under the permissive default', () => {
    // No profile named on the frame => the framework default applies.
    const [violation] = evaluateRules(
      [RULE],
      [frame(), outside('n1')],
      PROFILES
    );

    expect(violation.severity).toBe('audit');
    // The finding is still REPORTED: `audit` is invisible on the canvas, not
    // absent from the engine. A host panel and a report still see it.
    expect(violation.ruleId).toBe(RULE.id);
  });

  it('raises the rule to warning under the strict profile', () => {
    const [violation] = evaluateRules(
      [RULE],
      [frame('bg', STRICT.id), outside('n1')],
      PROFILES
    );

    expect(violation.severity).toBe('warning');
  });

  it('leaves a rule the profile is silent about on its own severity', () => {
    // An override table, not an allow-list: a rule shipped after a profile was
    // written must not silently vanish from it.
    const violations = evaluateRules(
      [UNLISTED_RULE],
      [frame(), outside('n1')],
      PROFILES
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].severity).toBe(UNLISTED_RULE.severity);
  });

  it('judges every rule by its own severity when no profile is registered', () => {
    const violations = evaluateRules([RULE], [frame(), outside('n1')]);

    expect(violations[0].severity).toBe('warning');
  });
});

describe('an off rule is not evaluated at all', () => {
  /** A node whose every geometric read is counted. */
  const countedNode = (bound: () => Bound) =>
    ({
      id: 'n1',
      type: 'test',
      role: 'test:node',
      get elementBound() {
        return bound();
      },
    }) as unknown as GfxPrimitiveElementModel;

  it('reports nothing', () => {
    expect(
      evaluateRules([RULE], [frame(), outside('n1')], OFF_BY_DEFAULT)
    ).toEqual([]);
  });

  it('never walks the surface — off costs nothing, it is not a filter', () => {
    // The element accessors are the whole cost of an evaluation: if the family
    // ran and its output were merely discarded, `elementBound` would have been
    // read. `'off'` means the rule is skipped, not that its findings are
    // filtered afterwards.
    const bound = vi.fn(() => new Bound(5000, 5000, 40, 40));

    evaluateRules([RULE], [frame(), countedNode(bound)], OFF_BY_DEFAULT);

    expect(bound).not.toHaveBeenCalled();
  });

  it('still evaluates when ANOTHER instance on the board is not off', () => {
    // Two frames, two independent levels of requirement (PF9.1): the rule is
    // skipped only when nothing on the board can raise it.
    const strictFrame = element('bg2', [40000, 0, 1000, 1000], {
      role: 'test:frame',
      validationProfile: STRICT.id,
    });
    const violations = evaluateRules(
      [RULE],
      [frame('bg1'), strictFrame, outside('n1', 41000)],
      OFF_BY_DEFAULT
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].backgroundId).toBe('bg2');
    expect(violations[0].severity).toBe('warning');
  });

  it('drops only the findings the off instance owns', () => {
    // The board IS walked (the strict frame can raise), so every finding is
    // judged against its own frame: the one attributed to the off frame goes,
    // the other stays.
    const strictFrame = element('bg2', [40000, 0, 1000, 1000], {
      role: 'test:frame',
      validationProfile: STRICT.id,
    });
    const violations = evaluateRules(
      [RULE],
      [frame('bg1'), strictFrame, outside('n1', 3000), outside('n2', 41500)],
      OFF_BY_DEFAULT
    );

    expect(violations.map(violation => violation.elementIds[0])).toEqual([
      'n2',
    ]);
  });
});

describe('the profile is read off the instance the finding was measured against', () => {
  it('gives two frames on one board two different verdicts', () => {
    const strictFrame = element('bg2', [40000, 0, 1000, 1000], {
      role: 'test:frame',
      validationProfile: STRICT.id,
    });
    const violations = evaluateRules(
      [RULE],
      [
        frame('bg1'), // permissive default
        strictFrame,
        outside('n1', 3000), // nearest bg1
        outside('n2', 41500), // nearest bg2
      ],
      PROFILES
    );

    const byElement = Object.fromEntries(
      violations.map(violation => [violation.elementIds[0], violation.severity])
    );
    expect(byElement).toEqual({ n1: 'audit', n2: 'warning' });
  });

  it('ignores a profile id belonging to another framework', () => {
    // A stale id left behind by a paste must never silence a rule.
    const foreign: ValidationProfile = {
      id: 'other.strict',
      framework: 'other',
      labelKey: 'com.labre.other.profile.strict',
      rules: { [RULE.id]: 'off' },
    };
    const violations = evaluateRules(
      [RULE],
      [frame('bg', foreign.id), outside('n1')],
      [...PROFILES, foreign]
    );

    expect(violations).toHaveLength(1);
    // Falls back to its OWN framework's default, not to the foreign entry.
    expect(violations[0].severity).toBe('audit');
  });

  it('falls back to the default when the id names nothing', () => {
    const violations = evaluateRules(
      [RULE],
      [frame('bg', 'test.profile-from-the-future'), outside('n1')],
      PROFILES
    );

    expect(violations[0].severity).toBe('audit');
  });
});

describe('changing profile touches nothing else', () => {
  it('keeps a user exception across a change of profile', () => {
    const exceptions: ValidationException[] = [{ ruleId: RULE.id, at: 1 }];
    const permissive = evaluateRules(
      [RULE],
      [frame(), outside('n1', 5000, exceptions)],
      PROFILES
    );
    const strict = evaluateRules(
      [RULE],
      [frame('bg', STRICT.id), outside('n1', 5000, exceptions)],
      PROFILES
    );

    // A level of requirement is not an amnesty and not a purge: the
    // arbitration survives in both directions (PF9.3).
    expect(permissive[0].exemption).toBe('element');
    expect(strict[0].exemption).toBe('element');
    expect(strict[0].severity).toBe('warning');
  });
});

describe('default resolution', () => {
  it('picks the flagged profile', () => {
    expect(defaultProfileOf(PROFILES, 'test')).toBe(PERMISSIVE);
  });

  it('falls back to the first registered when nothing is flagged', () => {
    // A framework that forgot the flag still resolves, rather than silently
    // losing every profile it ships.
    expect(defaultProfileOf([STRICT, DISABLED], 'test')).toBe(STRICT);
  });

  it('knows nothing about a framework that ships none', () => {
    expect(defaultProfileOf(PROFILES, 'other')).toBeUndefined();
  });
});

describe('profileSeverity', () => {
  it('reads own keys only', () => {
    // `rules` is an object literal shipped by a framework: a rule id that
    // happens to collide with something on Object.prototype must not resolve.
    const rule: ValidationRule = { ...RULE, id: 'constructor' };

    expect(profileSeverity(rule, PERMISSIVE)).toBe(rule.severity);
  });

  it('answers the rule’s own severity with no profile', () => {
    expect(profileSeverity(RULE, undefined)).toBe('warning');
  });
});
