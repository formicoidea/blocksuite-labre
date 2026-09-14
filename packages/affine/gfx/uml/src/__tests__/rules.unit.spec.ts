import {
  evaluateCheckup,
  evaluateRules,
  type Violation,
} from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { UML_DIAGRAM_KIND_MENU } from '../kinds.js';
import { UML_PROFILES } from '../profiles.js';
import { UML_ROLE } from '../roles.js';
import {
  UML_ASSOCIATION_MATRIX,
  UML_ELEMENT_MATRIX,
  UML_GENERALIZATION_ALPHABET,
  UML_GENERALIZATION_MATRIX,
  UML_RULES,
} from '../rules.js';
import { umlDiagramToolingToolbarConfig } from '../toolbar/config.js';

/**
 * The sixteen UML rules, rule by rule — and above all what each of them stays
 * SILENT about. Silence is the expensive half: a rule that fires on a croquis is
 * a rule the workshop switches off, and a UML diagram is drawn as a croquis for
 * most of its life.
 *
 * The fixtures are C4's, one framework over: the engine reads `id`, `role`,
 * `text`, `elementBound`, a frame's declared `kind` and an edge's
 * `source`/`target`, and nothing else, so a synthetic sheet is a handful of
 * plain objects. `board-stub.ts` builds detached MODELS, which the exporters and
 * the interchange capability need because they pick artefacts out with
 * `instanceof`; no rule in this file asks a fixture for anything a record cannot
 * answer, so nothing here pays for that.
 */

const ELEMENT_OUTSIDE_FRAME = 'uml.element-outside-frame';
const NOT_ADMISSIBLE_ON_KIND = 'uml.not-admissible-on-kind';
const USE_CASE_OUTSIDE_SUBJECT = 'uml.use-case-outside-subject';
const ACTOR_INSIDE_SUBJECT = 'uml.actor-inside-subject';
const UNNAMED_CLASSIFIER = 'uml.unnamed-classifier';
const UNNAMED_ACTOR_OR_USE_CASE = 'uml.unnamed-actor-or-use-case';
const GENERALIZATION_ENDPOINTS = 'uml.generalization-endpoints';
const GENERALIZATION_SELF_LOOP = 'uml.generalization-self-loop';
const REALIZATION_ENDPOINTS = 'uml.realization-endpoints';
const DEPENDENCY_ON_OBJECT = 'uml.dependency-on-object';
const INCLUDE_ENDPOINTS = 'uml.include-endpoints';
const EXTEND_ENDPOINTS = 'uml.extend-endpoints';
const ACTOR_ACTOR_ASSOCIATION = 'uml.actor-actor-association';
const DEPLOY_ENDPOINTS = 'uml.deploy-endpoints';
const MANIFEST_ENDPOINTS = 'uml.manifest-endpoints';
const COMMUNICATION_PATH_ENDPOINTS = 'uml.communication-path-endpoints';
const UNTYPED_EDGE = 'uml.untyped-edge';
const COMPOSITION_SINGLE_OWNER = 'uml.composition-single-owner';
const USE_CASE_NO_ACTOR = 'uml.use-case-no-actor';
const NODE_IN_PARTITION = 'uml.node-in-partition';
const SHALLOW_HISTORY_OUTSIDE_REGION = 'uml.shallow-history-outside-region';
const DEEP_HISTORY_OUTSIDE_REGION = 'uml.deep-history-outside-region';
const INITIAL_SINGLE = 'uml.initial-single';
const INITIAL_NO_INCOMING_FLOW = 'uml.initial-no-incoming-flow';
const INITIAL_NO_INCOMING_TRANSITION = 'uml.initial-no-incoming-transition';
const ACTIVITY_FINAL_NO_OUTGOING = 'uml.activity-final-no-outgoing';
const FLOW_FINAL_NO_OUTGOING = 'uml.flow-final-no-outgoing';
const FINAL_STATE_NO_OUTGOING = 'uml.final-state-no-outgoing';
const DECISION_INCOMING_COUNT = 'uml.decision-incoming-count';
const CONTROL_FLOW_ENDPOINTS = 'uml.control-flow-endpoints';
const OBJECT_FLOW_ENDPOINTS = 'uml.object-flow-endpoints';
const TRANSITION_ENDPOINTS = 'uml.transition-endpoints';
const UNREACHABLE_ACTION = 'uml.unreachable-action';
const UNREACHABLE_STATE = 'uml.unreachable-state';

/**
 * The seventeen rules that restate a NORMATIVE clause — and deliberately not the same
 * list as the twelve `uml.strict` promotes (`profiles.unit.spec.ts` owns that
 * one). Provenance and severity are orthogonal: two of these ten stay a remark
 * at every level, and two of the promoted twelve are `recommendation`.
 */
const STANDARD_RULES = [
  GENERALIZATION_ENDPOINTS,
  GENERALIZATION_SELF_LOOP,
  REALIZATION_ENDPOINTS,
  INCLUDE_ENDPOINTS,
  EXTEND_ENDPOINTS,
  ACTOR_ACTOR_ASSOCIATION,
  COMPOSITION_SINGLE_OWNER,
  DEPLOY_ENDPOINTS,
  MANIFEST_ENDPOINTS,
  COMMUNICATION_PATH_ENDPOINTS,
  // The behaviour sheets' arithmetic and their two grammars — §15.3.3,
  // §15.7.19.4 twice, §15.7.11.4, §15.7.9.4, §14.5.11.4 and §14.5.12.
  INITIAL_NO_INCOMING_FLOW,
  ACTIVITY_FINAL_NO_OUTGOING,
  FLOW_FINAL_NO_OUTGOING,
  FINAL_STATE_NO_OUTGOING,
  DECISION_INCOMING_COUNT,
  CONTROL_FLOW_ENDPOINTS,
  TRANSITION_ENDPOINTS,
];

interface Extra {
  source?: string;
  target?: string;
  text?: string;
  profile?: string;
  kind?: string;
}

function element(
  id: string,
  xywh: [number, number, number, number],
  role?: string,
  extra: Extra = {}
): GfxPrimitiveElementModel {
  return {
    id,
    role,
    ...(extra.source !== undefined
      ? {
          source: { id: extra.source },
          target: { id: extra.target ?? extra.source },
        }
      : {}),
    ...(extra.text !== undefined ? { text: extra.text } : {}),
    ...(extra.profile !== undefined
      ? { validationProfile: extra.profile }
      : {}),
    // The frame's declared kind. Unlike a C4 board's level it is never absent:
    // Annex A writes the heading as `<kind> <name>`, so the model makes it
    // required with `class` as the default (`kinds.ts`).
    ...(extra.kind !== undefined ? { kind: extra.kind } : {}),
    get elementBound() {
      return new Bound(...xywh);
    },
  } as unknown as GfxPrimitiveElementModel;
}

/** The sheet: 1400×900 at the origin, drawing a class diagram unless told. */
const frame = (kind = 'class', profile?: string) =>
  element('frame', [0, 0, 1400, 900], UML_ROLE.diagram, {
    kind,
    ...(profile !== undefined ? { profile } : {}),
  });

/** A sheet authored before `uml:diagram` existed: same card, no role, no kind. */
const legacyFrame = () => element('frame', [0, 0, 1400, 900]);

/** The use case subject: x 700…1100, y 200…500, plot inset by 12 (`consts.ts`). */
const subject = (id = 'subj', x = 700, y = 200) =>
  element(id, [x, y, 400, 300], UML_ROLE.subject);

/**
 * One artefact's SHAPE, carrying the role and — deliberately — no text at all.
 * A UML node is a group: the shape is a body, and its words are the tier
 * elements beside it ({@link name}, {@link label}).
 */
const node =
  (role: string, w: number, h: number) =>
  (id: string, x = 100, y = 100) =>
    element(id, [x, y, w, h], role);

const klass = node(UML_ROLE.class, 200, 120);
const iface = node(UML_ROLE.interface, 200, 120);
const enumeration = node(UML_ROLE.enumeration, 200, 120);
const object = node(UML_ROLE.object, 200, 120);
const pkg = node(UML_ROLE.package, 200, 130);
const note = node(UML_ROLE.note, 180, 100);
const actor = node(UML_ROLE.actor, 80, 120);
const useCase = node(UML_ROLE['use-case'], 200, 90);
// The structural vocabulary (phase 2). A port is the 16×16 square of
// `UML_NODE_BOX.port`; the two interface glyphs are the ball and the socket.
const component = node(UML_ROLE.component, 220, 120);
const port = node(UML_ROLE.port, 16, 16);
const providedInterface = node(UML_ROLE['provided-interface'], 60, 30);
const requiredInterface = node(UML_ROLE['required-interface'], 60, 30);
const artifact = node(UML_ROLE.artifact, 200, 120);
const cube = node(UML_ROLE.node, 220, 160);
const device = node(UML_ROLE.device, 220, 160);
const executionEnvironment = node(UML_ROLE['execution-environment'], 220, 160);
// The behaviour vocabulary (phase 2). The control nodes are the small glyphs of
// `UML_NODE_BOX`; the two frames are declared below with the subject.
const action = node(UML_ROLE.action, 180, 80);
const initialNode = node(UML_ROLE.initial, 24, 24);
const activityFinal = node(UML_ROLE['activity-final'], 32, 32);
const flowFinal = node(UML_ROLE['flow-final'], 32, 32);
const decision = node(UML_ROLE.decision, 60, 60);
const fork = node(UML_ROLE.fork, 100, 8);
const objectNode = node(UML_ROLE['object-node'], 160, 60);
const sendSignal = node(UML_ROLE['send-signal'], 160, 60);
const acceptEvent = node(UML_ROLE['accept-event'], 160, 60);
const timeEvent = node(UML_ROLE['time-event'], 40, 60);
const stateNode = node(UML_ROLE.state, 180, 90);
const finalState = node(UML_ROLE['final-state'], 32, 32);
const choice = node(UML_ROLE.choice, 60, 60);
const junction = node(UML_ROLE.junction, 16, 16);
const shallowHistory = node(UML_ROLE['shallow-history'], 28, 28);
const deepHistory = node(UML_ROLE['deep-history'], 28, 28);
const entryPoint = node(UML_ROLE['entry-point'], 16, 16);
const terminate = node(UML_ROLE.terminate, 24, 24);

/** §15.6.4's swimlane: a tall band down the left of the sheet. */
const partition = (id = 'lane', x = 100, y = 100) =>
  element(id, [x, y, 400, 700], UML_ROLE.partition);

/** §14.2.4's composite state, drawn as the box its sub-states sit in. */
const region = (id = 'r', x = 100, y = 100) =>
  element(id, [x, y, 400, 400], UML_ROLE.region);

/**
 * The name compartment — where a classifier's, an object's, a package's and a
 * note's words actually live.
 *
 * Defaults to the stencil's own seed, because that is what `actions.ts` writes
 * at creation: a fresh artefact is PROMPTED, not nameless.
 */
const name = (id: string, text = 'Order', x = 100, y = 340) =>
  element(id, [x, y, 180, 24], UML_ROLE.name, { text });

/** The one word written against an actor or inside a use case. */
const label = (id: string, text = 'Customer', x = 100, y = 340) =>
  element(id, [x, y, 180, 24], UML_ROLE.label, { text });

/** A typed edge, of whichever role. */
const edge = (id: string, role: string, source: string, target: string) =>
  element(id, [200, 150, 300, 1], role, { source, target });

