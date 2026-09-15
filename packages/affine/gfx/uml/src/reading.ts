import type { ReadingProfile } from '@labre/affine-block-surface';

import { UML_ROLE, UML_ROLES } from './roles.js';

/**
 * What a UML diagram lets the tool read of an element (MF3, the reversed
 * reading).
 *
 * DATA, like the legend and the roles beside it: the engine
 * (`@labre/affine-block-surface`) knows how to read a role and a typed edge — it
 * knows nothing about UML. Everything below is already stated in `roles.ts` and
 * is merely POINTED AT here.
 *
 * Registered from the FLAG-GATED view extension: reading a diagram is tooling,
 * so a sheet whose `uml` flag is off keeps every element it has and simply stops
 * being read (ADR 0009).
 *
 * ## FORTY profiles, one per artefact, because the roles are flat
 *
 * There are two chains in the node vocabulary — `uml:classifier` over class,
 * interface and enumeration, and (since phase 2) `uml:node` over device and
 * execution environment — and a single profile written on either parent would
 * read its children through `roleIsA`. Neither shortcut is taken, and the reason
 * is the panel rather than the vocabulary: a profile's `id` is what the DI keys
 * on and what a user sees the reading OF, and "Classifier" is a word the
 * specification uses and an architect does not, while "Node" is a word that
 * would make the panel call a database server something vaguer than the picture
 * already says. Profiles differing by `id` and `appliesTo` cost three lines each
 * and let the panel say "Device" about a device.
 *
 * `uml:node` is NOT in that argument's exception list, though: unlike
 * `uml:classifier` it is a role elements really carry — `uml.addNode` draws one
 * — so it has a profile of its own rather than an entry in
 * `reading-coverage.unit.spec.ts`'s unread list. A parent that is also a
 * concrete kind is read as that kind.
 *
 * The remaining roles are flat by construction (`roles.ts` argues each one), so
 * they get a profile each with nothing to decide.
 *
 * The FRAMES are not read: `uml:diagram` is the sheet, and `uml:subject`,
 * `uml:partition`, `uml:region` and — since phase 3 — `uml:fragment` and the
 * `uml:operand` bands inside it are rectangles drawn round part of it, and
 * `packages/affine/all/src/__tests__/reading-coverage.unit.spec.ts` records
 * every one of them as such so the coverage test does not ask a sheet to read
 * itself back as a sentence.
 *
 * ## The name lives on a separate element
 *
 * Every UML artefact is a composite — a shape, and the canvas texts grouped with
 * it — so every profile points `labelRole` at the tier that names it. Without
 * it the panel would print an id at a human, and the relation lines would name
 * the other end by id too.
 *
 * `uml:name` for everything whose words a keyword may be written over — the
 * compartmented kinds (the state among them, since §14.2.4 draws one), the
 * package, the note and the three deployment cubes — and `uml:label` for the
 * artefacts whose one word is a name and nothing else: the actor, the use case,
 * the port, the two interface marks and the activity vocabulary. See `roles.ts`
 * on why the tier is named twice.
 *
 * The split has a second consequence worth stating, because it is the engine's
 * and not this file's: `readElement` names the OTHER end of a relation through
 * the SAME profile's `labelRole`, so a reading only names its neighbour when the
 * two agree on a tier. That is why `uml-artifact` and `uml-node` are both
 * `uml:name` — they read one another through {@link DEPLOY}, and a deployment
 * that printed an id at the far end would be a panel that answered "where does
 * this run" with a nanoid.
 *
 * ## SEVERAL relations per profile, and which one comes first
 *
 * `ReadingProfile.relation` names the relation an architect reads that artefact
 * THROUGH — the question it answers first — and `ReadingProfile.alsoRelations`
 * names the others, in the order the panel lists them. `roleIsA` does the rest
 * where a chain exists: a table declaring `uml:association` reads aggregations
 * and compositions too, because the specification makes them associations
 * (§11.5.4), and nothing has to restate the diamonds.
 *
 * Phases 1 to 3 declared ONE table each, which was a narrowing this file argued
 * for and named the cost of: a class's generalizations, realizations and
 * dependencies went unread, a use case's `include` and `extend` went unread,
 * and so did a node's communication paths and an artifact's manifestations.
 * The PO's recette of 2026-09-14 (O8) is what overturned it, and the finding is
 * not that the narrowing was wrong but that it is INVISIBLE: the panel says
 * "No typed link touches this component" whether a framework declined to read
 * the line or failed to, and a use case whose only link is an `«include»`
 * therefore reads as an unconnected box on a diagram that plainly connects it.
 * A reader cannot tell a choice from a bug, so the choice had to go.
 *
 * Every table below is one the notation draws and this canvas types. Two rules
 * govern the lists: they must not OVERLAP (an edge matching two tables would be
 * listed twice — which is why no profile declares both `uml:association` and
 * one of its specialisations), and the FIRST is the relation that answers "what
 * is this connected to" first.
 *
 * One line is still read from ONE end on purpose, and it is the only one: the
 * `uml:anchor` of Annex A, which the NOTE reads and the artefact it comments on
 * does not. It is not a relation between two model elements — it is a comment
 * pinned to one — and a class reading "Attached to:" followed by the whole
 * first line of somebody's note would be the panel quoting prose at a reader
 * who asked what the class is connected to.
 *
 * ## No nature, no phase
 *
 * UML ships no type-3 tag pack: the artefacts ARE the roles, and the keyword
 * line of §11.4.4 already says the rest in the author's own words. And a diagram
 * frame declares which kind of diagram it draws, not a set of zones a position
 * could be read against — nothing in UML gives a coordinate a meaning.
 */

