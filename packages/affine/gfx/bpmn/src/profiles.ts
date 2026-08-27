import type { ValidationProfile } from '@labre/affine-block-surface';

/**
 * BPMN validation profiles (B6).
 *
 * DATA owned by the framework, like its rules and its roles. A profile is chosen
 * per POOL — the framework's root instance — and the choice rides on the pool
 * element itself, so two participants at two levels of requirement coexist on one
 * canvas: the pool somebody is still sketching stays a sketch while the one
 * that is being handed over is held to the norm.
 *
 * Registered from the flag-gated `BpmnViewExtension`, beside the rules:
 * switching the `bpmn` flag off takes the choice away with the rest of the
 * tooling, and a pool already set to `descriptive` simply stops being checked
 * until it comes back — the id stays written, untouched.
 *
 * ## Two today, and the two that are future DATA
 *
 * BPMN 2.0 defines three conformance sub-classes, each a superset of the last:
 * DESCRIPTIVE (the visual subset a business reader can follow — the one this
 * pack draws), ANALYTIC (every event type, every gateway, the full flow
 * semantics) and COMMON EXECUTABLE (what an engine can run: data mappings,
 * expressions, message correlation). Only the first is meaningful against the
 * twelve rules that exist, because the other two are levels of requirement about
 * artefacts this pack does not yet draw.
 *
 * They arrive as PROFILES and not as engine work when they arrive: a level of
 * requirement is a table of severities per rule id, so `bpmn.analytic` is an
 * entry in the array at the bottom of this file plus whatever new rules the new
 * artefacts bring. Nothing in the pipework has to learn a third word.
 *
 * ## Both tables spell out all TWENTY-ONE ids
 *
 * Every severity a user can get is either the one its rule declares or one of
 * these lines — nothing is raised implicitly (PF9.4). Spelling them all out is
 * also what let eight of these rules wait a review cycle for the engine fields
 * they needed and then arrive already governed, rather than arriving and
 * quietly keeping their own severity at a level nobody had chosen.
 */

/**
 * Sketch: every rule demoted to `audit`. Findings still reach `violations$` —
 * a host panel and a conformance report see them — and the canvas says nothing.
 *
 * The DEFAULT, and deliberately so (PRD principle 3). A process is drawn in a
 * workshop, at speed, with the steps going down before anybody decides where the
 * pools are: for the first minutes of that, EVERY task is a dead end, no pool has
 * a start event, and half the links are still plain connectors somebody
 * quick-dragged. A tool arguing with that hand is a tool switched off within the
 * hour, and it would be arguing about a diagram the author already knows is
 * unfinished.
 *
 * The sketch PRIMES: the findings are computed, collected and available the
 * moment the author asks — through the panel, through a check-up, through the
 * profile switch — so nothing has to be re-derived when they decide the drawing
 * is a deliverable. Being the default also means it WRITES NOTHING: a pool on
 * `sketch` carries no profile key, so every process ever drawn is on it, with no
 * migration and no backfill.
 */
const sketch: ValidationProfile = {
  id: 'bpmn.sketch',
  framework: 'bpmn',
  labelKey: 'com.labre.bpmn.profile.sketch',
  fallback: 'Sketch',
  isDefault: true,
  rules: {
    'bpmn.sequence-flow-endpoints': 'audit',
    'bpmn.message-flow-endpoints': 'audit',
    'bpmn.association-endpoints': 'audit',
    'bpmn.untyped-flow': 'audit',
    'bpmn.duplicate-sequence-flow': 'audit',
    'bpmn.start-event-no-inflow': 'audit',
    'bpmn.start-event-must-exit': 'audit',
    'bpmn.end-event-no-outflow': 'audit',
    'bpmn.end-event-must-be-reached': 'audit',
    'bpmn.activity-dead-end': 'audit',
    'bpmn.sequence-flow-stays-home': 'audit',
    'bpmn.message-flow-crosses-pools': 'audit',
    'bpmn.unreachable-step': 'audit',
    'bpmn.pool-end-without-start': 'audit',
    'bpmn.pool-start-without-end': 'audit',
    'bpmn.single-blank-start': 'audit',
    'bpmn.gateway-must-branch': 'audit',
    'bpmn.gateway-join-and-fork': 'audit',
    'bpmn.fake-join': 'audit',
    'bpmn.implicit-split': 'audit',
    'bpmn.unlabeled-step': 'audit',
  },
};

