import type { ValidationProfile } from '@labre/affine-block-surface';

/**
 * C4 validation profiles.
 *
 * DATA owned by the framework, like its rules and its roles. A profile is
 * chosen per FRAME — the board, and the boundary, which are the two elements
 * this framework's rules measure against — and the choice rides on the element
 * itself, so two diagrams at two levels of requirement coexist on one canvas:
 * the board somebody is still sketching stays a sketch while the one that is
 * being handed over is held to the checklist.
 *
 * Registered from the flag-gated `C4ViewExtension`, beside the rules:
 * switching the `c4` flag off takes the choice away with the rest of the
 * tooling, and a board already set to `strict` simply stops being checked until
 * it comes back — the id stays written, untouched.
 *
 * ## Both tables spell out all THIRTEEN ids
 *
 * Every severity a user can get is either the one its rule declares or one of
 * these lines — nothing is raised implicitly (PF9.4). Spelling them all out is
 * what makes the level READABLE: a reviewer asking what `c4.strict` actually
 * requires reads thirteen lines here instead of one file per rule, and a rule
 * shipped later cannot join a level in silence.
 */

/**
 * Sketch: every rule at `audit`. Findings still reach `violations$` — a host
 * panel, a check-up and a conformance report see them — and the canvas says
 * nothing.
 *
 * The DEFAULT, and deliberately so (PRD principle 3), and more deliberately
 * here than anywhere else in the library: a C4 diagram is drawn from the
 * outside in. The boxes go down, then the arrows, then the words, and for the
 * whole of that every element is isolated, every arrow is unlabelled, every box
 * is unnamed and half the links are still plain connectors somebody
 * quick-dragged. A tool arguing with that hand is a tool switched off within
 * the hour, and it would be arguing about a diagram the author already knows is
 * unfinished.
 *
 * The sketch PRIMES: the findings are computed, collected and available the
 * moment the author asks — through the panel, through a check-up, through the
 * profile switch — so nothing has to be re-derived when they decide the drawing
 * is a deliverable. Being the default also means it WRITES NOTHING: a board on
 * `sketch` carries no profile key, so every C4 diagram ever drawn is on it,
 * with no migration and no backfill.
 */
const sketch: ValidationProfile = {
  id: 'c4.sketch',
  framework: 'c4',
  labelKey: 'com.labre.c4.profile.sketch',
  fallback: 'Sketch',
  isDefault: true,
  rules: {
    'c4.unlabeled-relationship': 'audit',
    'c4.unnamed-person': 'audit',
    'c4.unnamed-system': 'audit',
    'c4.unnamed-container': 'audit',
    'c4.unnamed-component': 'audit',
    'c4.untyped-link': 'audit',
    'c4.relationship-endpoints': 'audit',
    'c4.isolated-system': 'audit',
    'c4.isolated-container': 'audit',
    'c4.isolated-component': 'audit',
    'c4.database-initiates': 'audit',
    'c4.homeless-component': 'audit',
    'c4.person-in-boundary': 'audit',
  },
};

/**
 * Strict: the diagram is a DELIVERABLE, and it is held to the review checklist.
 *
 * The level somebody chooses when a diagram stops being a thinking aid and
 * becomes something another team will be handed. Eight rules move to `warning`
 * — and they are exactly the eight that read a question from the checklist
 * itself (c4model.com): is every element named, is every relationship labelled,
 * is every arrow one the model can state, does every component sit in the
 * container it belongs to.
 *
 * ## The five that do NOT move, and why the table spells them out
 *
 * `c4.isolated-system`, `c4.isolated-container`, `c4.isolated-component`,
 * `c4.database-initiates` and `c4.person-in-boundary` stay `audit` here too.
 *
 * The three isolation rules report a diagram that is UNFINISHED rather than
 * wrong: an element with no arrow on it is a box whose author has not got to
 * the arrows yet, and "not done" is what a panel is for. Promoting them would
 * put a bracket on every box for the first minutes of every drawing, at the one
 * level where the user has explicitly said the drawing matters.
 *
 * The other two are OURS rather than the checklist's — idioms of the notation,
 * not requirements of it. A store with a change feed really does push, and a
 * person really can be drawn inside a boundary by somebody making a point about
 * an operator embedded in a process. Both are worth remarking on and neither is
 * something the tool should claim is a mistake, at any level.
 *
 * ## Nothing is `blocking-overridable`, and nothing ever will be here
 *
 * Nothing in this library implements refusal — no gesture is declined anywhere
 * — so declaring the level would be data claiming an effect that does not exist
 * (the `wardley/rules.ts:30` promise, kept). Unlike BPMN, C4 has no rule that
 * would move there the day refusal lands: a review checklist is a set of
 * questions asked of a finished drawing, not a grammar that can refuse a
 * gesture while it is being made.
 */
const strict: ValidationProfile = {
  id: 'c4.strict',
  framework: 'c4',
  labelKey: 'com.labre.c4.profile.strict',
  fallback: 'Review checklist',
  rules: {
    'c4.unlabeled-relationship': 'warning',
    'c4.unnamed-person': 'warning',
    'c4.unnamed-system': 'warning',
    'c4.unnamed-container': 'warning',
    'c4.unnamed-component': 'warning',
    'c4.untyped-link': 'warning',
    'c4.relationship-endpoints': 'warning',
    'c4.homeless-component': 'warning',
    // The five that do not move — see the header.
    'c4.isolated-system': 'audit',
    'c4.isolated-container': 'audit',
    'c4.isolated-component': 'audit',
    'c4.database-initiates': 'audit',
    'c4.person-in-boundary': 'audit',
  },
};

export const C4_PROFILES: readonly ValidationProfile[] = [sketch, strict];
