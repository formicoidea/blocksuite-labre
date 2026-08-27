import {
  evaluateCheckup,
  evaluateRules,
  grantException,
  revokeException,
  type Violation,
} from '@labre/affine-block-surface';
import type { BpmnPoolElementModel } from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import { type GfxPrimitiveElementModel, roleIsA } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { BPMN_POOL_BACKGROUND } from '../background';
import { bpmnPoolOf } from '../facts';
import { BPMN_PROFILES } from '../profiles';
import { BPMN_ROLE, BPMN_ROLES } from '../roles';
import { BPMN_RULES, BPMN_SEQUENCE_MATRIX } from '../rules';

/**
 * The BPMN REFERENCE CORPUS — whole processes, judged the way a user's board is
 * judged (B6, the PRD's acceptance artefact).
 *
 * `profiles.unit.spec.ts` checks the shape of the declarations; this checks what
 * they DO. Every case below is a diagram somebody could draw, built out of
 * stubs and run through `evaluateRules` / `evaluateCheckup` with the real rules
 * and the real profiles — no editor, no DI, no canvas.
 *
 * Two halves, and the first is the expensive one:
 *
 * - the VALID corpus, where a correct process must raise NOTHING at the
 *   descriptive level. A rule that fires on a good diagram is a rule the user
 *   switches off, and then all twenty-one are gone;
 * - the INVALID corpus, where each board carries exactly ONE mistake and the
 *   rule that catches it is named, with the elements it indicts spelled out. One
 *   mistake, one sentence, on the symbols the user has to touch.
 *
 * The elements are stand-ins: the engine reads `id`, `role`, `elementBound`, the
 * persisted `source`/`target` pair of a connector, and — for a pool — the
 * `validationProfile` and `validationExceptions` a user gesture writes. Nothing
 * else takes part, which is precisely the claim this file is here to hold.
 */

/** The participant name band: inside the element box, OUTSIDE the plot. */
const BAND = BPMN_POOL_BACKGROUND.geometry.margin.left;

/** A stand-in element. `elementBound` allocates, exactly like the real getter. */
function element(
  id: string,
  role: string | undefined,
  xywh: [number, number, number, number],
  props: Record<string, unknown> = {}
): GfxPrimitiveElementModel {
  return {
    id,
    role,
    ...props,
    get elementBound() {
      return new Bound(...xywh);
    },
    // What `revokeException` reaches for when the last arbitration goes: the
    // key has to LEAVE, not hold an undefined value.
    clearField(field: string) {
      delete (this as Record<string, unknown>)[field];
    },
  } as unknown as GfxPrimitiveElementModel;
}

/**
 * A node centred on `(cx, cy)` — how a reader places a symbol — and NAMED.
 *
 * The name is the id, which is enough for `label-presence`: the family reads the
 * subject's own `text` and asks only whether there is one. Naming every node by
 * default is what keeps the corpus honest now that B21 is live — a board of
 * unnamed rectangles is a diagram nobody has finished, and every diagram here
 * claims to be finished. The one case that needs a nameless step builds it with
 * {@link element} directly.
 */
const node = (
  id: string,
  role: string,
  cx: number,
  cy: number,
  w = 100,
  h = 60
): GfxPrimitiveElementModel =>
  element(id, role, [cx - w / 2, cy - h / 2, w, h], { text: id });

const start = (id: string, cx: number, cy: number) =>
  node(id, BPMN_ROLE.startEvent, cx, cy, 40, 40);
const end = (id: string, cx: number, cy: number) =>
  node(id, BPMN_ROLE.endEvent, cx, cy, 40, 40);
const task = (id: string, cx: number, cy: number) =>
  node(id, BPMN_ROLE.task, cx, cy);
const gateway = (id: string, cx: number, cy: number) =>
  node(id, BPMN_ROLE.gatewayExclusive, cx, cy, 50, 50);
const data = (id: string, cx: number, cy: number) =>
  node(id, BPMN_ROLE.dataObject, cx, cy, 50, 60);
const annotation = (id: string, cx: number, cy: number) =>
  node(id, BPMN_ROLE.textAnnotation, cx, cy, 120, 40);

/**
 * A connector, with the two ends the document persists. Its own box is
 * irrelevant to every rule here — a relation is judged on what it joins — so it
 * is given a nominal one rather than a routed path.
 */
const link = (
  id: string,
  role: string | undefined,
  source: string,
  target: string
): GfxPrimitiveElementModel =>
  element(id, role, [0, 0, 1, 1], {
    source: { id: source },
    target: { id: target },
  });

const flow = (id: string, source: string, target: string) =>
  link(id, BPMN_ROLE.sequenceFlow, source, target);
const message = (id: string, source: string, target: string) =>
  link(id, BPMN_ROLE.messageFlow, source, target);
const association = (id: string, source: string, target: string) =>
  link(id, BPMN_ROLE.association, source, target);
/** What quick-connect produces: a link carrying no role at all. */
const plain = (id: string, source: string, target: string) =>
  link(id, undefined, source, target);

/**
 * A pool, held to the DESCRIPTIVE profile by default.
 *
 * The choice rides on the element, which is where a user's gesture writes it —
 * so the corpus is judged at the level it claims to be judged at, rather than at
 * the `sketch` default every pool silently carries.
 */
const pool = (
  id: string,
  xywh: [number, number, number, number],
  // `null` is "names none", i.e. what a pool nobody has touched carries. Not
  // `undefined`, which would fall back to the default parameter and quietly
  // test the descriptive level twice.
  profile: string | null = 'bpmn.descriptive'
): GfxPrimitiveElementModel =>
  element(
    id,
    BPMN_ROLE.pool,
    xywh,
    profile === null ? {} : { validationProfile: profile }
  );

/** The real-time verdict, at the level each pool declares. */
const evaluate = (elements: GfxPrimitiveElementModel[]) =>
  evaluateRules(BPMN_RULES, elements, BPMN_PROFILES);

/** The check-up verdict — the on-demand moment, which the drawing path never runs. */
const checkup = (elements: GfxPrimitiveElementModel[]) =>
  evaluateCheckup(BPMN_RULES, elements, BPMN_PROFILES);

