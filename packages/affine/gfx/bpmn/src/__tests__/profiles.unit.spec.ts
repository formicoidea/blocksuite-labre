import { describe, expect, it } from 'vitest';

import { BPMN_PROFILES } from '../profiles';
import { BPMN_RULES, BPMN_RULES_PENDING_ENGINE_V2 } from '../rules';

/** Every rule the pack has authored — registered or waiting on the engine. */
const ALL_RULES = [...BPMN_RULES, ...BPMN_RULES_PENDING_ENGINE_V2];

/**
 * The two levels of requirement, as DATA — the same spec `ddd-context-map` ships
 * for its own pair, on the same three questions: are they both total over the
 * rule pack, is exactly one of them the default, and does either of them declare
 * a level the pipework cannot honour.
 *
 * Totality is the one worth the file. A profile is an OVERRIDE table and a rule
 * absent from it keeps its own severity, so a profile that is silently partial
 * still works — it just answers a different question from the one its name
 * promises, and nobody would see the difference until a user asked why a rule
 * they switched off is still talking.
 */

describe('BPMN validation profiles', () => {
  it('ships exactly two, with one default', () => {
    expect(BPMN_PROFILES.map(p => p.id)).toEqual([
      'bpmn.sketch',
      'bpmn.descriptive',
    ]);
    const defaults = BPMN_PROFILES.filter(p => p.isDefault);
    expect(defaults).toHaveLength(1);
    // The sketch wins (PRD principle 3), and being the default is also what
    // makes it write nothing on a pool.
    expect(defaults[0].id).toBe('bpmn.sketch');
  });

  it('spells out every rule in every profile, registered or not', () => {
    // Twenty-one authored, thirteen registered. A profile is an override table
    // keyed by rule id, so the eight waiting on `claude/bpmn-engine-v2` are
    // inert entries — and having them written down is what keeps registering
    // those eight a one-line change.
    const ruleIds = ALL_RULES.map(rule => rule.id).sort();
    expect(ruleIds).toHaveLength(21);
    expect(BPMN_RULES).toHaveLength(13);
    expect(BPMN_RULES_PENDING_ENGINE_V2).toHaveLength(8);
    for (const profile of BPMN_PROFILES) {
      expect(profile.framework).toBe('bpmn');
      expect(profile.labelKey).toMatch(/^com\.labre\./);
      expect(profile.fallback).toBeTruthy();
      expect(Object.keys(profile.rules).sort(), profile.id).toEqual(ruleIds);
    }
  });

  it('silences the whole pack on the sketch profile', () => {
    const sketch = BPMN_PROFILES[0];
    expect(Object.values(sketch.rules).every(s => s === 'audit')).toBe(true);
  });

  it('holds every rule at its authored severity on the descriptive profile', () => {
    // The descriptive profile does not RE-DECIDE anything: it is the rules at
    // the severity each of them declares, written down in one place so a
    // reviewer can read the level instead of reading twenty-one files.
    const descriptive = BPMN_PROFILES[1];
    for (const rule of ALL_RULES) {
      expect(descriptive.rules[rule.id], rule.id).toBe(rule.severity);
    }
  });

  it('keeps the panel-only rules an audit at BOTH levels', () => {
    // Three of them report shapes BPMN 2.0.2 explicitly sanctions (p.151: an
    // activity may have no outgoing sequence flow, and may have several on
    // either side), so a warning would be the tool arguing with a house style
    // the standard allows. The other two report a diagram that is UNFINISHED
    // rather than wrong. All five are quieter than bpmnlint's level for the
    // same shape, deliberately — see `profiles.ts`.
    const panelOnly = [
      'bpmn.activity-dead-end',
      'bpmn.fake-join',
      'bpmn.implicit-split',
      'bpmn.single-blank-start',
      'bpmn.unlabeled-step',
    ];
    for (const id of panelOnly) {
      for (const profile of BPMN_PROFILES) {
        expect(profile.rules[id], `${profile.id}/${id}`).toBe('audit');
      }
      expect(ALL_RULES.find(rule => rule.id === id)?.severity, id).toBe(
        'audit'
      );
    }
    // ...and they are the ONLY ones: every other rule reads a normative
    // sentence of the standard, which is not a judgement call.
    const audits = ALL_RULES.filter(rule => rule.severity === 'audit');
    expect(audits.map(rule => rule.id).sort()).toEqual([...panelOnly].sort());
  });

  it('declares no level the pipework cannot honour', () => {
    // `blocking-overridable` is carried by the engine and acted on by nobody:
    // no gesture is refused anywhere in this library yet. Declaring it would be
    // data claiming an effect that does not exist — see `profiles.ts`. Several
    // of these rules read a normative MUST and would sit there the day a
    // gesture refusal lands.
    for (const profile of BPMN_PROFILES) {
      for (const severity of Object.values(profile.rules)) {
        expect(severity).not.toBe('blocking-overridable');
      }
    }
    for (const rule of ALL_RULES) {
      expect(['warning', 'audit'], rule.id).toContain(rule.severity);
    }
  });

  it('turns nothing OFF, at either level', () => {
    // `'off'` takes a rule out of the evaluation entirely. Neither level wants
    // that: the sketch still COLLECTS, which is what makes switching to the
    // descriptive profile instant rather than a re-derivation.
    for (const profile of BPMN_PROFILES) {
      for (const [id, severity] of Object.entries(profile.rules)) {
        expect(severity, `${profile.id}/${id}`).not.toBe('off');
      }
    }
  });
});

