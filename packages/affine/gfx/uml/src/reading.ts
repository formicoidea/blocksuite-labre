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
 * ## SIXTEEN profiles, one per artefact, because the roles are deliberately flat
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
 * The two FRAMES are not read: `uml:diagram` is the sheet and `uml:subject` is a
 * rectangle drawn round part of it, and
 * `packages/affine/all/src/__tests__/reading-coverage.unit.spec.ts` records both
 * as such so the coverage test does not ask a sheet to read itself back as a
 * sentence.
 *
 * ## The name lives on a separate element
 *
 * Every UML artefact is a composite — a shape, and the canvas texts grouped with
 * it — so every profile points `labelRole` at the tier that names it. Without
 * it the panel would print an id at a human, and the relation lines would name
 * the other end by id too.
 *
 * `uml:name` for everything whose words a keyword may be written over — the
 * compartmented kinds, the package, the note and the three deployment cubes —
 * and `uml:label` for the artefacts whose one word is a name and nothing else:
 * the actor, the use case, the port and the two interface marks. See `roles.ts`
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
 * ## One relation per profile, and which one
 *
 * `ReadingProfile.relation` declares ONE typed edge, and UML has twelve. The
 * choice below is the relation an architect reads that artefact THROUGH, and
 * `roleIsA` does the rest where a chain exists: a profile declaring
 * `uml:association` reads aggregations and compositions too, because the
 * specification makes them associations (§11.5.4).
 *
 * What that leaves unread is stated rather than hidden: a class's
 * generalizations, realizations and dependencies do not appear in its reading, a
 * use case's `include`/`extend` do not appear in its own, and a node's
 * communication paths and an artifact's manifestations do not appear in theirs.
 * They are on the canvas, they are typed, they are exported and the direction
 * reveal shows them — the panel simply reads one relation at a time, and the
 * choice each time is the relation that answers "what is this connected to"
 * first. Widening this is a change to the engine's contract, not to this file.
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

/** One artefact, as a profile. The sixteen below differ by four fields at most. */
const profile = (
  id: string,
  appliesTo: string,
  labelRole: string,
  relation: ReadingProfile['relation']
): ReadingProfile => ({
  id,
  framework: 'uml',
  roles: UML_ROLES,
  appliesTo,
  labelRole,
  relation,
});

export const UML_CLASS_READING = profile(
  'uml-class',
  UML_ROLE.class,
  UML_ROLE.name,
  ASSOCIATION
);
export const UML_INTERFACE_READING = profile(
  'uml-interface',
  UML_ROLE.interface,
  UML_ROLE.name,
  ASSOCIATION
);
export const UML_ENUMERATION_READING = profile(
  'uml-enumeration',
  UML_ROLE.enumeration,
  UML_ROLE.name,
  ASSOCIATION
);
/** An instance, read through the links between instances (§9.8.4). */
export const UML_OBJECT_READING = profile(
  'uml-object',
  UML_ROLE.object,
  UML_ROLE.name,
  ASSOCIATION
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
  ASSOCIATION
);
/** A use case is read through the actors it serves, not through its includes. */
export const UML_USE_CASE_READING = profile(
  'uml-use-case',
  UML_ROLE['use-case'],
  UML_ROLE.label,
  ASSOCIATION
);

/* ── Phase 2: components (§11.6.4, §11.3.4, §10.4.4) ───────────────────── */

/**
 * A component is read through its DEPENDENCIES, like the package it is often
 * mistaken for: §11.6.4 wires a component diagram with `«use»` arrows to the
 * interfaces its neighbours provide, and "what does this need, and who needs it"
 * is the question the diagram exists to answer.
 */
export const UML_COMPONENT_READING = profile(
  'uml-component',
  UML_ROLE.component,
  UML_ROLE.name,
  DEPENDENCY
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
 * An artifact is read through WHERE IT RUNS. Its other relation — the
 * `«manifest»` arrow to the component it is the physical form of — is the
 * modelling fact; the deployment is the operational one, and an architect
 * opening this panel on a `.war` file is asking which server it is on.
 */
export const UML_ARTIFACT_READING = profile(
  'uml-artifact',
  UML_ROLE.artifact,
  UML_ROLE.name,
  DEPLOY
);
/** A node is read through WHAT RUNS ON IT — the same table, from the other end. */
export const UML_NODE_READING = profile(
  'uml-node',
  UML_ROLE.node,
  UML_ROLE.name,
  DEPLOY
);
/** A device: a node that is hardware (§19.4.4), and read as one. */
export const UML_DEVICE_READING = profile(
  'uml-device',
  UML_ROLE.device,
  UML_ROLE.name,
  DEPLOY
);
/** An execution environment: a node that is software, and read as one. */
export const UML_EXECUTION_ENVIRONMENT_READING = profile(
  'uml-execution-environment',
  UML_ROLE['execution-environment'],
  UML_ROLE.name,
  DEPLOY
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
];