/**
 * The two words an ASSOCIATION is read with.
 *
 * Undirected (§11.5.4), which is the one thing the wording has to survive: the
 * role declares no verb precisely because a plain line claims no direction, so
 * both sides say the same thing. `source` and `target` are still persisted and
 * still mean something to aggregation and composition — which read through this
 * profile and whose diamond IS on the source end — but the panel must not
 * announce a reading the notation declines to draw.
 */
const ASSOCIATION = {
  edgeRole: UML_ROLE.association,
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.associated',
      labelFallback: 'Associated with',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.associated',
      labelFallback: 'Associated with',
    },
  },
} as const;

/**
 * A GENERALIZATION (§9.9.4) — the hollow triangle, read as the taxonomy it is.
 *
 * Directed, and the two sides are the two halves of one sentence an architect
 * says out loud: the source is the specific classifier and the target the
 * general one (`roles.ts` fixes that, and the triangle lands on the general
 * end), so a subclass reads "Specializes: Payment" and the superclass reads
 * "Specialized by: CardPayment, Transfer".
 *
 * The wording is the reader's rather than the metamodel's — "generalizes" is a
 * word the specification uses about the relationship and nobody uses about a
 * class — and it is asymmetric because the two ends are genuinely not peers.
 */
const GENERALIZATION = {
  edgeRole: UML_ROLE.generalization,
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.specializedBy',
      labelFallback: 'Specialized by',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.specializes',
      labelFallback: 'Specializes',
    },
  },
} as const;

/**
 * A REALIZATION (§10.4.4) — the dashed line with the hollow triangle, from a
 * class to the interface it implements.
 *
 * Its own table rather than a reading through {@link GENERALIZATION}: the two
 * roles are filed FLAT in `roles.ts` (a realization is not a kind of
 * generalization, it is the other thing a hollow triangle can mean), and the
 * sentence is different — a class does not BECOME its interface, it promises to
 * answer for it.
 */
const REALIZATION = {
  edgeRole: UML_ROLE.realization,
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.realizedBy',
      labelFallback: 'Realized by',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.realizes',
      labelFallback: 'Realizes',
    },
  },
} as const;

