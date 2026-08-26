import { describe, expect, it } from 'vitest';

import { CORE_DOMAIN_NUDGES } from '../nudges';
import { CORE_DOMAIN_PROFILES } from '../profiles';
import { CORE_DOMAIN_RULES } from '../rules';

describe('the Core Domain profiles', () => {
  it('offers exactly one default', () => {
    // The default is the profile that WRITES NOTHING, so a chart drawn before
    // profiles existed is on it — two defaults would make that undecidable.
    expect(CORE_DOMAIN_PROFILES.filter(p => p.isDefault)).toHaveLength(1);
    expect(CORE_DOMAIN_PROFILES.find(p => p.isDefault)?.id).toBe(
      'core-domain.sketch'
    );
  });

  it('spells out every rule, in every profile', () => {
    const rules = CORE_DOMAIN_RULES.map(r => r.id).sort();
    for (const profile of CORE_DOMAIN_PROFILES) {
      expect(Object.keys(profile.rules).sort()).toEqual(rules);
      expect(profile.framework).toBe('core-domain');
    }
  });

  it('never promotes a rule past what the library implements', () => {
    for (const profile of CORE_DOMAIN_PROFILES) {
      for (const severity of Object.values(profile.rules)) {
        expect(['warning', 'audit']).toContain(severity);
      }
    }
  });

  it('silences the canvas on the sketch and bites on the strict one', () => {
    const sketch = CORE_DOMAIN_PROFILES.find(
      p => p.id === 'core-domain.sketch'
    );
    const strict = CORE_DOMAIN_PROFILES.find(
      p => p.id === 'core-domain.strict'
    );

    expect(Object.values(sketch!.rules).every(s => s === 'audit')).toBe(true);
    expect(strict!.rules['core-domain.outsourced-core']).toBe('warning');
    expect(strict!.rules['core-domain.malformed-movement']).toBe('warning');
    expect(strict!.rules['core-domain.overlapping-artefacts']).toBe('warning');
    // The one deliberate asymmetry: a colour is a notation question, answered
    // when the chart is read back rather than while it is drawn.
    expect(strict!.rules['core-domain.off-legend-colour']).toBe('audit');
  });
});

describe('the work-quality checklist', () => {
  it('offers three ordered, framework-owned nudges', () => {
    expect(CORE_DOMAIN_NUDGES.map(n => n.id)).toEqual([
      'core-domain.q1-legend',
      'core-domain.q2-movements',
      'core-domain.q3-core-agreed',
    ]);
    expect(CORE_DOMAIN_NUDGES.map(n => n.order)).toEqual([1, 2, 3]);
    for (const nudge of CORE_DOMAIN_NUDGES) {
      expect(nudge.framework).toBe('core-domain');
      // Both halves: the key for a host with a catalogue, the wording for one
      // without. The library never invents prose and never hides it either.
      expect(nudge.labelKey).toMatch(/^com\.labre\.core-domain\.quality\./);
      expect(nudge.fallback).toBeTruthy();
    }
  });
});
