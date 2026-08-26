import type {
  EndpointTriplet,
  ValidationRule,
} from '@labre/affine-block-surface';

import { EDGY_DYNAMIC_RELATIONS } from './metamodel';
import {
  EDGY_ROLE,
  EDGY_ROLES,
  EDGY_VERB_ROLE,
  type EdgyElementRole,
} from './roles';

/**
 * EDGY validation rules (WS1).
 *
 * DATA owned by the framework, versioned per rule: the engine
 * (`@labre/affine-block-surface`) knows how to evaluate a FAMILY, never a
 * concrete rule. Adding an EDGY rule is adding an entry to this array.
 *
 * Registered from the flag-gated `EdgyViewExtension`, so switching the EDGY
 * flag off removes the rules with the rest of the tooling — boards already
 * drawn keep rendering, they simply stop being checked (`docs/adr/0009`).
 *
 * ## Two rules, and the ones deliberately left out
 *
 * The PO arbitration of 26/08/2026 put EDGY's two JUDGEMENT controls — "every
 * intersection element is linked to both its parent facets" and "every element
 * wears its facet's colour" — in `./nudges.ts` rather than here. Neither is
 * decidable: the first would have to guess which circle an element belongs to
 * from where somebody dropped it, and the second would indict a board whose
 * author uses their own palette. A checklist can ask them; an algorithm cannot
 * answer them.
 *
 * ## Debt: `tree-mixed-kinds`
 *
 * EDGY's own notation has TREES — a capability tree, an organisation tree —
 * whose levels must all be the same kind of element. There is no tree on this
 * canvas yet: nothing draws one, nothing stores one, and no role names one. The
 * rule is therefore deferred rather than written against an artefact that does
 * not exist. When a tree lands, it comes with its own role and this is where its
 * rule goes.
 */

/**
 * The 24 sanctioned sentences, DERIVED from the metamodel.
 *
 * One triplet per row of `EDGY_DYNAMIC_RELATIONS`, read exactly as
 * `docs/adr/0010` reads a typed edge: source is the subject, target the object.
 * The matrix is never restated — a relation added to the metamodel is drawn by
 * the template, gets a role from `roles.ts` and becomes legal here, all from the
 * one table. `requires` contributes three triplets under one role, which is what
 * it means for a verb to be spoken of three different pairs.
 */
export const EDGY_ALLOWED_RELATIONS: readonly EndpointTriplet[] =
  EDGY_DYNAMIC_RELATIONS.map(([source, target, verb]) => ({
    source: EDGY_ROLE[source as EdgyElementRole],
    edge: EDGY_VERB_ROLE[verb],
    target: EDGY_ROLE[target as EdgyElementRole],
  }));

/**
 * **E1** — a relation says something the EDGY metamodel does not.
 *
 * EDGY is a language before it is a diagram: its 24 relations are the sentences
 * the method sanctions, and a link drawn between the wrong two elements — or
 * drawn the right way round between the right two but carrying the wrong verb —
 * is a modelling mistake no amount of dragging fixes. "A journey traverses a
 * channel" is EDGY; "a channel traverses a journey" is a sentence nobody can
 * act on.
 *
 * ## What stays silent
 *
 * Everything the `relation-endpoints` family already keeps quiet about, and one
 * of them matters more here than anywhere: **a plain connector carries no role
 * and is never judged**. Free links are how an EDGY workshop actually runs —
 * somebody draws an arrow to say "these two have something to do with each
 * other" and names it later — and the day the tool starts indicting that
 * gesture is the day it gets switched off. Only the typed relations the toolbox
 * and the templates stamp are read, and only when BOTH ends are official
 * elements: a relation onto a bare sticky, onto a People node or onto an
 * element of another framework is outside the alphabet, hence outside the
 * conversation.
 *
 * Severity `warning` and not `blocking-overridable`: nothing in this library
 * refuses a gesture, so declaring the blocking level would be data claiming an
 * effect that does not exist (the note `wardley/rules.ts` carries at length).
 * The profiles demote it to `audit` on a sketch.
 */
const nonCanonicalLink: ValidationRule = {
  id: 'edgy.non-canonical-link',
  framework: 'edgy',
  family: 'relation-endpoints',
  severity: 'warning',
  // No `appliesTo`: the subject is a RELATION, and the role that names it is
  // declared where the family reads it — naming one of the three indicted
  // elements here would be data that lies.
  roles: EDGY_ROLES,
  messageKey: 'com.labre.edgy.validation.non-canonical-link',
  messageFallback:
    'This relation is not one the EDGY metamodel declares between these two elements.',
  suggestionKey: 'com.labre.edgy.validation.non-canonical-link.suggestion',
  suggestionFallback:
    'Read the link out loud — source, verb, target. Reverse it, re-point an end, or use the verb EDGY gives these two elements.',
  version: 1,
  // Not a frame the rule measures against — a sentence is right or wrong
  // wherever it is written — but the facets diagram or board a finding is
  // ATTRIBUTED to, so the arbitration "ignore this rule on the whole board" has
  // somewhere to live (the `no-overlap` pattern).
  backgroundRole: EDGY_ROLE.background,
  endpoints: {
    // The PARENT role: every verb specialises it, so the rule reads all 22 of
    // them and no free connector.
    edgeRole: EDGY_ROLE.relation,
    allowed: EDGY_ALLOWED_RELATIONS,
  },
};

/**
 * **E2** — two artefacts must not sit on top of each other.
 *
 * A readability rule, the same one Wardley ships and for the same reason: a
 * board you cannot read is useless, while a momentary overlap during a drag is
 * not a mistake. It matters more on an EDGY facets diagram than almost
 * anywhere, because WHERE an element sits is what says which facet it belongs
 * to: an artefact hidden under another has lost its meaning, not just its
 * legibility.
 *
 * ONE declared pair, `element × element`, because `roleIsA` covers the whole
 * subtree — the four kinds and the twelve official elements — from the root.
 * Backgrounds are outside that subtree by construction, so an element sitting on
 * the diagram it belongs to is never a collision.
 *
 * `minPenetration: 4` model units, the calibration Wardley's W3 arrived at on
 * the recette of 01/08/2026: under a twentieth of an EDGY node's 80-unit height
 * and about twice a connector's stroke, so two boxes whose corners share a hair
 * are silent while a box genuinely covering another is not. Verified against
 * every layout this package ships: the twelve nodes of the EDGY dynamic
 * template — the only stamped layout, hence the only one this rule can see —
 * clear each other by 80 model units at the closest, twenty times the
 * threshold.
 */
const overlappingArtefacts: ValidationRule = {
  id: 'edgy.overlapping-artefacts',
  framework: 'edgy',
  family: 'no-overlap',
  severity: 'warning',
  // No `appliesTo`: the subjects of a `no-overlap` rule are the pairs below.
  roles: EDGY_ROLES,
  messageKey: 'com.labre.edgy.validation.overlapping-artefacts',
  messageFallback: 'These two overlap and make the board harder to read.',
  suggestionKey: 'com.labre.edgy.validation.overlapping-artefacts.suggestion',
  suggestionFallback:
    'Move one of them aside — on a facets diagram, where an element sits is what says which facet it belongs to.',
  version: 1,
  backgroundRole: EDGY_ROLE.background,
  overlap: [[EDGY_ROLE.element, EDGY_ROLE.element]],
  minPenetration: 4,
};

export const EDGY_RULES: readonly ValidationRule[] = [
  nonCanonicalLink,
  overlappingArtefacts,
];