const assoc = (id: string, source: string, target: string) =>
  edge(id, UML_ROLE.association, source, target);

/** What quick-connect leaves behind: a connector carrying no role at all. */
const wire = (id: string, source: string, target: string) =>
  element(id, [200, 150, 300, 1], undefined, { source, target });

/** A neutral drawing — a sticky note, a rectangle somebody thought with. */
const sketch = (id: string, x = 100, y = 700) => element(id, [x, y, 180, 120]);

/**
 * The DRAWING pass, as the manager runs it: rules AND profiles, always.
 *
 * `uml.sketch` is the default and holds all sixteen rules at `audit`, so on a
 * sheet nobody raised THIS RETURNS NOTHING — which is the point: a diagram drawn
 * boxes-first is not measured on every gesture (PF7.6).
 */
const drawing = (elements: GfxPrimitiveElementModel[]) =>
  evaluateRules(UML_RULES, elements, UML_PROFILES);

/** The check-up pass — where a sketch-level sheet's findings actually are. */
const checkup = (elements: GfxPrimitiveElementModel[]) =>
  evaluateCheckup(UML_RULES, elements, UML_PROFILES);

/** Everything the pack says about a sheet, whichever moment says it. */
const evaluate = (elements: GfxPrimitiveElementModel[]) => [
  ...drawing(elements),
  ...checkup(elements),
];

const idsOf = (violations: readonly Violation[]) =>
  violations.map(violation => violation.ruleId).sort();

const only = (violations: readonly Violation[], ruleId: string) =>
  violations.filter(violation => violation.ruleId === ruleId);

/**
 * A conformant CLASS diagram: two named classes inside the frame, associated.
 */
const conformantClass = () => [
  frame('class'),
  klass('a', 100, 200),
  name('a-name', 'Order', 100, 210),
  klass('b', 100, 400),
  name('b-name', 'OrderLine', 100, 410),
  assoc('r', 'a', 'b'),
];

/**
 * A conformant USE CASE diagram: a subject round the use cases, the actor
 * outside it, and an association crossing the edge — §18.1.4's own figure.
 */
const conformantUseCase = () => [
  frame('uc'),
  subject(),
  actor('p', 500, 300),
  label('p-label', 'Customer', 480, 430),
  useCase('u', 760, 250),
  label('u-label', 'Place an order', 770, 290),
  assoc('r', 'p', 'u'),
];

/**
 * A conformant COMPONENT diagram: a component with a port on its border and a
 * lollipop against it, and an artefact that manifests it (§11.6.4, §19.3.4).
 */
const conformantComponent = () => [
  frame('cmp'),
  component('c', 200, 200),
  name('c-name', '«component»\nCart', 210, 210),
  port('c-port', 412, 250),
  label('c-port-label', 'http', 440, 244),
  providedInterface('c-iface', 440, 300),
  label('c-iface-label', 'IOrder', 510, 300),
  artifact('a', 700, 200),
  name('a-name', '«artifact»\ncart.jar', 710, 210),
  edge('m', UML_ROLE.manifest, 'a', 'c'),
];

/**
 * A conformant DEPLOYMENT diagram: two cubes talking, with an artefact deployed
 * on one of them (§19.4.4's own Figure 19.15).
 */
const conformantDeployment = () => [
  frame('dep'),
  device('d', 100, 200),
  name('d-name', '«device»\nAppServer', 110, 210),
  executionEnvironment('e', 600, 200),
  name('e-name', '«executionEnvironment»\nTomcat', 610, 210),
  artifact('a', 100, 500),
  name('a-name', '«artifact»\ncart.jar', 110, 510),
  edge('dep', UML_ROLE.deploy, 'a', 'd'),
  edge('cp', UML_ROLE['communication-path'], 'd', 'e'),
];

/**
 * A conformant ACTIVITY: one beginning, two actions in a chain, one end
 * (§15.2.4's own figure, minus the lanes it does not have to draw).
 */
const conformantActivity = () => [
  frame('act'),
  initialNode('i', 100, 200),
  action('a', 300, 200),
  label('a-label', 'Receive order', 300, 340),
  action('b', 600, 200),
  label('b-label', 'Ship order', 600, 340),
  activityFinal('z', 900, 200),
  edge('e1', UML_ROLE['control-flow'], 'i', 'a'),
  edge('e2', UML_ROLE['control-flow'], 'a', 'b'),
  edge('e3', UML_ROLE['control-flow'], 'b', 'z'),
];

/** A conformant STATE MACHINE: the same chain in §14.2.4's vocabulary. */
const conformantStateMachine = () => [
  frame('stm'),
  initialNode('i', 100, 200),
  stateNode('s1', 300, 200),
  name('s1-name', 'Draft', 300, 340),
  stateNode('s2', 600, 200),
  name('s2-name', 'Placed', 600, 340),
  finalState('z', 900, 200),
  edge('t1', UML_ROLE.transition, 'i', 's1'),
  edge('t2', UML_ROLE.transition, 's1', 's2'),
  edge('t3', UML_ROLE.transition, 's2', 'z'),
];

