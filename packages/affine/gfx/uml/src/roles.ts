import type { UmlNodeKind } from '@labre/affine-model';
import type { RoleDef, RoleDefs, RoleId } from '@labre/std/gfx';

/**
 * UML role vocabulary.
 *
 * A role is the semantic identity of a UML artefact, and here — as in C4 — it is
 * the only thing that carries it. Four of the sixteen node kinds are drawn as
 * the SAME rectangle: a class, an interface, an enumeration and an object differ by
 * the keyword written above the name, and a rule that read the shape would find
 * a box and learn nothing. The `kind` discriminant answers a different question
 * (which glyph to paint, which compartments to lay out); the role answers what
 * the box MEANS.
 *
 * Hierarchy is DATA (`parent`), never TS inheritance, and only where UML 2.5.1
 * itself makes the statement.
 *
 * ## The three specialisation chains, and why there are only three
 *
 * **`uml:classifier`** is the spec's own generalisation: §9.2 makes Class,
 * Interface and DataType (of which Enumeration is one) all Classifiers, and the
 * notation follows — the compartmented rectangle of §11.4.4 is drawn identically
 * for the three, with the keyword line as the discriminator. So a rule written
 * about "classifiers must be named" reaches all three for free through
 * `roleIsA`.
 *
 * `uml:object` is deliberately NOT under it. An object is an
 * InstanceSpecification (§9.8) — it is an INSTANCE of a classifier, not a kind
 * of one — and filing it in the chain would make every rule about classifiers
 * fall on instances, which is the opposite of what the spec says. It shares the
 * rectangle and nothing else, which is exactly the trap this vocabulary exists
 * to avoid.
 *
 * **`uml:association`** is the second, and it is §11.5.4: aggregation and
 * composition ARE associations — the same solid line, with a diamond at the
 * whole's end saying which flavour of part-of it is. `aggregationKind` is a
 * property of an association end in the metamodel, not a different relationship,
 * so a rule about associations must reach both.
 *
 * Generalization, realization, dependency, include and extend are FLAT, and not
 * children of the association either. They are different metaclasses drawn with
 * different lines (§9.9.4, §10.4.4, §7.8.4, §18.1.4) — a generalization is not a
 * kind of association, and an include is not a kind of dependency for our
 * purposes even though the metamodel derives it from DirectedRelationship:
 * flattening what the reader sees as four distinct notations would let one rule
 * silently police all of them.
 *
 * `uml:anchor` is the note attachment of Annex A — the dotted line that ties a
 * comment to what it comments on. Flat, verbless and undirected.
 *
 * **`uml:node`** is the third, and it arrived with the deployment artefacts of
 * phase 2. §19.4 derives both Device and ExecutionEnvironment from Node, and the
 * notation follows: all three are the same 3-D cube, told apart by a keyword
 * (`«device»`, `«executionEnvironment»`). So a rule written about what may be
 * deployed on a node reaches the three for free.
 *
 * It differs from `uml:classifier` in one respect, and the difference is the
 * spec's own: a Node is INSTANTIABLE, so unlike the abstract classifier this
 * parent is ALSO stamped on elements — `kind: 'node'` maps onto it. A role that
 * is both a parent and a drawing is unusual in this library, and it is exactly
 * what §19.4 describes.
 *
 * The other phase-2 artefacts are flat, and each for a stated reason.
 * `uml:component` is a structured Classifier in the metamodel (§11.6) and stays
 * OUT of `uml:classifier` all the same: the notation draws it as its own figure
 * — the two-tabbed icon of §11.6.4 — and the class-diagram rules written on
 * classifiers (a name compartment, features, visibility) are not the sentences a
 * component diagram is audited by. `uml:artifact` is flat for the reason
 * `uml:object` is: it is a physical file, not a kind of anything else drawn
 * here. `uml:port`, `uml:provided-interface` and `uml:required-interface` are
 * parts and glyphs attached to a component (§11.3.4, §10.4.4), not
 * specialisations of it.
 *
 * `uml:communication-path` is FLAT under nothing, and that is the one place this
 * file knowingly departs from the metamodel: §19.4 derives CommunicationPath
 * from Association. The same call the file already makes for include and extend,
 * which the metamodel derives from DirectedRelationship — what a reader sees is
 * a DIFFERENT NOTATION between different things (a line between two cubes, not
 * between two classifiers), and filing it under the association would hand every
 * class-diagram association rule a deployment diagram to police. Recorded here
 * rather than left to be rediscovered.
 *
 * **`uml:control-node`** and **`uml:pseudostate`** are the fourth and fifth,
 * and they arrived with the behaviour artefacts of phase 2. §15.3.4 groups the
 * five shapes that ROUTE an activity's flow (initial, activity final, flow
 * final, decision, fork) under ControlNode, and §14.2.4 groups the seven that
 * route a state machine's transitions (choice, junction, the two histories,
 * entry and exit points, terminate) under Pseudostate. Both parents are
 * ABSTRACT — stamped on nothing, like `uml:classifier` and unlike `uml:node` —
 * because the sentences they exist for ("carries no name", "is never where the
 * machine rests") are true of all of them and of none of them in particular.
 *
 * `uml:initial` is filed under `uml:control-node` because §15.3.4 puts it
 * there, and it is ALSO the role a state machine's initial pseudostate carries:
 * §14.2.4 draws the identical filled disc and means the identical thing by it.
 * That cross-family reading is deliberate — one rule, `uml.initial-single`,
 * then polices both diagrams — and it is recorded on the def so nobody later
 * "fixes" it by splitting the two.
 *
 * `uml:action` and `uml:state` are FLAT, and pointedly not each other's
 * relatives although both are drawn as a round-cornered rectangle: an action is
 * work that happens, a state is a condition that holds. `uml:object-node` is
 * flat for the reason `uml:object` is, and is not the same role as it: an
 * instance specification and a value flowing between actions are different
 * metaclasses sharing a rectangle. `uml:final-state` is flat and drawn exactly
 * like `uml:activity-final`, kept apart because a rule about one must never be
 * handed the other.
 *
 * ## The frames
 *
 * `uml:diagram`, `uml:subject`, `uml:partition` (the swimlane of §15.6.4) and
 * `uml:region` (the composite state of §14.2.4) are parent-less, the same call
 * `c4:board`,
 * `wardley:map` and `bpmn:pool` all make: they are the FRAME the elements are
 * drawn in and drawn round, and a rule written on the artefacts must never fall
 * on the sheet holding them. They are declared `kind: 'node'` for the same
 * reason `c4:board` is — a frame is measured by its bounds — and
 * `packages/affine/all/src/__tests__/reading-coverage.unit.spec.ts` records both
 * as frames so that the reading-profile coverage test does not ask a sheet to
 * read itself back as a sentence.
 *
 * ## Compatibility
 *
 * Nothing is backfilled. A diagram drawn before today carries no role, so it is
 * never evaluated and never says a word (PRD principle 8).
 */

