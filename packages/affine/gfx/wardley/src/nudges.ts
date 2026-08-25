import type { QualityNudge } from '@labre/affine-block-surface';

/**
 * Wardley **map quality** — the checklist (PF13.9).
 *
 * Level 1 is `./rules.ts`: deterministic, decidable, real time. This file is
 * level 2, and the split is the whole point of the taxonomy — a rule only enters
 * the deterministic engine if an algorithm can decide it on persisted data
 * inside the ~16 ms budget. Everything else is a NUDGE: an expectation offered
 * as a checklist, never evaluated, never blocking anything. Ticking is assuming.
 *
 * ## The check-up rules are gone (PO decision, 02/08/2026)
 *
 * Q5 (tone convention) and Q6 (phase nomenclature) used to live beside these,
 * as on-demand rules behind a "Run check-up" button. The panel is now the
 * checklist and nothing else: the PO's recette found that a second verdict, a
 * button and a scope line asked the reader to hold three different kinds of
 * statement in their head over a map that mostly wanted a title. Nothing was
 * deleted from the platform — the on-demand MOMENT (PF5.14) and the
 * `tone-convention` / `majority-fact` families are still in the engine, still
 * tested, and the next framework that wants a check-up declares one. Wardley
 * simply stopped exposing one.
 *
 * Registered from the flag-gated `WardleyViewExtension`, beside the rules and
 * the profiles: a checklist is tooling. Switching the flag off takes it away and
 * leaves the ticks written on the map, unread, until it comes back (PF7.10).
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
