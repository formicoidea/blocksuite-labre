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
 * **W2** — the inertia bar straddles a phase transition.
 *
 * > "The horizontal position of an inertia bar is only valid if it is ASTRIDE
 * > two evolution phases, that is, superimposed on a dashed vertical axis."
 * > — the PO, spelling the rule out on the recette of 02/08/2026
 *
 * Inertia is resistance to crossing a frontier. The bar is the frontier being
 * refused, so it is drawn ON the divider; a bar parked in the middle of a phase
 * marks nothing at all and becomes a black rectangle.
 *
 * ## What this rule used to ask, and no longer does
 *
 * Until this version it ALSO demanded a dependency under the bar, and reported
 * that half first ("This inertia bar is not drawn on a dependency."). That was
 * our reading of inertia, not the PO's rule, and it was wrong in both
 * directions: a bar alone on a divider — a perfectly ordinary way to say "this
 * whole column is stuck" — was flagged, while nothing in the sentence pointed at
 * the position that actually decides the verdict. The carrier condition is gone
 * entirely, with the second message that existed only to tell the two halves
 * apart. One condition, one sentence.
 *
 * ## "Astride", as geometry
 *
 * The engine takes the bar's own horizontal EXTENT and asks whether it
 * intersects the transition band — the divider widened by the map's declared
 * `transitionBandWidth` (see {@link AttachmentDef.boundaryAxis}). That single
 * overlap test says both halves of "superimposed on the axis": a bar wide enough
 * to cover the divider genuinely has the line running through it, and a bar too
 * thin to cover anything (the toolbox draws it eight units wide) is accepted
 * inside the band the map itself declares around the frontier — Wardley's zone
 * of punctuated equilibrium, where inertia lives.
 *
 * Measured on the extent rather than on the centre because "superimposed on the
 * line" is a statement about ink; measured against a band declared as a RATIO of
 * the plot because the same gesture must get the same verdict on a map somebody
 * resized (the lesson of the 01/08/2026 recette).
 */