/**
 * An INCLUDE (§18.1.4) — the `«include»` arrow from the base use case to the
 * behaviour it always performs.
 *
 * The wording is the role's own verb (`roles.ts`: "includes"), said from each
 * end: the base reads "Includes: Pay", the included one reads "Included by:
 * Order". §18.1.3 makes both ends use cases, so neither sentence can be about
 * anything else.
 */
const INCLUDE = {
  edgeRole: UML_ROLE.include,
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.includedBy',
      labelFallback: 'Included by',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.includes',
      labelFallback: 'Includes',
    },
  },
} as const;

/**
 * An EXTEND (§18.1.4) — the `«extend»` arrow, and the one relation of the pack
 * whose arrow points AT what it is about.
 *
 * `roles.ts` draws it from the EXTENDING use case to the base one, which is the
 * specification's direction and the opposite of the include's, so the wordings
 * are swapped with respect to {@link INCLUDE} rather than copied: the extending
 * behaviour reads "Extends: Order", the base reads "Extended by: ApplyCoupon".
 */
const EXTEND = {
  edgeRole: UML_ROLE.extend,
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.extendedBy',
      labelFallback: 'Extended by',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.extends',
      labelFallback: 'Extends',
    },
  },
} as const;

/**
 * A MANIFESTATION (§19.3.4) — the dashed arrow that says what a file IS.
 *
 * The other half of {@link DEPLOY}: an artifact reads "Manifests: Ordering"
 * and the component reads "Manifested by: ordering.jar", off one table read
 * from its two ends. Asymmetric for the same reason the deployment is — the
 * source is a physical file and the target a piece of the model.
 */
const MANIFEST = {
  edgeRole: UML_ROLE.manifest,
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.manifestedBy',
      labelFallback: 'Manifested by',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.manifests',
      labelFallback: 'Manifests',
    },
  },
} as const;

/**
 * A COMMUNICATION PATH (§19.4.4) — the plain line between two nodes.
 *
 * Undirected, exactly like {@link ASSOCIATION} and for the same reason: the
 * notation draws no arrow, so both sides say the same thing and the panel
 * claims nothing the drawing declines to.
 */
const COMMUNICATION_PATH = {
  edgeRole: UML_ROLE['communication-path'],
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.communicatesWith',
      labelFallback: 'Communicates with',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.communicatesWith',
      labelFallback: 'Communicates with',
    },
  },
} as const;

/**
 * A package is read through its DEPENDENCIES (§7.8.4) — which is what a package
 * diagram is for: `«use»` and `«import»` arrows between the parts of a system.
 * Directed, unlike the association, and the two sides say so.
 */
const DEPENDENCY = {
  edgeRole: UML_ROLE.dependency,
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.dependedOnBy',
      labelFallback: 'Depended on by',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.dependsOn',
      labelFallback: 'Depends on',
    },
  },
} as const;

/**
 * A note is read through its ANCHORS (Annex A) — the dotted lines tying it to
 * what it comments on. The one relation that is not between two model elements,
 * which is why the wording is about attachment rather than about a verb.
 */
const ANCHOR = {
  edgeRole: UML_ROLE.anchor,
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.attached',
      labelFallback: 'Attached to',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.attached',
      labelFallback: 'Attached to',
    },
  },
} as const;

/**
 * A DEPLOYMENT (§19.2.4) — the dashed arrow that says where a file runs.
 *
 * Directed, and the wording is asymmetric because the two ends are different
 * KINDS of thing rather than two peers: the source is an artifact (`.war`,
 * script, image) and the target is a node. So an artifact reads "Deployed on:
 * AppServer" and the server reads "Hosts: orders.war" — one table, two sentences,
 * and each is the one its side of the arrow actually wants.
 */
const DEPLOY = {
  edgeRole: UML_ROLE.deploy,
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.hosts',
      labelFallback: 'Hosts',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.deployedOn',
      labelFallback: 'Deployed on',
    },
  },
} as const;

/**
 * A CONTROL FLOW (§15.2.4) — the arrow that says which step comes next.
 *
 * Directed, and the wording is the plainest in the pack on purpose: an activity
 * diagram answers one question — what happens after this — and the panel should
 * answer it in the words a reader would use rather than in the metamodel's.
 */
