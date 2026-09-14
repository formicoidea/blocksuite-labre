import type { ValidationProfile } from '@labre/affine-block-surface';

/**
 * UML validation profiles.
 *
 * DATA owned by the framework, like its rules and its roles. A profile is chosen
 * per FRAME, and for UML that means the DIAGRAM frame alone: the subject carries
 * no picker (`toolbar/config.ts` records the arbitration — one sheet, one level
 * of requirement, one place to set it) and inherits the sheet's choice through
 * the engine's `inheritChosenProfiles`, so the two subject-anchored rules harden
 * with the rest.
 *
 * Registered from the flag-gated `UmlViewExtension`, beside the rules: switching
 * the `uml` flag off takes the choice away with the rest of the tooling, and a
 * frame already set to `strict` simply stops being checked until it comes back —
 * the id stays written, untouched.
 *
 * ## Both tables spell out all SIXTEEN ids
 *
 * Every severity a user can get is either the one its rule declares or one of
 * these lines — nothing is raised implicitly (PF9.4). Spelling them all out is
 * what makes the level READABLE: a reviewer asking what `uml.strict` requires
 * reads sixteen lines here instead of one file per rule, and a rule shipped later
 * cannot join a level in silence.
 */

/**
 * Sketch: every rule at `audit`. Findings still reach `violations$` — a host
 * panel, a check-up and a conformance report see them — and the canvas says
 * nothing.
 *
 * The DEFAULT, and deliberately so (PRD principle 3). A UML class diagram is
 * drawn boxes-first: eight rectangles go down, then the lines between them, then
 * the compartments get filled, and for the whole of that the sheet contradicts
 * half the pack — every name is the stencil's own prompt, half the lines are
 * quick-connected wires carrying no role, and the use cases have no actors yet.
 * A tool arguing with that hand is a tool switched off within the hour, and it
 * would be arguing about a diagram whose author already knows it is unfinished.
 *
 * The sketch PRIMES: the findings are computed, collected and available the
 * moment the author asks — through the panel, through a check-up, through the
 * profile switch — so nothing has to be re-derived when they decide the drawing
 * is a deliverable. Being the default also means it WRITES NOTHING: a frame on
 * `sketch` carries no profile key, so every UML diagram ever drawn is on it, with
 * no migration and no backfill.
 */
const sketch: ValidationProfile = {
  id: 'uml.sketch',
  framework: 'uml',
  labelKey: 'com.labre.uml.profile.sketch',
  fallback: 'Sketch',
  isDefault: true,
  rules: {
    'uml.element-outside-frame': 'audit',
    'uml.not-admissible-on-kind': 'audit',
    'uml.use-case-outside-subject': 'audit',
    'uml.actor-inside-subject': 'audit',
    'uml.unnamed-classifier': 'audit',
    'uml.unnamed-actor-or-use-case': 'audit',
    'uml.generalization-endpoints': 'audit',
    'uml.generalization-self-loop': 'audit',
    'uml.realization-endpoints': 'audit',
    'uml.dependency-on-object': 'audit',
    'uml.include-endpoints': 'audit',
    'uml.extend-endpoints': 'audit',
    'uml.actor-actor-association': 'audit',
    'uml.untyped-edge': 'audit',
    'uml.composition-single-owner': 'audit',
    'uml.use-case-no-actor': 'audit',
  },
};