const inertiaOffTransition: ValidationRule = {
  id: 'wardley.inertia-off-transition',
  framework: 'wardley',
  family: 'attachment',
  severity: 'warning',
  appliesTo: WARDLEY_ROLE.inertia,
  roles: WARDLEY_ROLES,
  // ONE sentence, because there is now one condition. The key is the rule's own
  // id: the two keys it replaces named halves of a rule that no longer has any.
  messageKey: 'com.labre.wardley.validation.inertia-off-transition',
  messageFallback:
    'This inertia bar sits inside a phase, not astride a phase transition.',
  suggestionKey:
    'com.labre.wardley.validation.inertia-off-transition.suggestion',
  suggestionFallback:
    'Inertia bites at a frontier — slide the bar sideways until it sits astride the dashed line between two evolution phases.',
  // 3: the carrier condition is gone and the position is judged on the bar's
  // extent — a different verdict on the same map, so a new version.
  version: 3,
  backgroundRole: WARDLEY_ROLE.map,
  background: WARDLEY_BACKGROUND,
  attachment: {
    boundaryAxis: 'evolution',
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
 *
 * ## Calibration (PO acceptance, 01/08/2026)
 *
 * Shipped, the rule was noisy in two ways the corpus could not see, because its
 * fixtures were boxes rather than words:
 *
 * 1. a link crossing the EMPTY MARGIN of a label raised label/link. A label is
 *    created 120–200 units wide whatever it says, so a short name left-aligned
 *    in one leaves most of its box blank. Fixed where the mistake was: the
 *    label role is `kind: 'text'`, so the engine measures the ink and not the
 *    box (`textInkBound`).
 * 2. two labels whose WORDS are nowhere near each other raised label/label,
 *    for the same reason and with the same fix.
 *
 * `minPenetration` is what remains: not every touch is a collision. **4 model
 * units** — under a quarter of the 18-unit node, a sixth of the 26-unit label
 * line, and about the width of a dependency's own stroke. A link grazing the
 * top of a name and two names whose last and first letter share a hair are
 * silent; a link through the middle of a name scores half its line height (13)
 * and a name written across a node scores the height of the letters, so both
 * are still reported with room to spare.
 *
 * It also absorbs the declared imprecision of the width approximation, which is
 * on the same scale — measured against the real renderer over 28 names, the
 * engine's per-character table reads between 11 % narrow and dead on, never
 * wide — and points the same way, towards silence.
 *
 * IN RESERVE, if label/link is still noisy after this (PO, 01/08/2026): an
 * ANGLE criterion — only a link crossing a name roughly PERPENDICULARLY strikes
 * it out, one running along it at a shallow angle mostly runs beside it. It
 * would be declared here as data, exactly like the threshold, and evaluated by
 * the family. Not built: nobody has yet seen the noise it would remove.
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
  // 2: measured on the ink of a label rather than on its creation box, and
  // calibrated with a penetration threshold — the same mistakes, fewer of the
  // things that were never mistakes.
  version: 2,
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
  // How deep a collision has to be before it is one. See the header.
  minPenetration: 4,
};

/**
 * **W4** — a provider may not be positioned higher than its consumer.
 *
 * The value chain is the whole grammar of the map: the user sits at the top,
 * each component rests on the components below it, and value flows back up. A
 * dependency drawn from a component to something ABOVE it says the opposite of
 * what the map means — either the link was drawn the wrong way round, or one of
 * the two nodes is in the wrong place.
 *
 * ## The rule this one could not have been before `docs/adr/0010`
 *
 * W4 reads the persisted `source → target` pair of the edge, and that pair only
 * became a STATEMENT the day the three mechanisms of that ADR landed: the link
 * tool announces which way to drag (M1), a typed edge shows its orientation on
 * hover and selection (M2), and the user can reverse it in one gesture (M3).
 * Before them the direction was a by-product of which end the finger landed on
 * first, and a rule on top of it would have spent the validation platform's
 * credibility on its first false positive.
 *
 * The alternative — deriving the direction from the y coordinates — is not a
 * cheaper W4, it is no W4 at all: the rule would compare the layout against
 * itself and could never fire.
 *
 * ## The violation IS the affordance
 *
 * Nothing normalises the direction at creation, deliberately. An edge drawn
 * upside-down raises this finding on the spot, and the user resolves it their
 * way: drag the node, or reverse the relation. Either resolution is theirs.
 *
 * ## Tolerance
 *
 * 2% of the map's height, as a ratio and never as a number of units (the lesson
 * of the 01/08/2026 recette, already learned by the equilibrium zone). Two
 * components drawn level are not a mistake — a chain gets lined up before it
 * gets spread out — so the rule only speaks when one is genuinely under the
 * other. On the 900-high reference map that is 18 units, about the diameter of
 * a component node.
 */
const providerAboveConsumer: ValidationRule = {
  id: 'wardley.provider-above-consumer',
  framework: 'wardley',
  family: 'relative-order-along-axis',
  severity: 'warning',
  // No `appliesTo`: the subject of this rule is a RELATION, and the role that
  // names it is declared where the family reads it — naming one of the three
  // indicted elements here would be data that lies.
  roles: WARDLEY_ROLES,
  messageKey: 'com.labre.wardley.validation.provider-above-consumer',
  messageFallback:
    'This component sits above the one that depends on it.',
  suggestionKey:
    'com.labre.wardley.validation.provider-above-consumer.suggestion',
  suggestionFallback:
    'Needs run downwards on a Wardley map: move the provider below its consumer — or, if the link was drawn the wrong way round, reverse it.',
  version: 1,
  backgroundRole: WARDLEY_ROLE.map,
  background: WARDLEY_BACKGROUND,
  relativeOrder: {
    edgeRole: WARDLEY_ROLE.dependency,
    axis: 'value-chain',
    // Tier 2 of ADR 0010: the verb of `wardley:dependency` is "depends on", so
    // its source is the CONSUMER and sits higher on the visibility axis.
    expect: 'source-ahead',
    toleranceRatio: 0.02,
  },
};

export const WARDLEY_RULES: readonly ValidationRule[] = [
  changeArrowAgainstEvolution,
  inertiaOffTransition,
  overlappingArtefacts,
  providerAboveConsumer,
];