const FLOW = {
  edgeRole: UML_ROLE['control-flow'],
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.flowsFrom',
      labelFallback: 'Flows from',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.flowsTo',
      labelFallback: 'Flows to',
    },
  },
} as const;

/**
 * An OBJECT FLOW (§15.4.4) — the same arrow, carrying data rather than a token.
 *
 * Its own table rather than a reading through {@link FLOW}, because the two
 * roles are filed FLAT in `roles.ts`: an object flow is not a control flow, it
 * is the other kind of activity edge, and a profile declaring the one would
 * never reach the other. The data node is the one artefact that wants this
 * table, which is exactly the one artefact that has it.
 */
const OBJECT_FLOW = {
  edgeRole: UML_ROLE['object-flow'],
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.producedBy',
      labelFallback: 'Produced by',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.consumedBy',
      labelFallback: 'Consumed by',
    },
  },
} as const;

/**
 * A TRANSITION (§14.2.4.8) — what takes the machine from one state to the next.
 *
 * Distinct from {@link FLOW} rather than sharing its wording, because the two
 * sentences are genuinely different: an activity's arrow says what happens
 * NEXT, a state machine's says what this thing BECOMES, and the `trigger
 * [guard] / effect` written on the line is the answer to "when".
 */
const TRANSITION = {
  edgeRole: UML_ROLE.transition,
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.transitionsFrom',
      labelFallback: 'Entered from',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.transitionsTo',
      labelFallback: 'Transitions to',
    },
  },
} as const;

/**
 * A MESSAGE (§17.4.4) — what one participant asks another to do.
 *
 * Its own table rather than a reading through {@link FLOW}, and the two roles
 * are filed apart for the same reason the object flow is: a message is not a
 * control flow, it is the other thing an arrow can be, and a profile declaring
 * the one would never reach the other.
 *
 * Declared on the PARENT `uml:message`, which is what makes one table answer
 * for all five: `roleIsA` files `uml:message-sync`, `-async`, `-reply`,
 * `-create` and `-delete` under it (`roles.ts`), so a lifeline reads every
 * message drawn on it whichever of the five an author typed it as. The
 * alternative — five tables, one per drawing — would make a participant's
 * reading depend on whether the call it received happened to be asynchronous.
 *
 * The wording is asymmetric and deliberately in the reader's words rather than
 * the metamodel's: the question a sequence diagram answers about a participant
 * is who talks to it and who it talks to.
 */
const MESSAGE = {
  edgeRole: UML_ROLE.message,
  sides: {
    consumer: {
      labelKey: 'com.labre.uml.reading.relations.receivesFrom',
      labelFallback: 'Receives from',
    },
    supplier: {
      labelKey: 'com.labre.uml.reading.relations.sendsTo',
      labelFallback: 'Sends to',
    },
  },
} as const;

/**
 * One artefact, as a profile. The forty below differ by five fields at most.
 *
 * `also` is variadic rather than an array argument because most entries pass
 * none and the ones that pass some pass two or three: `profile('uml-use-case',
 * …, ASSOCIATION, INCLUDE, EXTEND)` reads as the list of lines a use case
 * carries, which is what it is.
 */
const profile = (
  id: string,
  appliesTo: string,
  labelRole: string,
  relation: ReadingProfile['relation'],
  ...also: readonly NonNullable<ReadingProfile['relation']>[]
): ReadingProfile => ({
  id,
  framework: 'uml',
  roles: UML_ROLES,
  appliesTo,
  labelRole,
  relation,
  ...(also.length > 0 ? { alsoRelations: also } : {}),
});

/**
 * The FOUR lines a class diagram draws off a classifier, in the order §11 and
 * §9 put them: the association first (it is what a class diagram is mostly
 * made of), then the taxonomy, then the contract, then the `«use»` arrow.
 *
 * The four are declared once and shared by the four classifier profiles, which
 * is the same argument `roles.ts` makes about the chain: a class, an interface,
 * an enumeration and an object carry the same lines, and four copies of this
 * list would be four places for a wording to drift.
 */
