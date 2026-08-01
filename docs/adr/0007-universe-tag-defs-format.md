# ADR 0007 — Per-universe tag-definition format and the promotion ladder

- Status: **proposed** (August 2026) — requires human approval (it fixes two new
  persisted fields on the surface element schema, a de facto red zone under
  `CLAUDE.md`).
- Deciders: Mathieu Jolly
- Milestone: "PF+MF" refoundation, Jalon 0 (contract seams)
- Companion ADRs: [0005](0005-element-docid-seam.md) (the `docId` binding),
  [0006](0006-pivot-properties-provider.md) (reading the bound record). The
  three form **one contract, frozen together**.

> **Terminology warning.** "Facet" is overloaded in this repo.
> `EdgyFacetsElementModel` (`packages/affine/model/src/elements/edgy/facets.ts`,
> element type `'edgy'`) is a _drawing_ — the EDGY Identity/Architecture/
> Experience Venn diagram. It has nothing to do with the **pivot facets** of
> ADR 0006. This ADR always says "pivot facet" for the latter and "EDGY facets
> diagram" for the former.

## Context

### The three-level precision typology

| Level | Name                              | Where it lives                               | Rules                                                                            |
| ----- | --------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| **1** | Free surface                      | A plain `shape` / `text` element             | None. A rectangle is a rectangle.                                                |
| **2** | _Nature première_ — semantic role | On the element, e.g. `wardley:component`     | Posed when the artefact is chosen; a role may inherit from another role          |
| **3** | Contextual qualification          | On the element, e.g. `wardley:nature = data` | The "typed attributes" family; mirrored onto the pivot record as a derived facet |

Level 3 is authored **on the element** — a synchronous, local fact — and is
reflected onto the pivot record one-way, with provenance
`derived-from-occurrence` (ADR 0006 § 4). The element is authoritative for the
occurrence; the record is authoritative for itself.

The **application seeds** the definitions per universe. The **library fixes
their format**. That split is the whole point: a new business universe must be
addable without shipping library code.

### What exists today

**A level-2 embryo, fused with the element class.** Each framework declares a
`kind` field on its own element model:

```ts
// packages/affine/model/src/elements/wardley/node.ts
export type WardleyNodeKind =
  | 'component'
  | 'anchor'
  | 'pipeline'
  | 'handle'
  | 'market'
  | 'ecosystem'
  | 'method';

export class WardleyNodeElementModel extends ShapeElementModel {
  override get type() {
    return 'wardleyNode';
  }
  override get connectable() {
    return this.kind !== 'pipeline';
  }
  @field('component' as WardleyNodeKind)
  accessor kind: WardleyNodeKind = 'component';
}
```

Same pattern in `elements/edgy/node.ts` (`EdgyNodeKind`) and `elements/bpmn/node.ts`.
Three properties of this embryo matter:

1. `kind` is **not namespaced** — `'component'` is only meaningful relative to
   the element `type`.
2. `kind` **is behaviour-bearing**: it gates `connectable`, and the renderer
   branches on it (`packages/affine/gfx/wardley/src/node/node-renderer.ts:46-136`).
3. Picking a Wardley component from the toolbar **creates a `wardleyNode`
   element** (`packages/affine/gfx/wardley/src/actions.ts:166-177`). Role and
   element class are the same decision.

> **Trap.** `WardleyNodeKind` is declared **twice** with different unions: the
> canonical 7-value one on the model, and a narrower 4-value one derived from
> `NODE_PRESETS` in `packages/affine/gfx/wardley/src/actions.ts:114-124`, which
> is what `toolbar/wardley-menu.ts` imports. Any code touching roles must be
> explicit about which it means.

**No tag / facet / property system exists on gfx elements at all.** Real `tags`
exist only in the unrelated data-view subsystem
(`packages/affine/data-view/src/core/logical/type-presets.ts:13-33`). Element
"labels" are either plain string `@field()` accessors or separate native `text`
elements grouped with the node
(`packages/affine/gfx/wardley/src/actions.ts:181-197`).

**No rules engine exists**, and no validation layer. The nearest prior art for a
declarative business vocabulary is `EDGY_DYNAMIC_RELATIONS`
(`packages/affine/gfx/edgy/src/templates/index.ts:277-306`), 24 hard-coded
`[source, target, verb]` triples — used only to _generate_ a template, never to
_validate_ what a user draws.