/** Every role this framework declares. */
export type UmlRole =
  // The classifiers, and their common parent.
  | 'classifier'
  | 'class'
  | 'interface'
  | 'enumeration'
  // The instance, the container, the annotation and the two use case artefacts.
  | 'object'
  | 'package'
  | 'note'
  | 'actor'
  | 'use-case'
  // The component artefacts (§11.6.4, §11.3.4, §10.4.4).
  | 'component'
  | 'port'
  | 'provided-interface'
  | 'required-interface'
  // The deployment artefacts, and the cube they share (§19.3.4, §19.4.4).
  | 'artifact'
  | 'node'
  | 'device'
  | 'execution-environment'
  // The activity artefacts, and the parent the five routing shapes share
  // (§15.3.4, §15.4.4, §16.3.4, §16.10.4).
  | 'control-node'
  | 'action'
  | 'initial'
  | 'activity-final'
  | 'flow-final'
  | 'decision'
  | 'fork'
  | 'object-node'
  | 'send-signal'
  | 'accept-event'
  | 'time-event'
  // The state machine artefacts, and the parent the seven routing shapes
  // share (§14.2.4).
  | 'state'
  | 'final-state'
  | 'pseudostate'
  | 'choice'
  | 'junction'
  | 'shallow-history'
  | 'deep-history'
  | 'entry-point'
  | 'exit-point'
  | 'terminate'
  // The interaction artefacts (§17.2.4, §17.3.4).
  | 'lifeline'
  | 'execution'
  | 'destruction'
  // The written tiers of an artefact's label, as canvas text.
  | 'name'
  | 'attributes'
  | 'operations'
  | 'label'
  | 'lifeline-ident'
  // The frames.
  | 'diagram'
  | 'subject'
  | 'partition'
  | 'region'
  | 'fragment'
  | 'operand'
  // The relationships.
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'generalization'
  | 'realization'
  | 'dependency'
  | 'anchor'
  | 'include'
  | 'extend'
  // The deployment relationships (§19.2.4, §19.3.4, §19.4.4).
  | 'deploy'
  | 'manifest'
  | 'communication-path'
  // The behaviour relationships (§15.2.4, §14.2.4.8).
  | 'control-flow'
  | 'object-flow'
  | 'transition'
  // The interaction relationships (§17.4.4), and the parent the five share.
  | 'message'
  | 'message-sync'
  | 'message-async'
  | 'message-reply'
  | 'message-create'
  | 'message-delete';

export type UmlRoleId = `uml:${UmlRole}`;

/**
 * Role ids, keyed by their own name.
 *
 * Keyed by the ROLE and not by the `kind`: UML has thirty-eight node kinds and
 * forty-one node roles, because `uml:classifier`, `uml:control-node` and
 * `uml:pseudostate` are parents nothing is ever drawn as. ({@link
 * UML_ROLE.node} is a parent too, and IS drawn — §19.4 makes a Node
 * instantiable — so it does not add a role of its own.)
 * {@link UML_ROLE_OF_KIND} is the bridge, and it is the only place the two
 * vocabularies meet.
 */
export const UML_ROLE = {
  classifier: 'uml:classifier',
  class: 'uml:class',
  interface: 'uml:interface',
  enumeration: 'uml:enumeration',
  object: 'uml:object',
  package: 'uml:package',
  note: 'uml:note',
  actor: 'uml:actor',
  'use-case': 'uml:use-case',
  component: 'uml:component',
  port: 'uml:port',
  'provided-interface': 'uml:provided-interface',
  'required-interface': 'uml:required-interface',
  artifact: 'uml:artifact',
  node: 'uml:node',
  device: 'uml:device',
  'execution-environment': 'uml:execution-environment',
  'control-node': 'uml:control-node',
  action: 'uml:action',
  initial: 'uml:initial',
  'activity-final': 'uml:activity-final',
  'flow-final': 'uml:flow-final',
  decision: 'uml:decision',
  fork: 'uml:fork',
  'object-node': 'uml:object-node',
  'send-signal': 'uml:send-signal',
  'accept-event': 'uml:accept-event',
  'time-event': 'uml:time-event',
  state: 'uml:state',
  'final-state': 'uml:final-state',
  pseudostate: 'uml:pseudostate',
  choice: 'uml:choice',
  junction: 'uml:junction',
  'shallow-history': 'uml:shallow-history',
  'deep-history': 'uml:deep-history',
  'entry-point': 'uml:entry-point',
  'exit-point': 'uml:exit-point',
  terminate: 'uml:terminate',
  lifeline: 'uml:lifeline',
  execution: 'uml:execution',
  destruction: 'uml:destruction',
  name: 'uml:name',
  attributes: 'uml:attributes',
  operations: 'uml:operations',
  label: 'uml:label',
  'lifeline-ident': 'uml:lifeline-ident',
  diagram: 'uml:diagram',
  subject: 'uml:subject',
  partition: 'uml:partition',
  region: 'uml:region',
  fragment: 'uml:fragment',
  operand: 'uml:operand',
  association: 'uml:association',
  aggregation: 'uml:aggregation',
  composition: 'uml:composition',
  generalization: 'uml:generalization',
  realization: 'uml:realization',
  dependency: 'uml:dependency',
  anchor: 'uml:anchor',
  include: 'uml:include',
  extend: 'uml:extend',
  deploy: 'uml:deploy',
  manifest: 'uml:manifest',
  'communication-path': 'uml:communication-path',
  'control-flow': 'uml:control-flow',
  'object-flow': 'uml:object-flow',
  transition: 'uml:transition',
  message: 'uml:message',
  'message-sync': 'uml:message-sync',
  'message-async': 'uml:message-async',
  'message-reply': 'uml:message-reply',
  'message-create': 'uml:message-create',
  'message-delete': 'uml:message-delete',
} as const satisfies Record<UmlRole, UmlRoleId>;

