import type { ReadingProfile } from '@labre/affine-block-surface';

import { CONTEXT_MAP_ROLE, CONTEXT_MAP_ROLES } from './roles.js';

/**
 * What a Context Map lets the tool read of a bounded context (MF3, the reversed
 * reading).
 *
 * DATA, like the rules and the profiles beside it: the engine
 * (`@labre/affine-block-surface`) knows how to read a role and a typed edge — it
 * knows nothing about context mapping. Everything below is already stated in
 * `roles.ts` and is merely POINTED AT here.
 *
 * Registered from the FLAG-GATED view extension: reading a map is tooling, so a
 * board whose flag is off keeps every element it has and simply stops being read
 * (ADR 0009).
 *
 * ## One subject, and the board is not it
 *
 * `context-map:context` is the only artefact this notation places; the board is
 * the FRAME and specialises nothing, exactly so that what is written about the
 * contexts never falls on the card they sit on. The cloud
 * (`context-map:system`) is not a subject either: its role is there for the
 * legend, the map does not model what is inside it, and it is read exactly as
 * much as when it carried no role — not at all.
 *
 * ## The nine patterns are read through their parent
 *
 * `appliesTo` on the relation is `context-map:relationship`, and the nine DDD
 * Crew patterns specialise it — so `roleIsA` reaches every one of them without
 * this file naming a single pattern. The four SYMMETRIC ones (Partnership,
 * Shared Kernel, Separate Ways, Big Ball of Mud) declare no `direction`, and the
 * panel still lists them under whichever side the drawing put them on: that is
 * not a claim about upstream and downstream, it is where the link happens to
 * start. The asymmetry is the notation's, and `roles.ts` is where it is argued.
 *
 * ## No nature, no phase
 *
 * The framework ships no type-3 tag pack, and the board declares no zones a
 * position could be read against.
 */
export const CONTEXT_MAP_READING: ReadingProfile = {
  id: 'context-map',
  framework: 'ddd-context-map',
  roles: CONTEXT_MAP_ROLES,
  appliesTo: CONTEXT_MAP_ROLE.context,
  relation: {
    edgeRole: CONTEXT_MAP_ROLE.relationship,
    // The DDD Crew wording, verbatim, and the direction `roles.ts` declares:
    // the SOURCE is the upstream context. So an edge leaving the subject names
    // what is downstream of it, and one arriving names what it is downstream of.
    sides: {
      consumer: {
        labelKey: 'com.labre.ddd-context-map.reading.relations.consumer',
        labelFallback: 'Upstream',
      },
      supplier: {
        labelKey: 'com.labre.ddd-context-map.reading.relations.supplier',
        labelFallback: 'Downstream',
      },
    },
  },
};