/**
 * An alias for {@link evaluate}, kept for the blocks below.
 *
 * Those eight rules were authored a review cycle ahead of the engine and ran
 * against their own array, because two of them were WRONG without the def field
 * they name — an engine with no `ifPresent` reads the pair as the unconditional
 * "every pool holds a start event" the specification review removed.
 * `claude/bpmn-engine-v2` (#145) landed every field, so they are part of the
 * pack like everything else. The alias is what makes that a one-line diff
 * instead of a rewrite: the boards did not change, only what evaluates them.
 */
const pending = evaluate;

/** `[ruleId, …elementIds]` per finding, sorted — everything a board reports. */
const said = (violations: readonly Violation[]) =>
  violations.map(v => [v.ruleId, ...v.elementIds].join(' ')).sort();

/**
 * What the DRAWING USER is actually told: the same list minus the `audit`
 * findings, which are collected for the conformance panel and never reach the
 * canvas.
 *
 * The "one mistake, one sentence" promise is about brackets on a board, so the
 * invalid corpus asserts this one. Five of the twenty-one rules are `audit` by
 * declaration — they report shapes the specification sanctions, or a diagram
 * that is merely unfinished — and holding a board to "raises exactly one finding
 * of any kind" would have meant either deleting them or bending every fixture
 * around remarks the user will never see. The remarks are still asserted, on the
 * boards that are ABOUT them, with {@link said}.
 */
const told = (violations: readonly Violation[]) =>
  said(violations.filter(v => v.severity !== 'audit'));

// ---------------------------------------------------------------------------
// The VALID corpus: three processes that must raise nothing at all.
// ---------------------------------------------------------------------------

/**
 * One participant, one chain, one decision. The diagram a BPMN course draws on
 * its first afternoon, and the shape most descriptive diagrams actually have.
 */
const linearProcess = () => [
  pool('pool', [0, 0, 800, 300]),
  start('start', 100, 150),
  task('receive', 250, 150),
  gateway('decide', 380, 150),
  task('approve', 520, 90),
  task('reject', 520, 210),
  end('done', 700, 150),
  flow('f1', 'start', 'receive'),
  flow('f2', 'receive', 'decide'),
  flow('f3', 'decide', 'approve'),
  flow('f4', 'decide', 'reject'),
  flow('f5', 'approve', 'done'),
  flow('f6', 'reject', 'done'),
];

/**
 * Two participants, each with its own chain, talking to each other across the
 * gap: sequence flows stay home, messages cross. The shape the whole
 * `edge-locality` family exists for.
 */
const collaboration = () => [
  pool('buyer', [0, 0, 800, 300]),
  pool('seller', [0, 400, 800, 300]),
  start('buyer-start', 100, 150),
  task('order', 300, 150),
  end('buyer-done', 650, 150),
  flow('b1', 'buyer-start', 'order'),
  flow('b2', 'order', 'buyer-done'),
  start('seller-start', 100, 550),
  task('ship', 300, 550),
  end('seller-done', 650, 550),
  flow('s1', 'seller-start', 'ship'),
  flow('s2', 'ship', 'seller-done'),
  // An activity sends to an activity…
  message('m1', 'order', 'ship'),
  // …and an end event throws on the way out, to a start event that catches. The
  // two remaining sentences of rule 2, and neither is a sequence flow, so the
  // degree bounds on the start and the end are untouched by either.
  message('m2', 'seller-done', 'buyer-start'),
];

/**
 * Flow objects on BARE CANVAS: no pool anywhere. Locality and existence have
 * nothing to be about and say nothing; the grammar and the degree counts are
 * fully live, because neither reads a coordinate.
 */
const poollessSketch = () => [
  start('start', 100, 100),
  task('do', 260, 100),
  end('done', 420, 100),
  flow('f1', 'start', 'do'),
  flow('f2', 'do', 'done'),
];

describe('the VALID corpus — nothing to say about a correct process', () => {
  it('says nothing about a single-pool linear process', () => {
    expect(said(evaluate(linearProcess()))).toEqual([]);
    expect(said(checkup(linearProcess()))).toEqual([]);
  });

  it('says nothing about a two-pool collaboration', () => {
    expect(said(evaluate(collaboration()))).toEqual([]);
    expect(said(checkup(collaboration()))).toEqual([]);
  });

  it('says nothing about a poolless sketch', () => {
    expect(said(evaluate(poollessSketch()))).toEqual([]);
    expect(said(checkup(poollessSketch()))).toEqual([]);
  });

  it('still counts degrees on a poolless sketch, having nothing else to count', () => {
    // The half of the previous case that silence alone cannot prove: locality
    // and existence are quiet because there is no pool, NOT because the whole
    // pack goes quiet off-frame. Drop the last flow and both degree rules speak
    // — the step leads nowhere, and the outcome is unreachable.
    const board = poollessSketch().filter(el => el.id !== 'f2');
    expect(said(evaluate(board))).toEqual([
      'bpmn.activity-dead-end do',
      'bpmn.end-event-must-be-reached done',
    ]);
  });
});

// ---------------------------------------------------------------------------
// The INVALID corpus: one mistake per board, and the rule that catches it.
// ---------------------------------------------------------------------------

/** Two complete participants — the clean base the crossing cases are built on. */
const twoPools = () => [
  pool('buyer', [0, 0, 800, 300]),
  pool('seller', [0, 400, 800, 300]),
  start('buyer-start', 100, 150),
  task('order', 300, 150),
  end('buyer-done', 650, 150),
  flow('b1', 'buyer-start', 'order'),
  flow('b2', 'order', 'buyer-done'),
  start('seller-start', 100, 550),
  task('ship', 300, 550),
  end('seller-done', 650, 550),
  flow('s1', 'seller-start', 'ship'),
  flow('s2', 'ship', 'seller-done'),
];

/** One complete participant — the clean base the single-pool cases are built on. */
const onePool = () => [
  pool('pool', [0, 0, 800, 300]),
  start('start', 100, 150),
  task('first', 280, 150),
  task('second', 460, 150),
  end('done', 660, 150),
  flow('f1', 'start', 'first'),
  flow('f2', 'first', 'second'),
  flow('f3', 'second', 'done'),
];

