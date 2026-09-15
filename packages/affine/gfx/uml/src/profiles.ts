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
 * ## Both tables spell out all FORTY-TWO ids
 *
 * Every severity a user can get is either the one its rule declares or one of
 * these lines — nothing is raised implicitly (PF9.4). Spelling them all out is
 * what makes the level READABLE: a reviewer asking what `uml.strict` requires
 * reads twenty-nine lines here instead of one file per rule, and a rule shipped
 * later cannot join a level in silence.
 *
 * That is also what the later phases cost: three rules arrived with the
 * structural sheets, fifteen more with the behaviour ones and four with the
 * sequence one, and every one had to be placed by
 * hand in BOTH tables. A profile is an override
 * table and an absent rule keeps its own severity, so a rule forgotten here
 * would still work — it would simply never harden, and nobody would see the
 * difference until a user asked why `uml.strict` was quiet about a `«deploy»`
 * drawn from a component. `profiles.unit.spec.ts` asserts totality for exactly
 * that reason.
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
    // The four SPELLING rules — the `label-syntax` family (ADR 0021).
    'uml.attribute-syntax': 'audit',
    'uml.operation-syntax': 'audit',
    'uml.transition-syntax': 'audit',
    'uml.multiplicity-syntax': 'audit',
    'uml.generalization-endpoints': 'audit',
    'uml.generalization-self-loop': 'audit',
    'uml.realization-endpoints': 'audit',
    'uml.dependency-on-object': 'audit',
    'uml.include-endpoints': 'audit',
    'uml.extend-endpoints': 'audit',
    'uml.actor-actor-association': 'audit',
    'uml.deploy-endpoints': 'audit',
    'uml.manifest-endpoints': 'audit',
    'uml.communication-path-endpoints': 'audit',
    'uml.untyped-edge': 'audit',
    'uml.composition-single-owner': 'audit',
    'uml.use-case-no-actor': 'audit',
    // The behaviour sheets — fifteen more, and every one of them here too.
    'uml.node-in-partition': 'audit',
    'uml.shallow-history-outside-region': 'audit',
    'uml.deep-history-outside-region': 'audit',
    'uml.initial-single': 'audit',
    'uml.initial-no-incoming-flow': 'audit',
    'uml.initial-no-incoming-transition': 'audit',
    'uml.activity-final-no-outgoing': 'audit',
    'uml.flow-final-no-outgoing': 'audit',
    'uml.final-state-no-outgoing': 'audit',
    'uml.decision-incoming-count': 'audit',
    'uml.control-flow-endpoints': 'audit',
    'uml.object-flow-endpoints': 'audit',
    'uml.transition-endpoints': 'audit',
    'uml.unreachable-action': 'audit',
    'uml.unreachable-state': 'audit',
    // The sequence sheet — four, which is every requirement of Clause 17 this
    // library has a family for (`rules.ts` names the four it does not): what a
    // message runs between, what its label says, and the two questions a
    // lifeline's own head is asked.
    'uml.message-endpoints': 'audit',
    'uml.message-syntax': 'audit',
    'uml.unnamed-lifeline': 'audit',
    'uml.lifeline-ident-syntax': 'audit',
  },
};