/**
 * Descriptive: the BPMN 2.0 DESCRIPTIVE conformance posture — a diagram a
 * business reader can be handed and will read correctly.
 *
 * Every rule at the severity its own declaration carries, spelled out rather
 * than left absent, so the answer is readable in one place. That is the point of
 * a profile table: a reviewer asking "what does this level actually require"
 * reads twelve lines instead of twelve files, and a rule added later cannot join
 * a level silently — it arrives with its own severity until somebody writes it
 * down here.
 *
 * ## Nothing is `blocking-overridable`, and one line each is what changes that
 *
 * Nothing in this library implements refusal — no gesture is declined anywhere —
 * so declaring the level would be data claiming an effect that does not exist
 * (the `wardley/rules.ts:30` promise, kept). `bpmn.start-event-no-inflow` and
 * `bpmn.end-event-no-outflow` are the two a BPMN trainer would put there: both
 * say the process runs backwards, and neither has a reading in which the author
 * is right. They move in one line each, here, the day the gesture refusal lands.
 *
 * ## The five that do not move
 *
 * `bpmn.activity-dead-end`, `bpmn.fake-join`, `bpmn.implicit-split`,
 * `bpmn.single-blank-start` and `bpmn.unlabeled-step` stay `audit` HERE TOO, and
 * they are the reason a profile spells everything out.
 *
 * The first three report shapes the specification explicitly SANCTIONS: an
 * activity with no outgoing sequence flow is a way to end a path (BPMN 2.0.2,
 * p.151), and an activity with several incoming or several outgoing flows has
 * defined token semantics on the same page. A warning would be the tool arguing
 * with a house style the standard allows. They stay in the pack because on a
 * diagram meant to be READ each of them is a question the drawing no longer asks
 * out loud — which is a remark for the conformance panel, at every level of
 * requirement. Every one of them is quieter than bpmnlint's own level for the
 * same shape, deliberately.
 *
 * The last two report a diagram that is UNFINISHED rather than wrong — two
 * indistinguishable blank starts, a step nobody has named — and "not done" is
 * what a panel is for.
 *
 * The exact `context-map.acl-on-customer-supplier` shape, one layer over: a
 * judgement the diagram cannot make on the author's behalf, so it is collected
 * and never interrupts. Every other rule here reads a normative sentence of the
 * standard, and those are not judgement calls — a message flow inside one pool is
 * a sentence BPMN does not have.
 */
const descriptive: ValidationProfile = {
  id: 'bpmn.descriptive',
  framework: 'bpmn',
  labelKey: 'com.labre.bpmn.profile.descriptive',
  fallback: 'Descriptive',
  rules: {
    'bpmn.sequence-flow-endpoints': 'warning',
    'bpmn.message-flow-endpoints': 'warning',
    'bpmn.association-endpoints': 'warning',
    'bpmn.untyped-flow': 'warning',
    'bpmn.duplicate-sequence-flow': 'warning',
    'bpmn.start-event-no-inflow': 'warning',
    'bpmn.start-event-must-exit': 'warning',
    'bpmn.end-event-no-outflow': 'warning',
    'bpmn.end-event-must-be-reached': 'warning',
    // The five that do not move — see the header.
    'bpmn.activity-dead-end': 'audit',
    'bpmn.sequence-flow-stays-home': 'warning',
    'bpmn.message-flow-crosses-pools': 'warning',
    'bpmn.unreachable-step': 'warning',
    'bpmn.pool-end-without-start': 'warning',
    'bpmn.pool-start-without-end': 'warning',
    'bpmn.single-blank-start': 'audit',
    'bpmn.gateway-must-branch': 'warning',
    'bpmn.gateway-join-and-fork': 'warning',
    'bpmn.fake-join': 'audit',
    'bpmn.implicit-split': 'audit',
    'bpmn.unlabeled-step': 'audit',
  },
};

export const BPMN_PROFILES: readonly ValidationProfile[] = [
  sketch,
  descriptive,
];
