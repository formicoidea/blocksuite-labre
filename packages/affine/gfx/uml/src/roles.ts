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
 * ## The frames
 *
 * `uml:diagram` and `uml:subject` are parent-less, the same call `c4:board`,
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
  // The written tiers of an artefact's label, as canvas text.
  | 'name'
  | 'attributes'
  | 'operations'
  | 'label'
  // The frames.
  | 'diagram'
  | 'subject'
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
  | 'communication-path';

export type UmlRoleId = `uml:${UmlRole}`;

/**
 * Role ids, keyed by their own name.
 *
 * Keyed by the ROLE and not by the `kind`: UML has sixteen node kinds and
 * seventeen node roles, because `uml:classifier` is a parent nothing is ever
 * drawn as. ({@link UML_ROLE.node} is a parent too, and IS drawn — §19.4 makes a
 * Node instantiable — so it does not add a role of its own.)
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
  name: 'uml:name',
  attributes: 'uml:attributes',
  operations: 'uml:operations',
  label: 'uml:label',
  diagram: 'uml:diagram',
  subject: 'uml:subject',
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
 * second DRAWING of a level. Here the sixteen kinds are sixteen different
 * artefacts of the specification, and `uml:classifier` — the one role with no
 * kind of its own — is an ancestor rather than one of them.
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
};
