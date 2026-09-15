import type {
  EndpointTriplet,
  ValidationRule,
} from '@labre/affine-block-surface';
import type { RoleId } from '@labre/std/gfx';

import { UML_SUBJECT_FRAME } from './background.js';
import {
  checkEndLabelMultiplicity,
  checkLifelineIdent,
  checkMessageLabel,
  checkOperationLine,
  checkPropertyLine,
  checkTransitionLabel,
} from './grammar.js';
import { UML_ROLE, UML_ROLES } from './roles.js';

/**
 * UML validation rules — the notation's own grammar, as DATA.
 *
 * DATA owned by the framework and versioned per rule: the engine
 * (`@labre/affine-block-surface`) knows how to evaluate a FAMILY, never a
 * concrete rule, so adding a UML rule is adding an entry to the array at the
 * bottom of this file. Registered from the flag-gated `UmlViewExtension`, so
 * switching the `uml` flag off removes the rules with the rest of the tooling —
 * diagrams already drawn keep rendering, they simply stop being checked
 * (`docs/adr/0009`).
 *
 * ## Where the rules come from, which is unlike every pack before it
 *
 * UML has a SPECIFICATION. Where `c4/rules.ts` opens by explaining that its
 * authority is a review checklist because there is nothing else to cite, this
 * pack cites clauses: §9.9.7 says a generalization's two ends are of the same
 * kind, §10.4.3 types an interface realization's contract, §11.5.3 gives a part
 * at most one composite owner, §18.1.3 types the ends of an include and forbids
 * an association between two actors, §19.2.3 types a deployment's two ends and
 * §19.4.3 says a communication path joins two DeploymentTargets. The behaviour
 * sheets cite seven more, and they are the arithmetic ones: §15.3.3 gives an
 * initial node no incoming edge, §15.7.19.4 gives a final node no outgoing one,
 * §15.7.11.4 caps a decision at two incoming edges, §15.7.9.4 keeps an object
 * node off a control flow, §14.5.11.4 gives a final state no outgoing transition
 * and §14.5.12 types a transition's two ends. The four SPELLING rules cite four
 * more, and they are the only clauses in the pack quoted as productions rather
 * than as sentences: §9.5.4 (a Property), §9.6.4 (an Operation), §14.2.4.8 (a
 * transition label) and §7.5.4 (a multiplicity range). TWENTY-ONE rules
 * therefore declare `provenance.source: 'standard'` — the most in this library
 * by a distance — and they are the twenty-one a conformance report may present
 * as defects.
 *
 * The rest are `recommendation` (a reading of the notation the spec draws but
 * does not constrain: which artefacts belong on which KIND of sheet, whether an
 * artefact is named at all) or `labre-convention` (membership on this canvas, and
 * the role-less connector this whiteboard can produce and the notation never
 * anticipated). Each says so in its own citation, so a reader who opens the
 * bubble is never told UML forbids what UML does not.
 *
 * ## Severity: the CROQUIS primes, so everything is `audit`
 *
 * The same promise `wardley/rules.ts:30`, `bpmn/rules.ts` and `c4/rules.ts`
 * make. Every rule here is declared `audit` and the default profile —
 * `uml.sketch` — keeps it there. A class diagram is drawn boxes-first,
 * arrows-second, words-last, and for the whole of that the drawing contradicts
 * half this file. `uml.strict` is the level somebody chooses once the diagram is
 * a deliverable, and it promotes the twenty-five rules that restate the
 * specification
 * or the sheet's own declaration (`profiles.ts`).
 *
 * `blocking-overridable` appears nowhere: nothing downstream implements a
 * blocking level, so shipping the value would be data claiming an effect that
 * does not exist.
 *
 * ## The ALPHABET and the GRAMMAR are two different tables
 *
 * The lesson `c4/rules.ts` records at length, and UML needs it more, having nine
 * edge roles where C4 has one. `relation-endpoints` raises an off-matrix finding
 * for every rule declaring a matrix, so two rules sharing one grammar report the
 * same wrong sentence TWICE. Here the split is per EDGE ROLE: each grammar table
 * below is held by exactly one rule, and the one place two rules read the same
 * edge role — {@link untypedEdge} and {@link actorActorAssociation}, both on
 * `uml:association` — is the C4 arrangement exactly, the neutral rule carrying a
 * matrix so permissive that off-matrix is structurally unreachable for it.
 *
 * ## The ALPHABET is also how a rule gets something to SAY
 *
 * The other half of the same mechanism, and the one that shapes three tables
 * here. An end whose role is outside a rule's alphabet is not evaluated at all
 * — the family's hard proportionality requirement — so a rule whose only
 * sanctioned sentence is `use case → use case` has an alphabet of one role and
 * can NEVER fire: an include drawn from an actor is silently outside it. Data
 * that can never fire and never says why is the worst thing declarative data can
 * do.
 *
 * So {@link UML_USE_CASE_MATRIX} and {@link UML_GENERALIZATION_MATRIX} each
 * carry one or two triplets whose EDGE role is not the rule's own. They are true
 * sentences of the notation — an actor associates with a use case (§18.1.3), two
 * instances are joined by a link (§9.8.4) — and `inMatrix` tests the edge role
 * with `roleIsA`, so such a triplet can never sanction the edge the rule is
 * about. Their whole effect is to put `uml:actor` and `uml:object` into the
 * alphabet, which is what makes "an include with an actor at one end" and "a
 * generalization pointing at an instance" findings rather than silence.
 *
 * ## What the whole file stays silent about
 *
 * A diagram drawn before the roles existed carries no role on anything, so it is
 * never evaluated and never says a word (PRD principle 8). A sheet drawn with no
 * `uml:diagram` frame round it has no frame for the membership rules to be
 * about, and they are silent by construction — a croquis on bare canvas is a
 * croquis. A use case diagram with no SUBJECT drawn on it is the same silence one
 * frame in: {@link useCaseOutsideSubject} and {@link actorInsideSubject} both
 * need a subject to be inside or outside OF.
 *
 * ## Seven questions this pack deliberately does NOT ask
 *
 * Not gaps in the notation — gaps in what the engine's families can be asked of
 * a UML element. The first two are phase 1's; the next two are the structural
 * sheets', and they are the two rules that brief asked for and this file could
 * not honestly write. The last three are the behaviour sheets', and two of them
 * are the same shape: a rule the brief asked for that ALREADY EXISTS under
 * another name, and would have reported one mistake twice.
 *
 * - **an artefact of any kind drawn outside the frame.** `element-in-background`
 *   names ONE subject role, and UML's vocabulary has no single role meaning "any
 *   UML artefact": `uml:classifier` is the spec's own generalisation of a class,
 *   an interface and an enumeration (§9.2) and reaches nothing else, because an
 *   object is an instance and a package is a namespace — filing them under it
 *   would make every rule about classifiers fall on them. So
 *   {@link elementOutsideFrame} is written on the classifiers, which is what a
 *   class diagram is made of, and an object, a package, a note, an actor or a use
 *   case parked beside the sheet is silence. The same shape of limit C4 records
 *   for its empty-boundary rule, and it closes the day a family accepts several
 *   subject roles.
 * - **the MULTIPLICITY on an association end.** UML writes it at the ends, this
 *   canvas has one label per connector, and `docs/adr/0018` is the record of why
 *   phase 1 puts the words in the centre label. Until a connector carries per-end
 *   text there is nothing for a rule to read, and asking for a multiplicity in
 *   the middle of the line would be asking the author to write the notation
 *   wrongly so the tool could check it.
 * - **a PORT that sits on no component's border** (`uml.port-on-border`,
 *   §11.3.4). The family that sounds like the answer is `attachment`, and it
 *   asks a different question in both of its halves. Its `carrierRole` is
 *   required to be an **edge** role — "posed on" is measured as a distance to a
 *   PATH, and `evaluateAttachment` warns once and returns nothing for a `node`
 *   role — so a component, which is a box, can never be a carrier. And its
 *   `boundaryAxis` names a transition the FRAME declares
 *   (`FrameworkBackgroundDef.transitionBandWidth`, Wardley's evolution
 *   frontiers); a `uml:diagram` declares no axis, and the border of an ordinary
 *   element is not a frontier of the sheet. `element-in-background` cannot stand
 *   in either: it demands FULL containment, and a port that straddles its
 *   component's edge — which is §11.3.4's own preferred drawing — is by
 *   construction not contained. The question is "is this small square within a
 *   band of that box's outline", and no family expresses a band around an
 *   arbitrary element. Port ownership is therefore read by GEOMETRY in
 *   `model.ts`, where the two exporters need it, and left unjudged here.
 * - **a lollipop or socket attached to nothing** (`uml.interface-near-component`,
 *   §10.4.4, §11.6.4). The same limit, one glyph over: "the stub touches a
 *   component or a port" is an adjacency between two boxes, and `attachment`
 *   measures adjacency to a path. `no-overlap` is the only family that evaluates
 *   PAIRS and its polarity is the opposite one — it forbids a collision, it
 *   cannot require a proximity. So the adjacency is read in `model.ts` (a glyph
 *   within 24 units of a component's box names one of its interfaces) and no
 *   rule is written on it. Both close the day a family accepts a node carrier or
 *   a proximity requirement, and neither is worth a family invented for one
 *   framework.
 * - **an ACTION with no name** (`uml.unnamed-action`) and **a STATE with no
 *   name** (`uml.unnamed-state`). Both are already reported, and adding them
 *   would report them twice. `label-presence` reads an element's OWN words and
 *   names one subject role, so the subject of a naming rule is the TIER and
 *   never the shape it is grouped with — which is why
 *   {@link unnamedActorOrUseCase} is one rule for two artefacts and says so at
 *   length. An action, an object node and the three signal artefacts carry
 *   `uml:label`, so an emptied one is already that rule's finding; a state
 *   carries `uml:name`, so an emptied one is already {@link unnamedClassifier}'s.
 *   A second rule on either tier would put two brackets and two suggestions on
 *   one word to fix, one of which would always be about the wrong shape —
 *   exactly the failure the existing pair was collapsed to avoid.
 *
 *   What IS wrong is the wording: "This actor or use case has no name" is the
 *   sentence an author of an emptied action reads. The fix is a rename of the
 *   two existing rules to the tier they are actually about
 *   (`uml.unnamed-label`, `uml.unnamed-name`) with the words widened to match,
 *   which touches their ids, their message keys, both profiles and the host
 *   catalogues — a change worth making on its own rather than smuggled in
 *   beside fifteen new rules. Recorded here so it stays a decision.
 * - **one beginning per REGION** rather than per sheet. §14.5.6.4 bounds the
 *   initial vertex per Region and a state machine with three composite states
 *   legitimately draws four discs; `role-count` counts per instance of ONE
 *   frame, so {@link initialSingle} counts per `uml:diagram` and the per-region
 *   count is a second rule of the same family against `uml:region`. It is a
 *   phase-3 refinement rather than a limit of the engine — the family already
 *   expresses it — and until it lands the rule is `audit` in both profiles for
 *   that reason as much as for any other.
 *
 * ## Two things a HOST reading these findings has to know
 *
 * Both came out of the tranche-F recette, both are engine behaviour rather than
 * anything this file declares, and both make a check-up look wrong to somebody
 * who does not know them.
 *
 * - **a membership finding is attributed to the LANE, not to the sheet.**
 *   `uml.node-in-partition` and the `*-history-outside-region` pair are
 *   `element-in-background` rules whose SUBJECT is the band or the composite
 *   state — that is what "inside" is measured against — so the finding is filed
 *   under the `uml:partition` or the `uml:region` it is about. A check-up run on
 *   the FRAME alone therefore shows none of them, and a host that offers "check
 *   this diagram" by selecting the `umlDiagram` has to include the backgrounds
 *   drawn on it, or it will report a clean sheet over an action drawn between
 *   two lanes.
 * - **a strict profile MOVES a finding, it does not add one.** Promoting a rule
 *   past `audit` takes it out of the check-up's own list and into the live
 *   `violations$` path, by the engine's design. So switching `uml.sketch` for
 *   `uml.strict` makes a check-up report FEWER rows, not more, and the rows that
 *   left are the ones now drawn on the canvas. A host presenting the two counts
 *   side by side has to say which is which.
 */

/* ── The alphabets and the grammars ─────────────────────────────────────── */

/**
 * Every UML role that is an ELEMENT of the model — the alphabet a role-less
 * connector is read against, and nothing more.
 *
 * `uml:classifier` stands for its three children by declaration, so the class,
 * the interface and the enumeration arrive through `roleIsA` rather than as
 * three entries. The two FRAMES are absent and meant to be: a connector dragged
 * onto the sheet or onto a subject is somebody pointing at something, and
 * pointing at things is what a whiteboard is for. The three TIER roles are
 * absent for the same reason — a line drawn onto an attributes compartment is an
 * annotation.
 *
 * ## Phase 2 appended six, and the two frames are still absent
 *
 * The component, its port, the two interface glyphs, the artefact and the node
 * (parent of the device and the execution environment) joined the day the
 * structural sheets did. They had to: a wiring gesture between two ports and a
 * quick-connect between two cubes are exactly the drawings §11.6.4 and §19.4.4
 * expect to be TYPED, and a role-less line between them says nothing to the
 * grammar, nothing to the degree counts and nothing to either exporter — which
 * is the whole subject of {@link untypedEdge}.
 */
const UML_ELEMENT_ROLES: readonly RoleId[] = [
  UML_ROLE.classifier,
  UML_ROLE.object,
  UML_ROLE.package,
  UML_ROLE.note,
  UML_ROLE.actor,
  UML_ROLE['use-case'],
  // Phase 2 — the structural vocabulary. `uml:node` stands for its two children.
  UML_ROLE.component,
  UML_ROLE.port,
  UML_ROLE['provided-interface'],
  UML_ROLE['required-interface'],
  UML_ROLE.artifact,
  UML_ROLE.node,
  // Phase 2 — the BEHAVIOUR vocabulary, and the same argument a third time: a
  // quick-connect between two actions, or between two states, is the drawing
  // §15.2.4 and §14.2.4 expect to be a control flow and a transition. A line
  // carrying no role between them says nothing to either grammar, nothing to the
  // degree counts, nothing to the two reachability walks and nothing to either
  // exporter. `uml:control-node` stands for its five children and
  // `uml:pseudostate` for its seven.
  UML_ROLE.action,
  UML_ROLE['control-node'],
  UML_ROLE['object-node'],
  UML_ROLE['send-signal'],
  UML_ROLE['accept-event'],
  UML_ROLE['time-event'],
  UML_ROLE.state,
  UML_ROLE['final-state'],
  UML_ROLE.pseudostate,
];

/**
 * Every ordered pair of the element roles — the ALPHABET, and not a grammar.
 *
 * This table sanctions all four hundred and forty-one sentences — twenty-one
 * element roles squared, since the behaviour vocabulary joined the alphabet —
 * so a rule holding it judges none of them. It exists so {@link untypedEdge}
 * can say "between two
 * UML artefacts" — which is the only thing `flagNeutral` reads a matrix FOR —
 * without inheriting a judgement that belongs to {@link actorActorAssociation}.
 */
export const UML_ELEMENT_MATRIX: readonly EndpointTriplet[] =
  UML_ELEMENT_ROLES.flatMap(source =>
    UML_ELEMENT_ROLES.map(target => ({
      source,
      edge: UML_ROLE.association,
      target,
    }))
  );

/**
 * What an ASSOCIATION may run between: anything the notation associates, except
 * two actors.
 *
 * §18.1.3 is explicit — an Actor may have Associations with UseCases, Components
 * and Classes, and with nothing else — so two stick figures joined by a solid
 * line is the one removal, exactly as person → person is C4's. Everything else
 * in the alphabet is sanctioned deliberately: a classifier associates with a
 * classifier (§11.5.4), two instances are joined by a LINK drawn the same way
 * (§9.8.4), and an actor associates with a use case.
 *
 * The package and the note are outside the alphabet, so an association drawn
 * onto one is not evaluated. That is the family's proportionality requirement
 * doing its job: a line to a note is an anchor somebody drew with the wrong
 * tool, which {@link untypedEdge} is the rule for.
 *
 * Exported so a test asserts THIS table rather than a copy of it.
 */
const UML_ASSOCIATION_ROLES: readonly RoleId[] = [
  UML_ROLE.classifier,
  UML_ROLE.object,
  UML_ROLE.actor,
  UML_ROLE['use-case'],
];

export const UML_ASSOCIATION_MATRIX: readonly EndpointTriplet[] =
  UML_ASSOCIATION_ROLES.flatMap(source =>
    UML_ASSOCIATION_ROLES.map(target => ({
      source,
      edge: UML_ROLE.association,
      target,
    }))
  ).filter(
    triplet =>
      !(triplet.source === UML_ROLE.actor && triplet.target === UML_ROLE.actor)
  );