describe('what the framework ships', () => {
  it('ships exactly the thirty-four rules of the pack, in reading order', () => {
    expect(UML_RULES.map(rule => rule.id)).toEqual([
      ELEMENT_OUTSIDE_FRAME,
      NOT_ADMISSIBLE_ON_KIND,
      USE_CASE_OUTSIDE_SUBJECT,
      ACTOR_INSIDE_SUBJECT,
      UNNAMED_CLASSIFIER,
      UNNAMED_ACTOR_OR_USE_CASE,
      GENERALIZATION_ENDPOINTS,
      GENERALIZATION_SELF_LOOP,
      REALIZATION_ENDPOINTS,
      DEPENDENCY_ON_OBJECT,
      INCLUDE_ENDPOINTS,
      EXTEND_ENDPOINTS,
      ACTOR_ACTOR_ASSOCIATION,
      DEPLOY_ENDPOINTS,
      MANIFEST_ENDPOINTS,
      COMMUNICATION_PATH_ENDPOINTS,
      UNTYPED_EDGE,
      COMPOSITION_SINGLE_OWNER,
      USE_CASE_NO_ACTOR,
      NODE_IN_PARTITION,
      SHALLOW_HISTORY_OUTSIDE_REGION,
      DEEP_HISTORY_OUTSIDE_REGION,
      INITIAL_SINGLE,
      INITIAL_NO_INCOMING_FLOW,
      INITIAL_NO_INCOMING_TRANSITION,
      ACTIVITY_FINAL_NO_OUTGOING,
      FLOW_FINAL_NO_OUTGOING,
      FINAL_STATE_NO_OUTGOING,
      DECISION_INCOMING_COUNT,
      CONTROL_FLOW_ENDPOINTS,
      OBJECT_FLOW_ENDPOINTS,
      TRANSITION_ENDPOINTS,
      UNREACHABLE_ACTION,
      UNREACHABLE_STATE,
    ]);
  });

  /**
   * SIX families for the largest notation the library carries — and not one of
   * them new.
   *
   * The claim `docs/add-a-framework` makes about the seam, tested by the hardest
   * case available: twelve edge roles are twelve readings of
   * `relation-endpoints`, the two frames are the membership families C4 already
   * uses, and the sheet's own declaration is the `view-admissibility` C4 opened.
   * Phase 2 doubled the vocabulary and the number below did not move.
   */
  it('needs eight families, and asks the engine for nothing new', () => {
    // The two the behaviour sheets added are BPMN's, registered here with UML's
    // own roles and nothing else: a machine with two beginnings and a ring of
    // states nothing enters are the same two questions a pool with two start
    // events and an unreachable task ask.
    expect([...new Set(UML_RULES.map(rule => rule.family))].sort()).toEqual([
      'edge-degree',
      'element-in-background',
      'element-in-zone',
      'label-presence',
      'reachability',
      'relation-endpoints',
      'role-count',
      'view-admissibility',
    ]);
  });

  it('namespaces every rule and holds no prose in the engine', () => {
    for (const rule of UML_RULES) {
      expect(rule.framework).toBe('uml');
      expect(rule.id.startsWith('uml.')).toBe(true);
      expect(rule.version).toBe(1);
      expect(rule.messageKey).toMatch(/^com\.labre\.uml\.validation\./);
      // A framework fallback, so a host with no catalogue reads a sentence
      // rather than a dotted key — the framework owns the word, not the engine.
      expect(rule.messageFallback, rule.id).toBeTruthy();
      expect(rule.suggestionKey, rule.id).toMatch(
        /^com\.labre\.uml\.validation\./
      );
      expect(rule.suggestionFallback, rule.id).toBeTruthy();
      expect(rule.roles, rule.id).toBeDefined();
    }
  });

  it('declares no level the pipework cannot honour, and starts every rule quiet', () => {
    // `blocking-overridable` is carried by the engine and acted on by nobody.
    // Every UML rule is `audit` in its own declaration: the croquis primes, and
    // `uml.strict` is what promotes the nine — see `profiles.ts`.
    for (const rule of UML_RULES) {
      expect(rule.severity, rule.id).toBe('audit');
    }
  });

  it('names a frame on every rule, so every finding can be waived somewhere', () => {
    const framedBy = (role: string) =>
      UML_RULES.filter(rule => rule.backgroundRole === role)
        .map(rule => rule.id)
        .sort();

    // The two rules whose question is about the SUBJECT — the only frame drawn
    // inside another one, and the one that carries no picker of its own.
    expect(framedBy(UML_ROLE.subject)).toEqual(
      [USE_CASE_OUTSIDE_SUBJECT, ACTOR_INSIDE_SUBJECT].sort()
    );
    // The lane and the composite state are the two frames the behaviour sheets
    // added, and each carries exactly the membership rules written on it.
    expect(framedBy(UML_ROLE.partition)).toEqual([NODE_IN_PARTITION]);
    expect(framedBy(UML_ROLE.region)).toEqual(
      [SHALLOW_HISTORY_OUTSIDE_REGION, DEEP_HISTORY_OUTSIDE_REGION].sort()
    );
    expect(framedBy(UML_ROLE.diagram)).toHaveLength(29);
    for (const rule of UML_RULES) {
      expect(rule.backgroundRole, rule.id).toBeDefined();
    }
  });

  /**
   * Provenance, as a TOTALITY test rather than a spot check.
   *
   * UML is the first pack in this library with a SPECIFICATION to cite, so it is
   * also the first where `standard` is an honest answer — and the first where
   * getting the split wrong would present a house reading as a conformance
   * defect, which is the thing the field exists to prevent.
   */
  it('declares where every rule gets its authority', () => {
    for (const rule of UML_RULES) {
      expect(rule.provenance, rule.id).toBeDefined();
      expect(rule.provenance!.reference, rule.id).toBeTruthy();
      expect(
        ['standard', 'recommendation', 'labre-convention'],
        rule.id
      ).toContain(rule.provenance!.source);
      // `organization` is reserved for the org profiles the PRD names, and no
      // framework declares one yet.
      expect(rule.provenance!.source, rule.id).not.toBe('organization');
    }
  });

  it('cites a clause for every STANDARD rule, and owns every convention', () => {
    const byProvenance = (source: string) =>
      UML_RULES.filter(rule => rule.provenance?.source === source)
        .map(rule => rule.id)
        .sort();

    // The ten that restate a normative sentence, and exactly those.
    expect(STANDARD_RULES).toHaveLength(17);
    expect(byProvenance('standard')).toEqual([...STANDARD_RULES].sort());
    // The three that are OURS — membership on this canvas, a usage remark, and
    // the role-less connector this whiteboard can produce and the notation never
    // anticipated. Each says so in the citation itself, so a reader of the
    // bubble is never told UML forbids what UML does not.
    expect(byProvenance('labre-convention')).toEqual(
      [
        ELEMENT_OUTSIDE_FRAME,
        USE_CASE_NO_ACTOR,
        UNTYPED_EDGE,
        NODE_IN_PARTITION,
      ].sort()
    );
    for (const rule of UML_RULES) {
      const { source, reference } = rule.provenance!;
      if (source === 'labre-convention') {
        expect(reference, rule.id).toMatch(/Labre/);
      } else {
        // A clause of the specification, named so the user can weigh it.
        expect(reference, rule.id).toMatch(/OMG UML 2\.5\.1/);
      }
    }
  });

  it('keeps provenance PURELY descriptive', () => {
    // No evaluator reads it, so a rule with the field and the same rule without
    // it must reach the same verdict.
    const stripped = UML_RULES.map(rule => {
      const { provenance: _dropped, ...rest } = rule;
      return rest;
    });
    const sheet = [
      frame('class'),
      klass('a', 100, 200),
      name('a-name', ''),
      iface('b', 400, 200),
      edge('g', UML_ROLE.generalization, 'a', 'b'),
    ];
    expect(evaluateRules(stripped, sheet)).toEqual(
      evaluateRules(UML_RULES, sheet)
    );
    expect(evaluateCheckup(stripped, sheet)).toEqual(
      evaluateCheckup(UML_RULES, sheet)
    );
    // ...and the check-up half actually found something, so the comparison is
    // not two empty arrays agreeing.
    expect(evaluateCheckup(UML_RULES, sheet).length).toBeGreaterThan(0);
  });

  it('keeps the naming checks off the drawing path', () => {
    // Naming is what a user does by TYPING, and a UML artefact has up to three
    // compartments: a real-time rule of this family would re-evaluate on every
    // keystroke in every one of them.
    const onDemand = UML_RULES.filter(rule => rule.moment === 'on-demand');
    // …and the two GRAPH WALKS, which are off it for a different reason: a
    // reachability sweep is O(V + E), cannot be made incremental even in
    // principle, and answers a question somebody asks about a finished diagram.
    expect(onDemand.map(rule => rule.id).sort()).toEqual(
      [
        UNNAMED_CLASSIFIER,
        UNNAMED_ACTOR_OR_USE_CASE,
        UNREACHABLE_ACTION,
        UNREACHABLE_STATE,
      ].sort()
    );
    // Absent everywhere else, which is what `'realtime'` means: the default is
    // never restated, so nobody has to wonder whether an omission was a choice.
    for (const rule of UML_RULES) {
      if (onDemand.includes(rule)) continue;
      expect(rule.moment, rule.id).toBeUndefined();
    }
  });

  /**
   * The ALPHABET and the grammar are two tables, and exactly one rule may hold a
   * restrictive one — the trap C4's suite caught twice.
   */
  it('keeps the alphabets and the grammars apart', () => {
    const byId = new Map(UML_RULES.map(rule => [rule.id, rule]));
    // Twelve roles, a hundred and forty-four ordered pairs: the neutral rule's
    // matrix judges nothing, which is what makes `flagNeutral` its single
    // verdict. Six of the twelve arrived with the structural sheets — a wiring
    // gesture between two ports is exactly the line §11.6.4 expects to be typed.
    // Twenty-one roles now, and the nine the behaviour sheets added are why a
    // quick-connected wire between two actions is a finding.
    expect(UML_ELEMENT_MATRIX).toHaveLength(441);
    expect(byId.get(UNTYPED_EDGE)?.endpoints?.allowed).toBe(UML_ELEMENT_MATRIX);
    expect(byId.get(UNTYPED_EDGE)?.endpoints?.flagNeutral).toBeDefined();
    expect(byId.get(UNTYPED_EDGE)?.endpoints?.forbidSelfLoop).toBeUndefined();

    // Four roles, sixteen pairs, ONE removal — §18.1.3's, and the reason the
    // association rule has exactly one thing it can say.
    expect(UML_ASSOCIATION_MATRIX).toHaveLength(15);
    expect(
      UML_ASSOCIATION_MATRIX.some(
        triplet =>
          triplet.source === UML_ROLE.actor && triplet.target === UML_ROLE.actor
      )
    ).toBe(false);
    expect(byId.get(ACTOR_ACTOR_ASSOCIATION)?.endpoints?.allowed).toBe(
      UML_ASSOCIATION_MATRIX
    );

    // The loop rule takes the permissive alphabet, never the grammar: five
    // roles, twenty-five pairs, nothing off it.
    expect(UML_GENERALIZATION_ALPHABET).toHaveLength(25);
    expect(byId.get(GENERALIZATION_SELF_LOOP)?.endpoints?.allowed).toBe(
      UML_GENERALIZATION_ALPHABET
    );
    expect(byId.get(GENERALIZATION_SELF_LOOP)?.endpoints?.forbidSelfLoop).toBe(
      true
    );
    // ...and carries no `selfLoop` override, so its own words are what a user
    // reads.
    expect(
      byId.get(GENERALIZATION_SELF_LOOP)?.endpoints?.selfLoop
    ).toBeUndefined();
    // Exactly one rule holds the generalization grammar, and it forbids no loop.
    const holders = UML_RULES.filter(
      rule => rule.endpoints?.allowed === UML_GENERALIZATION_MATRIX
    );
    expect(holders.map(rule => rule.id)).toEqual([GENERALIZATION_ENDPOINTS]);
    expect(
      byId.get(GENERALIZATION_ENDPOINTS)?.endpoints?.forbidSelfLoop
    ).toBeUndefined();
  });

  /**
   * The ALPHABET entries — the device the file header explains at length.
   *
   * Two grammar tables carry a triplet whose EDGE role is not the rule's own.
   * They are true sentences of the notation, they can never sanction the edge
   * their rule reads (the family matches a triplet's edge with `roleIsA`), and
   * without them the rules that hold them could never fire at all: an end whose
   * role is outside the alphabet is not evaluated.
   */
  it('widens two alphabets with sentences of another edge', () => {
    const byId = new Map(UML_RULES.map(rule => [rule.id, rule]));
    const foreign = (allowed: readonly { edge: string }[], own: string) =>
      allowed.filter(triplet => triplet.edge !== own);

    expect(foreign(UML_GENERALIZATION_MATRIX, UML_ROLE.generalization)).toEqual(
      [
        {
          source: UML_ROLE.object,
          edge: UML_ROLE.association,
          target: UML_ROLE.object,
        },
      ]
    );
    // Both use case rules read ONE table, each seeing the slice its own edge
    // role selects — and the two association triplets serve neither.
    const useCaseTable = byId.get(INCLUDE_ENDPOINTS)?.endpoints?.allowed;
    expect(byId.get(EXTEND_ENDPOINTS)?.endpoints?.allowed).toBe(useCaseTable);
    expect(
      foreign(useCaseTable ?? [], UML_ROLE.include).map(triplet => triplet.edge)
    ).toEqual([UML_ROLE.extend, UML_ROLE.association, UML_ROLE.association]);
  });

  it('says nothing at all about a conformant class diagram', () => {
    expect(evaluate(conformantClass())).toEqual([]);
  });

  it('says nothing at all about a conformant use case diagram', () => {
    expect(evaluate(conformantUseCase())).toEqual([]);
  });

  it('says nothing about a diagram drawn before the roles existed', () => {
    // Every artefact role-less: never evaluated, never a word (PRD principle 8).
    expect(
      evaluate([
        legacyFrame(),
        element('a', [100, 100, 200, 120]),
        element('b', [400, 100, 200, 120]),
        element('r', [200, 150, 300, 1], undefined, {
          source: 'a',
          target: 'b',
        }),
      ])
    ).toEqual([]);
  });

  it('says nothing about a lone node on bare canvas', () => {
    // R22: no frame, no membership question and no admissibility question — a
    // croquis drawn before anybody decided which sheet it belongs to is left
    // alone by every rule that needs a frame to be about.
    expect(evaluate([klass('a')])).toEqual([]);
    expect(evaluate([klass('a'), name('a-name', 'Order')])).toEqual([]);
    // The DEGREE rules are the exception, and it is the family's own reading
    // rather than an oversight: a count needs no frame, so a use case nobody has
    // joined to an actor is a remark wherever it is drawn — exactly as C4's
    // isolation rules speak on a board with no C4 board under them.
    expect(
      idsOf(evaluate([useCase('u'), label('u-label', 'Place an order')]))
    ).toEqual([USE_CASE_NO_ACTOR]);
  });

  /**
   * ADR 0018, pinned where a reader of the pack will look for it.
   *
   * A connector carries ONE label today, so phase 1 puts the name and the
   * «stereotype» in the centre and the end multiplicities are free text the
   * author places. No rule here asks an association for words — the C4 pack's
   * `unlabeled-relationship` has no counterpart — because the thing UML would
   * want written is written at the ENDS, and asking for it in the middle would be
   * asking the author to draw the notation wrongly so the tool could check it.
   */
  it('asks nothing of an association with no label', () => {
    expect(
      evaluate([
        frame('class'),
        klass('a', 100, 200),
        name('a-name', 'Order', 100, 210),
        klass('b', 100, 400),
        name('b-name', 'OrderLine', 100, 410),
        // No `text` anywhere on the line, and none of the sixteen minds.
        assoc('r', 'a', 'b'),
      ])
    ).toEqual([]);
  });
});

describe('U1 · a classifier drawn beside the frame', () => {
  it('flags a class parked off the sheet', () => {
    const violations = evaluate([
      frame('class'),
      klass('away', 2000, 300),
      name('away-name', 'Elsewhere', 2000, 440),
    ]);
    expect(idsOf(violations)).toEqual([ELEMENT_OUTSIDE_FRAME]);
    expect(violations[0].elementIds).toEqual(['away']);
    // Attributed to the frame it is nearest to — where the arbitration lives.
    expect(violations[0].backgroundId).toBe('frame');
  });

  it('reaches the interface and the enumeration through the parent role', () => {
    for (const artefact of [iface('x', 2000, 300), enumeration('x', 2000, 300)])
      expect(
        only(evaluate([frame('class'), artefact]), ELEMENT_OUTSIDE_FRAME),
        String(artefact.role)
      ).toHaveLength(1);
  });

  /**
   * The KNOWN LIMIT, pinned so it stays a decision rather than a surprise.
   *
   * `element-in-background` names ONE subject role and UML declares no ancestor
   * meaning "any artefact" (`rules.ts` says why `uml:object` and `uml:package`
   * are deliberately outside `uml:classifier`). So the six other artefacts drawn
   * beside the frame raise nothing at all.
   */
  it('says nothing about the six artefacts that are not classifiers', () => {
    for (const artefact of [
      object('x', 2000, 300),
      pkg('x', 2000, 300),
      note('x', 2000, 300),
      actor('x', 2000, 300),
      useCase('x', 2000, 300),
    ]) {
      expect(
        only(evaluate([frame('class'), artefact]), ELEMENT_OUTSIDE_FRAME),
        String(artefact.role)
      ).toEqual([]);
    }
  });

  it('says nothing when there is no frame on the board at all', () => {
    expect(evaluate([klass('away', 2000, 300)])).toEqual([]);
  });
});

