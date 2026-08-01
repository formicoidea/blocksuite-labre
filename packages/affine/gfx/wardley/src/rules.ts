import type { ValidationRule } from '@labre/affine-block-surface';

import { WARDLEY_BACKGROUND } from './background';
import { WARDLEY_ROLE, WARDLEY_ROLES } from './roles';

/**
 * Wardley validation rules (PF13.4 / PF13.5 / PF13.6).
 *
 * DATA owned by the framework, versioned per rule: the engine
 * (`@labre/affine-block-surface`) knows how to evaluate a FAMILY, never a
 * concrete rule. Adding a Wardley rule is adding an entry to this array.
 *
 * Registered from the flag-gated `WardleyViewExtension`, so switching the
 * Wardley flag off removes the rules with the rest of the tooling — already
 * drawn maps keep rendering, they simply stop being checked (see
 * `docs/adr/0009`).
 *
 * ## The pilot rule is gone
 *
 * `wardley.component-outside-map` was the tracer bullet's rule: it existed to
 * prove the engine, the affordance, the exceptions and the profiles could work
 * end to end, never because a Wardley practitioner asked for it. Parking a node
 * in the margin while you think is normal work, and PO decision of 01/08/2026
 * removed it the moment there were real rules for the machinery to carry.
 * Nothing was left behind: every test that exercised the pipework through it
 * now exercises it through W1, W2 or W3.
 *
 * ## Severity, and a hole that is named rather than papered over
 *
 * W1 and W2 are the two the architect would put at `blocking-overridable`. They
 * are declared `warning`, because NOTHING downstream implements a blocking
 * level: no gesture is refused anywhere in this library, so shipping the value
 * would be data claiming an effect that does not exist. The severity moves to
 * `blocking-overridable` in the profiles, in one line each, the day the gesture
 * refusal lands. Building it was explicitly out of this slice.
 */

/**
 * **W1** — a change arrow may not point against the sense of evolution.
 *
 * The whole grammar of a Wardley map is that things move left to right: a red
 * arrow pointing back towards Genesis says the opposite of what the map means.
 * Written on `wardley:change-arrow`, the role PF13.4 puts on the arrow at
 * creation — value-chain links are a different role and are never touched.
 *
 * The 30° dead zone is deliberate. An arrow drawn straight up a value chain is
 * neither with evolution nor against it, and one drawn slightly up-and-back is
 * a hand that slipped, not a claim about the world. Only an arrow genuinely
 * heading back — more than 120° off the axis' forward sense — is one.
 */
const changeArrowAgainstEvolution: ValidationRule = {
  id: 'wardley.change-arrow-against-evolution',
  framework: 'wardley',
  family: 'orientation-against-axis',
  severity: 'warning',
  appliesTo: WARDLEY_ROLE.changeArrow,
  roles: WARDLEY_ROLES,
  messageKey: 'com.labre.wardley.validation.change-arrow-against-evolution',
  messageFallback: 'This change arrow points against evolution.',
  suggestionKey:
    'com.labre.wardley.validation.change-arrow-against-evolution.suggestion',
  suggestionFallback:
    'Evolution runs left to right — turn the arrow towards the commodity end, or draw a dependency instead.',
  version: 1,
  backgroundRole: WARDLEY_ROLE.map,
  // The frame's own declaration, carried as data exactly like `roles` is: it is
  // where "which way does evolution run" is written, and the engine reads it
  // rather than knowing anything about Wardley.
  background: WARDLEY_BACKGROUND,
  against: { axis: 'evolution', toleranceDeg: 30 },
};

/**
 * **W2** — the inertia bar belongs on a dependency, at a phase transition.
 *
 * Inertia is resistance to a specific movement: it is drawn ACROSS the link
 * that would have to move, at the boundary the thing is refusing to cross. A
 * bar floating in white space, or sitting on a link in the middle of a phase,
 * has lost the whole of its meaning — it becomes a black rectangle.
 *
 * Tolerances are in model units, against a bar that is 8 × 44 and a map whose
 * reference plot is ~1530 wide: 24 units off the link is roughly "not on it",
 * and 40 units off a transition is about half a bar-width of slack on a
 * 1600-wide map — generous enough that nobody has to be precise, tight enough
 * that the symbol still points at a boundary.
 */
const inertiaOffTransition: ValidationRule = {
  id: 'wardley.inertia-off-transition',
  framework: 'wardley',
  family: 'attachment',
  severity: 'warning',
  appliesTo: WARDLEY_ROLE.inertia,
  roles: WARDLEY_ROLES,
  messageKey: 'com.labre.wardley.validation.inertia-off-transition',
  messageFallback:
    'This inertia bar is not on a dependency at a phase transition.',
  suggestionKey:
    'com.labre.wardley.validation.inertia-off-transition.suggestion',
  suggestionFallback:
    'Inertia marks resistance to a movement: put the bar across the dependency, on the phase boundary it refuses to cross.',
  version: 1,
  backgroundRole: WARDLEY_ROLE.map,
  background: WARDLEY_BACKGROUND,
  attachment: {
    carrierRole: WARDLEY_ROLE.dependency,
    tolerance: 24,
    boundaryAxis: 'evolution',
    boundaryTolerance: 40,
  },
};

/**
 * **W3** — nodes and labels must not sit on top of each other.
 *
 * A readability rule, not a semantic one, which is why it is the softest of the
 * three: a map you cannot read is useless, but a momentary overlap while you
 * drag things into place is not a mistake.
 *
 * The four declared combinations are the ones that actually make a map
 * illegible. Node/node hides an artefact outright; label/label and label/node
 * make a name unreadable or attach it to the wrong thing; label/link is the one
 * everybody hits, a name crossed out by the dependency running under it.
 *
 * Link/link is deliberately ABSENT: dependencies cross all the time on a real
 * value chain, and that is the map working, not the map broken.
 */
const overlappingArtefacts: ValidationRule = {
  id: 'wardley.overlapping-artefacts',
  framework: 'wardley',
  family: 'no-overlap',
  severity: 'warning',
  // No `appliesTo`: this rule has no single subject role — the subjects are the
  // pairs below, and naming one of them here would be data that lies.
  roles: WARDLEY_ROLES,
  messageKey: 'com.labre.wardley.validation.overlapping-artefacts',
  messageFallback: 'These two overlap and make the map harder to read.',
  suggestionKey: 'com.labre.wardley.validation.overlapping-artefacts.suggestion',
  suggestionFallback: 'Move one of them aside.',
  version: 1,
  // Not a frame the rule measures against — an overlap is an overlap wherever
  // it happens — but the map a finding is ATTRIBUTED to, so the arbitration
  // "ignore this rule on the whole map" has one map to be written on.
  backgroundRole: WARDLEY_ROLE.map,
  overlap: [
    [WARDLEY_ROLE.component, WARDLEY_ROLE.component],
    [WARDLEY_ROLE.label, WARDLEY_ROLE.label],
    [WARDLEY_ROLE.label, WARDLEY_ROLE.component],
    [WARDLEY_ROLE.label, WARDLEY_ROLE.dependency],
  ],
};

export const WARDLEY_RULES: readonly ValidationRule[] = [
  changeArrowAgainstEvolution,
  inertiaOffTransition,
  overlappingArtefacts,
];