/**
 * The roles a GENERALIZATION may be drawn between — the alphabet of both
 * generalization rules, and the reason the instance is in it.
 *
 * §9.9.7: "the general classifier must be of the same kind as the specific
 * classifier", which gives the four diagonal sentences of
 * {@link UML_GENERALIZATION_MATRIX}. `uml:object` is here and is sanctioned by
 * nothing: an instance specialises nothing and is specialised by nothing (§9.8),
 * and a hollow triangle pointing at one is a generalization drawn onto the
 * picture of a runtime value.
 */
const UML_GENERALIZATION_ROLES: readonly RoleId[] = [
  UML_ROLE.class,
  UML_ROLE.interface,
  UML_ROLE.actor,
  UML_ROLE['use-case'],
  UML_ROLE.object,
];

/**
 * The permissive table — every ordered pair of {@link UML_GENERALIZATION_ROLES}.
 *
 * Held by {@link generalizationSelfLoop} alone, for the reason C4 states: a
 * second rule carrying the real grammar would report every wrong sentence a
 * second time, with two brackets and two suggestions for one gesture to fix. The
 * loop rule needs the same ALPHABET (so a generalization looped onto a note or a
 * frame stays outside the conversation) and no grammar at all.
 */
export const UML_GENERALIZATION_ALPHABET: readonly EndpointTriplet[] =
  UML_GENERALIZATION_ROLES.flatMap(source =>
    UML_GENERALIZATION_ROLES.map(target => ({
      source,
      edge: UML_ROLE.generalization,
      target,
    }))
  );

/**
 * The generalization GRAMMAR: like specialises like, and an instance is not a
 * kind of anything.
 *
 * Four diagonal sentences and one ALPHABET entry. The fifth triplet is a link
 * between two instances (§9.8.4) — a true sentence, carrying the ASSOCIATION
 * role — and it is here so that `uml:object` is a role this rule speaks about:
 * without it a generalization drawn onto an instance would be outside the
 * alphabet and silently unjudged. `inMatrix` matches the edge role with
 * `roleIsA`, so it can never sanction a generalization.
 *
 * The enumeration is absent from both ends, and that is a silence rather than a
 * permission: a generalization between two enumerations is legal in the
 * metamodel (an Enumeration is a DataType) and vanishingly rare on a drawing, so
 * the pack declines to have an opinion about it.
 */
export const UML_GENERALIZATION_MATRIX: readonly EndpointTriplet[] = [
  {
    source: UML_ROLE.class,
    edge: UML_ROLE.generalization,
    target: UML_ROLE.class,
  },
  {
    source: UML_ROLE.interface,
    edge: UML_ROLE.generalization,
    target: UML_ROLE.interface,
  },
  {
    source: UML_ROLE.actor,
    edge: UML_ROLE.generalization,
    target: UML_ROLE.actor,
  },
  {
    source: UML_ROLE['use-case'],
    edge: UML_ROLE.generalization,
    target: UML_ROLE['use-case'],
  },
  // The ALPHABET entry — see the header. A link between two instances, on the
  // association role, so it sanctions no generalization whatever.
  {
    source: UML_ROLE.object,
    edge: UML_ROLE.association,
    target: UML_ROLE.object,
  },
];

/**
 * What a REALIZATION points at: an interface, and nothing else (§10.4.3, whose
 * `contract` end is typed `Interface`).
 *
 * One sentence, and an alphabet of one role — `uml:interface` specialises
 * `uml:classifier`, so the source entry covers both ends of every realization
 * drawn between two compartmented boxes. A realization onto a package, an
 * object, an actor or a use case is outside the alphabet and is not judged:
 * those are drawings of something else entirely, and the notation has no reading
 * of them to correct.
 */
export const UML_REALIZATION_MATRIX: readonly EndpointTriplet[] = [
  {
    source: UML_ROLE.classifier,
    edge: UML_ROLE.realization,
    target: UML_ROLE.interface,
  },
];

/**
 * What a DEPENDENCY may run between: the model's named elements, and never TO an
 * instance.
 *
 * A dependency is a statement about the model — this classifier needs that one,
 * this package needs that one (§7.8.4) — and an INSTANCE is not part of the
 * model but an illustration of it (§9.8.3). An arrow pointing at `o1 : Order` is
 * almost always an arrow meant for `Order`.
 *
 * The object is therefore a legal SOURCE and never a legal TARGET, which is the
 * whole content of the table: three sources, two targets, six sentences, and
 * `uml:object` in the alphabet so the seventh is a finding.
 */
const UML_DEPENDENCY_SOURCES: readonly RoleId[] = [
  UML_ROLE.classifier,
  UML_ROLE.package,
  UML_ROLE.object,
];

const UML_DEPENDENCY_TARGETS: readonly RoleId[] = [
  UML_ROLE.classifier,
  UML_ROLE.package,
];

export const UML_DEPENDENCY_MATRIX: readonly EndpointTriplet[] =
  UML_DEPENDENCY_SOURCES.flatMap(source =>
    UML_DEPENDENCY_TARGETS.map(target => ({
      source,
      edge: UML_ROLE.dependency,
      target,
    }))
  );

/**
 * The use case diagram's grammar, whole — read by TWO rules, each seeing the
 * slice its own edge role selects.
 *
 * §18.1.3 types both ends of an Include (`addition: UseCase`) and both ends of
 * an Extend (`extendedCase: UseCase`), so the only sentence either sanctions is
 * use case → use case. That alone would give each rule an alphabet of one role
 * and nothing it could ever report — an include drawn from an ACTOR, which is
 * the mistake these two exist for, would be outside the alphabet and silent.
 *
 * The two ASSOCIATION triplets are what fix that. They are true sentences of
 * §18.1.3 (an actor associates with a use case) and they carry the association
 * role, so `inMatrix` — which matches a triplet's edge with `roleIsA` — can never
 * let them sanction an include or an extend. Their only effect is to put
 * `uml:actor` in the alphabet both rules speak.
 *
 * The two rules never double-report: an edge carries one role, and the include
 * rule reads `uml:include` while the extend rule reads `uml:extend` — flat
 * siblings, so neither reaches the other's edges, and neither reaches the
 * associations this table also describes.
 */
export const UML_USE_CASE_MATRIX: readonly EndpointTriplet[] = [
  {
    source: UML_ROLE['use-case'],
    edge: UML_ROLE.include,
    target: UML_ROLE['use-case'],
  },
  {
    source: UML_ROLE['use-case'],
    edge: UML_ROLE.extend,
    target: UML_ROLE['use-case'],
  },
  // The ALPHABET entries — see the header.
  {
    source: UML_ROLE.actor,
    edge: UML_ROLE.association,
    target: UML_ROLE['use-case'],
  },
  {
    source: UML_ROLE['use-case'],
    edge: UML_ROLE.association,
    target: UML_ROLE.actor,
  },
];

/**
 * What a DEPLOY may run between: an artefact onto a node, and nothing else.
 *
 * §19.4.4 draws it as the dashed arrow with the `«deploy»` keyword, and §19.2.3
 * types its two ends — a DeployedArtifact onto a DeploymentTarget. `uml:node` is
 * the parent of `uml:device` and `uml:execution-environment` (`roles.ts`), so the
 * single sentence below reaches all three targets through `roleIsA` rather than
 * being restated once per cube.
 *
 * The second triplet is an ALPHABET entry, the device the file header explains:
 * a manifestation is a true sentence of §19.3.4, it carries the `uml:manifest`
 * role and can therefore never sanction a deploy, and its whole effect is to put
 * `uml:component` into the alphabet this rule speaks. Without it a `«deploy»`
 * drawn from a component — which is the mistake this rule exists for, since a
 * component is not what gets deployed, its artefact is — would be outside the
 * alphabet and silently unjudged.
 */
export const UML_DEPLOY_MATRIX: readonly EndpointTriplet[] = [
  {
    source: UML_ROLE.artifact,
    edge: UML_ROLE.deploy,
    // The PARENT role: a node, a device and an execution environment alike.
    target: UML_ROLE.node,
  },
  // The ALPHABET entry — see the header.
  {
    source: UML_ROLE.artifact,
    edge: UML_ROLE.manifest,
    target: UML_ROLE.component,
  },
];

/**
 * What a MANIFEST may run between: an artefact onto the element it embodies.
 *
 * §19.3.3 — "An Artifact may embody, or manifest, a number of model elements" —
 * and §19.3.4 draws it as the dashed open arrow labelled `«manifest»`. The
 * metamodel's `utilizedElement` is a PackageableElement, so a manifestation may
 * point at a great many things; this pack draws the one §19.3.5's own figure
 * draws, "A Manifestation relationship between an Artifact and a Component",
 * because a component diagram is where a manifestation is drawn at all.
 *
 * {@link UML_DEPLOY_MATRIX}'s twin, mirrored: the foreign triplet here is the
 * DEPLOY, which puts `uml:node` in the alphabet so that a `«manifest»` aimed at
 * a cube — the same arrow drawn at the wrong end of the deployment story — is a
 * finding rather than silence.
 */
export const UML_MANIFEST_MATRIX: readonly EndpointTriplet[] = [
  {
    source: UML_ROLE.artifact,
    edge: UML_ROLE.manifest,
    target: UML_ROLE.component,
  },
  // The ALPHABET entry — see the header.
  {
    source: UML_ROLE.artifact,
    edge: UML_ROLE.deploy,
    target: UML_ROLE.node,
  },
];

/**
 * What a COMMUNICATION PATH may run between: two nodes.
 *
 * §19.4.3 is as narrow as a clause gets — "A CommunicationPath is an Association
 * between two DeploymentTargets, through which they may exchange Signals and
 * Messages" — and §19.4.4 draws it as the plain association link between two
 * cubes. One sentence, and `uml:node` on both ends, so a device talking to an
 * execution environment is sanctioned through the parent role.
 *
 * TWO alphabet entries this time, and both are foreign edges: they put
 * `uml:artifact` and `uml:component` into the alphabet, which is what makes a
 * network line drawn onto a `.jar` or onto a component box a finding. A
 * communication path is about MACHINES talking to machines, and the wire drawn
 * to the software running on one of them is the confusion the rule is for.
 */
export const UML_COMMUNICATION_PATH_MATRIX: readonly EndpointTriplet[] = [
  {
    source: UML_ROLE.node,
    edge: UML_ROLE['communication-path'],
    target: UML_ROLE.node,
  },
  // The ALPHABET entries — see the header.
  {
    source: UML_ROLE.artifact,
    edge: UML_ROLE.deploy,
    target: UML_ROLE.node,
  },
  {
    source: UML_ROLE.artifact,
    edge: UML_ROLE.manifest,
    target: UML_ROLE.component,
  },
];

/* ── Membership: is the drawing on the sheet it claims to be on? ────────── */

/**
 * **U1** — a classifier drawn beside the diagram frame.
 *
 * Annex A draws a UML diagram inside a frame carrying its kind and its name, and
 * what is outside the frame is outside the diagram: a class parked on bare
 * canvas belongs to no sheet, is written into no export (`export.ts` attributes
 * by frame) and says nothing a reader can situate.
 *
 * Requiring it to be drawn INSIDE the rectangle is ours rather than the
 * specification's — Annex A describes the frame, it does not forbid ink beside
 * one — so the provenance says `labre-convention`, the same call C4's
 * `homeless-component` makes.
 *
 * ## Written on the CLASSIFIERS, and the limit that follows
 *
 * `element-in-background` names one subject role and UML declares no ancestor
 * meaning "any artefact" (the file header says why at length). So this rule
 * reaches a class, an interface and an enumeration — what a class diagram is made
 * of — and an object, a package, a note, an actor or a use case parked outside
 * the frame raises nothing. A narrower rule that is right is worth more than a
 * wider one that guesses.
 *
 * Phase 2 widened `appliesTo` by nothing, and that is the same limit rather than
 * an oversight: a component, a port, an interface glyph, an artefact and a node
 * have no common ancestor with the three classifiers that does not ALSO reach
 * the frames and the tiers, and inventing one — `uml:artefact`, say — would be
 * this pack adding a word to a vocabulary whose whole authority is that every
 * role in it is the specification's. Six artefacts parked beside the sheet
 * raised nothing before; twelve do now.
 *
 * ## Silence on a frameless sketch
 *
 * A board with no `uml:diagram` on it has no frame for this question to be about,
 * and the family answers that with silence — which covers every diagram drawn
 * before the frame existed, and every croquis somebody is still deciding the
 * shape of.
 */
const elementOutsideFrame: ValidationRule = {
  id: 'uml.element-outside-frame',
  framework: 'uml',
  family: 'element-in-background',
  severity: 'audit',
  appliesTo: UML_ROLE.classifier,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.element-outside-frame',
  messageFallback: 'This classifier sits outside the diagram frame.',
  suggestionKey: 'com.labre.uml.validation.element-outside-frame.suggestion',
  suggestionFallback:
    'A UML diagram is what the frame encloses: its heading says which kind of diagram this is, and the export reads the artefacts inside it. Move the box onto the sheet, or stretch the frame round it.',
  version: 1,
  provenance: {
    source: 'labre-convention',
    reference:
      'Labre convention — Annex A draws the frame; requiring an artefact to be inside one is membership on this canvas',
  },
  // The frame, and the whole question. No `background` declaration:
  // `element-in-background` measures against the element BOX and reads no
  // margin, so a geometry declaration here would be data nothing reads.
  backgroundRole: UML_ROLE.diagram,
};

/**
 * The five SEQUENCE artefacts, as one entry for the eight deny-lists that all
 * refuse the same five (§17.2.4, §17.3.4, §17.4.4, §17.6.4).
 *
 * Spread into each list rather than named eight times, and that is a departure
 * from how the `act` and `stm` lists are written — they spell their strangers
 * out one by one, on purpose, because each of them refuses a DIFFERENT subset of
 * the other's routing glyphs and a shared constant would have hidden which. Here
 * the subset is identical in all eight, and writing it once is what makes it
 * impossible for a ninth sheet to be added with four of the five.
 *
 * ## `uml:message` is the first EDGE role this table names, and it belongs
 *
 * Every other entry in `forbidden` is a node or a frame, which is a gap in the
 * eight lists rather than a reading of the family: `evaluateViewAdmissibility`
 * judges any element carrying a role, and a connector carries one and has
 * bounds. A message arrow is also the one edge in this vocabulary whose meaning
 * is entirely about the sheet it is on — §17.4.4 reads it against a vertical
 * axis of TIME — so a message drawn across a class diagram is not an edge of the
 * wrong type between two boxes, it is an arrow whose whole notation is missing.
 * The parent role reaches all five sorts in one entry.
 */
const UML_SEQUENCE_ROLES: readonly RoleId[] = [
  UML_ROLE.lifeline,
  UML_ROLE.execution,
  UML_ROLE.destruction,
  UML_ROLE.fragment,
  UML_ROLE.message,
];

/**
 * **U2** — an artefact drawn on a sheet whose own heading says it is a different
 * diagram.
 *
 * The rule whose subject is the SHEET, and the one the diagram-kind picker
 * exists for. A UML frame does not merely have a name: Annex A writes its
 * heading as `<kind> <name>` — `class Orders`, `uc Checkout` — so every frame
 * states which of the six diagrams it draws, and stating it is not optional the
 * way a C4 board's level is (`kinds.ts` says why). The rule reads that statement
 * back and confronts it with what has been drawn.
 *
 * Nine kinds since phase 3, and the table below grows by APPENDING a key: a
 * `forbidden` entry is looked up by the frame's own `kind` string, so a kind with
 * no entry is a sheet this rule has nothing to say about — which is exactly what
 * a phase-1 build does with a `cmp` frame, and a phase-2 build with an `sd` one.
 *
 * ## The deny-lists, and the much longer list they do not name
 *
 * A **class** diagram refuses the use case vocabulary: actors, use cases and the
 * subject rectangle are §18 and belong on a `uc` sheet. It admits classes,
 * interfaces, enumerations, objects, packages and notes — a class diagram
 * legitimately shows an instance beside the classifier it illustrates.
 *
 * A **package** diagram refuses that same vocabulary and the OBJECT besides:
 * §12.2.4 draws packages, the classifiers they contain and the dependencies
 * between them, and an instance on such a sheet is a level the diagram has not
 * zoomed to.
 *
 * An **object** diagram refuses the use case vocabulary and the CLASSIFIERS:
 * §9.8.4 draws instances and the links between them, which is the whole point of
 * the sheet — a class drawn among them is the type, not one of its values.
 *
 * A **use case** diagram refuses the class-diagram vocabulary: classifiers,
 * objects and packages. It admits actors, use cases, the subject and notes.
 *
 * Nothing else is named anywhere: notes, legend glyphs, sticky notes, free
 * rectangles somebody thought with and every artefact of another framework are
 * left alone, because a deny-list says only what the notation refuses (PRD
 * principle 8).
 *
 * ## What it stays silent about
 *
 * An artefact drawn OUTSIDE the frame — the family judges a subject against the
 * frame whose plot contains its centre, so a box beside the sheet is
 * {@link elementOutsideFrame}'s business and not this rule's. And a frame
 * carrying a kind this build has never heard of (a phase-2 value on a phase-1
 * build, an import) is a level with no entry in the table, which the engine
 * answers by walking nothing at all.
 */
