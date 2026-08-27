import type { C4NodeKind } from '@labre/affine-model';
import type { RoleDef, RoleDefs, RoleId } from '@labre/std/gfx';

/**
 * C4 role vocabulary.
 *
 * A role is the semantic identity of a C4 artefact, and here it is the ONLY
 * thing that carries it: three of the four levels are drawn as the same rounded
 * rectangle, so a rule that read the shape would find a box and learn nothing.
 * The `kind` discriminant answers a different question (which glyph and which
 * blue to paint); the role answers what the box MEANS.
 *
 * Hierarchy is DATA (`parent`), never TS inheritance. One specialisation is
 * declared and it is the one C4 itself makes: a `c4:database` IS a
 * `c4:container` — the notation gives it a cylinder instead of a box, but it is
 * a container of the system all the same, so everything written about containers
 * applies to it for free (see `roleIsA`). `mobile` and `browser` are the same
 * statement without even a role of their own: they map straight onto
 * `c4:container`, because a phone app and a single-page app are containers with
 * a picture, and inventing a role per picture would let a rule about containers
 * miss two of them.
 *
 * The four levels are deliberately FLAT — `c4:component` is not a child of
 * `c4:container`, nor `c4:container` of `c4:system`. The relation between the
 * levels is COMPOSITION ("a container is part of a system"), not
 * specialisation ("a container is a kind of system"), and `roleIsA` means the
 * second: filing them in a chain would make "every rule about a system also
 * falls on every container" true, which is the opposite of what C4 says. What
 * composition there is on the canvas is drawn — a boundary round the parts —
 * and that is where a later rule must read it from.
 *
 * The **board** and the **boundary** are parent-less, the same call
 * `wardley:map` and `bpmn:pool` both make: they are the FRAME the elements are
 * drawn in and drawn round, and a rule written on the artefacts must never fall
 * on the sheet holding them.
 *
 * ## Compatibility
 *
 * Nothing is backfilled. A diagram drawn before today carries no role, so it is
 * never evaluated and never says a word — the same promise every role in this
 * library has made (PRD principle 8).
 */

/** Every role this framework declares. */
export type C4Role =
  // The four levels of the model.
  | 'person'
  | 'system'
  | 'container'
  | 'database'
  | 'component'
  // The frames.
  | 'board'
  | 'boundary'
  // The one connecting object.
  | 'relationship';

export type C4RoleId = `c4:${C4Role}`;

/**
 * Role ids, keyed by their own name.
 *
 * Keyed by the ROLE and not by the `kind`, unlike BPMN's table: C4 has nine
 * kinds and five element roles, because four of the kinds are a second drawing
 * of a level rather than a level of their own. {@link C4_ROLE_OF_KIND} is the
 * bridge, and it is the only place the two vocabularies meet.
 */
export const C4_ROLE = {
  person: 'c4:person',
  system: 'c4:system',
  container: 'c4:container',
  database: 'c4:database',
  component: 'c4:component',
  board: 'c4:board',
  boundary: 'c4:boundary',
  relationship: 'c4:relationship',
} as const satisfies Record<C4Role, C4RoleId>;

/**
 * Compile-time proof that {@link C4_ROLE} is total over {@link C4Role} in the
 * OTHER direction too: `satisfies Record<C4Role, …>` only checks that every key
 * is present, so without this a role added to the union and forgotten in the
 * table would slip through as long as its key was also forgotten. Reads as
 * `never` — and therefore fails to accept `true` — the moment one does.
 */
type _UnmappedC4Role = Exclude<
  C4RoleId,
  (typeof C4_ROLE)[keyof typeof C4_ROLE]
>;
const _everyRoleIsMapped: [_UnmappedC4Role] extends [never] ? true : never =
  true;
void _everyRoleIsMapped;

/**
 * ## Why no `labelKey` yet — and why that is not an oversight
 *
 * Every other framework's roles carry a `com.labre.<framework>.role.<name>` key
 * beside their wording. C4's will too, and the stem is already decided; what it
 * cannot have YET is a manifest entry, and a key with no entry is precisely what
 * `packages/affine/all/src/__tests__/translations/manifest.unit.spec.ts` fails
 * the build over: a host builds its catalogue from
 * `getTranslationKeyManifest()`, so a key the manifest never names is a key the
 * host can meet and cannot translate.
 *
 * A framework contributes its entries through `FRAMEWORK_TRANSLATION_GROUPS`,
 * whose `owner` must be a `FrameworkId` — which in turn must be a tooling flag
 * key with a `FrameworkDescriptor` behind it (`frameworks.ts`: a senior button,
 * an icon, a bundle). This slice ships the MODEL and the RENDERING only and has
 * none of that, and inventing a framework identity with no tooling under it to
 * carry two dozen keys would be the tail wagging the dog.
 *
 * So the vocabulary ships with its wording and no keys, which costs exactly one
 * thing — a host cannot yet translate "Software system" — and costs nothing at
 * all in a document: an element persists the ROLE ID, never its label. The
 * tooling slice adds `labelKey` on each def, the `direction` block on the
 * relationship (whose `verbKey` is required, hence its absence here too) and the
 * `c4TranslationEntries` export that puts all of them in the manifest, in one
 * change that touches no stored data.
 */

