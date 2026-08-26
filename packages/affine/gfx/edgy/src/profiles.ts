import type { ValidationProfile } from '@labre/affine-block-surface';

/**
 * EDGY validation profiles (WS1).
 *
 * DATA owned by the framework, like its rules and its roles: the engine knows
 * how to APPLY a profile, never which ones EDGY has. Adding a level of
 * requirement is adding an entry to this array.
 *
 * A profile is chosen per BACKGROUND, not per document (PF9.1) — a workshop
 * scribble and a deliverable model coexist on the same canvas with different
 * requirements, and the choice rides on the facets diagram or board itself.
 *
 * Registered from the flag-gated `EdgyViewExtension`, beside the rules:
 * switching the EDGY flag off takes the choice away with the rest of the
 * tooling, and a board already set to `strict` simply stops being checked until
 * it comes back — the id stays written, untouched.
 */

/**
 * Sketch: every rule demoted to `audit`, so findings still reach `violations$`
 * — a host panel and a conformance report see them — and the canvas says
 * nothing at all.
 *
 * The DEFAULT, and deliberately so (PRD principle 3). EDGY is a WORKSHOP
 * notation: elements land on the diagram in the order people say them, half the
 * relations point the wrong way for the ten minutes it takes to argue about
 * them, and boxes pile up in a corner before anybody sorts them into facets. A
 * tool warning about all of that in real time would be arguing with the
 * workshop.
 *
 * Being the default also means it is the one profile that WRITES NOTHING: a
 * board on `sketch` carries no profile key, so every EDGY diagram ever drawn is
 * on it, with no migration and no backfill.
 */
const sketch: ValidationProfile = {
  id: 'edgy.sketch',
  framework: 'edgy',
  labelKey: 'com.labre.edgy.profile.sketch',
  fallback: 'Sketch',
  isDefault: true,
  rules: {
    'edgy.non-canonical-link': 'audit',
    'edgy.overlapping-artefacts': 'audit',
  },
};

/**
 * Strict: the deliverable level. Both rules bite, and both severities are
 * spelled out here rather than left absent — PF9.4 wants the answer readable in
 * one place, and a profile that says "warning" out loud cannot be misread as
 * "whatever the rule happens to declare this quarter".
 *
 * `warning` and not `blocking-overridable` for E1, though a relation outside the
 * metamodel is exactly the statement a strict EDGY model must not contain:
 * nothing in this library implements a blocking level, so the value would claim
 * an effect that does not exist. When the gesture refusal lands, this is a
 * two-word change and this file is the only one that moves.
 */
const strict: ValidationProfile = {
  id: 'edgy.strict',
  framework: 'edgy',
  labelKey: 'com.labre.edgy.profile.strict',
  fallback: 'Strict',
  rules: {
    'edgy.non-canonical-link': 'warning',
    'edgy.overlapping-artefacts': 'warning',
  },
};

export const EDGY_PROFILES: readonly ValidationProfile[] = [sketch, strict];