/**
 * Compile-time proof that {@link UML_ROLE} is total over {@link UmlRole} in the
 * OTHER direction too: `satisfies Record<UmlRole, …>` only checks that every key
 * is present, so without this a role added to the union and forgotten in the
 * table would slip through as long as its key was also forgotten. Reads as
 * `never` — and therefore fails to accept `true` — the moment one does.
 */
type _UnmappedUmlRole = Exclude<
  UmlRoleId,
  (typeof UML_ROLE)[keyof typeof UML_ROLE]
>;
const _everyRoleIsMapped: [_UnmappedUmlRole] extends [never] ? true : never =
  true;
void _everyRoleIsMapped;

/**
 * i18n key stem of a role id: `uml:class` → `com.labre.uml.role.class`.
 *
 * Exported because the creation sites seed an artefact's NAME from the same key
 * a role labels itself with (a diagram drawn in a French host should not be
 * called "Diagram"): one key for the role and for the seed, because they are the
 * same noun and a host must not be asked to word it twice.
 */
export const umlRoleKey = (local: string) => `com.labre.uml.role.${local}`;

/** The same, from a full role id. */
const roleKey = (id: RoleId) => umlRoleKey(id.slice('uml:'.length));

/** The diagram frame's own key, read by `createUmlDiagram` to seed its name. */
export const umlDiagramRoleKey = roleKey(UML_ROLE.diagram);

/** The subject's own key, read by `createUmlSubject` to seed its name. */
export const umlSubjectRoleKey = roleKey(UML_ROLE.subject);

/** The partition's own key, read by `createUmlPartition` to seed its name. */
export const umlPartitionRoleKey = roleKey(UML_ROLE.partition);

/** The composite state's own key, read by `createUmlRegion` to seed its name. */
export const umlRegionRoleKey = roleKey(UML_ROLE.region);

/**
 * The combined fragment's own key.
 *
 * Unlike the four above it seeds NO name — §17.6.4 writes a guard only where
 * there is one, so `UmlFragmentElementModel.name` starts empty — and the key is
 * exported for the toolbar and the templates, which still have to call the
 * thing something in the user's language.
 */
export const umlFragmentRoleKey = roleKey(UML_ROLE.fragment);

/**
 * The classifiers (§9.2, §11.4.4) — the compartmented rectangle, and the three
 * keywords that tell its flavours apart — plus every artefact that is not a
 * classifier and is drawn as something else entirely: the four of phase 1, and
 * the eight components and deployment artefacts phase 2 appended.
 *
 * `uml:classifier` is declared but never stamped on an element: it is the
 * ancestor a rule about naming, about visibility or about features is written
 * on, so that the same sentence reaches a class, an interface and an enumeration
 * without being restated three times.
 */
