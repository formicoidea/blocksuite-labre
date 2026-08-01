import type { ValidationRule } from '@labre/affine-block-surface';

import { WARDLEY_ROLE, WARDLEY_ROLES } from './roles';

/**
 * Wardley validation rules (PF5, wave 1).
 *
 * DATA owned by the framework, versioned per rule: the engine
 * (`@labre/affine-block-surface`) knows how to evaluate a FAMILY, never a
 * concrete rule. Adding a Wardley rule is adding an entry to this array.
 *
 * Registered from the flag-gated `WardleyViewExtension`, so switching the
 * Wardley flag off removes the rules with the rest of the tooling — already
 * drawn maps keep rendering, they simply stop being checked (see
 * `docs/adr/0009`).
 */

/** The `type` of the Wardley map background element — "the map". */
const WARDLEY_BACKGROUND_TYPE = 'wardley';

/**
 * A component drawn outside the map is not positioned: on a Wardley map the
 * two axes ARE the meaning, so a node off the frame carries neither evolution
 * nor visibility.
 *
 * Written on `wardley:component`, so it covers `wardley:market` and
 * `wardley:ecosystem` through the role hierarchy without naming them. The
 * anchor is deliberately NOT covered: it is a role of its own, and the pilot
 * rule stays as narrow as its wording.
 *
 * `warning`, never blocking: the sketch always wins (PRD principle 3). A user
 * parking nodes off-map while thinking is doing normal work, not making a
 * mistake.
 */
const componentOutsideMap: ValidationRule = {
  id: 'wardley.component-outside-map',
  framework: 'wardley',
  family: 'element-in-background',
  severity: 'warning',
  appliesTo: WARDLEY_ROLE.component,
  roles: WARDLEY_ROLES,
  messageKey: 'com.labre.wardley.validation.component-outside-map',
  suggestionKey: 'com.labre.wardley.validation.component-outside-map.suggestion',
  version: 1,
  backgroundType: WARDLEY_BACKGROUND_TYPE,
};

export const WARDLEY_RULES: readonly ValidationRule[] = [componentOutsideMap];
