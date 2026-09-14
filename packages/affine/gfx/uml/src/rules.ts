import type {
  EndpointTriplet,
  ValidationRule,
} from '@labre/affine-block-surface';
import type { RoleId } from '@labre/std/gfx';

import { UML_SUBJECT_FRAME } from './background.js';
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
 * §19.4.3 says a communication path joins two DeploymentTargets. TEN rules
 * therefore declare `provenance.source: 'standard'` — the first in this library
 * after BPMN's — and they are the ten a conformance report may present as
 * defects.
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
 * a deliverable, and it promotes the nine rules that restate the specification
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
 * ## Four questions this pack deliberately does NOT ask
 *
 * Not gaps in the notation — gaps in what the engine's families can be asked of
 * a UML element. The first two are phase 1's; the last two are phase 2's, and
 * they are the two rules the structural brief asked for and this file could not
 * honestly write.
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
];

/**
 * Every ordered pair of the element roles — the ALPHABET, and not a grammar.
 *
 * This table sanctions all hundred and forty-four sentences, so a rule holding
 * it judges none of them. It exists so {@link untypedEdge} can say "between two
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
 * Six kinds since phase 2, and the table below grows by APPENDING a key: a
 * `forbidden` entry is looked up by the frame's own `kind` string, so a kind with
 * no entry is a sheet this rule has nothing to say about — which is exactly what
 * a phase-1 build does with a `cmp` frame, and what this build does with `act`.
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
    'The frame’s heading names the diagram — class, pkg, obj, uc, cmp or dep — and each draws its own vocabulary. Move the artefact to a sheet that draws it, or change the frame’s kind to the one it really shows.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'OMG UML 2.5.1 — Annex A (diagram kinds and frame headings), §9.8.4 (object diagrams), §12.2.4 (package diagrams), §18.1.4 (use case diagrams)',
  },
  backgroundRole: UML_ROLE.diagram,
  admissibility: {
    // The prop the frame writes its kind in. The rule names it; the engine reads
    // it; nothing in between knows the word "UML".
    levelProp: 'kind',
    forbidden: {
      class: [UML_ROLE.actor, UML_ROLE['use-case'], UML_ROLE.subject],
      pkg: [
        UML_ROLE.actor,
        UML_ROLE['use-case'],
        UML_ROLE.subject,
        UML_ROLE.object,
      ],
      obj: [
        UML_ROLE.actor,
        UML_ROLE['use-case'],
        UML_ROLE.subject,
        // The PARENT role: a class, an interface and an enumeration alike.
        UML_ROLE.classifier,
      ],
      uc: [UML_ROLE.classifier, UML_ROLE.object, UML_ROLE.package],
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

/**
 * The pack, whole: nineteen rules over six families.
 *
 * Sixteen in phase 1, and not that brief's seventeen ids because the actor's
 * name and the use case's name are ONE rule: they are the same tier role, and
 * two rules on one role report one emptied word twice (see
 * {@link unnamedActorOrUseCase}). Phase 2 appended three — the grammars of the
 * three edges the structural sheets draw — and skipped two the engine cannot be
 * asked (see the file header's third and fourth deliberate silences).
 *
 * Six families, and STILL not one of them new after a second notation's worth of
 * artefacts: UML is the largest pack this library carries and it has asked the
 * engine for nothing — the twelve edge roles are twelve readings of
 * `relation-endpoints`, the two frames are the membership families C4 already
 * uses, and the sheet's own declaration is the `view-admissibility` C4 opened.
 * That is the claim `docs/add-a-framework` makes about the seam, tested by the
 * hardest case available.
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
];