**A multi-registration precedent exists.** `SpotlightHostExtension`
(`packages/affine/blocks/surface/src/extensions/spotlight.ts`) registers a
parameterized identifier per element type; `ExternalGroupByConfigProvider` is
collected with `std.provider.getAll(...)`
(`packages/affine/blocks/database/src/database-block.ts:157`). Cumulative
registration is an established shape here.

## Decision

### 1. Identifier grammar

```ts
/** A universe is a framework namespace: 'wardley', 'edgy', 'bpmn', 'cynefin'… */
export type UniverseId = string;

/** '<universe>:<local>' — e.g. 'wardley:component', 'wardley:nature'. */
export type QualifiedId = `${string}:${string}`;

/** '<tagId>/<local>' — e.g. 'wardley:nature/data'. */
export type TagValueId = string;
```

- Ids match `/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?$/`.
  Lower-kebab, case-sensitive, no unicode, no dots.
- The `<universe>` segment of every id in a `UniverseTagDefs` MUST equal that
  pack's `universe`. Cross-universe ids are rejected at seed time.
- **Ids are forever.** A def is never removed, only `deprecated`. Documents
  store ids, and a document must keep opening after any seeding change.

### 2. The defs format (TypeScript, and JSON by construction)

New file `packages/affine/shared/src/services/universe-tag-defs-service.ts`.
The types are plain data — no functions, no classes, no `Symbol` — so the TS
type _is_ the JSON schema, and a pack can be shipped as a `.json` asset.

```ts
export type TagValueDef = {
  /** '<tagId>/<local>', e.g. 'wardley:nature/data'. */
  id: TagValueId;
  /** Display label, already localized by the host. */
  label: string;
  description?: string;
  /** Advisory colour token. The library may ignore it; it never affects layout. */
  color?: string;
  /** Hidden from pickers; still displayed when already present on an element. */
  deprecated?: boolean;
};

export type TagDef = {
  /** '<universe>:<local>', e.g. 'wardley:nature'. */
  id: QualifiedId;
  label: string;
  description?: string;
  /** How many values an element may carry for this tag. */
  cardinality: 'single' | 'multi';
  /** A closed list, or 'open' for free-text values. */
  values: TagValueDef[] | 'open';
  /**
   * Roles this tag qualifies. '*' = every role of this universe.
   * Inheritance applies: a tag on 'wardley:component' also applies to every
   * role that (transitively) extends it.
   */
  appliesTo: QualifiedId[] | '*';
  /**
   * Advisory only. A missing "required" tag is reported by the rules engine
   * (wave 3); it NEVER blocks a gesture, a save, or a document load.
   */
  required?: boolean;
  /** Ascending display order. Ties broken by seed order, then by id. */
  order?: number;
  deprecated?: boolean;
};

export type RoleDef = {
  /** '<universe>:<local>', e.g. 'wardley:component'. */
  id: QualifiedId;
  label: string;
  description?: string;
  /**
   * Role inheritance. A rule (or a tag's `appliesTo`) stated on the parent
   * applies to every descendant. Same universe only. Cycles are rejected.
   */
  extends?: QualifiedId;
  deprecated?: boolean;
};

export type UniverseTagDefs = {
  /** Bumped only on a breaking change to THIS format. Currently 1. */
  formatVersion: 1;
  /**
   * Unique id of this *pack*, not of the universe: several packs may extend
   * the same universe (a base Wardley pack + a client's private extension).
   * Doubles as the DI variant — see § 3.
   */
  packId: string;
  universe: UniverseId;
  label: string;
  roles: RoleDef[];
  tags: TagDef[];
};
```

### 3. Seeding: cumulative, idempotent, and never fatal

Registration follows the repo's established multi-implementation shape: a
**variant-parameterized identifier** collected with `getAll` — the same
mechanism as `SpotlightHostExtension(elementType)`
(`packages/affine/blocks/surface/src/extensions/spotlight.ts`) and
`ExternalGroupByConfigProvider(config.name)`
(`packages/affine/blocks/database/src/database-block.ts:157`).

