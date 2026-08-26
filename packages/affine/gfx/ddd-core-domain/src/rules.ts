import type { ValidationRule } from '@labre/affine-block-surface';

import {
  CORE_DOMAIN_BACKGROUND,
  CORE_DOMAIN_LEGEND_TONES,
} from './core-domain/background';
import { CORE_DOMAIN_ROLE, CORE_DOMAIN_ROLES } from './roles';

/**
 * Core Domain Chart validation rules.
 *
 * DATA owned by the framework, versioned per rule: the engine
 * (`@labre/affine-block-surface`) knows how to evaluate a FAMILY, never a
 * concrete rule. Adding a rule is adding an entry to this array.
 *
 * Registered from the flag-gated `DddCoreDomainViewExtension`, so switching the
 * `ddd-core-domain` flag off removes the rules with the rest of the tooling —
 * charts already drawn keep rendering, they simply stop being checked (see
 * `docs/adr/0009`).
 *
 * Every rule is `warning` or `audit`: nothing downstream implements a blocking
 * level — no gesture is refused anywhere in this library — so shipping one
 * would be data claiming an effect that does not exist.
 *
 * ## Two rules that are NOT here (PO, 26/08/2026)
 *
 * `suspect-supporting` (a supporting sub-domain drawn at high complexity) and
 * `complex-generic` (a generic one drawn at high complexity) were cut from v1:
 * both hang on the WORDING of the chart's regions — what exactly the middle
 * band claims — and the PO has not settled it. They are two `element-in-zone`
 * entries the day it is, and nothing else moves.
 */

/**
 * **C1** — an outsourced sub-domain has no business in the Core quadrant.
 *
 * The one thing a Core Domain Chart is FOR: the core is what the organisation
 * must own, because it is what differentiates it. A sub-domain marked
 * "outsourced / purchased" plotted in the core is not a placement mistake — it
 * is a strategy contradiction, and the chart exists to make it visible.
 *
 * Written on `core-domain:subdomain-outsourced` alone: the four other dot
 * presets are perfectly at home there.
 *
 * ## What it stays silent about
 *
 * A dot off every chart (a sketch on blank canvas), and — this is the reason
 * the zones name their variant — a dot on a chart turned to its MIGRATION
 * reading, where there is no Core quadrant to be in. Judging one against a
 * region the user cannot see would be indicting them over a frame turned to its
 * other page.
 */
const outsourcedCore: ValidationRule = {
  id: 'core-domain.outsourced-core',
  framework: 'core-domain',
  family: 'element-in-zone',
  severity: 'warning',
  appliesTo: CORE_DOMAIN_ROLE.outsourced,
  roles: CORE_DOMAIN_ROLES,
  messageKey: 'com.labre.core-domain.validation.outsourced-core',
  messageFallback: 'This outsourced sub-domain sits in the Core quadrant.',
  suggestionKey: 'com.labre.core-domain.validation.outsourced-core.suggestion',
  suggestionFallback:
    'The core is what the organisation must own — move it out of the Core quadrant, or reclassify it as a big bet.',
  version: 1,
  backgroundRole: CORE_DOMAIN_ROLE.chart,
  // The frame's own declaration, carried as data exactly like `roles` is: it is
  // where the Core quadrant's rectangle is written, and the engine reads it
  // rather than knowing anything about this chart.
  background: CORE_DOMAIN_BACKGROUND,
  inZone: { zoneIds: ['core'], expect: 'outside' },
};

/**
 * **C2** — a movement runs from a current position to a future one.
 *
 * The grammar of the arrow, and the whole of it: `bc-current` _is moving to_
 * `bc-future`. An arrow drawn the other way round, or between two current
 * positions, says something the chart has no reading for.
 *
 * Self-loops are a finding too: an arrow whose two ends are the same dot is a
 * context moving to where it already is.
 *
 * ## The three silences, and why each one matters
 *
 * - a **free connector** (no role) is not a claim — the user is annotating;
 * - a movement with a **free end** relates nothing;
 * - a movement onto **anything outside the alphabet** — a sub-domain preset, a
 *   neutral shape, a sticky from another framework — is a SKETCH. The alphabet
 *   of this rule is `bc-current` / `bc-future` and nothing else, so a movement
 *   drawn from a big bet to a platform is silent rather than indicted. That is
 *   the hard requirement of the family, and the reason it is shippable.
 *
 * No `forbidDuplicate`: two movements drawn between the same two contexts are
 * two dated statements about the same journey, which is a legitimate way to use
 * this chart.
 */
