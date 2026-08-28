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
  // The three tiers of an element's label, as canvas text.
  | 'title'
  | 'type-line'
  | 'description'
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
  title: 'c4:title',
  'type-line': 'c4:type-line',
  description: 'c4:description',
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
 * ## The i18n keys, and when they arrived
 *
 * The model slice shipped this vocabulary with its English wording and NO keys,
 * deliberately: a framework contributes manifest entries through
 * `FRAMEWORK_TRANSLATION_GROUPS`, whose `owner` must be a `FrameworkId` — which
 * in turn must be a tooling flag key with a `FrameworkDescriptor` behind it
 * (`frameworks.ts`: a senior button, an icon, a bundle). A key the manifest
 * cannot name is a key a host meets and cannot translate, which
 * `packages/affine/all/src/__tests__/translations/manifest.unit.spec.ts` fails
 * the build over.
 *
 * The tooling slice gives C4 that identity, so the keys land here together with
 * the `c4TranslationEntries` export that puts them in the manifest. Nothing in
 * a stored document changed: an element persists the ROLE ID, never its label.
 */

/** i18n key stem of a role id: `c4:person` → `com.labre.c4.role.person`. */
const roleKey = (id: RoleId) => `com.labre.c4.role.${id.slice('c4:'.length)}`;

/**
 * The four levels of the C4 model, flat — see the note at the top of this file
 * on why composition is not specialisation — plus the one specialisation C4
 * itself draws, the database under the container.
 */
const ELEMENT_DEFS: readonly RoleDef[] = [
  {
    id: C4_ROLE.person,
    kind: 'node',
    labelKey: roleKey(C4_ROLE.person),
    labelFallback: 'Person',
  },
  {
    id: C4_ROLE.system,
    kind: 'node',
    labelKey: roleKey(C4_ROLE.system),
    labelFallback: 'Software system',
  },
  {
    id: C4_ROLE.container,
    kind: 'node',
    labelKey: roleKey(C4_ROLE.container),
    labelFallback: 'Container',
  },
  // The one specialisation in the pack. A data store is a container that keeps
  // state — the stencil draws it as a cylinder — so a rule about containers
  // reaches it, and a rule about persistence can single it out.
  {
    id: C4_ROLE.database,
    parent: C4_ROLE.container,
    kind: 'node',
    labelKey: roleKey(C4_ROLE.database),
    labelFallback: 'Database',
  },
  {
    id: C4_ROLE.component,
    kind: 'node',
    labelKey: roleKey(C4_ROLE.component),
    labelFallback: 'Component',
  },
];

/**
 * The three written tiers of an element's label — its NAME, its type line and
 * its description — as roles on the canvas TEXT elements that carry them.
 *
 * ## Why the tiers have roles at all
 *
 * Because a C4 component is a GROUP (PO recette, 28/08/2026): the shape and
 * three texts, every one of them edited in place exactly like any other words on
 * the canvas. Which leaves one question — given a group of three texts and a
 * box, WHICH text is the name and which is the technology? — and the platform
 * already has an answer for "what is this element, semantically". Roles survive
 * what the alternatives do not: a child reordered inside its group, a group
 * ungrouped and regrouped, a tier copied to another node, a tier deleted and
 * redrawn. Position in `children` survives none of those.
 *
 * `kind: 'text'`, which is the same call `wardley:label` makes and for the same
 * reason: these are free text elements whose BOX is a creation-time default and
 * not a statement about anything. A rule measuring one must measure its ink.
 *
 * ## `c4:title` is where an element's NAME lives
 *
 * For one iteration the name was the shape's own native inner text and only the
 * other two tiers were elements. The PO's follow-up closed that: two kinds of
 * text in one component meant two editors, two toolbars and two sets of rules
 * for the same three lines, and the odd one out was the one that mattered most.
 * A C4 element's name is now `c4:title`, on equal terms with the tiers under it,
 * and the shape carries no text at all.
 *
 * It is the role a rule about naming must read. Everything that asks "is this
 * element named?" — for any of the nine artefacts, at any of the four levels —
 * asks it of the `c4:title` grouped with the shape. The exporter still falls
 * back to the shape's own inner text for an element drawn before this change,
 * which is where those names really are; a rule may do the same or not, but it
 * must not look for a name on the shape FIRST.
 *
 * ## What they are NOT
 *
 * Not levels of the model, not artefacts, and not a fourth thing a C4 diagram
 * can contain. They are three lines of ONE element's label, which is why they
 * are parent-less and why nothing in the pack maps a `kind` to them
 * ({@link C4_ROLE_OF_KIND} stays the nine artefacts). The role stamped on the
 * artefact stays on the SHAPE alone — the rules, the facts and the export all
 * key on it, and a rule that fell on a type line would be asking a subtitle to
 * have a name of its own.
 *
 * The GROUP itself is deliberately role-less, for the reason `legend.ts` gives
 * about legend glyphs: a role makes an element count as an artefact for every
 * rule written against roles, and the wrapper round a box is not a second box.
 */
const TIER_DEFS: readonly RoleDef[] = [
  {
    id: C4_ROLE.title,
    kind: 'text',
    labelKey: roleKey(C4_ROLE.title),
    labelFallback: 'Name',
  },
  {
    id: C4_ROLE['type-line'],
    kind: 'text',
    labelKey: roleKey(C4_ROLE['type-line']),
    labelFallback: 'Type line',
  },
  {
    id: C4_ROLE.description,
    kind: 'text',
    labelKey: roleKey(C4_ROLE.description),
    labelFallback: 'Description',
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
    labelKey: roleKey(C4_ROLE.board),
    labelFallback: 'C4 diagram',
  },
  {
    id: C4_ROLE.boundary,
    kind: 'node',
    labelKey: roleKey(C4_ROLE.boundary),
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
 * block below. C4 asks every relationship to be READ as a sentence ("Customer
 * uses Internet Banking System"), which is exactly what the direction reveal
 * reads back, and it is why one role suffices where BPMN needs three: there is
 * one kind of line on this canvas, and its LABEL is where the author says which
 * kind of using it is.
 */
const RELATIONSHIP_DEFS: readonly RoleDef[] = [
  {
    id: C4_ROLE.relationship,
    kind: 'edge',
    labelKey: roleKey(C4_ROLE.relationship),
    labelFallback: 'Relationship',
    /**
     * The verb is **"uses"** — the one C4 falls back to when an author writes
     * nothing on the arrow, and the reading that decides which end is which: the
     * source is the element with the need, the target the one that meets it.
     *
     * It is deliberately the weakest verb in the pack. "Sends a request to",
     * "reads from", "authenticates against" are all relationships an author
     * writes ON the line, and the role must not claim one of them: a default
     * that guessed would put words in the diagram's mouth every time somebody
     * dragged an arrow and moved on.
     */
    direction: {
      verbKey: `${roleKey(C4_ROLE.relationship)}.verb`,
      verbFallback: 'uses',
      gestureHintKey: `${roleKey(C4_ROLE.relationship)}.gesture`,
      gestureHintFallback:
        'Drag from the element that has the need to the one that meets it.',
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