const ELEMENT_DEFS: readonly RoleDef[] = [
  {
    id: UML_ROLE.classifier,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.classifier),
    labelFallback: 'Classifier',
  },
  {
    id: UML_ROLE.class,
    parent: UML_ROLE.classifier,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.class),
    labelFallback: 'Class',
  },
  {
    id: UML_ROLE.interface,
    parent: UML_ROLE.classifier,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.interface),
    labelFallback: 'Interface',
  },
  {
    id: UML_ROLE.enumeration,
    parent: UML_ROLE.classifier,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.enumeration),
    labelFallback: 'Enumeration',
  },
  // An INSTANCE of a classifier (§9.8), not a kind of one — see the note at the
  // top of this file on why it stays out of the chain above.
  {
    id: UML_ROLE.object,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.object),
    labelFallback: 'Object',
  },
  {
    id: UML_ROLE.package,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.package),
    labelFallback: 'Package',
  },
  {
    id: UML_ROLE.note,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.note),
    labelFallback: 'Note',
  },
  {
    id: UML_ROLE.actor,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.actor),
    labelFallback: 'Actor',
  },
  {
    id: UML_ROLE['use-case'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE['use-case']),
    labelFallback: 'Use case',
  },
  // ── The component artefacts (phase 2) ───────────────────────────────────
  // §11.6.4: a Component is drawn as a rectangle with the two-tabbed icon in
  // its top-right corner. Flat, and not under `uml:classifier`: see the header.
  {
    id: UML_ROLE.component,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.component),
    labelFallback: 'Component',
  },
  // §11.3.4: a Port is a small square ON the border of the component that owns
  // it — a part of that component, never a specialisation of it.
  {
    id: UML_ROLE.port,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.port),
    labelFallback: 'Port',
  },
  // §10.4.4: the ball-and-socket pair. Two roles rather than one `uml:interface
  // -point` with a flag, because they are two STATEMENTS — one says a component
  // offers a service, the other that it needs one — and a rule about a required
  // interface left dangling must not fall on every lollipop on the sheet.
  {
    id: UML_ROLE['provided-interface'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE['provided-interface']),
    labelFallback: 'Provided interface',
  },
  {
    id: UML_ROLE['required-interface'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE['required-interface']),
    labelFallback: 'Required interface',
  },
  // ── The deployment artefacts (phase 2) ──────────────────────────────────
  // §19.3.4: an Artifact is a physical file — drawn as a rectangle with the
  // document icon, and named `«artifact»` over its own file name.
  {
    id: UML_ROLE.artifact,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.artifact),
    labelFallback: 'Artifact',
  },
  // §19.4: the cube, and the two things the spec derives from it. The parent is
  // itself drawn — a Node is instantiable — which is what makes this chain
  // different from `uml:classifier`.
  {
    id: UML_ROLE.node,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.node),
    labelFallback: 'Node',
  },
  {
    id: UML_ROLE.device,
    parent: UML_ROLE.node,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.device),
    labelFallback: 'Device',
  },
  {
    id: UML_ROLE['execution-environment'],
    parent: UML_ROLE.node,
    kind: 'node',
    labelKey: roleKey(UML_ROLE['execution-environment']),
    labelFallback: 'Execution environment',
  },
  // ── The activity artefacts (phase 2) ────────────────────────────────────
  // §15.3.4: an Action is the round-cornered rectangle work is written in. Flat
  // — it is the only thing on an activity diagram that DOES anything, and the
  // control nodes below route between actions rather than specialise them.
  {
    id: UML_ROLE.action,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.action),
    labelFallback: 'Action',
  },
  // §15.3.4: the ControlNodes. An abstract parent, stamped on nothing, for the
  // reason `uml:classifier` is one: "a control node carries no name" and "a
  // control flow may end on a control node" are sentences about the five of
  // them at once, and restating each five times is how four of them stay right.
  {
    id: UML_ROLE['control-node'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE['control-node']),
    labelFallback: 'Control node',
  },
  // The filled disc where a flow begins. Filed under the control node because
  // §15.3.4 puts it there — and USED on state machines too, where §14.2.4 draws
  // the identical disc and means the identical thing (one per region, no
  // incoming edge). That cross-family reading is deliberate and recorded here:
  // a rule written on `uml:initial` fires on both diagrams, which is what the
  // two specifications between them say.
  {
    id: UML_ROLE.initial,
    parent: UML_ROLE['control-node'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE.initial),
    labelFallback: 'Initial node',
  },
  {
    id: UML_ROLE['activity-final'],
    parent: UML_ROLE['control-node'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE['activity-final']),
    labelFallback: 'Activity final',
  },
  {
    id: UML_ROLE['flow-final'],
    parent: UML_ROLE['control-node'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE['flow-final']),
    labelFallback: 'Flow final',
  },
  {
    id: UML_ROLE.decision,
    parent: UML_ROLE['control-node'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE.decision),
    labelFallback: 'Decision',
  },
  // §15.3.4 draws a fork and a join as the SAME bar and tells them apart by how
  // many edges run in and out. One role, therefore: two would be this
  // vocabulary claiming a distinction the picture does not carry, and a rule
  // that wants it can count the edges.
  {
    id: UML_ROLE.fork,
    parent: UML_ROLE['control-node'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE.fork),
    labelFallback: 'Fork / join',
  },
  // §15.4.4: an ObjectNode is the DATA that flows between actions, drawn as a
  // plain rectangle. NOT a control node — it is what moves, not what routes —
  // and not an `uml:object` either: an object diagram's instance specification
  // and an activity's object node are different metaclasses that happen to
  // share a rectangle, which is exactly the trap this vocabulary avoids.
  {
    id: UML_ROLE['object-node'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE['object-node']),
    labelFallback: 'Object node',
  },
  // §16.3.4: the two invocation shapes, drawn as the convex and the concave
  // pentagon. Flat and separate, because they are two statements — one sends,
  // the other waits — and the notation gives each its own silhouette.
  {
    id: UML_ROLE['send-signal'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE['send-signal']),
    labelFallback: 'Send signal',
  },
  {
    id: UML_ROLE['accept-event'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE['accept-event']),
    labelFallback: 'Accept event',
  },
  // §16.10.4: the hourglass — an AcceptEventAction whose trigger is a
  // TimeEvent. A role of its own rather than a flag on `uml:accept-event`,
  // because the notation draws a different picture for it and a reader tells
  // "waits for an order" from "waits two days" by that picture alone.
  {
    id: UML_ROLE['time-event'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE['time-event']),
    labelFallback: 'Time event',
  },
  // ── The state machine artefacts (phase 2) ───────────────────────────────
  // §14.2.4: a State is the round-cornered rectangle a machine rests in. Flat,
  // and emphatically not under `uml:action`: an action is work that happens, a
  // state is a condition that holds, and the two share a silhouette and
  // nothing else.
  {
    id: UML_ROLE.state,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.state),
    labelFallback: 'State',
  },
  // The bullseye. Drawn identically to `uml:activity-final` and kept a separate
  // role all the same, because the two are different metaclasses on different
  // diagrams: a FinalState is a vertex a transition lands on, an
  // ActivityFinalNode stops every flow in the activity. A rule about one must
  // not be handed the other.
  {
    id: UML_ROLE['final-state'],
    kind: 'node',
    labelKey: roleKey(UML_ROLE['final-state']),
    labelFallback: 'Final state',
  },
  // §14.2.4: the Pseudostates. The state machine's own abstract parent, the
  // counterpart of `uml:control-node` and stamped on nothing for the same
  // reason: "a pseudostate carries no name" and "a pseudostate is never where a
  // machine rests" are sentences about all seven at once.
  {
    id: UML_ROLE.pseudostate,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.pseudostate),
    labelFallback: 'Pseudostate',
  },
  {
    id: UML_ROLE.choice,
    parent: UML_ROLE.pseudostate,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.choice),
    labelFallback: 'Choice',
  },
  {
    id: UML_ROLE.junction,
    parent: UML_ROLE.pseudostate,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.junction),
    labelFallback: 'Junction',
  },
  {
    id: UML_ROLE['shallow-history'],
    parent: UML_ROLE.pseudostate,
    kind: 'node',
    labelKey: roleKey(UML_ROLE['shallow-history']),
    labelFallback: 'Shallow history',
  },
  {
    id: UML_ROLE['deep-history'],
    parent: UML_ROLE.pseudostate,
    kind: 'node',
    labelKey: roleKey(UML_ROLE['deep-history']),
    labelFallback: 'Deep history',
  },
  {
    id: UML_ROLE['entry-point'],
    parent: UML_ROLE.pseudostate,
    kind: 'node',
    labelKey: roleKey(UML_ROLE['entry-point']),
    labelFallback: 'Entry point',
  },
  {
    id: UML_ROLE['exit-point'],
    parent: UML_ROLE.pseudostate,
    kind: 'node',
    labelKey: roleKey(UML_ROLE['exit-point']),
    labelFallback: 'Exit point',
  },
  {
    id: UML_ROLE.terminate,
    parent: UML_ROLE.pseudostate,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.terminate),
    labelFallback: 'Terminate',
  },
  // ── The interaction artefacts (phase 3) ─────────────────────────────────
  // §17.3.4: the participant column — a named head over a dashed spine. FLAT
  // under nothing, and pointedly not a child of `uml:object` although its name
  // is written with the same `name : Type` grammar (§17.3.4 reuses §9.8.4's
  // ident): an instance specification is a thing that exists, a lifeline is a
  // thing that TAKES PART, and the rules that police the two share nothing.
  {
    id: UML_ROLE.lifeline,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.lifeline),
    labelFallback: 'Lifeline',
  },
  // §17.2.4's ExecutionSpecification: the thin bar drawn ON a spine saying the
  // participant is busy for that stretch of the conversation. A node of its
  // own rather than a decoration of the lifeline, because a lifeline may carry
  // several and they nest — and because the author positions each one by hand.
  {
    id: UML_ROLE.execution,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.execution),
    labelFallback: 'Execution',
  },
  // §17.2.4's DestructionOccurrenceSpecification: the X that ends a lifeline.
  // Flat, and not a child of `uml:terminate` although both are drawn as a bare
  // cross: a terminate pseudostate kills a state MACHINE, a destruction ends
  // one PARTICIPANT's life in one interaction.
  {
    id: UML_ROLE.destruction,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.destruction),
    labelFallback: 'Destruction',
  },
];

