import type {
  EdgeDegreeDef,
  EndpointTriplet,
  ReachabilityDef,
  RoleCountDef,
  ValidationRule,
} from '@labre/affine-block-surface';
import type { RoleId } from '@labre/std/gfx';

import { BPMN_POOL_BACKGROUND } from './background.js';
import { BPMN_ROLE, BPMN_ROLES } from './roles.js';

/**
 * BPMN validation rules — the descriptive profile, as DATA (B6 of the pack).
 *
 * DATA owned by the framework, versioned per rule: the engine
 * (`@labre/affine-block-surface`) knows how to evaluate a FAMILY, never a
 * concrete rule, so adding a BPMN rule is adding an entry to the array at the
 * bottom of this file. Registered from the flag-gated `BpmnViewExtension`, so
 * switching the `bpmn` flag off removes the rules with the rest of the tooling
 * — processes already drawn keep rendering, they simply stop being checked
 * (`docs/adr/0009`).
 *
 * ## Every rule is read off the SPEC, and cites where
 *
 * The page references below are to **BPMN 2.0.2 (OMG / ISO-IEC 19510)**, which
 * the PO supplied. They are not decoration: three rules in the first draft of
 * this pack fired on diagrams the specification explicitly sanctions, and the
 * only thing that caught them was reading the normative text rather than the
 * folklore. A rule with no citation here is a rule about a LABRE convention, and
 * says so in its own comment — there is exactly one (`forbidSelfLoop`).
 *
 * ## Why BPMN is the framework that needed five families
 *
 * A Wardley map is judged element by element: where a thing sits, which way an
 * arrow points. A process is judged by its JOINTS. Every question below is about
 * a relation, a count of relations, the frames two ends sit in, or the graph the
 * relations build — which is why four of the five families arrived with the
 * engine work that preceded this file, and why none of them names BPMN.
 *
 * - `relation-endpoints` (B1–B5) — WHAT a link may run between, and how many
 *   times. The grammar.
 * - `edge-degree` (B6–B10, B16–B19) — HOW MANY links arrive at and leave one
 *   symbol. The half no per-link rule can express: nothing is wrong with any
 *   single arrow, the mistake is the count.
 * - `edge-locality` (B11–B12) — WHICH POOL each end sits in. The swimlane
 *   question, and the one where the two ends carry identical roles in the legal
 *   case and the illegal one.
 * - `role-count` (B14–B15, B20) — what one pool must CONTAIN, and only when it
 *   already contains the other half of the pair.
 * - `reachability` (B13) — can you get there from the start. The graph question.
 * - `label-presence` (B21) — does the symbol carry a name at all.
 *
 * ## The industry linters, and where we deliberately differ
 *
 * The inventory was triangulated against **bpmnlint** (the bpmn-js ecosystem's
 * linter, the one a BPMN practitioner will already have met),
 * bpmn-visualization-js and JointJS. Where a bpmnlint rule reads the same
 * normative sentence we do, the id and the wording are chosen so a user
 * recognises it; where we are quieter, the rule comment says why in its own
 * paragraph. Two of theirs are NOT adopted:
 *
 * - **`no-implicit-start`** (ERROR there). It contradicts p.238: a Process is not
 *   required to contain a Start Event, and a flow object with no incoming
 *   sequence flow is then a legitimate parallel start (p.245). We sided with the
 *   specification — that decision is what
 *   {@link PendingReachabilityDef.implicitRoots} implements, and adopting the
 *   linter's rule would have meant shipping the two in contradiction.
 * - **any overlap / readability rule.** The engine's pair-wise budget is pinned
 *   by the Wardley bench, which asserts that `wardley.overlapping-artefacts` is
 *   the ONLY registered `no-overlap` rule — a second one triggers the
 *   spatial-index obligation. That is a piece of engine work with its own
 *   measurements, not a line of data, so it is a backlog item and not this file.
 *
 * ## Severity: `warning` almost everywhere, `audit` where the spec allows the
 * shape, and `blocking-overridable` nowhere
 *
 * The same promise `wardley/rules.ts:30` makes, for the same reason: NOTHING
 * downstream implements a blocking level — no gesture is refused anywhere in
 * this library — so shipping the value would be data claiming an effect that
 * does not exist. Several of these are normative MUSTs and would sit there; they
 * move in one line each, in `profiles.ts`, the day the gesture refusal lands.
 *
 * Five rules are declared `audit` on their own — `bpmn.activity-dead-end`,
 * `bpmn.fake-join`, `bpmn.implicit-split`, `bpmn.single-blank-start` and
 * `bpmn.unlabeled-step` — because in each case the specification sanctions the
 * shape they report, or the diagram is merely unfinished. They are NUANCES for
 * the conformance panel, never warnings on the canvas, and every one of them is
 * quieter than the corresponding bpmnlint level on purpose.
 *
 * The severities declared here are the DESCRIPTIVE posture; `bpmn.sketch` — the
 * default — demotes every one of them to `audit`, so the drawing hand is never
 * argued with until someone asks for the stricter profile. See `profiles.ts`.
 *
 * ## What the whole file stays silent about
 *
 * A process drawn before the roles existed carries no role on anything, so it is
 * never evaluated and never says a word (PRD principle 8). A process drawn
 * before anybody added a pool has no frame for B11–B15 and B20 to be about, and those
 * six are silent by construction.
 *
 * ## One thing the `relation-endpoints` family cannot say
 *
 * The ALPHABET of a `relation-endpoints` rule is derived from the roles its
 * sanctioned triplets name. That is what makes the family proportionate — an end
 * outside the alphabet takes the whole link out of the conversation, so a flow
 * drawn onto a sticky note is a draft and not a finding — and it is also its one
 * limit: **a framework cannot name a role it wants to REJECT without sanctioning
 * a sentence for it.**
 *
 * Three normative prohibitions are therefore SILENCE rather than findings today:
 *
 * - "an Artifact MUST NOT be the source or target of a Sequence Flow" (p.65) and
 *   "a Sequence Flow connects Events, Activities and Gateways" (p.95) — a
 *   sequence flow dropped on a text annotation or a data object goes unjudged;
 * - "a Message Flow MUST NOT connect to a Gateway" (p.152) — a gateway is named
 *   by no message sentence, so it is outside B2's alphabet.
 *
 * Reported to the engine author rather than worked around here: a triplet
 * written to widen an alphabet without meaning what it says would be exactly the
 * data-that-lies this platform refuses everywhere else. The corpus pins the
 * silence explicitly (`corpus.unit.spec.ts`), so it stays a known limit rather
 * than an assumption.
 *
 * ## Fields this file writes ahead of the engine
 *
 * {@link PendingRoleCountDef}, {@link PendingEdgeDegreeDef} and
 * {@link PendingReachabilityDef} declare three fields that `claude/bpmn-engine-v2`
 * adds. They are ordinary sub-types of the engine's own defs — no cast, no
 * augmentation, nothing in `validation.ts` touched — so the data is authored and
 * reviewable today and starts working the day that branch lands. The two rules
 * that would be WRONG without their field are held out of {@link BPMN_RULES} in
 * {@link BPMN_RULES_PENDING_ENGINE_V2}; registering them is one line.
 */

/**
 * `RoleCountDef.ifPresent` — the bounds apply only when the frame also holds at
 * least one element of this role.
 *
 * The field the paired existence rules cannot be written without. Per the spec a
 * pool needs NEITHER a start nor an end event: a Process is not required to
 * contain either (p.238), an End Event is optional (p.246), and a pool drawn as
 * a black box in a collaboration is conformant with nothing inside it at all. It
 * is the PAIRING that is normative — a process that says where it begins and not
 * where it stops leaves the reader with no outcome — so the requirement is
 * conditional by nature and no unconditional `min` can express it.
 *
 * Added by `claude/bpmn-engine-v2`.
 */
