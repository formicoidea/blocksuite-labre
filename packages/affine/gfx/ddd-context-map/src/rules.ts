import type { ValidationRule } from '@labre/affine-block-surface';

import { CONTEXT_MAP_BACKGROUND } from './background';
import { CONTEXT_MAP_ROLE, CONTEXT_MAP_ROLES } from './roles';

/**
 * Context Mapping validation rules (WS2).
 *
 * DATA owned by the framework, versioned per rule: the engine
 * (`@labre/affine-block-surface`) knows how to evaluate a FAMILY, never a
 * concrete rule. Registered from the flag-gated `DddContextMapViewExtension`,
 * so switching the Context Map flag off removes them with the rest of the
 * tooling — maps already drawn keep rendering, they simply stop being checked
 * (`docs/adr/0009`).
 *
 * ## What the grammar of a context map actually is
 *
 * Very little, and that is the point. A context map has no axes: nothing about
 * WHERE a context sits means anything, so there is no order rule, no zone rule
 * and no orientation rule to write. What it does have is a notation with
 * CONTRADICTIONS in it — patterns that cannot both be true of the same couple —
 * and those are exactly what the `relation-endpoints` family arbitrates.
 *
 * Four of the five rules below are therefore one family with four different
 * questions, and every one of them stays silent on a sketch: an end that is not
 * a bounded context (a cloud, a note, a plain rectangle) is outside the
 * alphabet, and the whole edge goes unjudged.
 */

/**
 * **CM1** — a relationship runs between two bounded contexts, once, and never
 * onto itself.
 *
 * The base grammar, written on the PARENT edge role, which is what makes it one
 * rule instead of nine: `roleIsA` resolves a triplet declared on
 * `context-map:relationship` for every pattern that specialises it, so the
 * single sanctioned sentence below — a context relates to a context — covers
 * Partnership and Big Ball of Mud alike, and a tenth pattern inherits it on the
 * day it is added.
 *
 * The two things it says:
 *
 * - **self-loop** — a context is not related to itself. Whatever the hand meant,
 *   the notation has no sentence for it;
 * - **duplicate** — the same pattern drawn twice between the same two contexts,
 *   the same way round. Not two DIFFERENT patterns, which is legitimate and how
 *   C/S + OHS + PL is drawn; the same one, twice, which is one link too many on
 *   a map that is read by counting links.
 *
 * ## What `allowed` does here, and what it deliberately does NOT
 *
 * The matrix holds ONE sentence, and `context-map:context` is therefore the
 * whole alphabet of this rule. That makes the off-matrix branch structurally
 * unreachable — an end that is a context passes, and an end that is anything
 * else is outside the alphabet, which is TOTAL silence for the edge (see
 * {@link RelationEndpointsDef.allowed}).
 *
 * That is the intent, not an oversight. The matrix is here to declare the
 * alphabet, and the alphabet is what makes the whole rule proportionate: a
 * relationship drawn onto a CLOUD, onto a note, onto a rectangle somebody
 * dropped on the board to think with, is a draft — the user is saying "there is
 * something out there we integrate with", which on a context map is not merely
 * tolerable but the correct notation. Judging it would be indicting the act of
 * sketching (PRD principle 8).
 *
 * The branch becomes reachable the day a second NODE role lands — a role on the
 * cloud, say — and on that day this declaration already says what to do with it
 * without a line changing. Until then `offMatrix` carries no words of its own
 * and the rule's own sentence stands behind it, unused.
 */