/**
 * Strict: the diagram is a DELIVERABLE, and it is held to the specification.
 *
 * The level somebody chooses when a diagram stops being a thinking aid and
 * becomes something another team — or a generator, or an XMI importer — will be
 * handed. NINE rules move to `warning`, and the test each one passes is the test
 * this library always applies: whether the diagram might honestly have meant it.
 *
 * Five restate a normative clause and cannot be meant. §9.9.7 makes a
 * generalization's ends the same kind and its hierarchy acyclic; §10.4.3 types a
 * realization's far end as an interface; §18.1.3 types both ends of an include
 * and of an extend. A drawing contradicting one of those is a drawing whose
 * author will change it the moment they see it.
 *
 * Two are the NAMING rules. An emptied name compartment is not a style
 * preference at the level where somebody has said the sheet is finished: a class
 * with no name is a class nothing in the model can refer to, and the export
 * writes it as nothing at all.
 *
 * One is §11.5.3's arithmetic — two composites claiming one part is a drawing
 * that cannot be built — and one is the SHEET's own declaration: a frame whose
 * heading says `uc` and whose ink is classes is a contradiction inside one
 * document, and the author has already spoken, which makes it the easiest
 * promotion in the table.
 *
 * ## The seven that do NOT move, and why the table spells them out
 *
 * `uml.element-outside-frame`, `uml.use-case-outside-subject`,
 * `uml.actor-inside-subject`, `uml.dependency-on-object`,
 * `uml.actor-actor-association`, `uml.untyped-edge` and `uml.use-case-no-actor`
 * stay `audit` at both levels.
 *
 * Three are MEMBERSHIP: where a box sits on the canvas is a drawing decision, and
 * each has a reading under which the author is right — a class parked beside the
 * frame while its sheet is being rearranged, an actor drawn inside a subject by
 * somebody making a point about an operator embedded in the system, a use case
 * deliberately left outside the boundary while the boundary is still being
 * argued about. Requiring the membership to be DRAWN is ours rather than the
 * notation's, and a house reading with a second reading does not bite.
 *
 * `uml.use-case-no-actor` reports work that is not finished, which is what a
 * panel is for, and it has legitimate exceptions the pack cannot see (a use case
 * reached only through an include). `uml.dependency-on-object` and
 * `uml.actor-actor-association` are grammar and would be defensible promotions —
 * they are held back because each is the kind of line an author may knowingly
 * draw to say something the notation has no glyph for, and because a level of
 * requirement that promotes everything is a level nobody chooses twice.
 * `uml.untyped-edge` is OURS and is the one a later slice is most likely to
 * revisit: a role-less connector has no second reading, and the only thing
 * keeping it here is that quick-connect is a gesture of this canvas rather than a
 * mistake in the notation.
 *
 * Provenance and SEVERITY are orthogonal, and this table is where that shows:
 * `uml.dependency-on-object` cites the specification and stays a remark, while
 * the two naming rules are `recommendation` and are promoted.
 *
 * ## Nothing is `blocking-overridable`
 *
 * Nothing in this library implements refusal — no gesture is declined anywhere —
 * so declaring the level would be data claiming an effect that does not exist
 * (the `wardley/rules.ts:30` promise, kept). UML is the pack with the best claim
 * to one the day refusal lands: §9.9.7 and §11.5.3 describe drawings that cannot
 * be built, not drawings somebody may disagree with.
 */
const strict: ValidationProfile = {
  id: 'uml.strict',
  framework: 'uml',
  labelKey: 'com.labre.uml.profile.strict',
  fallback: 'Specification',
  rules: {
    // The five normative grammars.
    'uml.generalization-endpoints': 'warning',
    'uml.generalization-self-loop': 'warning',
    'uml.realization-endpoints': 'warning',
    'uml.include-endpoints': 'warning',
    'uml.extend-endpoints': 'warning',
    // The two naming rules.
    'uml.unnamed-classifier': 'warning',
    'uml.unnamed-actor-or-use-case': 'warning',
    // §11.5.3's arithmetic, and the sheet's own declaration.
    'uml.composition-single-owner': 'warning',
    'uml.not-admissible-on-kind': 'warning',
    // The seven that do not move — see the header.
    'uml.element-outside-frame': 'audit',
    'uml.use-case-outside-subject': 'audit',
    'uml.actor-inside-subject': 'audit',
    'uml.dependency-on-object': 'audit',
    'uml.actor-actor-association': 'audit',
    'uml.untyped-edge': 'audit',
    'uml.use-case-no-actor': 'audit',
  },
};

export const UML_PROFILES: readonly ValidationProfile[] = [sketch, strict];
