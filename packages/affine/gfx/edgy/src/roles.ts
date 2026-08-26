import type { EdgyNodeKind } from '@labre/affine-model';
import type { RoleDef, RoleDefs, RoleId } from '@labre/std/gfx';

import {
  EDGY_DYNAMIC_NODES,
  EDGY_DYNAMIC_RELATIONS,
  type EdgyElementName,
} from './metamodel';

/**
 * EDGY role vocabulary (WS1).
 *
 * A role is the semantic identity of an EDGY artefact — no rule will ever look
 * at a shape type. Three families live here, and they answer three different
 * questions:
 *
 * - the ELEMENTS: `edgy:element` at the root, the four PERSISTED kinds under it
 *   (`people`, `outcome`, `object`, `activity` — the `EdgyNodeKind` the user
 *   picks in the toolbox and the model stores), and the twelve OFFICIAL
 *   elements of the metamodel under their own kind;
 * - the BACKGROUNDS: `edgy:background`, specialised by the facets diagram and
 *   the blank board — the two frames a finding can be attributed to;
 * - the RELATIONS: `edgy:relation`, specialised by ONE ROLE PER CANONICAL VERB.
 *
 * Hierarchy is DATA (`parent`), never TS inheritance: a rule written on
 * `edgy:element` covers `edgy:purpose` for free (see `roleIsA`), which is what
 * lets `edgy.overlapping-artefacts` be one line rather than a matrix of
 * sixteen.
 *
 * ## Why a role per VERB, and not one `edgy:relation`
 *
 * EDGY's grammar is not "these two things may be linked", it is "content
 * EXPRESSES purpose". A single relation role could only ever check the pair,
 * and would happily accept a link labelled "expresses" drawn between a task and
 * a channel — the exact mistake the metamodel exists to prevent. One role per
 * verb makes the sentence itself the unit the engine checks, through the
 * `relation-endpoints` family: source, edge, target, all three named by role.
 *
 * Tier 1 of `docs/adr/0010` applies to every one of them: the SOURCE is the
 * subject of the verb, the TARGET its object. The verb travels with the link as
 * a visible label too — that is presentation, and it stays; the role is what
 * the engine reads.
 *
 * ## Compatibility
 *
 * Nothing is backfilled. An EDGY board drawn before today carries elements and
 * connectors with no role, so it is never evaluated and never says a word — the
 * same promise every role in this library has made (PRD principle 8).
 */

/** The twelve official elements of the metamodel, by name. */
export type EdgyElementRole = EdgyElementName;

/** The static half of the vocabulary — everything not derived from a verb. */
export type EdgyStaticRole =
  | 'element'
  | EdgyNodeKind
  | 'background'
  | 'facets'
  | 'board'
  | 'relation'
  | EdgyElementRole;

export type EdgyRoleId = `edgy:${string}`;

/**
 * How {@link EDGY_ROLE} is keyed: by the name used at the creation sites — the
 * persisted `kind` for a base element, the metamodel's own name for one of the
 * twelve, the element `type` for a background. Spelled out so the table below
 * stays exhaustive: a role added to the union and forgotten here is a compile
 * error.
 */
type EdgyRoleKey = EdgyStaticRole;

/** Role ids, keyed by the name used at the creation sites. */
export const EDGY_ROLE = {
  element: 'edgy:element',
  // The four persisted kinds (`EdgyNodeKind`).
  people: 'edgy:people',
  outcome: 'edgy:outcome',
  object: 'edgy:object',
  activity: 'edgy:activity',
  // The twelve official elements.
  purpose: 'edgy:purpose',
  capability: 'edgy:capability',
  task: 'edgy:task',
  story: 'edgy:story',
  process: 'edgy:process',
  journey: 'edgy:journey',
  content: 'edgy:content',
  asset: 'edgy:asset',
  channel: 'edgy:channel',
  organisation: 'edgy:organisation',
  product: 'edgy:product',
  brand: 'edgy:brand',
  // The two frames.
  background: 'edgy:background',
  facets: 'edgy:facets',
  board: 'edgy:board',
  // The parent of the 22 verbs.
  relation: 'edgy:relation',
} as const satisfies Record<EdgyRoleKey, EdgyRoleId>;

/**
 * A canonical verb, as a role id: `is part of` → `edgy:is-part-of`.
 *
 * The verb IS the identifier, so a relation added to the metamodel gets its
 * role for free and nobody has to remember to name it. No collision with the
 * element roles above is possible in the metamodel as it stands, and a future
 * verb colliding with an element name would be caught by the unit spec, which
 * counts the vocabulary.
 */
function verbRoleId(verb: string): EdgyRoleId {
  return `edgy:${verb.replace(/\s+/g, '-')}`;
}