describe('U2 · what each kind of diagram draws', () => {
  /**
   * The deny-lists, spelled out — the whole content of the rule, and the place a
   * reviewer checks that a class diagram still welcomes an instance beside the
   * classifier it illustrates.
   */
  it('accepts a class diagram’s own vocabulary and refuses §18’s', () => {
    for (const artefact of [
      klass('x', 200, 200),
      iface('x', 200, 200),
      enumeration('x', 200, 200),
      object('x', 200, 200),
      pkg('x', 200, 200),
      note('x', 200, 200),
    ]) {
      expect(
        only(evaluate([frame('class'), artefact]), NOT_ADMISSIBLE_ON_KIND),
        String(artefact.role)
      ).toEqual([]);
    }
    for (const artefact of [
      actor('x', 200, 200),
      useCase('x', 200, 200),
      subject('x', 200, 200),
    ]) {
      const found = only(
        evaluate([frame('class'), artefact]),
        NOT_ADMISSIBLE_ON_KIND
      );
      expect(
        found.map(violation => violation.elementIds),
        String(artefact.role)
      ).toEqual([['x']]);
      // Attributed to the SHEET: the view is the subject of the question.
      expect(found[0].backgroundId).toBe('frame');
    }
  });

  it('accepts a use case diagram’s own vocabulary and refuses the class one', () => {
    for (const artefact of [
      actor('x', 200, 200),
      useCase('x', 200, 200),
      subject('x', 200, 200),
      note('x', 200, 200),
    ]) {
      expect(
        only(evaluate([frame('uc'), artefact]), NOT_ADMISSIBLE_ON_KIND),
        String(artefact.role)
      ).toEqual([]);
    }
    for (const artefact of [
      klass('x', 200, 200),
      iface('x', 200, 200),
      enumeration('x', 200, 200),
      object('x', 200, 200),
      pkg('x', 200, 200),
    ]) {
      expect(
        only(evaluate([frame('uc'), artefact]), NOT_ADMISSIBLE_ON_KIND).map(
          violation => violation.elementIds
        ),
        String(artefact.role)
      ).toEqual([['x']]);
    }
  });

  it('refuses the instance on a package diagram and the classifiers on an object one', () => {
    expect(
      only(
        evaluate([frame('pkg'), object('x', 200, 200)]),
        NOT_ADMISSIBLE_ON_KIND
      )
    ).toHaveLength(1);
    // …and the package itself is what a pkg sheet is for.
    expect(
      only(evaluate([frame('pkg'), pkg('x', 200, 200)]), NOT_ADMISSIBLE_ON_KIND)
    ).toEqual([]);
    // The three classifiers reach the `obj` list through the parent role; the
    // instance is the whole point of the sheet.
    for (const artefact of [
      klass('x', 200, 200),
      iface('x', 200, 200),
      enumeration('x', 200, 200),
    ]) {
      expect(
        only(evaluate([frame('obj'), artefact]), NOT_ADMISSIBLE_ON_KIND),
        String(artefact.role)
      ).toHaveLength(1);
    }
    expect(
      only(
        evaluate([frame('obj'), object('x', 200, 200)]),
        NOT_ADMISSIBLE_ON_KIND
      )
    ).toEqual([]);
  });

  it('accepts a component diagram’s own vocabulary and refuses the cubes', () => {
    for (const artefact of [
      component('x', 200, 200),
      port('x', 200, 200),
      providedInterface('x', 200, 200),
      requiredInterface('x', 200, 200),
      // An interface drawn as a full rectangle instead of a ball — §11.6.4
      // offers both, "for displaying the full signature".
      iface('x', 200, 200),
      klass('x', 200, 200),
      // The artefacts that manifest a component: §11.6.5's "white box" figure
      // lists them in a compartment of the component itself.
      artifact('x', 200, 200),
      pkg('x', 200, 200),
      note('x', 200, 200),
    ]) {
      expect(
        only(evaluate([frame('cmp'), artefact]), NOT_ADMISSIBLE_ON_KIND),
        String(artefact.role)
      ).toEqual([]);
    }
    for (const artefact of [
      actor('x', 200, 200),
      useCase('x', 200, 200),
      subject('x', 200, 200),
      object('x', 200, 200),
      // The three cubes, reached through the PARENT role — which is also this
      // spec's proof that `roles.ts` really parents the device and the
      // execution environment on `uml:node`.
      cube('x', 200, 200),
      device('x', 200, 200),
      executionEnvironment('x', 200, 200),
    ]) {
      expect(
        only(evaluate([frame('cmp'), artefact]), NOT_ADMISSIBLE_ON_KIND).map(
          violation => violation.elementIds
        ),
        String(artefact.role)
      ).toEqual([['x']]);
    }
  });

  it('accepts a deployment diagram’s own vocabulary and refuses the classifiers', () => {
    for (const artefact of [
      cube('x', 200, 200),
      device('x', 200, 200),
      executionEnvironment('x', 200, 200),
      artifact('x', 200, 200),
      // §19.4.4's Figure 19.16 draws deployed COMPONENT artefacts on a node, so
      // a component is exactly what belongs on this sheet.
      component('x', 200, 200),
      port('x', 200, 200),
      pkg('x', 200, 200),
      note('x', 200, 200),
    ]) {
      expect(
        only(evaluate([frame('dep'), artefact]), NOT_ADMISSIBLE_ON_KIND),
        String(artefact.role)
      ).toEqual([]);
    }
    for (const artefact of [
      actor('x', 200, 200),
      useCase('x', 200, 200),
      subject('x', 200, 200),
      object('x', 200, 200),
      klass('x', 200, 200),
      iface('x', 200, 200),
      enumeration('x', 200, 200),
    ]) {
      expect(
        only(evaluate([frame('dep'), artefact]), NOT_ADMISSIBLE_ON_KIND).map(
          violation => violation.elementIds
        ),
        String(artefact.role)
      ).toEqual([['x']]);
    }
  });

  it('judges every kind the picker offers, and only those', () => {
    const judged = new Set(
      UML_RULES.flatMap(rule =>
        Object.keys(rule.admissibility?.forbidden ?? {})
      )
    );
    const offered = UML_DIAGRAM_KIND_MENU.options.map(option =>
      String(option.kind)
    );
    expect([...judged].sort()).toEqual([...offered].sort());
    // Every declared kind says something, or it would not be declared: an empty
    // list is data that can never fire.
    for (const rule of UML_RULES) {
      for (const [kind, roles] of Object.entries(
        rule.admissibility?.forbidden ?? {}
      )) {
        expect(roles.length, `${rule.id} · ${kind}`).toBeGreaterThan(0);
      }
    }
  });

  it('says nothing about a kind this build does not know', () => {
    // A LATER phase's value on this build, or an import. An unrecognised kind is
    // a kind the rule has nothing to say about, never a reason to guess — which
    // is exactly what a phase-1 build did with the `cmp` frame and a phase-2 one
    // with `act`, and what this build does with the sequence diagram's `sd`.
    expect(
      only(
        evaluate([frame('sd'), klass('x', 200, 200), actor('y', 500, 200)]),
        NOT_ADMISSIBLE_ON_KIND
      )
    ).toEqual([]);
  });

  it('says nothing about an artefact drawn outside the frame', () => {
    // The family judges a subject against the frame whose plot contains its
    // centre, so a box beside the sheet is U1's business and not this rule's.
    expect(
      only(
        evaluate([frame('class'), actor('x', 2000, 300)]),
        NOT_ADMISSIBLE_ON_KIND
      )
    ).toEqual([]);
  });
});

describe('U3 · a use case outside the subject', () => {
  it('flags an ellipse drawn beside the rectangle', () => {
    const violations = evaluate([
      frame('uc'),
      subject(),
      useCase('u', 200, 600),
      label('u-label', 'Place an order', 200, 700),
    ]);
    expect(idsOf(violations)).toEqual([
      USE_CASE_NO_ACTOR,
      USE_CASE_OUTSIDE_SUBJECT,
    ]);
    const outside = only(violations, USE_CASE_OUTSIDE_SUBJECT)[0];
    expect(outside.elementIds).toEqual(['u']);
    expect(outside.backgroundId).toBe('subj');
  });

  it('says nothing when no subject has been drawn', () => {
    // Most use case diagrams never draw one, and one that is still being argued
    // about has not been drawn YET. Both are sketches.
    expect(
      only(
        evaluate([frame('uc'), useCase('u', 200, 600)]),
        USE_CASE_OUTSIDE_SUBJECT
      )
    ).toEqual([]);
  });

  it('says nothing about a use case inside one', () => {
    expect(
      only(evaluate(conformantUseCase()), USE_CASE_OUTSIDE_SUBJECT)
    ).toEqual([]);
  });
});

describe('U4 · an actor inside the subject', () => {
  it('flags a stick figure drawn inside the system', () => {
    const violations = evaluate([
      frame('uc'),
      subject(),
      actor('p', 800, 280),
      label('p-label', 'Customer', 780, 410),
      useCase('u', 760, 250),
      label('u-label', 'Place an order', 770, 290),
      assoc('r', 'p', 'u'),
    ]);
    expect(idsOf(violations)).toEqual([ACTOR_INSIDE_SUBJECT]);
    expect(violations[0].elementIds).toEqual(['p']);
    expect(violations[0].backgroundId).toBe('subj');
  });

  it('says nothing about an actor beside the subject', () => {
    expect(only(evaluate(conformantUseCase()), ACTOR_INSIDE_SUBJECT)).toEqual(
      []
    );
  });

  it('says nothing about an actor straddling the edge', () => {
    // `element-in-zone` judges a subject against the frame that CONTAINS it, so
    // half in and half out is left alone.
    expect(
      only(
        evaluate([frame('uc'), subject(), actor('p', 660, 260)]),
        ACTOR_INSIDE_SUBJECT
      )
    ).toEqual([]);
  });

  it('says nothing when no subject has been drawn', () => {
    expect(
      only(evaluate([frame('uc'), actor('p', 800, 280)]), ACTOR_INSIDE_SUBJECT)
    ).toEqual([]);
  });
});

describe('U5 · a name compartment somebody emptied', () => {
  it('flags an emptied name, on demand', () => {
    const violations = checkup([
      frame('class'),
      klass('a', 100, 200),
      name('a-name', ''),
    ]);
    expect(idsOf(violations)).toEqual([UNNAMED_CLASSIFIER]);
    // The finding lands on the COMPARTMENT — that is the element the author
    // edits.
    expect(violations[0].elementIds).toEqual(['a-name']);
  });

  it('says nothing on the drawing path', () => {
    expect(
      drawing([frame('class'), klass('a', 100, 200), name('a-name', '')])
    ).toEqual([]);
  });

  it('counts whitespace as no name at all', () => {
    expect(
      idsOf(
        checkup([frame('class'), klass('a', 100, 200), name('a-name', ' ')])
      )
    ).toEqual([UNNAMED_CLASSIFIER]);
  });

  it('says nothing about a freshly dropped artefact, which is PROMPTED', () => {
    // `actions.ts` seeds the stencil's own line into every tier at creation, so
    // a box reading "«interface» Interface" is a box whose author has not
    // finished — not a box with no name.
    expect(
      only(
        checkup([
          frame('class'),
          iface('a', 100, 200),
          name('a-name', '«interface»\nInterface'),
        ]),
        UNNAMED_CLASSIFIER
      )
    ).toEqual([]);
  });

  it('reaches the package and the note, which carry the same tier role', () => {
    for (const artefact of [pkg('x', 200, 200), note('x', 200, 200)]) {
      expect(
        only(
          checkup([frame('class'), artefact, name('x-name', '')]),
          UNNAMED_CLASSIFIER
        ),
        String(artefact.role)
      ).toHaveLength(1);
    }
  });

  /**
   * ADR-level silence, and the rule's known limit: delete the compartment rather
   * than empty it and there is no `uml:name` on the sheet for the rule to be
   * about. Closing it means asking a question about GROUP membership, which no
   * family expresses today.
   */
  it('says nothing when the compartment is DELETED rather than emptied', () => {
    expect(checkup([frame('class'), klass('a', 100, 200)])).toEqual([]);
  });

  it('ignores the frames, whose words are the user’s own', () => {
    // Neither frame carries a name COMPARTMENT: a sheet and a subject write the
    // user's own words on themselves, and an untitled one is a frame somebody
    // has not titled yet.
    expect(checkup([frame('uc'), subject()])).toEqual([]);
  });
});

