import type {
  EndpointTriplet,
  ValidationRule,
} from '@labre/affine-block-surface';

import { EVENT_STORMING_BACKGROUND } from './background';
import { ES_ROLE, EVENT_STORMING_ROLES } from './roles';

/**
 * Event Storming validation rules (WS5).
 *
 * DATA owned by the framework, versioned per rule: the engine
 * (`@labre/affine-block-surface`) knows how to evaluate a FAMILY, never a
 * concrete rule. Registered from the flag-gated
 * `DddEventStormingViewExtension`, so switching the Event Storming flag off
 * removes them with the rest of the tooling — boards already stormed keep
 * rendering, they simply stop being checked (`docs/adr/0009`).
 *
 * ## Three rules, and the ones that are deliberately absent
 *
 * Event Storming's grammar is small and its etiquette is large, and the two
 * must not be confused. What is decidable here is the DIRECTION of the frieze,
 * the SHAPE of an arc and whether two stickies are on top of each other.
 *
 * What is not, and is a level-2 nudge instead (`./nudges.ts`, PO arbitration of
 * 26/08/2026): **the past tense**. "Order placed" is a domain event and "Place
 * order" is a command, and every workshop gets that wrong for the first hour —
 * but deciding it means parsing a human sentence, in whatever language the room
 * speaks, written in marker pen by somebody who abbreviates. There are no
 * linguistic rules in this file, on purpose. A checklist item that says "the
 * events are named in the past tense" costs a tick and is true; a regular
 * expression over `Y.Text` costs the tool's credibility and is wrong every
 * fifth sticky.
 */

/**
 * **ES1** — a flow runs forwards in time.
 *
 * The one rule the frame makes possible, and the reason the board declares an
 * axis at all: the source of a flow is what happens FIRST (tier 1 of
 * `docs/adr/0010`, the verb is "leads to"), so its target belongs to the RIGHT
 * of it. A flow drawn the other way says the effect precedes the cause — either
 * the arc was drawn from the wrong end, or the two stickies need swapping, and
 * only the room knows which.
 *
 * ## The tolerance, and why it is tiny
 *
 * `0.01` of the board's width — 32 units on the 3200-wide reference, about a
 * quarter of a sticky. Much tighter than the Wardley equivalent's 2 %, and for
 * the opposite reason: on a Wardley map two components drawn level are a chain
 * waiting to be spread out, whereas on a frieze two stickies drawn level are
 * two things that happen at the same moment — which is a claim, not a
 * placeholder — and an arc between them is the one that wants asking about.
 * The tolerance is here to absorb a hand, not a habit: stickies stacked to
 * within a few pixels stay silent, anything genuinely to the left does not.
 *
 * As with every other position in this engine it is a RATIO, so the verdict
 * survives the roll being unspooled (the lesson of the 01/08/2026 recette).
 *
 * Silent, from the family: an arc with a free end, an arc between two different
 * boards, an arc carrying no role, and an arc on a board that has no
 * `es:board` element under it — a frieze stormed on the bare canvas is a
 * frieze, and it has no timeline to run against.
 */
const againstTimeline: ValidationRule = {
  id: 'es.against-timeline',
  framework: 'ddd-event-storming',
  family: 'relative-order-along-axis',
  severity: 'warning',
  // No `appliesTo`: the subject is a RELATION, and the role that names it is
  // declared where the family reads it — naming one of the three indicted
  // elements here would be data that lies.
  roles: EVENT_STORMING_ROLES,
  messageKey: 'com.labre.event-storming.validation.against-timeline',
  messageFallback: 'This flow runs backwards along the timeline.',
  suggestionKey:
    'com.labre.event-storming.validation.against-timeline.suggestion',
  suggestionFallback:
    'Time runs left to right: move what follows to the right of what leads to it — or, if the arc was drawn from the wrong end, reverse it.',
  version: 1,
  backgroundRole: ES_ROLE.board,
  background: EVENT_STORMING_BACKGROUND,
  relativeOrder: {
    edgeRole: ES_ROLE.flow,
    axis: 'time',
    // The verb is "leads to": the source happens first, so the TARGET is the
    // one further along the axis' forward sense.
    expect: 'target-ahead',
    toleranceRatio: 0.01,
  },
};