describe('the INVALID corpus — one mistake, one sentence', () => {
  it('catches a sequence flow crossing from one pool into another', () => {
    // Both participants are complete, so nothing else has anything to say: the
    // only thing wrong is that a token would have to change participant.
    const board = [...twoPools(), flow('cross', 'order', 'ship')];
    expect(told(evaluate(board))).toEqual([
      'bpmn.sequence-flow-stays-home cross order ship',
    ]);
    // The crossing flow also gives `order` a second exit and `ship` a second
    // entrance, which p.151 allows and the panel remarks on. Neither reaches
    // the canvas, and neither is what this board is about.
    expect(said(evaluate(board))).toContain('bpmn.implicit-split order');
    expect(said(evaluate(board))).toContain('bpmn.fake-join ship');
  });

  it('catches a message flow that never leaves its pool', () => {
    // Two steps of one process: whatever the author meant, they meant a
    // sequence flow. The grammar is happy — an activity may message an activity
    // — and only the frames the two ends sit in tell the two cases apart.
    const board = [...onePool(), message('m1', 'first', 'second')];
    expect(told(evaluate(board))).toEqual([
      'bpmn.message-flow-crosses-pools first m1 second',
    ]);
  });

  it('catches a sequence flow arriving at a start event', () => {
    const board = [...onePool(), flow('back', 'second', 'start')];
    expect(told(evaluate(board))).toEqual(['bpmn.start-event-no-inflow start']);
  });

  it('catches a sequence flow leaving an end event', () => {
    // The mirror, and the one that proves the two bounds are read separately:
    // the same board, the same arrow, the other end of the process.
    const board = [
      pool('pool', [0, 0, 800, 300]),
      start('start', 100, 150),
      task('first', 280, 150),
      end('done', 460, 150),
      task('after', 660, 150),
      end('really-done', 760, 150),
      flow('f1', 'start', 'first'),
      flow('f2', 'first', 'done'),
      flow('f3', 'done', 'after'),
      flow('f4', 'after', 'really-done'),
    ];
    expect(told(evaluate(board))).toEqual(['bpmn.end-event-no-outflow done']);
  });

  it('remarks on a task nothing follows, without raising its voice', () => {
    // p.151 sanctions the shape: an activity with no outgoing sequence flow is
    // a legitimate way to end a path. So the finding is `audit` at BOTH levels —
    // a nuance for the conformance panel, never a bracket on the canvas.
    const board = [
      pool('pool', [0, 0, 800, 300]),
      start('start', 100, 150),
      task('first', 280, 100),
      task('forgotten', 280, 220),
      end('done', 660, 150),
      flow('f1', 'start', 'first'),
      flow('f2', 'first', 'done'),
      flow('f3', 'start', 'forgotten'),
    ];
    const violations = evaluate(board);
    expect(said(violations)).toEqual(['bpmn.activity-dead-end forgotten']);
    expect(violations[0].severity).toBe('audit');
  });

  it('catches a start event nothing comes out of', () => {
    // p.244, the other half of B5: a participant that wakes up and stops.
    const board = [
      pool('pool', [0, 0, 800, 300]),
      start('start', 100, 150),
      start('orphan-start', 100, 250),
      task('first', 280, 150),
      end('done', 660, 150),
      flow('f1', 'start', 'first'),
      flow('f2', 'first', 'done'),
    ];
    expect(told(evaluate(board))).toEqual([
      'bpmn.start-event-must-exit orphan-start',
    ]);
  });

  it('catches an end event nothing leads to', () => {
    // p.248: an outcome the process has no path to.
    const board = [...onePool(), end('never', 660, 250)];
    expect(told(evaluate(board))).toEqual([
      'bpmn.end-event-must-be-reached never',
    ]);
  });

  it('catches an association between two documents', () => {
    // Data is IN this rule's alphabet — it is named as an endpoint of the data
    // sentences — so a link between two documents is judged and refused. The
    // drawn endpoints of a data association join data to WORK (p.222).
    const board = [
      ...onePool(),
      data('form', 300, 250),
      data('ledger', 500, 250),
      association('a1', 'form', 'ledger'),
    ];
    expect(told(evaluate(board))).toEqual([
      'bpmn.association-endpoints a1 form ledger',
    ]);
  });

  it('catches a ring the process can never enter — but only on a check-up', () => {
    // The defect `implicitRoots` leaves standing, and the only one it leaves:
    // every step in the ring is pointed at, so none of them is an implicit
    // start; nothing outside points in, so no walk reaches it. The work can
    // never begin there. Forward-only traversal is what makes it a finding.
    const board = [
      ...onePool(),
      task('ring-a', 300, 250),
      task('ring-b', 500, 250),
      flow('r1', 'ring-a', 'ring-b'),
      flow('r2', 'ring-b', 'ring-a'),
    ];
    // Nothing on the drawing path: the rule is `on-demand`, so `evaluateRules`
    // skips it before touching a single element.
    expect(told(evaluate(board))).toEqual([]);
    expect(said(checkup(board))).toEqual([
      'bpmn.unreachable-step ring-a',
      'bpmn.unreachable-step ring-b',
    ]);
  });

  it('says nothing about a branch that simply has no start event drawn', () => {
    // The case `ReachabilityDef.implicitRoots` exists for, and the reason
    // bpmnlint's `no-implicit-start` is not adopted: p.238 does not require a
    // Start Event, and p.245 makes a step nothing points at an implicit
    // parallel start. Before the flag, one marked start anywhere on the board
    // lifted the zero-root gate and the unmarked branch lit up end to end.
    const board = [
      ...onePool(),
      task('parallel', 300, 250),
      flow('p1', 'parallel', 'done'),
    ];
    expect(said(checkup(board))).toEqual([]);
  });

  it('catches two steps joined by an untyped link', () => {
    // The gap every other rule falls through: the diagram shows an arrow and
    // the model holds nothing. The link is drawn ALONGSIDE the real flow, so
    // nothing else about the board is wrong.
    const board = [...onePool(), plain('quick', 'first', 'second')];
    expect(told(evaluate(board))).toEqual([
      'bpmn.untyped-flow first quick second',
    ]);
  });

  it('catches an association hung on a gateway', () => {
    // A gateway decides; it does not read or produce paperwork. It IS in this
    // rule's alphabet — a gateway is a flow object, which the annotation
    // sentences name — so the link is a finding rather than silence.
    const board = [
      pool('pool', [0, 0, 900, 300]),
      start('start', 100, 150),
      gateway('decide', 300, 150),
      task('approve', 500, 90),
      task('reject', 500, 210),
      end('done', 780, 150),
      data('form', 300, 260),
      flow('f1', 'start', 'decide'),
      flow('f2', 'decide', 'approve'),
      flow('f3', 'decide', 'reject'),
      flow('f4', 'approve', 'done'),
      flow('f5', 'reject', 'done'),
      association('a1', 'decide', 'form'),
    ];
    expect(told(evaluate(board))).toEqual([
      'bpmn.association-endpoints a1 decide form',
    ]);
  });

  it('catches a message flow drawn out of a start event', () => {
    // A start event is woken up BY a message; it has none to send yet. Both
    // roles are in the rule's alphabet, so the sentence is judged and refused
    // rather than waved through as a sketch.
    const board = [...twoPools(), message('m1', 'seller-start', 'order')];
    expect(told(evaluate(board))).toEqual([
      'bpmn.message-flow-endpoints m1 order seller-start',
    ]);
  });

  it('catches a sequence flow looping back onto its own step', () => {
    const board = [...onePool(), flow('loop', 'first', 'first')];
    expect(told(evaluate(board))).toEqual([
      'bpmn.sequence-flow-endpoints first loop',
    ]);
  });

  it('catches the same flow drawn twice between the same two steps', () => {
    // bpmnlint's `no-duplicate-sequence-flows`. The FIRST arrow keeps its
    // innocence and every copy after it is the finding — by edge id, so the
    // same board reports the same one on every peer and after every reload.
    const board = [...onePool(), flow('f2-again', 'first', 'second')];
    expect(told(evaluate(board))).toEqual([
      'bpmn.duplicate-sequence-flow f2-again first second',
    ]);
  });

  it('says nothing about two flows drawn in OPPOSITE directions', () => {
    // A → B and B → A are two different sentences — a request and its answer —
    // and neither is a copy of the other. The `back` flow arrives at a task, so
    // it is not B6's business either.
    const board = [...onePool(), flow('back', 'second', 'first')];
    expect(told(evaluate(board))).toEqual([]);
  });
});