const relationshipEndpoints: ValidationRule = {
  id: 'context-map.relationship-endpoints',
  framework: 'ddd-context-map',
  family: 'relation-endpoints',
  severity: 'warning',
  // No `appliesTo`: the subject is a RELATION, and the role that names it is
  // declared where the family reads it — naming one of the three indicted
  // elements here would be data that lies.
  roles: CONTEXT_MAP_ROLES,
  messageKey: 'com.labre.ddd-context-map.validation.relationship-endpoints',
  messageFallback:
    'This relationship does not run between two bounded contexts.',
  suggestionKey:
    'com.labre.ddd-context-map.validation.relationship-endpoints.suggestion',
  suggestionFallback:
    'A context map relates bounded contexts — re-point the loose end onto one, or delete the link.',
  version: 1,
  backgroundRole: CONTEXT_MAP_ROLE.board,
  background: CONTEXT_MAP_BACKGROUND,
  endpoints: {
    edgeRole: CONTEXT_MAP_ROLE.relationship,
    allowed: [
      {
        source: CONTEXT_MAP_ROLE.context,
        edge: CONTEXT_MAP_ROLE.relationship,
        target: CONTEXT_MAP_ROLE.context,
      },
    ],
    forbidSelfLoop: true,
    forbidDuplicate: true,
    selfLoop: {
      messageKey: 'com.labre.ddd-context-map.validation.relationship-self-loop',
      messageFallback: 'This relationship loops back onto its own context.',
      suggestionKey:
        'com.labre.ddd-context-map.validation.relationship-self-loop.suggestion',
      suggestionFallback:
        'A bounded context integrates with OTHER contexts — drop the loose end on the context it actually relates to, or delete the link.',
    },
    duplicate: {
      messageKey: 'com.labre.ddd-context-map.validation.relationship-duplicate',
      messageFallback:
        'This pattern is already drawn between these two contexts.',
      suggestionKey:
        'com.labre.ddd-context-map.validation.relationship-duplicate.suggestion',
      suggestionFallback:
        'Delete the copy. Two DIFFERENT patterns on one couple are fine — C/S with OHS and PL is the notation working — but the same one twice says nothing new.',
    },
  },
};

/**
 * **CM2** — a context does not both conform to its upstream and protect itself
 * from it.
 *
 * The textbook contradiction, and the one every context map workshop produces
 * at least once. Conformist means "we take their model as it is"; an
 * Anticorruption Layer means "we translate their model into ours because we
 * refuse to take it as it is". Both are legitimate answers to the same pressure
 * and they are opposite answers, so a couple carrying both has not decided —
 * which is the finding.
 *
 * A `warning` and never a refusal: the map is a discussion aid, and the pair
 * showing up on it is usually the moment the discussion starts. The user
 * resolves it by deleting one, and only they know which.
 */
const aclConformistExclusive: ValidationRule = {
  id: 'context-map.acl-conformist-exclusive',
  framework: 'ddd-context-map',
  family: 'relation-endpoints',
  severity: 'warning',
  roles: CONTEXT_MAP_ROLES,
  messageKey: 'com.labre.ddd-context-map.validation.acl-conformist',
  messageFallback:
    'These two contexts are related by both a Conformist and an Anticorruption Layer.',
  suggestionKey: 'com.labre.ddd-context-map.validation.acl-conformist.suggestion',
  suggestionFallback:
    'Conforming means taking the upstream model as it is; an ACL means refusing to. Keep the one the team actually does.',
  version: 1,
  backgroundRole: CONTEXT_MAP_ROLE.board,
  background: CONTEXT_MAP_BACKGROUND,
  endpoints: {
    edgeRole: CONTEXT_MAP_ROLE.relationship,
    // No `allowed`: CM1 already judges the sentences, and repeating the matrix
    // here would report one mistake twice. This rule asks the pair question and
    // nothing else.
    exclusivePairs: [[CONTEXT_MAP_ROLE.acl, CONTEXT_MAP_ROLE.conformist]],
  },
};

/**
 * **CM3** — Customer/Supplier already says how the two teams work; Conformist
 * and Open Host Service say something else.
 *
 * C/S is a RELATIONSHIP OF NEGOTIATION: downstream is a customer whose needs
 * enter the upstream team's backlog. Conformist is its negation — downstream
 * has no say and takes what comes. OHS is a different answer again: upstream
 * serves all comers through a published protocol precisely so it does NOT have
 * to negotiate per consumer. Either one drawn on top of a C/S says the couple
 * has not settled which conversation it is having.
 *
 * ACL is NOT in this pair list, on purpose — see {@link aclOnCustomerSupplier},
 * where it is an audit finding rather than a warning.
 */