interface PendingRoleCountDef extends RoleCountDef {
  ifPresent: RoleId;
}

/** The four bounds of {@link EdgeDegreeDef}, as a bag. */
type DegreeBounds = Pick<
  EdgeDegreeDef,
  'minIn' | 'maxIn' | 'minOut' | 'maxOut'
>;

/**
 * `EdgeDegreeDef.forbidPattern` — a FORBIDDEN ZONE: the subject is a finding
 * when EVERY bound in the bag holds at once.
 *
 * The four bounds the family has today are a conjunction of REQUIREMENTS, each
 * of which fires on its own. Four of the rules below need the opposite reading:
 * a shape is wrong only when several counts hold TOGETHER, and each of them
 * alone is perfectly ordinary. "A gateway that both merges and splits" is
 * `minIn: 2` and `minOut: 2` at the same time; every gateway on a real diagram
 * satisfies one of the two.
 *
 * ## It also subsumes the disjunction, which is why no `eitherMin` is asked for
 *
 * "A Gateway MUST have either multiple incoming or multiple outgoing Sequence
 * Flows" (p.289) reads as a forbidden zone with no negation at all:
 * `{ maxIn: 1, maxOut: 1 }` — at most one in AND at most one out — is exactly
 * the set of gateways that neither merge nor split. One field instead of two,
 * and the field is the more general one.
 *
 * Added by `claude/bpmn-engine-v2`.
 */
interface PendingForbidPatternDef extends EdgeDegreeDef {
  forbidPattern: DegreeBounds;
}

/**
 * `RoleCountDef.exact` — count elements carrying the subject role ITSELF, with
 * no `roleIsA` descent into its specialisations.
 *
 * The default is the descent, and it is right for every existence rule here: "a
 * pool holds a start event" must stay one requirement when a message start and a
 * timer start land under it. {@link singleBlankStart} needs the other reading and
 * cannot fake it: its whole point is that TYPED starts are distinguishable from
 * one another and untyped ones are not, so it counts the blank ones and must not
 * see the triggers.
 *
 * Added by `claude/bpmn-engine-v2`.
 */
interface PendingExactRoleCountDef extends RoleCountDef {
  exact: true;
}

/**
 * The `label-presence` family — "does this artefact carry a name at all".
 *
 * A new family, so it is a string the engine's own `RuleFamily` union does not
 * contain yet, and this file must not edit that union. Cast ONCE, here, with the
 * reason written down: the alternative is a copy of `ValidationRule` in a
 * framework package, which would be a far larger lie than one string.
 *
 * Added by `claude/bpmn-engine-v2`.
 */
const LABEL_PRESENCE_FAMILY = 'label-presence' as ValidationRule['family'];

/**
 * `ReachabilityDef.implicitRoots` — a subject with NO incoming typed edge is
 * seeded as a root of the traversal.
 *
 * A Process may start without a Start Event, in which case every flow object
 * with no incoming sequence flow is an implicit parallel start (p.238, p.245).
 * Without this, a pool drawn that way has every one of its steps reported
 * unreachable — one wall of brackets for a shape the spec allows.
 *
 * Added by `claude/bpmn-engine-v2`. Declared today because it only ever makes
 * the rule QUIETER: an engine that ignores it reports a superset of what the
 * corrected one reports, so nothing is silently mis-judged in the meantime.
 */
interface PendingReachabilityDef extends ReachabilityDef {
  implicitRoots: true;
}

/**
 * The pending defs are declared as NAMED CONSTS rather than inline in their
 * rule, and that is a TypeScript necessity rather than a style: an object
 * literal written straight into `ValidationRule.reachability` is checked against
 * that property's declared type and its extra key is rejected as excess, whereas
 * a const of the sub-type is assignable to the super-type like any other value.
 * No cast, no `any`, and the day the engine gains the fields these four consts
 * fold back inline with nothing else changing.
 */
const REACHES_EVERY_STEP: PendingReachabilityDef = {
  rootRole: BPMN_ROLE.startEvent,
  subjectRole: BPMN_ROLE.flowObject,
  edgeRole: BPMN_ROLE.sequenceFlow,
  // p.238 / p.245 — see {@link unreachableStep}. Honoured by
  // `claude/bpmn-engine-v2`; ignored before it, which only ever makes the rule
  // louder, never wrong in the other direction.
  implicitRoots: true,
};

/** p.238 / p.246 — the pairing, not the events. See {@link poolEndWithoutStart}. */
const START_IF_END: PendingRoleCountDef = {
  // Matched by `roleIsA`, so the message and timer starts count. "One start
  // event" stays one requirement as the vocabulary grows.
  subject: BPMN_ROLE.startEvent,
  min: 1,
  ifPresent: BPMN_ROLE.endEvent,
};

/** The mirror. See {@link poolStartWithoutEnd}. */
const END_IF_START: PendingRoleCountDef = {
  subject: BPMN_ROLE.endEvent,
  min: 1,
  ifPresent: BPMN_ROLE.startEvent,
};

/** p.289 — neither merges nor splits. See {@link gatewayMustBranch}. */
const NEITHER_MERGES_NOR_SPLITS: PendingForbidPatternDef = {
  edgeRole: BPMN_ROLE.sequenceFlow,
  forbidPattern: { maxIn: 1, maxOut: 1 },
};

/** Merging AND splitting at one diamond. See {@link gatewayJoinAndFork}. */
const MERGES_AND_SPLITS: PendingForbidPatternDef = {
  edgeRole: BPMN_ROLE.sequenceFlow,
  forbidPattern: { minIn: 2, minOut: 2 },
};

/** More than one flow arriving at a step. See {@link fakeJoin}. */
const MERGES_WITHOUT_A_GATEWAY: PendingForbidPatternDef = {
  edgeRole: BPMN_ROLE.sequenceFlow,
  forbidPattern: { minIn: 2 },
};

/** More than one flow leaving a step. See {@link implicitSplit}. */
const SPLITS_WITHOUT_A_GATEWAY: PendingForbidPatternDef = {
  edgeRole: BPMN_ROLE.sequenceFlow,
  forbidPattern: { minOut: 2 },
};

/** At most one BLANK start per pool — the triggers do not count. See {@link singleBlankStart}. */
const ONE_BLANK_START: PendingExactRoleCountDef = {
  subject: BPMN_ROLE.startEvent,
  max: 1,
  exact: true,
};

/**
 * The one sanctioned sentence of a sequence flow: a flow object is followed by a
 * flow object (p.95 — "a Sequence Flow connects Events, Activities and
 * Gateways").
 *
 * Written on `bpmn:flow-object` rather than on the three families under it, which
 * is what makes it ONE triplet instead of nine: `roleIsA` resolves it for every
 * event, activity and gateway, and for whatever the descriptive profile adds
 * under them later.
 *
 * Exported so a test asserts THIS table rather than a copy of it, and so B4
 * declares the same alphabet it judges neutral links against without restating
 * it — see {@link untypedFlow}.
 */
export const BPMN_SEQUENCE_MATRIX: readonly EndpointTriplet[] = [
  {
    source: BPMN_ROLE.flowObject,
    edge: BPMN_ROLE.sequenceFlow,
    target: BPMN_ROLE.flowObject,
  },
];