describe('what the corpus stays silent about', () => {
  it('says nothing about a process drawn before the roles existed', () => {
    // No role on anything: never evaluated, never a word (PRD principle 8).
    const board = onePool().map(el =>
      element(el.id, undefined, [
        el.elementBound.x,
        el.elementBound.y,
        el.elementBound.w,
        el.elementBound.h,
      ])
    );
    expect(said(evaluate(board))).toEqual([]);
    expect(said(checkup(board))).toEqual([]);
  });

  it('says nothing about a plain connector dropped on a pool', () => {
    // The promise `flagNeutral` makes with no tuning at all: `bpmn:pool` is the
    // endpoint of no BPMN sentence, so it is outside every alphabet, so a link
    // dragged onto a participant band is an annotation and none of this
    // framework's business.
    const board = [...onePool(), plain('note-link', 'first', 'pool')];
    expect(said(evaluate(board))).toEqual([]);
  });

  it('says nothing about a plain connector onto a shape with no role', () => {
    const board = [
      ...onePool(),
      element('sticky', undefined, [700, 250, 60, 40]),
      plain('note-link', 'first', 'sticky'),
    ];
    expect(said(evaluate(board))).toEqual([]);
  });

  it('says nothing about a sequence flow with a free end', () => {
    // A link the user has grabbed and not yet dropped must not make anything
    // legal, and must not indict anything either.
    const board = [
      pool('pool', [0, 0, 800, 300]),
      start('start', 100, 150),
      task('first', 280, 150),
      end('done', 660, 150),
      flow('f1', 'start', 'first'),
      flow('f2', 'first', 'done'),
      element('dangling', BPMN_ROLE.sequenceFlow, [0, 0, 1, 1], {
        source: { id: 'first' },
        target: {},
      }),
    ];
    expect(said(evaluate(board))).toEqual([]);
  });

  /**
   * The engine limit, pinned so it stays a KNOWN limit rather than an
   * assumption. Three normative prohibitions land outside their rule's alphabet,
   * because the alphabet is derived from the sentences a rule sanctions and no
   * sentence can name a role in order to reject it. See the header of
   * `rules.ts`; reported to the engine author.
   */
  it('says nothing about a sequence flow dropped on an artifact or a document', () => {
    // p.65 — "an Artifact MUST NOT be the source or target of a Sequence Flow";
    // p.95 — a Sequence Flow connects Events, Activities and Gateways. Neither
    // a text annotation nor a data object is named by B1's single sentence, so
    // both are outside its alphabet and the whole link goes unjudged.
    const board = [
      ...onePool(),
      annotation('note', 300, 250),
      data('form', 520, 250),
      flow('to-note', 'first', 'note'),
      flow('to-data', 'second', 'form'),
    ];
    expect(told(evaluate(board))).toEqual([]);
    // No finding of the endpoints rule at all — not a quieter one, none.
    expect(said(evaluate(board)).join(' ')).not.toContain(
      'bpmn.sequence-flow-endpoints'
    );
  });

  /**
   * The GROUP, and the one case where the alphabet limit and the specification
   * agree rather than diverging.
   *
   * `bpmn:group` is in the vocabulary — it is a declared role with a label, not
   * an unnamed rectangle — so the obvious guess is that the endpoints rule
   * speaks about it. It does not: the alphabet is read off the sanctioned
   * TRIPLETS, and B1's single sentence names `bpmn:flow-object`. A group is a
   * parent-less artifact, `roleIsA` says no, and the link is silence.
   *
   * Here that is the RIGHT answer and not a limit we are living with. BPMN 2.0.2
   * §10.4 exempts a Group from every connection and containment constraint there
   * is — it is a lasso drawn round a region, and the region it circles keeps
   * whatever relations it had. `roles.ts` says so where the role is declared;
   * this is the same statement, asserted against the engine.
   *
   * Contrast p.65 (an Artifact must not be a sequence flow endpoint), which is
   * the same silence and IS a limit — for a text annotation, the spec forbids
   * what we cannot say. Two roles, one mechanism, opposite verdicts on whether
   * the silence is correct. Pinned separately for exactly that reason.
   */
  it('says nothing about a sequence flow attached to a group, and should not', () => {
    const board = [
      ...onePool(),
      node('phase-one', BPMN_ROLE.group, 300, 250, 240, 90),
      flow('into-group', 'first', 'phase-one'),
      flow('out-of-group', 'phase-one', 'second'),
    ];
    expect(told(evaluate(board))).toEqual([]);
    expect(said(evaluate(board)).join(' ')).not.toContain(
      'bpmn.sequence-flow-endpoints'
    );
    // The mechanism, spelled out so a reader does not have to infer it: the
    // group is DECLARED, and still outside the alphabet, because the alphabet
    // is the triplets and not the vocabulary.
    expect(BPMN_ROLES[BPMN_ROLE.group]).toBeDefined();
    expect(roleIsA(BPMN_ROLE.group, BPMN_ROLE.flowObject, BPMN_ROLES)).toBe(
      false
    );
    expect(BPMN_SEQUENCE_MATRIX.map(t => [t.source, t.target])).toEqual([
      [BPMN_ROLE.flowObject, BPMN_ROLE.flowObject],
    ]);
  });

  it('says nothing about a plain connector dropped on a group either', () => {
    // `flagNeutral` reads the same alphabet, so the lasso is not somewhere a
    // typed relation can be presumed to have been meant — which is the whole
    // point of reading the triplets rather than the vocabulary.
    const board = [
      ...onePool(),
      node('phase-one', BPMN_ROLE.group, 300, 250, 240, 90),
      plain('lasso-link', 'first', 'phase-one'),
    ];
    expect(told(evaluate(board))).toEqual([]);
    expect(said(evaluate(board)).join(' ')).not.toContain('bpmn.untyped-flow');
  });

  it('says nothing about a message flow dropped on a gateway or an annotation', () => {
    // p.152 — "a Message Flow MUST NOT connect to a Gateway". Same limit: no
    // message sentence names a gateway, so a gateway end is outside B2's
    // alphabet. The annotation is outside it for the ordinary reason.
    const board = [
      pool('buyer', [0, 0, 800, 300]),
      pool('seller', [0, 400, 800, 300]),
      start('buyer-start', 100, 150),
      gateway('decide', 300, 150),
      // The gateway genuinely SPLITS, so B16 has nothing to say about it — this
      // board is about the message flow the grammar cannot judge.
      task('order', 500, 90),
      task('cancel', 500, 210),
      end('buyer-done', 700, 150),
      flow('b1', 'buyer-start', 'decide'),
      flow('b2', 'decide', 'order'),
      flow('b3', 'decide', 'cancel'),
      flow('b4', 'order', 'buyer-done'),
      flow('b5', 'cancel', 'buyer-done'),
      // The note lives in the buyer's pool, so the message drawn at it still
      // CROSSES — this case is about the grammar staying quiet, and a locality
      // finding would be a second sentence about a different mistake.
      annotation('note', 300, 250),
      task('ship', 500, 550),
      message('m1', 'ship', 'decide'),
      message('m2', 'ship', 'note'),
    ];
    // Neither message flow is judged at all. `ship` is a dead end, which the
    // panel remarks on and which is not this board's subject.
    expect(told(evaluate(board))).toEqual([]);
    expect(said(evaluate(board)).join(' ')).not.toContain(
      'bpmn.message-flow-endpoints'
    );
  });

  it('says nothing about a step drawn beside the pool rather than in it', () => {
    // Locality and existence read CONTAINMENT and only containment, so an
    // artefact outside every frame is counted by nobody — and the flow reaching
    // it is not "leaving the pool", it is a draft.
    const board = [
      ...onePool(),
      task('outside', 300, 900),
      flow('out', 'second', 'outside'),
    ];
    // `outside` is a dead end and `second` now splits, both of which the panel
    // remarks on — but the LOCALITY rule says nothing, which is the point.
    expect(told(evaluate(board))).toEqual([]);
    expect(said(evaluate(board)).join(' ')).not.toContain(
      'bpmn.sequence-flow-stays-home'
    );
    expect(said(evaluate(board))).toContain('bpmn.activity-dead-end outside');
  });
});

