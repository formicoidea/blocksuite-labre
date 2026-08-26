import type { ValidationProfile } from '@labre/affine-block-surface';

/**
 * Core Domain Chart validation profiles (PF9).
 *
 * DATA owned by the framework, like its rules, its roles and its background:
 * the engine knows how to APPLY a profile, never which ones this framework has.
 *
 * A profile is chosen per CHART, not per document (PF9.1) — a rough sketch and
 * a chart that goes in front of a steering committee coexist on the same canvas
 * with different requirements, and the choice rides on the background element
 * itself.
 *
 * Registered from the flag-gated `DddCoreDomainViewExtension`, beside the
 * rules: switching the flag off takes the choice away with the rest of the
 * tooling, and a chart already set to `strict` simply stops being checked until
 * it comes back — the id stays written, untouched.
 */

/**
 * Sketch: every rule demoted to `audit`, so findings still reach `violations$`
 * — a host panel and a conformance report see them — and the canvas says
 * nothing at all.
 *
 * The DEFAULT, and deliberately so: the sketch wins (PRD principle 3). A Core
 * Domain Chart is drawn in a workshop, in front of people, by dragging dots
 * around until the room agrees; a tool badging a dot that has been in the core
 * for eleven seconds is a tool the room switches off. Being the default also
 * means it is the one profile that WRITES NOTHING: a chart on `sketch` carries
 * no profile key, so every chart ever drawn is on it, with no migration and no
 * backfill.
 */
const sketch: ValidationProfile = {
  id: 'core-domain.sketch',
  framework: 'core-domain',
  labelKey: 'com.labre.core-domain.profile.sketch',
  fallback: 'Sketch',
  isDefault: true,
  rules: {
    'core-domain.outsourced-core': 'audit',
    'core-domain.malformed-movement': 'audit',
    'core-domain.overlapping-artefacts': 'audit',
    'core-domain.off-legend-colour': 'audit',
  },
};

/**
 * Strict: the deliverable level. Every severity a user gets is spelled out here
 * rather than left absent — PF9.4 wants the answer readable in one place.
 *
 * C4 stays `audit` even here, and that is the one deliberate asymmetry: the
 * colour of a dot is a NOTATION question, answered when the chart is read back
 * rather than while it is drawn, and the honest place for it is the conformance
 * report the audit level already feeds. Promoting it would put a badge on a dot
 * whose only sin is a shade.
 */
const strict: ValidationProfile = {
  id: 'core-domain.strict',
  framework: 'core-domain',
  labelKey: 'com.labre.core-domain.profile.strict',
  fallback: 'Strict',
  rules: {
    'core-domain.outsourced-core': 'warning',
    'core-domain.malformed-movement': 'warning',
    'core-domain.overlapping-artefacts': 'warning',
    'core-domain.off-legend-colour': 'audit',
  },
};

export const CORE_DOMAIN_PROFILES: readonly ValidationProfile[] = [
  sketch,
  strict,
];
