import type { ValidationProfile } from '@labre/affine-block-surface';

/**
 * Context Mapping validation profiles (WS2).
 *
 * DATA owned by the framework, like its rules and its roles. A profile is
 * chosen per BOARD, not per document, and the choice rides on the board element
 * itself — two maps at two levels of requirement coexist on one canvas.
 *
 * Registered from the flag-gated `DddContextMapViewExtension`, beside the
 * rules: switching the Context Map flag off takes the choice away with the rest
 * of the tooling, and a board already set to `strict` simply stops being checked
 * until it comes back — the id stays written, untouched.
 */

/**
 * Sketch: every rule demoted to `audit`. Findings still reach `violations$` —
 * a host panel and a conformance report see them — and the canvas says nothing.
 *
 * The DEFAULT, and deliberately so (PRD principle 3). A context map is drawn in
 * a workshop, at speed, with half the links pointing the wrong way while
 * somebody remembers which team is upstream; a tool arguing with that hand is a
 * tool switched off within the hour. Being the default also means it WRITES
 * NOTHING: a board on `sketch` carries no profile key, so every map ever drawn
 * is on it, with no migration and no backfill.
 */
const sketch: ValidationProfile = {
  id: 'context-map.sketch',
  framework: 'ddd-context-map',
  labelKey: 'com.labre.ddd-context-map.profile.sketch',
  fallback: 'Sketch',
  isDefault: true,
  rules: {
    'context-map.relationship-endpoints': 'audit',
    'context-map.acl-conformist-exclusive': 'audit',
    'context-map.pattern-on-customer-supplier': 'audit',
    'context-map.acl-on-customer-supplier': 'audit',
    'context-map.context-off-board': 'audit',
  },
};

/**
 * Strict: the deliverable level — a map that leaves the room. Every severity is
 * spelled out rather than left absent, so the answer is readable in one place.
 *
 * ## The one that does not move
 *
 * `acl-on-customer-supplier` stays `audit` HERE TOO, and it is the reason a
 * profile spells everything out. It is not a softer version of a contradiction,
 * it is a different KIND of statement: the combination is legitimate — a team
 * negotiating its needs upstream while still translating a model that is being
 * retired — and only the team knows which case they are in. Promoting it with
 * the others would turn a good question into a false accusation on every mature
 * map in the corpus.
 *
 * Nothing here is `blocking-overridable`: nothing in this library implements
 * refusal, and declaring it would be data claiming an effect that does not
 * exist.
 */
const strict: ValidationProfile = {
  id: 'context-map.strict',
  framework: 'ddd-context-map',
  labelKey: 'com.labre.ddd-context-map.profile.strict',
  fallback: 'Strict',
  rules: {
    'context-map.relationship-endpoints': 'warning',
    'context-map.acl-conformist-exclusive': 'warning',
    'context-map.pattern-on-customer-supplier': 'warning',
    // See the header: a judgement the map cannot make at any level.
    'context-map.acl-on-customer-supplier': 'audit',
    'context-map.context-off-board': 'warning',
  },
};

export const CONTEXT_MAP_PROFILES: readonly ValidationProfile[] = [
  sketch,
  strict,
];