/**
 * The written tiers of an artefact's label, as roles on the canvas TEXT
 * elements that carry them.
 *
 * A UML node is a GROUP — the shape plus its words — for the reason C4's
 * component is one (PO recette, 28/08/2026): an architect writes ON the picture,
 * in place, with the ordinary text toolbar, and a field would have been a second
 * place to write the same sentence reachable only through a form. Which leaves
 * one question — given a group of a box and three texts, WHICH text is the
 * attribute compartment? — and the role is the answer that survives a child
 * reordered inside its group, a group ungrouped and regrouped, a tier copied to
 * another node, a tier deleted and redrawn.
 *
 * `uml:name` is the name compartment of every kind that HAS compartments, plus
 * the package's and the note's single line. `uml:label` is the one word written
 * against an actor or inside a use case: the same tier, named differently
 * because it is not a compartment — there is no rectangle for it to be a
 * compartment OF — and a reading profile has to know which of the two to ask for
 * (see `reading.ts`).
 *
 * `kind: 'text'`, as `c4:title` and `wardley:label` are: the BOX of a text
 * element is a creation-time default and not a statement about anything, so a
 * rule measuring one must measure its ink.
 *
 * The GROUP itself is deliberately role-less: a role makes an element count as
 * an artefact for every rule written against roles, and the wrapper round a box
 * is not a second box.
 */
const TIER_DEFS: readonly RoleDef[] = [
  {
    id: UML_ROLE.name,
    kind: 'text',
    labelKey: roleKey(UML_ROLE.name),
    labelFallback: 'Name',
  },
  {
    id: UML_ROLE.attributes,
    kind: 'text',
    labelKey: roleKey(UML_ROLE.attributes),
    labelFallback: 'Attributes',
  },
  {
    id: UML_ROLE.operations,
    kind: 'text',
    labelKey: roleKey(UML_ROLE.operations),
    labelFallback: 'Operations',
  },
  {
    id: UML_ROLE.label,
    kind: 'text',
    labelKey: roleKey(UML_ROLE.label),
    labelFallback: 'Label',
  },
  // §17.3.4's LIFELINE HEAD, and the reason it is a fourth tier rather than a
  // fourth user of `uml:label`.
  //
  // What is written in a lifeline's head is not a name: it is a
  // `<lifelineident>` — `order : Order`, `self`, `customers[i] : Customer` — a
  // production the clause prints a BNF for and `parseLifelineIdent` reads back.
  // An actor's word and a use case's phrase are prose, and the clause that
  // draws them prints no grammar at all. Filing all three under `uml:label`
  // would mean the two questions a tier can be asked — "is anything written
  // here" and "does what is written parse" — could only ever be asked of the
  // three together: the spelling rule would indict `Place an order (fast)` on
  // an ellipse, and the naming rule would tell an author of a sequence diagram
  // that their lifeline is an unnamed use case.
  //
  // FLAT, with no `parent: UML_ROLE.label`, and that is the same statement made
  // once more: `roleIsA` would put every rule written on the label tier back on
  // the head, which is precisely what splitting the tier was for. Hierarchy in
  // this vocabulary is only ever the specification's own, and §17.3.4 makes a
  // lifeline ident a kind of nothing.
  {
    id: UML_ROLE['lifeline-ident'],
    kind: 'text',
    labelKey: roleKey(UML_ROLE['lifeline-ident']),
    labelFallback: 'Lifeline identifier',
  },
];

/**
 * The frames: the sheet the diagram is drawn on (Annex A) and the rectangle a
 * use case diagram draws round the system's own use cases (§18.1.4).
 *
 * Parent-less, and unrelated to each other: a diagram frame is WHERE the drawing
 * lives, a subject is a statement made INSIDE it about which use cases the
 * system offers. Neither is an element of the model, so a rule about classes,
 * packages, actors or use cases must fall on neither.
 *
 * The subject has no children, unlike `c4:boundary`: §18.1.4 draws one rectangle
 * with one name — no variants, no keyword line, no second tier — so there is
 * nothing here for a specialisation to specialise.
 */