const patternOnCustomerSupplier: ValidationRule = {
  id: 'context-map.pattern-on-customer-supplier',
  framework: 'ddd-context-map',
  family: 'relation-endpoints',
  severity: 'warning',
  roles: CONTEXT_MAP_ROLES,
  messageKey: 'com.labre.ddd-context-map.validation.pattern-on-customer-supplier',
  messageFallback:
    'This Customer/Supplier relationship carries a second pattern that contradicts it.',
  suggestionKey:
    'com.labre.ddd-context-map.validation.pattern-on-customer-supplier.suggestion',
  suggestionFallback:
    'Customer/Supplier means the downstream needs are negotiated into the upstream backlog. Conformist says they are not; Open Host Service says the upstream serves everyone the same way. Keep one.',
  version: 1,
  backgroundRole: CONTEXT_MAP_ROLE.board,
  background: CONTEXT_MAP_BACKGROUND,
  endpoints: {
    edgeRole: CONTEXT_MAP_ROLE.relationship,
    exclusivePairs: [
      [CONTEXT_MAP_ROLE.customerSupplier, CONTEXT_MAP_ROLE.conformist],
      [CONTEXT_MAP_ROLE.customerSupplier, CONTEXT_MAP_ROLE.ohs],
    ],
  },
};

/**
 * **CM4** — an Anticorruption Layer on a Customer/Supplier is worth a second
 * look, and nothing more.
 *
 * Deliberately `audit`, alone among the four. The combination is not wrong: a
 * downstream team can perfectly well negotiate its needs upstream AND still
 * translate the upstream model at its border, and mature teams do exactly that
 * while a legacy model is being retired. But it is also, often, the trace of a
 * negotiation that has stopped working — the customer built a translation layer
 * because the supplier stopped listening.
 *
 * A tool cannot tell those two apart, so it does not get to interrupt: the
 * finding reaches `violations$` for a host panel and a conformance report, and
 * the canvas says nothing. `strict` leaves it at `audit` too, which is the whole
 * reason a profile spells every severity out — this one is a judgement the map
 * cannot make at any level of requirement.
 */
const aclOnCustomerSupplier: ValidationRule = {
  id: 'context-map.acl-on-customer-supplier',
  framework: 'ddd-context-map',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: CONTEXT_MAP_ROLES,
  messageKey: 'com.labre.ddd-context-map.validation.acl-on-customer-supplier',
  messageFallback:
    'This Customer/Supplier relationship also carries an Anticorruption Layer.',
  suggestionKey:
    'com.labre.ddd-context-map.validation.acl-on-customer-supplier.suggestion',
  suggestionFallback:
    'Legitimate while a model is being retired — worth asking whether the negotiation still works if it is not.',
  version: 1,
  backgroundRole: CONTEXT_MAP_ROLE.board,
  background: CONTEXT_MAP_BACKGROUND,
  endpoints: {
    edgeRole: CONTEXT_MAP_ROLE.relationship,
    exclusivePairs: [
      [CONTEXT_MAP_ROLE.customerSupplier, CONTEXT_MAP_ROLE.acl],
    ],
  },
};

/**
 * **CM5** — a bounded context belongs on the map.
 *
 * The one geometric rule the framework has, and it is about membership rather
 * than position: a context parked beside the card is not on the map, so nothing
 * the map says covers it. Silent when the board carries no board element at all
 * — a context map sketched on the bare canvas is a sketch, not an error, and so
 * is one drawn before the board existed.
 */
const contextOffBoard: ValidationRule = {
  id: 'context-map.context-off-board',
  framework: 'ddd-context-map',
  family: 'element-in-background',
  severity: 'warning',
  appliesTo: CONTEXT_MAP_ROLE.context,
  roles: CONTEXT_MAP_ROLES,
  messageKey: 'com.labre.ddd-context-map.validation.context-off-board',
  messageFallback: 'This bounded context sits outside the map.',
  suggestionKey:
    'com.labre.ddd-context-map.validation.context-off-board.suggestion',
  suggestionFallback:
    'Drag it onto the board, or grow the board to take it in.',
  version: 1,
  backgroundRole: CONTEXT_MAP_ROLE.board,
  background: CONTEXT_MAP_BACKGROUND,
};

export const CONTEXT_MAP_RULES: readonly ValidationRule[] = [
  relationshipEndpoints,
  aclConformistExclusive,
  patternOnCustomerSupplier,
  aclOnCustomerSupplier,
  contextOffBoard,
];