const notAdmissibleOnKind: ValidationRule = {
  id: 'uml.not-admissible-on-kind',
  framework: 'uml',
  family: 'view-admissibility',
  severity: 'audit',
  // No `appliesTo`: the subjects are declared per KIND, in `admissibility`, and
  // naming a single one here would be data that lies.
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.not-admissible-on-kind',
  messageFallback:
    'This artefact is not drawn on the kind of diagram the frame says this is.',
  suggestionKey: 'com.labre.uml.validation.not-admissible-on-kind.suggestion',
  suggestionFallback:
    'The frame’s heading names the diagram — class, pkg, obj, uc, cmp, dep, act, stm or sd — and each draws its own vocabulary. Move the artefact to a sheet that draws it, or change the frame’s kind to the one it really shows.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'OMG UML 2.5.1 — Annex A (diagram kinds and frame headings), §9.8.4 (object diagrams), §12.2.4 (package diagrams), §18.1.4 (use case diagrams), §17.2.4 (sequence diagrams)',
  },
  backgroundRole: UML_ROLE.diagram,
  admissibility: {
    // The prop the frame writes its kind in. The rule names it; the engine reads
    // it; nothing in between knows the word "UML".
    levelProp: 'kind',
    forbidden: {
      class: [
        UML_ROLE.actor,
        UML_ROLE['use-case'],
        UML_ROLE.subject,
        // Phase 3 — the SEQUENCE vocabulary, refused by every sheet that is not
        // `sd`. A lifeline, an execution bar, a destruction cross, a combined
        // fragment and a message arrow are §17's own notation, and the spine of
        // a lifeline draws TIME running down the page — the one frame of
        // reference the other eight sheets explicitly do not have
        // (`background.ts`: "a UML diagram is a GRAPH"). So they are refused
        // everywhere else, and the seven lists below name the same five.
        ...UML_SEQUENCE_ROLES,
      ],
      pkg: [
        UML_ROLE.actor,
        UML_ROLE['use-case'],
        UML_ROLE.subject,
        UML_ROLE.object,
        ...UML_SEQUENCE_ROLES,
      ],
      obj: [
        UML_ROLE.actor,
        UML_ROLE['use-case'],
        UML_ROLE.subject,
        // The PARENT role: a class, an interface and an enumeration alike.
        UML_ROLE.classifier,
        ...UML_SEQUENCE_ROLES,
      ],
      uc: [
        UML_ROLE.classifier,
        UML_ROLE.object,
        UML_ROLE.package,
        ...UML_SEQUENCE_ROLES,
      ],
      // Phase 2 — the two structural sheets.
      //
      // A **component** diagram (§11.6.4) refuses the use case vocabulary and
      // the instance, for the reasons the class and package lists refuse them,
      // and it refuses the DEPLOYMENT cubes besides: a node, a device and an
      // execution environment are §19.4's answer to "where does this run", which
      // is the question the `dep` sheet is drawn to ask. It admits the component
      // itself, its ports, the two interface glyphs, an interface drawn as a
      // full rectangle instead (§11.6.4 offers both), the packages that group
      // them, the notes, and the ARTEFACTS that manifest a component — §11.6.5's
      // own "white box" figure lists them in a compartment.
      cmp: [
        UML_ROLE.actor,
        UML_ROLE['use-case'],
        UML_ROLE.subject,
        UML_ROLE.object,
        // The PARENT role: a node, a device and an execution environment alike.
        UML_ROLE.node,
        ...UML_SEQUENCE_ROLES,
      ],
      // A **deployment** diagram (§19.2.4) refuses the use case vocabulary, the
      // instance and the three CLASSIFIERS: §19 draws machines, the software
      // environments on them, the artefacts deployed onto those and the
      // components those artefacts manifest — a class, an interface or an
      // enumeration on such a sheet is a level the diagram has not zoomed to.
      //
      // The three are named one by one where the `obj` list above names their
      // parent, and that is deliberate rather than untidy. `uml:classifier` is
      // the spec's own generalisation (§9.2) and the metamodel ALSO makes a
      // Component (§11.6.2) and an Artifact (§19.3.2) Classifiers; `roles.ts`
      // declares those two flat, for the reasons it gives, and this list must
      // not depend on that call going one way — a deployment diagram that
      // stopped admitting artefacts because the vocabulary was re-parented
      // would be a rule broken at a distance, by an edit that never mentioned
      // it. Naming the three compartmented boxes says what the sheet refuses.
      dep: [
        UML_ROLE.actor,
        UML_ROLE['use-case'],
        UML_ROLE.subject,
        UML_ROLE.object,
        UML_ROLE.class,
        UML_ROLE.interface,
        UML_ROLE.enumeration,
        ...UML_SEQUENCE_ROLES,
      ],
      // Phase 2 — the two BEHAVIOUR sheets, and the first pair whose deny-lists
      // are mostly about EACH OTHER.
      //
      // An **activity** (§15.2.4) refuses the use case vocabulary, the instance,
      // the classifiers and the structural artefacts, for the reasons every list
      // above refuses them — and it refuses the STATE MACHINE vocabulary, which
      // is the half that earns its place: §14.2.4 and §15.3.4 draw a rounded
      // rectangle each and a diamond each, the two sheets sit next to each other
      // in one menu, and a state drawn among actions is the confusion this pair
      // of diagrams produces every time. `uml:pseudostate` reaches the choice,
      // the junction, the two histories, the two connection points and the
      // terminate cross in one entry.
      //
      // What it ADMITS is the whole activity vocabulary, the swimlanes, the
      // notes and the packages — and the initial disc and the fork bar, which
      // are NOT refused on either sheet because one role carries both notations
      // (`roles.ts`).
      act: [
        UML_ROLE.actor,
        UML_ROLE['use-case'],
        UML_ROLE.subject,
        UML_ROLE.object,
        // The PARENT role: a class, an interface and an enumeration alike.
        UML_ROLE.classifier,
        UML_ROLE.component,
        UML_ROLE.port,
        UML_ROLE['provided-interface'],
        UML_ROLE['required-interface'],
        UML_ROLE.artifact,
        // The PARENT role: a node, a device and an execution environment alike.
        UML_ROLE.node,
        // The state machine's own vocabulary — see above.
        UML_ROLE.state,
        UML_ROLE['final-state'],
        UML_ROLE.pseudostate,
        UML_ROLE.region,
        ...UML_SEQUENCE_ROLES,
      ],
      // A **state machine** (§14.2.4) refuses the same strangers and the
      // ACTIVITY vocabulary, named glyph by glyph rather than through
      // `uml:control-node`: that parent covers the initial disc and the fork bar
      // as well, and both of those are §14.2.4's own notation. A deny-list
      // written on the parent would refuse the two artefacts a state machine
      // most needs — which is exactly the rule broken at a distance the `dep`
      // list above spells its three classifiers out to avoid.
      //
      // The DECISION is refused and the CHOICE is not, and the pair is the
      // reason this list exists at all: they are the same diamond, one per
      // sheet, and swapping them is one click in the morph menu.
      stm: [
        UML_ROLE.actor,
        UML_ROLE['use-case'],
        UML_ROLE.subject,
        UML_ROLE.object,
        UML_ROLE.classifier,
        UML_ROLE.component,
        UML_ROLE.port,
        UML_ROLE['provided-interface'],
        UML_ROLE['required-interface'],
        UML_ROLE.artifact,
        UML_ROLE.node,
        // The activity's own vocabulary, one by one — see above.
        UML_ROLE.action,
        UML_ROLE['activity-final'],
        UML_ROLE['flow-final'],
        UML_ROLE.decision,
        UML_ROLE['object-node'],
        UML_ROLE['send-signal'],
        UML_ROLE['accept-event'],
        UML_ROLE['time-event'],
        UML_ROLE.partition,
        ...UML_SEQUENCE_ROLES,
      ],
      // Phase 3 — the SEQUENCE sheet (§17.2.4), and the STRICTEST list in the
      // table by some distance.
      //
      // Every other kind here refuses a neighbouring vocabulary and admits its
      // own plus whatever a whiteboard is made of. An `sd` frame refuses all
      // EIGHT of the others, and the reason is the sheet's frame of reference
      // rather than its vocabulary: a sequence diagram's vertical axis is TIME
      // (§17.4.4 — "every line fragment is either horizontal or downwards when
      // traversed from send event to receive event"), and an artefact that is
      // not a participant has no position on it. A class dropped between two
      // lifelines is not a class at the wrong level of detail, the way an
      // instance on a package diagram is; it is a box the reader cannot date.
      //
      // So the list is every role the other lists name, plus the two behaviour
      // vocabularies, plus the PACKAGE — which `act` and `stm` admit and this
      // sheet does not, for the reason above. What is left is what §17 draws:
      // the lifeline, the execution bar, the destruction cross, the combined
      // fragment and the five message arrows — and the NOTE, which every sheet
      // in this table admits because Annex A draws one on all of them.
      //
      // `uml:control-node` and `uml:pseudostate` are named as PARENTS here
      // where the `act` and `stm` lists spell their children out. Those two
      // lists had to: each sheet draws half the other's routing glyphs, so a
      // deny-list on a parent would have refused the notation the author came
      // for. This sheet draws none of them, which makes the parent the honest
      // entry — and keeps the list from growing every time a routing glyph is
      // added to a diagram this one has nothing to do with.
      sd: [
        UML_ROLE.actor,
        UML_ROLE['use-case'],
        UML_ROLE.subject,
        UML_ROLE.object,
        UML_ROLE.package,
        // The PARENT role: a class, an interface and an enumeration alike.
        UML_ROLE.classifier,
        UML_ROLE.component,
        UML_ROLE.port,
        UML_ROLE['provided-interface'],
        UML_ROLE['required-interface'],
        UML_ROLE.artifact,
        // The PARENT role: a node, a device and an execution environment alike.
        UML_ROLE.node,
        // The activity's vocabulary — the parent reaches the initial disc, the
        // two finals, the decision and the fork bar in one entry.
        UML_ROLE.action,
        UML_ROLE['control-node'],
        UML_ROLE['object-node'],
        UML_ROLE['send-signal'],
        UML_ROLE['accept-event'],
        UML_ROLE['time-event'],
        UML_ROLE.partition,
        // …and the state machine's, the parent reaching the choice, the
        // junction, the two histories, the two connection points and the
        // terminate cross.
        UML_ROLE.state,
        UML_ROLE['final-state'],
        UML_ROLE.pseudostate,
        UML_ROLE.region,
      ],
    },
  },
};

/**
 * **U3** — a use case drawn outside every subject.
 *
 * §18.1.4 draws the SUBJECT as a rectangle round the use cases a system offers,
 * with the actors outside it: the rectangle is what says "these are the things
 * this system does", and a use case beside it is a behaviour attributed to
 * nothing.
 *
 * ## `element-in-background`, which is the family that fits
 *
 * The brief asked for "outside every subject while one exists", and that is
 * precisely what this family answers: a subject on the board is the frame, a use
 * case not contained by ANY of them is the finding, and a board with no subject
 * at all is silence. No polarity has to be turned round — the question is already
 * the positive one — so the `element-in-zone` arrangement {@link actorInsideSubject}
 * needs is not needed here.
 *
 * The silence is the half worth stating: a use case diagram whose author has not
 * drawn the subject yet is a sketch, and most of them never draw one at all. The
 * rule speaks only once somebody has declared where the system's boundary is.
 */
const useCaseOutsideSubject: ValidationRule = {
  id: 'uml.use-case-outside-subject',
  framework: 'uml',
  family: 'element-in-background',
  severity: 'audit',
  appliesTo: UML_ROLE['use-case'],
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.use-case-outside-subject',
  messageFallback: 'This use case sits outside the subject.',
  suggestionKey: 'com.labre.uml.validation.use-case-outside-subject.suggestion',
  suggestionFallback:
    'The subject rectangle is what says which system offers these use cases. Move the ellipse inside the one it belongs to, or stretch the subject round it — the actors stay outside.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'OMG UML 2.5.1 §18.1.4 — the subject rectangle encloses the UseCases the system offers, with the Actors outside it',
  },
  backgroundRole: UML_ROLE.subject,
};

/**
 * **U4** — an actor drawn inside the subject.
 *
 * The other half of §18.1.4, and the one the notation is most explicit about: an
 * actor is a role played by somebody OUTSIDE the system, and the subject
 * rectangle is the system. A use case diagram whose stick figures are inside the
 * box has erased the only line it had.
 *
 * ## The family is `element-in-zone`, and why
 *
 * The question is "is this element OUTSIDE that frame", and
 * `element-in-background` cannot ask it: it has one polarity, INSIDE, with no
 * `expect` to turn round. `element-in-zone` has the polarity, and the subject
 * declares exactly one zone covering its whole plot (`background.ts` — it carries
 * the subject's name and paints nothing), so citing that zone is citing the
 * inside of the rectangle. Nothing is restated: the geometry comes from the very
 * declaration the renderer paints from, so a subject that is moved, resized or
 * re-margined moves this rule with it. C4's `person-in-boundary` is the same
 * arrangement for the same reason, one framework over.
 *
 * `element-in-zone` judges a subject only against the frame that CONTAINS it, so
 * an actor straddling the edge — half in, half out — raises nothing: only an
 * actor drawn wholly inside is an actor the author has put inside the system.
 */
const actorInsideSubject: ValidationRule = {
  id: 'uml.actor-inside-subject',
  framework: 'uml',
  family: 'element-in-zone',
  severity: 'audit',
  appliesTo: UML_ROLE.actor,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.actor-inside-subject',
  messageFallback: 'This actor is drawn inside the subject.',
  suggestionKey: 'com.labre.uml.validation.actor-inside-subject.suggestion',
  suggestionFallback:
    'An actor is a role played from outside the system, and the subject rectangle is the system. Move the figure out and let the association cross the edge.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'OMG UML 2.5.1 §18.1.3 — an Actor models a role played by an entity external to the subject',
  },
  backgroundRole: UML_ROLE.subject,
  // The frame's own declaration, carried as data exactly like `roles` is: it is
  // where the plot and its one zone are written, and the engine resolves the
  // rectangle from it rather than knowing anything about UML.
  background: UML_SUBJECT_FRAME,
  inZone: {
    // The subject's single full-plot zone — see the header. It exists to carry
    // the subject's name and paints nothing, so it IS the inside of the frame.
    zoneIds: ['name'],
    expect: 'outside',
  },
};

/* ── Naming: does the drawing say anything at all? ──────────────────────── */

/**
 * **U5** — a name compartment somebody has emptied.
 *
 * Written on `uml:name`, the TEXT role, and never on the artefact: since a UML
 * node became a group the shape carries no words at all, so a rule written on
 * `uml:class` would read nothing on every box on the sheet and report every one
 * of them unnamed. The same move C4's `unnamed-element` makes, and for the same
 * reason.
 *
 * ## What it actually fires on, which is narrower than it sounds
 *
 * Every tier is SEEDED at creation (`actions.ts`: `«interface»\nInterface`,
 * `Package`, `+ attribute : Type`), so a fresh artefact is prompted rather than
 * nameless and `label-presence` sees words. The rule therefore fires on exactly
 * one thing: a name compartment an author has emptied.
 *
 * ## It reaches the package and the note too, and that is the honest reading
 *
 * `uml:name` is the name compartment of the classifiers AND of the object, and it
 * is also the package's single line and the note's body (`roles.ts` says why the
 * two share the role: a package name is a namespace and a note's text is what the
 * exporter writes as the comment's body — both are NAMES in the sense the
 * grammar means, where an actor's one word is a `uml:label`). So an emptied
 * package and an emptied note are findings here, under one sentence that fits
 * all four: the drawing has a box and no words.
 *
 * ## The known limit: a DELETED compartment is silence
 *
 * If the text element is removed outright rather than emptied there is no
 * `uml:name` on the sheet for this rule to be about. Closing it means asking
 * whether a GROUP has a name among its children, which is a question about
 * membership and not about a label's presence, and no family expresses it today.
 * `umlComponentOf` (`component.ts`) is where the answer would come from.
 */