describe('what the framework ships as rules', () => {
  it('namespaces every rule and holds no prose in the engine', () => {
    for (const rule of ALL_RULES) {
      expect(rule.framework).toBe('bpmn');
      expect(rule.id.startsWith('bpmn.')).toBe(true);
      expect(rule.version).toBe(1);
      expect(rule.messageKey).toMatch(/^com\.labre\.bpmn\.rule\./);
      // A framework fallback, so a host with no catalogue reads a sentence
      // rather than a dotted key — the framework owns the word, not the engine.
      expect(rule.messageFallback, rule.id).toBeTruthy();
      expect(rule.suggestionKey, rule.id).toMatch(/^com\.labre\.bpmn\.rule\./);
      expect(rule.suggestionFallback, rule.id).toBeTruthy();
      // Every rule names the pool, so every finding lands on a participant and
      // a map-wide arbitration has somewhere to live.
      expect(rule.backgroundRole, rule.id).toBe('bpmn:pool');
    }
  });

  it('covers the six families the joints of a process are judged by', () => {
    const byFamily = new Map<string, string[]>();
    for (const rule of ALL_RULES) {
      byFamily.set(rule.family, [
        ...(byFamily.get(rule.family) ?? []),
        rule.id,
      ]);
    }
    expect([...byFamily.keys()].sort()).toEqual([
      'edge-degree',
      'edge-locality',
      // `claude/bpmn-engine-v2` adds this one; `bpmn.unlabeled-step` is the
      // only rule that names it, and it is not registered until it exists.
      'label-presence',
      'reachability',
      'relation-endpoints',
      'role-count',
    ]);
    expect(byFamily.get('relation-endpoints')).toHaveLength(5);
    expect(byFamily.get('edge-degree')).toHaveLength(9);
    expect(byFamily.get('edge-locality')).toHaveLength(2);
    expect(byFamily.get('role-count')).toHaveLength(3);
    expect(byFamily.get('reachability')).toHaveLength(1);
    expect(byFamily.get('label-presence')).toEqual(['bpmn.unlabeled-step']);
    // Every family a REGISTERED rule names is one the engine can evaluate.
    for (const rule of BPMN_RULES) {
      expect(rule.family, rule.id).not.toBe('label-presence');
    }
  });

  /**
   * The eight rules whose def field — or, for one of them, whose whole family
   * — `claude/bpmn-engine-v2` adds. Held out of
   * registration on purpose: an engine that ignores `ifPresent` reads the two
   * existence rules as the UNCONDITIONAL "every pool holds a start event" the
   * specification review removed, which would fire on a black-box pool (p.238 /
   * p.246). Shipping data that is wrong today on the promise of a future branch
   * is how a false positive reaches a user.
   */
  it('holds the eight engine-v2 rules out of the registered pack', () => {
    expect(BPMN_RULES_PENDING_ENGINE_V2.map(rule => rule.id)).toEqual([
      'bpmn.pool-end-without-start',
      'bpmn.pool-start-without-end',
      'bpmn.single-blank-start',
      'bpmn.gateway-must-branch',
      'bpmn.gateway-join-and-fork',
      'bpmn.fake-join',
      'bpmn.implicit-split',
      'bpmn.unlabeled-step',
    ]);
    const registered = new Set(BPMN_RULES.map(rule => rule.id));
    for (const rule of BPMN_RULES_PENDING_ENGINE_V2) {
      expect(registered.has(rule.id), rule.id).toBe(false);
    }
    // ...and the unconditional existence rules the review removed are gone for
    // good: a pool needs NEITHER event, only the pairing is normative.
    for (const id of ['bpmn.pool-without-start', 'bpmn.pool-without-end']) {
      expect(ALL_RULES.map(r => r.id)).not.toContain(id);
    }
  });

  it('pairs the two halves of every event requirement as separate rules', () => {
    // Two bounds fixed by opposite gestures are two sentences: one bracket
    // saying both would leave the user to work out which half they got wrong on
    // a symbol forty units across.
    const degrees = new Map(
      ALL_RULES.filter(rule => rule.degree !== undefined).map(rule => [
        rule.id,
        rule.degree!,
      ])
    );
    expect(degrees.get('bpmn.start-event-no-inflow')?.maxIn).toBe(0);
    expect(degrees.get('bpmn.start-event-must-exit')?.minOut).toBe(1);
    expect(degrees.get('bpmn.end-event-no-outflow')?.maxOut).toBe(0);
    expect(degrees.get('bpmn.end-event-must-be-reached')?.minIn).toBe(1);
    // ...and each declares exactly ONE bound, so the family's fixed test order
    // can never make one rule report the other's mistake.
    for (const [id, degree] of degrees) {
      const bounds = [
        degree.minIn,
        degree.maxIn,
        degree.minOut,
        degree.maxOut,
      ].filter(bound => bound !== undefined);
      expect(bounds.length, id).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the graph sweep and the naming check off the drawing path', () => {
    // `moment` is a property of the RULE, so "zero real-time cost" is provable
    // here rather than promised in a comment. Two rules ask for it, for two
    // different reasons: the traversal is too expensive for the 16 ms budget,
    // and the naming check would bracket a task the instant it is created —
    // which is not validation, it is arguing with the act of drawing.
    const onDemand = ALL_RULES.filter(rule => rule.moment === 'on-demand');
    expect(onDemand.map(rule => rule.id).sort()).toEqual([
      'bpmn.unlabeled-step',
      'bpmn.unreachable-step',
    ]);
    // Absent everywhere else, which is what `'realtime'` means: the default is
    // never restated, so nobody has to wonder whether an omission was a choice.
    for (const rule of ALL_RULES) {
      if (onDemand.includes(rule)) continue;
      expect(rule.moment, rule.id).toBeUndefined();
    }
  });
});