describe('U6 · an actor’s or a use case’s one word, emptied', () => {
  it('flags an emptied label on either artefact', () => {
    for (const artefact of [actor('x', 200, 200), useCase('x', 200, 200)]) {
      const found = only(
        checkup([frame('uc'), artefact, label('x-label', '')]),
        UNNAMED_ACTOR_OR_USE_CASE
      );
      // ONCE, and this is the assertion the merge exists for: the two artefacts
      // carry the SAME tier role, so two rules would report one emptied word
      // twice, with one sentence always about the wrong shape.
      expect(
        found.map(violation => violation.elementIds),
        String(artefact.role)
      ).toEqual([['x-label']]);
    }
  });

  it('says nothing about a name compartment, which is U5’s subject', () => {
    expect(
      only(
        checkup([frame('class'), klass('a', 100, 200), name('a-name', '')]),
        UNNAMED_ACTOR_OR_USE_CASE
      )
    ).toEqual([]);
  });

  it('says nothing on the drawing path', () => {
    expect(
      only(
        drawing([frame('uc'), actor('x', 200, 200), label('x-label', '')]),
        UNNAMED_ACTOR_OR_USE_CASE
      )
    ).toEqual([]);
  });
});

describe('U7 · what a generalization may run between', () => {
  it('flags a triangle drawn from a class to an interface', () => {
    const violations = evaluate([
      frame('class'),
      klass('a', 100, 200),
      iface('b', 400, 200),
      edge('g', UML_ROLE.generalization, 'a', 'b'),
    ]);
    expect(idsOf(violations)).toEqual([GENERALIZATION_ENDPOINTS]);
    expect(violations[0].elementIds).toEqual(['a', 'b', 'g']);
  });

  it('flags a generalization pointing at an INSTANCE', () => {
    // The alphabet entry earning its place: without `uml:object` in the table
    // this would be outside the alphabet and silent.
    expect(
      only(
        evaluate([
          frame('class'),
          klass('a', 100, 200),
          object('o', 400, 200),
          edge('g', UML_ROLE.generalization, 'a', 'o'),
        ]),
        GENERALIZATION_ENDPOINTS
      )
    ).toHaveLength(1);
  });

  it('says nothing about like specialising like', () => {
    for (const [artefact, other] of [
      [klass('a', 100, 200), klass('b', 400, 200)],
      [iface('a', 100, 200), iface('b', 400, 200)],
      [actor('a', 100, 200), actor('b', 400, 200)],
      [useCase('a', 100, 200), useCase('b', 400, 200)],
    ]) {
      expect(
        only(
          evaluate([
            frame('class'),
            artefact,
            other,
            edge('g', UML_ROLE.generalization, 'a', 'b'),
          ]),
          GENERALIZATION_ENDPOINTS
        ),
        String(artefact.role)
      ).toEqual([]);
    }
  });

  it('says nothing about an end outside the alphabet', () => {
    // A generalization drawn onto a package, a note or a neutral shape is
    // somebody sketching, and the grammar stays out of it.
    for (const other of [
      pkg('b', 400, 200),
      note('b', 400, 200),
      sketch('b'),
    ]) {
      expect(
        evaluate([
          frame('class'),
          klass('a', 100, 200),
          other,
          edge('g', UML_ROLE.generalization, 'a', 'b'),
        ]).filter(violation => violation.ruleId === GENERALIZATION_ENDPOINTS),
        String(other.role)
      ).toEqual([]);
    }
  });

  it('says nothing about a self-loop — that is U8', () => {
    expect(
      only(
        evaluate([
          frame('class'),
          klass('a', 100, 200),
          edge('g', UML_ROLE.generalization, 'a', 'a'),
        ]),
        GENERALIZATION_ENDPOINTS
      )
    ).toEqual([]);
  });
});

describe('U8 · a generalization looped onto its own classifier', () => {
  it('flags the loop, and only the loop', () => {
    const violations = evaluate([
      frame('class'),
      klass('a', 100, 200),
      edge('g', UML_ROLE.generalization, 'a', 'a'),
    ]);
    expect(idsOf(violations)).toEqual([GENERALIZATION_SELF_LOOP]);
    expect(violations[0].elementIds).toEqual(['a', 'g']);
    expect(violations[0].messageKey).toBe(
      'com.labre.uml.validation.generalization-self-loop'
    );
  });

  it('says nothing about a loop on something outside the alphabet', () => {
    // The alphabet GATE runs before the self-loop test.
    expect(
      evaluate([
        frame('class'),
        pkg('p', 200, 200),
        edge('g', UML_ROLE.generalization, 'p', 'p'),
      ])
    ).toEqual([]);
  });

  it('says nothing about an ordinary generalization', () => {
    expect(
      only(
        evaluate([
          frame('class'),
          klass('a', 100, 200),
          klass('b', 400, 200),
          edge('g', UML_ROLE.generalization, 'a', 'b'),
        ]),
        GENERALIZATION_SELF_LOOP
      )
    ).toEqual([]);
  });
});

describe('U9 · a realization that misses its interface', () => {
  it('flags a dashed triangle drawn between two classes', () => {
    const violations = evaluate([
      frame('class'),
      klass('a', 100, 200),
      klass('b', 400, 200),
      edge('r', UML_ROLE.realization, 'a', 'b'),
    ]);
    expect(idsOf(violations)).toEqual([REALIZATION_ENDPOINTS]);
    expect(violations[0].elementIds).toEqual(['a', 'b', 'r']);
  });

  it('says nothing about a class realizing an interface', () => {
    expect(
      evaluate([
        frame('class'),
        klass('a', 100, 200),
        iface('b', 400, 200),
        edge('r', UML_ROLE.realization, 'a', 'b'),
      ])
    ).toEqual([]);
  });

  it('says nothing about an end the alphabet does not speak of', () => {
    expect(
      evaluate([
        frame('class'),
        klass('a', 100, 200),
        pkg('b', 400, 200),
        edge('r', UML_ROLE.realization, 'a', 'b'),
      ])
    ).toEqual([]);
  });
});

describe('U10 · a dependency pointing at an instance', () => {
  it('flags the arrow', () => {
    const violations = evaluate([
      frame('class'),
      klass('a', 100, 200),
      object('o', 400, 200),
      edge('d', UML_ROLE.dependency, 'a', 'o'),
    ]);
    expect(idsOf(violations)).toEqual([DEPENDENCY_ON_OBJECT]);
    expect(violations[0].elementIds).toEqual(['a', 'd', 'o']);
  });

  it('says nothing about an instance that depends on something', () => {
    // The object is a legal SOURCE and never a legal target.
    expect(
      evaluate([
        frame('class'),
        object('o', 100, 200),
        klass('a', 400, 200),
        edge('d', UML_ROLE.dependency, 'o', 'a'),
      ])
    ).toEqual([]);
  });

  it('says nothing about the ordinary dependencies', () => {
    expect(
      evaluate([
        frame('pkg'),
        pkg('p1', 100, 200),
        pkg('p2', 400, 200),
        edge('d', UML_ROLE.dependency, 'p1', 'p2'),
      ])
    ).toEqual([]);
  });
});

describe('U11–U12 · include and extend run between use cases', () => {
  it('flags an include and an extend drawn from an actor', () => {
    for (const [role, ruleId] of [
      [UML_ROLE.include, INCLUDE_ENDPOINTS],
      [UML_ROLE.extend, EXTEND_ENDPOINTS],
    ] as const) {
      const violations = evaluate([
        frame('uc'),
        actor('p', 200, 200),
        useCase('u', 500, 200),
        edge('e', role, 'p', 'u'),
      ]);
      expect(
        only(violations, ruleId).map(v => v.elementIds),
        role
      ).toEqual([['e', 'p', 'u']]);
      // ...and the OTHER rule says nothing: the two edge roles are flat
      // siblings, so neither reaches the other's edges.
      const sibling =
        ruleId === INCLUDE_ENDPOINTS ? EXTEND_ENDPOINTS : INCLUDE_ENDPOINTS;
      expect(only(violations, sibling), role).toEqual([]);
    }
  });

  it('says nothing about an include or an extend between two use cases', () => {
    for (const role of [UML_ROLE.include, UML_ROLE.extend]) {
      expect(
        evaluate([
          frame('uc'),
          useCase('u1', 200, 200),
          label('u1-label', 'Place an order', 200, 300),
          useCase('u2', 500, 200),
          label('u2-label', 'Pay', 500, 300),
          actor('p', 100, 500),
          label('p-label', 'Customer', 100, 640),
          assoc('a1', 'p', 'u1'),
          assoc('a2', 'p', 'u2'),
          edge('e', role, 'u1', 'u2'),
        ]),
        role
      ).toEqual([]);
    }
  });

  it('says nothing about an end outside the alphabet', () => {
    expect(
      evaluate([
        frame('uc'),
        useCase('u', 500, 200),
        note('n', 200, 200),
        label('u-label', 'Place an order', 500, 300),
        edge('e', UML_ROLE.include, 'n', 'u'),
        actor('p', 100, 500),
        label('p-label', 'Customer', 100, 640),
        assoc('a', 'p', 'u'),
      ])
    ).toEqual([]);
  });
});

describe('U13 · an association between two actors', () => {
  it('flags the line', () => {
    const violations = evaluate([
      frame('uc'),
      actor('p1', 200, 200),
      actor('p2', 500, 200),
      assoc('a', 'p1', 'p2'),
    ]);
    expect(idsOf(violations)).toEqual([ACTOR_ACTOR_ASSOCIATION]);
    expect(violations[0].elementIds).toEqual(['a', 'p1', 'p2']);
  });

  it('says nothing about a generalization between two actors, which is legal', () => {
    expect(
      evaluate([
        frame('uc'),
        actor('p1', 200, 200),
        actor('p2', 500, 200),
        edge('g', UML_ROLE.generalization, 'p1', 'p2'),
      ])
    ).toEqual([]);
  });

  it('reaches the two diamonds, which specialise the association', () => {
    // §11.5.4: an aggregation and a composition ARE associations, so `roleIsA`
    // brings them in and one grammar judges all three.
    for (const role of [UML_ROLE.aggregation, UML_ROLE.composition]) {
      expect(
        only(
          evaluate([
            frame('uc'),
            actor('p1', 200, 200),
            actor('p2', 500, 200),
            edge('a', role, 'p1', 'p2'),
          ]),
          ACTOR_ACTOR_ASSOCIATION
        ),
        role
      ).toHaveLength(1);
    }
  });

  it('says nothing about the associations UML sanctions', () => {
    expect(
      only(evaluate(conformantUseCase()), ACTOR_ACTOR_ASSOCIATION)
    ).toEqual([]);
    expect(only(evaluate(conformantClass()), ACTOR_ACTOR_ASSOCIATION)).toEqual(
      []
    );
  });
});

