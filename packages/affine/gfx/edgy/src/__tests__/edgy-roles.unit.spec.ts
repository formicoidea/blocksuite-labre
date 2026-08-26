import { roleIsA } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { EDGY_DYNAMIC_NODES, EDGY_DYNAMIC_RELATIONS } from '../metamodel';
import { EDGY_NUDGES } from '../nudges';
import { EDGY_PROFILES } from '../profiles';
import { EDGY_ROLE, EDGY_ROLES, EDGY_VERB_ROLE } from '../roles';
import { EDGY_ALLOWED_RELATIONS, EDGY_RULES } from '../rules';

/**
 * The vocabulary and the metamodel must not be able to drift apart: everything
 * below either walks the declared hierarchy or compares a derived table with
 * the one table it is derived from.
 */

describe('EDGY role vocabulary', () => {
  it('gives every canonical verb an edge role under edgy:relation', () => {
    const verbs = new Set(EDGY_DYNAMIC_RELATIONS.map(([, , verb]) => verb));
    // 24 relations, 22 verbs: `requires` is spoken of three different pairs.
    expect(verbs.size).toBe(22);

    for (const verb of verbs) {
      const id = EDGY_VERB_ROLE[verb];
      expect(id, `no role for the verb "${verb}"`).toBeDefined();
      const def = EDGY_ROLES[id];
      expect(def, `no def for ${id}`).toBeDefined();
      expect(def.kind).toBe('edge');
      expect(def.parent).toBe(EDGY_ROLE.relation);
      // Tier 1 of ADR 0010: an edge role states the verb it is read with.
      expect(def.direction?.verbFallback).toBe(verb);
      expect(def.direction?.verbKey).toBeTruthy();
      expect(roleIsA(id, EDGY_ROLE.relation, EDGY_ROLES)).toBe(true);
    }
  });

  it('walks each of the twelve elements up to its kind and to edgy:element', () => {
    for (const [name, { kind }] of Object.entries(EDGY_DYNAMIC_NODES)) {
      const id = EDGY_ROLE[name as keyof typeof EDGY_DYNAMIC_NODES];
      const def = EDGY_ROLES[id];
      expect(def, `no def for ${name}`).toBeDefined();
      expect(def.kind).toBe('node');
      // The parent is the OFFICIAL kind of the metamodel, not a guess.
      expect(def.parent).toBe(EDGY_ROLE[kind]);
      expect(roleIsA(id, EDGY_ROLE[kind], EDGY_ROLES)).toBe(true);
      expect(roleIsA(id, EDGY_ROLE.element, EDGY_ROLES)).toBe(true);
      // ...and not up to a kind it is not.
      const otherKinds = (['outcome', 'object', 'activity'] as const).filter(
        k => k !== kind
      );
      for (const other of otherKinds) {
        expect(roleIsA(id, EDGY_ROLE[other], EDGY_ROLES)).toBe(false);
      }
    }
  });

  it('roots the four persisted kinds on edgy:element', () => {
    for (const kind of ['people', 'outcome', 'object', 'activity'] as const) {
      expect(EDGY_ROLES[EDGY_ROLE[kind]].parent).toBe(EDGY_ROLE.element);
      expect(roleIsA(EDGY_ROLE[kind], EDGY_ROLE.element, EDGY_ROLES)).toBe(true);
    }
  });

  it('keeps the backgrounds OUT of the element subtree', () => {
    for (const frame of [EDGY_ROLE.facets, EDGY_ROLE.board]) {
      expect(EDGY_ROLES[frame].parent).toBe(EDGY_ROLE.background);
      expect(roleIsA(frame, EDGY_ROLE.background, EDGY_ROLES)).toBe(true);
      // The whole point: a rule written on the artefacts never matches the
      // board they are drawn on.
      expect(roleIsA(frame, EDGY_ROLE.element, EDGY_ROLES)).toBe(false);
    }
    expect(EDGY_ROLES[EDGY_ROLE.background].parent).toBeUndefined();
    expect(roleIsA(EDGY_ROLE.element, EDGY_ROLE.background, EDGY_ROLES)).toBe(
      false
    );
  });

  it('declares no role twice and namespaces every one of them', () => {
    for (const [id, def] of Object.entries(EDGY_ROLES)) {
      expect(id).toBe(def.id);
      expect(id.startsWith('edgy:')).toBe(true);
    }
    // 1 root + 4 kinds + 12 elements + 3 frames + 1 relation + 22 verbs.
    expect(Object.keys(EDGY_ROLES)).toHaveLength(43);
  });
});