/**
 * The four levels of the C4 model, flat — see the note at the top of this file
 * on why composition is not specialisation — plus the one specialisation C4
 * itself draws, the database under the container.
 */
const ELEMENT_DEFS: readonly RoleDef[] = [
  {
    id: C4_ROLE.person,
    kind: 'node',
    labelFallback: 'Person',
  },
  {
    id: C4_ROLE.system,
    kind: 'node',
    labelFallback: 'Software system',
  },
  {
    id: C4_ROLE.container,
    kind: 'node',
    labelFallback: 'Container',
  },
  // The one specialisation in the pack. A data store is a container that keeps
  // state — the stencil draws it as a cylinder — so a rule about containers
  // reaches it, and a rule about persistence can single it out.
  {
    id: C4_ROLE.database,
    parent: C4_ROLE.container,
    kind: 'node',
    labelFallback: 'Database',
  },
  {
    id: C4_ROLE.component,
    kind: 'node',
    labelFallback: 'Component',
  },
];

/**
 * The two frames: the sheet a diagram is drawn on, and the dashed rectangle
 * drawn round part of it.
 *
 * Both parent-less, and not related to each other either. A board is where the
 * diagram lives; a boundary is a statement made INSIDE it about which elements
 * belong to one system or one container. Neither is an element of the model, so
 * a rule about people, systems, containers or components must fall on neither.
 */
const FRAME_DEFS: readonly RoleDef[] = [
  {
    id: C4_ROLE.board,
    kind: 'node',
    labelFallback: 'C4 diagram',
  },
  {
    id: C4_ROLE.boundary,
    kind: 'node',
    labelFallback: 'Boundary',
  },
];

/**
 * The relationship — the only connecting object C4 has, and a typed edge under
 * `docs/adr/0010`.
 *
 * Tier 1 of that ADR is generic — `source` is the subject of the role's verb,
 * `target` its object — and it already applies: the source is the element that
 * has the need and the target the one that meets it. Tier 2 is the `direction`
 * block, which arrives with the tooling slice (see the note below and the one at
 * the top of this file). C4 asks every relationship to be READ as a sentence
 * ("Customer uses Internet Banking System"), which is exactly what the direction
 * reveal reads back, and it is why one role suffices where BPMN needs three:
 * there is one kind of line on this canvas, and its label is where the author
 * says which kind of using it is.
 */
const RELATIONSHIP_DEFS: readonly RoleDef[] = [
  {
    id: C4_ROLE.relationship,
    kind: 'edge',
    labelFallback: 'Relationship',
    // The `direction` block — the verb "uses", and the sentence telling a
    // user which way to drag — lands with the relationship TOOL, for the reason
    // the note at the top of this file gives: `EdgeDirectionDef.verbKey` is
    // required, and this slice has nowhere to declare a key. Nothing in a
    // document depends on it: a relationship persists its role id and its two
    // ends, and gains its verb the day the tooling slice declares one.
  },
];

const DEFS: readonly RoleDef[] = [
  ...ELEMENT_DEFS,
  ...FRAME_DEFS,
  ...RELATIONSHIP_DEFS,
];

// Null prototype: this is a lookup table keyed by ids that may one day come
// from host-supplied packs, so `defs['toString']` must not resolve.
export const C4_ROLES: RoleDefs = Object.assign(
  Object.create(null),
  Object.fromEntries(DEFS.map(def => [def.id, def]))
);

/**
 * The `kind` discriminant → the role it means.
 *
 * `kind` drives the renderer and is what the palette writes; the ROLE is the
 * semantic authority. The two are posted side by side at every creation site,
 * the way Wardley and BPMN already do it, and this table is the single place
 * that says which kind means which role. Total over {@link C4NodeKind} by its
 * type, so a new kind cannot land without being given a meaning.
 *
 * Note what it collapses: `person-ext` means `c4:person` and `system-ext` means
 * `c4:system`, because an external system is a system — the grey says it is out
 * of scope, not that it is a different sort of thing. `mobile` and `browser`
 * mean `c4:container` for the same reason.
 */
export const C4_ROLE_OF_KIND: Record<C4NodeKind, RoleId> = {
  person: C4_ROLE.person,
  'person-ext': C4_ROLE.person,
  system: C4_ROLE.system,
  'system-ext': C4_ROLE.system,
  container: C4_ROLE.container,
  database: C4_ROLE.database,
  mobile: C4_ROLE.container,
  browser: C4_ROLE.container,
  component: C4_ROLE.component,
};
