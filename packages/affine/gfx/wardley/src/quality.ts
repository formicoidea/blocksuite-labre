import type {
  QualityNudge,
  ValidationRule,
} from '@labre/affine-block-surface';

import { WARDLEY_BACKGROUND } from './background';
import { WARDLEY_ROLE, WARDLEY_ROLES } from './roles';

/**
 * Wardley **map quality** — the second-order controls (PF13.9 / PF13.8).
 *
 * Level 1 is `./rules.ts`: deterministic, decidable, real time. This file is
 * level 2, and the split is the whole point of the taxonomy — a rule only enters
 * the deterministic engine if an algorithm can decide it on persisted data
 * inside the ~16 ms budget. Everything else is a nudge or a check-up, and
 * neither ever blocks anything.
 *
 * - **Q1–Q4** are NUDGES: expectations the tool cannot judge, offered as a
 *   checklist. Ticking is assuming.
 * - **Q5–Q6** are ON-DEMAND rules: real evaluations, run only when the user asks,
 *   producing remarks in `audit` severity that never reach the canvas.
 *
 * Registered from the flag-gated `WardleyViewExtension`, beside the rules and
 * the profiles: a checklist and a check-up are tooling. Switching the flag off
 * takes them away and leaves the ticks written on the map, unread, until it
 * comes back (PF7.10).
 */

/**
 * **Q1–Q4** — the four things a Wardley map needs in order to do its job, and
 * that no algorithm can check.
 *
 * Every one of them is about whether the map can be DISCUSSED. A map with no
 * title is a diagram nobody can situate; one with no legend is a private
 * notation; one whose evolution axis is drawn but not used is a value chain
 * wearing a Wardley costume. The tool can put all four on screen and it cannot
 * judge a single one — "the title contextualises the study" is a statement about
 * meaning, and a rule claiming to have verified it would be lying.
 *
 * The wordings are the PO's own, from the review of 01/08/2026, carried as
 * `fallback` so a host with no catalogue reads them exactly as written.
 */
export const WARDLEY_NUDGES: readonly QualityNudge[] = [
  {
    id: 'wardley.q1-title',
    framework: 'wardley',
    labelKey: 'com.labre.wardley.quality.title',
    fallback:
      'The map has a title that frames the study (scope, objective) and states what kind of map it is.',
    order: 1,
  },
  {
    id: 'wardley.q2-context',
    framework: 'wardley',
    labelKey: 'com.labre.wardley.quality.context',
    fallback: 'The context of the map is stated.',
    order: 2,
  },
  {
    id: 'wardley.q3-legend',
    framework: 'wardley',
    labelKey: 'com.labre.wardley.quality.legend',
    fallback: 'The map is legended.',
    order: 3,
  },
  {
    id: 'wardley.q4-evolution-axis',
    framework: 'wardley',
    labelKey: 'com.labre.wardley.quality.evolution-axis',
    fallback: 'The evolution axis is used and legended.',
    order: 4,
  },
];

/**
 * **Q5** — the landscape is drawn in greys.
 *
 * Wardley's tone convention is a reading aid with teeth: grey is the landscape,
 * red is what is moving (change points, investments, costs) and green is a
 * benefit or a functional difference. A component coloured red for emphasis is
 * therefore not emphasis — it is a claim about the future that the author did
 * not make, and that every reader of the map will make on their behalf.
 *
 * ## Why on-demand
 *
 * Not because it is expensive — it is one colour read per component — but
 * because it is not urgent. Recolouring a node is a deliberate gesture, often
 * mid-thought, and a badge appearing the instant somebody tries a colour would
 * be the tool arguing with a hand that has not finished moving. The convention
 * is something you check a map against, not something you are interrupted by.
 * That is exactly what PF5.14's second moment is for.
 *
 * ## Scope, and what is deliberately not indicted
 *
 * Written on `wardley:component`, so it covers `market` and `ecosystem` for
 * free ({@link roleIsA}) and covers nothing else. Change arrows are excluded and
 * must be: red IS their sanctioned tone, they are created red, and a rule
 * flagging them would flag the convention being honoured. Dependencies and
 * labels are excluded for a weaker reason — nothing recolours them today — and
 * the day one does, they are two more entries in an array and no code.
 *
 * `audit` severity: collected, never shown on the canvas. Belt to the braces of
 * the on-demand moment, which already keeps it out of `violations$` entirely.
 */