/**
 * Strict: the diagram is a DELIVERABLE, and it is held to the specification.
 *
 * The level somebody chooses when a diagram stops being a thinking aid and
 * becomes something another team — or a generator, or an XMI importer — will be
 * handed. TWENTY-NINE rules move to `warning`, and the test each one passes is
 * the test this library always applies: whether the diagram might honestly have
 * meant it.
 *
 * Nine restate a normative clause and cannot be meant. §9.9.7 makes a
 * generalization's ends the same kind and its hierarchy acyclic; §10.4.3 types a
 * realization's far end as an interface; §18.1.3 types both ends of an include
 * and of an extend; §19.2.3 puts an artefact and only an artefact on a node,
 * §19.3.3 runs a manifestation from the artefact to what it embodies, and
 * §19.4.3 joins two DeploymentTargets and nothing else with a communication
 * path. A drawing contradicting one of those is a drawing whose author will
 * change it the moment they see it.
 *
 * The three structural grammars are promoted for a second reason the class-side
 * five do not have: they are what the XMI writer READS. A `«deploy»` drawn from
 * a component produces no `deployment` element at all — the writer has no
 * artefact to name as `deployedArtifact` — so the finding is also the warning
 * that this diagram will export short.
 *
 * Three are the NAMING rules. An emptied name compartment is not a style
 * preference at the level where somebody has said the sheet is finished: a class
 * with no name is a class nothing in the model can refer to, and the export
 * writes it as nothing at all.
 *
 * Six are the SPELLING rules (ADR 0021), and they are the only promotions in
 * this table the EXPORTER corroborates. Each fires exactly when `grammar.ts`
 * lost something the author wrote — a `:` with no type, an operation with no
 * parameter list, a bound the file cannot hold — so the finding is also the
 * warning that this line will leave the sheet less structured than it was drawn.
 * "The file will not say what the picture says" is not a style preference at the
 * level where somebody has called the diagram a deliverable.
 *
 * One is §11.5.3's arithmetic — two composites claiming one part is a drawing
 * that cannot be built — and one is the SHEET's own declaration: a frame whose
 * heading says `uc` and whose ink is classes is a contradiction inside one
 * document, and the author has already spoken, which makes it the easiest
 * promotion in the table.
 *
 * ## The thirteen that do NOT move, and why the table spells them out
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
    // The five normative grammars of phase 1…
    'uml.generalization-endpoints': 'warning',
    'uml.generalization-self-loop': 'warning',
    'uml.realization-endpoints': 'warning',
    'uml.include-endpoints': 'warning',
    'uml.extend-endpoints': 'warning',
    // …and the three phase 2 added, on the same test.
    'uml.deploy-endpoints': 'warning',
    'uml.manifest-endpoints': 'warning',
    'uml.communication-path-endpoints': 'warning',
    // The two naming rules.
    'uml.unnamed-classifier': 'warning',
    'uml.unnamed-actor-or-use-case': 'warning',
    // ...and the four SPELLING rules, which are the easiest promotions in the
    // table and the only ones the EXPORTER can corroborate: each fires exactly
    // when `grammar.ts` lost something the author wrote, so the finding is also
    // the warning that this line will leave the sheet less structured than it
    // was drawn. At the level where somebody has said the diagram is a
    // deliverable, "the file will not say what the picture says" is not a style
    // preference (ADR 0021).
    'uml.attribute-syntax': 'warning',
    'uml.operation-syntax': 'warning',
    'uml.transition-syntax': 'warning',
    'uml.multiplicity-syntax': 'warning',
    // §11.5.3's arithmetic, and the sheet's own declaration.
    'uml.composition-single-owner': 'warning',
    'uml.not-admissible-on-kind': 'warning',
    // The behaviour sheets' ARITHMETIC — the clauses a drawing cannot mean.
    // §15.3.3 gives an initial node no incoming edge, §15.7.19.4 gives a final
    // node no outgoing one, §14.5.11.4 says the same of a final state, and
    // §15.7.11.4 caps a decision at two incoming edges. Each of these describes
    // a drawing that cannot execute, which is the same test the class-side
    // promotions pass.
    'uml.initial-no-incoming-flow': 'warning',
    'uml.initial-no-incoming-transition': 'warning',
    'uml.activity-final-no-outgoing': 'warning',
    'uml.flow-final-no-outgoing': 'warning',
    'uml.final-state-no-outgoing': 'warning',
    'uml.decision-incoming-count': 'warning',
    // …their two GRAMMARS, on the same test as every other endpoint rule.
    'uml.control-flow-endpoints': 'warning',
    'uml.transition-endpoints': 'warning',
    // …and the count of beginnings, which is `recommendation` and promoted
    // anyway: a second filled disc is legal in an activity and forbidden in a
    // state machine region, and at the level where somebody has said the sheet
    // is finished the reader is entitled to be asked which of the two this is.
    'uml.initial-single': 'warning',
    // The SEQUENCE sheet's four, and all four of them move — the two about a
    // message first.
    //
    // `uml.message-endpoints` is an endpoint grammar and passes the test every
    // other one in this table passes: §17.4.4 says a delete message "must end in
    // a DestructionOccurrenceSpecification", and a message drawn between a
    // participant and a class is a sentence an interaction cannot mean.
    // `uml.message-syntax` is the fifth SPELLING rule and is promoted for the
    // reason the other four are — it fires exactly when `grammar.ts` lost
    // something the author wrote, so the finding is also the warning that the
    // exported file will say less than the picture does.
    'uml.message-endpoints': 'warning',
    'uml.message-syntax': 'warning',
    // …and the lifeline's own two, on the same two tests. `uml.unnamed-lifeline`
    // is the third NAMING rule and moves with the other two: a participant with
    // no name makes every arrow on the sheet a sentence with a hole in it, and
    // at the level where somebody has said the diagram is a deliverable that is
    // not a matter of taste. `uml.lifeline-ident-syntax` is the sixth SPELLING
    // rule and moves for the reason all five others do — it fires exactly when
    // `checkLifelineIdent` lost something the author wrote, which is to say when
    // the exported participant will carry a name the picture does not show.
    'uml.unnamed-lifeline': 'warning',
    'uml.lifeline-ident-syntax': 'warning',
    // The seven that do not move — see the header.
    'uml.element-outside-frame': 'audit',
    'uml.use-case-outside-subject': 'audit',
    'uml.actor-inside-subject': 'audit',
    'uml.dependency-on-object': 'audit',
    'uml.actor-actor-association': 'audit',
    'uml.untyped-edge': 'audit',
    'uml.use-case-no-actor': 'audit',
    // …and the six the behaviour sheets add to that list.
    //
    // `uml.object-flow-endpoints` is the ONE endpoint rule this level leaves
    // alone, and the reason is §15.4.4: an action's pins may be elided, a pin IS
    // an ObjectNode, and the action-to-action drawing is therefore a legal
    // shorthand of a conformant model rather than a defect. This canvas has no
    // pin to draw, so promoting it would harden a remark the author cannot act
    // on.
    'uml.object-flow-endpoints': 'audit',
    // The three MEMBERSHIP rules, for the reason the class-side three stay
    // here: where a glyph sits on the canvas is a drawing decision, and each has
    // a reading under which the author is right — an action parked between two
    // lanes while the lanes are being redrawn, a history placed beside the
    // composite state it belongs to because the box is too small.
    'uml.node-in-partition': 'audit',
    'uml.shallow-history-outside-region': 'audit',
    'uml.deep-history-outside-region': 'audit',
    // The two graph walks. "Nothing reaches this" is true of most of a diagram
    // for most of the time it is being drawn, and it is already `on-demand` for
    // that reason (`rules.ts`) — a level of requirement that hardened it would
    // be hardening a question somebody has to ASK before it is answered.
    'uml.unreachable-action': 'audit',
    'uml.unreachable-state': 'audit',
  },
};

export const UML_PROFILES: readonly ValidationProfile[] = [sketch, strict];
