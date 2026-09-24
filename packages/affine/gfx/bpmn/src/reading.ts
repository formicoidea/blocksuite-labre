import type { ReadingProfile } from '@labre/affine-block-surface';

import { BPMN_ROLE, BPMN_ROLES } from './roles.js';

/**
 * What BPMN lets the tool read of an artefact (MF3, the reversed reading).
 *
 * DATA, like the rules and the profiles beside it: the engine
 * (`@labre/affine-block-surface`) knows how to read a role and a typed edge — it
 * knows nothing about BPMN. Everything below is already stated in `roles.ts` and
 * is merely POINTED AT here.
 *
 * Registered from the FLAG-GATED view extension: reading a process is tooling,
 * so a pool whose BPMN flag is off keeps every element it has and simply stops
 * being read (ADR 0009).
 *
 * ## FOUR profiles, because BPMN has four parent-less node families
 *
 * The vocabulary is deliberately a forest and not a tree — `roles.ts` spells out
 * why, family by family: the paperwork is not the work, commentary is never
 * evidence, and BPMN 2.0.2 §10.4 exempts the group from every containment
 * constraint there is. A single `appliesTo` would therefore have needed a
 * `bpmn:artefact` root that the notation does not have, and inventing a role is
 * the one thing ADR 0007 forbids: an id is forever, and a vocabulary is not a
 * place to put a convenience.
 *
 * So each family declares its own profile, with an id of its own (the DI keys on
 * it and throws on a duplicate). Only the pool is left out, and only because it
 * is the FRAME: a reading is about an artefact, never about the lane it is drawn
 * in.
 *
 * ## The sequence flow is the only relation read
 *
 * Of the three connecting objects, only `bpmn:sequence-flow` orders anything. A
 * message flow says who told whom and a plain association says "this note is
 * about that", both of which read identically from either end — and the
 * association declares no `direction` for exactly that reason. Reading them
 * under the sequence flow's two words would put a sentence in the panel that
 * the notation never said.
 *
 * ## A name inscribed, or a name beside
 *
 * Since R38 (`docs/adr/0029`) an event, a gateway and a data shape carry their
 * name on a free `bpmn:label` text grouped with them, not as inner text. The
 * two profiles that read them therefore declare `labelRole`, which the engine
 * falls back to when the subject's own text is empty — Wardley's reading does
 * the same. An activity's inscribed name still wins, because own text is read
 * first; the annotation and the group ARE their text and need no fallback.
 *
 * ## No nature, no phase
 *
 * BPMN ships no type-3 tag pack: its kinds ARE the roles, and the panel says
 * them on the type line, chain included ("Message start event › Start event ›
 * Event › Flow object"). And a pool's lanes are participants, not zones on a
 * plotted axis, so there is nothing a position could be read against yet.
 */

/**
 * The two words a sequence flow is read with, from the subject's end.
 *
 * ADR 0010 tier 2 on this role: the verb is "is followed by", so the SOURCE is
 * what happens first. An edge leaving the subject therefore names what comes
 * next, and one arriving names what came before.
 */
const SEQUENCE_SIDES = {
  consumer: {
    labelKey: 'com.labre.bpmn.reading.relations.consumer',
    labelFallback: 'Preceded by',
  },
  supplier: {
    labelKey: 'com.labre.bpmn.reading.relations.supplier',
    labelFallback: 'Followed by',
  },
} as const;

/** Events, activities and gateways — the three families that ARE the process. */
export const BPMN_READING: ReadingProfile = {
  id: 'bpmn',
  framework: 'bpmn',
  roles: BPMN_ROLES,
  appliesTo: BPMN_ROLE.flowObject,
  // An event's or a gateway's name gravitates (R38): see the module comment.
  labelRole: BPMN_ROLE.label,
  relation: { edgeRole: BPMN_ROLE.sequenceFlow, sides: SEQUENCE_SIDES },
};

/**
 * The paperwork: a data object and a data store.
 *
 * No relation — a data object is tied to the work by an ASSOCIATION, which
 * declares no verb and no direction, so there is no sentence to read off it.
 */
export const BPMN_DATA_READING: ReadingProfile = {
  id: 'bpmn-data',
  framework: 'bpmn',
  roles: BPMN_ROLES,
  appliesTo: BPMN_ROLE.data,
  // Both data shapes are named beside the symbol (R38).
  labelRole: BPMN_ROLE.label,
};

/** A note on the picture. Readable, so a reader can link it to a record. */
export const BPMN_ANNOTATION_READING: ReadingProfile = {
  id: 'bpmn-annotation',
  framework: 'bpmn',
  roles: BPMN_ROLES,
  appliesTo: BPMN_ROLE.textAnnotation,
};

/** A lasso round part of the picture. Parent-less by spec, hence its own row. */
export const BPMN_GROUP_READING: ReadingProfile = {
  id: 'bpmn-group',
  framework: 'bpmn',
  roles: BPMN_ROLES,
  appliesTo: BPMN_ROLE.group,
};

/** Every BPMN profile, in the order the view extension registers them. */
export const BPMN_READINGS: readonly ReadingProfile[] = [
  BPMN_READING,
  BPMN_DATA_READING,
  BPMN_ANNOTATION_READING,
  BPMN_GROUP_READING,
];