/**
 * **B1** — a sequence flow chains steps of the same process, and never a step
 * onto itself.
 *
 * The base grammar (p.95). Its matrix holds ONE sentence, and
 * `bpmn:flow-object` is therefore the whole alphabet of the rule — which makes
 * the off-matrix branch structurally unreachable, exactly like Context Mapping's
 * CM1, and for exactly the same reason: **the matrix is here to declare the
 * alphabet**.
 *
 * That alphabet is what makes the rule proportionate, and it is also where two
 * normative prohibitions go quiet: an Artifact — a text annotation, a group —
 * must not be a sequence flow endpoint (p.65), and neither must a data element
 * (p.95), but neither is named by the sentence above, so a flow dropped on one is
 * outside the conversation. See the file header; the corpus pins it.
 *
 * ## The self-loop is a LABRE convention, not a conformance requirement
 *
 * The single clause of this rule that fires today, and the only rule in this file
 * with no page behind it. The specification contains no normative prohibition on
 * a Sequence Flow whose source and target are the same flow object; the "no
 * self-loop" habit comes from the BPMN 1.x loop idiom, which 2.0 replaced with
 * activity loop MARKERS and standard loop characteristics.
 *
 * We keep it, at `warning`, because on a DESCRIPTIVE diagram a step drawn as
 * following itself tells the reader nothing about what decides to repeat it —
 * and the notation that does is one gateway away. It is our house style, said
 * out loud, and the message says so rather than implying the spec forbids it.
 */
const sequenceFlowEndpoints: ValidationRule = {
  id: 'bpmn.sequence-flow-endpoints',
  framework: 'bpmn',
  family: 'relation-endpoints',
  severity: 'warning',
  // No `appliesTo`: the subject is a RELATION, and the role that names it is
  // declared where the family reads it — naming one of the three indicted
  // elements here would be data that lies.
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.sequence-flow-endpoints',
  messageFallback: 'This sequence flow does not chain two steps of a process.',
  suggestionKey: 'com.labre.bpmn.rule.sequence-flow-endpoints.suggestion',
  suggestionFallback:
    'A sequence flow runs between events, activities and gateways of one process — between pools, send a message flow instead.',
  version: 1,
  // Not a frame the rule measures against — a sentence is right or wrong
  // wherever it is drawn — but the pool a finding is ATTRIBUTED to, so the
  // arbitration "ignore this rule on this participant" has somewhere to live.
  // The `wardley.overlapping-artefacts` pattern, and the reason no background
  // DECLARATION is carried: this rule reads no geometry at all.
  backgroundRole: BPMN_ROLE.pool,
  endpoints: {
    edgeRole: BPMN_ROLE.sequenceFlow,
    allowed: BPMN_SEQUENCE_MATRIX,
    forbidSelfLoop: true,
    // Deliberately NOT `forbidDuplicate`. Two sequence flows between the same
    // two steps is how a hand draws a process it is still thinking about, and on
    // a descriptive diagram it is read by following arrows rather than by
    // counting them — the Event Storming call, for the same reason, and the
    // opposite of the Context Mapping one where the same pattern twice is a
    // claim made twice.
    selfLoop: {
      messageKey: 'com.labre.bpmn.rule.sequence-flow-self-loop',
      messageFallback: 'This sequence flow loops back onto the step it leaves.',
      suggestionKey: 'com.labre.bpmn.rule.sequence-flow-self-loop.suggestion',
      suggestionFallback:
        'BPMN does not forbid this, but a descriptive diagram reads better when what decides to repeat a step is drawn: send the flow back through a gateway, or mark the activity as a loop.',
    },
  },
};

/**
 * **B2** — a message flow leaves what SENDS and arrives at what RECEIVES.
 *
 * The other flow, and the other verb: a sequence flow orders work inside one
 * participant, a message flow carries a message between two, and says nothing
 * about order at all.
 *
 * The four sanctioned sentences are the DIRECTED send/receive halves of the
 * notation, and the direction is the whole rule — the triplets are read
 * `source → target`, so encoding it needs nothing but the table:
 *
 * - an **activity** both sends and receives (p.152);
 * - an **end event** only SENDS. A message end event throws on the way out, and
 *   nothing arrives at an end because the instance is over (p.248);
 * - a **start event** only RECEIVES. A message start event is a participant being
 *   woken up by somebody else's message; it has nothing to send yet (p.245).
 *
 * The two reachable findings are therefore the two inversions — a message drawn
 * OUT of a start event, and a message drawn INTO an end event — and they are the
 * two a reader cannot recover from, because both say the instance runs backwards.
 *
 * ## What it is silent about
 *
 * A message flow onto a GATEWAY, which p.152 forbids outright. A gateway is
 * named by no sentence above, so it is outside the alphabet — see the file
 * header, where this is recorded as an engine limit rather than a decision.
 * Text annotations and data elements are outside it too, for the ordinary
 * reason: they are not endpoints of a message.
 *
 * Pools are outside it as well, and there it is the RIGHT answer in this editor:
 * a pool is not a connectable artefact here, so a message between two
 * participants is drawn between the artefacts inside them. The locality half —
 * "a Message Flow MUST connect two separate Pools" (p.119) — is B12's question,
 * and B12 deliberately stays silent when an end sits inside no pool at all: the
 * sketch primes.
 */
const messageFlowEndpoints: ValidationRule = {
  id: 'bpmn.message-flow-endpoints',
  framework: 'bpmn',
  family: 'relation-endpoints',
  severity: 'warning',
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.message-flow-endpoints',
  messageFallback:
    'This message flow runs out of something that only receives, or into something that only sends.',
  suggestionKey: 'com.labre.bpmn.rule.message-flow-endpoints.suggestion',
  suggestionFallback:
    'A message leaves an activity or an end event, and arrives at an activity or a start event: a start event is woken up by a message and has none to send, and an end event is where the instance stops.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  endpoints: {
    edgeRole: BPMN_ROLE.messageFlow,
    allowed: [
      // An activity sends, and an activity receives (p.152).
      {
        source: BPMN_ROLE.activity,
        edge: BPMN_ROLE.messageFlow,
        target: BPMN_ROLE.activity,
      },
      // An activity wakes a participant up (p.245).
      {
        source: BPMN_ROLE.activity,
        edge: BPMN_ROLE.messageFlow,
        target: BPMN_ROLE.startEvent,
      },
      // An end event throws on the way out (p.248)…
      {
        source: BPMN_ROLE.endEvent,
        edge: BPMN_ROLE.messageFlow,
        target: BPMN_ROLE.activity,
      },
      // …including to the participant it wakes up.
      {
        source: BPMN_ROLE.endEvent,
        edge: BPMN_ROLE.messageFlow,
        target: BPMN_ROLE.startEvent,
      },
    ],
  },
};

/**
 * **B3** — an association ties a note, or a document, to the work.
 *
 * The third connecting object, and the only one that is not a flow: it carries
 * no token, states no order, and — as `roles.ts` says at length — has no verb, so
 * it reads identically from either end. That is why every sentence below is
 * declared in BOTH directions: the notation does not distinguish them, and a
 * rule that did would indict a hand for dragging the other way round.
 *
 * Our vocabulary has ONE association role, so this one rule covers both of the
 * spec's kinds:
 *
 * - a plain **Association** attaches a text annotation to whatever it comments
 *   on — and an annotation may comment on anything, including the pool itself;
 * - a **DataAssociation** ties a data object or a data store to the activity or
 *   event that reads or produces it (p.222). Never to a gateway: a gateway
 *   decides, it does not handle paperwork.
 *
 * ## The two reachable findings
 *
 * A gateway IS in the alphabet — it is a flow object, which the annotation
 * sentences name — so an association from a gateway to a data element is a
 * finding rather than silence. And so is an association between two DATA
 * elements: data is named as an endpoint, so it is in the alphabet, and no
 * sentence relates one document to another. The drawn endpoints of a data
 * association join data to WORK.
 *
 * An association drawn between two tasks is a finding too — somebody reached for
 * a sequence flow and got the undirected line.
 */