const FRAME_DEFS: readonly RoleDef[] = [
  {
    id: UML_ROLE.diagram,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.diagram),
    labelFallback: 'UML diagram',
  },
  {
    id: UML_ROLE.subject,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.subject),
    labelFallback: 'Subject',
  },
  // §15.6.4: the swimlane. A frame and not an artefact, for the reason the
  // subject is one — it says who is responsible for the actions drawn in it,
  // and a rule written about actions must not fall on the lane holding them.
  // Membership is geometry at read time (R11), never a stored list.
  {
    id: UML_ROLE.partition,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.partition),
    labelFallback: 'Partition',
  },
  // §14.2.4: the composite state. A frame, although it IS a state — the one
  // place this vocabulary files a model element as furniture, and it does so
  // because the picture is furniture: a rectangle drawn round a sub-machine,
  // with the sub-states inside it by geometry. A rule about states is written
  // on `uml:state`, which this is deliberately not a child of.
  {
    id: UML_ROLE.region,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.region),
    labelFallback: 'Composite state',
  },
  // §17.6.4: the COMBINED FRAGMENT — the rectangle drawn round part of a
  // conversation with `alt`, `loop` or `opt` in its corner — and, under the
  // `ref` operator, §17.7.4's InteractionUse. A frame for the reason the
  // partition is one: it says something ABOUT the messages inside it, and a
  // rule written on messages must not fall on the box round them. What it
  // holds is geometry at read time (R11), never a stored list.
  {
    id: UML_ROLE.fragment,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.fragment),
    labelFallback: 'Combined fragment',
  },
  // One OPERAND of that fragment — the band between two dashed separators, with
  // its own guard. Declared and never stamped on an element, exactly as
  // `uml:classifier` is: an operand is an INSTANCE ZONE of the fragment's own
  // plot (the mechanism the BPMN pool's lanes use), so the only thing that
  // carries this id is a reported zone. It is here so a rule about what may sit
  // in an operand has a name to be written against.
  {
    id: UML_ROLE.operand,
    kind: 'node',
    labelKey: roleKey(UML_ROLE.operand),
    labelFallback: 'Operand',
  },
];

/**
 * The relationships — nine typed edges under `docs/adr/0010`.
 *
 * Tier 1 of that ADR is generic — `source` is the subject of the role's verb,
 * `target` its object. Tier 2 is the `direction` block, and UML is the framework
 * that needs it most: the notation's whole grammar is in WHICH END carries the
 * decoration, and an architect who draws a generalization the wrong way round
 * has drawn the opposite statement. So every relationship that HAS a reading
 * declares its verb and the gesture that produces it.
 *
 * Two declare none, and that is a statement too:
 *
 *  - `uml:association` is UNDIRECTED (§11.5.4): a plain line between two
 *    classifiers says they are related and nothing about which way. Giving it a
 *    default verb would put words in the diagram's mouth every time somebody
 *    dragged a line and moved on — and, worse, would make the reveal claim a
 *    direction the notation explicitly declines to draw.
 *  - `uml:anchor` is the dotted line from a note to what it annotates. It has no
 *    verb because a comment is not a relationship between two model elements; it
 *    is a piece of paper pinned to one.
 *
 * ## The diamond ends, and where the source is
 *
 * For `uml:aggregation` and `uml:composition` the source is the WHOLE — the end
 * that carries the diamond, which `actions.ts` arms as the connector's FRONT
 * endpoint. That is the one asymmetry a user can get backwards without noticing,
 * because both ends of the line look alike until the diamond lands, so the
 * gesture hint says it in as many words.
 */