const unnamedClassifier: ValidationRule = {
  id: 'uml.unnamed-classifier',
  framework: 'uml',
  family: 'label-presence',
  severity: 'audit',
  appliesTo: UML_ROLE.name,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.unnamed-classifier',
  messageFallback: 'This artefact has no name.',
  suggestionKey: 'com.labre.uml.validation.unnamed-classifier.suggestion',
  suggestionFallback:
    'Write the name the rest of the model refers to it by — "Order", "«interface» Payable", "o1 : Order". The compartments below already say what it has and what it does, so the name is free to say which one it is.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'OMG UML 2.5.1 §9.2.4 — a Classifier is drawn as a rectangle with its name in the top compartment',
  },
  // Explicitly on-demand, and it stays explicit: `moment: undefined` means
  // REALTIME, and the engine watches `text` for exactly this family when a
  // real-time rule of it is registered. Dropping this line would hand the
  // drawing path a debounced re-evaluation per keystroke, in every compartment.
  moment: 'on-demand',
  // Attribution only — the check reads no geometry — so an arbitration made on
  // one sheet covers that sheet and no other.
  backgroundRole: UML_ROLE.diagram,
  label: { present: true },
};

/**
 * **U6** — an actor's or a use case's one word, emptied.
 *
 * ONE rule for the two artefacts, and the brief asked for two ids. They cannot
 * be two rules, and the reason is in `roles.ts`: an actor and a use case carry
 * the SAME tier role, `uml:label` — "the same tier, named differently because it
 * is not a compartment" — so two `label-presence` rules would name the same
 * subject role, fire on the same emptied text and put two brackets and two
 * sentences on one word to fix, one of which would always be about the wrong
 * shape. `label-presence` reads the subject's own words and cannot see what the
 * text is grouped WITH.
 *
 * So the id names the tier rather than either shape, the sentence fits both, and
 * the day a family can ask "which kind of artefact is this text grouped with"
 * the rule splits in two with no data to migrate.
 */
const unnamedActorOrUseCase: ValidationRule = {
  id: 'uml.unnamed-actor-or-use-case',
  framework: 'uml',
  family: 'label-presence',
  severity: 'audit',
  appliesTo: UML_ROLE.label,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.unnamed-actor-or-use-case',
  messageFallback: 'This actor or use case has no name.',
  suggestionKey:
    'com.labre.uml.validation.unnamed-actor-or-use-case.suggestion',
  suggestionFallback:
    'Name the role or the behaviour in the reader’s own words — "Customer", "Place an order". A use case diagram is read as sentences, and an unnamed ellipse leaves one of them half written.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'OMG UML 2.5.1 §18.1.4 — a UseCase is drawn as an ellipse carrying its name, an Actor as a stick figure with its name beneath',
  },
  moment: 'on-demand',
  backgroundRole: UML_ROLE.diagram,
  label: { present: true },
};

/* ── Spelling: are the words written the way the clause writes them? ─────── */

/**
 * **U35–U38** — the four `label-syntax` rules, and the first rules in this
 * library whose verdict is a PARSER rather than a table.
 *
 * `label-presence` asks whether a compartment says anything; these ask whether
 * what it says parses. The four clauses are the four the pack already reads for
 * its exporters — §9.5.4 (a Property), §9.6.4 (an Operation), §14.2.4.8 (a
 * transition label) and §7.5.4 (a multiplicity range) — and the checkers are
 * `grammar.ts`'s own, so a finding here is exactly the line that will export
 * short. That is the strongest claim any rule in this library makes: the tool
 * and the file agree by construction, because they read the same function.
 *
 * ## Why they are `standard`, and what keeps that honest
 *
 * Each restates a BNF the specification prints. What would make the claim
 * dishonest is a checker stricter than the clause — "an attribute must carry a
 * type" indicts `balance`, which §9.5.4 permits — so `grammar.ts` states the one
 * rule its checkers follow and no rule here is allowed to add to it: a line is
 * reported only when the lenient parse LOST something the author wrote.
 *
 * ## Why they are `on-demand`, explicitly
 *
 * The same reason {@link unnamedClassifier} is, one order of magnitude worse.
 * These read WORDS, which a user changes by typing, and they read all of them:
 * a class's attribute compartment is parsed line by line. Real-time, every
 * keystroke in every compartment on the sheet would wake the debounced pass and
 * re-run four parsers. `audit` already implies the moment (PF7.6); the line is
 * written anyway, because `moment: undefined` means REALTIME and a later change
 * of severity must not silently move these onto the gesture path.
 */
const attributeSyntax: ValidationRule = {
  id: 'uml.attribute-syntax',
  framework: 'uml',
  family: 'label-syntax',
  severity: 'audit',
  appliesTo: UML_ROLE.attributes,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.attribute-syntax',
  messageFallback: 'This line is not an attribute:',
  suggestionKey: 'com.labre.uml.validation.attribute-syntax.suggestion',
  suggestionFallback:
    'An attribute is written "- balance : Money [0..1] = 0 {readOnly}", and everything after the name is optional. A line with parentheses is an operation and belongs in the compartment below.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §9.5.4 — [<visibility>] [/] <name> [: <prop-type>] [[<multiplicity>]] [= <default>] [{<modifiers>}]',
  },
  moment: 'on-demand',
  backgroundRole: UML_ROLE.diagram,
  labelSyntax: { parse: checkPropertyLine },
};

const operationSyntax: ValidationRule = {
  id: 'uml.operation-syntax',
  framework: 'uml',
  family: 'label-syntax',
  severity: 'audit',
  appliesTo: UML_ROLE.operations,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.operation-syntax',
  messageFallback: 'This line is not an operation:',
  suggestionKey: 'com.labre.uml.validation.operation-syntax.suggestion',
  suggestionFallback:
    'An operation is written "+ place(order : Order) : Receipt", and the parentheses are what make it one — an operation with no parameters still has them.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §9.6.4 — [<visibility>] <name> ( [<parameter-list>] ) [: [<return-type>] [[<multiplicity>]] [{<oper-property>*}]]',
  },
  moment: 'on-demand',
  backgroundRole: UML_ROLE.diagram,
  labelSyntax: { parse: checkOperationLine },
};

/**
 * The transition's CENTRE label, read as ONE expression.
 *
 * `perLine: false`, unlike the two compartments above, and the clause is the
 * reason: §14.2.4.8's label is a single production — `trigger [guard] / effect` —
 * where §9.5.4's compartment is a list. An author who wraps a long label onto a
 * second line has written one label, and judging the halves separately would
 * report a guard with no trigger and a trigger with no guard for a label that is
 * neither.
 */
const transitionSyntax: ValidationRule = {
  id: 'uml.transition-syntax',
  framework: 'uml',
  family: 'label-syntax',
  severity: 'audit',
  appliesTo: UML_ROLE.transition,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.transition-syntax',
  messageFallback: 'This transition label does not parse:',
  suggestionKey: 'com.labre.uml.validation.transition-syntax.suggestion',
  suggestionFallback:
    'A transition is labelled "trigger [guard] / effect", and every part of it is optional — a transition that fires when its source state finishes carries no label at all.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §14.2.4.8 — [<trigger> [, <trigger>]*] [[<guard>]] [/ <behavior-expression>]',
  },
  moment: 'on-demand',
  backgroundRole: UML_ROLE.diagram,
  labelSyntax: { parse: checkTransitionLabel, perLine: false },
};

/**
 * The multiplicity written at an association's ENDS — both of them, one rule.
 *
 * `target: 'end-labels'` reads the two end labels as two lines of one subject
 * (`validation.ts` {@link LabelTarget}), which is what lets one id cover a
 * grammar §11.5.4 places at both ends. Two rules would be two sentences and two
 * lines in every profile table for one requirement, and each could only ever
 * check half of every line drawn.
 *
 * `appliesTo: uml:association` reaches aggregation and composition for free —
 * they specialise it (`roles.ts`: §11.5.4's aggregation kind is a property of an
 * association END, not a different relationship).
 *
 * ## It is silent about the ROLE name, and that is the whole design
 *
 * An end label is a multiplicity, a role name, a visibility marker, or any
 * mixture of the three with no separator between them (§11.5.4). Only the range
 * has a syntax to be wrong about, so `checkEndLabelMultiplicity` fires on a
 * leading token that is unambiguously an attempt at one — `1..n`, `0...*` — and
 * leaves `items`, `- owner` and even `1st choice` alone. A checker stricter than
 * `parseEndLabel` would indict the ends the exporters read correctly.
 */
const multiplicitySyntax: ValidationRule = {
  id: 'uml.multiplicity-syntax',
  framework: 'uml',
  family: 'label-syntax',
  severity: 'audit',
  appliesTo: UML_ROLE.association,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.multiplicity-syntax',
  messageFallback: 'This end of the association is not a multiplicity:',
  suggestionKey: 'com.labre.uml.validation.multiplicity-syntax.suggestion',
  suggestionFallback:
    'A range is written "1", "0..1", "0..*" or "*", with whole numbers at both bounds. A bound the file cannot hold — "1..n" — travels as part of the end’s name instead of as a range.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §7.5.4 — [<lower> ..] <upper>, read at an association end per §11.5.4',
  },
  moment: 'on-demand',
  backgroundRole: UML_ROLE.diagram,
  labelSyntax: {
    parse: checkEndLabelMultiplicity,
    target: 'end-labels',
  },
};

/* ── Grammar: what each line may run between ────────────────────────────── */

/**
 * **U7** — a generalization whose two ends are not of the same kind.
 *
 * §9.9.7 is normative and short: the general classifier is of the same kind as
 * the specific one. A hollow triangle from a class to an interface is a
 * REALIZATION drawn with the wrong tool (`morph.ts` turns one into the other in a
 * click); one from a use case to an actor is two notations crossed; one pointing
 * at an instance is a generalization drawn onto a runtime value, which is why
 * `uml:object` is in this rule's alphabet and in none of its sentences.
 *
 * The four sanctioned sentences are the diagonal — class → class, interface →
 * interface, actor → actor, use case → use case — and everything else in the
 * alphabet is off it. See {@link UML_GENERALIZATION_MATRIX} for why the fifth
 * triplet carries a different edge role, and the file header for why that device
 * is what gives this rule anything to say at all.
 *
 * ## The self-loop is NOT here, and that is the point
 *
 * {@link generalizationSelfLoop} carries it, because the two clauses have
 * different AUTHORITY — the same split BPMN and C4 both make — and because the
 * family `continue`s on a loop before reaching any matrix, so exactly one of the
 * two can indict a given edge.
 */
const generalizationEndpoints: ValidationRule = {
  id: 'uml.generalization-endpoints',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  // No `appliesTo`: the subject is a RELATION, and the role that names it is
  // declared where the family reads it.
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.generalization-endpoints',
  messageFallback:
    'This generalization runs between two artefacts of different kinds.',
  suggestionKey: 'com.labre.uml.validation.generalization-endpoints.suggestion',
  suggestionFallback:
    'A class specialises a class, an interface an interface, an actor an actor, a use case a use case. If what you mean is "this class implements that interface", draw a realization; if the far end is an instance, point at its classifier instead.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §9.9.7 — the general Classifier must be of the same kind as the specific Classifier',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE.generalization,
    allowed: UML_GENERALIZATION_MATRIX,
    // No `forbidSelfLoop`: that clause is `uml.generalization-self-loop`, and its
    // absence here is what lets exactly one of the two indict a given loop.
  },
};

/**
 * **U8** — a generalization looped back onto the artefact it leaves.
 *
 * §9.9.7 again, and its other constraint: a generalization hierarchy is directed
 * and ACYCLIC, so a classifier cannot be a transitively general and a
 * transitively specific classifier of itself. The one-hop cycle is the case a
 * drawing can hold and a rule can see — the longer ones are a `reachability`
 * question this pack does not ask — and it is almost always a hand that dropped
 * the second end on the first.
 *
 * ## Why the two rules compose safely
 *
 * The ALPHABET GATE runs first, so a generalization looped onto a note, a package
 * or a frame is silence from both rules. Past the gate the family tests the
 * self-loop FIRST and `continue`s unconditionally — the `continue` sits outside
 * the `forbidSelfLoop` guard — so a loop never reaches a matrix at all. This rule
 * therefore declares the PERMISSIVE {@link UML_GENERALIZATION_ALPHABET} rather
 * than U7's grammar: carrying the grammar would report every wrong sentence a
 * second time on every non-loop generalization, which is exactly the trap C4
 * documents and its suite caught twice.
 *
 * It carries no `selfLoop` block: with the matrix unreachable here, the rule's
 * own message IS the self-loop message and the family falls back to it.
 */
const generalizationSelfLoop: ValidationRule = {
  id: 'uml.generalization-self-loop',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.generalization-self-loop',
  messageFallback: 'This generalization loops back onto its own classifier.',
  suggestionKey: 'com.labre.uml.validation.generalization-self-loop.suggestion',
  suggestionFallback:
    'Nothing is a specialisation of itself: a generalization hierarchy is directed and acyclic. Point the triangle at the classifier this one really specialises, or delete the line.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §9.9.7 — Generalization hierarchies must be directed and acyclical',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE.generalization,
    // The ALPHABET, never U7's grammar — see the header.
    allowed: UML_GENERALIZATION_ALPHABET,
    forbidSelfLoop: true,
  },
};

/**
 * **U9** — a realization that does not point at an interface.
 *
 * §10.4.3 types an InterfaceRealization's `contract` end as an Interface, and the
 * notation draws it as the dashed line with the hollow triangle. A realization
 * between two classes is a generalization drawn with the wrong tool — the two
 * differ by a dash, which is the single easiest mistake to make on a class
 * diagram and the single easiest to fix (`morph.ts`).
 *
 * One sentence, one alphabet of one role, and therefore exactly one thing this
 * rule can ever say. See {@link UML_REALIZATION_MATRIX} for what it declines to
 * have an opinion about.
 */
const realizationEndpoints: ValidationRule = {
  id: 'uml.realization-endpoints',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.realization-endpoints',
  messageFallback: 'This realization does not point at an interface.',
  suggestionKey: 'com.labre.uml.validation.realization-endpoints.suggestion',
  suggestionFallback:
    'A realization says "this classifier implements that contract", and a contract is an interface. Point the dashed triangle at one — or, if what you mean is "is a", draw a generalization instead.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §10.4.3 — an InterfaceRealization’s contract is an Interface',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE.realization,
    allowed: UML_REALIZATION_MATRIX,
  },
};

/**
 * **U10** — a dependency pointing at an instance.
 *
 * §9.8.3: an InstanceSpecification illustrates the model, it is not part of it.
 * A dashed arrow from a class to `o1 : Order` is a statement about a value where
 * the author meant a statement about a type, and the fix is one drag.
 *
 * The object is a legal SOURCE — a diagram may show what an instance needs — and
 * never a legal target, which is the whole of {@link UML_DEPENDENCY_MATRIX}.
 *
 * ## What the brief asked for that this rule no longer carries
 *
 * "dependency OR generalization to `uml:object`". `relation-endpoints` names one
 * edge role, so the generalization half cannot live here — and it does not have
 * to: {@link generalizationEndpoints} already indicts a generalization pointing at
 * an instance, because `uml:object` is in its alphabet and in none of its
 * sentences. One verdict per wrong edge, and each carries the sentence that fits
 * the line the author actually drew.
 */
const dependencyOnObject: ValidationRule = {
  id: 'uml.dependency-on-object',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.dependency-on-object',
  messageFallback: 'This dependency points at an instance.',
  suggestionKey: 'com.labre.uml.validation.dependency-on-object.suggestion',
  suggestionFallback:
    'A dependency is a statement about the model, and an instance is an illustration of it. Point the arrow at the classifier the instance is of, or at the package that holds it.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'OMG UML 2.5.1 §9.8.3 — an InstanceSpecification illustrates a Classifier; the model’s dependencies are stated between the named elements themselves',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE.dependency,
    allowed: UML_DEPENDENCY_MATRIX,
  },
};

/**
 * **U11** — an include with an end that is not a use case.
 *
 * §18.1.3 types both ends of an Include as UseCases: an inclusion says "running
 * this behaviour always runs that one", which is a statement about two
 * behaviours. An include drawn from an ACTOR — the mistake this rule exists for
 * — is somebody reaching for the association tool's neighbour in the menu.
 *
 * Reads the use case grammar's `uml:include` slice; the two association triplets
 * in that table are the alphabet entries that make an actor end a finding rather
 * than silence (see {@link UML_USE_CASE_MATRIX}).
 */
const includeEndpoints: ValidationRule = {
  id: 'uml.include-endpoints',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.include-endpoints',
  messageFallback:
    'This include runs between something other than two use cases.',
  suggestionKey: 'com.labre.uml.validation.include-endpoints.suggestion',
  suggestionFallback:
    'An include says one behaviour always runs another, so both ends are use cases. If the end is an actor, what you want is an association — draw that instead.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §18.1.3 — an Include relates an including UseCase to the UseCase it includes',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE.include,
    allowed: UML_USE_CASE_MATRIX,
  },
};

/**
 * **U12** — an extend with an end that is not a use case.
 *
 * {@link includeEndpoints}' twin, on §18.1.3's other relationship: an Extend
 * relates the extending UseCase to the extended one. The two are declared
 * separately because the roles are flat — an extend is not a kind of include, and
 * one rule policing both would be a rule nobody could read the verdict of.
 */