describe('U17 · what a deployment may run between', () => {
  it('flags a «deploy» drawn from a component', () => {
    // The drawing this rule exists for: what reaches a machine is the artefact,
    // and the component is what that artefact manifests (§19.3.3).
    const violations = evaluate([
      frame('dep'),
      component('c', 100, 200),
      cube('n', 600, 200),
      edge('d', UML_ROLE.deploy, 'c', 'n'),
    ]);
    expect(idsOf(violations)).toEqual([DEPLOY_ENDPOINTS]);
    // The family reports the two ends AND the line, sorted — the finding is
    // about a sentence, so selecting it selects the whole sentence.
    expect(violations[0].elementIds).toEqual(['c', 'n', 'd'].sort());
  });

  it('flags a deployment aimed at anything but a cube', () => {
    for (const target of [component('t', 600, 200), artifact('t', 600, 200)]) {
      expect(
        only(
          evaluate([
            frame('dep'),
            artifact('a', 100, 200),
            target,
            edge('d', UML_ROLE.deploy, 'a', 't'),
          ]),
          DEPLOY_ENDPOINTS
        ),
        String(target.role)
      ).toHaveLength(1);
    }
  });

  it('says nothing about an artefact deployed on any of the three cubes', () => {
    for (const target of [
      cube('n', 600, 200),
      device('n', 600, 200),
      executionEnvironment('n', 600, 200),
    ]) {
      expect(
        only(
          evaluate([
            frame('dep'),
            artifact('a', 100, 200),
            target,
            edge('d', UML_ROLE.deploy, 'a', 'n'),
          ]),
          DEPLOY_ENDPOINTS
        ),
        String(target.role)
      ).toEqual([]);
    }
  });

  it('says nothing about an end outside the alphabet', () => {
    // A «deploy» dragged onto a package, a note or a shape somebody thought
    // with is not a sentence of §19 at all, and the grammar stays out of it.
    for (const other of [
      pkg('t', 600, 200),
      note('t', 600, 200),
      sketch('t'),
    ]) {
      expect(
        only(
          evaluate([
            frame('dep'),
            artifact('a', 100, 200),
            other,
            edge('d', UML_ROLE.deploy, 'a', 't'),
          ]),
          DEPLOY_ENDPOINTS
        ),
        String(other.role)
      ).toEqual([]);
    }
  });

  it('says nothing at all about a conformant deployment diagram', () => {
    expect(evaluate(conformantDeployment())).toEqual([]);
  });
});

describe('U18 · what a manifestation may run between', () => {
  it('flags a «manifest» aimed at the node instead of the component', () => {
    const violations = evaluate([
      frame('dep'),
      artifact('a', 100, 200),
      cube('n', 600, 200),
      edge('m', UML_ROLE.manifest, 'a', 'n'),
    ]);
    expect(idsOf(violations)).toEqual([MANIFEST_ENDPOINTS]);
    expect(violations[0].elementIds).toEqual(['a', 'n', 'm'].sort());
  });

  it('flags a manifestation drawn the other way round', () => {
    expect(
      only(
        evaluate([
          frame('cmp'),
          component('c', 100, 200),
          artifact('a', 600, 200),
          edge('m', UML_ROLE.manifest, 'c', 'a'),
        ]),
        MANIFEST_ENDPOINTS
      )
    ).toHaveLength(1);
  });

  it('says nothing about an artefact manifesting a component', () => {
    expect(only(evaluate(conformantComponent()), MANIFEST_ENDPOINTS)).toEqual(
      []
    );
  });

  it('never double-reports with the deployment rule', () => {
    // Flat sibling roles, one role per edge: the deploy rule reads `uml:deploy`
    // and this one `uml:manifest`, so a single wrong arrow gets a single
    // verdict with the words that fit the line the author drew.
    const violations = evaluate([
      frame('dep'),
      artifact('a', 100, 200),
      cube('n', 600, 200),
      edge('m', UML_ROLE.manifest, 'a', 'n'),
    ]);
    expect(only(violations, DEPLOY_ENDPOINTS)).toEqual([]);
  });
});

describe('U19 · what a communication path may run between', () => {
  it('flags a network line drawn onto an artefact', () => {
    const violations = evaluate([
      frame('dep'),
      cube('n', 100, 200),
      artifact('a', 600, 200),
      edge('cp', UML_ROLE['communication-path'], 'n', 'a'),
    ]);
    expect(idsOf(violations)).toEqual([COMMUNICATION_PATH_ENDPOINTS]);
    expect(violations[0].elementIds).toEqual(['n', 'a', 'cp'].sort());
  });

  it('flags a network line drawn onto a component', () => {
    expect(
      only(
        evaluate([
          frame('dep'),
          cube('n', 100, 200),
          component('c', 600, 200),
          edge('cp', UML_ROLE['communication-path'], 'n', 'c'),
        ]),
        COMMUNICATION_PATH_ENDPOINTS
      )
    ).toHaveLength(1);
  });

  it('says nothing about any two of the three cubes', () => {
    const cubes = [cube, device, executionEnvironment];
    for (const from of cubes) {
      for (const to of cubes) {
        expect(
          only(
            evaluate([
              frame('dep'),
              from('n1', 100, 200),
              to('n2', 600, 200),
              edge('cp', UML_ROLE['communication-path'], 'n1', 'n2'),
            ]),
            COMMUNICATION_PATH_ENDPOINTS
          )
        ).toEqual([]);
      }
    }
  });

  it('says nothing at all about a conformant component diagram', () => {
    expect(evaluate(conformantComponent())).toEqual([]);
  });
});

describe('U14 · a plain connector between two artefacts', () => {
  it('flags the link', () => {
    const violations = evaluate([
      frame('class'),
      klass('a', 100, 200),
      name('a-name', 'Order', 100, 330),
      klass('b', 400, 200),
      name('b-name', 'OrderLine', 400, 330),
      wire('w', 'a', 'b'),
    ]);
    expect(idsOf(violations)).toEqual([UNTYPED_EDGE]);
    expect(violations[0].elementIds).toEqual(['a', 'b', 'w']);
    expect(violations[0].messageKey).toBe(
      'com.labre.uml.validation.untyped-edge.neutral'
    );
  });

  it('says nothing about a plain connector onto a frame', () => {
    // Neither frame is in the rule's alphabet: pointing at things is what a
    // whiteboard is for.
    expect(
      evaluate([
        ...conformantUseCase(),
        wire('w1', 'p', 'subj'),
        wire('w2', 'p', 'frame'),
      ])
    ).toEqual([]);
  });

  it('says nothing about a plain connector onto a neutral drawing', () => {
    expect(
      evaluate([...conformantClass(), sketch('n'), wire('w', 'a', 'n')])
    ).toEqual([]);
  });

  it('says nothing about a connector looping onto one artefact', () => {
    // A link from an artefact to itself is not evidence that a typed
    // relationship was meant.
    expect(evaluate([...conformantClass(), wire('w', 'a', 'a')])).toEqual([]);
  });

  it('judges no sentence, so the actor pair stays U13’s finding alone', () => {
    const violations = evaluate([
      frame('uc'),
      actor('p1', 200, 200),
      actor('p2', 500, 200),
      assoc('a', 'p1', 'p2'),
    ]);
    expect(only(violations, UNTYPED_EDGE)).toEqual([]);
  });
});

describe('U15 · a part claimed by two composites', () => {
  it('flags the part, which is the TARGET end', () => {
    const violations = evaluate([
      frame('class'),
      klass('whole1', 100, 200),
      klass('whole2', 400, 200),
      klass('part', 250, 500),
      edge('c1', UML_ROLE.composition, 'whole1', 'part'),
      edge('c2', UML_ROLE.composition, 'whole2', 'part'),
    ]);
    expect(idsOf(violations)).toEqual([COMPOSITION_SINGLE_OWNER]);
    // The part, and neither of the wholes: the diamond is on the source.
    expect(violations[0].elementIds).toEqual(['part']);
  });

  it('says nothing about one composite with two parts', () => {
    expect(
      evaluate([
        frame('class'),
        klass('whole', 100, 200),
        klass('p1', 400, 200),
        klass('p2', 400, 500),
        edge('c1', UML_ROLE.composition, 'whole', 'p1'),
        edge('c2', UML_ROLE.composition, 'whole', 'p2'),
      ])
    ).toEqual([]);
  });

  it('says nothing about a part SHARED by two aggregations', () => {
    // §11.5.4's whole difference between the hollow diamond and the filled one:
    // a shared part may belong to many wholes, and this rule counts
    // `uml:composition` alone.
    expect(
      only(
        evaluate([
          frame('class'),
          klass('whole1', 100, 200),
          klass('whole2', 400, 200),
          klass('part', 250, 500),
          edge('a1', UML_ROLE.aggregation, 'whole1', 'part'),
          edge('a2', UML_ROLE.aggregation, 'whole2', 'part'),
        ]),
        COMPOSITION_SINGLE_OWNER
      )
    ).toEqual([]);
  });
});

describe('U16 · a use case no actor is associated with', () => {
  it('flags the ellipse', () => {
    const violations = checkup([
      frame('uc'),
      useCase('u', 200, 200),
      label('u-label', 'Place an order', 200, 300),
    ]);
    expect(idsOf(violations)).toEqual([USE_CASE_NO_ACTOR]);
    expect(violations[0].elementIds).toEqual(['u']);
  });

  it('is satisfied by ONE association on EITHER side', () => {
    // An association is UNDIRECTED (`roles.ts`), so the direction it was dragged
    // in is not a fact about the model and no per-direction bound is honest.
    for (const [source, target] of [
      ['p', 'u'],
      ['u', 'p'],
    ]) {
      expect(
        only(
          evaluate([
            frame('uc'),
            actor('p', 200, 200),
            label('p-label', 'Customer', 200, 330),
            useCase('u', 500, 200),
            label('u-label', 'Place an order', 500, 300),
            assoc('a', source, target),
          ]),
          USE_CASE_NO_ACTOR
        ),
        `${source} → ${target}`
      ).toEqual([]);
    }
  });

  it('says nothing about an actor nobody has connected yet', () => {
    // Dropping the figures first and joining them last is how a use case
    // diagram gets drawn: there is no isolation rule on `uml:actor`.
    expect(
      evaluate([
        frame('uc'),
        actor('p', 200, 200),
        label('p-label', 'Customer'),
      ])
    ).toEqual([]);
  });
});