export const UML_CLASS_READING = profile(
  'uml-class',
  UML_ROLE.class,
  UML_ROLE.name,
  ASSOCIATION,
  GENERALIZATION,
  REALIZATION,
  DEPENDENCY
);
export const UML_INTERFACE_READING = profile(
  'uml-interface',
  UML_ROLE.interface,
  UML_ROLE.name,
  ASSOCIATION,
  GENERALIZATION,
  REALIZATION,
  DEPENDENCY
);
export const UML_ENUMERATION_READING = profile(
  'uml-enumeration',
  UML_ROLE.enumeration,
  UML_ROLE.name,
  ASSOCIATION,
  GENERALIZATION,
  REALIZATION,
  DEPENDENCY
);
/** An instance, read through the links between instances (§9.8.4). */
export const UML_OBJECT_READING = profile(
  'uml-object',
  UML_ROLE.object,
  UML_ROLE.name,
  ASSOCIATION,
  GENERALIZATION,
  REALIZATION,
  DEPENDENCY
);
export const UML_PACKAGE_READING = profile(
  'uml-package',
  UML_ROLE.package,
  UML_ROLE.name,
  DEPENDENCY
);
export const UML_NOTE_READING = profile(
  'uml-note',
  UML_ROLE.note,
  UML_ROLE.name,
  ANCHOR
);
/** An actor's one word is a `uml:label`: there is no compartment to name. */
export const UML_ACTOR_READING = profile(
  'uml-actor',
  UML_ROLE.actor,
  UML_ROLE.label,
  ASSOCIATION,
  GENERALIZATION
);
/**
 * A use case is read through the actors it serves FIRST — which is the question
 * a use-case diagram exists to answer — and then through the two arrows §18.1.4
 * draws between use cases.
 *
 * The include and the extend are the PO's O8 in its plainest form: a use case
 * reached only through an `«include»` had a typed line on the canvas, in the
 * export and in the direction reveal, and a panel that said "No typed link
 * touches this component". A generalization between use cases is legal
 * (§18.1.3) and is here for the same reason.
 */
export const UML_USE_CASE_READING = profile(
  'uml-use-case',
  UML_ROLE['use-case'],
  UML_ROLE.label,
  ASSOCIATION,
  INCLUDE,
  EXTEND,
  GENERALIZATION
);

/* ── Phase 2: components (§11.6.4, §11.3.4, §10.4.4) ───────────────────── */

/**
 * A component is read through its DEPENDENCIES, like the package it is often
 * mistaken for: §11.6.4 wires a component diagram with `«use»` arrows to the
 * interfaces its neighbours provide, and "what does this need, and who needs it"
 * is the question the diagram exists to answer.
 *
 * Then through the two other lines that reach it: the `«manifest»` arrows that
 * say which files embody it (§19.3.4 — the far end of {@link MANIFEST}, whose
 * near end the artifact reads) and the realizations §10.4.4 draws from a
 * component to an interface it provides.
 */
export const UML_COMPONENT_READING = profile(
  'uml-component',
  UML_ROLE.component,
  UML_ROLE.name,
  DEPENDENCY,
  MANIFEST,
  REALIZATION
);
/**
 * A port is read through the plain connectors drawn from it (§11.3.4): an
 * assembly or a delegation is an undecorated line, which is to say an
 * association, and it is the only relation a port ever carries.
 */
export const UML_PORT_READING = profile(
  'uml-port',
  UML_ROLE.port,
  UML_ROLE.label,
  ASSOCIATION
);
/** The ball of §10.4.4, read through the assembly line that joins it to a socket. */
export const UML_PROVIDED_INTERFACE_READING = profile(
  'uml-provided-interface',
  UML_ROLE['provided-interface'],
  UML_ROLE.label,
  ASSOCIATION
);
/** The socket, read through the same line from the other side. */
export const UML_REQUIRED_INTERFACE_READING = profile(
  'uml-required-interface',
  UML_ROLE['required-interface'],
  UML_ROLE.label,
  ASSOCIATION
);

