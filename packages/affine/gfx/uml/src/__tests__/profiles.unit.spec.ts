import { collectTranslationKeys } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { UML_PROFILES } from '../profiles.js';
import { UML_RULES } from '../rules.js';
import { umlTranslationEntries } from '../translations.js';

/**
 * The two levels of requirement, as DATA — the same spec `bpmn`, `c4` and
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
 * The thirty-three `uml.strict` promotes.
 *
 * Eight restate a normative clause (§9.9.7 twice, §10.4.3, §18.1.3 twice,
 * §19.2.3, §19.3.3, §19.4.3), three are the NAMING rules, six are the SPELLING
 * ones (§9.5.4, §9.6.4, §14.2.4.8, §7.5.4, §17.4.4, §17.3.4), three are the
 * behaviour sheets' MEMBERSHIP rules, one is §11.5.3's
 * arithmetic, one is the sheet's own declaration and one is §11.3.4's
 * PLACEMENT. Named for what the PROFILE
 * does and not for where the rules come from: `uml.dependency-on-object` and
 * `uml.actor-actor-association` also cite the specification and are NOT
 * promoted, which is the whole reason the constant cannot be called
 * `SPECIFICATION`.
 */
const PROMOTED = [
  'uml.generalization-endpoints',
  'uml.generalization-self-loop',
  'uml.realization-endpoints',
  'uml.include-endpoints',
  'uml.extend-endpoints',
  'uml.deploy-endpoints',
  'uml.manifest-endpoints',
  'uml.communication-path-endpoints',
  'uml.unnamed-classifier',
  'uml.unnamed-actor-or-use-case',
  'uml.composition-single-owner',
  'uml.not-admissible-on-kind',
  // The behaviour sheets' arithmetic (§15.3.3, §15.7.19.4, §15.7.11.4,
  // §14.5.11.4), their two grammars (§15.7.9.4, §14.5.12) and the count of
  // beginnings — which is a `recommendation` and promoted anyway, so this list
  // still cannot be called SPECIFICATION.
  'uml.initial-no-incoming-flow',
  'uml.initial-no-incoming-transition',
  'uml.activity-final-no-outgoing',
  'uml.flow-final-no-outgoing',
  'uml.final-state-no-outgoing',
  'uml.decision-incoming-count',
  'uml.control-flow-endpoints',
  'uml.transition-endpoints',
  'uml.initial-single',
  // ...and the four SPELLING rules (ADR 0021), which the EXPORTER corroborates:
  // each fires exactly when the lenient grammar lost something the author wrote.
  'uml.attribute-syntax',
  'uml.operation-syntax',
  'uml.transition-syntax',
  'uml.multiplicity-syntax',
  // ...and the SEQUENCE sheet's two, which are one more of each: an endpoint
  // grammar (§17.4.4 on what a delete message must end in) and a fifth spelling
  // rule (§17.4.4's two label productions).
  'uml.message-endpoints',
  'uml.message-syntax',
  // ...and the LIFELINE's own two, which are a third naming rule and a sixth
  // spelling one. Both are written on `uml:lifeline-ident` — the tier §17.3.4's
  // head got to itself — so neither can be reached by a rule about an actor's
  // word, which is the whole reason the role exists (`roles.ts`).
  'uml.unnamed-lifeline',
  'uml.lifeline-ident-syntax',
  // ...and the behaviour sheets' three MEMBERSHIP rules (PO, 2026-09-16). A
  // history pseudostate outside every region and an action outside every
  // partition are glyphs whose whole meaning is the container they sit in —
  // unlike a class parked beside its frame, which still reads as that class.
  'uml.node-in-partition',
  'uml.shallow-history-outside-region',
  'uml.deep-history-outside-region',
  // ...and §11.3.4's PLACEMENT, the pack's one `border-proximity` rule (ADR
  // 0024) and the promotion the PO asked for by name on the same recette. The
  // one geometric rule this level hardens: the class-side membership three below
  // each have a second reading under which the author is right, and a port in
  // the middle of its component has none.
  'uml.port-on-border',
];

/**
 * The ten that stay an audit at every level — membership on the class side, and
 * remarks.
 *
 * `uml.object-flow-endpoints` is the one worth pausing on: it is an ENDPOINT
 * rule and every other one is promoted. §15.4.4 lets an action's pins be
 * elided, a pin IS an ObjectNode, and this canvas has no pin — so the
 * action-to-action drawing is a legal shorthand and hardening it would hold an
 * author to something they cannot draw.
 */
const PANEL_ONLY = [
  'uml.element-outside-frame',
  'uml.use-case-outside-subject',
  'uml.actor-inside-subject',
  'uml.dependency-on-object',
  'uml.actor-actor-association',
  'uml.untyped-edge',
  'uml.use-case-no-actor',
  'uml.object-flow-endpoints',
  'uml.unreachable-action',
  'uml.unreachable-state',
];

