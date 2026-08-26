import type { ValidationProfile } from '@labre/affine-block-surface';

/**
 * Event Storming validation profiles (WS5).
 *
 * DATA owned by the framework, like its rules and its roles. A profile is
 * chosen per BOARD, not per document, and the choice rides on the board element
 * itself — a Big Picture and a Process-modelling board coexist on one canvas at
 * two levels of requirement, which is precisely how the workshop goes.
 *
 * ## Three, and why three (PO arbitration, 26/08/2026)
 *
 * Every other framework in this library ships two. Event Storming gets three
 * because it is not one activity, it is a SEQUENCE of them, and the same wall
 * means different things at each stage:
 *
 * 1. **Big Picture (Sketch)** — everything on the wall at once, out of order,
 *    the grammar not yet decided. The linter must be silent;
 * 2. **Process modelling** — the frieze gets read left to right and reordered.
 *    Time starts to mean something; the grammar still does not;
 * 3. **Software design** — the sentences are supposed to be sentences.
 *
 * Two profiles would have forced stage 2 to pick a side: either the timeline
 * goes unchecked through the very session that is about ordering it, or the
 * grammar starts firing at a wall that has not been cleaned up yet. The middle
 * profile exists because the middle stage exists.
 *
 * Registered from the flag-gated `DddEventStormingViewExtension`, beside the
 * rules: switching the flag off takes the choice away with the rest of the
 * tooling, and a board already set to `design` simply stops being checked until
 * it comes back — the id stays written, untouched.
 */

/**
 * Sketch — the Big Picture. Every rule demoted to `audit`: findings still reach
 * `violations$` for a host panel and a conformance report, and the canvas says
 * nothing.
 *
 * Named **"Big Picture (Sketch)"** in the dropdown, both words on purpose (PO
 * recette, 26/08/2026). "Sketch" is the vocabulary every framework in this
 * library shares for its quietest level, and it is the word the recette script
 * uses; "Big Picture" is the word the workshop uses for this stage and the only
 * one a facilitator would look for. Carrying both is what lets the two readings
 * meet on one entry instead of the user having to learn which name this
 * framework chose.
 *
 * The DEFAULT, and more deliberately here than anywhere else in the library. A
 * Big Picture is **supposed to be chaotic**: that is the method, not a failure
 * of it. Events go up out of order because remembering is not sorting, arcs get
 * drawn between things nobody has typed yet, and stickies get stacked three
 * deep while a stack is what somebody means. A tool arguing with that hand is
 * not strict, it is wrong — it is judging a stage of the workshop by the
 * criteria of a later one.
 *
 * Being the default also means it WRITES NOTHING: a board on `sketch` carries no
 * profile key, so every board ever stormed is on it, with no migration and no
 * backfill.
 */
const sketch: ValidationProfile = {
  id: 'es.sketch',
  framework: 'ddd-event-storming',
  labelKey: 'com.labre.event-storming.profile.sketch',
  fallback: 'Big Picture (Sketch)',
  isDefault: true,
  rules: {
    'es.against-timeline': 'audit',
    'es.forbidden-arc': 'audit',
    'es.overlapping-stickies': 'audit',
  },
};

/**
 * Process — the frieze is being read left to right and reordered.
 *
 * The timeline is the ONLY thing promoted, because ordering the frieze is
 * exactly what this stage is for: an arc running backwards is now the finding
 * the session is looking for, and the tool pointing at it is the tool helping.
 *
 * The grammar stays at `audit`, on purpose. The wall is still full of stickies
 * whose kind nobody has settled — an event that is going to turn out to be a
 * command, a read model somebody drew as an aggregate — and firing
 * `forbidden-arc` at that is arguing about a sentence whose words are still
 * being chosen. Overlaps stay quiet for the same reason: things are being
 * MOVED, and everything overlaps while it is being moved.
 */
const process: ValidationProfile = {
  id: 'es.process',
  framework: 'ddd-event-storming',
  labelKey: 'com.labre.event-storming.profile.process',
  fallback: 'Process modelling',
  rules: {
    'es.against-timeline': 'warning',
    'es.forbidden-arc': 'audit',
    'es.overlapping-stickies': 'audit',
  },
};

/**
 * Design — the deliverable level: a board that leaves the room and is read by
 * somebody who was not in it.
 *
 * All three at `warning`. By this stage every sticky has a kind, every arc is a
 * claim about the model, and a frieze nobody can read is a frieze that will be
 * misread. Every severity is spelled out rather than left absent, so the answer
 * is readable in one place.
 *
 * Nothing here is `blocking-overridable`: nothing in this library implements
 * refusal, and declaring it would be data claiming an effect that does not
 * exist.
 */
const design: ValidationProfile = {
  id: 'es.design',
  framework: 'ddd-event-storming',
  labelKey: 'com.labre.event-storming.profile.design',
  fallback: 'Software design',
  rules: {
    'es.against-timeline': 'warning',
    'es.forbidden-arc': 'warning',
    'es.overlapping-stickies': 'warning',
  },
};

export const EVENT_STORMING_PROFILES: readonly ValidationProfile[] = [
  sketch,
  process,
  design,
];