const extendEndpoints: ValidationRule = {
  id: 'uml.extend-endpoints',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.extend-endpoints',
  messageFallback:
    'This extend runs between something other than two use cases.',
  suggestionKey: 'com.labre.uml.validation.extend-endpoints.suggestion',
  suggestionFallback:
    'An extend says one behaviour may add itself to another at a point the other declares, so both ends are use cases. If the end is an actor, draw an association instead.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §18.1.3 — an Extend relates an extending UseCase to the extended UseCase',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE.extend,
    allowed: UML_USE_CASE_MATRIX,
  },
};

/**
 * **U13** — an association drawn between two actors.
 *
 * §18.1.3 lists what an Actor may be associated with — UseCases, Components and
 * Classes — and two actors is not on it. Two stick figures joined by a solid line
 * is almost always an organisation chart drawn on a use case diagram: the
 * relationship between two roles is real and important and it is not what this
 * notation draws. (A GENERALIZATION between two actors is legal and this rule
 * says nothing about one — it reads `uml:association` alone.)
 *
 * ## The one removal, and the reason the table is written as one
 *
 * {@link UML_ASSOCIATION_MATRIX} is the alphabet minus a single line, exactly as
 * C4's relationship grammar is. That is what makes this a single-verdict rule:
 * everything else in the alphabet is sanctioned, so the only sentence it can
 * report is the one its message names. An association onto a package or a note
 * is outside the alphabet and stays outside the conversation.
 *
 * Also the rule that reaches the two DIAMONDS for free: `uml:aggregation` and
 * `uml:composition` specialise `uml:association` (§11.5.4), so `roleIsA` brings
 * them in and the same grammar judges all three.
 */
const actorActorAssociation: ValidationRule = {
  id: 'uml.actor-actor-association',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.actor-actor-association',
  messageFallback: 'This association runs between two actors.',
  suggestionKey: 'com.labre.uml.validation.actor-actor-association.suggestion',
  suggestionFallback:
    'A use case diagram associates an actor with what the system does for them, never with another actor. Draw what each of them uses — or, if one role is a kind of the other, draw a generalization.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §18.1.3 — an Actor may have Associations with UseCases, Components and Classes, and with nothing else',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE.association,
    allowed: UML_ASSOCIATION_MATRIX,
  },
};

/**
 * **U17** — a `«deploy»` arrow that does not put an artefact on a node.
 *
 * §19.2.3 types the two ends of a Deployment — a DeployedArtifact onto a
 * DeploymentTarget — and §19.4.4 draws it as the dashed arrow with the keyword.
 * The one drawing this rule is really for is the arrow from a COMPONENT to a
 * node: it is the sentence everybody means and the one §19 declines to draw,
 * because what reaches a machine is the artefact — the jar, the image, the
 * script — and the component is what that artefact MANIFESTS (§19.3.3). The fix
 * is one box and two arrows, and the suggestion says so.
 *
 * Reads {@link UML_DEPLOY_MATRIX}, whose second triplet is the alphabet entry
 * that makes the component end a finding rather than silence.
 */
const deployEndpoints: ValidationRule = {
  id: 'uml.deploy-endpoints',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.deploy-endpoints',
  messageFallback: 'This deployment does not put an artefact on a node.',
  suggestionKey: 'com.labre.uml.validation.deploy-endpoints.suggestion',
  suggestionFallback:
    'A deployment runs from the artefact — the jar, the image, the script — to the node, device or execution environment it is installed on. If the far end of this arrow is a component, draw the artefact that manifests it and deploy that instead.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §19.2.3 — a Deployment relates a DeployedArtifact to the DeploymentTarget it is deployed on; §19.4.4 draws it as the «deploy» arrow',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE.deploy,
    allowed: UML_DEPLOY_MATRIX,
  },
};

/**
 * **U18** — a `«manifest»` arrow that does not run from an artefact to a
 * component.
 *
 * §19.3.3: the Artifact owns the Manifestations, each representing the
 * utilization of some model element, and §19.3.5's figure draws the one this
 * notation is used for — an artefact and the component it embodies. An arrow
 * drawn the other way round, or one aimed at the NODE the artefact happens to
 * sit on, is the deployment story told with the wrong word.
 *
 * {@link deployEndpoints}' twin, and the two never double-report: an edge
 * carries one role, `uml:deploy` and `uml:manifest` are flat siblings, and each
 * rule reads its own.
 */
const manifestEndpoints: ValidationRule = {
  id: 'uml.manifest-endpoints',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.manifest-endpoints',
  messageFallback:
    'This manifestation does not run from an artefact to a component.',
  suggestionKey: 'com.labre.uml.validation.manifest-endpoints.suggestion',
  suggestionFallback:
    'A manifestation says "this file embodies that component", so it leaves the artefact and arrives on the component. If what you meant is where the file is installed, draw a deployment to the node instead.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §19.3.3 — an Artifact owns its Manifestations, each the utilization of a PackageableElement; §19.3.4 draws it as the «manifest» arrow',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE.manifest,
    allowed: UML_MANIFEST_MATRIX,
  },
};

/**
 * **U19** — a communication path drawn to something that is not a node.
 *
 * §19.4.3, and one of the few clauses in the whole specification that types a
 * relationship in a single sentence: a CommunicationPath is an Association
 * between two DeploymentTargets. A network line drawn to a `.jar` or to a
 * component box is the confusion this rule is for — the SOFTWARE does not talk
 * to a machine, the machine it runs on does, and the drawing that says otherwise
 * has skipped the node.
 *
 * Both ends are `uml:node`, so a device connected to an execution environment is
 * sanctioned through the parent role and never mentioned.
 */
const communicationPathEndpoints: ValidationRule = {
  id: 'uml.communication-path-endpoints',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.communication-path-endpoints',
  messageFallback: 'This communication path has an end that is not a node.',
  suggestionKey:
    'com.labre.uml.validation.communication-path-endpoints.suggestion',
  suggestionFallback:
    'A communication path joins two machines — nodes, devices or execution environments — so that they can exchange messages. Draw it between the two cubes, and let the deployment arrows say which software sits on each.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §19.4.3 — a CommunicationPath is an Association between two DeploymentTargets, through which they may exchange Signals and Messages',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE['communication-path'],
    allowed: UML_COMMUNICATION_PATH_MATRIX,
  },
};

/**
 * **U14** — a plain connector between two UML artefacts.
 *
 * The gap every other rule in this file falls through, and C4's `untyped-link`
 * and BPMN's `B4` one framework over. The UML relationship tools stamp a role;
 * quick-connect and auto-complete do not, so releasing the canvas' own link
 * gesture between two boxes produces a connector carrying NO role — which says
 * nothing to any grammar, nothing to the degree counts and nothing to the
 * exporters. A diagram joined that way LOOKS connected, exports as if nobody had
 * joined anything, and reads on screen as a finished drawing.
 *
 * So the rule is not really about the connector: it is about the verdicts and the
 * exports that go quiet behind it.
 *
 * ## Why it declares a matrix it never judges anything against
 *
 * `flagNeutral` reads the rule's own ALPHABET to decide which role-less links it
 * may presume were meant as relationships, so {@link UML_ELEMENT_MATRIX} is how
 * this rule says "between two UML artefacts" — and, by saying only that, how it
 * stays silent about everything else. A plain connector onto the frame, onto a
 * subject, onto a compartment, onto a sticky note, onto a shape somebody dropped
 * to think with is an annotation and none of UML's business.
 *
 * Nothing else in the declaration fires: the matrix sanctions all thirty-six
 * ordered pairs, so off-matrix is structurally unreachable here and the actor →
 * actor sentence stays {@link actorActorAssociation}'s finding alone.
 * `forbidSelfLoop` is absent for the same reason. This rule raises exactly one
 * kind of finding.
 */
const untypedEdge: ValidationRule = {
  id: 'uml.untyped-edge',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  // The rule's own words are never read: `flagNeutral` is the only verdict it can
  // reach, and it carries its own. Declared all the same, because the shape
  // requires them and a rule with no sentence is a rule nobody can review.
  messageKey: 'com.labre.uml.validation.untyped-edge',
  messageFallback:
    'This link between two UML artefacts says nothing the model records.',
  suggestionKey: 'com.labre.uml.validation.untyped-edge.suggestion',
  suggestionFallback:
    'Draw it again with one of the relationship tools. A plain connector is on the diagram and absent from the model, so nothing can be said about what it means, which way round it reads, or how to write it into a file.',
  version: 1,
  provenance: {
    source: 'labre-convention',
    reference:
      'Labre convention — a role-less connector is a gesture of this canvas, not an artefact of the notation',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    // Any of the nine would do — the neutral pass reads no edge role — and the
    // association is the one a user reaching for a line most often means.
    edgeRole: UML_ROLE.association,
    allowed: UML_ELEMENT_MATRIX,
    flagNeutral: {
      messageKey: 'com.labre.uml.validation.untyped-edge.neutral',
      messageFallback: 'These two artefacts are joined by an untyped link.',
      suggestionKey: 'com.labre.uml.validation.untyped-edge.neutral.suggestion',
      suggestionFallback:
        'The diagram shows a line and the model holds none — nothing associates, specialises or depends on anything here. Draw it again with an association, a generalization, a realization or a dependency so it can carry a direction and be exported.',
    },
  },
};

/* ── Degree: how many lines may reach one artefact? ─────────────────────── */

/**
 * **U15** — a part claimed by two composites.
 *
 * §11.5.3, and one of the few genuinely arithmetic constraints the notation has:
 * composition is a whole/part relationship in which the part's lifetime is the
 * whole's, so an object may be a part of at most one composite at a time. Two
 * filled diamonds pointing at the same box is a drawing that cannot be built.
 *
 * ## The PART is the target end
 *
 * `roles.ts` is explicit: for an aggregation and a composition the source is the
 * WHOLE — the end that carries the diamond, which `actions.ts` arms as the
 * connector's front endpoint. So the part is where the line ARRIVES, and the
 * bound is `maxIn: 1`.
 *
 * Aggregation is deliberately not counted: §11.5.4's shared aggregation has no
 * such constraint — a part may be shared by many wholes, which is the whole
 * difference between the hollow diamond and the filled one — and `uml:composition`
 * is a role of its own precisely so a rule can say one and not the other.
 *
 * ## Written on the classifiers, like {@link elementOutsideFrame}
 *
 * `edge-degree` names one subject role. A composition pointing at an instance or
 * a package is a stranger drawing than this rule's, and one
 * {@link dependencyOnObject}'s neighbourhood already covers in spirit; the part
 * of a composite is a classifier in every drawing anybody makes.
 */
const compositionSingleOwner: ValidationRule = {
  id: 'uml.composition-single-owner',
  framework: 'uml',
  family: 'edge-degree',
  severity: 'audit',
  appliesTo: UML_ROLE.classifier,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.composition-single-owner',
  messageFallback: 'Two compositions claim this part.',
  suggestionKey: 'com.labre.uml.validation.composition-single-owner.suggestion',
  suggestionFallback:
    'A composite owns its parts’ lifetime, so a part belongs to one whole at a time. Keep the composition that really owns it and make the other an aggregation — the hollow diamond, which is exactly the "shared part" the notation has.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §11.5.3 — a composite object is responsible for the existence of its parts; an object may be part of at most one composite at a time',
  },
  backgroundRole: UML_ROLE.diagram,
  degree: {
    edgeRole: UML_ROLE.composition,
    // The PART is where the diamond's line ARRIVES — see the header.
    maxIn: 1,
  },
};

/**
 * **U16** — a use case no actor is associated with.
 *
 * Not a constraint of the specification and it says so: §18.1 is perfectly happy
 * with a use case nobody has drawn an actor for, and there are real diagrams —
 * an included behaviour, a use case reached only through an extend — where that
 * is the right drawing.
 *
 * It is a USAGE remark, and the most useful one a finished use case diagram can
 * be given: a use case is a behaviour the system performs FOR somebody, so an
 * ellipse with no actor on either end is usually a use case whose actor has not
 * been drawn yet, or a system function that is not a use case at all.
 *
 * `eitherMin: 1` — at least one association on ONE side. The four ordinary bounds
 * cannot say it: `minIn: 1` indicts every use case an actor associates FROM,
 * `minOut: 1` every one drawn the other way round, and both together indict a
 * conformant diagram end to end. The direction of an association is not a fact
 * about the model (`roles.ts`: an association is UNDIRECTED), so the only honest
 * bound is the disjunctive one.
 *
 * `audit` at BOTH levels — `uml.strict` leaves it here — because the finding is
 * "this diagram is not finished", and not-finished is what a panel is for.
 */
const useCaseNoActor: ValidationRule = {
  id: 'uml.use-case-no-actor',
  framework: 'uml',
  family: 'edge-degree',
  severity: 'audit',
  appliesTo: UML_ROLE['use-case'],
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.use-case-no-actor',
  messageFallback: 'No actor is associated with this use case.',
  suggestionKey: 'com.labre.uml.validation.use-case-no-actor.suggestion',
  suggestionFallback:
    'A use case is something the system does for somebody. Draw the association to the actor it serves — or, if it is only ever reached from another use case, leave it: this is a remark, not a rule.',
  version: 1,
  provenance: {
    source: 'labre-convention',
    reference:
      'Labre convention — UML states no such constraint; a use case with no actor is usually a diagram somebody has not finished',
  },
  backgroundRole: UML_ROLE.diagram,
  degree: {
    edgeRole: UML_ROLE.association,
    // One association on EITHER side — see the header on why no conjunction of
    // the per-direction bounds expresses this.
    eitherMin: 1,
  },
};

/* ── Behaviour: the alphabets and the grammars of the two flow sheets ────── */

/**
 * The ACTIVITY vertices — what a flow may be drawn between on an `act` sheet.
 *
 * `uml:control-node` stands for its five children by declaration (`roles.ts`),
 * so the initial disc, the two finals, the decision diamond and the fork bar
 * arrive through `roleIsA` rather than as five entries. The object node is
 * deliberately NOT here: §15.7.9.4 keeps it off a control flow, which is the
 * whole content of {@link UML_CONTROL_FLOW_MATRIX}.
 */
const UML_ACTIVITY_VERTEX_ROLES: readonly RoleId[] = [
  UML_ROLE.action,
  UML_ROLE['control-node'],
  UML_ROLE['send-signal'],
  UML_ROLE['accept-event'],
  UML_ROLE['time-event'],
];

/**
 * The STATE MACHINE vertices — §14.5.12's "source Vertex" and "target Vertex".
 *
 * `uml:pseudostate` stands for the choice, the junction, the two histories, the
 * two connection points and the terminate cross. `uml:initial` is named beside
 * it rather than through it, because `roles.ts` files the initial disc under
 * `uml:control-node` — the same glyph means the same thing on both sheets, and
 * the vocabulary says so once instead of declaring it twice. `uml:fork` is here
 * for the same cross-family reason: §14.2.4 draws the fork and join bars in a
 * state machine and §15.3.4 draws them in an activity, and one role carries both.
 */
const UML_STATE_VERTEX_ROLES: readonly RoleId[] = [
  UML_ROLE.state,
  UML_ROLE['final-state'],
  UML_ROLE.pseudostate,
  UML_ROLE.initial,
  UML_ROLE.fork,
];

/**
 * ALPHABET entries for the state-machine vocabulary, carried by the two ACTIVITY
 * grammars.
 *
 * The device the file header explains, applied across the two behaviour sheets:
 * these are true sentences of §14.5.12 carrying the `uml:transition` role, so
 * `inMatrix` — which matches a triplet's edge with `roleIsA` — can never let one
 * sanction a control flow or an object flow. Their whole effect is to put
 * `uml:state`, `uml:final-state` and `uml:pseudostate` into the alphabet the two
 * activity rules speak, which is what makes "a control flow dragged onto a
 * state" a finding rather than silence.
 */
const UML_STATE_ALPHABET: readonly EndpointTriplet[] = [
  {
    source: UML_ROLE.state,
    edge: UML_ROLE.transition,
    target: UML_ROLE.state,
  },
  {
    source: UML_ROLE.state,
    edge: UML_ROLE.transition,
    target: UML_ROLE['final-state'],
  },
  {
    source: UML_ROLE.pseudostate,
    edge: UML_ROLE.transition,
    target: UML_ROLE.state,
  },
];

/**
 * ALPHABET entries for the activity vocabulary, carried by the TRANSITION
 * grammar — the mirror of {@link UML_STATE_ALPHABET}.
 *
 * Three foreign sentences putting `uml:action`, `uml:control-node` and
 * `uml:object-node` into the alphabet {@link transitionEndpoints} speaks. The
 * control-node entry is the one that earns its place twice over: it is what makes
 * a transition drawn onto a DECISION diamond a finding, because a decision is
 * §15.3.4's branch and `uml:choice` is §14.2.4's — two glyphs that look alike,
 * mean the same thing on two different sheets, and are the commonest confusion
 * this pair of diagrams produces.
 */