// ---------------------------------------------------------------------------
// The two recette scenarios, at BPMN level.
// ---------------------------------------------------------------------------

describe('scenario · an exception granted, and taken back', () => {
  it('marks the finding exempt, and un-marks it on revocation', () => {
    const board = [
      pool('pool', [0, 0, 800, 300]),
      start('start', 100, 150),
      task('first', 280, 100),
      task('forgotten', 280, 220),
      end('done', 660, 150),
      flow('f1', 'start', 'first'),
      flow('f2', 'first', 'done'),
      flow('f3', 'start', 'forgotten'),
    ];
    const forgotten = board.find(el => el.id === 'forgotten')!;

    const before = evaluate(board);
    expect(said(before)).toEqual(['bpmn.activity-dead-end forgotten']);
    expect(told(before)).toEqual([]);
    expect(before[0].exemption).toBeUndefined();

    // The user's arbitration: "this one is deliberate."
    grantException(forgotten, 'bpmn.activity-dead-end', 'mathieu');
    const during = evaluate(board);
    // The finding does NOT vanish — a board can never hide an arbitration it
    // made (PF8.3). It changes STATE.
    expect(said(during)).toEqual(['bpmn.activity-dead-end forgotten']);
    expect(during[0].exemption).toBe('element');

    revokeException(forgotten, 'bpmn.activity-dead-end');
    const after = evaluate(board);
    expect(said(after)).toEqual(['bpmn.activity-dead-end forgotten']);
    expect(after[0].exemption).toBeUndefined();
    // ...and the element is indistinguishable from one that never carried an
    // exception, in the document and not just in this tab.
    expect(
      (forgotten as unknown as Record<string, unknown>).validationExceptions
    ).toBeUndefined();
  });

  it('covers a whole participant with an arbitration made on the pool', () => {
    // The `map` scope: the exception is written on the POOL, and it covers the
    // findings measured against that pool — and no other on the board.
    const board = [
      ...twoPools(),
      flow('cross', 'order', 'ship'),
      flow('cross-back', 'ship', 'order'),
    ];
    const buyer = board[0];
    expect(told(evaluate(board))).toEqual([
      'bpmn.sequence-flow-stays-home cross order ship',
      'bpmn.sequence-flow-stays-home cross-back order ship',
    ]);

    grantException(buyer, 'bpmn.sequence-flow-stays-home');
    const during = evaluate(board);
    // `edge-locality` attributes a finding to the SOURCE's pool, so the buyer's
    // arbitration covers the flow leaving the buyer and leaves the seller's
    // alone. One board, two participants, two independent decisions.
    const byEdge = new Map(during.map(v => [v.elementIds[0], v]));
    expect(byEdge.get('cross')?.exemption).toBe('map');
    expect(byEdge.get('cross-back')?.exemption).toBeUndefined();

    revokeException(buyer, 'bpmn.sequence-flow-stays-home');
    for (const violation of evaluate(board)) {
      if (violation.ruleId !== 'bpmn.sequence-flow-stays-home') continue;
      expect(violation.exemption, violation.elementIds[0]).toBeUndefined();
    }
  });
});

