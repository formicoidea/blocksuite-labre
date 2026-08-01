import {
  defaultProfileOf,
  evaluateRules,
  userFacingViolations,
} from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { WARDLEY_PROFILES } from '../profiles';
import { WARDLEY_ROLE } from '../roles';
import { WARDLEY_RULES } from '../rules';

/**
 * The Wardley profiles as DATA (PF9.2): what the framework actually ships, and
 * what each level does to the pilot rule.
 */

function element(
  id: string,
  xywh: [number, number, number, number],
  role?: string,
  validationProfile?: string
): GfxPrimitiveElementModel {
  return {
    id,
    type: 'wardley',
    role,
    validationProfile,
    get elementBound() {
      return new Bound(...xywh);
    },
  } as unknown as GfxPrimitiveElementModel;
}

const map = (profile?: string) =>
  element('bg', [0, 0, 1600, 900], WARDLEY_ROLE.map, profile);

const offMap = () =>
  element('c1', [3000, 3000, 40, 40], WARDLEY_ROLE.component);

const evaluate = (profile?: string) =>
  evaluateRules([...WARDLEY_RULES], [map(profile), offMap()], WARDLEY_PROFILES);

describe('what Wardley ships', () => {
  it('exposes a permissive and a strict level', () => {
    expect(WARDLEY_PROFILES.map(profile => profile.id)).toEqual([
      'wardley.sketch',
      'wardley.strict',
    ]);
  });

  it('namespaces every profile by its framework', () => {
    for (const profile of WARDLEY_PROFILES) {
      expect(profile.framework).toBe('wardley');
      expect(profile.id.startsWith('wardley.')).toBe(true);
      expect(profile.labelKey).toMatch(/^com\.labre\./);
    }
  });

  it('makes the permissive one the default — the sketch wins', () => {
    expect(defaultProfileOf(WARDLEY_PROFILES, 'wardley')?.id).toBe(
      'wardley.sketch'
    );
    // Exactly one, or "the default" would depend on registration order.
    expect(WARDLEY_PROFILES.filter(profile => profile.isDefault)).toHaveLength(1);
  });

  it('never names a rule the framework does not ship', () => {
    // Profiles are data and a typo in a rule id would silently do nothing at
    // all — no error, no effect, just a level of requirement that lies.
    const known = new Set(WARDLEY_RULES.map(rule => rule.id));
    for (const profile of WARDLEY_PROFILES) {
      for (const ruleId of Object.keys(profile.rules)) {
        expect(known).toContain(ruleId);
      }
    }
  });

  it('never blocks, at any level', () => {
    // Strict is a level of attention, not a wall (PRD principle 3).
    for (const profile of WARDLEY_PROFILES) {
      for (const severity of Object.values(profile.rules)) {
        expect(severity).not.toBe('blocking-overridable');
      }
    }
  });
});

describe('the permissive default', () => {
  it('demotes the pilot rule to audit', () => {
    const [violation] = evaluate();

    expect(violation.severity).toBe('audit');
  });

  it('leaves nothing on the canvas', () => {
    // `audit` is collected, never drawn: the drawing user is not interrupted.
    expect(userFacingViolations(evaluate())).toEqual([]);
  });

  it('still reports the finding to the engine seam', () => {
    // A host panel and a conformance report see it; only the canvas does not.
    expect(evaluate().map(violation => violation.ruleId)).toEqual([
      'wardley.component-outside-map',
    ]);
  });

  it('is what a map authored before profiles existed gets', () => {
    // No profile key on the background, no migration, no backfill.
    expect(evaluate(undefined)).toEqual(evaluate('wardley.sketch'));
  });
});

describe('the strict profile', () => {
  it('puts the pilot rule back on warning', () => {
    const [violation] = evaluate('wardley.strict');

    expect(violation.severity).toBe('warning');
  });

  it('shows it on the canvas', () => {
    expect(userFacingViolations(evaluate('wardley.strict'))).toHaveLength(1);
  });
});
