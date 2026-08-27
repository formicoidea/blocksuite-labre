import { describe, expect, it } from 'vitest';

import { BPMN_PROFILES } from '../profiles';
import { BPMN_RULES } from '../rules';

/**
 * The whole pack, and it is now one array: `claude/bpmn-engine-v2` (#145)
 * landed every def field the eight held-out rules were authored against, so the
 * `BPMN_RULES_PENDING_ENGINE_V2` staging array is gone.
 */
const ALL_RULES = BPMN_RULES;

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

  it('spells out every rule in every profile', () => {
    // Twenty-two, all registered. Every severity a user can get is either the
    // one its rule declares or one of these lines — nothing is raised
    // implicitly (PF9.4), and a rule shipped later cannot join a level in
    // silence.
    const ruleIds = ALL_RULES.map(rule => rule.id).sort();
    expect(ruleIds).toHaveLength(22);
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
    // reviewer can read the level instead of reading twenty-two files.
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
      expect(rule.messageKey).toMatch(/^com\.labre\.bpmn\.validation\./);
      // A framework fallback, so a host with no catalogue reads a sentence
      // rather than a dotted key — the framework owns the word, not the engine.
      expect(rule.messageFallback, rule.id).toBeTruthy();
      expect(rule.suggestionKey, rule.id).toMatch(
        /^com\.labre\.bpmn\.validation\./
      );
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
      'label-presence',
      'reachability',
      'relation-endpoints',
      'role-count',
    ]);
    expect(byFamily.get('relation-endpoints')).toHaveLength(6);
    expect(byFamily.get('edge-degree')).toHaveLength(9);
    expect(byFamily.get('edge-locality')).toHaveLength(2);
    expect(byFamily.get('role-count')).toHaveLength(3);
    expect(byFamily.get('reachability')).toHaveLength(1);
    expect(byFamily.get('label-presence')).toEqual(['bpmn.unlabeled-step']);
  });

  /**
   * The eight rules that were authored a review cycle ahead of the engine, now
   * that `claude/bpmn-engine-v2` (#145) has landed every def field they name.
   *
   * Pinned as a group because the reason they waited is worth keeping: two of
   * them would have been actively WRONG in the meantime. An engine with no
   * `ifPresent` reads the pair as the UNCONDITIONAL "every pool holds a start
   * event" the specification review removed — a finding on a conformant
   * black-box pool (p.238 / p.246). A rule whose data is wrong until a future
   * branch lands is a false positive with a release date.
   */
  it('registers the eight rules that were authored ahead of the engine', () => {
    const late = [
      'bpmn.pool-end-without-start',
      'bpmn.pool-start-without-end',
      'bpmn.single-blank-start',
      'bpmn.gateway-must-branch',
      'bpmn.gateway-join-and-fork',
      'bpmn.fake-join',
      'bpmn.implicit-split',
      'bpmn.unlabeled-step',
    ];
    const registered = new Set(BPMN_RULES.map(rule => rule.id));
    for (const id of late) expect(registered.has(id), id).toBe(true);

    // ...each one still carrying the field it waited for, so a revert of the
    // engine work cannot leave the rule silently meaning something else.
    const byId = new Map(BPMN_RULES.map(rule => [rule.id, rule]));
    expect(byId.get('bpmn.pool-end-without-start')?.roleCount?.ifPresent).toBe(
      'bpmn:end-event'
    );
    expect(byId.get('bpmn.pool-start-without-end')?.roleCount?.ifPresent).toBe(
      'bpmn:start-event'
    );
    expect(byId.get('bpmn.single-blank-start')?.roleCount?.exact).toBe(true);
    expect(byId.get('bpmn.unreachable-step')?.reachability?.implicitRoots).toBe(
      true
    );
    expect(byId.get('bpmn.unlabeled-step')?.label?.present).toBe(true);
    for (const id of [
      'bpmn.gateway-must-branch',
      'bpmn.gateway-join-and-fork',
      'bpmn.fake-join',
      'bpmn.implicit-split',
    ]) {
      const pattern = byId.get(id)?.degree?.forbidPattern;
      expect(pattern, id).toBeDefined();
      // The pattern carries its OWN words: a forbidden zone is not a bound that
      // failed, and its sentence never reads like one.
      expect(pattern?.messageKey, id).toMatch(
        /^com\.labre\.bpmn\.validation\./
      );
      expect(pattern?.messageFallback, id).toBeTruthy();
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

  /**
   * Provenance, and the reason it is a TOTALITY test rather than a spot check.
   *
   * The field is optional on the engine's side — a framework that says nothing
   * about its authority is a framework that says nothing — but for BPMN a rule
   * arriving without one is the bug this pack exists to avoid: an architecture
   * review asked that a Labre convention never present itself as a norm
   * violation, and a rule with no declared provenance shows no line at all,
   * which is precisely the state the review found.
   */
  it('declares where every rule gets its authority', () => {
    for (const rule of ALL_RULES) {
      expect(rule.provenance, rule.id).toBeDefined();
      expect(
        ['standard', 'recommendation', 'labre-convention'],
        rule.id
      ).toContain(rule.provenance!.source);
    }
    // `organization` is reserved for the org profiles the PRD names, and no
    // framework declares one yet. Pinned so the day one does is a decision.
    expect(
      ALL_RULES.filter(rule => rule.provenance?.source === 'organization')
    ).toEqual([]);
  });

  it('cites a page or a clause for every rule it calls a standard', () => {
    // The whole value of `standard` is that the user can go and check. A rule
    // claiming the OMG's authority without saying where is a claim nobody can
    // verify, which is worse than claiming none.
    const standards = ALL_RULES.filter(
      rule => rule.provenance?.source === 'standard'
    );
    expect(standards.length).toBeGreaterThan(0);
    for (const rule of standards) {
      const reference = rule.provenance!.reference;
      expect(reference, rule.id).toBeTruthy();
      // Loosely pinned on purpose: a citation is prose, and the format that
      // reads best differs between a page, a clause and a table. What must be
      // there is a LOCATOR.
      expect(reference, rule.id).toMatch(/p\.\d|§/);
      expect(reference, rule.id).toContain('BPMN 2.0.2');
    }
  });

  it('names the source of every recommendation, and owns every convention', () => {
    for (const rule of ALL_RULES) {
      const { source, reference } = rule.provenance!;
      if (source === 'standard') continue;
      // A recommendation names the linter or the sentence the specification
      // merely permits; a convention says out loud that it is ours. Either way
      // the user is told what they are being asked to believe.
      expect(reference, rule.id).toBeTruthy();
      if (source === 'labre-convention') {
        expect(reference, rule.id).toMatch(/Labre/);
      }
    }
    // The two, and only the two: the self-loop and the untyped connector. Both
    // are house style, and neither is dressed as anything else.
    expect(
      ALL_RULES.filter(
        rule => rule.provenance?.source === 'labre-convention'
      ).map(rule => rule.id)
    ).toEqual(['bpmn.sequence-flow-self-loop', 'bpmn.untyped-flow']);
  });

  /**
   * The split that the provenance field forced, pinned end to end.
   *
   * B1's matrix is p.95 and its self-loop clause was ours, so one rule could
   * not have declared either honestly — and the clause that FIRES was the house
   * style, so a `standard` label would have shown an OMG page under a finding
   * the OMG does not make. The two are separate objects now, and the assertions
   * below are what stops them from being folded back together.
   */
  it('keeps the standard endpoints rule and the house self-loop apart', () => {
    const byId = new Map(ALL_RULES.map(rule => [rule.id, rule]));
    const endpoints = byId.get('bpmn.sequence-flow-endpoints')!;
    const selfLoop = byId.get('bpmn.sequence-flow-self-loop')!;

    expect(endpoints.provenance?.source).toBe('standard');
    expect(selfLoop.provenance?.source).toBe('labre-convention');

    // The clause lives on exactly one of them...
    expect(endpoints.endpoints?.forbidSelfLoop).toBeUndefined();
    expect(selfLoop.endpoints?.forbidSelfLoop).toBe(true);
    // ...and both judge the same alphabet, so they can never disagree about
    // what "a step" is, nor indict a link the other waves through.
    expect(selfLoop.endpoints?.allowed).toBe(endpoints.endpoints?.allowed);
    expect(selfLoop.endpoints?.edgeRole).toBe(endpoints.endpoints?.edgeRole);

    // The wording the clause shipped with, unchanged: a split that renamed a
    // user-visible key would be a migration, and this is not one.
    expect(selfLoop.messageKey).toBe(
      'com.labre.bpmn.validation.sequence-flow-self-loop'
    );
    expect(selfLoop.endpoints?.selfLoop).toBeUndefined();
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