/**
 * The canonical Event Storming sentence, as a matrix.
 *
 * Read aloud, which is how it was checked: an actor issues a command; a command
 * lands on an aggregate, or on an external system; an aggregate raises a domain
 * event, and so does an external system; a domain event triggers a policy, and
 * a domain event feeds a read model; a policy issues a command; a read model
 * informs an actor.
 *
 * Nine sentences and no more. Every one of them is in Brandolini's own picture
 * of the "Big Picture → Process modelling" grammar, and nothing has been added
 * because it seemed plausible: a matrix that sanctions a sentence the notation
 * does not say is worse than no matrix, because the sentence it fails to catch
 * is the one somebody will ship.
 *
 * Exported so a test asserts THIS table rather than a copy of it.
 */
export const ES_FLOW_MATRIX: readonly EndpointTriplet[] = [
  { source: ES_ROLE.actor, edge: ES_ROLE.flow, target: ES_ROLE.command },
  { source: ES_ROLE.command, edge: ES_ROLE.flow, target: ES_ROLE.aggregate },
  { source: ES_ROLE.command, edge: ES_ROLE.flow, target: ES_ROLE.system },
  {
    source: ES_ROLE.aggregate,
    edge: ES_ROLE.flow,
    target: ES_ROLE.domainEvent,
  },
  { source: ES_ROLE.system, edge: ES_ROLE.flow, target: ES_ROLE.domainEvent },
  { source: ES_ROLE.domainEvent, edge: ES_ROLE.flow, target: ES_ROLE.policy },
  {
    source: ES_ROLE.domainEvent,
    edge: ES_ROLE.flow,
    target: ES_ROLE.readModel,
  },
  { source: ES_ROLE.policy, edge: ES_ROLE.flow, target: ES_ROLE.command },
  { source: ES_ROLE.readModel, edge: ES_ROLE.flow, target: ES_ROLE.actor },
];

/**
 * **ES2** — a flow says one of the nine things the notation can say.
 *
 * The grammar rule, and the one that earns the framework its roles: a flow from
 * a command straight to a domain event skips the aggregate, which is the whole
 * modelling question Event Storming is run to answer. Reading it off the roles
 * rather than off the colours means the verdict survives someone restyling a
 * sticky, and reading it off `source → target` means it survives someone
 * re-laying-out the wall.
 *
 * ## What it stays silent about, and why that is the rule
 *
 * **Hotspots and constraints are outside the alphabet.** Neither is cited by a
 * triplet, so an arc with either at one end takes the whole edge out of the
 * conversation — not the matrix, not the self-loop, nothing. That is the point
 * of the family (`RelationEndpointsDef.allowed`) and it is the hard requirement
 * for Event Storming in particular: a hotspot is a workshop saying "we do not
 * know", and an arrow drawn at one is somebody parking a question. A tool that
 * answered "that arc is forbidden" would be indicting the act of storming.
 *
 * The same silence covers an arc onto a plain rectangle, onto a note, onto an
 * artefact of another framework, and every flow drawn before WS5 — those carry
 * no role at all and are not even looked at.
 *
 * ## Self-loops yes, duplicates no
 *
 * A sticky leading to itself is not a sentence in this notation at whichever
 * end you read it, so `forbidSelfLoop` is on.
 *
 * `forbidDuplicate` is deliberately OFF. Two flows between the same two
 * stickies is what a wall looks like when a process has two paths to the same
 * outcome and the room drew both; the frieze is read by following arcs, not by
 * counting them, and a workshop is exactly where a line gets drawn twice while
 * three people talk over each other. Nothing is lost by staying quiet — unlike
 * a context map, where the same pattern twice between two contexts is a claim
 * made twice.
 */
