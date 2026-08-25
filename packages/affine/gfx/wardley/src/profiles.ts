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
 * Learning: every rule is demoted to `audit`, so findings still reach
 * `violations$` — a host panel and a conformance report see them — and the
 * canvas says nothing at all. Nobody drawing gets interrupted.
 *
 * The DEFAULT, and deliberately so: the sketch wins (PRD principle 3). Somebody
 * opening a Wardley map for the first time is exploring, not filing a
 * deliverable, and the tool has no business telling them off for an arrow they
 * have not finished turning round. Being the default also means it is the one
 * profile that WRITES NOTHING: a map on `sketch` carries no profile key, so
 * every map ever drawn is on it, with no migration and no backfill.
 *
 * Silencing ALL THREE is the architect's recommendation and is written here for
 * the PO to confirm or overturn — it is one word per line either way.
 */
const sketch: ValidationProfile = {
  id: 'wardley.sketch',
  framework: 'wardley',
  labelKey: 'com.labre.wardley.profile.sketch',
  fallback: 'Sketch',
  isDefault: true,
  rules: {
    'wardley.change-arrow-against-evolution': 'audit',
    'wardley.inertia-off-transition': 'audit',
    'wardley.overlapping-artefacts': 'audit',
    // W4 too, and it is the one where the demotion matters most: a value chain
    // is drawn before it is arranged, so half the links are momentarily
    // upside-down while somebody thinks. The finding still reaches a host panel
    // and a conformance report; the canvas says nothing.
    'wardley.provider-above-consumer': 'audit',
  },
};

/**
 * Strict: the deliverable level. Every rule bites, and every severity a user
 * gets is spelled out here rather than left absent — PF9.4 wants the answer
 * readable in one place, and a profile that says "warning" out loud cannot be
 * misread as "whatever the rule happens to declare this quarter".
 *
 * ## Why W1 and W2 are not `blocking-overridable`
 *
 * They should be: pointing a change arrow backwards and parking an inertia bar
 * in the middle of a phase are both statements that are simply false, and the
 * architect's recommendation is that strict refuse the gesture and offer the
 * way out.
 *
 * Nothing implements that yet. `blocking-overridable` is carried by the engine
 * and read by nobody: no gesture is refused anywhere in this library. Declaring
 * it here would be data claiming an effect that does not exist, and the honest
 * move is a `warning` plus this paragraph. When the refusal lands, this is a
 * two-word change and the profile is the only file that moves.
 *
 * W3 stays `warning` on its own merits: an overlap is a readability problem,
 * and refusing a drag because two labels touch would be the tool fighting the
 * hand.
 */
const strict: ValidationProfile = {
  id: 'wardley.strict',
  framework: 'wardley',
  labelKey: 'com.labre.wardley.profile.strict',
  fallback: 'Strict',
  rules: {
    'wardley.change-arrow-against-evolution': 'warning',
    'wardley.inertia-off-transition': 'warning',
    'wardley.overlapping-artefacts': 'warning',
    // W4 is a `warning` for the same reason W1 and W2 are, plus one of its own:
    // its two honest resolutions are a MOVE and a REVERSAL, and both are the
    // user's call. A rule that refused the gesture would be picking one.
    'wardley.provider-above-consumer': 'warning',
  },
};

export const WARDLEY_PROFILES: readonly ValidationProfile[] = [sketch, strict];