/**
 * Role id per canonical verb, DERIVED from {@link EDGY_DYNAMIC_RELATIONS}.
 *
 * Derived rather than restated: the metamodel is written once (`./metamodel.ts`)
 * and the template that draws it, the vocabulary that names it and the rule that
 * checks it all read the same table. `requires` appears on three rows and gets
 * ONE role — a verb is a verb wherever it is spoken, and the three sentences it
 * belongs to are three triplets, not three roles.
 */
export const EDGY_VERB_ROLE: Readonly<Record<string, EdgyRoleId>> =
  Object.assign(
    Object.create(null),
    Object.fromEntries(
      EDGY_DYNAMIC_RELATIONS.map(([, , verb]) => [verb, verbRoleId(verb)])
    )
  );

/** i18n key stem of a role id: `edgy:is-part-of` → `com.labre.edgy.role.is-part-of`. */
const roleKey = (id: RoleId) => `com.labre.edgy.role.${id.slice('edgy:'.length)}`;

const ELEMENT_DEFS: readonly RoleDef[] = [
  // The root of every artefact a board is made of. A rule written here covers
  // the four kinds and the twelve elements at once — which is exactly what
  // `edgy.overlapping-artefacts` needs and why the root exists.
  { id: EDGY_ROLE.element, kind: 'node', labelKey: roleKey(EDGY_ROLE.element) },
  // The four PERSISTED kinds. They are the base shapes the toolbox offers, so
  // they are what an element created from the palette carries: somebody
  // dropping an "Object" on the board has said "object" and nothing more, and
  // the role says exactly that much.
  ...(['people', 'outcome', 'object', 'activity'] as const).map(kind => ({
    id: EDGY_ROLE[kind],
    parent: EDGY_ROLE.element,
    kind: 'node' as const,
    labelKey: roleKey(EDGY_ROLE[kind]),
  })),
  // The twelve official elements, each under the kind the metamodel draws it
  // with — Purpose is an outcome, Story an activity, Channel an object. The
  // parent is READ from `EDGY_DYNAMIC_NODES` rather than restated: the diagram
  // and the vocabulary cannot drift apart if there is only one table.
  ...Object.entries(EDGY_DYNAMIC_NODES).map(([name, { kind }]) => ({
    id: EDGY_ROLE[name as EdgyElementRole],
    parent: EDGY_ROLE[kind],
    kind: 'node' as const,
    labelKey: roleKey(EDGY_ROLE[name as EdgyElementRole]),
  })),
];

const BACKGROUND_DEFS: readonly RoleDef[] = [
  // The frame, and deliberately NOT a child of `edgy:element`: a rule written
  // on the artefacts must never match the board they are drawn on. Two frames
  // specialise it — the facets diagram and the blank board — so a rule
  // attributes its findings to whichever one the user is working on without
  // naming either.
  {
    id: EDGY_ROLE.background,
    kind: 'node',
    labelKey: roleKey(EDGY_ROLE.background),
  },
  {
    id: EDGY_ROLE.facets,
    parent: EDGY_ROLE.background,
    kind: 'node',
    labelKey: roleKey(EDGY_ROLE.facets),
  },
  {
    id: EDGY_ROLE.board,
    parent: EDGY_ROLE.background,
    kind: 'node',
    labelKey: roleKey(EDGY_ROLE.board),
  },
];

/**
 * The relations: the parent, then one child per canonical verb.
 *
 * The parent carries no `direction` — it names no verb, so it has no sentence
 * to state. Every child does, and the gesture hint is derived from the verb for
 * the same reason the id is: "drag from the X to the Y" is the same sentence
 * with the same two holes for all 22 of them, and writing it out 22 times would
 * be 22 chances to write it out wrong.
 */
const RELATION_DEFS: readonly RoleDef[] = [
  {
    id: EDGY_ROLE.relation,
    kind: 'edge',
    labelKey: roleKey(EDGY_ROLE.relation),
    labelFallback: 'Relation',
  },
  ...Object.entries(EDGY_VERB_ROLE).map(([verb, id]) => ({
    id,
    parent: EDGY_ROLE.relation,
    kind: 'edge' as const,
    labelKey: roleKey(id),
    labelFallback: verb.charAt(0).toUpperCase() + verb.slice(1),
    direction: {
      verbKey: `${roleKey(id)}.verb`,
      verbFallback: verb,
      gestureHintKey: `${roleKey(id)}.gesture`,
      gestureHintFallback: `Drag from the element that is the subject of "${verb}" to its object.`,
    },
  })),
];

const DEFS: readonly RoleDef[] = [
  ...ELEMENT_DEFS,
  ...BACKGROUND_DEFS,
  ...RELATION_DEFS,
];

// Null prototype: this is a lookup table keyed by ids that may one day come
// from host-supplied packs, so `defs['toString']` must not resolve.
export const EDGY_ROLES: RoleDefs = Object.assign(
  Object.create(null),
  Object.fromEntries(DEFS.map(def => [def.id, def]))
);