const forbiddenArc: ValidationRule = {
  id: 'es.forbidden-arc',
  framework: 'ddd-event-storming',
  family: 'relation-endpoints',
  severity: 'warning',
  roles: EVENT_STORMING_ROLES,
  messageKey: 'com.labre.event-storming.validation.forbidden-arc',
  messageFallback: 'This flow is not a sentence Event Storming says.',
  suggestionKey: 'com.labre.event-storming.validation.forbidden-arc.suggestion',
  suggestionFallback:
    'The frieze reads: an actor issues a command, the command lands on an aggregate or an external system, and that raises a domain event, which triggers a policy or feeds a read model. Re-point the arc onto the sticky that is missing.',
  version: 1,
  backgroundRole: ES_ROLE.board,
  background: EVENT_STORMING_BACKGROUND,
  endpoints: {
    edgeRole: ES_ROLE.flow,
    allowed: ES_FLOW_MATRIX,
    forbidSelfLoop: true,
    // See the header: not on a wall.
    selfLoop: {
      messageKey: 'com.labre.event-storming.validation.flow-self-loop',
      messageFallback: 'This flow loops back onto the sticky it starts from.',
      suggestionKey:
        'com.labre.event-storming.validation.flow-self-loop.suggestion',
      suggestionFallback:
        'Nothing leads to itself on a frieze — drop the loose end on what actually follows, or delete the arc.',
    },
  },
};

/**
 * **ES3** — two stickies must not be on top of each other.
 *
 * A readability rule, not a semantic one, and the softest thing in the pack: a
 * frieze you cannot read is useless, but a sticky nudged over its neighbour
 * while somebody reorders the morning is not a mistake.
 *
 * Written on the PARENT role, which is what makes it one rule instead of
 * thirty-six pairs: any two stickies hide each other, whichever kinds they are,
 * and the tenth kind is covered on the day it lands.
 *
 * ## The threshold, and why it is wide
 *
 * **12 model units** — a tenth of the 120-unit sticky, against the 4 units
 * Wardley uses for a node the size of a full stop. Stickies FRAME each other on
 * a real wall: a workshop overlaps the corners of a run of events to say they
 * belong together, tucks a policy under the event that triggers it, and shingles
 * a stack of read models. At 4 units all of that would be reported, and the rule
 * would be switched off by lunchtime. At 12 a deliberate tuck stays silent and a
 * sticky genuinely covering another — half a label hidden — is still reported
 * with an order of magnitude to spare.
 */
const overlappingStickies: ValidationRule = {
  id: 'es.overlapping-stickies',
  framework: 'ddd-event-storming',
  family: 'no-overlap',
  severity: 'warning',
  // No `appliesTo`: the subject is a PAIR, and naming one half of it here would
  // be data that lies.
  roles: EVENT_STORMING_ROLES,
  messageKey: 'com.labre.event-storming.validation.overlapping-stickies',
  messageFallback: 'These two stickies cover each other.',
  suggestionKey:
    'com.labre.event-storming.validation.overlapping-stickies.suggestion',
  suggestionFallback: 'Slide one aside so both can be read.',
  version: 1,
  // Not a frame the rule measures against — an overlap is an overlap wherever
  // it happens — but the board a finding is ATTRIBUTED to, so the arbitration
  // "ignore this rule on the whole board" has one board to be written on.
  backgroundRole: ES_ROLE.board,
  overlap: [[ES_ROLE.sticky, ES_ROLE.sticky]],
  // How deep a collision has to be before it is one. See the header.
  minPenetration: 12,
};

export const EVENT_STORMING_RULES: readonly ValidationRule[] = [
  againstTimeline,
  forbiddenArc,
  overlappingStickies,
];