const associationEndpoints: ValidationRule = {
  id: 'bpmn.association-endpoints',
  framework: 'bpmn',
  family: 'relation-endpoints',
  severity: 'warning',
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.association-endpoints',
  messageFallback:
    'This association does not tie a note or a document to the work.',
  suggestionKey: 'com.labre.bpmn.rule.association-endpoints.suggestion',
  suggestionFallback:
    'An association attaches a text annotation to what it comments on, or a data object to the step that reads or produces it. To chain two steps, draw a sequence flow instead.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  endpoints: {
    edgeRole: BPMN_ROLE.association,
    allowed: [
      // A note about a step…
      {
        source: BPMN_ROLE.textAnnotation,
        edge: BPMN_ROLE.association,
        target: BPMN_ROLE.flowObject,
      },
      {
        source: BPMN_ROLE.flowObject,
        edge: BPMN_ROLE.association,
        target: BPMN_ROLE.textAnnotation,
      },
      // …a note about a document…
      {
        source: BPMN_ROLE.textAnnotation,
        edge: BPMN_ROLE.association,
        target: BPMN_ROLE.data,
      },
      {
        source: BPMN_ROLE.data,
        edge: BPMN_ROLE.association,
        target: BPMN_ROLE.textAnnotation,
      },
      // …a note about the participant itself. An annotation comments on anything
      // it is pointed at, and the pool is the one thing on the board a reader
      // most often wants a word about.
      {
        source: BPMN_ROLE.textAnnotation,
        edge: BPMN_ROLE.association,
        target: BPMN_ROLE.pool,
      },
      {
        source: BPMN_ROLE.pool,
        edge: BPMN_ROLE.association,
        target: BPMN_ROLE.textAnnotation,
      },
      // …and the document the work reads or produces (p.222). Activities and
      // events only: a gateway decides, it does not handle paperwork.
      {
        source: BPMN_ROLE.data,
        edge: BPMN_ROLE.association,
        target: BPMN_ROLE.activity,
      },
      {
        source: BPMN_ROLE.activity,
        edge: BPMN_ROLE.association,
        target: BPMN_ROLE.data,
      },
      {
        source: BPMN_ROLE.data,
        edge: BPMN_ROLE.association,
        target: BPMN_ROLE.event,
      },
      {
        source: BPMN_ROLE.event,
        edge: BPMN_ROLE.association,
        target: BPMN_ROLE.data,
      },
    ],
  },
};

/**
 * **B4** — a plain connector between two steps is a flow nobody typed.
 *
 * The gap every other rule in this file falls through. BPMN's own link tools
 * stamp a role; quick-connect and auto-complete do not, so releasing the canvas'
 * link gesture between two tasks produces a connector carrying NO role — which
 * says nothing to any grammar, any degree count, any locality check and any
 * traversal. A process joined that way LOOKS connected and validates as if
 * nobody had joined anything: every start event has no exit, every end event is
 * unreached, every step is an orphan, and the diagram on screen shows arrows.
 *
 * So the rule is not really about the connector: it is about the fourteen
 * verdicts that go quiet behind it.
 *
 * ## Why it declares a matrix it never judges anything against
 *
 * `flagNeutral` reads the rule's own ALPHABET to decide which role-less links it
 * may presume were meant as relations, so the matrix is how this rule says
 * "between two steps" — and, by saying only that, how it stays silent about
 * everything else. A plain connector onto a POOL, onto a data object, onto a
 * text annotation, onto a sticky note is an ANNOTATION and none of BPMN's
 * business: pointing at things is what a whiteboard is for.
 *
 * Nothing else in the declaration fires. The matrix is the same single sentence
 * B1 sanctions, so no typed sequence flow can be off it; `forbidSelfLoop` and
 * `forbidDuplicate` are absent, so loops and copies are B1's business and are
 * never reported twice. This rule raises exactly one kind of finding.
 *
 * No page: the specification has nothing to say about a connector the notation
 * does not contain. This is a rule about OUR canvas, and it exists because our
 * canvas has a gesture BPMN never anticipated.
 */
const untypedFlow: ValidationRule = {
  id: 'bpmn.untyped-flow',
  framework: 'bpmn',
  family: 'relation-endpoints',
  severity: 'warning',
  roles: BPMN_ROLES,
  // The rule's own words are never read: `flagNeutral` is the only verdict it
  // can reach, and it carries its own. Declared all the same, because the shape
  // requires them and a rule with no sentence at all is a rule nobody can review.
  messageKey: 'com.labre.bpmn.rule.untyped-flow',
  messageFallback:
    'This link between two steps says nothing the model records.',
  suggestionKey: 'com.labre.bpmn.rule.untyped-flow.suggestion',
  suggestionFallback:
    'Draw a sequence flow to order two steps of one process, or a message flow to send something between two participants. A plain connector is drawn on the diagram and absent from the model.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  endpoints: {
    edgeRole: BPMN_ROLE.sequenceFlow,
    // The alphabet, and nothing else: see the header. Same table B1 sanctions,
    // so the two can never disagree about what "a step" is.
    allowed: BPMN_SEQUENCE_MATRIX,
    flagNeutral: {
      messageKey: 'com.labre.bpmn.rule.untyped-flow.neutral',
      messageFallback: 'These two steps are joined by an untyped link.',
      suggestionKey: 'com.labre.bpmn.rule.untyped-flow.neutral.suggestion',
      suggestionFallback:
        'The diagram shows an arrow and the process holds none — nothing follows anything here. Draw it again with the sequence flow tool, or with the message flow tool if it crosses between participants.',
    },
  },
};

/**
 * **B5** — the same flow drawn twice between the same two steps.
 *
 * bpmnlint's `no-duplicate-sequence-flows`, which the bpmn-js ecosystem raises
 * at ERROR level, and a capability the engine has had since Context Mapping
 * asked for it — this rule is one flag, no engine work at all.
 *
 * Two arrows from A to B are one arrow drawn twice: the second says nothing the
 * first did not, and it makes the diagram read as if the process reached B twice.
 * Where a reader IS meant to see two routes, the routes leave from different
 * places — that is what a gateway is for.
 *
 * ## Why B1 does not carry the flag, and this rule does
 *
 * Because they are different requirements at different levels of tolerance, and
 * a profile has to be able to move one without the other. B1's self-loop is a
 * LABRE convention; this one is an industry rule with a normative-looking level
 * in every linter BPMN users have met. Keeping them apart also keeps the "one
 * mistake, one sentence" promise: `evaluateRelationEndpoints` reports at most
 * one finding per edge, so an edge indicted for its sentence is never also
 * indicted for being a copy — but only if the two rules are separate objects.
 *
 * ## What counts as a duplicate
 *
 * The same role AND the same ORDERED pair. A → B and B → A are two different
 * sentences — a request and its answer — and neither is a copy of the other.
 */
const duplicateSequenceFlow: ValidationRule = {
  id: 'bpmn.duplicate-sequence-flow',
  framework: 'bpmn',
  family: 'relation-endpoints',
  severity: 'warning',
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.duplicate-sequence-flow',
  messageFallback:
    'This sequence flow is already drawn between these two steps.',
  suggestionKey: 'com.labre.bpmn.rule.duplicate-sequence-flow.suggestion',
  suggestionFallback:
    'Delete the copy. Two routes to the same step leave from different places — draw the second one out of a gateway, so the diagram says what decides between them.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  endpoints: {
    edgeRole: BPMN_ROLE.sequenceFlow,
    // The alphabet again, and only the alphabet: the matrix cannot fire here
    // (B1 owns the sentence) and is present so that a flow onto an annotation,
    // a document or a pool stays outside the conversation.
    allowed: BPMN_SEQUENCE_MATRIX,
    forbidDuplicate: true,
    duplicate: {
      messageKey: 'com.labre.bpmn.rule.duplicate-sequence-flow.copy',
      messageFallback:
        'These two steps are already joined by a sequence flow going the same way.',
      suggestionKey:
        'com.labre.bpmn.rule.duplicate-sequence-flow.copy.suggestion',
      suggestionFallback:
        'The second arrow adds nothing a reader can act on. Delete it — or, if the two routes are genuinely different, send one of them through a gateway.',
    },
  },
};