const RELATIONSHIP_DEFS: readonly RoleDef[] = [
  {
    id: UML_ROLE.association,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE.association),
    labelFallback: 'Association',
  },
  {
    id: UML_ROLE.aggregation,
    parent: UML_ROLE.association,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE.aggregation),
    labelFallback: 'Aggregation',
    direction: {
      verbKey: `${roleKey(UML_ROLE.aggregation)}.verb`,
      verbFallback: 'is composed of',
      gestureHintKey: `${roleKey(UML_ROLE.aggregation)}.gesture`,
      gestureHintFallback:
        'Drag from the whole to the part — the diamond lands on the whole.',
    },
  },
  {
    id: UML_ROLE.composition,
    parent: UML_ROLE.association,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE.composition),
    labelFallback: 'Composition',
    direction: {
      verbKey: `${roleKey(UML_ROLE.composition)}.verb`,
      verbFallback: 'is composed of',
      gestureHintKey: `${roleKey(UML_ROLE.composition)}.gesture`,
      gestureHintFallback:
        'Drag from the whole to the part — the diamond lands on the whole.',
    },
  },
  {
    id: UML_ROLE.generalization,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE.generalization),
    labelFallback: 'Generalization',
    direction: {
      verbKey: `${roleKey(UML_ROLE.generalization)}.verb`,
      verbFallback: 'is a',
      gestureHintKey: `${roleKey(UML_ROLE.generalization)}.gesture`,
      gestureHintFallback:
        'Drag from the specific classifier to the general one — the hollow ' +
        'triangle lands on the general.',
    },
  },
  {
    id: UML_ROLE.realization,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE.realization),
    labelFallback: 'Realization',
    direction: {
      verbKey: `${roleKey(UML_ROLE.realization)}.verb`,
      verbFallback: 'realizes',
      gestureHintKey: `${roleKey(UML_ROLE.realization)}.gesture`,
      gestureHintFallback:
        'Drag from the class to the interface it implements.',
    },
  },
  {
    id: UML_ROLE.dependency,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE.dependency),
    labelFallback: 'Dependency',
    direction: {
      verbKey: `${roleKey(UML_ROLE.dependency)}.verb`,
      verbFallback: 'depends on',
      gestureHintKey: `${roleKey(UML_ROLE.dependency)}.gesture`,
      gestureHintFallback:
        'Drag from the element that needs the other to the one it needs.',
    },
  },
  {
    id: UML_ROLE.anchor,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE.anchor),
    labelFallback: 'Anchor',
  },
  {
    id: UML_ROLE.include,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE.include),
    labelFallback: 'Include',
    direction: {
      verbKey: `${roleKey(UML_ROLE.include)}.verb`,
      verbFallback: 'includes',
      gestureHintKey: `${roleKey(UML_ROLE.include)}.gesture`,
      gestureHintFallback:
        'Drag from the base use case to the one it always includes.',
    },
  },
  {
    id: UML_ROLE.extend,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE.extend),
    labelFallback: 'Extend',
    direction: {
      verbKey: `${roleKey(UML_ROLE.extend)}.verb`,
      verbFallback: 'extends',
      gestureHintKey: `${roleKey(UML_ROLE.extend)}.gesture`,
      gestureHintFallback:
        'Drag from the extending use case to the base one it may extend.',
    },
  },
  // ── The deployment relationships (phase 2) ──────────────────────────────
  // §19.2.4: a Deployment is drawn as a dashed arrow keyworded `«deploy»`, from
  // the artifact TO the node it runs on. The source is the artifact because the
  // artifact is the subject of the sentence: `order.jar is deployed on
  // :AppServer`, never the other way round.
  {
    id: UML_ROLE.deploy,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE.deploy),
    labelFallback: 'Deploy',
    direction: {
      verbKey: `${roleKey(UML_ROLE.deploy)}.verb`,
      verbFallback: 'is deployed on',
      gestureHintKey: `${roleKey(UML_ROLE.deploy)}.gesture`,
      gestureHintFallback:
        'Drag from the artifact to the node it runs on — the arrow lands on the node.',
    },
  },
  // §19.3.4: a Manifestation is the other dashed arrow off an artifact, and it
  // says what the file IS a physical embodiment of. Same source for the same
  // reason: `order.jar manifests Ordering`.
  {
    id: UML_ROLE.manifest,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE.manifest),
    labelFallback: 'Manifest',
    direction: {
      verbKey: `${roleKey(UML_ROLE.manifest)}.verb`,
      verbFallback: 'manifests',
      gestureHintKey: `${roleKey(UML_ROLE.manifest)}.gesture`,
      gestureHintFallback:
        'Drag from the artifact to the component it is a physical copy of.',
    },
  },
  // §19.4.4: a CommunicationPath is a plain solid line between two nodes saying
  // they can exchange messages. UNDIRECTED, and verbless for the reason
  // `uml:association` is: the notation draws no arrow, so claiming a direction
  // would put words in the diagram's mouth. Flat under nothing — see the header
  // on the one place this file departs from the metamodel.
  {
    id: UML_ROLE['communication-path'],
    kind: 'edge',
    labelKey: roleKey(UML_ROLE['communication-path']),
    labelFallback: 'Communication path',
  },
  // ── The behaviour relationships (phase 2) ───────────────────────────────
  // §15.2.4: the two ActivityEdges. Both are a solid line with an open arrow,
  // and both read "flows to" — what tells them apart is what is AT THE ENDS: a
  // control flow sequences two actions, an object flow carries a value into or
  // out of one. Two roles rather than one with a flag, because "an object flow
  // must touch an object node" is a sentence that has to reach one of them and
  // not the other.
  {
    id: UML_ROLE['control-flow'],
    kind: 'edge',
    labelKey: roleKey(UML_ROLE['control-flow']),
    labelFallback: 'Control flow',
    direction: {
      verbKey: `${roleKey(UML_ROLE['control-flow'])}.verb`,
      verbFallback: 'flows to',
      gestureHintKey: `${roleKey(UML_ROLE['control-flow'])}.gesture`,
      gestureHintFallback:
        'Drag from the action that finishes to the one that starts next — the arrow lands on the next.',
    },
  },
  {
    id: UML_ROLE['object-flow'],
    kind: 'edge',
    labelKey: roleKey(UML_ROLE['object-flow']),
    labelFallback: 'Object flow',
    direction: {
      verbKey: `${roleKey(UML_ROLE['object-flow'])}.verb`,
      verbFallback: 'flows to',
      gestureHintKey: `${roleKey(UML_ROLE['object-flow'])}.gesture`,
      gestureHintFallback:
        'Drag from where the value comes from to where it is consumed.',
    },
  },
  // §14.2.4.8: a Transition — the arrow between two vertices of a state
  // machine, labelled `trigger [guard] / effect`. FLAT under nothing and not a
  // sibling of the two flows above: an activity edge carries a token between
  // actions, a transition fires a machine from one state into another, and the
  // rules that police the two have different endpoint tables.
  {
    id: UML_ROLE.transition,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE.transition),
    labelFallback: 'Transition',
    direction: {
      verbKey: `${roleKey(UML_ROLE.transition)}.verb`,
      verbFallback: 'transitions to',
      gestureHintKey: `${roleKey(UML_ROLE.transition)}.gesture`,
      gestureHintFallback:
        'Drag from the state the machine leaves to the state it enters.',
    },
  },
  // ── The interaction relationships (phase 3) ─────────────────────────────
  // §17.4.4: a Message. The PARENT is verbless, exactly as `uml:association`
  // is, and for a sharper version of the same reason — the five children below
  // say five different things ("calls", "sends", "replies to", "creates",
  // "destroys") and a default verb on the parent would be a sixth, claimed by
  // whichever of them a rule happened to reach through it.
  //
  // The SOURCE is the sender on all five, without exception. That is the one
  // thing a reader of a sequence diagram may never have to guess: the arrow
  // points at the receiver, the line's height is when it happens, and a
  // message drawn the wrong way round is the opposite exchange.
  {
    id: UML_ROLE.message,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE.message),
    labelFallback: 'Message',
  },
  {
    id: UML_ROLE['message-sync'],
    parent: UML_ROLE.message,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE['message-sync']),
    labelFallback: 'Synchronous message',
    direction: {
      verbKey: `${roleKey(UML_ROLE['message-sync'])}.verb`,
      verbFallback: 'calls',
      gestureHintKey: `${roleKey(UML_ROLE['message-sync'])}.gesture`,
      gestureHintFallback:
        'Drag from the sender to the receiver — the filled arrowhead lands on the receiver.',
    },
  },
  {
    id: UML_ROLE['message-async'],
    parent: UML_ROLE.message,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE['message-async']),
    labelFallback: 'Asynchronous message',
    direction: {
      verbKey: `${roleKey(UML_ROLE['message-async'])}.verb`,
      verbFallback: 'sends',
      gestureHintKey: `${roleKey(UML_ROLE['message-async'])}.gesture`,
      gestureHintFallback:
        'Drag from the sender to the receiver — the open arrowhead says the sender does not wait.',
    },
  },
  // The dashed line back. Its source is still the SENDER — the participant the
  // reply comes FROM, which is the one that was called — so an author draws
  // every message the same way round and the notation sorts itself out.
  {
    id: UML_ROLE['message-reply'],
    parent: UML_ROLE.message,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE['message-reply']),
    labelFallback: 'Reply message',
    direction: {
      verbKey: `${roleKey(UML_ROLE['message-reply'])}.verb`,
      verbFallback: 'replies to',
      gestureHintKey: `${roleKey(UML_ROLE['message-reply'])}.gesture`,
      gestureHintFallback:
        'Drag from the participant that was called back to the one that called it.',
    },
  },
  // §17.4.4's createMessage: the dashed arrow that lands on a lifeline's HEAD,
  // drawn at the height the participant comes into existence.
  {
    id: UML_ROLE['message-create'],
    parent: UML_ROLE.message,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE['message-create']),
    labelFallback: 'Create message',
    direction: {
      verbKey: `${roleKey(UML_ROLE['message-create'])}.verb`,
      verbFallback: 'creates',
      gestureHintKey: `${roleKey(UML_ROLE['message-create'])}.gesture`,
      gestureHintFallback:
        'Drag from the sender to the head of the lifeline it brings into existence.',
    },
  },
  // …and its opposite: the message whose arrival ends a life, drawn to the X.
  {
    id: UML_ROLE['message-delete'],
    parent: UML_ROLE.message,
    kind: 'edge',
    labelKey: roleKey(UML_ROLE['message-delete']),
    labelFallback: 'Delete message',
    direction: {
      verbKey: `${roleKey(UML_ROLE['message-delete'])}.verb`,
      verbFallback: 'destroys',
      gestureHintKey: `${roleKey(UML_ROLE['message-delete'])}.gesture`,
      gestureHintFallback:
        'Drag from the sender to the destruction mark that ends the receiver.',
    },
  },
];