const UML_ACTIVITY_ALPHABET: readonly EndpointTriplet[] = [
  {
    source: UML_ROLE.action,
    edge: UML_ROLE['control-flow'],
    target: UML_ROLE['control-node'],
  },
  {
    source: UML_ROLE['object-node'],
    edge: UML_ROLE['object-flow'],
    target: UML_ROLE.action,
  },
  // …and the class-side vocabulary, so a behaviour edge dragged onto a class is
  // judged rather than ignored. `uml:classifier` reaches all three of them.
  {
    source: UML_ROLE.classifier,
    edge: UML_ROLE.association,
    target: UML_ROLE.classifier,
  },
];

/**
 * What a CONTROL FLOW may run between: the activity vertices, and never an
 * object node.
 *
 * §15.7.9.4 is one of the few constraints in Clause 15 that OCL can state in a
 * line — "ControlFlows may not have ObjectNodes at either end, except for
 * ObjectNodes with control type" — and the exception is the reason the rule that
 * holds this table stays a remark rather than a defect: `isControlType` is a
 * property of the metamodel with no notation at all (§15.4.4 draws the same
 * rectangle either way), so a canvas cannot say which of the two an author meant.
 * The table therefore reports the drawing the specification's own default
 * forbids, and the rule's suggestion names the exception.
 *
 * Twenty-five sentences over five roles, plus the four alphabet entries: the
 * grammar judges WHICH vertices, never how many edges reach one. The counts are
 * {@link initialNoIncomingFlow}, {@link activityFinalNoOutgoing},
 * {@link flowFinalNoOutgoing} and {@link decisionIncomingCount}, and keeping the
 * two apart is what stops one wrong arrow being reported twice.
 */
export const UML_CONTROL_FLOW_MATRIX: readonly EndpointTriplet[] = [
  ...UML_ACTIVITY_VERTEX_ROLES.flatMap(source =>
    UML_ACTIVITY_VERTEX_ROLES.map(target => ({
      source,
      edge: UML_ROLE['control-flow'],
      target,
    }))
  ),
  // The ALPHABET entries — the state-machine vocabulary, and the class-side one.
  ...UML_STATE_ALPHABET,
  {
    source: UML_ROLE.classifier,
    edge: UML_ROLE.association,
    target: UML_ROLE.classifier,
  },
  // …and the object node, named by a sentence of the OTHER flow so that it is in
  // the alphabet and outside the grammar. Without it a control flow drawn onto a
  // rectangle of data would be unjudged, which is the one drawing §15.7.9.4
  // actually names.
  {
    source: UML_ROLE['object-node'],
    edge: UML_ROLE['object-flow'],
    target: UML_ROLE.action,
  },
];

/**
 * What an OBJECT FLOW may run between: something, and an object node.
 *
 * §15.7.11.4's `same_upper_bounds` states the shape of it — "ObjectNodes
 * connected by an ObjectFlow, with optionally intervening ControlNodes" — so an
 * object flow is a line between DATA, routed through control nodes where it
 * forks or merges. One end being an object node is the loosest honest reading of
 * that, and it is the one drawn here: the strict reading (both ends) would indict
 * the object node that feeds a decision, which §15.7.11.4 explicitly allows.
 *
 * ## Why the rule that holds this stays a remark at every level
 *
 * §15.4.4 draws an action's PINS as small squares on its border and says in as
 * many words that they may be elided, in which case the object flow is drawn
 * from one action straight to the other. A pin IS an ObjectNode, so that drawing
 * is a legal elision of a conformant model and not a defect — and this canvas
 * has no pin. So the finding is "there is no data node on this flow", which is a
 * reading worth offering and never a conformance defect, and `uml.strict` leaves
 * it at `audit` for that reason alone (`profiles.ts`).
 */
const UML_OBJECT_FLOW_ENDS: readonly RoleId[] = [
  ...UML_ACTIVITY_VERTEX_ROLES,
  UML_ROLE['object-node'],
];

export const UML_OBJECT_FLOW_MATRIX: readonly EndpointTriplet[] = [
  ...UML_OBJECT_FLOW_ENDS.map(target => ({
    source: UML_ROLE['object-node'],
    edge: UML_ROLE['object-flow'],
    target,
  })),
  ...UML_OBJECT_FLOW_ENDS.filter(
    source => source !== UML_ROLE['object-node']
  ).map(source => ({
    source,
    edge: UML_ROLE['object-flow'],
    target: UML_ROLE['object-node'],
  })),
  // The ALPHABET entries — the state-machine vocabulary, and the class-side one.
  ...UML_STATE_ALPHABET,
  {
    source: UML_ROLE.classifier,
    edge: UML_ROLE.association,
    target: UML_ROLE.classifier,
  },
];

/**
 * What a TRANSITION may run between: the vertices of a state machine, and
 * nothing else.
 *
 * §14.5.12 in one sentence — "A Transition is a single directed arc originating
 * from a single source Vertex and terminating on a single target Vertex" — and a
 * Vertex is a State, a FinalState or a Pseudostate (§14.5.14). So the table is
 * the full square over {@link UML_STATE_VERTEX_ROLES}: twenty-five sentences,
 * judging WHICH vertices and not how many arcs reach one.
 *
 * ## The square is deliberate, and it is what stops the double report
 *
 * A transition INTO an initial disc and a transition OUT OF a final state are
 * both wrong, and both are already said — by {@link initialNoIncomingTransition}
 * and {@link finalStateNoOutgoing}, each of which names the side the author has
 * to act on. Removing those two sentences from this table would make the same
 * arrow off-matrix as well, and the user would get two brackets and two
 * suggestions for one drag to fix. The DEGREE rules own the counts; this table
 * owns the vocabulary.
 */
export const UML_TRANSITION_MATRIX: readonly EndpointTriplet[] = [
  ...UML_STATE_VERTEX_ROLES.flatMap(source =>
    UML_STATE_VERTEX_ROLES.map(target => ({
      source,
      edge: UML_ROLE.transition,
      target,
    }))
  ),
  // The ALPHABET entries — the activity vocabulary, and the class-side one.
  ...UML_ACTIVITY_ALPHABET,
];

/* ── Behaviour: membership in a lane and in a composite state ───────────── */

/**
 * **U20** — an action drawn outside every partition, while partitions exist.
 *
 * §15.6.4 draws an ActivityPartition as a swimlane: a band across the sheet with
 * a name at its head, holding the actions whoever the band names is responsible
 * for. The lanes are what the diagram is FOR once they are drawn — a reader
 * follows the flow across them to see where responsibility changes hands — and
 * an action floating between two of them belongs to nobody.
 *
 * ## The family is `element-in-background`, and the silence is the whole point
 *
 * {@link useCaseOutsideSubject}'s arrangement one notation over: a partition on
 * the board is the frame, an action contained by NONE of them is the finding,
 * and a board with no partition at all is total silence. Most activity diagrams
 * never draw a lane, and those are complete diagrams — the rule speaks only once
 * an author has said that responsibility is part of what this sheet shows.
 *
 * ## Written on the ACTION, and the limit that follows
 *
 * `element-in-background` names one subject role. The control nodes, the object
 * nodes and the three signal artefacts drawn between the lanes raise nothing —
 * and that is the right narrowing rather than a shortfall: §15.6.3 attributes
 * BEHAVIOUR to a partition, a decision diamond routing a flow between two lanes
 * is routinely drawn on the boundary on purpose, and a fork bar spanning three
 * lanes is §15.6.4's own figure. The action is the artefact a lane is about.
 */
const nodeInPartition: ValidationRule = {
  id: 'uml.node-in-partition',
  framework: 'uml',
  family: 'element-in-background',
  severity: 'audit',
  appliesTo: UML_ROLE.action,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.node-in-partition',
  messageFallback: 'This action sits outside every partition.',
  suggestionKey: 'com.labre.uml.validation.node-in-partition.suggestion',
  suggestionFallback:
    'The swimlanes say who is responsible for each step. Move the action into the lane that owns it, or stretch the lane round it — a diagram that draws lanes is read by following the flow across them.',
  version: 1,
  provenance: {
    source: 'labre-convention',
    reference:
      'Labre convention — OMG UML 2.5.1 §15.6.4 draws the swimlane; requiring an action to be inside one once lanes exist is membership on this canvas',
  },
  backgroundRole: UML_ROLE.partition,
};

/**
 * **U21 / U22** — a history pseudostate drawn outside every composite state.
 *
 * §14.2.3: a shallow history "represents the most recent active substate of its
 * containing Region" and a deep history the most recent configuration of the
 * whole sub-machine. Both are statements ABOUT a region, and a region on this
 * canvas is the `umlRegion` box the author drew (`roles.ts` records why the
 * composite state IS the frame). An `H` circle floating on the top-level sheet
 * therefore remembers the history of nothing.
 *
 * ## TWO rules for one sentence, and the reason is the family
 *
 * `element-in-background` names ONE subject role, and the vocabulary has no
 * parent meaning "a history": `uml:shallow-history` and `uml:deep-history` are
 * flat siblings under `uml:pseudostate`, which also covers the choice, the
 * junction, the two connection points and the terminate cross — none of which is
 * confined to a region. A rule written on the parent would indict every choice
 * diamond on a flat state machine, which is most of them.
 *
 * So the pack ships the sentence twice, and nothing is reported twice: an element
 * carries one role, so exactly one of the two can ever be about it. The same
 * split {@link initialNoIncomingFlow} and {@link initialNoIncomingTransition}
 * make for the other reason a family names one thing at a time.
 *
 * The provenance is `recommendation` rather than `standard` because the step from
 * §14.2.3's OWNERSHIP to this canvas's CONTAINMENT is ours: the metamodel says
 * the Pseudostate belongs to a Region, and reading a drawn box as that ownership
 * is the reading `roles.ts` chose, not a clause.
 */
const shallowHistoryOutsideRegion: ValidationRule = {
  id: 'uml.shallow-history-outside-region',
  framework: 'uml',
  family: 'element-in-background',
  severity: 'audit',
  appliesTo: UML_ROLE['shallow-history'],
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.shallow-history-outside-region',
  messageFallback: 'This history is drawn outside every composite state.',
  suggestionKey:
    'com.labre.uml.validation.shallow-history-outside-region.suggestion',
  suggestionFallback:
    'A history remembers where a composite state was when it was last left, so it has to be drawn inside the one it remembers. Move the H into the composite state, or draw the composite state round it.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'OMG UML 2.5.1 §14.2.3 — a shallowHistory Pseudostate represents the most recent active substate of its containing Region',
  },
  backgroundRole: UML_ROLE.region,
};

const deepHistoryOutsideRegion: ValidationRule = {
  id: 'uml.deep-history-outside-region',
  framework: 'uml',
  family: 'element-in-background',
  severity: 'audit',
  appliesTo: UML_ROLE['deep-history'],
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.deep-history-outside-region',
  messageFallback: 'This deep history is drawn outside every composite state.',
  suggestionKey:
    'com.labre.uml.validation.deep-history-outside-region.suggestion',
  suggestionFallback:
    'A deep history restores the whole configuration a composite state was last in, so it has to be drawn inside the one it restores. Move the H* into the composite state, or draw the composite state round it.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'OMG UML 2.5.1 §14.2.3 — a deepHistory Pseudostate represents the most recent active state configuration of its containing Region',
  },
  backgroundRole: UML_ROLE.region,
};

/* ── Behaviour: how many beginnings, and how many lines reach one ───────── */

/**
 * **U23** — a second filled disc on one sheet.
 *
 * The one rule in this pack whose authority differs between the two sheets it
 * speaks on, and it says so rather than picking the flattering half:
 *
 *  - on a **state machine**, §14.5.6.4 is normative and arithmetic — "A Region
 *    can have at most one initial Vertex";
 *  - on an **activity**, §15.3.3 says the opposite in as many words — "An
 *    Activity may have more than one InitialNode", each one starting a concurrent
 *    flow.
 *
 * So the provenance is `recommendation`: a second disc on an activity sheet is a
 * drawing the specification permits, and most of the ones anybody draws are a
 * disc the author forgot to delete rather than a deliberate concurrent start. The
 * rule offers the reading and never claims UML forbids it, which is the whole
 * point of the field.
 *
 * ## Counted per DIAGRAM, and the refinement that is not phase 2's
 *
 * §14.5.6.4's bound is per REGION, and a state machine with three composite
 * states legitimately holds four initial discs — one for the top level and one
 * inside each. `role-count` counts per instance of ONE frame, named by
 * `backgroundRole`, and this rule names the diagram: the per-region reading needs
 * the same bound counted against `uml:region` instances as well, which is a
 * second rule of the same family and a PHASE 3 refinement. Until it lands a
 * composite state with its own beginning is a finding here, which is the wrong
 * verdict on a right drawing — and the reason this rule is `audit` in the default
 * profile like everything else, rather than something a user has to argue with.
 *
 * The finding lands on the FRAME, because no disc is at fault: there are simply
 * two, and `role-count` raises on the instance so an arbitration made on one
 * sheet covers that sheet alone.
 */
const initialSingle: ValidationRule = {
  id: 'uml.initial-single',
  framework: 'uml',
  family: 'role-count',
  severity: 'audit',
  // No `appliesTo`: `role-count` names its subject in `roleCount.subject`, and
  // the finding is about the frame rather than about any one element.
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.initial-single',
  messageFallback: 'This sheet draws more than one beginning.',
  suggestionKey: 'com.labre.uml.validation.initial-single.suggestion',
  suggestionFallback:
    'A state machine region has at most one initial vertex, and a reader looks for one place the behaviour starts. Keep the disc the flow really begins at and delete the others — unless the sheet is an activity deliberately starting several concurrent flows, which UML allows.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'OMG UML 2.5.1 §14.5.6.4 — "A Region can have at most one initial Vertex"; §15.3.3 allows an Activity more than one InitialNode, so on an activity sheet this is a reading rather than a clause',
  },
  backgroundRole: UML_ROLE.diagram,
  roleCount: {
    subject: UML_ROLE.initial,
    max: 1,
  },
};

/**
 * **U24** — a control flow pointing AT the disc the flow begins at.
 *
 * §15.3.3, verbatim: "An InitialNode shall not have any incoming ActivityEdges."
 * An arrow into the black disc is almost always an arrow drawn the wrong way
 * round, and the fix is one drag.
 *
 * ## Two rules, one sentence, and the family is the reason
 *
 * `edge-degree` counts ONE edge role. The same disc is §14.2.4's initial
 * Pseudostate on a state machine, where the arrow that must not exist is a
 * TRANSITION and not a control flow, so the requirement is two counts over two
 * vocabularies. They never double-report — an edge carries one role, and the two
 * roles are flat siblings — and they carry different authority, which is the
 * second reason to keep them apart: §15.3.3 states the activity half outright,
 * while the state machine half is a reading of §14.2.3 (see
 * {@link initialNoIncomingTransition}).
 *
 * ## The object flow is not counted, and that is deliberate
 *
 * §15.3.3's next sentence — "The outgoing ActivityEdges of an InitialNode must
 * all be ControlFlows" — would make an object flow at either end of a disc a
 * finding too. It is not asked here: a third rule would be a third bracket on the
 * same glyph, and an object flow drawn onto a control node is already
 * {@link objectFlowEndpoints}' business through its own matrix.
 */
const initialNoIncomingFlow: ValidationRule = {
  id: 'uml.initial-no-incoming-flow',
  framework: 'uml',
  family: 'edge-degree',
  severity: 'audit',
  appliesTo: UML_ROLE.initial,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.initial-no-incoming-flow',
  messageFallback: 'A control flow points at the node this activity begins at.',
  suggestionKey: 'com.labre.uml.validation.initial-no-incoming-flow.suggestion',
  suggestionFallback:
    'The filled disc is where the flow starts, so nothing arrives at it. Turn the arrow round, or point it at the first action instead — and if the flow really does come back here, it comes back to that action.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §15.3.3 — "An InitialNode shall not have any incoming ActivityEdges"',
  },
  backgroundRole: UML_ROLE.diagram,
  degree: {
    edgeRole: UML_ROLE['control-flow'],
    maxIn: 0,
  },
};

/**
 * **U25** — a transition pointing AT the disc a state machine begins at.
 *
 * {@link initialNoIncomingFlow}'s twin over the state machine vocabulary. §14.2.3
 * describes the initial Pseudostate as "a starting point for a Region; that is,
 * it is the point from which execution begins", and §14.5.6.4 gives it at most
 * one OUTGOING transition — the clause constrains what leaves and says nothing
 * about what arrives, because a Vertex nothing can reach is not a case the
 * metamodel needed to exclude.
 *
 * So the provenance is `recommendation` where its activity twin is `standard`,
 * and the two rules are a small demonstration of why the field exists: the same
 * drawing, the same fix, and one of them is a conformance defect while the other
 * is the tool being helpful.
 */
