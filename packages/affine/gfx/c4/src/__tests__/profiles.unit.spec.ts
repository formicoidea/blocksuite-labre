import { collectTranslationKeys } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { C4_PROFILES } from '../profiles';
import { C4_RULES } from '../rules';
import { c4TranslationEntries } from '../translations';

/**
 * The two levels of requirement, as DATA — the same spec `bpmn` and
 * `ddd-context-map` ship for their own pairs, on the same questions: are both
 * tables total over the rule pack, is exactly one of them the default, does
 * either declare a level the pipework cannot honour, and can a host translate
 * every word either of them can put on screen.
 *
 * Totality is the one worth the file. A profile is an OVERRIDE table and a rule
 * absent from it keeps its own severity, so a partial profile still works — it
 * just answers a different question from the one its name promises, and nobody
 * would see the difference until a user asked why a rule they promoted is still
 * silent.
 */

/**
 * The nine `strict` promotes.
 *
 * Named for what the PROFILE does, not for where the rules come from, and the
 * two are deliberately not the same partition — a coincidence of arithmetic
 * makes both 9/5, which is exactly why the constant must not be called
 * `CHECKLIST`. Seven of these restate a checklist question; `c4.untyped-link`
 * and `c4.relationship-self-loop` are OURS and are promoted anyway, because
 * neither has a reading under which the diagram meant it. Meanwhile the three
 * isolation rules DO come from the checklist and are not promoted, because they
 * report unfinished work. Provenance and severity are orthogonal — see
 * `profiles.ts`.
 */
const PROMOTED = [
  'c4.unlabeled-relationship',
  'c4.unnamed-person',
  'c4.unnamed-system',
  'c4.unnamed-container',
  'c4.unnamed-component',
  'c4.untyped-link',
  'c4.relationship-endpoints',
  'c4.relationship-self-loop',
  'c4.homeless-component',
];

/** The five that stay an audit at every level — unfinished work, or our idioms. */
const PANEL_ONLY = [
  'c4.isolated-system',
  'c4.isolated-container',
  'c4.isolated-component',
  'c4.database-initiates',
  'c4.person-in-boundary',
];

describe('C4 validation profiles', () => {
  it('ships exactly two, with one default', () => {
    expect(C4_PROFILES.map(profile => profile.id)).toEqual([
      'c4.sketch',
      'c4.strict',
    ]);
    const defaults = C4_PROFILES.filter(profile => profile.isDefault);
    expect(defaults).toHaveLength(1);
    // The croquis wins (PRD principle 3), and being the default is also what
    // makes it write nothing on a board.
    expect(defaults[0].id).toBe('c4.sketch');
  });

  it('spells out every rule in every profile', () => {
    const ruleIds = C4_RULES.map(rule => rule.id).sort();
    expect(ruleIds).toHaveLength(14);
    for (const profile of C4_PROFILES) {
      expect(profile.framework).toBe('c4');
      expect(profile.labelKey).toMatch(/^com\.labre\.c4\.profile\./);
      expect(profile.fallback).toBeTruthy();
      expect(Object.keys(profile.rules).sort(), profile.id).toEqual(ruleIds);
    }
  });

  it('silences the whole pack on the sketch profile', () => {
    const [sketch] = C4_PROFILES;
    expect(
      Object.values(sketch.rules).every(severity => severity === 'audit')
    ).toBe(true);
    // ...which is also each rule's OWN severity, so the default profile changes
    // nothing and a board carrying no profile key behaves identically.
    for (const rule of C4_RULES) {
      expect(sketch.rules[rule.id], rule.id).toBe(rule.severity);
    }
  });

  it('promotes the nine on the strict profile', () => {
    const [, strict] = C4_PROFILES;
    expect(PROMOTED).toHaveLength(9);
    for (const id of PROMOTED) {
      expect(strict.rules[id], id).toBe('warning');
    }
  });

  it('keeps the panel-only rules an audit at BOTH levels', () => {
    // Three report a diagram that is UNFINISHED (a box whose author has not got
    // to the arrows yet); the other two are OURS rather than the checklist's —
    // idioms of the notation, not requirements of it. See `profiles.ts`.
    expect(PANEL_ONLY).toHaveLength(5);
    for (const id of PANEL_ONLY) {
      for (const profile of C4_PROFILES) {
        expect(profile.rules[id], `${profile.id}/${id}`).toBe('audit');
      }
    }
    // ...and the two lists together are the whole pack, so a rule added later
    // cannot slip past this spec by belonging to neither.
    expect([...PROMOTED, ...PANEL_ONLY].sort()).toEqual(
      C4_RULES.map(rule => rule.id).sort()
    );
  });

  it('declares no level the pipework cannot honour', () => {
    // `blocking-overridable` is carried by the engine and acted on by nobody: no
    // gesture is refused anywhere in this library. Unlike BPMN, C4 has no rule
    // that would move there the day refusal lands — a review checklist is a set
    // of questions asked of a finished drawing, not a grammar.
    for (const profile of C4_PROFILES) {
      for (const severity of Object.values(profile.rules)) {
        expect(severity).not.toBe('blocking-overridable');
      }
    }
  });

  it('turns nothing OFF, at either level', () => {
    // `'off'` takes a rule out of the evaluation entirely. Neither level wants
    // that: the sketch still COLLECTS, which is what makes switching to the
    // checklist instant rather than a re-derivation.
    for (const profile of C4_PROFILES) {
      for (const [id, severity] of Object.entries(profile.rules)) {
        expect(severity, `${profile.id}/${id}`).not.toBe('off');
      }
    }
  });
});

describe('what a host has to be able to translate', () => {
  const keys = new Set(c4TranslationEntries.map(entry => entry.key));

  it('names every rule key the pack can put on screen', () => {
    // Derived, never restated: the manifest walks the declarations themselves,
    // and this is what proves the walk reaches the new lists.
    for (const entry of collectTranslationKeys('rule', C4_RULES)) {
      expect(keys.has(entry.key), entry.key).toBe(true);
    }
    for (const entry of collectTranslationKeys('profile', C4_PROFILES)) {
      expect(keys.has(entry.key), entry.key).toBe(true);
    }
  });

  it('carries an English fallback for every rule sentence', () => {
    // A host with no catalogue reads a sentence rather than a dotted key.
    for (const entry of collectTranslationKeys('rule', C4_RULES)) {
      if (!entry.key.startsWith('com.labre.c4.validation.')) continue;
      expect(entry.fallback, entry.key).toBeTruthy();
    }
  });

  it('reports each key under the source it actually comes from', () => {
    // The rules carry the role vocabulary and the boundary declaration, so the
    // walk reaches keys those lists already named. `mergeTranslationEntries`
    // keeps the FIRST occurrence, and `translations.ts` orders the groups so
    // that first occurrence is the honest one.
    const sourceOf = new Map(
      c4TranslationEntries.map(entry => [entry.key, entry.source])
    );
    expect(sourceOf.get('com.labre.c4.role.person')).toBe('role');
    expect(sourceOf.get('com.labre.c4.profile.sketch')).toBe('profile');
    expect(sourceOf.get('com.labre.c4.validation.untyped-link')).toBe('rule');
  });
});