/**
 * **B6** — a start event is where the process wakes up.
 *
 * Nothing flows INTO it: "a Start Event MUST NOT be a target of a Sequence Flow"
 * (p.244). A start event with an incoming sequence flow is one of two mistakes
 * and the user knows which — either the arrow is drawn backwards, or the symbol
 * is not a start at all and wanted to be an intermediate event, which the
 * descriptive profile does not draw, so it wanted to be a task.
 *
 * `maxIn: 0` and nothing else, so the two halves of "a start event begins the
 * process" stay two rules with two sentences and two gestures to fix them — see
 * {@link startEventMustExit}.
 *
 * Written on `bpmn:start-event`, so it covers the message and timer starts for
 * free: "the process wakes up here" is true of all three, and a rule about where
 * a process begins must never have to enumerate the triggers.
 */
const startEventNoInflow: ValidationRule = {
  id: 'bpmn.start-event-no-inflow',
  framework: 'bpmn',
  family: 'edge-degree',
  severity: 'warning',
  appliesTo: BPMN_ROLE.startEvent,
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.start-event-no-inflow',
  messageFallback: 'A sequence flow arrives at this start event.',
  suggestionKey: 'com.labre.bpmn.rule.start-event-no-inflow.suggestion',
  suggestionFallback:
    'A start event is where the process wakes up — nothing flows into it. Reverse the arrow, or make this step a task if something really does happen before it.',
  version: 1,
  // Attribution only, so an arbitration made on one participant covers that
  // participant. The count itself reads no geometry whatsoever.
  backgroundRole: BPMN_ROLE.pool,
  degree: {
    edgeRole: BPMN_ROLE.sequenceFlow,
    maxIn: 0,
  },
};

/**
 * **B7** — and something happens after it.
 *
 * "A Start Event MUST be a source of a Sequence Flow" (p.244). A start event with
 * nothing leaving it is a process that wakes up and does nothing — and, read
 * with B13, it is also the commonest cause of a whole pool being reported
 * unreachable, since the traversal leaves from exactly here.
 *
 * The mirror of B6 and a separate rule rather than a second bound on it,
 * deliberately: the two are fixed by opposite gestures, and one bracket saying
 * both would leave the user to work out which half they got wrong on a symbol
 * forty units across.
 */
const startEventMustExit: ValidationRule = {
  id: 'bpmn.start-event-must-exit',
  framework: 'bpmn',
  family: 'edge-degree',
  severity: 'warning',
  appliesTo: BPMN_ROLE.startEvent,
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.start-event-must-exit',
  messageFallback: 'Nothing follows this start event.',
  suggestionKey: 'com.labre.bpmn.rule.start-event-must-exit.suggestion',
  suggestionFallback:
    'Draw the sequence flow out of it to the first thing the process does — until then the diagram says the participant wakes up and stops.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  degree: {
    edgeRole: BPMN_ROLE.sequenceFlow,
    minOut: 1,
  },
};

/**
 * **B8** — an end event is where the process stops.
 *
 * "An End Event MUST NOT be a source of a Sequence Flow" (p.248). The mirror of
 * B6, and the same two mistakes read the other way: an arrow drawn backwards, or
 * a symbol that meant to be a step. Nothing leaves an end event, because there is
 * no instance left to carry the token.
 *
 * Written on `bpmn:end-event`, so the message and terminate ends are covered — a
 * terminate end is even more final than a plain one, and if anything the rule
 * matters more there.
 */
const endEventNoOutflow: ValidationRule = {
  id: 'bpmn.end-event-no-outflow',
  framework: 'bpmn',
  family: 'edge-degree',
  severity: 'warning',
  appliesTo: BPMN_ROLE.endEvent,
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.end-event-no-outflow',
  messageFallback: 'A sequence flow leaves this end event.',
  suggestionKey: 'com.labre.bpmn.rule.end-event-no-outflow.suggestion',
  suggestionFallback:
    'An end event is where the process stops — nothing leaves it. Reverse the arrow, or make this step a task if the process really does carry on.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  degree: {
    edgeRole: BPMN_ROLE.sequenceFlow,
    maxOut: 0,
  },
};

/**
 * **B9** — and something leads to it.
 *
 * "An End Event MUST be a target of a Sequence Flow" (p.248). An end event
 * nothing reaches is an outcome the process can never produce: the reader is
 * shown a result the diagram has no path to.
 *
 * The mirror of B7, separate from B8 for the reason B7 is separate from B6.
 */
const endEventMustBeReached: ValidationRule = {
  id: 'bpmn.end-event-must-be-reached',
  framework: 'bpmn',
  family: 'edge-degree',
  severity: 'warning',
  appliesTo: BPMN_ROLE.endEvent,
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.end-event-must-be-reached',
  messageFallback: 'Nothing leads to this end event.',
  suggestionKey: 'com.labre.bpmn.rule.end-event-must-be-reached.suggestion',
  suggestionFallback:
    'Draw the sequence flow into it from the last step of that path — an outcome nothing reaches is an outcome the process cannot produce.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  degree: {
    edgeRole: BPMN_ROLE.sequenceFlow,
    minIn: 1,
  },
};

/**
 * **B10** — a step that leads nowhere, when the diagram ends elsewhere.
 *
 * `audit`, and the only rule in this file declared so on its own. The
 * specification is explicit that an Activity with no outgoing Sequence Flow is a
 * legitimate way to end a path (p.151): the token simply ends there, and a
 * modelling STYLE that leaves the end events implicit is conformant BPMN.
 *
 * So this is not a conformance finding, and reporting it as one would be the tool
 * arguing with a house style the spec sanctions. It stays because on a
 * DESCRIPTIVE diagram — one drawn to be read by somebody who was not in the room
 * — the implicit ending is almost always an omission rather than a style: the
 * author drew end events for the other paths and forgot this one, and the reader
 * cannot tell "we are done" from "the rest is missing".
 *
 * `audit` is exactly that distinction: the finding reaches `violations$` for the
 * conformance panel and a report, and the canvas says nothing. `bpmn.descriptive`
 * leaves it there, which is the whole reason a profile spells every severity out.
 *
 * `minOut: 1`, on `bpmn:activity`, so it covers tasks, user and service tasks,
 * sub-processes and call activities alike.
 */
const activityDeadEnd: ValidationRule = {
  id: 'bpmn.activity-dead-end',
  framework: 'bpmn',
  family: 'edge-degree',
  // See the header: the spec sanctions the shape (p.151), so this is a nuance
  // for the panel and never a warning on the canvas.
  severity: 'audit',
  appliesTo: BPMN_ROLE.activity,
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.activity-dead-end',
  messageFallback: 'Nothing follows this step, so the path simply ends here.',
  suggestionKey: 'com.labre.bpmn.rule.activity-dead-end.suggestion',
  suggestionFallback:
    'BPMN allows a path to end at a step. With end events in play elsewhere on the diagram, a step that leads nowhere is usually an omission — draw the flow on, or add the end event that says this outcome was reached.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  degree: {
    edgeRole: BPMN_ROLE.sequenceFlow,
    minOut: 1,
  },
};