/* ── Phase 2: deployment (§19.2.4, §19.3.4, §19.4.4) ───────────────────── */

/**
 * An artifact is read through WHERE IT RUNS, and then through WHAT IT IS.
 *
 * The order is the reader's rather than the metamodel's: the `«manifest»` arrow
 * to the component a file is the physical form of is the modelling fact, the
 * deployment is the operational one, and an architect opening this panel on a
 * `.war` file is asking which server it is on before asking anything else.
 */
export const UML_ARTIFACT_READING = profile(
  'uml-artifact',
  UML_ROLE.artifact,
  UML_ROLE.name,
  DEPLOY,
  MANIFEST
);
/**
 * A node is read through WHAT RUNS ON IT — the same table, from the other end —
 * and then through the nodes it can TALK TO (§19.4.4).
 */
export const UML_NODE_READING = profile(
  'uml-node',
  UML_ROLE.node,
  UML_ROLE.name,
  DEPLOY,
  COMMUNICATION_PATH
);
/** A device: a node that is hardware (§19.4.4), and read as one. */
export const UML_DEVICE_READING = profile(
  'uml-device',
  UML_ROLE.device,
  UML_ROLE.name,
  DEPLOY,
  COMMUNICATION_PATH
);
/** An execution environment: a node that is software, and read as one. */
export const UML_EXECUTION_ENVIRONMENT_READING = profile(
  'uml-execution-environment',
  UML_ROLE['execution-environment'],
  UML_ROLE.name,
  DEPLOY,
  COMMUNICATION_PATH
);

/* ── Phase 2: activities (§15.2.4, §15.3.4, §15.4.4, §16.3.4, §16.10.4) ── */

/**
 * Every artefact below takes its name off `uml:label` — except the STATE, which
 * is a divided box and takes it off `uml:name` — and thirteen of them have none
 * to take: a control node and a pseudostate are created with no text at all
 * (`actions.ts`), because §15.3.4 and §14.2.4 name none of them. The
 * profile still declares the tier, and that is deliberate rather than sloppy —
 * `readElement` names the OTHER end of a relation through the SAME profile's
 * `labelRole`, so an action reading "Flows to:" about the decision it points at
 * agrees with the decision's own profile on where a name would be if there were
 * one. Declaring a different tier on the unnamed ones would break that
 * agreement for no gain.
 */
export const UML_ACTION_READING = profile(
  'uml-action',
  UML_ROLE.action,
  UML_ROLE.label,
  FLOW
);
export const UML_INITIAL_READING = profile(
  'uml-initial',
  UML_ROLE.initial,
  UML_ROLE.label,
  FLOW
);
export const UML_ACTIVITY_FINAL_READING = profile(
  'uml-activity-final',
  UML_ROLE['activity-final'],
  UML_ROLE.label,
  FLOW
);
export const UML_FLOW_FINAL_READING = profile(
  'uml-flow-final',
  UML_ROLE['flow-final'],
  UML_ROLE.label,
  FLOW
);
export const UML_DECISION_READING = profile(
  'uml-decision',
  UML_ROLE.decision,
  UML_ROLE.label,
  FLOW
);
export const UML_FORK_READING = profile(
  'uml-fork',
  UML_ROLE.fork,
  UML_ROLE.label,
  FLOW
);
/** The one artefact of the pack read through the DATA that passes through it. */
export const UML_OBJECT_NODE_READING = profile(
  'uml-object-node',
  UML_ROLE['object-node'],
  UML_ROLE.label,
  OBJECT_FLOW
);
export const UML_SEND_SIGNAL_READING = profile(
  'uml-send-signal',
  UML_ROLE['send-signal'],
  UML_ROLE.label,
  FLOW
);
export const UML_ACCEPT_EVENT_READING = profile(
  'uml-accept-event',
  UML_ROLE['accept-event'],
  UML_ROLE.label,
  FLOW
);
export const UML_TIME_EVENT_READING = profile(
  'uml-time-event',
  UML_ROLE['time-event'],
  UML_ROLE.label,
  FLOW
);