describe('scenario · the profile decides how hard the pack bites', () => {
  /** One board, two mistakes in two families, so the demotion is visible. */
  /**
   * One board, two mistakes, in two different families — and DELIBERATELY
   * neither of them a degree mistake.
   *
   * A profile scenario has to show the same findings moving between levels, so
   * every finding on this board must be one the profile actually moves. The two
   * chosen are carried by links the degree family does not count: a role-less
   * connector is invisible to it, and a message flow is a different edge role.
   * That keeps the board free of the `audit` remarks that would otherwise ride
   * along and make "every finding is at warning" false for a reason that has
   * nothing to do with profiles.
   */
  const messyBoard = (profile: string | null) => [
    pool('pool', [0, 0, 800, 300], profile),
    start('start', 100, 150),
    task('first', 280, 150),
    task('second', 460, 150),
    end('done', 660, 150),
    flow('f1', 'start', 'first'),
    flow('f2', 'first', 'second'),
    flow('f3', 'second', 'done'),
    // Quick-connect between two steps (grammar)…
    plain('quick', 'first', 'second'),
    // …and a message that never leaves the pool (locality).
    message('m1', 'first', 'second'),
  ];

  const MESSY = [
    'bpmn.message-flow-crosses-pools first m1 second',
    'bpmn.untyped-flow first quick second',
  ];

  it('holds every finding at warning on bpmn.descriptive', () => {
    const violations = evaluate(messyBoard('bpmn.descriptive'));
    expect(said(violations)).toEqual(MESSY);
    for (const violation of violations) {
      expect(violation.severity, violation.ruleId).toBe('warning');
    }
  });

  it('demotes every finding to audit on bpmn.sketch', () => {
    const violations = evaluate(messyBoard('bpmn.sketch'));
    // The same findings, collected and available — the sketch PRIMES, it does
    // not switch anything off.
    expect(said(violations)).toEqual(MESSY);
    for (const violation of violations) {
      expect(violation.severity, violation.ruleId).toBe('audit');
    }
  });

  it('puts a pool that names no profile on the sketch, silently', () => {
    // Being the default is also what makes it write NOTHING: every process ever
    // drawn is on it, with no migration and no backfill.
    const violations = evaluate(messyBoard(null));
    expect(said(violations)).toEqual(MESSY);
    for (const violation of violations) {
      expect(violation.severity, violation.ruleId).toBe('audit');
    }
  });

  it('lets two pools on one board sit at two levels at once', () => {
    const board = [
      pool('strict-pool', [0, 0, 800, 300], 'bpmn.descriptive'),
      task('a', 250, 150),
      flow('a-loop', 'a', 'a'),
      pool('loose-pool', [0, 400, 800, 300], 'bpmn.sketch'),
      task('b', 250, 550),
      flow('b-loop', 'b', 'b'),
    ];
    const bySubject = new Map(
      evaluate(board).map(v => [v.elementIds.join(' '), v])
    );
    // Both self-loops are found; only the strict participant is told off.
    expect(bySubject.get('a a-loop')?.severity).toBe('warning');
    expect(bySubject.get('b b-loop')?.severity).toBe('audit');
  });
});

// ---------------------------------------------------------------------------
// The three rules waiting on `claude/bpmn-engine-v2`.
// ---------------------------------------------------------------------------

describe('pending · the paired existence rules', () => {
  /**
   * The pairing is what the specification requires, not the events themselves: a
   * Process need contain no Start Event (p.238) and an End Event is optional
   * (p.246), so only a pool that draws ONE of the two is half a model.
   *
   * The cases below are the ones whose answer is the SAME with and without
   * `RoleCountDef.ifPresent`, so they hold today and keep holding once
   * `claude/bpmn-engine-v2` lands. The case that distinguishes the two — a pool
   * with neither event — is the `skip` at the bottom.
   */
  const poolHolding = (...inside: GfxPrimitiveElementModel[]) => [
    pool('pool', [0, 0, 800, 300]),
    ...inside,
  ];

  it('indicts a pool that says where it ends and not where it begins', () => {
    const board = poolHolding(
      task('first', 250, 150),
      end('done', 600, 150),
      flow('f1', 'first', 'done')
    );
    const violations = pending(board);
    expect(said(violations)).toEqual(['bpmn.pool-end-without-start pool']);
    // The finding lands ON the frame, which is what puts the bracket on the pool
    // and what makes an arbitration cover this participant and no other.
    expect(violations[0].backgroundId).toBe('pool');
    expect(violations[0].severity).toBe('warning');
  });

  it('indicts a pool that says where it begins and not where it ends', () => {
    const board = poolHolding(
      start('start', 100, 150),
      task('first', 300, 150),
      flow('f1', 'start', 'first')
    );
    expect(told(pending(board))).toEqual(['bpmn.pool-start-without-end pool']);
    // `first` leads nowhere, which is how the pool comes to have no end event
    // at all — the panel remarks on it, the canvas says the one thing.
    expect(said(pending(board))).toContain('bpmn.activity-dead-end first');
  });

  it('says nothing about a pool holding both', () => {
    const board = poolHolding(
      start('start', 100, 150),
      task('first', 300, 150),
      end('done', 600, 150),
      flow('f1', 'start', 'first'),
      flow('f2', 'first', 'done')
    );
    expect(said(pending(board))).toEqual([]);
  });

  it('counts the message and timer starts as starts', () => {
    // `roleIsA`, so "one start event" stays one requirement as the vocabulary
    // grows: a pool woken by a message is not a pool with no beginning.
    const board = poolHolding(
      node('woken', BPMN_ROLE.startEventMessage, 100, 150, 40, 40),
      task('first', 300, 150),
      node('stopped', BPMN_ROLE.endEventTerminate, 600, 150, 40, 40),
      flow('f1', 'woken', 'first'),
      flow('f2', 'first', 'stopped')
    );
    expect(said(pending(board))).toEqual([]);
  });

  it('says nothing about a pool holding NEITHER event', () => {
    // A black-box participant in a collaboration is conformant with nothing
    // inside it (p.238 / p.246). Until `RoleCountDef.ifPresent` is honoured the
    // engine reads `{ subject, min: 1 }` unconditionally and indicts this board
    // twice — which is exactly why these two rules are NOT registered yet.
    const board = poolHolding(
      task('first', 250, 150),
      task('second', 500, 150),
      flow('f1', 'first', 'second'),
      flow('f2', 'second', 'first')
    );
    expect(said(pending(board))).toEqual([]);
  });
});

