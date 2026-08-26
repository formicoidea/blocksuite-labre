import { describe, expect, it } from 'vitest';

import { CONTEXT_MAP_NUDGES } from '../nudges';
import { CONTEXT_MAP_PROFILES } from '../profiles';
import { CONTEXT_MAP_RULES } from '../rules';

describe('context map validation profiles', () => {
  it('ships exactly two, with one default', () => {
    expect(CONTEXT_MAP_PROFILES.map(p => p.id)).toEqual([
      'context-map.sketch',
      'context-map.strict',
    ]);
    const defaults = CONTEXT_MAP_PROFILES.filter(p => p.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe('context-map.sketch');
  });

  it('spells out every rule in every profile', () => {
    const ruleIds = CONTEXT_MAP_RULES.map(rule => rule.id).sort();
    for (const profile of CONTEXT_MAP_PROFILES) {
      expect(profile.framework).toBe('ddd-context-map');
      expect(profile.labelKey).toMatch(/^com\.labre\./);
      expect(Object.keys(profile.rules).sort(), profile.id).toEqual(ruleIds);
    }
  });

  it('silences the whole pack on the sketch profile', () => {
    const sketch = CONTEXT_MAP_PROFILES[0];
    expect(Object.values(sketch.rules).every(s => s === 'audit')).toBe(true);
  });

  it('leaves the ACL-on-C/S question an audit even in strict', () => {
    // Not a softer contradiction — a different kind of statement. See
    // `profiles.ts`.
    const strict = CONTEXT_MAP_PROFILES[1];
    expect(strict.rules['context-map.acl-on-customer-supplier']).toBe('audit');
    expect(strict.rules['context-map.relationship-endpoints']).toBe('warning');
  });

  it('declares no level the pipework cannot honour', () => {
    for (const profile of CONTEXT_MAP_PROFILES) {
      for (const severity of Object.values(profile.rules)) {
        expect(severity).not.toBe('blocking-overridable');
      }
    }
  });
});

describe('context map quality nudges', () => {
  it('ships four, namespaced, ordered and worded', () => {
    expect(CONTEXT_MAP_NUDGES).toHaveLength(4);
    expect(CONTEXT_MAP_NUDGES.map(n => n.order)).toEqual([1, 2, 3, 4]);
    for (const nudge of CONTEXT_MAP_NUDGES) {
      expect(nudge.framework).toBe('ddd-context-map');
      expect(nudge.id.startsWith('context-map.')).toBe(true);
      expect(nudge.labelKey).toMatch(/^com\.labre\./);
      expect(nudge.fallback).toBeTruthy();
    }
  });

  it('does not restate a rule as a nudge', () => {
    const ruleIds = new Set(CONTEXT_MAP_RULES.map(rule => rule.id));
    for (const nudge of CONTEXT_MAP_NUDGES) {
      expect(ruleIds.has(nudge.id)).toBe(false);
    }
  });
});