/**
 * **B11** — a sequence flow stays inside its pool.
 *
 * Half of what a swimlane diagram MEANS, and normative: "a Sequence Flow MUST
 * NOT cross a Pool boundary" (p.119). A pool is one participant and a sequence
 * flow is one participant's own order of work: a token never crosses from one
 * participant to another, because a participant cannot run another's steps. What
 * crosses is a message, and B12 is its half.
 *
 * Neither half is expressible by the grammar rules above, and that is the whole
 * reason `edge-locality` exists: the two ends carry exactly the same roles in the
 * legal case and the illegal one — task to task, either way — and the only thing
 * that differs is which pool each of them is drawn on.
 *
 * ## What it needs the pool DECLARATION for
 *
 * "Inside the pool" is read against the pool's PLOT, not its element box, and the
 * plot is where the declaration says the flow area starts — the left margin is
 * the participant name band, and a task lying on the band is not in the flow area
 * at all. Carrying `BPMN_POOL_BACKGROUND` here is what makes this rule and
 * `bpmnPoolOf` give one answer to "which pool is this on" instead of two.
 *
 * ## Silence
 *
 * Total, when either end sits inside NO pool — a step dropped beside the frame is
 * a draft, and a tool answering "that flow leaves the pool" would be indicting
 * the act of sketching. Total, on a board carrying no pool at all: a process
 * sketched before anybody drew a participant is a process, and this is the rule
 * that would otherwise light it up from end to end.
 */
const sequenceFlowStaysHome: ValidationRule = {
  id: 'bpmn.sequence-flow-stays-home',
  framework: 'bpmn',
  family: 'edge-locality',
  severity: 'warning',
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.sequence-flow-stays-home',
  messageFallback: 'This sequence flow crosses from one pool into another.',
  suggestionKey: 'com.labre.bpmn.rule.sequence-flow-stays-home.suggestion',
  suggestionFallback:
    'A sequence flow chains steps of the same participant — between pools, send a message flow instead, or move the step into the pool that performs it.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  // The declaration, so "inside the pool" means inside its FLOW AREA — the
  // participant name band is not part of it. Same plot `bpmnPoolOf` reads.
  background: BPMN_POOL_BACKGROUND,
  locality: {
    edgeRole: BPMN_ROLE.sequenceFlow,
    mode: 'same-background',
  },
};

/**
 * **B12** — a message flow runs BETWEEN two pools.
 *
 * The other half, and normative too: "a Message Flow MUST connect two separate
 * Pools" (p.119). A message inside one participant is a participant talking to
 * itself: whatever the author meant, they meant a sequence flow — the two steps
 * are in one process and one of them follows the other.
 *
 * The exact mirror of B11, one word apart in the declaration, and the pair is
 * the reason the family is worth having at all.
 *
 * ## One deliberate divergence from p.119
 *
 * The spec's MUST also condemns a message flow with an end OUTSIDE any pool —
 * there are not two pools to connect if there is only one. This rule stays
 * SILENT there, exactly as B11 does, and the reason is the platform's own
 * principle rather than a gap: the sketch primes (PRD principle 3). A message
 * drawn to a task somebody has not yet dragged into its participant is the
 * commonest intermediate state of a collaboration being built, and a tool
 * arguing with it is a tool switched off before the second pool exists.
 */
const messageFlowCrossesPools: ValidationRule = {
  id: 'bpmn.message-flow-crosses-pools',
  framework: 'bpmn',
  family: 'edge-locality',
  severity: 'warning',
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.message-flow-crosses-pools',
  messageFallback: 'This message flow stays inside one pool.',
  suggestionKey: 'com.labre.bpmn.rule.message-flow-crosses-pools.suggestion',
  suggestionFallback:
    'A message is what one participant sends to another — inside a single pool, the two steps belong to one process, so draw a sequence flow instead.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  background: BPMN_POOL_BACKGROUND,
  locality: {
    edgeRole: BPMN_ROLE.messageFlow,
    mode: 'cross-background',
  },
};

/**
 * **B13** — every step can be reached from the start.
 *
 * The orphan question, and the one no amount of looking at a symbol or at an
 * arrow can answer: a task with a perfectly good sequence flow on either side is
 * still unreachable if the chain it belongs to never starts anywhere. Only the
 * graph knows — which is why this is the one rule here whose family builds one.
 *
 * The traversal leaves from every start event at once and follows sequence flows
 * FORWARD only, source to target. Forward-only is the point: "reachable from the
 * start" is a statement about the direction the process runs in, and a step that
 * merely points BACK at the chain is exactly the mistake this exists to find.
 *
 * The subject is `bpmn:flow-object` — a stranded gateway is as much of a hole as
 * a stranded task, and an end event nothing reaches is an outcome that can never
 * happen. A root is never its own orphan: the roots are seeded into the traversal
 * before it begins.
 *
 * ## `implicitRoots`, and the spec-legal diagram it protects
 *
 * A Process is NOT required to contain a Start Event (p.238); drawn without one,
 * every flow object with no incoming sequence flow is an implicit parallel start
 * and the process instantiates on all of them at once (p.245). Without
 * {@link PendingReachabilityDef.implicitRoots} the traversal has nowhere to
 * leave from on such a diagram — the family answers total silence for zero roots,
 * which is safe — but a MIXED pool, one explicit start plus a parallel branch
 * that has none, would have the whole branch reported unreachable. The field is
 * declared today and honoured by `claude/bpmn-engine-v2`; until it lands the rule
 * reports a SUPERSET of the corrected answer, never a different one.
 *
 * ## `on-demand`, and why that is a property of the rule
 *
 * A graph sweep is O(V + E) and rebuilds its adjacency from scratch on every
 * evaluation, and unlike every other rule in this file it cannot be made
 * incremental even in principle: reachability is a GLOBAL property, so
 * re-pointing one arrow can orphan or rescue an arbitrary number of steps nowhere
 * near it. So it stays OUT of the drawing budget entirely — `evaluateRules` skips
 * it before touching a single element, and it runs only when a user asks for a
 * check-up (`evaluateCheckup`). Declared once here, so no evaluation path has to
 * remember.
 *
 * It is also the honest moment for what the rule says. "Nothing reaches this
 * step" is true of every step for the first thirty seconds of drawing a process,
 * and a finding that is true-and-useless while a diagram is being built belongs
 * to the moment somebody asks whether the diagram is finished.
 */
const unreachableStep: ValidationRule = {
  id: 'bpmn.unreachable-step',
  framework: 'bpmn',
  family: 'reachability',
  severity: 'warning',
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.unreachable-step',
  messageFallback: 'Nothing leads to this step from any start event.',
  suggestionKey: 'com.labre.bpmn.rule.unreachable-step.suggestion',
  suggestionFallback:
    'Follow the sequence flows back from here: somewhere the chain stops, or an arrow points the wrong way. Join it to the process, or delete it if it no longer happens.',
  version: 1,
  // The graph sweep stays out of the 16 ms the drawing has: the family cannot be
  // made incremental, and the question is one somebody asks about a finished
  // diagram rather than one the tool asks while they draw. See the header.
  moment: 'on-demand',
  backgroundRole: BPMN_ROLE.pool,
  reachability: REACHES_EVERY_STEP,
};

/**
 * **B14** — a process that says where it ends says where it begins.
 *
 * The first half of the PAIRING, and the correction that took the naive version
 * of this rule out of the pack. A pool needs NEITHER event: a Process is not
 * required to contain a Start Event (p.238), an End Event is optional (p.246),
 * and a black-box participant in a collaboration is conformant with nothing
 * drawn inside it at all. An unconditional "every pool holds a start event"
 * fires on all three, which is the tool inventing a requirement the notation
 * does not have.
 *
 * What IS a requirement is the pair. A diagram that draws its outcome and not its
 * trigger leaves the reader unable to say what has to happen for that outcome to
 * be produced — and a process modelled with explicit end events and implicit
 * starts is not a style, it is half a model.
 *
 * So the bound is conditional: at least one start event, **and only when the pool
 * already holds an end event** ({@link PendingRoleCountDef.ifPresent}).
 *
 * ## Why the finding lands on the POOL
 *
 * No element is at fault — there is no start event to point at, which is the
 * whole finding — so `role-count` raises it ON the frame. That is what puts the
 * bracket on the pool, and what makes an arbitration made on one participant
 * cover that participant and no other on the board.
 *
 * No maximum: BPMN allows several starts in one pool (a process woken by a
 * message OR by a timer), and a descriptive diagram that draws both is saying
 * something true. Counted by CONTAINMENT and only containment: a start event
 * floating just outside the frame does not satisfy this, because membership has
 * to mean membership or the rule certifies a drawing that shows the opposite of
 * what it claims.
 */