/* ── Phase 2: state machines (§14.2.4) ─────────────────────────────────── */

/**
 * The one behaviour artefact named off `uml:name` rather than `uml:label`: a
 * state is a DIVIDED BOX (§14.2.4), so its heading is a name compartment with
 * the internal activities ruled off below it, exactly as a classifier's is.
 */
export const UML_STATE_READING = profile(
  'uml-state',
  UML_ROLE.state,
  UML_ROLE.name,
  TRANSITION
);
export const UML_FINAL_STATE_READING = profile(
  'uml-final-state',
  UML_ROLE['final-state'],
  UML_ROLE.label,
  TRANSITION
);
export const UML_CHOICE_READING = profile(
  'uml-choice',
  UML_ROLE.choice,
  UML_ROLE.label,
  TRANSITION
);
export const UML_JUNCTION_READING = profile(
  'uml-junction',
  UML_ROLE.junction,
  UML_ROLE.label,
  TRANSITION
);
export const UML_SHALLOW_HISTORY_READING = profile(
  'uml-shallow-history',
  UML_ROLE['shallow-history'],
  UML_ROLE.label,
  TRANSITION
);
export const UML_DEEP_HISTORY_READING = profile(
  'uml-deep-history',
  UML_ROLE['deep-history'],
  UML_ROLE.label,
  TRANSITION
);
export const UML_ENTRY_POINT_READING = profile(
  'uml-entry-point',
  UML_ROLE['entry-point'],
  UML_ROLE.label,
  TRANSITION
);
export const UML_EXIT_POINT_READING = profile(
  'uml-exit-point',
  UML_ROLE['exit-point'],
  UML_ROLE.label,
  TRANSITION
);
export const UML_TERMINATE_READING = profile(
  'uml-terminate',
  UML_ROLE.terminate,
  UML_ROLE.label,
  TRANSITION
);

/* ── Phase 3: sequence diagrams (§17.2.4, §17.4.4) ─────────────────────── */

/**
 * A LIFELINE is read through the MESSAGES drawn on it — which is the whole of
 * what a sequence diagram says about a participant: who calls it, and what it
 * calls in turn (§17.4.4).
 *
 * `uml:lifeline-ident`, and neither of the two tiers it might have been:
 * §17.3.4 writes `<name> : <Type>` in the head as a plain identifier, with no
 * keyword over it and none allowed — so it is not a `uml:name`, which is the
 * tier a keyword is written on — and the clause prints a BNF for it, which no
 * clause does for an actor's word, so it is not a `uml:label` either
 * (`roles.ts`). `parseLifelineIdent` is what reads that line back, and this
 * profile names the tier it reads.
 */
export const UML_LIFELINE_READING = profile(
  'uml-lifeline',
  UML_ROLE.lifeline,
  UML_ROLE['lifeline-ident'],
  MESSAGE
);
/**
 * An EXECUTION and a DESTRUCTION are read through the same table, and both are
 * marks the notation writes nothing on (§17.2.4).
 *
 * They are read at all because a message may LAND on either: §17.4.4 lets a
 * call arrive on the execution it starts, and a delete message arrives at the
 * cross. Both declare `uml:lifeline-ident` — the tier NEITHER of them carries —
 * and that is the rule phase 2 states for every unnamed artefact, applied here:
 * `readElement` names the far end of a relation through the SUBJECT's
 * `labelRole`, so a bar and the lifeline it answers have to agree on where a
 * name is. Declaring `uml:label` here instead would leave every participant
 * nameless in the panel opened on a bar, and a reading that says a message came
 * from nowhere is worse than one that says nothing.
 */