const initialNoIncomingTransition: ValidationRule = {
  id: 'uml.initial-no-incoming-transition',
  framework: 'uml',
  family: 'edge-degree',
  severity: 'audit',
  appliesTo: UML_ROLE.initial,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.initial-no-incoming-transition',
  messageFallback:
    'A transition points at the node this state machine begins at.',
  suggestionKey:
    'com.labre.uml.validation.initial-no-incoming-transition.suggestion',
  suggestionFallback:
    'The filled disc is where the machine starts, so nothing transitions into it. Point the arrow at the state the machine should return to instead.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'OMG UML 2.5.1 §14.2.3 — an initial Pseudostate is the point from which execution begins; §14.5.6.4 constrains what leaves it and not what arrives',
  },
  backgroundRole: UML_ROLE.diagram,
  degree: {
    edgeRole: UML_ROLE.transition,
    maxIn: 0,
  },
};

/**
 * **U26 / U27** — a flow leaving a node that ends one.
 *
 * §15.7.19.4, verbatim and for both of them: "A FinalNode has no outgoing
 * ActivityEdges." An activity final stops every flow in the activity and a flow
 * final destroys the one token that reached it — in neither case is there
 * anything left to leave.
 *
 * TWO rules again, and this time because the vocabulary is flat where the
 * metamodel is not: §15.7.19 makes ActivityFinalNode and FlowFinalNode two
 * FinalNodes, and `roles.ts` files both directly under `uml:control-node`
 * alongside the initial disc, the decision and the fork — so there is no
 * ancestor meaning "a final" that does not also reach the four glyphs a flow
 * legitimately leaves. Naming the two is the only reading that is right about
 * both.
 *
 * Their sentences differ, and deliberately: what a reader has to understand is
 * different. An arrow off an activity final says the author thinks the activity
 * continues; an arrow off a flow final says they think one branch does.
 */
const activityFinalNoOutgoing: ValidationRule = {
  id: 'uml.activity-final-no-outgoing',
  framework: 'uml',
  family: 'edge-degree',
  severity: 'audit',
  appliesTo: UML_ROLE['activity-final'],
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.activity-final-no-outgoing',
  messageFallback: 'A control flow leaves the node this activity ends at.',
  suggestionKey:
    'com.labre.uml.validation.activity-final-no-outgoing.suggestion',
  suggestionFallback:
    'The bullseye stops every flow in the activity, so nothing continues past it. Draw the arrow from the last action instead — or, if only this branch ends here, use the flow final (the circle with the cross).',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §15.7.19.4 — "A FinalNode has no outgoing ActivityEdges"',
  },
  backgroundRole: UML_ROLE.diagram,
  degree: {
    edgeRole: UML_ROLE['control-flow'],
    maxOut: 0,
  },
};

const flowFinalNoOutgoing: ValidationRule = {
  id: 'uml.flow-final-no-outgoing',
  framework: 'uml',
  family: 'edge-degree',
  severity: 'audit',
  appliesTo: UML_ROLE['flow-final'],
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.flow-final-no-outgoing',
  messageFallback: 'A control flow leaves the node this branch ends at.',
  suggestionKey: 'com.labre.uml.validation.flow-final-no-outgoing.suggestion',
  suggestionFallback:
    'The circle with the cross destroys the token that reaches it, so this branch stops there. Draw the arrow from the action before it, or delete the flow final if the branch does carry on.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §15.7.19.4 — "A FinalNode has no outgoing ActivityEdges"',
  },
  backgroundRole: UML_ROLE.diagram,
  degree: {
    edgeRole: UML_ROLE['control-flow'],
    maxOut: 0,
  },
};

/**
 * **U28** — a transition leaving a final state.
 *
 * §14.5.11.4, verbatim: "A FinalState cannot have any outgoing Transitions." The
 * same shape as the two above, one notation over, and the same one-drag fix.
 */
const finalStateNoOutgoing: ValidationRule = {
  id: 'uml.final-state-no-outgoing',
  framework: 'uml',
  family: 'edge-degree',
  severity: 'audit',
  appliesTo: UML_ROLE['final-state'],
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.final-state-no-outgoing',
  messageFallback: 'A transition leaves this final state.',
  suggestionKey: 'com.labre.uml.validation.final-state-no-outgoing.suggestion',
  suggestionFallback:
    'A final state is where the machine stops, so nothing transitions out of it. Draw the transition from the state before it — and if the machine really does carry on, this is not the end.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §14.5.11.4 — "A FinalState cannot have any outgoing Transitions"',
  },
  backgroundRole: UML_ROLE.diagram,
  degree: {
    edgeRole: UML_ROLE.transition,
    maxOut: 0,
  },
};

/**
 * **U29** — a decision diamond fed by three arrows.
 *
 * §15.7.11.4, and it is arithmetic: "A DecisionNode has one or two incoming
 * ActivityEdges and at least one outgoing ActivityEdge." TWO rather than one,
 * because the second incoming edge has a job — §15.3.4's `decisionInputFlow`
 * carries the value the guards are evaluated against — and a diamond with three
 * arrows into it is a merge somebody drew as a decision.
 *
 * ## `maxIn: 2`, and not the `maxIn: 1` a reader might expect
 *
 * Worth stating because the id would let you assume otherwise and because the
 * brief this rule was written from asked for one. The clause says two, the second
 * one is a real and named feature of the notation, and data that contradicts the
 * clause it cites is the one thing this pack cannot ship. The id names the
 * QUESTION — how many arrive — rather than the bound.
 *
 * ## The floor is not asked for
 *
 * "At least one incoming" would fire on every diamond for the whole of the time
 * between dropping it and joining it up, which is the definition of a rule that
 * argues with a croquis. The ceiling is the half that reports a mistake rather
 * than an unfinished drawing.
 */
const decisionIncomingCount: ValidationRule = {
  id: 'uml.decision-incoming-count',
  framework: 'uml',
  family: 'edge-degree',
  severity: 'audit',
  appliesTo: UML_ROLE.decision,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.decision-incoming-count',
  messageFallback: 'More than two control flows arrive at this decision.',
  suggestionKey: 'com.labre.uml.validation.decision-incoming-count.suggestion',
  suggestionFallback:
    'A decision takes the flow it branches and, at most, a second one carrying the value its guards test. If these arrows are branches coming back together, draw a merge — the same diamond, with the arrows leaving it joined into one.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §15.7.11.4 — "A DecisionNode has one or two incoming ActivityEdges and at least one outgoing ActivityEdge"',
  },
  backgroundRole: UML_ROLE.diagram,
  degree: {
    edgeRole: UML_ROLE['control-flow'],
    // TWO, which is what the clause says — see the header on why the id does not
    // name the bound.
    maxIn: 2,
  },
};

/* ── Behaviour: what each flow may run between ──────────────────────────── */

/**
 * **U30** — a control flow with an object node, a state or a class at one end.
 *
 * §15.7.9.4's `object_nodes` constraint, and the alphabet entries that let this
 * rule reach the two confusions a mixed board actually produces: a control flow
 * dragged onto a STATE (the state machine sheet's vocabulary, one tool away in
 * the same menu) and a control flow dragged onto a CLASS.
 *
 * The object node is the clause's own case and the one with an exception: an
 * ObjectNode whose `isControlType` is true may sit on a control flow, and
 * §15.4.4 gives that property no notation at all, so a drawing cannot state it.
 * The suggestion names the exception rather than hiding it, which is what keeps
 * the finding honest at `audit` — and what makes this the endpoint rule a reader
 * may reasonably overrule.
 */
const controlFlowEndpoints: ValidationRule = {
  id: 'uml.control-flow-endpoints',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.control-flow-endpoints',
  messageFallback:
    'This control flow runs between artefacts an activity does not route control through.',
  suggestionKey: 'com.labre.uml.validation.control-flow-endpoints.suggestion',
  suggestionFallback:
    'A control flow joins actions, control nodes and the signal artefacts. Draw an object flow if what travels is data, a transition if these are states — and if this really is a control-typed object node, the notation has no way of saying so and the remark can be waived.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §15.7.9.4 — "ControlFlows may not have ObjectNodes at either end, except for ObjectNodes with control type"',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE['control-flow'],
    allowed: UML_CONTROL_FLOW_MATRIX,
  },
};

/**
 * **U31** — an object flow that touches no data.
 *
 * §15.7.11.4's `same_upper_bounds` describes an object flow as a line between
 * ObjectNodes "with optionally intervening ControlNodes", so at least one end of
 * one is data. See {@link UML_OBJECT_FLOW_MATRIX} for why the reading is the
 * loose one, why the rule is a `recommendation` and why `uml.strict` is the one
 * endpoint rule it leaves alone: §15.4.4's elided PINS make the action-to-action
 * drawing a legal shorthand, and this canvas has no pin to draw.
 */
const objectFlowEndpoints: ValidationRule = {
  id: 'uml.object-flow-endpoints',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.object-flow-endpoints',
  messageFallback: 'Neither end of this object flow is a data node.',
  suggestionKey: 'com.labre.uml.validation.object-flow-endpoints.suggestion',
  suggestionFallback:
    'An object flow carries something: draw the object node it carries between the two actions, and name what travels. If what you meant is "this happens, then that happens", draw a control flow instead.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'OMG UML 2.5.1 §15.7.11.4 — ObjectNodes connected by an ObjectFlow, with optionally intervening ControlNodes; §15.4.4 elides the Pins that would be those nodes, so the action-to-action drawing is a shorthand rather than a defect',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE['object-flow'],
    allowed: UML_OBJECT_FLOW_MATRIX,
  },
};

/**
 * **U32** — a transition drawn onto something that is not a vertex.
 *
 * §14.5.12: a Transition runs from one Vertex to another, and a Vertex is a
 * State, a FinalState or a Pseudostate. The finding worth having is the one the
 * alphabet entries buy — a transition dragged onto a DECISION diamond, which is
 * §15.3.4's branch where §14.2.4's is the `<<choice>>`, and the commonest
 * confusion between these two sheets by a distance.
 *
 * See {@link UML_TRANSITION_MATRIX} for why the table over the vertices is the
 * full square rather than a grammar: the counts are owned by the degree rules,
 * and one wrong arrow gets one bracket.
 */
const transitionEndpoints: ValidationRule = {
  id: 'uml.transition-endpoints',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.transition-endpoints',
  messageFallback:
    'This transition runs between artefacts a state machine has no transitions between.',
  suggestionKey: 'com.labre.uml.validation.transition-endpoints.suggestion',
  suggestionFallback:
    'A transition joins states, final states and the pseudostates that route between them. A diamond on a state machine is the choice pseudostate, not the activity decision — swap it, or draw a control flow if this sheet is really an activity.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §14.5.12 — "A Transition is a single directed arc originating from a single source Vertex and terminating on a single target Vertex"',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE.transition,
    allowed: UML_TRANSITION_MATRIX,
  },
};

/* ── Behaviour: can the flow get there at all? ──────────────────────────── */

/**
 * **U33 / U34** — an action, or a state, no walk from the beginning ever
 * reaches.
 *
 * The orphan question, and the first one this pack asks that no amount of
 * looking at an element or at one line can answer: an action with a perfectly
 * good control flow on either side is still unreachable if the chain it belongs
 * to never starts anywhere. BPMN's `unreachable-step` is the same rule one
 * notation over, and the reasoning it records applies here whole.
 *
 * `implicitRoots` is on, and it is what makes the rules shippable: a node nothing
 * points at IS a beginning whether or not anybody drew the disc, so a second
 * branch drawn beside the first — and every activity in the thirty seconds before
 * its initial node goes down — is left alone. What survives is the real defect: a
 * RING entered from nowhere, where every step is pointed at and no walk reaches
 * any of them.
 *
 * ## Two rules, for the two vocabularies
 *
 * `reachability` follows ONE edge role, so the activity walk (control flow) and
 * the state machine walk (transition) are two declarations. Both start from
 * `uml:initial`, which is the one role the two sheets genuinely share, and both
 * are silent on a board carrying none of either kind of root.
 *
 * ## The subjects are the ACTION and the STATE, and nothing else
 *
 * `reachability` names one subject role. The object nodes, the signal artefacts
 * and the pseudostates are not walked for — a narrower rule that is right is
 * worth more than a wider one that guesses, and the artefact a reader asks "how
 * do we get here?" about is the step and the state.
 *
 * ## `on-demand`, for BPMN's reason exactly
 *
 * A graph sweep is O(V + E), rebuilds its adjacency every evaluation and cannot
 * be made incremental even in principle — reachability is global, so re-pointing
 * one arrow can orphan or rescue an arbitrary number of steps nowhere near it. It
 * stays out of the drawing budget and runs when somebody asks whether the diagram
 * is finished, which is also the only moment the answer is worth anything.
 */
const unreachableAction: ValidationRule = {
  id: 'uml.unreachable-action',
  framework: 'uml',
  family: 'reachability',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.unreachable-action',
  messageFallback: 'No flow from the beginning of this activity reaches here.',
  suggestionKey: 'com.labre.uml.validation.unreachable-action.suggestion',
  suggestionFallback:
    'Follow the control flows back from this action: somewhere the chain stops, or an arrow points the wrong way. Join it to the flow, or delete it if it no longer happens.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'Best practice — OMG UML 2.5.1 §15.3.3 seeds the flow at the InitialNodes and requires the reachability of nobody',
  },
  moment: 'on-demand',
  backgroundRole: UML_ROLE.diagram,
  reachability: {
    rootRole: UML_ROLE.initial,
    subjectRole: UML_ROLE.action,
    edgeRole: UML_ROLE['control-flow'],
    // An action nothing points at IS a beginning, whether or not anybody drew
    // the disc — see the header.
    implicitRoots: true,
  },
};

const unreachableState: ValidationRule = {
  id: 'uml.unreachable-state',
  framework: 'uml',
  family: 'reachability',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.unreachable-state',
  messageFallback:
    'No transition from the beginning of this machine reaches here.',
  suggestionKey: 'com.labre.uml.validation.unreachable-state.suggestion',
  suggestionFallback:
    'Follow the transitions back from this state: somewhere the chain stops, or an arrow points the wrong way. Join it to the machine, or delete it if the machine can no longer be in it.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'Best practice — OMG UML 2.5.1 §14.2.3 seeds execution at the initial Pseudostate and requires the reachability of nobody',
  },
  moment: 'on-demand',
  backgroundRole: UML_ROLE.diagram,
  reachability: {
    rootRole: UML_ROLE.initial,
    subjectRole: UML_ROLE.state,
    edgeRole: UML_ROLE.transition,
    implicitRoots: true,
  },
};

/* ── The interaction: what a message may run between ────────────────────── */

/**
 * The two artefacts a message may start from and land on — §17.4.4's sender and
 * receiver MessageEnds, as this canvas draws them.
 *
 * A LIFELINE is the participant itself, and an EXECUTION is the bar drawn on its
 * spine while it is doing something (§17.3.4: "apply a thin gray or white
 * rectangle that covers the Lifeline line"). Both are legal ends of the same
 * arrow, and which of the two an author aims at is a matter of how much detail
 * the drawing is carrying: the same call is drawn lifeline-to-lifeline on a
 * sketch and execution-to-execution once the activations are in. A grammar that
 * admitted one and not the other would indict half the sequence diagrams ever
 * drawn for being drawn at the wrong level of detail.
 *
 * The DESTRUCTION is deliberately not here: it is not an end a message may
 * generally reach, it is the end a DELETE message must reach, which is a
 * sentence of its own below.
 */
const UML_MESSAGE_ENDS: readonly RoleId[] = [
  UML_ROLE.lifeline,
  UML_ROLE.execution,
];

/**
 * The three message sorts whose ends §17.4.4 constrains no further than "a
 * sender and a receiver": a synchronous call, an asynchronous one and a reply.
 */
const UML_PLAIN_MESSAGE_ROLES: readonly RoleId[] = [
  UML_ROLE['message-sync'],
  UML_ROLE['message-async'],
  UML_ROLE['message-reply'],
];

/**
 * ALPHABET entries for the message grammar — the class-side and use-case
 * vocabularies, carried as true sentences of THEIR OWN edges.
 *
 * The device {@link UML_STATE_ALPHABET} explains, one sheet further on: these
 * triplets carry `uml:association`, so `inMatrix` — which matches a triplet's
 * edge with `roleIsA` — can never let one sanction a message. Their whole effect
 * is to put `uml:classifier`, `uml:actor` and `uml:use-case` into the alphabet
 * the message rule speaks, which is what makes "a message dragged onto a class"
 * and "a message dragged onto an actor" findings rather than silence.
 *
 * The ACTOR is the one that earns its place. Every drawing tool in the world
 * puts a stick figure at the left of a sequence diagram, and §17.3.4 does give a
 * lifeline head "a shape that is based on the classifier for the part" — so an
 * author reaching for the actor tool on an `sd` sheet is making a reasonable
 * mistake about THIS canvas, where a participant is a lifeline whatever it
 * represents. Being in the alphabet is what lets the finding say so.
 */