```ts
/** Variant-parameterized: one registration per pack, keyed by `packId`. */
export const UniverseTagDefsProvider = createIdentifier<UniverseTagDefs>(
  'LabreUniverseTagDefs'
);

export function UniverseTagDefsExtension(
  defs: UniverseTagDefs | UniverseTagDefs[]
): ExtensionType {
  return {
    setup: di => {
      for (const pack of Array.isArray(defs) ? defs : [defs]) {
        // `override` (not `addImpl`): re-seeding the same packId REPLACES it.
        di.override(UniverseTagDefsProvider(pack.packId), () => pack);
      }
    },
  };
}
```

**Why `override` and not `addImpl`.** `addImpl` throws
`DuplicateServiceDefinitionError` when the same `[scope, identifier, variant]`
is registered twice (`packages/framework/global/src/di/container.ts:179-182`).
`override` is documented as "same as `addImpl` but overrides if it exists"
(`container.ts:348-349`) and works whether or not a prior registration exists.
That is exactly the idempotency we need: **distinct `packId`s accumulate,
identical `packId`s replace**, and a host that re-registers on every render
never throws and never grows the registry.

```ts
/** Merged, validated, read-only view over `provider.getAll(UniverseTagDefsProvider)`. */
export interface UniverseRegistry {
  universes(): UniverseId[];
  roles(universe: UniverseId): RoleDef[];
  role(id: QualifiedId): RoleDef | undefined;
  /** Self first, then ancestors. Empty if the role is unknown. */
  roleChain(id: QualifiedId): RoleDef[];
  /** Tags applying to a role, inheritance resolved, ordered. */
  tagsForRole(id: QualifiedId): TagDef[];
  tag(id: QualifiedId): TagDef | undefined;
  /** Seed-time problems, for a host diagnostics panel. Never thrown. */
  issues(): UniverseDefIssue[];
}

export type UniverseDefIssue = {
  severity: 'warning' | 'error';
  code:
    | 'invalid-id'
    | 'cross-universe-id'
    | 'duplicate-conflict'
    | 'unknown-parent'
    | 'inheritance-cycle'
    | 'unsupported-format-version';
  id?: string;
  message: string;
};
```

**Merge rules.**

- **Union by id.** All registered packs are merged; several packs may extend the
  same universe.
- **Idempotent activation.** Enforced at two levels: the DI variant keyed on
  `packId` (§ 3) makes re-registration a replacement rather than an
  accumulation, and the merge below is order-independent for everything except
  the explicitly ordered rules. Activating a universe twice yields the same
  registry, by value.
- **Additive fields merge:** `TagDef.values` are unioned by value id;
  `appliesTo` arrays are unioned; `'*'` absorbs any list.
- **Cosmetic fields — last pack in `getAll` order wins:** `label`,
  `description`, `color`, `order`.
- **Structural fields — first pack wins, conflict recorded:** `cardinality`,
  `extends`, and `values: 'open'` vs a closed list. The conflict becomes a
  `duplicate-conflict` error issue. It does **not** throw. (Hosts that need a
  deterministic winner should not define the same structural field in two
  packs — the registry reports the collision rather than guessing.)
- **Nothing throws, ever.** An invalid id, an unknown parent, a cycle, an
  unrecognized `formatVersion` — each drops the offending def and records an
  issue. A malformed seed must never prevent a document from opening. This is
  the hard boundary between "the app misconfigured a pack" and "the user lost
  their board".
- **Defs are runtime configuration and are NEVER persisted.** The document
  stores only ids. A value whose def has vanished still loads and is displayed
  as its raw id, marked unknown.

### 4. What the element carries

Two additive optional `@field()` accessors on `GfxPrimitiveElementModel`,
alongside `docId` (ADR 0005 § 1):

```ts
// packages/framework/std/src/gfx/model/surface/element-model.ts

/**
 * Level 2 — the element's semantic role, e.g. 'wardley:component'.
 * Opaque to the framework: no renderer, no hit-test and no layout code reads
 * it. Undefined = level 1, a free shape.
 */
@field()
accessor role: string | undefined = undefined;

/**
 * Level 3 — contextual qualification. Tag def id -> selected value ids.
 * e.g. { 'wardley:nature': ['wardley:nature/data'] }.
 * Undefined and {} are equivalent (both mean "unqualified").
 */
@field()
accessor tags: Record<string, string[]> | undefined = undefined;
```

