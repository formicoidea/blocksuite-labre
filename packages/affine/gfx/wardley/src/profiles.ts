import type { ValidationProfile } from '@labre/affine-block-surface';

/**
 * Wardley validation profiles (PF9).
 *
 * DATA owned by the framework, like its rules, its roles and its background:
 * the engine knows how to APPLY a profile, never which ones Wardley has. Adding
 * a level of requirement is adding an entry to this array.
 *
 * A profile is chosen per MAP, not per document (PF9.1) — a rough sketch and a
 * deliverable diagram coexist on the same canvas with different requirements,
 * and the choice rides on the background element itself.
 *
 * Registered from the flag-gated `WardleyViewExtension`, beside the rules:
 * switching the Wardley flag off takes the choice away with the rest of the
 * tooling, and a map already set to `strict` simply stops being checked until
 * it comes back — the id stays written, untouched.
 */

/**
 * Learning: the pilot rule is demoted to `audit`, so an off-map component is
 * still reported to `violations$` — a host panel and a report still see it —
 * but the canvas says nothing at all. Nobody drawing gets interrupted.
 *
 * The DEFAULT, and deliberately so: the sketch wins (PRD principle 3). Somebody
 * opening a Wardley map for the first time is exploring, not filing a
 * deliverable, and the tool has no business telling them off for parking a node
 * in the margin while they think. Being the default also means it is the one
 * profile that WRITES NOTHING: a map on `sketch` carries no profile key, so
 * every map ever drawn is on it, with no migration and no backfill.
 */
const sketch: ValidationProfile = {
  id: 'wardley.sketch',
  framework: 'wardley',
  labelKey: 'com.labre.wardley.profile.sketch',
  fallback: 'Sketch',
  isDefault: true,
  rules: {
    'wardley.component-outside-map': 'audit',
  },
};

/**
 * Strict: the pilot rule bites at `warning` — its own declared severity, so
 * this entry raises nothing the rule did not already ask for. It is spelled out
 * rather than left absent on purpose: PF9.4 wants every severity a user gets to
 * be readable in one place, and a profile that says "warning" out loud cannot
 * be misread as "whatever the rule happens to say this quarter".
 *
 * Still never blocking. Strict is a level of attention, not a wall — the way
 * out through an exception (PF8) is unchanged, and a rule can only be waived,
 * never enforced against the user's judgement.
 */
const strict: ValidationProfile = {
  id: 'wardley.strict',
  framework: 'wardley',
  labelKey: 'com.labre.wardley.profile.strict',
  fallback: 'Strict',
  rules: {
    'wardley.component-outside-map': 'warning',
  },
};

export const WARDLEY_PROFILES: readonly ValidationProfile[] = [sketch, strict];