const poolEndWithoutStart: ValidationRule = {
  id: 'bpmn.pool-end-without-start',
  framework: 'bpmn',
  family: 'role-count',
  severity: 'warning',
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.pool-end-without-start',
  messageFallback:
    'This pool says where its process ends, and not where it begins.',
  suggestionKey: 'com.labre.bpmn.rule.pool-end-without-start.suggestion',
  suggestionFallback:
    'Draw the start event that wakes this participant up — a message start if somebody else triggers it, a timer start if the clock does. A pool with no events at all is fine; one with only an ending is half a model.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  background: BPMN_POOL_BACKGROUND,
  roleCount: START_IF_END,
};

/**
 * **B15** — and a process that says where it begins says where it ends.
 *
 * The mirror, and the one a reader misses more often: a pool whose process trails
 * off has no visible outcome, so nobody can say what "done" is for that
 * participant. Drawing the end event is how a diagram commits to an outcome.
 *
 * Conditional in the same way and for the same reason (p.238 / p.246): the
 * requirement is the pairing, so a pool holding no start event either is silent.
 * `min: 1` and no maximum — several ends is how a process says it has several
 * outcomes, and a descriptive diagram drawing "order shipped" and "order
 * cancelled" separately is saying something true.
 *
 * Raised on the pool, counted by containment, silent on a board with no pool.
 */
const poolStartWithoutEnd: ValidationRule = {
  id: 'bpmn.pool-start-without-end',
  framework: 'bpmn',
  family: 'role-count',
  severity: 'warning',
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.pool-start-without-end',
  messageFallback:
    'This pool says where its process begins, and not where it ends.',
  suggestionKey: 'com.labre.bpmn.rule.pool-start-without-end.suggestion',
  suggestionFallback:
    'Draw the end event that closes the process for this participant, so the reader can see what being done means here. Several outcomes take several end events.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  background: BPMN_POOL_BACKGROUND,
  roleCount: END_IF_START,
};

/**
 * **B16** — a gateway that neither splits nor merges is not a gateway.
 *
 * "A Gateway MUST have either multiple incoming Sequence Flows or multiple
 * outgoing Sequence Flows" (p.289). A diamond with one arrow in and one arrow out
 * decides nothing and joins nothing: whatever the author had in mind, the diagram
 * shows a step, and drawing it as a decision tells the reader a question is being
 * asked that never is.
 *
 * Expressed as a FORBIDDEN ZONE rather than as a disjunction:
 * `{ maxIn: 1, maxOut: 1 }` is exactly the set of gateways that neither merge
 * nor split, and it needs no new operator — see
 * {@link PendingForbidPatternDef}. The four independent bounds the family has
 * today cannot say it: `minIn: 2` alone indicts every split, `minOut: 2` alone
 * indicts every merge, and both together indict everything.
 *
 * ## It absorbs the "superfluous gateway" nudge, because they are one predicate
 *
 * A diamond with one flow in and one flow out is simultaneously "does not
 * satisfy p.289" and "is doing nothing at all": the two descriptions have the
 * same extension, exactly. Shipping both would put two brackets and two
 * severities on one symbol for one gesture to fix. This rule keeps the
 * spec-backed reading and the higher severity of the two.
 *
 * `warning` and not louder, despite the MUST: p.288's instantiating parallel
 * gateway is a real, conformant exception with one incoming flow, and this
 * declaration cannot tell it apart from a mistake. The severity is set to what
 * the rule can honestly claim.
 */
const gatewayMustBranch: ValidationRule = {
  id: 'bpmn.gateway-must-branch',
  framework: 'bpmn',
  family: 'edge-degree',
  severity: 'warning',
  appliesTo: BPMN_ROLE.gateway,
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.gateway-must-branch',
  messageFallback:
    'This gateway has one flow in and one flow out, so it neither splits nor merges.',
  suggestionKey: 'com.labre.bpmn.rule.gateway-must-branch.suggestion',
  suggestionFallback:
    'A gateway is a fork or a join: draw the second branch out of it, bring the second path into it, or delete it and let the sequence flow run straight through.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  degree: NEITHER_MERGES_NOR_SPLITS,
};

/**
 * **B17** — a gateway that merges and splits at once.
 *
 * bpmnlint's `no-gateway-join-fork`, an ERROR there, and a real ambiguity rather
 * than a style point: a diamond with two flows in and two flows out gives the
 * reader no way to know whether it waits for both branches before deciding, or
 * decides on whichever arrives first. The two readings produce different
 * processes, and the notation for saying which is two gateways — a join, then a
 * fork — with a sequence flow between them.
 *
 * The forbidden zone is `{ minIn: 2, minOut: 2 }`, and both halves are ordinary
 * on their own: every merge satisfies the first, every split the second. Only
 * the conjunction is the mistake, which is precisely what
 * {@link PendingForbidPatternDef} exists for.
 */
const gatewayJoinAndFork: ValidationRule = {
  id: 'bpmn.gateway-join-and-fork',
  framework: 'bpmn',
  family: 'edge-degree',
  severity: 'warning',
  appliesTo: BPMN_ROLE.gateway,
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.gateway-join-and-fork',
  messageFallback: 'This gateway both merges paths and splits them.',
  suggestionKey: 'com.labre.bpmn.rule.gateway-join-and-fork.suggestion',
  suggestionFallback:
    'A reader cannot tell whether it waits for the incoming paths or races them. Split it in two — a gateway that joins, a sequence flow, then a gateway that forks.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  degree: MERGES_AND_SPLITS,
};

/**
 * **B18** — several paths arriving at one step, with no gateway to join them.
 *
 * The uncontrolled merge. `audit`, and deliberately quieter than bpmnlint's own
 * warning, because OMG p.151 is explicit that an activity may have multiple
 * incoming Sequence Flows and that the token semantics are defined for it: the
 * activity simply runs once per token that arrives. It is conformant BPMN and a
 * common, readable shorthand.
 *
 * What it costs a reader is the QUESTION the diagram no longer asks out loud:
 * does this step wait for the other paths, or run twice? A joining gateway
 * answers it in one symbol. So the finding is a nuance for the conformance
 * panel — never a bracket on the canvas — exactly like {@link activityDeadEnd},
 * and for the same reason.
 *
 * ## Activities only, and why the events are deliberately out
 *
 * On this vocabulary, applying it to `bpmn:event` would add exactly one
 * behaviour: flagging an END EVENT that several paths converge on. That is not a
 * shorthand, it is the notation working — one outcome reached by several routes
 * is precisely what an end event is for, and every descriptive diagram in the
 * corpus draws one. A start event cannot have an incoming flow at all (B7), so
 * there is nothing left for the wider role to catch.
 */
const fakeJoin: ValidationRule = {
  id: 'bpmn.fake-join',
  framework: 'bpmn',
  family: 'edge-degree',
  severity: 'audit',
  appliesTo: BPMN_ROLE.activity,
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.fake-join',
  messageFallback: 'Several paths arrive at this step without a gateway.',
  suggestionKey: 'com.labre.bpmn.rule.fake-join.suggestion',
  suggestionFallback:
    'BPMN allows it, and the step runs once per path that reaches it. If it is meant to WAIT for the others instead, bring the paths into a joining gateway and let one flow out of it.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  degree: MERGES_WITHOUT_A_GATEWAY,
};