describe('pending · the gateways, as forbidden zones', () => {
  /**
   * Both gateway rules need `EdgeDegreeDef.forbidPattern` — a bag of bounds that
   * is a finding only when they ALL hold at once. Every half of every pattern
   * below is perfectly ordinary on its own, which is exactly why the family's
   * four independent bounds cannot express either rule: `minIn: 2` alone indicts
   * every merge on every diagram.
   *
   * Until the field lands, both declare no bound the engine recognises: it warns
   * once and evaluates nothing.
   */
  const withGateway = (...extra: GfxPrimitiveElementModel[]) => [
    pool('pool', [0, 0, 900, 300]),
    start('start', 100, 150),
    gateway('decide', 300, 150),
    end('done', 800, 150),
    flow('f1', 'start', 'decide'),
    ...extra,
  ];

  it('indicts a gateway with one flow in and one out', () => {
    // p.289, read as the forbidden zone `{ maxIn: 1, maxOut: 1 }` — which is
    // also, exactly, the "superfluous gateway" nudge. One predicate, one rule.
    const board = withGateway(
      task('only', 550, 150),
      flow('f2', 'decide', 'only'),
      flow('f3', 'only', 'done')
    );
    expect(said(pending(board))).toEqual(['bpmn.gateway-must-branch decide']);
  });

  it('says nothing about a gateway that splits', () => {
    const board = withGateway(
      task('yes', 550, 90),
      task('no', 550, 210),
      flow('f2', 'decide', 'yes'),
      flow('f3', 'decide', 'no'),
      flow('f4', 'yes', 'done'),
      flow('f5', 'no', 'done')
    );
    expect(said(pending(board))).toEqual([]);
  });

  it('indicts a gateway that merges AND splits', () => {
    // bpmnlint's `no-gateway-join-fork`: a reader cannot tell whether the
    // diamond waits for both incoming paths or races them.
    const board = [
      pool('pool', [0, 0, 900, 300]),
      // TYPED starts, so the two-blank-starts remark does not ride along on a
      // board that is about the gateway.
      node('a-start', BPMN_ROLE.startEventMessage, 100, 90, 40, 40),
      node('b-start', BPMN_ROLE.startEventTimer, 100, 210, 40, 40),
      gateway('both', 400, 150),
      task('yes', 620, 90),
      task('no', 620, 210),
      end('done', 850, 150),
      flow('f1', 'a-start', 'both'),
      flow('f2', 'b-start', 'both'),
      flow('f3', 'both', 'yes'),
      flow('f4', 'both', 'no'),
      flow('f5', 'yes', 'done'),
      flow('f6', 'no', 'done'),
    ];
    expect(said(pending(board))).toEqual(['bpmn.gateway-join-and-fork both']);
  });
});

describe('pending · the panel-only nuances', () => {
  /**
   * Four `audit` rules, every one of them quieter than the bpmnlint level for
   * the same shape, and every one of them waiting on a def field. They never
   * reach the canvas: `audit` is collected for the conformance panel and shown
   * to no drawing user.
   */
  it('remarks on several paths arriving at one step', () => {
    // p.151 sanctions the uncontrolled merge and defines its token semantics,
    // so this is a question the diagram no longer asks out loud, not a mistake.
    const board = [
      pool('pool', [0, 0, 900, 300]),
      node('a-start', BPMN_ROLE.startEventMessage, 100, 90, 40, 40),
      node('b-start', BPMN_ROLE.startEventTimer, 100, 210, 40, 40),
      task('merge-here', 450, 150),
      end('done', 800, 150),
      flow('f1', 'a-start', 'merge-here'),
      flow('f2', 'b-start', 'merge-here'),
      flow('f3', 'merge-here', 'done'),
    ];
    const violations = pending(board);
    expect(said(violations)).toEqual(['bpmn.fake-join merge-here']);
    expect(violations[0].severity).toBe('audit');
  });

  it('remarks on several paths leaving one step', () => {
    const board = [
      pool('pool', [0, 0, 900, 300]),
      start('start', 100, 150),
      task('split-here', 350, 150),
      end('a-done', 800, 90),
      end('b-done', 800, 210),
      flow('f1', 'start', 'split-here'),
      flow('f2', 'split-here', 'a-done'),
      flow('f3', 'split-here', 'b-done'),
    ];
    expect(said(pending(board))).toEqual(['bpmn.implicit-split split-here']);
  });

  it('remarks on two indistinguishable blank starts', () => {
    // bpmnlint's `single-blank-start-event`. `RoleCountDef.exact` is what makes
    // the TYPED starts not count: being typed is what makes them tellable
    // apart, which is the whole content of the rule.
    // Each start leads to its OWN step and the two paths meet at the end event,
    // which no degree rule is written on — so the board says exactly the one
    // thing this case is about.
    const twoBlank = [
      pool('pool', [0, 0, 900, 300]),
      start('one', 100, 90),
      start('two', 100, 210),
      task('work-a', 450, 90),
      task('work-b', 450, 210),
      end('done', 800, 150),
      flow('f1', 'one', 'work-a'),
      flow('f2', 'two', 'work-b'),
      flow('f3', 'work-a', 'done'),
      flow('f4', 'work-b', 'done'),
    ];
    expect(said(pending(twoBlank))).toEqual(['bpmn.single-blank-start pool']);

    // ...and a message start beside a timer start is the diagram this rule
    // exists to PERMIT: two triggers, two symbols, no ambiguity.
    const twoTyped = [
      pool('pool', [0, 0, 900, 300]),
      node('by-message', BPMN_ROLE.startEventMessage, 100, 90, 40, 40),
      node('by-timer', BPMN_ROLE.startEventTimer, 100, 210, 40, 40),
      task('work-a', 450, 90),
      task('work-b', 450, 210),
      end('done', 800, 150),
      flow('f1', 'by-message', 'work-a'),
      flow('f2', 'by-timer', 'work-b'),
      flow('f3', 'work-a', 'done'),
      flow('f4', 'work-b', 'done'),
    ];
    expect(said(pending(twoTyped))).toEqual([]);
  });

  it('remarks on a step nobody has named', () => {
    // bpmnlint makes `label-required` an ERROR. Ours is `audit` AND
    // `on-demand`: a task is created unnamed, so a realtime rule would bracket
    // every symbol the moment it appears. "Three steps are unnamed" belongs to
    // the check-up panel, once, when somebody asks whether the diagram is done.
    const board = [
      pool('pool', [0, 0, 900, 300]),
      start('start', 100, 150),
      element('nameless', BPMN_ROLE.task, [300, 120, 100, 60]),
      end('done', 800, 150),
      flow('f1', 'start', 'nameless'),
      flow('f2', 'nameless', 'done'),
    ];
    // Nothing on the drawing path: `moment: 'on-demand'` takes the rule out of
    // `evaluateRules` before a single element is touched, which is also what
    // keeps `text` off the watched props — typing into a task never
    // re-evaluates the surface.
    expect(said(evaluate(board))).toEqual([]);
    expect(said(checkup(board))).toEqual(['bpmn.unlabeled-step nameless']);
  });
});