`BaseElementProps` gains `role?: string` and `tags?: Record<string, string[]>`.

**Persisted types are `string`, not `QualifiedId`.** The template-literal type
is a _seed-time_ validation aid. Persisted values must accept any string,
because a document may legitimately carry an id whose def has been removed,
renamed or never seeded in this deployment — and it must still open. Narrowing
the persisted type would push that case toward a load-time failure, which
Compatibility below forbids. This is also why `OccurrenceFacetPatch.role` is
`string | undefined` in ADR 0006.

**Conflict granularity, stated honestly.** `tags` is a plain JS object stored as
one `Y.Map` value, so concurrent edits converge last-write-wins over the _whole
tag set_ of that element, not per tag. Precedent: `comments?: Record<string, boolean>`
on `affine:database`. Accepted because qualification is a deliberate,
low-frequency, single-author gesture on a single element; a nested `Y.Map` would
buy per-tag merging at the cost of leaving the `@field()` mechanism entirely.
Revisit if collaborative qualification becomes a real workflow.

### 5. Relationship to the existing `kind` fields — additive, no migration

- Existing `kind` fields stay exactly as they are and remain **authoritative for
  rendering and behaviour** (`connectable`, glyphs).
- `role` is **authoritative for rules and qualification**.
- The library ships a pure, side-effect-free projection —
  `roleFromLegacyKind(elementType, kind): QualifiedId | undefined`, mapping
  `('wardleyNode', 'component') → 'wardley:component'`,
  `('edgyNode', 'outcome') → 'edgy:outcome'`, etc. It is a **read-time**
  fallback used when `role` is unset. **It writes nothing.** There is no
  migration, no backfill, no document rewrite.
- New universes seeded by the app use `role` only; they have no `kind`.
- Unifying `kind` into `role` is explicitly **out of scope** for Jalon 0.

### 6. The promotion ladder

Four rungs — **shape → role → component → facets** — and therefore three
transitions. (Rung numbers are _not_ the typology levels of the Context table:
rung 4, "facets", is where typology level 3 is authored.) **Every transition is
reversible, none is a conversion, none touches geometry.**

| Transition         | Gesture                    | Written            | Reverse                                                                                                    |
| ------------------ | -------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| shape → role       | Assign a role              | `role`             | Clear `role` (tags whose `appliesTo` no longer matches are kept, shown as inapplicable)                    |
| role → component   | Bind to a pivot record     | `docId` (ADR 0005) | Clear `docId`. The record survives — the library never deletes host data                                   |
| component → facets | Qualify (typology level 3) | `tags`             | Clear entries. The library publishes the emptied patch; the host removes the matching derived pivot facets |

Hard invariants for every transition:

- The element's `type` never changes. No `wardleyNode` is created, destroyed or
  swapped. **Promotion is never a conversion.**
- `xywh`, `rotate`, `index`, `seed`, and every style field are untouched.
- No rung requires the previous one. An element may carry `tags` without a
  `docId`; a `docId` without a `role`. The rungs are independent axes, ordered
  only by what is _useful_, never by what is _required_.
- Each rung is one `Y.Map` write inside the store transaction the `@field()`
  setter already opens — one undo step, no I/O, no provider call.

**Tension recorded.** This ladder is a _second, additive_ path. The existing
framework toolbars still create typed element classes directly
(`actions.ts:166-177`), which _is_ a conversion at creation time and does bake
role into element class. Jalon 0 does not remove that path; the two coexist. If
they are ever unified, the ladder is the target shape.

### 7. Telemetry

Reuse ADR 0003's framework taxonomy — **no new event names**.
`FrameworkElementAdded` at promotion sites, with `element` carrying the rung:
`'promote:role'`, `'promote:pivot'`, `'promote:tag'`.

**Tension recorded.** `FrameworkElementEvent.framework`
(`packages/affine/shared/src/services/telemetry-service/lifecycle.ts:42-49`) is
a **closed union** of seven literals. App-seeded universes cannot be typed by a
union in the library. It must be widened to
`(typeof KNOWN_FRAMEWORKS)[number] | (string & {})` — a small, backward-
compatible change to be made when this ADR is implemented, not before.