const UML_INTERACTION_ALPHABET: readonly EndpointTriplet[] = [
  {
    source: UML_ROLE.actor,
    edge: UML_ROLE.association,
    target: UML_ROLE['use-case'],
  },
  {
    source: UML_ROLE.classifier,
    edge: UML_ROLE.association,
    target: UML_ROLE.classifier,
  },
];

/**
 * What a MESSAGE may run between, sort by sort — §17.4.4, which is the one place
 * in Clause 17 where the notation constrains an ARROW's ends rather than its
 * shape.
 *
 * Three of the five sorts are the full square over {@link UML_MESSAGE_ENDS}: a
 * call, a signal and a reply run from a participant to a participant, and the
 * clause says nothing more. The other two each carry a sentence the
 * specification states outright:
 *
 *  - a **create** message "has a dashed line with an open arrow head" and is
 *    drawn to the HEAD of the lifeline it brings into existence (§17.4.4,
 *    Figure 17.13), so its target is a LIFELINE and never an execution — there
 *    is nothing to be executing on a participant that does not exist yet;
 *  - a **delete** message "must end in a DestructionOccurrenceSpecification"
 *    (§17.4.4, quoted in the rule's provenance), which is the X this canvas
 *    draws as `uml:destruction`. The LIFELINE is admitted beside it, and that is
 *    a deliberate tolerance rather than a reading of the clause: an author draws
 *    the arrow first and drops the cross on its end afterwards, and a grammar
 *    that indicted the intermediate state would be indicting the gesture.
 *    `uml.strict` promotes this rule, so the tolerance is the same at both
 *    levels — the finding that is worth having is the delete drawn onto an
 *    EXECUTION, which is a participant carrying on after it has been destroyed.
 *
 * Self-loops are NOT forbidden, and §17.4.4 is explicit about why: "The send and
 * receive events may both be on the same lifeline." A participant calling itself
 * is the notation's own figure for a nested activation.
 */
export const UML_MESSAGE_MATRIX: readonly EndpointTriplet[] = [
  ...UML_PLAIN_MESSAGE_ROLES.flatMap(edge =>
    UML_MESSAGE_ENDS.flatMap(source =>
      UML_MESSAGE_ENDS.map(target => ({ source, edge, target }))
    )
  ),
  ...UML_MESSAGE_ENDS.map(source => ({
    source,
    edge: UML_ROLE['message-create'],
    target: UML_ROLE.lifeline,
  })),
  ...UML_MESSAGE_ENDS.flatMap(source =>
    [UML_ROLE.destruction, UML_ROLE.lifeline].map(target => ({
      source,
      edge: UML_ROLE['message-delete'],
      target,
    }))
  ),
  ...UML_INTERACTION_ALPHABET,
];

/**
 * **U39** — a message drawn between artefacts an interaction does not exchange
 * messages between.
 *
 * `edgeRole: uml:message` — the PARENT of the five sorts — so one rule covers a
 * call, a signal, a reply, a create and a delete, and the matrix above is what
 * tells them apart: each triplet names a specialised edge role, and `inMatrix`
 * matches it with `roleIsA`, so a create's sentence can never sanction a delete.
 *
 * One id rather than five, for the reason every other endpoint rule in this file
 * is one id: the five sorts are one grammar with one gesture to fix it — re-point
 * an end — and five rules would be five lines in both profile tables and five
 * sentences saying the same thing about the same drag.
 *
 * ## What it stays silent about
 *
 * A message with a free end, a message onto a NOTE, onto a sticky, onto a
 * rectangle somebody thought with: the alphabet is the participants plus the two
 * foreign vocabularies {@link UML_INTERACTION_ALPHABET} names, and everything
 * outside it is a sketch (PRD principle 8). And a message from a participant to
 * ITSELF, which §17.4.4 draws on purpose.
 */
const messageEndpoints: ValidationRule = {
  id: 'uml.message-endpoints',
  framework: 'uml',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.message-endpoints',
  messageFallback:
    'This message runs between artefacts an interaction does not exchange messages between.',
  suggestionKey: 'com.labre.uml.validation.message-endpoints.suggestion',
  suggestionFallback:
    'A message joins two participants — a lifeline, or the execution bar drawn on one. A create message lands on the head of the lifeline it brings into existence, and a delete message ends on the cross that destroys it. If this participant is an actor, draw it as a lifeline: a sequence sheet has one kind of participant.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §17.4.4 — "An object deletion Message (messageSort equals deleteMessage) must end in a DestructionOccurrenceSpecification", and §17.3.4 on what a Lifeline and an ExecutionSpecification are',
  },
  backgroundRole: UML_ROLE.diagram,
  endpoints: {
    edgeRole: UML_ROLE.message,
    allowed: UML_MESSAGE_MATRIX,
  },
};

/**
 * **U40** — a message label that does not parse.
 *
 * The fifth `label-syntax` rule (ADR 0021), and the first written on a CONNECTOR's
 * centre label since `uml.transition-syntax`. `appliesTo: uml:message` reaches
 * all five sorts for free — they specialise it — which is exactly right here:
 * §17.4.4 prints ONE label grammar for the request sorts and one for the reply,
 * the second being the first plus an assignment target and a return value, and
 * `checkMessageLabel` reads both because an arrow carries one text and nothing
 * on the canvas tells a reader which of the two productions to use.
 *
 * `perLine: false`, like the transition label and for the same reason: §17.4.4's
 * label is a single production, not a list, and an author who wraps
 * `r = place(order, now) : Receipt` onto a second line has written one label.
 *
 * ## What it stays silent about
 *
 * An UNLABELLED arrow — §17.4.4 makes the label optional and a sequence diagram
 * is drawn arrows-first — and `*`, which is a spelling the clause prints. See
 * `grammar.ts` for the four things it does report, each of them a case where the
 * lenient parse the exporters read LOST something the author typed.
 */
const messageSyntax: ValidationRule = {
  id: 'uml.message-syntax',
  framework: 'uml',
  family: 'label-syntax',
  severity: 'audit',
  appliesTo: UML_ROLE.message,
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.message-syntax',
  messageFallback: 'This message label does not parse:',
  suggestionKey: 'com.labre.uml.validation.message-syntax.suggestion',
  suggestionFallback:
    'A message is labelled "place(order)", and a reply "r = place(order) : Receipt" — the assignment, the arguments and the returned value are each optional, and an arrow with no label at all is legal.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      'OMG UML 2.5.1 §17.4.4 — <request-message-label> ::= <message-name> [( [<input-argument-list>] )], <reply-message-label> ::= [<assignment-target> =] <message-name> [( [<output-argument-list>] )] [: <value-specification>]',
  },
  moment: 'on-demand',
  backgroundRole: UML_ROLE.diagram,
  labelSyntax: { parse: checkMessageLabel, perLine: false },
};

/**
 * **U41** — a lifeline whose head has been emptied.
 *
 * The THIRD `label-presence` rule, and the one that made the tier vocabulary
 * grow: until phase 3 a lifeline's head carried `uml:label`, the actor's and the
 * use case's tier, and a rule written on that tier could not tell the three
 * apart. Which made both halves of the naming question wrong at once — an
 * emptied head was reported as "this actor or use case has no name", and an
 * author of a sequence diagram was told to write "Customer" in a box that wants
 * `order : Order`. `uml:lifeline-ident` is that tier split off (`roles.ts`), and
 * this is one of the two rules the split exists for.
 *
 * ONE rule, one subject role, and no overlap with {@link unnamedActorOrUseCase}
 * by construction: the new role is FLAT, so `roleIsA` never walks from one to
 * the other and an emptied head is reported here and nowhere else.
 *
 * ## What it stays silent about
 *
 * A head somebody deleted outright rather than emptied — the same known limit
 * {@link unnamedClassifier} documents, and for the same reason: there is no text
 * on the sheet for a `label-presence` rule to be about.
 */
const unnamedLifeline: ValidationRule = {
  id: 'uml.unnamed-lifeline',
  framework: 'uml',
  family: 'label-presence',
  severity: 'audit',
  appliesTo: UML_ROLE['lifeline-ident'],
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.unnamed-lifeline',
  messageFallback: 'This lifeline has no participant in its head.',
  suggestionKey: 'com.labre.uml.validation.unnamed-lifeline.suggestion',
  suggestionFallback:
    'Write who is taking part — "order : Order", "customer", or just ": Order" for an anonymous instance. Every arrow on this sheet is read as a sentence about the head it leaves and the head it reaches, and an empty one leaves both halves unsaid.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'OMG UML 2.5.1 §17.3.4 — a Lifeline is drawn as a named rectangle with a dashed line descending from it',
  },
  // On-demand for the reason the other two naming rules are: a head is what a
  // user changes by TYPING, and real-time would re-evaluate on every keystroke.
  moment: 'on-demand',
  backgroundRole: UML_ROLE.diagram,
  label: { present: true },
};

/**
 * **U42** — a lifeline head that does not parse.
 *
 * The SIXTH `label-syntax` rule (ADR 0021), and the second half of the tier
 * split. §17.3.4 prints a BNF — `<lifelineident> ::= ([<connectable-element-name>
 * [\[<selector>\]]] [: <class-name>] | 'self')` — which is exactly the kind of
 * claim this family exists to make, and `checkLifelineIdent` is the checker the
 * IMPORTERS and the two exporters already read the head with. So a finding here
 * is the line that will leave the sheet less structured than it was drawn: a
 * head the grammar cannot split is a lifeline whose `name` and `type` go into
 * the XMI and the PlantUML as one opaque string.
 *
 * `perLine: false`, like the transition and the message labels: §17.3.4's
 * production is one line, not a list, and a head wrapped onto two is one head.
 *
 * ## Why it could not be written on `uml:label`
 *
 * `Place an order (fast)` is a perfectly good use case name and a broken
 * lifeline head — parentheses in a head read as a message label, which is what
 * `checkLifelineIdent` says about them. A rule on the shared tier would have
 * indicted every parenthesised ellipse on every use case diagram in the library
 * (`roles.ts`).
 *
 * ## What it stays silent about
 *
 * An EMPTY head, which is {@link unnamedLifeline}'s question and carries its own
 * sentence — two rules on one word to fix is the thing this pack refuses
 * everywhere — and `self`, which §17.3.4 prints as an alternative of the
 * production itself.
 */
const lifelineIdentSyntax: ValidationRule = {
  id: 'uml.lifeline-ident-syntax',
  framework: 'uml',
  family: 'label-syntax',
  severity: 'audit',
  appliesTo: UML_ROLE['lifeline-ident'],
  roles: UML_ROLES,
  messageKey: 'com.labre.uml.validation.lifeline-ident-syntax',
  messageFallback: 'This lifeline head does not parse:',
  suggestionKey: 'com.labre.uml.validation.lifeline-ident-syntax.suggestion',
  suggestionFallback:
    'A head is written "name : Class" — "order : Order", "customer", ": Order" for an anonymous participant, "customers[i] : Customer" for one of many, or "self". The name and the class are each optional; the colon between them is not decoration.',
  version: 1,
  provenance: {
    source: 'standard',
    reference:
      "OMG UML 2.5.1 §17.3.4 — <lifelineident> ::= ([<connectable-element-name> ['[' <selector> ']']] [: <class-name>] | 'self')",
  },
  moment: 'on-demand',
  backgroundRole: UML_ROLE.diagram,
  labelSyntax: { parse: checkLifelineIdent, perLine: false },
};
/**
 * The pack, whole: forty-two rules over nine families.
 *
 * Sixteen in phase 1, and not that brief's seventeen ids because the actor's
 * name and the use case's name are ONE rule: they are the same tier role, and
 * two rules on one role report one emptied word twice (see
 * {@link unnamedActorOrUseCase}). The structural sheets appended three — the
 * grammars of the three edges they draw — and skipped two the engine cannot be
 * asked. The BEHAVIOUR sheets appended fifteen, which is the largest single
 * addition this library has taken: an activity and a state machine are the two
 * diagrams UML constrains arithmetically, so where a class diagram's pack is
 * mostly a vocabulary these are counts, degrees and a graph walk.
 *
 * The SEQUENCE sheet appended four, and all four are families this pack already
 * had — which says something about the notation rather than about the effort:
 * an interaction's whole grammar is "who may exchange a message with whom",
 * "what a message label says", and the two questions any tier is asked about
 * the words in a lifeline's head. Those last two are the ones that cost a role:
 * `uml:lifeline-ident` exists because §17.3.4 prints a BNF for a head and
 * §18.1.4 prints none for an actor's word, and one tier carrying both would have
 * had to ask them the same question (`roles.ts`, {@link unnamedLifeline}). The
 * four requirements Clause 17 states that this library CANNOT state — a message
 * never traversed upwards (§17.4.4), an execution bar sat on a lifeline's spine
 * (§17.3.4), a create message landing on a head, an operand's guard written in
 * brackets (§17.6.4) — are each a geometry no family expresses, and they are
 * recorded in `docs/adr/0022` rather than approximated here. A rule that fires
 * on the wrong thing costs more than a requirement nobody checks.
 *
 * ## The ninth family is new to the ENGINE, and it is the only one that is
 *
 * `label-syntax` (`docs/adr/0021`) arrived with four spelling rules and carries
 * six, and it is the first family this library has added for a reason no table
 * could meet: a notation's GRAMMAR is a parser, and the clauses these rules cite
 * are already written as one in `grammar.ts` for the exporters. The family owns
 * the walk; the pack owns the reading. Everything else the fifteen roles of
 * phase 2 needed, the engine already had.
 *
 * ## The other eight are the engine's, and two of them are BPMN's
 *
 * `role-count` and `reachability` are BPMN's, registered here with UML's own
 * roles and nothing else: a state machine with two beginnings and a ring of
 * states nothing enters are the same two questions a pool with two start events
 * and an unreachable task ask. So the claim `docs/add-a-framework` makes about
 * the seam survives the largest notation in the library twice over — the
 * fifteen edge roles are fifteen readings of `relation-endpoints`, the four
 * frames are the membership families C4 already uses, and the sheet's own
 * declaration is the `view-admissibility` C4 opened.
 *
 * ## Several rules say one sentence twice, and the reason is always the same
 *
 * Five pairs — the two histories, the two initial-node counts, the two finals,
 * the two reachability walks — are one requirement declared twice because the
 * family that answers it names ONE role: one subject role, or one edge role.
 * They never double-report (an element carries one role, an edge carries one
 * role, and each pair's two halves are flat siblings), and each half carries the
 * sentence and the authority its own half of the notation has. Where the pair
 * could have been collapsed by inventing an ancestor role, it was not: this
 * vocabulary's whole authority is that every role in it is the specification's.
 */
export const UML_RULES: readonly ValidationRule[] = [
  // Membership: is the drawing on the sheet it claims to be on?
  elementOutsideFrame,
  notAdmissibleOnKind,
  useCaseOutsideSubject,
  actorInsideSubject,
  // Naming: does the drawing say anything at all?
  unnamedClassifier,
  unnamedActorOrUseCase,
  // Spelling: and is what it says written the way the clause writes it?
  attributeSyntax,
  operationSyntax,
  transitionSyntax,
  multiplicitySyntax,
  // Grammar: what each line may run between.
  generalizationEndpoints,
  generalizationSelfLoop,
  realizationEndpoints,
  dependencyOnObject,
  includeEndpoints,
  extendEndpoints,
  actorActorAssociation,
  deployEndpoints,
  manifestEndpoints,
  communicationPathEndpoints,
  untypedEdge,
  // Degree: how many lines may reach one artefact?
  compositionSingleOwner,
  useCaseNoActor,
  // Behaviour — membership: is the drawing in the lane, in the region?
  nodeInPartition,
  shallowHistoryOutsideRegion,
  deepHistoryOutsideRegion,
  // Behaviour — counts: how many beginnings, how many lines reach one glyph?
  initialSingle,
  initialNoIncomingFlow,
  initialNoIncomingTransition,
  activityFinalNoOutgoing,
  flowFinalNoOutgoing,
  finalStateNoOutgoing,
  decisionIncomingCount,
  // Behaviour — grammar: what each flow may run between.
  controlFlowEndpoints,
  objectFlowEndpoints,
  transitionEndpoints,
  // Behaviour — the graph: can the flow get there at all?
  unreachableAction,
  unreachableState,
  // The interaction: what a message runs between, and what its label says…
  messageEndpoints,
  messageSyntax,
  // …and the two questions a lifeline's own head is asked, which are the two
  // questions every tier in this pack is asked: does it say anything, and does
  // what it says parse.
  unnamedLifeline,
  lifelineIdentSyntax,
];