const DEFS: readonly RoleDef[] = [
  ...ELEMENT_DEFS,
  ...TIER_DEFS,
  ...FRAME_DEFS,
  ...RELATIONSHIP_DEFS,
];

// Null prototype: this is a lookup table keyed by ids that may one day come
// from host-supplied packs, so `defs['toString']` must not resolve.
export const UML_ROLES: RoleDefs = Object.assign(
  Object.create(null),
  Object.fromEntries(DEFS.map(def => [def.id, def]))
);

/**
 * The `kind` discriminant → the role it means.
 *
 * `kind` drives the renderer and is what the palette writes; the ROLE is the
 * semantic authority. The two are posted side by side at every creation site,
 * the way C4, BPMN and Wardley already do it, and this table is the single place
 * that says which kind means which role. Total over {@link UmlNodeKind} by its
 * type, so a new kind cannot land without being given a meaning.
 *
 * One kind, one role, with none collapsed — unlike C4, where four kinds are a
 * second DRAWING of a level. Here the thirty-eight kinds are thirty-eight
 * different artefacts of the specification, and the three roles with no kind of
 * their own — `uml:classifier`, `uml:control-node`, `uml:pseudostate` — are
 * ancestors rather than any of them.
 */
export const UML_ROLE_OF_KIND: Record<UmlNodeKind, RoleId> = {
  class: UML_ROLE.class,
  interface: UML_ROLE.interface,
  enumeration: UML_ROLE.enumeration,
  object: UML_ROLE.object,
  package: UML_ROLE.package,
  note: UML_ROLE.note,
  actor: UML_ROLE.actor,
  'use-case': UML_ROLE['use-case'],
  component: UML_ROLE.component,
  port: UML_ROLE.port,
  'provided-interface': UML_ROLE['provided-interface'],
  'required-interface': UML_ROLE['required-interface'],
  artifact: UML_ROLE.artifact,
  // The one role that is BOTH a parent and a drawing: §19.4 makes Node
  // instantiable and derives Device and ExecutionEnvironment from it.
  node: UML_ROLE.node,
  device: UML_ROLE.device,
  'execution-environment': UML_ROLE['execution-environment'],
  // ── The activity artefacts (phase 2) ────────────────────────────────────
  action: UML_ROLE.action,
  // Shared by `act` and `stm`: the same disc, the same meaning. See the def.
  initial: UML_ROLE.initial,
  'activity-final': UML_ROLE['activity-final'],
  'flow-final': UML_ROLE['flow-final'],
  decision: UML_ROLE.decision,
  fork: UML_ROLE.fork,
  'object-node': UML_ROLE['object-node'],
  'send-signal': UML_ROLE['send-signal'],
  'accept-event': UML_ROLE['accept-event'],
  'time-event': UML_ROLE['time-event'],
  // ── The state machine artefacts (phase 2) ───────────────────────────────
  state: UML_ROLE.state,
  'final-state': UML_ROLE['final-state'],
  choice: UML_ROLE.choice,
  junction: UML_ROLE.junction,
  'shallow-history': UML_ROLE['shallow-history'],
  'deep-history': UML_ROLE['deep-history'],
  'entry-point': UML_ROLE['entry-point'],
  'exit-point': UML_ROLE['exit-point'],
  terminate: UML_ROLE.terminate,
  // ── The interaction artefacts (phase 3) ─────────────────────────────────
  lifeline: UML_ROLE.lifeline,
  execution: UML_ROLE.execution,
  destruction: UML_ROLE.destruction,
};