describe('pending · implicit roots on the reachability sweep', () => {
  it('treats an in-degree-zero step as a parallel start', () => {
    // A Process may start without a Start Event, and then every flow object with
    // no incoming sequence flow instantiates it (p.238 / p.245). Declared today
    // as `ReachabilityDef.implicitRoots`; ignored by the engine as it stands,
    // which makes the rule report a SUPERSET of the corrected answer — never a
    // different one, which is why B12 ships while the two role-count rules wait.
    const board = [
      pool('pool', [0, 0, 900, 300]),
      start('start', 100, 100),
      task('main', 300, 100),
      end('done', 800, 150),
      flow('f1', 'start', 'main'),
      flow('f2', 'main', 'done'),
      // A second, parallel branch with no start event of its own.
      task('parallel', 300, 240),
      flow('f3', 'parallel', 'done'),
    ];
    expect(said(checkup(board))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The congruence guard.
// ---------------------------------------------------------------------------

describe('congruence · one board, one answer to "which pool is this on"', () => {
  /**
   * `bpmnPoolOf` (the fact a host, a template check or a command asks) and the
   * rules that count and localise (what the engine computes) resolve the same
   * question through the same declaration. If they ever diverge, a user is shown
   * a bracket on a participant they can see the artefact is not in, and no
   * answer can be called the right one.
   *
   * The nominal case only. The title-band divergence — an artefact laid over the
   * participant name band is in the element box and OUT of the plot — is
   * documented in `facts.ts` and pinned in `facts.unit.spec.ts`; the point here
   * is that the two readings AGREE wherever the answer is not on a knife edge.
   */
  const buyer = pool('buyer', [0, 0, 800, 300]);
  const seller = pool('seller', [0, 400, 800, 300]);
  const pools = [buyer, seller] as unknown as BpmnPoolElementModel[];

  it('credits a start event to the pool the fact query names', () => {
    // Each pool already holds an end event, so the paired rule is armed on both
    // — which makes the assertion read the same before and after
    // `RoleCountDef.ifPresent` lands.
    const ends = [end('buyer-done', 700, 250), end('seller-done', 700, 650)];
    for (const [cx, cy, expected] of [
      [BAND + 20, 20, 'buyer'],
      [400, 150, 'buyer'],
      [780, 290, 'buyer'],
      [400, 550, 'seller'],
    ] as const) {
      const event = start('probe', cx, cy);
      // The fact, answered without an editor…
      expect(bpmnPoolOf(pools, event.elementBound)?.id, `${cx},${cy}`).toBe(
        expected
      );
      // …and the rule, answered by the engine's own containment walk: the pool
      // that is NOT credited is the one indicted for holding no start event.
      const indicted = pending([buyer, seller, ...ends, event])
        .filter(v => v.ruleId === 'bpmn.pool-end-without-start')
        .map(v => v.elementIds.join(''));
      expect(indicted, `${cx},${cy}`).toEqual([
        expected === 'buyer' ? 'seller' : 'buyer',
      ]);
    }
  });

  it('reads a flow as staying home exactly when the fact says both ends are', () => {
    const here = task('here', 300, 150);
    const there = task('there', 300, 550);
    const home = flow('home', 'here', 'there');

    expect(bpmnPoolOf(pools, here.elementBound)?.id).toBe('buyer');
    expect(bpmnPoolOf(pools, there.elementBound)?.id).toBe('seller');
    // Two different pools by the fact query, so the locality rule speaks.
    expect(
      evaluate([buyer, seller, here, there, home])
        .filter(v => v.ruleId === 'bpmn.sequence-flow-stays-home')
        .map(v => v.elementIds.join(' '))
    ).toEqual(['here home there']);

    // Slide the second step up into the first pool and both readings flip
    // together: the fact says one pool, the rule falls silent.
    const moved = task('there', 500, 150);
    expect(bpmnPoolOf(pools, moved.elementBound)?.id).toBe('buyer');
    expect(
      evaluate([buyer, seller, here, moved, home]).filter(
        v => v.ruleId === 'bpmn.sequence-flow-stays-home'
      )
    ).toEqual([]);
  });
});