describe('UML validation profiles', () => {
  it('ships exactly two, with one default', () => {
    expect(UML_PROFILES.map(profile => profile.id)).toEqual([
      'uml.sketch',
      'uml.strict',
    ]);
    const defaults = UML_PROFILES.filter(profile => profile.isDefault);
    expect(defaults).toHaveLength(1);
    // The croquis wins (PRD principle 3), and being the default is also what
    // makes it write nothing on a frame.
    expect(defaults[0].id).toBe('uml.sketch');
  });

  it('spells out every rule in every profile', () => {
    const ruleIds = UML_RULES.map(rule => rule.id).sort();
    expect(ruleIds).toHaveLength(43);
    for (const profile of UML_PROFILES) {
      expect(profile.framework).toBe('uml');
      expect(profile.labelKey).toMatch(/^com\.labre\.uml\.profile\./);
      expect(profile.fallback).toBeTruthy();
      expect(Object.keys(profile.rules).sort(), profile.id).toEqual(ruleIds);
    }
  });

  it('is the MOST PERMISSIVE level that is the default', () => {
    const [sketch, strict] = UML_PROFILES;
    expect(
      Object.values(sketch.rules).every(severity => severity === 'audit')
    ).toBe(true);
    // ...which is also each rule's OWN severity, so the default profile changes
    // nothing and a frame carrying no profile key behaves identically.
    for (const rule of UML_RULES) {
      expect(sketch.rules[rule.id], rule.id).toBe(rule.severity);
    }
    // ...and the other level only ever PROMOTES: not one rule is quieter under
    // strict than under the default.
    const rank = { off: 0, audit: 1, warning: 2, 'blocking-overridable': 3 };
    for (const rule of UML_RULES) {
      expect(
        rank[strict.rules[rule.id] as keyof typeof rank],
        rule.id
      ).toBeGreaterThanOrEqual(
        rank[sketch.rules[rule.id] as keyof typeof rank]
      );
    }
  });

  it('promotes the thirty-three on the strict profile', () => {
    const [, strict] = UML_PROFILES;
    expect(PROMOTED).toHaveLength(33);
    for (const id of PROMOTED) {
      expect(strict.rules[id], id).toBe('warning');
    }
  });

  it('keeps the panel-only rules an audit at BOTH levels', () => {
    expect(PANEL_ONLY).toHaveLength(10);
    for (const id of PANEL_ONLY) {
      for (const profile of UML_PROFILES) {
        expect(profile.rules[id], `${profile.id}/${id}`).toBe('audit');
      }
    }
    // ...and the two lists together are the whole pack, so a rule added later
    // cannot slip past this spec by belonging to neither.
    expect([...PROMOTED, ...PANEL_ONLY].sort()).toEqual(
      UML_RULES.map(rule => rule.id).sort()
    );
  });

  it('declares no level the pipework cannot honour', () => {
    // `blocking-overridable` is carried by the engine and acted on by nobody: no
    // gesture is refused anywhere in this library.
    for (const profile of UML_PROFILES) {
      for (const severity of Object.values(profile.rules)) {
        expect(severity).not.toBe('blocking-overridable');
      }
    }
  });

  it('turns nothing OFF, at either level', () => {
    // `'off'` takes a rule out of the evaluation entirely. Neither level wants
    // that: the sketch still COLLECTS, which is what makes switching to the
    // specification level instant rather than a re-derivation.
    for (const profile of UML_PROFILES) {
      for (const [id, severity] of Object.entries(profile.rules)) {
        expect(severity, `${profile.id}/${id}`).not.toBe('off');
      }
    }
  });
});

describe('what a host has to be able to translate', () => {
  const keys = new Set(umlTranslationEntries.map(entry => entry.key));

  it('names every rule and profile key the pack can put on screen', () => {
    // Derived, never restated: the manifest walks the declarations themselves,
    // and this is what proves the walk reaches the two new lists.
    for (const entry of collectTranslationKeys('rule', UML_RULES)) {
      expect(keys.has(entry.key), entry.key).toBe(true);
    }
    for (const entry of collectTranslationKeys('profile', UML_PROFILES)) {
      expect(keys.has(entry.key), entry.key).toBe(true);
    }
  });

  it('carries an English fallback for every rule sentence', () => {
    // A host with no catalogue reads a sentence rather than a dotted key.
    for (const entry of collectTranslationKeys('rule', UML_RULES)) {
      if (!entry.key.startsWith('com.labre.uml.validation.')) continue;
      expect(entry.fallback, entry.key).toBeTruthy();
    }
  });

  it('reports each key under the source it actually comes from', () => {
    // The rules carry the role vocabulary and the subject declaration, so the
    // walk reaches keys those lists already named. `mergeTranslationEntries`
    // keeps the FIRST occurrence, and `translations.ts` orders the groups so
    // that first occurrence is the honest one.
    const sourceOf = new Map(
      umlTranslationEntries.map(entry => [entry.key, entry.source])
    );
    expect(sourceOf.get('com.labre.uml.role.class')).toBe('role');
    expect(sourceOf.get('com.labre.uml.profile.sketch')).toBe('profile');
    expect(sourceOf.get('com.labre.uml.validation.untyped-edge')).toBe('rule');
    // The kind picker's words stay filed with the frame declarations: `kind` is
    // a prop of the diagram frame, and these name its values.
    expect(sourceOf.get('com.labre.uml.kind.class')).toBe('background');
  });
});