const toneOffConvention: ValidationRule = {
  id: 'wardley.tone-off-convention',
  framework: 'wardley',
  family: 'tone-convention',
  moment: 'on-demand',
  severity: 'audit',
  appliesTo: WARDLEY_ROLE.component,
  roles: WARDLEY_ROLES,
  messageKey: 'com.labre.wardley.quality.tone-off-convention',
  messageFallback:
    'This component is not drawn in the tones of the landscape.',
  suggestionKey: 'com.labre.wardley.quality.tone-off-convention.suggestion',
  suggestionFallback:
    'The landscape is drawn in greys — red is reserved for what is changing (investments, costs), green for benefits and functional differences.',
  version: 1,
  backgroundRole: WARDLEY_ROLE.map,
  background: WARDLEY_BACKGROUND,
  // Named against the frame's own palette, never restated as a colour here.
  tone: { palette: ['landscape'] },
};

/**
 * **Q6** — the phase names could fit what is actually mapped.
 *
 * Wardley's four phases are named for one kind of thing at a time: Genesis /
 * Custom-Built / Product / Commodity reads naturally for ACTIVITIES, less so for
 * practices, data or knowledge, which have their own nomenclatures. So when a
 * map is mostly activities, saying so is useful. Imposing it never is — the
 * remark suggests, and the phase labels stay the user's to write.
 *
 * ## Shipped inert, on purpose
 *
 * The "nature" of a component is the type-3 classification (user-need, market,
 * ecosystem, solution, function → practice / data / activity / knowledge). **It
 * does not exist yet**: no model field carries it and no gesture writes it. The
 * `majority-fact` family is built for exactly this — a surface where NOT ONE
 * subject carries the fact yields nothing, silently, so this rule ships today,
 * costs a walk of the components on a check-up somebody asked for, and starts
 * producing its remark by itself the day the nature lands.
 *
 * That is deliberately not a feature flag, a `TODO` or a commented-out block.
 * The condition is DATA — "is the fact there" — and it is asserted by a test
 * (`quality.unit.spec.ts`) that documents both halves: silent while the nature is
 * absent, correct the moment a majority carries it. Wiring it up later is a
 * `nature` field on the model and nothing in this file.
 *
 * The prop name is fixed here rather than derived so that whoever adds the field
 * has one string to match; if the model calls it something else, this is the one
 * line to change.
 */
const activityNomenclature: ValidationRule = {
  id: 'wardley.phase-nomenclature',
  framework: 'wardley',
  family: 'majority-fact',
  moment: 'on-demand',
  severity: 'audit',
  appliesTo: WARDLEY_ROLE.component,
  roles: WARDLEY_ROLES,
  messageKey: 'com.labre.wardley.quality.phase-nomenclature',
  messageFallback:
    'Most components on this map are activities — the phase names for activities would read better.',
  suggestionKey: 'com.labre.wardley.quality.phase-nomenclature.suggestion',
  suggestionFallback:
    'Genesis → Custom-Built → Product → Commodity is the nomenclature for activities. Rename the phase labels if it helps; it is never imposed.',
  version: 1,
  backgroundRole: WARDLEY_ROLE.map,
  background: WARDLEY_BACKGROUND,
  majority: { fact: 'nature', value: 'activity' },
};

/**
 * The on-demand half of the Wardley pack. Registered beside `WARDLEY_RULES` and
 * deliberately NOT part of it: the real-time array is what the 16 ms bench
 * measures, and a check-up rule has no business appearing in that number — nor
 * in the count of rules a drag pays for.
 */
export const WARDLEY_CHECKUP_RULES: readonly ValidationRule[] = [
  toneOffConvention,
  activityNomenclature,
];