## Compatibility

| Direction                      | Behaviour                                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Old document, new build        | No `role` / `tags` keys → both read `undefined` (`decorators/field.ts:52-58`). Level 1, exactly as today. Legacy `kind` still drives rendering; `roleFromLegacyKind` supplies a role at read time without writing. |
| New document, old build        | Keys present, undeclared, never read, never deleted. Load / edit / save lossless. Dropped on duplicate & paste only — see ADR 0005 § Compatibility, same mechanism, same transitional window.                      |
| Surface element schema version | There is none. Surface elements carry no version and have no upgrade hook (unlike block schemas, where `externalSourceId` forced `affine:database` `version: 3 → 4`). Nothing to increment, nothing to migrate.    |
| Def pack removed / renamed     | Documents keep their ids. Unknown ids render as raw ids marked unknown. **Never** a load failure, never a silent deletion.                                                                                         |
| `formatVersion` unknown        | The whole pack is dropped with an `unsupported-format-version` issue. Documents still open; the tooling is simply unavailable.                                                                                     |

### The flag invariant, checked against the real code

_Every document opens and saves whatever the flag state; gating covers tooling
only._ Where this stands today:

- **Holds for surface elements.** Element constructors are registered
  **unconditionally** in
  `packages/affine/blocks/surface/src/element-model/index.ts:23-41` — `wardley`,
  `wardleyNode`, `edgy`, `edgyBoard`, `edgyNode`, `bpmnNode`… are not
  flag-gated. `getAffineSchemas(flags)` gates _block_ schemas, not element
  ctors. A board full of Wardley nodes therefore loads with `wardley: false`.
- **Partially holds for rendering.** For most frameworks, renderers and views
  live _inside_ the gated `ViewExtension` —
  `packages/affine/gfx/edgy/src/view.ts:32-51` registers
  `EdgyNodeRendererExtension` within `EdgyViewExtension`, itself gated at
  `packages/affine/all/src/extensions/view.ts:108-109`. With the flag off, such
  an element loads and saves but has no renderer.
  **The fix already has a precedent in the repo**: DDD Core Domain splits the
  two, registering `DddCoreDomainRenderViewExtension` unconditionally and gating
  only `DddCoreDomainViewExtension`
  (`packages/affine/all/src/extensions/view.ts:112-115`, comment: _"Core Domain
  rendering is always on; the flag gates only the senior button."_).
  **Follow-up, out of scope here:** generalize that split to every framework so
  the invariant holds visually, not merely at the persistence layer.
- **Does not hold for blocks**, by ADR 0002's own documented caveat
  (`flags.ts:16-19`: a stored document containing a disabled block fails schema
  validation on load). Unchanged by this ADR, and flagged for a future amendment
  to ADR 0002.
- **This ADR's own contract is flag-free.** Def packs are pure data;
  `role`/`tags` live on the base class in `@labre/std`. Nothing here can be
  gated off in a way that prevents a document from opening.

## Consequences

- A new business universe (cynefin, TOGAF, a client's private taxonomy) is a
  JSON pack registered by the host. Zero library code, zero release.
- Roles and tags are inert data to the framework. No renderer, hit-test or
  layout path reads them, so a bad pack can produce a confusing menu but cannot
  move, hide or corrupt a single shape.
- Level 3 becomes the raw material for the wave-3 rules engine: `roleChain` +
  `tagsForRole` give inherited rule scoping for free.
- The repo now has two vocabularies for "what this element is" — legacy `kind`
  and `role` — for as long as Jalon 0's additive posture holds. Reviewers should
  treat any code writing `role` from `kind` (rather than projecting at read
  time) as a bug.
- "Facet" now means two unrelated things in this codebase. Naming a new symbol
  `*Facet*` requires disambiguating against `EdgyFacetsElementModel`.
- Rejected: storing defs in the document. It would make a board unopenable
  against a changed pack and would duplicate host-owned configuration into
  user data.
- Rejected: a global (non-namespaced) tag vocabulary. Two universes will collide
  on `activity` — `edgy:activity` (an EDGY base element,
  `elements/edgy/node.ts:12`) already coexists with Wardley's level-3
  `data/practice/knowledge/activity`. Namespacing is not decoration here; it is
  the reason the collision is harmless.