describe('the level in force', () => {
  it('keeps everything an audit on the sketch default', () => {
    const sheet = [
      frame('class'),
      klass('a', 100, 200),
      iface('b', 400, 200),
      edge('g', UML_ROLE.generalization, 'a', 'b'),
    ];
    // Nothing at all on the gesture path: a level that shows no finding costs no
    // frame (PF7.6). The findings are read where a user asks for them.
    expect(drawing(sheet)).toEqual([]);
    const violations = checkup(sheet);
    expect(violations.length).toBeGreaterThan(0);
    for (const violation of violations) {
      expect(violation.severity, violation.ruleId).toBe('audit');
    }
  });

  /**
   * An unnamed PACKAGE on the sketch level, which is the default: silence on the
   * canvas, a remark in the panel.
   */
  it('says nothing on the canvas about an unnamed package in sketch', () => {
    const sheet = [frame('pkg'), pkg('p', 200, 200), name('p-name', '')];
    expect(drawing(sheet)).toEqual([]);
    expect(idsOf(checkup(sheet))).toEqual([UNNAMED_CLASSIFIER]);
    expect(checkup(sheet)[0].severity).toBe('audit');
  });

  it('promotes the specification rules on a frame set to strict', () => {
    const violations = evaluateRules(
      UML_RULES,
      [
        frame('class', 'uml.strict'),
        klass('a', 100, 200),
        iface('b', 400, 200),
        edge('g', UML_ROLE.generalization, 'a', 'b'),
      ],
      UML_PROFILES
    );
    expect(only(violations, GENERALIZATION_ENDPOINTS)[0].severity).toBe(
      'warning'
    );
  });

  it('leaves the membership remarks where they were, at the strict level too', () => {
    const remarks = evaluateCheckup(
      UML_RULES,
      [frame('class', 'uml.strict'), klass('away', 2000, 300)],
      UML_PROFILES
    );
    expect(only(remarks, ELEMENT_OUTSIDE_FRAME)[0].severity).toBe('audit');
  });
});

describe('where the level of requirement can be chosen', () => {
  it('puts the legend, the kind and the dropdown on one row, in reading order', () => {
    // `b.` and `c.` after the always-on `a.toggle-resize`, `z.` last: the user
    // sees resize, legend, the diagram's KIND, then the level of requirement,
    // whatever order the modules registered in.
    expect(
      umlDiagramToolingToolbarConfig.actions.map(action => action.id)
    ).toEqual(['b.legend', 'c.kind', 'z.validation']);
  });
});

/* ── The behaviour sheets (§15.2.4, §14.2.4) ──────────────────────────── */

describe('U20 · an action outside every swimlane', () => {
  it('flags an action drawn between the lanes', () => {
    const violations = evaluate([
      frame('act'),
      partition('lane', 100, 100),
      action('a', 700, 200),
      label('a-label', 'Ship it', 700, 340),
    ]);
    expect(idsOf(violations)).toEqual([NODE_IN_PARTITION]);
    expect(violations[0].elementIds).toEqual(['a']);
    // Attributed to the LANE the arbitration would be made on.
    expect(violations[0].backgroundId).toBe('lane');
  });

  it('says nothing when the action is in a lane', () => {
    expect(
      only(
        evaluate([
          frame('act'),
          partition('lane', 100, 100),
          action('a', 140, 200),
          label('a-label', 'Ship it', 140, 340),
        ]),
        NODE_IN_PARTITION
      )
    ).toEqual([]);
  });

  it('says nothing at all on a sheet with no lane on it', () => {
    // Most activity diagrams never draw one, and those are finished diagrams.
    expect(
      only(
        evaluate([
          frame('act'),
          action('a', 700, 200),
          label('a-label', 'Ship it', 700, 340),
        ]),
        NODE_IN_PARTITION
      )
    ).toEqual([]);
  });

  it('says nothing about the control nodes between two lanes', () => {
    // §15.6.4 draws a fork bar spanning lanes and a decision on a boundary. The
    // rule is written on the ACTION alone, and that narrowing is deliberate.
    for (const glyph of [
      decision('x', 700, 200),
      fork('x', 700, 200),
      objectNode('x', 700, 200),
    ]) {
      expect(
        only(
          evaluate([frame('act'), partition('lane', 100, 100), glyph]),
          NODE_IN_PARTITION
        ),
        String(glyph.role)
      ).toEqual([]);
    }
  });
});

describe('U21–U22 · a history outside every composite state', () => {
  it('flags each of the two histories drawn on the bare sheet', () => {
    expect(
      idsOf(
        evaluate([
          frame('stm'),
          region('r', 100, 100),
          shallowHistory('h', 900, 600),
        ])
      )
    ).toEqual([SHALLOW_HISTORY_OUTSIDE_REGION]);
    expect(
      idsOf(
        evaluate([
          frame('stm'),
          region('r', 100, 100),
          deepHistory('h', 900, 600),
        ])
      )
    ).toEqual([DEEP_HISTORY_OUTSIDE_REGION]);
  });

  it('reports one bracket per history, never two', () => {
    // TWO rules for one sentence, and the reason they compose: an element
    // carries ONE role, so exactly one of the pair can ever be about it.
    const violations = evaluate([
      frame('stm'),
      region('r', 100, 100),
      shallowHistory('h1', 900, 600),
      deepHistory('h2', 1100, 600),
    ]);
    expect(idsOf(violations)).toEqual(
      [SHALLOW_HISTORY_OUTSIDE_REGION, DEEP_HISTORY_OUTSIDE_REGION].sort()
    );
  });

  it('says nothing when the history is inside the composite state', () => {
    expect(
      evaluate([
        frame('stm'),
        region('r', 100, 100),
        shallowHistory('h', 200, 200),
      ])
    ).toEqual([]);
  });

  it('says nothing about the pseudostates that are not histories', () => {
    // The rules cannot be written on `uml:pseudostate`: that parent reaches the
    // choice, the junction, the two connection points and the terminate cross,
    // none of which is confined to a region.
    for (const glyph of [
      choice('x', 900, 600),
      junction('x', 900, 600),
      entryPoint('x', 900, 600),
      terminate('x', 900, 600),
    ]) {
      expect(
        evaluate([frame('stm'), region('r', 100, 100), glyph]),
        String(glyph.role)
      ).toEqual([]);
    }
  });

  it('says nothing at all on a sheet with no composite state', () => {
    expect(evaluate([frame('stm'), shallowHistory('h', 900, 600)])).toEqual([]);
  });
});

describe('U23 · how many beginnings one sheet draws', () => {
  it('flags the second filled disc, on the frame', () => {
    const violations = only(
      evaluate([
        frame('stm'),
        initialNode('i1', 200, 200),
        initialNode('i2', 600, 200),
      ]),
      INITIAL_SINGLE
    );
    expect(violations).toHaveLength(1);
    // No disc is at fault — there are simply two — so `role-count` raises on the
    // frame, which is where the arbitration lives.
    expect(violations[0].backgroundId).toBe('frame');
  });

  it('says nothing about one, and nothing about none', () => {
    expect(
      only(
        evaluate([frame('stm'), initialNode('i1', 200, 200)]),
        INITIAL_SINGLE
      )
    ).toEqual([]);
    expect(only(evaluate([frame('act')]), INITIAL_SINGLE)).toEqual([]);
  });
});

describe('U24–U25 · nothing arrives at the beginning', () => {
  it('flags a control flow into the disc, and a transition into it', () => {
    expect(
      idsOf(
        evaluate([
          frame('act'),
          initialNode('i', 200, 200),
          action('a', 600, 200),
          label('a-label', 'Ship it', 600, 340),
          edge('e', UML_ROLE['control-flow'], 'a', 'i'),
        ])
      )
    ).toContain(INITIAL_NO_INCOMING_FLOW);
    expect(
      idsOf(
        evaluate([
          frame('stm'),
          initialNode('i', 200, 200),
          stateNode('s', 600, 200),
          name('s-name', 'Draft', 600, 340),
          edge('e', UML_ROLE.transition, 's', 'i'),
        ])
      )
    ).toContain(INITIAL_NO_INCOMING_TRANSITION);
  });

  it('counts only its OWN edge role, so neither rule reports the other s arrow', () => {
    // `edge-degree` counts one role: the two halves never see each other's
    // edges, which is what makes the pair one requirement rather than two
    // brackets on one glyph.
    const flow = idsOf(
      evaluate([
        frame('act'),
        initialNode('i', 200, 200),
        action('a', 600, 200),
        label('a-label', 'Ship it', 600, 340),
        edge('e', UML_ROLE['control-flow'], 'a', 'i'),
      ])
    );
    expect(flow.filter(id => id === INITIAL_NO_INCOMING_TRANSITION)).toEqual(
      []
    );
  });

  it('says nothing about the arrow that LEAVES the disc', () => {
    expect(evaluate(conformantActivity())).toEqual([]);
  });
});

describe('U26–U28 · nothing leaves an end', () => {
  it('flags a control flow off an activity final and off a flow final', () => {
    for (const [glyph, ruleId] of [
      [activityFinal('z', 900, 200), ACTIVITY_FINAL_NO_OUTGOING],
      [flowFinal('z', 900, 200), FLOW_FINAL_NO_OUTGOING],
    ] as const) {
      expect(
        idsOf(
          evaluate([
            frame('act'),
            action('a', 600, 200),
            label('a-label', 'Ship it', 600, 340),
            glyph,
            edge('e', UML_ROLE['control-flow'], 'z', 'a'),
          ])
        ),
        ruleId
      ).toContain(ruleId);
    }
  });

  it('flags a transition off a final state', () => {
    expect(
      idsOf(
        evaluate([
          frame('stm'),
          stateNode('s', 200, 200),
          name('s-name', 'Draft', 200, 340),
          finalState('z', 900, 200),
          edge('e', UML_ROLE.transition, 'z', 's'),
        ])
      )
    ).toContain(FINAL_STATE_NO_OUTGOING);
  });

  it('says nothing about the arrow that ARRIVES at an end', () => {
    expect(evaluate(conformantActivity())).toEqual([]);
    expect(evaluate(conformantStateMachine())).toEqual([]);
  });

  it('says nothing about a decision or a fork, which are control nodes too', () => {
    // The rules cannot be written on `uml:control-node`: that parent covers the
    // four glyphs a flow legitimately leaves.
    for (const glyph of [decision('d', 900, 200), fork('d', 900, 200)]) {
      expect(
        idsOf(
          evaluate([
            frame('act'),
            action('a', 600, 200),
            label('a-label', 'Ship it', 600, 340),
            glyph,
            edge('e', UML_ROLE['control-flow'], 'd', 'a'),
          ])
        ).filter(id => id.endsWith('-no-outgoing')),
        String(glyph.role)
      ).toEqual([]);
    }
  });
});

describe('U29 · how many flows arrive at a decision', () => {
  it('flags the third arrow, and not the second', () => {
    const sheet = (count: number) => [
      frame('act'),
      decision('d', 600, 200),
      ...Array.from({ length: count }, (_unused, index) => [
        action(`a${index}`, 100 + index * 220, 500),
        label(`a${index}-label`, `Step ${index}`, 100 + index * 220, 640),
        edge(`e${index}`, UML_ROLE['control-flow'], `a${index}`, 'd'),
      ]).flat(),
    ];
    // §15.7.11.4 allows TWO: the flow the decision branches, and the
    // `decisionInputFlow` carrying the value its guards test.
    expect(only(evaluate(sheet(2)), DECISION_INCOMING_COUNT)).toEqual([]);
    expect(only(evaluate(sheet(3)), DECISION_INCOMING_COUNT)).toHaveLength(1);
  });

  it('asks for no floor, so a diamond nobody has joined up yet is silent', () => {
    expect(
      only(
        evaluate([frame('act'), decision('d', 600, 200)]),
        DECISION_INCOMING_COUNT
      )
    ).toEqual([]);
  });
});

