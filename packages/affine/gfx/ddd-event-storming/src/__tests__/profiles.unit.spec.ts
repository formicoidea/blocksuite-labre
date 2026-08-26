import type { ValidationProfile } from '@labre/affine-block-surface';
import { describe, expect, it } from 'vitest';

import { EVENT_STORMING_NUDGES } from '../nudges';
import { EVENT_STORMING_PROFILES } from '../profiles';
import { EVENT_STORMING_RULES } from '../rules';

const warnings = (profile: ValidationProfile) =>
  Object.values(profile.rules).filter(severity => severity === 'warning').length;

describe('event storming validation profiles', () => {
  it('ships exactly three, with one default', () => {
    // Three because Event Storming is not one activity but a sequence of
    // three, and the same wall means something different at each stage.
    expect(EVENT_STORMING_PROFILES.map(p => p.id)).toEqual([
      'es.sketch',
      'es.process',
      'es.design',
    ]);
    const defaults = EVENT_STORMING_PROFILES.filter(p => p.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe('es.sketch');
  });

  it('spells out every rule in every profile', () => {
    const ruleIds = EVENT_STORMING_RULES.map(rule => rule.id).sort();
    for (const profile of EVENT_STORMING_PROFILES) {
      expect(profile.framework).toBe('ddd-event-storming');
      expect(profile.labelKey).toMatch(
        /^com\.labre\.event-storming\.profile\./
      );
      expect(profile.fallback).toBeTruthy();
      expect(Object.keys(profile.rules).sort(), profile.id).toEqual(ruleIds);
    }
  });

  it('silences the whole pack on the Big Picture', () => {
    // The default, and deliberately so: a Big Picture is SUPPOSED to be
    // chaotic — that is the method, not a failure of it.
    const [sketch] = EVENT_STORMING_PROFILES;
    expect(Object.values(sketch.rules).every(s => s === 'audit')).toBe(true);
  });

  it('names the default in both vocabularies', () => {
    // PO recette, 26/08/2026: the dropdown carries the word the workshop uses
    // for the stage AND the word every framework here uses for its quietest
    // level, so neither reader has to learn the other's name for it.
    const [sketch] = EVENT_STORMING_PROFILES;
    expect(sketch.fallback).toBe('Big Picture (Sketch)');
  });

  it('promotes the timeline, and only the timeline, on process modelling', () => {
    const [, process] = EVENT_STORMING_PROFILES;
    expect(process.rules['es.against-timeline']).toBe('warning');
    expect(process.rules['es.forbidden-arc']).toBe('audit');
    expect(process.rules['es.overlapping-stickies']).toBe('audit');
  });

  it('promotes everything on software design', () => {
    const [, , design] = EVENT_STORMING_PROFILES;
    expect(Object.values(design.rules).every(s => s === 'warning')).toBe(true);
  });

  it('is a gradation: sketch < process < design', () => {
    const [sketch, process, design] = EVENT_STORMING_PROFILES;
    expect(warnings(sketch)).toBe(0);
    expect(warnings(process)).toBe(1);
    expect(warnings(design)).toBe(EVENT_STORMING_RULES.length);
    // No rule is ever demoted as the requirement rises.
    for (const rule of EVENT_STORMING_RULES) {
      const ladder = EVENT_STORMING_PROFILES.map(p => p.rules[rule.id]);
      const firstWarning = ladder.indexOf('warning');
      if (firstWarning < 0) continue;
      expect(ladder.slice(firstWarning).every(s => s === 'warning'), rule.id)
        .toBe(true);
    }
  });

  it('declares no level the pipework cannot honour', () => {
    for (const profile of EVENT_STORMING_PROFILES) {
      for (const severity of Object.values(profile.rules)) {
        expect(severity).not.toBe('blocking-overridable');
      }
    }
  });
});

describe('event storming quality nudges', () => {
  it('ships five, namespaced, ordered and worded', () => {
    expect(EVENT_STORMING_NUDGES).toHaveLength(5);
    expect(EVENT_STORMING_NUDGES.map(n => n.order)).toEqual([1, 2, 3, 4, 5]);
    for (const nudge of EVENT_STORMING_NUDGES) {
      expect(nudge.framework).toBe('ddd-event-storming');
      expect(nudge.id.startsWith('es.q')).toBe(true);
      expect(nudge.labelKey).toMatch(/^com\.labre\./);
      expect(nudge.fallback).toBeTruthy();
    }
  });

  it('is where the past tense lives', () => {
    // The most tempting rule in the plan, and a nudge by PO arbitration: a
    // regular expression over marker-pen prose would be wrong every fifth
    // sticky, and a validation platform gets one chance to be wrong.
    const past = EVENT_STORMING_NUDGES.find(
      n => n.id === 'es.q1-events-past-tense'
    );
    expect(past?.fallback).toMatch(/past tense/i);
    expect(EVENT_STORMING_RULES.some(r => r.id.includes('past'))).toBe(false);
  });

  it('does not restate a rule as a nudge', () => {
    const ruleIds = new Set(EVENT_STORMING_RULES.map(rule => rule.id));
    for (const nudge of EVENT_STORMING_NUDGES) {
      expect(ruleIds.has(nudge.id)).toBe(false);
    }
  });
});