/**
 * **B19** — several paths leaving one step, with no gateway to split them.
 *
 * The mirror: an implicit parallel split. Two arrows out of a task means both
 * branches run, every time — which is a legitimate thing to mean, and an
 * invisible one, because nothing on the diagram distinguishes it from a decision
 * somebody forgot to draw.
 *
 * `audit`, and OURS is stricter than bpmnlint's for a reason worth stating: on a
 * fully modelled diagram the ambiguity is resolved by CONDITIONS on the outgoing
 * flows, and the descriptive profile models none — we have no conditional
 * sequence flow, so the reader has nothing to disambiguate with. We stay quiet
 * outside the panel precisely because the gap is ours and not the author's.
 *
 * Activities only, for {@link fakeJoin}'s reasons read the other way: an end
 * event cannot have an outgoing flow at all (B9), and a start event with two
 * would be the same nuance on a symbol nobody splits from.
 */
const implicitSplit: ValidationRule = {
  id: 'bpmn.implicit-split',
  framework: 'bpmn',
  family: 'edge-degree',
  severity: 'audit',
  appliesTo: BPMN_ROLE.activity,
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.implicit-split',
  messageFallback: 'Several paths leave this step without a gateway.',
  suggestionKey: 'com.labre.bpmn.rule.implicit-split.suggestion',
  suggestionFallback:
    'As drawn, every path runs. If the process chooses between them, put an exclusive gateway after the step and name what it decides on.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  degree: SPLITS_WITHOUT_A_GATEWAY,
};

/**
 * **B20** — one BLANK start event per pool.
 *
 * bpmnlint's `single-blank-start-event`, an ERROR there. Several start events in
 * one pool is legal and useful — a process woken by a message OR by a timer says
 * so with two symbols — but only while the reader can tell them APART. Two blank
 * circles say "the process starts here" twice, with nothing to distinguish the
 * two occasions, so the diagram claims two triggers and names neither.
 *
 * ## Why it needs `exact`
 *
 * Every other existence rule here counts with `roleIsA` descent, which is what
 * keeps "a pool holds a start event" one requirement as the vocabulary grows.
 * This rule needs the opposite and cannot fake it: the typed starts are exactly
 * the ones that DO NOT count, because being typed is what makes them
 * distinguishable. `max: 1` with the descent on would indict the pool that draws
 * a message start beside a timer start — the one diagram this rule exists to
 * permit. See {@link PendingExactRoleCountDef}.
 *
 * `audit`: the diagram is ambiguous rather than wrong, and the fix is often to
 * TYPE one of the two starts, which is a modelling decision only the author can
 * make.
 */
const singleBlankStart: ValidationRule = {
  id: 'bpmn.single-blank-start',
  framework: 'bpmn',
  family: 'role-count',
  severity: 'audit',
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.single-blank-start',
  messageFallback: 'This pool holds more than one untyped start event.',
  suggestionKey: 'com.labre.bpmn.rule.single-blank-start.suggestion',
  suggestionFallback:
    'Two plain circles say the process starts here twice, without saying on which two occasions. Give each start its trigger — a message start, a timer start — or keep one.',
  version: 1,
  backgroundRole: BPMN_ROLE.pool,
  background: BPMN_POOL_BACKGROUND,
  roleCount: ONE_BLANK_START,
};

/**
 * **B21** — a step nobody has named.
 *
 * bpmnlint's `label-required`, an ERROR there, and the softening is deliberate on
 * two axes at once.
 *
 * **`on-demand`**, because a task is created unnamed: the gesture that makes one
 * puts an empty rectangle on the canvas and the author types into it a second
 * later. A realtime rule would bracket every symbol the moment it appears, which
 * is not a validation platform, it is a tool arguing with the act of drawing
 * (PRD principle 3). "Three steps are unnamed" is a sentence for the check-up
 * panel, once, when somebody asks whether the diagram is finished.
 *
 * **`audit`**, because an unnamed step is a diagram that is not done rather than
 * a diagram that is wrong, and the panel is where "not done" belongs.
 *
 * Written on `bpmn:flow-object`: an unnamed gateway is worse than an unnamed
 * task, since the whole content of a decision is the question it asks.
 *
 * Needs the `label-presence` family — see {@link LABEL_PRESENCE_FAMILY}.
 */
const unlabeledStep: ValidationRule = {
  id: 'bpmn.unlabeled-step',
  framework: 'bpmn',
  family: LABEL_PRESENCE_FAMILY,
  severity: 'audit',
  appliesTo: BPMN_ROLE.flowObject,
  roles: BPMN_ROLES,
  messageKey: 'com.labre.bpmn.rule.unlabeled-step',
  messageFallback: 'This step has no name.',
  suggestionKey: 'com.labre.bpmn.rule.unlabeled-step.suggestion',
  suggestionFallback:
    'Name it in a verb phrase a reader outside the room would understand — "Check the credit limit" rather than "Step 3". An unnamed gateway is worse still: the whole content of a decision is the question it asks.',
  version: 1,
  moment: 'on-demand',
  backgroundRole: BPMN_ROLE.pool,
};

/**
 * The rules the pack REGISTERS today. Thirteen, every one of them correct
 * against the specification with the engine as it stands.
 */
export const BPMN_RULES: readonly ValidationRule[] = [
  // Connection: what a link may run between, and how many times.
  sequenceFlowEndpoints,
  messageFlowEndpoints,
  associationEndpoints,
  untypedFlow,
  duplicateSequenceFlow,
  // Degree: how many links reach one symbol.
  startEventNoInflow,
  startEventMustExit,
  endEventNoOutflow,
  endEventMustBeReached,
  activityDeadEnd,
  // Locality: which pool each end sits in.
  sequenceFlowStaysHome,
  messageFlowCrossesPools,
  // Topology: what the graph as a whole says.
  unreachableStep,
];

/**
 * The eight rules whose DEF FIELD (or whole FAMILY) does not exist yet —
 * authored, reviewable, and deliberately not registered until
 * `claude/bpmn-engine-v2` lands.
 *
 * ## Why they are held out rather than shipped inert
 *
 * Most of them WOULD be inert: an `edge-degree` rule declaring no bound the
 * engine recognises warns once and evaluates nothing, and a rule naming an
 * unknown family would not resolve to an evaluator at all. The two `ifPresent`
 * rules would NOT be. An engine that ignores that field reads
 * `{ subject: start-event, min: 1 }` — precisely the unconditional rule the
 * specification review removed, firing on the black-box pool and on the pool
 * somebody has not started filling in.
 *
 * One array rather than two, and this is the reason: a reviewer reading
 * {@link BPMN_RULES} must be able to take "everything here works" literally, and
 * a reviewer reading this one must not have to work out which entries are merely
 * quiet and which are actively wrong. The boundary is "needs engine-v2", which is
 * a fact about each rule; "would be wrong meanwhile" is a fact about the engine,
 * and it changes on the day the branch lands.
 *
 * Registering them is one line: spread this array into {@link BPMN_RULES}. The
 * profiles already spell all twenty-one ids out, and the corpus already pins the
 * cases whose answer holds in both worlds.
 */
export const BPMN_RULES_PENDING_ENGINE_V2: readonly ValidationRule[] = [
  // `RoleCountDef.ifPresent`.
  poolEndWithoutStart,
  poolStartWithoutEnd,
  // `RoleCountDef.exact`.
  singleBlankStart,
  // `EdgeDegreeDef.forbidPattern`.
  gatewayMustBranch,
  gatewayJoinAndFork,
  fakeJoin,
  implicitSplit,
  // The `label-presence` family.
  unlabeledStep,
];