describe('U30 · what a control flow may run between', () => {
  it('flags a control flow with an object node at one end', () => {
    // §15.7.9.4's own case, and the one with an exception the notation cannot
    // draw — which is why the rule's suggestion names it.
    expect(
      idsOf(
        evaluate([
          frame('act'),
          action('a', 200, 200),
          label('a-label', 'Pick', 200, 340),
          objectNode('o', 600, 200),
          label('o-label', 'Order', 600, 340),
          edge('e', UML_ROLE['control-flow'], 'a', 'o'),
        ])
      )
    ).toContain(CONTROL_FLOW_ENDPOINTS);
  });

  it('flags a control flow dragged onto a state, and onto a class', () => {
    for (const far of [
      [stateNode('s', 600, 200), name('s-name', 'Draft', 600, 340)],
      [klass('s', 600, 200), name('s-name', 'Order', 600, 340)],
    ]) {
      expect(
        idsOf(
          evaluate([
            frame('act'),
            action('a', 200, 200),
            label('a-label', 'Pick', 200, 340),
            ...far,
            edge('e', UML_ROLE['control-flow'], 'a', 's'),
          ])
        )
      ).toContain(CONTROL_FLOW_ENDPOINTS);
    }
  });

  it('says nothing about a flow between two actions, or through a control node', () => {
    expect(evaluate(conformantActivity())).toEqual([]);
  });

  it('says nothing about a control flow onto a sticky note', () => {
    // The alphabet gate: a line drawn onto a rectangle somebody thought with is
    // pointing at something, and pointing at things is what a whiteboard is for.
    expect(
      only(
        evaluate([
          frame('act'),
          action('a', 200, 200),
          label('a-label', 'Pick', 200, 340),
          sketch('n', 600, 200),
          edge('e', UML_ROLE['control-flow'], 'a', 'n'),
        ]),
        CONTROL_FLOW_ENDPOINTS
      )
    ).toEqual([]);
  });
});

describe('U31 · an object flow that touches no data', () => {
  it('flags an object flow between two actions', () => {
    expect(
      idsOf(
        evaluate([
          frame('act'),
          action('a', 200, 200),
          label('a-label', 'Pick', 200, 340),
          action('b', 600, 200),
          label('b-label', 'Pack', 600, 340),
          edge('e', UML_ROLE['object-flow'], 'a', 'b'),
        ])
      )
    ).toContain(OBJECT_FLOW_ENDPOINTS);
  });

  it('says nothing when one end IS an object node', () => {
    expect(
      only(
        evaluate([
          frame('act'),
          action('a', 200, 200),
          label('a-label', 'Pick', 200, 340),
          objectNode('o', 600, 200),
          label('o-label', 'Order', 600, 340),
          edge('e', UML_ROLE['object-flow'], 'a', 'o'),
        ]),
        OBJECT_FLOW_ENDPOINTS
      )
    ).toEqual([]);
  });
});

describe('U32 · what a transition may run between', () => {
  it('flags a transition dragged onto the activity diamond', () => {
    // A decision is §15.3.4's branch where §14.2.4's is the choice — the
    // commonest confusion between the two behaviour sheets.
    expect(
      idsOf(
        evaluate([
          frame('stm'),
          stateNode('s', 200, 200),
          name('s-name', 'Draft', 200, 340),
          decision('d', 600, 200),
          edge('e', UML_ROLE.transition, 's', 'd'),
        ])
      )
    ).toContain(TRANSITION_ENDPOINTS);
  });

  it('says nothing about a transition onto a CHOICE, or onto a fork', () => {
    for (const glyph of [choice('x', 600, 200), fork('x', 600, 200)]) {
      expect(
        only(
          evaluate([
            frame('stm'),
            stateNode('s', 200, 200),
            name('s-name', 'Draft', 200, 340),
            glyph,
            edge('e', UML_ROLE.transition, 's', 'x'),
          ]),
          TRANSITION_ENDPOINTS
        ),
        String(glyph.role)
      ).toEqual([]);
    }
  });

  it('leaves the two DEGREE mistakes to the degree rules alone', () => {
    // A transition into the initial disc is wrong, and exactly one rule says so:
    // the matrix over the vertices is the full square precisely so that one drag
    // to fix gets one bracket.
    const violations = idsOf(
      evaluate([
        frame('stm'),
        initialNode('i', 200, 200),
        stateNode('s', 600, 200),
        name('s-name', 'Draft', 600, 340),
        edge('e', UML_ROLE.transition, 's', 'i'),
      ])
    );
    expect(violations).toContain(INITIAL_NO_INCOMING_TRANSITION);
    expect(violations).not.toContain(TRANSITION_ENDPOINTS);
  });
});

describe('U33–U34 · what no walk from the beginning reaches', () => {
  it('flags a ring of actions nothing enters', () => {
    expect(
      idsOf(
        evaluate([
          frame('act'),
          initialNode('i', 100, 200),
          action('a', 300, 200),
          label('a-label', 'Pick', 300, 340),
          edge('e0', UML_ROLE['control-flow'], 'i', 'a'),
          // …and a ring beside it, entered from nowhere.
          action('r1', 600, 500),
          label('r1-label', 'Wait', 600, 640),
          action('r2', 900, 500),
          label('r2-label', 'Retry', 900, 640),
          edge('e1', UML_ROLE['control-flow'], 'r1', 'r2'),
          edge('e2', UML_ROLE['control-flow'], 'r2', 'r1'),
        ])
      ).filter(id => id === UNREACHABLE_ACTION)
    ).toHaveLength(2);
  });

  it('flags a ring of states nothing enters', () => {
    expect(
      idsOf(
        evaluate([
          frame('stm'),
          initialNode('i', 100, 200),
          stateNode('s', 300, 200),
          name('s-name', 'Draft', 300, 340),
          edge('e0', UML_ROLE.transition, 'i', 's'),
          stateNode('r1', 600, 500),
          name('r1-name', 'Held', 600, 640),
          stateNode('r2', 900, 500),
          name('r2-name', 'Void', 900, 640),
          edge('e1', UML_ROLE.transition, 'r1', 'r2'),
          edge('e2', UML_ROLE.transition, 'r2', 'r1'),
        ])
      ).filter(id => id === UNREACHABLE_STATE)
    ).toHaveLength(2);
  });

  it('says nothing about a second branch nobody drew a disc for', () => {
    // `implicitRoots`: an action nothing points at IS a beginning, which is what
    // keeps this rule off every activity in the thirty seconds before its
    // initial node goes down.
    expect(
      only(
        evaluate([
          frame('act'),
          action('a', 200, 200),
          label('a-label', 'Pick', 200, 340),
          action('b', 600, 200),
          label('b-label', 'Pack', 600, 340),
          edge('e', UML_ROLE['control-flow'], 'a', 'b'),
        ]),
        UNREACHABLE_ACTION
      )
    ).toEqual([]);
  });

  it('runs only on DEMAND, never on the drawing path', () => {
    const ring = [
      frame('act'),
      initialNode('i', 100, 200),
      action('a', 300, 200),
      label('a-label', 'Pick', 300, 340),
      edge('e0', UML_ROLE['control-flow'], 'i', 'a'),
      action('r1', 600, 500),
      label('r1-label', 'Wait', 600, 640),
      action('r2', 900, 500),
      label('r2-label', 'Retry', 900, 640),
      edge('e1', UML_ROLE['control-flow'], 'r1', 'r2'),
      edge('e2', UML_ROLE['control-flow'], 'r2', 'r1'),
    ];
    expect(idsOf(drawing(ring))).not.toContain(UNREACHABLE_ACTION);
    expect(idsOf(checkup(ring))).toContain(UNREACHABLE_ACTION);
  });
});

describe('U2 · what the two behaviour sheets draw', () => {
  it('refuses the state machine vocabulary on an activity sheet', () => {
    for (const glyph of [
      stateNode('x', 300, 200),
      finalState('x', 300, 200),
      choice('x', 300, 200),
      shallowHistory('x', 300, 200),
      region('x', 300, 200),
    ]) {
      expect(
        only(evaluate([frame('act'), glyph]), NOT_ADMISSIBLE_ON_KIND),
        String(glyph.role)
      ).toHaveLength(1);
    }
  });

  it('refuses the activity vocabulary on a state machine sheet', () => {
    for (const glyph of [
      action('x', 300, 200),
      activityFinal('x', 300, 200),
      flowFinal('x', 300, 200),
      decision('x', 300, 200),
      objectNode('x', 300, 200),
      sendSignal('x', 300, 200),
      acceptEvent('x', 300, 200),
      timeEvent('x', 300, 200),
      partition('x', 300, 200),
    ]) {
      expect(
        only(evaluate([frame('stm'), glyph]), NOT_ADMISSIBLE_ON_KIND),
        String(glyph.role)
      ).toHaveLength(1);
    }
  });

  it('admits the two glyphs BOTH sheets draw, on both of them', () => {
    // §15.3.4 and §14.2.4 draw the same disc and the same bar. One role carries
    // both, so neither deny-list may name it — and the `stm` list therefore
    // spells the activity glyphs out one by one instead of naming their parent.
    for (const kind of ['act', 'stm']) {
      for (const glyph of [initialNode('x', 300, 200), fork('x', 300, 200)]) {
        expect(
          only(evaluate([frame(kind), glyph]), NOT_ADMISSIBLE_ON_KIND),
          `${kind}/${String(glyph.role)}`
        ).toEqual([]);
      }
    }
  });

  it('refuses the structural and use case vocabularies on both', () => {
    for (const kind of ['act', 'stm']) {
      for (const glyph of [
        actor('x', 300, 200),
        useCase('x', 300, 200),
        klass('x', 300, 200),
        component('x', 300, 200),
        cube('x', 300, 200),
      ]) {
        expect(
          only(evaluate([frame(kind), glyph]), NOT_ADMISSIBLE_ON_KIND),
          `${kind}/${String(glyph.role)}`
        ).toHaveLength(1);
      }
    }
  });

  it('admits the notes and the packages, which every sheet is allowed', () => {
    for (const kind of ['act', 'stm']) {
      for (const glyph of [note('x', 300, 200), pkg('x', 300, 200)]) {
        expect(
          only(evaluate([frame(kind), glyph]), NOT_ADMISSIBLE_ON_KIND),
          `${kind}/${String(glyph.role)}`
        ).toEqual([]);
      }
    }
  });
});

describe('the two conformant behaviour sheets', () => {
  it('says nothing at all about a conformant activity diagram', () => {
    expect(evaluate(conformantActivity())).toEqual([]);
  });

  it('says nothing at all about a conformant state machine diagram', () => {
    expect(evaluate(conformantStateMachine())).toEqual([]);
  });

  it('flags a quick-connected wire between two actions', () => {
    // The ELEMENT alphabet grew with the behaviour vocabulary, and this is why:
    // a line the author drew between two actions and never typed says nothing to
    // either grammar, nothing to the degree counts and nothing to either
    // exporter.
    expect(
      idsOf(
        evaluate([
          frame('act'),
          action('a', 200, 200),
          label('a-label', 'Pick', 200, 340),
          action('b', 600, 200),
          label('b-label', 'Pack', 600, 340),
          wire('w', 'a', 'b'),
        ])
      )
    ).toEqual([UNTYPED_EDGE]);
  });
});