describe('EDGY relation grammar', () => {
  it('derives exactly the 24 sanctioned sentences from the metamodel', () => {
    expect(EDGY_ALLOWED_RELATIONS).toHaveLength(
      EDGY_DYNAMIC_RELATIONS.length
    );
    const sentence = (t: { source: string; edge: string; target: string }) =>
      `${t.source} ${t.edge} ${t.target}`;
    expect(EDGY_ALLOWED_RELATIONS.map(sentence).sort()).toEqual(
      EDGY_DYNAMIC_RELATIONS.map(([source, target, verb]) =>
        [
          EDGY_ROLE[source as keyof typeof EDGY_DYNAMIC_NODES],
          EDGY_VERB_ROLE[verb],
          EDGY_ROLE[target as keyof typeof EDGY_DYNAMIC_NODES],
        ].join(' ')
      ).sort()
    );
  });

  it('names only declared roles in the matrix', () => {
    for (const triplet of EDGY_ALLOWED_RELATIONS) {
      for (const role of [triplet.source, triplet.edge, triplet.target]) {
        expect(EDGY_ROLES[role], `${role} is not declared`).toBeDefined();
      }
      // The three ends of a sentence: two elements and one relation.
      expect(roleIsA(triplet.source, EDGY_ROLE.element, EDGY_ROLES)).toBe(true);
      expect(roleIsA(triplet.target, EDGY_ROLE.element, EDGY_ROLES)).toBe(true);
      expect(roleIsA(triplet.edge, EDGY_ROLE.relation, EDGY_ROLES)).toBe(true);
    }
  });
});

describe('EDGY rules, profiles and nudges', () => {
  it('writes the grammar rule on the parent relation role', () => {
    const rule = EDGY_RULES.find(r => r.id === 'edgy.non-canonical-link');
    expect(rule).toBeDefined();
    expect(rule!.family).toBe('relation-endpoints');
    expect(rule!.severity).toBe('warning');
    expect(rule!.endpoints?.edgeRole).toBe(EDGY_ROLE.relation);
    expect(rule!.endpoints?.allowed).toBe(EDGY_ALLOWED_RELATIONS);
    // Attribution only — both frames answer for a finding.
    expect(rule!.backgroundRole).toBe(EDGY_ROLE.background);
    expect(rule!.background).toBeUndefined();
  });

  it('covers the whole element subtree with one overlap pair', () => {
    const rule = EDGY_RULES.find(r => r.id === 'edgy.overlapping-artefacts');
    expect(rule).toBeDefined();
    expect(rule!.family).toBe('no-overlap');
    expect(rule!.overlap).toEqual([[EDGY_ROLE.element, EDGY_ROLE.element]]);
    expect(rule!.minPenetration).toBe(4);
  });

  it('has exactly one default profile, covering every rule', () => {
    const defaults = EDGY_PROFILES.filter(p => p.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe('edgy.sketch');

    const ids = EDGY_RULES.map(r => r.id).sort();
    for (const profile of EDGY_PROFILES) {
      expect(profile.framework).toBe('edgy');
      expect(Object.keys(profile.rules).sort()).toEqual(ids);
    }
    expect(Object.values(EDGY_PROFILES[0].rules)).toEqual(['audit', 'audit']);
    expect(Object.values(EDGY_PROFILES[1].rules)).toEqual([
      'warning',
      'warning',
    ]);
  });

  it('ships four ordered nudges', () => {
    expect(EDGY_NUDGES.map(n => n.order)).toEqual([1, 2, 3, 4]);
    expect(new Set(EDGY_NUDGES.map(n => n.id)).size).toBe(4);
    for (const nudge of EDGY_NUDGES) {
      expect(nudge.framework).toBe('edgy');
      expect(nudge.labelKey.startsWith('com.labre.edgy.quality.')).toBe(true);
      expect(nudge.fallback).toBeTruthy();
    }
  });
});