const malformedMovement: ValidationRule = {
  id: 'core-domain.malformed-movement',
  framework: 'core-domain',
  family: 'relation-endpoints',
  severity: 'warning',
  // No `appliesTo`: the subject of this rule is a RELATION, and the role that
  // names it is declared where the family reads it — naming one of the three
  // indicted elements here would be data that lies.
  roles: CORE_DOMAIN_ROLES,
  messageKey: 'com.labre.core-domain.validation.malformed-movement',
  messageFallback:
    'This movement does not run from a current position to a future one.',
  suggestionKey:
    'com.labre.core-domain.validation.malformed-movement.suggestion',
  suggestionFallback:
    'A movement reads "is moving to" — draw it from the context where it stands today to the future position, or reverse it.',
  version: 1,
  backgroundRole: CORE_DOMAIN_ROLE.chart,
  endpoints: {
    edgeRole: CORE_DOMAIN_ROLE.movement,
    allowed: [
      {
        source: CORE_DOMAIN_ROLE.bcCurrent,
        edge: CORE_DOMAIN_ROLE.movement,
        target: CORE_DOMAIN_ROLE.bcFuture,
      },
    ],
    forbidSelfLoop: true,
    selfLoop: {
      messageKey: 'com.labre.core-domain.validation.movement-self-loop',
      messageFallback:
        'This movement points back at its own starting position.',
      suggestionKey:
        'com.labre.core-domain.validation.movement-self-loop.suggestion',
      suggestionFallback:
        'Drop the far end on the future position, or delete the arrow.',
    },
  },
};

/**
 * **C3** — sub-domains must not sit on top of each other.
 *
 * A readability rule, not a semantic one: a chart where two dots overlap hides
 * one of them, and a hidden sub-domain is a sub-domain nobody discusses. Written
 * on the PARENT role, so all five presets are covered for free.
 *
 * `minPenetration: 6` — the dot is 26 units across, so six units is roughly a
 * quarter of one. Two dots grazing each other while somebody arranges a cluster
 * are silent; one drawn over another is not.
 */
const overlappingArtefacts: ValidationRule = {
  id: 'core-domain.overlapping-artefacts',
  framework: 'core-domain',
  family: 'no-overlap',
  severity: 'warning',
  // No `appliesTo`: the subjects of a `no-overlap` rule are its PAIRS.
  roles: CORE_DOMAIN_ROLES,
  messageKey: 'com.labre.core-domain.validation.overlapping-artefacts',
  messageFallback: 'These two sub-domains overlap and hide each other.',
  suggestionKey:
    'com.labre.core-domain.validation.overlapping-artefacts.suggestion',
  suggestionFallback: 'Move one of them aside.',
  version: 1,
  // Not a frame the rule measures against — an overlap is an overlap wherever
  // it happens — but the chart a finding is ATTRIBUTED to, so the arbitration
  // "ignore this rule on the whole chart" has one chart to be written on.
  backgroundRole: CORE_DOMAIN_ROLE.chart,
  overlap: [[CORE_DOMAIN_ROLE.subdomain, CORE_DOMAIN_ROLE.subdomain]],
  minPenetration: 6,
};

/**
 * **C4** — a sub-domain is drawn in one of the five legend colours.
 *
 * The chart's notation IS its five colours: the legend the toolbar inserts
 * lists them, and a dot recoloured by hand out of the shape palette silently
 * stops meaning anything. Judged on the tone FAMILY, never on the hex, so every
 * legitimate shade the shape toolbar can produce still reads as its colour.
 *
 * `audit`, on purpose and in every profile: recolouring a dot is a normal thing
 * to do while thinking, and the day it matters is the day somebody reads the
 * chart back — which is what a conformance report is for. The finding reaches
 * `violations$`; the canvas says nothing.
 *
 * The sanctioned tones are named, not restated: `CORE_DOMAIN_LEGEND_TONES` is
 * the list of palette entries the declaration built from `CD_SUBDOMAINS`, so
 * restyling the notation restyles the convention with it, in one place.
 */
const offLegendColour: ValidationRule = {
  id: 'core-domain.off-legend-colour',
  framework: 'core-domain',
  family: 'tone-convention',
  severity: 'audit',
  appliesTo: CORE_DOMAIN_ROLE.subdomain,
  roles: CORE_DOMAIN_ROLES,
  messageKey: 'com.labre.core-domain.validation.off-legend-colour',
  messageFallback: 'This sub-domain is not drawn in one of the legend colours.',
  suggestionKey:
    'com.labre.core-domain.validation.off-legend-colour.suggestion',
  suggestionFallback:
    'The chart reads by its notation — put the dot back on one of the five legend colours, or add the new one to the legend.',
  version: 1,
  backgroundRole: CORE_DOMAIN_ROLE.chart,
  background: CORE_DOMAIN_BACKGROUND,
  tone: { palette: CORE_DOMAIN_LEGEND_TONES },
};

export const CORE_DOMAIN_RULES: readonly ValidationRule[] = [
  outsourcedCore,
  malformedMovement,
  overlappingArtefacts,
  offLegendColour,
];