export const UML_EXECUTION_READING = profile(
  'uml-execution',
  UML_ROLE.execution,
  UML_ROLE['lifeline-ident'],
  MESSAGE
);
export const UML_DESTRUCTION_READING = profile(
  'uml-destruction',
  UML_ROLE.destruction,
  UML_ROLE['lifeline-ident'],
  MESSAGE
);

/**
 * The two PARENTS, and the reason they are read at all.
 *
 * `uml:control-node` and `uml:pseudostate` are the generalisations §15.3.4 and
 * §14.2.4 give their routing marks, and rules are written on them so that one
 * declaration reaches five children (`rules.ts`). Nothing is ever drawn AS one
 * — every creation command stamps a concrete role — so each of these profiles
 * is a floor rather than an answer: it exists so that a routing mark added to
 * the pack in a later phase is readable from the day its role is filed under
 * its parent, instead of falling through to no reading at all and failing
 * `reading-coverage` in `affine/all`.
 *
 * Registered LAST, after every child, for the reason `uml-node` is: the engine
 * takes the FIRST profile whose `appliesTo` the element's role IS A, so a
 * parent listed early would answer for all five of its children and none of
 * them would ever use its own.
 */
export const UML_CONTROL_NODE_READING = profile(
  'uml-control-node',
  UML_ROLE['control-node'],
  UML_ROLE.label,
  FLOW
);
export const UML_PSEUDOSTATE_READING = profile(
  'uml-pseudostate',
  UML_ROLE.pseudostate,
  UML_ROLE.label,
  TRANSITION
);

/** Every UML profile, in the order the view extension registers them. */
export const UML_READINGS: readonly ReadingProfile[] = [
  UML_CLASS_READING,
  UML_INTERFACE_READING,
  UML_ENUMERATION_READING,
  UML_OBJECT_READING,
  UML_PACKAGE_READING,
  UML_NOTE_READING,
  UML_ACTOR_READING,
  UML_USE_CASE_READING,
  UML_COMPONENT_READING,
  UML_PORT_READING,
  UML_PROVIDED_INTERFACE_READING,
  UML_REQUIRED_INTERFACE_READING,
  UML_ARTIFACT_READING,
  // The two SPECIALISATIONS before their parent, and the order is load-bearing:
  // `readingProfileFor` takes the FIRST profile whose `appliesTo` the element's
  // role IS A, and `uml:device` is a `uml:node`. With the parent listed first
  // every device would be read as a node and `uml-device` would never fire —
  // the one place in this pack where declaration order changes an answer, which
  // is why `reading.unit.spec.ts` pins it.
  UML_DEVICE_READING,
  UML_EXECUTION_ENVIRONMENT_READING,
  UML_NODE_READING,
  /* ── Phase 2: activities and state machines ──────────────────────────── */
  UML_ACTION_READING,
  UML_INITIAL_READING,
  UML_ACTIVITY_FINAL_READING,
  UML_FLOW_FINAL_READING,
  UML_DECISION_READING,
  UML_FORK_READING,
  UML_OBJECT_NODE_READING,
  UML_SEND_SIGNAL_READING,
  UML_ACCEPT_EVENT_READING,
  UML_TIME_EVENT_READING,
  UML_STATE_READING,
  UML_FINAL_STATE_READING,
  UML_CHOICE_READING,
  UML_JUNCTION_READING,
  UML_SHALLOW_HISTORY_READING,
  UML_DEEP_HISTORY_READING,
  UML_ENTRY_POINT_READING,
  UML_EXIT_POINT_READING,
  UML_TERMINATE_READING,
  /* ── Phase 3: sequence diagrams ──────────────────────────────────────── */
  UML_LIFELINE_READING,
  UML_EXECUTION_READING,
  UML_DESTRUCTION_READING,
  // The two PARENTS last, after every child — the same rule the deployment
  // cubes above obey, and for the same reason: the engine takes the FIRST
  // profile the element's role IS A.
  UML_CONTROL_NODE_READING,
  UML_PSEUDOSTATE_READING,
];
