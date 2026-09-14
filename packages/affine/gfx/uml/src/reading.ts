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
 * ## EIGHT profiles, one per artefact, because the roles are deliberately flat
 *
 * There is one chain in the node vocabulary — `uml:classifier` over class,
 * interface and enumeration — and a single profile written on the parent would
 * read all three. It is not used, and the reason is the panel rather than the
 * vocabulary: a profile's `id` is what the DI keys on and what a user sees the
 * reading OF, and "Classifier" is a word the specification uses and an architect
 * does not. Three profiles differing by `id` and `appliesTo` cost three lines
 * and let the panel say "Interface" about an interface.
 *
 * The other five roles are flat by construction (`roles.ts` argues each one), so
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
 * `uml:name` for everything with a name COMPARTMENT, `uml:label` for the two
 * artefacts that have no compartment to have one in — see `roles.ts` on why the
 * tier is named twice.
 *
 * ## One relation per profile, and which one
 *
 * `ReadingProfile.relation` declares ONE typed edge, and UML has nine. The
 * choice below is the relation an architect reads that artefact THROUGH, and
 * `roleIsA` does the rest where a chain exists: a profile declaring
 * `uml:association` reads aggregations and compositions too, because the
 * specification makes them associations (§11.5.4).
 *
 * What that leaves unread is stated rather than hidden: a class's
 * generalizations, realizations and dependencies do not appear in its reading,
 * and a use case's `include`/`extend` do not appear in its own. They are on the
 * canvas, they are typed, they are exported and the direction reveal shows them
 * — the panel simply reads one relation at a time, and the association is the
 * one that says who a classifier is connected to at all. Widening this is a
 * change to the engine's contract, not to this file.
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

/** One artefact, as a profile. The eight below differ by four fields at most. */
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
];
