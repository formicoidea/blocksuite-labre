# ADR 0007 — Per-universe tag-definition format and the promotion ladder

- Status: **proposed** (August 2026) — requires human approval (it fixes two new
  persisted fields on the surface element schema, a de facto red zone under
  `CLAUDE.md`).
- Deciders: Mathieu Jolly
- Milestone: "PF+MF" refoundation, Jalon 0 (contract seams)
- Companion ADRs: [0005](0005-element-docid-seam.md) (the `pivotDocId` binding),
  [0006](0006-pivot-properties-provider.md) (reading the bound record). The
  three form **one contract, frozen together**.

## Vocabulary: **materiality**, not "facet"

PO decision, 2026-08-01. The qualifications reflected from a board occurrence
onto its pivot record are **materialities** (fr. _matérialités_). Across
ADRs 0005–0007 the type is `OccurrenceMaterialityPatch`, the publisher is
`PivotMaterialityPublisher`, the provider method is
`publishOccurrenceMaterialities`, and the promotion ladder ends in
**materialities**. The provenance value `'derived-from-occurrence'` is
unchanged.

**Why the rename.** "Facet" was already taken in this repo, by a _drawing_:
`EdgyFacetsElementModel` (`packages/affine/model/src/elements/edgy/facets.ts`,
element type `'edgy'`) is the EDGY Identity / Architecture / Experience Venn
diagram, with `identityLabel` / `architectureLabel` / `experienceLabel` fields
and a `spotlightEnabled` toggle. It has nothing to do with pivot-record
qualification. An earlier draft of this ADR opened with a terminology warning
asking readers to hold both meanings at once; renaming the newer concept is
strictly better than asking every future reader to disambiguate. `*Facet*` in
this codebase now unambiguously means the EDGY diagram.

> **Vocabulary correspondence — read this before comparing with the PRD.**
> The Notion PRD and the app-side metamodel still say **« facette »** for what
> the library calls **materiality**. They are the same concept: a qualification
> derived from an occurrence, attached to a pivot record with provenance
> `derived-from-occurrence`. This mapping holds until the PRD is updated:
>
> | Library (ADRs 0005–0007)     | PRD / app-side metamodel        |
> | ---------------------------- | ------------------------------- |
> | materiality                  | facette                         |
> | `OccurrenceMaterialityPatch` | patch de facette                |
> | derived materiality          | facette dérivée de l'occurrence |
>
> The EDGY facets **diagram** has no PRD counterpart under either name — it is
> a drawing, not a qualification.

## Context

### The three-level precision typology

| Level | Name                              | Where it lives                               | Rules                                                                                  |
| ----- | --------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| **1** | Free surface                      | A plain `shape` / `text` element             | None. A rectangle is a rectangle.                                                      |
| **2** | _Nature première_ — semantic role | On the element, e.g. `wardley:component`     | Posed when the artefact is chosen; a role may inherit from another role                |
| **3** | Contextual qualification          | On the element, e.g. `wardley:nature = data` | The "typed attributes" family; mirrored onto the pivot record as a derived materiality |

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

**This ADR does not define framework identity. It consumes it.**
[ADR 0008](0008-command-registry-foundation.md) (PR
[#68](https://github.com/formicoidea/blocksuite-labre/pull/68)) owns
`FRAMEWORK_IDS` / `FrameworkId`, an explicit sub-list of `OptionalBlock` using
the **flag spelling** (`'cynefin-estuarine'`, `'ddd-core-domain'`…). An earlier
draft of this ADR introduced its own `UniverseId = string`; since #68 documents
that framework identity is already "spelled four times with no shared type, and
has drifted", adding a fifth spelling was the wrong move and it is withdrawn.

**Sequencing.** ADR 0008 lands `FrameworkId` first; this ADR depends on it. #68
also flags that unifying the spellings renames the telemetry `framework`
property values — a breaking change for already-collected PostHog data — which
must be sequenced before either ADR is implemented.

"Universe" survives only as the _narrative_ word for a framework's semantic
vocabulary (and in this ADR's filename). The _type_ is `FrameworkId`, always.

```ts
import type { FrameworkId } from '@labre/std'; // ADR 0008
import type { RoleId, RoleDefs } from '@labre/std/gfx'; // shipped in PR #71

/** '<framework>:<local>' — e.g. 'wardley:component', 'wardley:nature'. */
export type QualifiedId = `${string}:${string}`;

/** '<tagId>/<local>' — e.g. 'wardley:nature/data'. */
export type TagValueId = string;
```

- Ids match `/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?$/`.
  Lower-kebab, case-sensitive, no unicode, no dots. Hyphenated framework ids are
  therefore legal: `cynefin-estuarine:domain` is a well-formed role id.
- The `<framework>` segment of every id in a pack MUST equal that pack's
  `framework`. Cross-framework ids are rejected at seed time.
- **Ids are forever.** A def is never removed, only `deprecated`. Documents
  store ids, and a document must keep opening after any seeding change.

**One `FrameworkId` may cover several element types.** `'cynefin-estuarine'` is
a single flag and a single `FrameworkId`, but two element ctors — `cynefin` and
`estuarine` (`element-model/index.ts:36-37`). Any element-type → framework
mapping is therefore **many-to-one** and must be an explicit table rather than
an identity function on the element type. Both `cynefin` and `estuarine`
elements produce role ids namespaced `cynefin-estuarine:`.

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
  /** '<framework>:<local>', e.g. 'wardley:nature'. */
  id: QualifiedId;
  label: string;
  description?: string;
  /** How many values an element may carry for this tag. */
  cardinality: 'single' | 'multi';
  /** A closed list, or 'open' for free-text values. */
  values: TagValueDef[] | 'open';
  /**
   * Role ids this tag qualifies. '*' = every role of this framework.
   * Specialisation applies: a tag on 'wardley:component' also applies to every
   * role whose `parent` chain reaches it — resolved with `roleIsA` (§ 2bis),
   * against the framework's own RoleDefs.
   */
  appliesTo: RoleId[] | '*';
  /**
   * Advisory only. A missing "required" tag is reported by the rules engine
   * (wave 3); it NEVER blocks a gesture, a save, or a document load.
   */
  required?: boolean;
  /** Ascending display order. Ties broken by seed order, then by id. */
  order?: number;
  deprecated?: boolean;
};

export type UniverseTagDefs = {
  /** Bumped only on a breaking change to THIS format. Currently 1. */
  formatVersion: 1;
  /**
   * Unique id of this *pack*, not of the framework: several packs may extend
   * the same framework (a base Wardley pack + a client's private extension).
   * Doubles as the DI variant — see § 3.
   */
  packId: string;
  framework: FrameworkId;
  label: string;
  tags: TagDef[];
};
```

**`roles` is deliberately absent from this type.** Roles are not app-seeded and
are not part of the DI mechanism — see § 2bis.

### 2bis. Roles: `RoleDef` comes from the code, not from this ADR

An earlier draft of this ADR declared its own `RoleDef` (with `label`,
`extends`, `deprecated`) inside `UniverseTagDefs.roles`, resolved through the
same DI registry as tags. **PR [#71](https://github.com/formicoidea/blocksuite-labre/pull/71)
has since shipped a `RoleDef` for the same concept at the same layer, and it is
the one that stands.** This ADR aligns rather than competing: the symbol lives
in `packages/framework/std/src/gfx/model/surface/role.ts`, exported from
`@labre/std/gfx`.

```ts
// packages/framework/std/src/gfx/model/surface/role.ts — SHIPPED in #71
/** Namespaced role identifier, `<framework>:<role>`. */
export type RoleId = string;

/** Whether a role describes a node (a surface element) or an edge (a connector). */
export type RoleKind = 'node' | 'edge';

export interface RoleDef {
  id: RoleId;
  /** The role this one specialises, if any. */
  parent?: RoleId;
  kind: RoleKind;
  /** i18n key of the human label; resolved by the host app. */
  labelKey?: string;
}

/** A framework's role vocabulary, indexed by role id. */
export type RoleDefs = Readonly<Record<RoleId, RoleDef>>;

export function roleIsA(
  roleId: RoleId | undefined,
  ancestorId: RoleId,
  defs: RoleDefs
): boolean;
```

Three of #71's choices are adopted as improvements on the draft, not merely
tolerated:

- **`parent`, not `extends`.** `extends` is a reserved word and reads as TS
  class inheritance, which is exactly what the vocabulary is not.
- **`labelKey`, not `label`.** An i18n key resolved by the host beats a string
  the library would have to pretend is already localized.
- **`kind: 'node' | 'edge'`** is real information the draft simply lacked. It is
  what lets a role vocabulary cover the Wardley `dependency` connector
  alongside its nodes.

**Roles are lib-side data modules, not a DI-seeded registry.** A framework
declares its vocabulary in a plain module — `WARDLEY_ROLES` in
`packages/affine/gfx/wardley/src/roles.ts`, a `Record<RoleId, RoleDef>` built
from a literal array — with no identifier, no `getAll`, no `packId`. The
specialisation walk is `roleIsA(roleId, ancestorId, defs)`, a bounded ancestor
walk (32 hops, so a malformed `parent` cycle terminates instead of hanging),
allocation-free because rules call it per element per rule.

**The DI mechanism of § 3 therefore applies to TAG defs only.** Tags are
app-seeded (a client's private taxonomy must be addable without a release);
roles ship with the framework module that renders them. Consequently
`UniverseRegistry` (§ 3) exposes tags only, and `roleChain` is dropped in favour
of `roleIsA` — the predicate the rules engine actually needs.

**Open question for the approver, not a prescription.** `RoleId = string` is
looser than the draft's `QualifiedId` template literal, and `RoleDef` has no
`deprecated`. Both are deliberate omissions in #71 and neither blocks anything:
`deprecated` matters when an app can seed roles, which it cannot; and the
persisted value must stay a plain `string` anyway (§ 4). Recorded here so the
approver can ask for them rather than discovering they are missing.

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

**All packs MUST be registered in the same DI scope.** `getAllRaw`
(`packages/framework/global/src/di/provider.ts:85-101`) falls back to the parent
scope **only when the current scope has no registration for the identifier at
all**; it never merges across scopes. Seeding one pack from a `StoreExtension`
and another from a `ViewExtension` — different containers, different scopes —
silently hides the first behind the second. This is a host-side constraint the
library cannot enforce, so it is stated here and belongs in the host
integration checklist.

**Order stability is load-bearing and non-obvious.** `getAll` returns a
`Map<ServiceVariant, T>`, and `Map.set` on an **existing** key preserves the
key's original insertion position. That is what makes "identical `packId`s
replace" (below) and "cosmetic fields: last pack wins" (§ merge rules)
mutually consistent: re-seeding a pack updates it **in place** rather than
moving it to the end of the iteration order, so a re-registration cannot
silently flip which pack wins a cosmetic field.

**Why `override` and not `addImpl`.** `addImpl` throws
`DuplicateServiceDefinitionError` when the same `[scope, identifier, variant]`
is registered twice (`packages/framework/global/src/di/container.ts:179-182`).
`override` is documented as "same as `addImpl` but overrides if it exists"
(`container.ts:348-349`) and works whether or not a prior registration exists.
That is exactly the idempotency we need: **distinct `packId`s accumulate,
identical `packId`s replace**, and a host that re-registers on every render
never throws and never grows the registry.

```ts
/**
 * Merged, validated, read-only view over
 * `provider.getAll(UniverseTagDefsProvider)`. TAGS ONLY — roles are lib-side
 * data modules (§ 2bis) and never pass through this registry.
 */
export interface UniverseRegistry {
  frameworks(): FrameworkId[];
  /**
   * Tags applying to a role, ordered. Role specialisation is resolved with
   * `roleIsA` against the framework's own `RoleDefs`, which the caller
   * supplies — the registry holds no role vocabulary of its own.
   */
  tagsForRole(roleId: RoleId, defs: RoleDefs): TagDef[];
  tag(id: QualifiedId): TagDef | undefined;
  /** Seed-time problems, for a host diagnostics panel. Never thrown. */
  issues(): UniverseDefIssue[];
}

export type UniverseDefIssue = {
  severity: 'warning' | 'error';
  code:
    | 'invalid-id'
    | 'cross-framework-id'
    | 'duplicate-conflict'
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
alongside `pivotDocId` (ADR 0005 § 1):

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
 * Level 3 — contextual qualification. A NESTED Y.Map, tag def id -> selected
 * value ids, e.g. { 'wardley:nature': ['wardley:nature/data'] }.
 * Absent, and an empty map, are equivalent (both mean "unqualified").
 * The default is `undefined`, NOT `new Y.Map()`: the qualification writer
 * creates the map on first use, so an element that is never qualified costs
 * nothing (see Storage cost below). See further below for why this is a Y.Map
 * and not a plain object.
 */
@field()
accessor tags: Y.Map<string[]> | undefined = undefined;
```

`BaseElementProps` gains `role?: string` and `tags?: Y.Map<string[]>`.

> **Amended 2026-08-02 (MF3 implementation, PR #95).** The nested `Y.Map` is
> confirmed feasible and shipped, but two mechanisms had to be extended for it,
> both because it is the first nested Y type declared on the BASE class:
>
> 1. **`_propsToY` normalizes `tags` for every element type.** Per-class
>    `propsToY` hooks (`MindmapElementModel.propsToY` and friends) are what
>    rebuild a nested map from the plain JSON that `serialize()` — i.e.
>    `yMap.toJSON()` — hands to paste, duplicate and alt-drag clone. A
>    base-class field has no such hook, so `SurfaceBlockModel._propsToY` calls
>    `tagsPropToY` before the class hook. Without it every copy stored its
>    qualification as one opaque plain object: indistinguishable from a correct
>    copy until two people edited it and one of them lost a tag.
> 2. **A mutation INSIDE the map has to become an element change.** > `syncElementFromY` observes the element's own `Y.Map` only, so setting one
>    tag in place — the whole point of the shape — emitted nothing. The field
>    carries an `@observe` bridge that republishes it as an
>    `elementUpdated` with the transaction's own `local` flag, the `Y.Map`
>    counterpart of the `watchText` bridge the same file already ships for
>    nested `Y.Text`. `syncElementFromY` additionally re-attaches an `@observe`d
>    nested type when the KEY is rewritten: remote peers and undo/redo never
>    reach the accessor's setter, the only other caller of `startObserve`, so
>    the observer was left on a dead type and a set-undo-redo-set sequence lost
>    its last write.
>
> **Trap worth recording:** a `Y.Map` that has not been integrated into a
> document holds its content in `_prelimContent`, so `size`, `get` and
> `entries` all read empty and log _"Add Yjs type to a document before reading
> data"_. Code that builds a map before attaching it — `tagsPropToY`, and any
> test fixture — must not consult `size` to decide whether it has content.

The `role` declaration above is **already shipped** by PR
[#71](https://github.com/formicoidea/blocksuite-labre/pull/71) on
`GfxPrimitiveElementModel` — flat string, `undefined` default, declared on the
base class so that paste/duplicate preserve it for every element type. This ADR
records the contract; it does not ask for that field to be written again.

**Persisted types are `string`, not `QualifiedId`.** The template-literal type
is a _seed-time_ validation aid. Persisted values must accept any string,
because a document may legitimately carry an id whose def has been removed,
renamed or never seeded in this deployment — and it must still open. Narrowing
the persisted type would push that case toward a load-time failure, which
Compatibility below forbids. This is also why `OccurrenceMaterialityPatch.role` is
`string | undefined` in ADR 0006.

**Storage cost: zero for unqualified elements, by construction.** An earlier
draft priced these fields at three wasted `Y.Map` keys on _every_ primitive —
every brush stroke, every connector — plus an empty nested `Y.Map`. That is no
longer the case: PR
[#71](https://github.com/formicoidea/blocksuite-labre/pull/71) changed
`@field()`'s `init()` to return early on an `undefined` default
(`decorators/field.ts`), so an optional field stays **absent** from the `Y.Map`
until something assigns it.

This ADR **depends on that behaviour**, which is why `tags` defaults to
`undefined` rather than to an empty `Y.Map`. A non-`undefined` default on the
base class would reinstate the whole cost on every element in every document.
Declaring on the base class remains right — it is what makes duplicate/paste
preserve the fields for every element type at once (#67 recommendation #1),
where declaring per framework element class would reintroduce the loss for
plain shapes, precisely the elements the promotion ladder targets. The cost of
that choice is now nil for elements that do not use the fields.

**Naming — session-architect arbitration, final call belongs to the approver.**
Both names collide with existing vocabulary, and both are kept anyway:

- **`role`** collides with `defineBlockSchema`'s
  `metadata: { role: 'hub' | 'content' | 'root' }` (e.g. `database-model.ts:40`).
  Kept, because the two never meet: `metadata.role` is a static schema
  descriptor on _block_ flavours and is not a persisted per-element key, while
  this `role` is product vocabulary carried by _surface elements_. Rejected
  alternative: `semanticRole` (also `universeRole`). It is unambiguous, and if
  the approver prefers it the change is free right now — after the first write
  it is not (no migration runner, #67 § 4).
- **`tags`** collides with the data-view tag vocabulary this same ADR cites
  (`type-presets.ts:13-33`). Kept for the same reason — different layer, no
  shared call site. Rejected alternative: `universeTags`.

This is deliberately _not_ the same call as ADR 0005's `docId → pivotDocId`.
There, the colliding name sat on the **same class** (`linkedDocId`) and in the
**same call site** (`properties$(el.docId)`), so the ambiguity was live. Here it
is cross-layer. Reviewers who disagree with that distinction should say so at
approval: it is the only remaining free moment.

#### Why `tags` is a nested `Y.Map` and not a plain object

An earlier draft of this ADR stored `tags` as a plain JS object and justified
whole-blob last-write-wins with the block-level precedent
`comments?: Record<string, boolean>` on `affine:database`. **Both halves of that
justification were wrong, and the decision they supported is reversed here.**

1. **The `comments` precedent argued the opposite.** Block props do not store
   pure objects opaquely: they pass through the reactive proxy into `native2Y`
   (`packages/framework/store/src/reactive/native-y.ts:29-36`), which defaults
   to `deep = true` and converts every `isPureObject` value into a nested
   `Y.Map`, key by key. `comments` already merges **per key**, CRDT-style. It
   was evidence against whole-blob LWW, cited in favour of it.
2. **The stated cost of the alternative was false.** `@field()` supports a
   nested `Y.Map` today: `MindmapElementModel` does exactly this —
   `packages/affine/model/src/elements/mindmap/mindmap.ts:965`,
   `@field() accessor children: Y.Map<NodeDetail> = new Y.Map();`. Per-tag
   merging costs a nested `Y.Map` _inside_ `@field()`, not an exit from the
   mechanism.

The correction matters because the surface layer is **not** the block layer:
`@field()` writes straight to the element's `Y.Map` (`field.ts:71-78`) with no
`native2Y` in the path, so a plain object there really would be one opaque
value. The genuine on-element precedents for opaque plain objects are
`ConnectorElementModel.source` / `target` / `labelOffset` / `labelStyle`
(`connector.ts:459,472,513,527`) — but each of those is a single atomic
geometry or style value, not an accumulating multi-key set authored by
different people at different times.

**Decision: `Y.Map<string[]>`, keyed by tag def id.** Two users qualifying the
same element on _different_ tags both keep their work. The `string[]` for a
_single_ tag stays last-write-wins, which is correct: one tag's value set is one
atomic choice.

The deciding argument is asymmetry of harm under a frozen shape. There is **no
migration runner in `packages/framework/store` and no version tag that does
anything** (spike [#67](https://github.com/formicoidea/blocksuite-labre/pull/67)
§ 4: _"none required, and none available"_), so this shape is chosen once. An
under-powered merge loses user qualification silently — the exact harm class the
red zone in `CLAUDE.md` exists to prevent, and the input to a rules engine that
treats these as validation facts. An over-powered merge costs some complexity.
Those are not comparable stakes.

**The `Y.Map` round-trips.** Verified on both replay paths, and this is what
bounds the added complexity:

- `_propsToY` reconstructs any `Y.Map`-valued prop generically via
  `SURFACE_YMAP_UNIQ_IDENTIFIER` (`surface-model.ts:416-425`) — it iterates
  `Object.entries(props)` and is not mindmap-specific.
- The snapshot transformer round-trips it: `_toJSON` emits
  `{ [SURFACE_YMAP_UNIQ_IDENTIFIER]: true, json: value.toJSON() }` and
  `_fromJSON` rebuilds it (`surface-transformer.ts:23-38,41-54`).
- #67's recommendation #2 ("keep the value a flat string") constrains **nested
  Y types inside the map**, not plain JSON values: `_toJSON` is one level of
  Y-awareness deep. `Y.Map<string[]>` is exactly one level, with plain arrays as
  values — inside the envelope, and shallower than mindmap's
  `Y.Map<NodeDetail>`, which already ships.

### 5. Relationship to the existing `kind` fields — additive, no backfill

- Existing `kind` fields stay exactly as they are and remain **authoritative for
  rendering and behaviour** (`connectable`, glyphs).
- `role` is **authoritative for rules and qualification**.
- New frameworks use `role` only; they have no `kind`.
- Unifying `kind` into `role` is explicitly **out of scope** for Jalon 0.

#### Co-writing `role` and `kind` at the creation site is PRESCRIBED

An earlier draft of this ADR told reviewers to "treat any code writing `role`
from `kind` as a bug", and specified a read-time projection
`roleFromLegacyKind(elementType, kind)` that "writes nothing". **That clause was
wrong and is withdrawn.** PRD Principe 8 requires the type-2 role to be posed
**at the moment the artefact is selected**, and the toolbox selection _is_ that
semantic gesture — not a legacy artefact to be projected away. Writing both
fields from that one selection, as
`packages/affine/gfx/wardley/src/actions.ts:172` does, is the prescribed
behaviour:

```ts
return surface.addElement({
  type: 'wardleyNode',
  kind,
  // Semantic identity (PF1): posted next to `kind`, which stays untouched
  // and keeps driving the rendering.
  role: WARDLEY_ROLE[kind],
  // …
});
```

What this ADR forbids is narrower, and is what the original clause was reaching
for:

1. **No post-hoc derivation or backfill.** Nothing may walk existing documents
   computing `role` from `kind`. A document authored before the field existed
   reads as neutral and stays neutral until a user gesture says otherwise. No
   migration, no open-time conversion, no document rewrite.
2. **No read-time fallback either.** `roleFromLegacyKind` is dropped entirely.
   Absent `role` means **neutral**, full stop — not "infer one". A silent
   inference would falsify "the role is the only semantic identity" and put
   rules back in the business of reading shape types.

#### The invariant that replaces it: one site writes both, or neither

The real risk is not the write — it is that an element now carries **two sources
of truth about what it is**, with no `@derive`, no `@watch`, and nothing else
holding them together. Today no path mutates `kind` after creation: the only
`updateElement` calls in `gfx/wardley` touch a label (`element-view.ts:97`) and
background booleans (`toolbar/config.ts:178`), so no desynchronisation is
reachable. The first "change this node's type" feature makes it reachable,
silently — and `role` is the one that governs rules.

**Invariant, binding on every framework module:** _any site that writes one of
`kind` / `role` writes the other, in the same `updateElement` call, from the
same user selection._ Mutating one without the other is the bug to catch in
review. A future "change type" command satisfies this by posting both; it must
**not** grow a watcher to keep them in sync, since a watcher is derivation by
another name.

`kind` and `role` are two projections of one selection, written together — not
a source and a derivative.

### 6. The promotion ladder

Four rungs — **shape → role → component → materialities** — and therefore three
transitions. (Rung numbers are _not_ the typology levels of the Context table:
rung 4, "materialities", is where typology level 3 is authored.) **Every transition is
reversible, none is a conversion, none touches geometry.**

| Transition                | Gesture                    | Written                 | Reverse                                                                                                                                                        |
| ------------------------- | -------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shape → role              | Assign a role              | `role`                  | Clear `role` (tags whose `appliesTo` no longer matches are kept, shown as inapplicable)                                                                        |
| role → component          | Bind to a pivot record     | `pivotDocId` (ADR 0005) | Clear `pivotDocId`. The record survives — the library never deletes host data                                                                                  |
| component → materialities | Qualify (typology level 3) | `tags`                  | Delete the keys. The publisher emits a patch with `tags: {}`; the host drops the derived materialities keyed by `(pivotDocId, elementId)` — ADR 0006 § 4.3/4.4 |

Hard invariants for every transition:

- The element's `type` never changes. No `wardleyNode` is created, destroyed or
  swapped. **Promotion is never a conversion.**
- `xywh`, `rotate`, `index`, `seed`, and every style field are untouched.
- No rung requires the previous one. An element may carry `tags` without a
  `pivotDocId`; a `pivotDocId` without a `role`. The rungs are independent axes, ordered
  only by what is _useful_, never by what is _required_.
- Each rung is one `Y.Map` write inside the store transaction the `@field()`
  setter already opens — no I/O, no provider call.
- **Each rung MUST call `store.captureSync()` immediately BEFORE the write.**

> **Amended 2026-08-01 (MF1 implementation, PR #89).** This rule originally read
> "immediately after the write", which contradicted the paragraph below it.
> `captureSync()` is `undoManager.stopCapturing()`: it opens a new undo stack
> item for what comes **next**, so the hazard this rule exists to prevent — a
> promotion issued within 500 ms of a drag being undone together with the drag —
> is only closed by calling it **first**. The store's own docstring
> (`store.ts:407-424`) and every merged call site agree. A rung implemented to
> the old letter would reintroduce the exact defect the rule names.

`captureSync()` is not a nicety. `store.transact()` is **not** an undo boundary:
the `Y.UndoManager` is constructed with only `trackedOrigins` and **no
`captureTimeout`**
(`packages/framework/store/src/extension/history/history-extension.ts:22-24`),
so Yjs's 500 ms default applies and consecutive transactions merge into one undo
stack item. The store's own docstring spells out the consequence
(`packages/framework/store/src/model/store/store.ts:407-424`): `op1(); op2();
captureSync(); op3();` gives one undo for `op3`, and the next reverts `op1` **and**
`op2`.

Without it, promoting within 500 ms of dragging the shape means a single Ctrl+Z
reverts **both** — so from the user's seat the transition _did_ move geometry,
breaking two of this section's own hard invariants at once. An earlier draft of
this ADR claimed "one undo step" for a bare transaction; that was simply wrong.
The existing precedent is `packages/affine/gfx/wardley/src/actions.ts:141`,
whose `finish()` calls `gfx.doc.captureSync()` for exactly this reason.

**Tension recorded.** This ladder is a _second, additive_ path. The existing
framework toolbars still create typed element classes directly
(`actions.ts:166-177`), which _is_ a conversion at creation time and does bake
role into element class. Jalon 0 does not remove that path; the two coexist. If
they are ever unified, the ladder is the target shape.

### 7. Telemetry — one new event, deliberately

An earlier draft reused `FrameworkElementAdded` for promotions under a "no new
event names" rule inherited from ADR 0003. **That was a taxonomy break and it is
reversed.** ADR 0003 § 2 defines the creation event as "UI intent, emitted at
insertion sites"; a promotion inserts nothing — § 6's own invariant is that no
element is created, destroyed or swapped. Reusing it means drawing a shape and
then promoting it emits `FrameworkElementAdded` **twice**, permanently
inflating "elements added per framework" in PostHog.

"No new event names" is not free here: it is paid in retroactively unfixable
data, the same cost #68 flags for the framework rename. A new event is cheaper
than a corrupted funnel.

```ts
// telemetry-service/lifecycle.ts — added to FrameworkDiagramEvents
export interface FrameworkPromotionEvent extends TelemetryEvent {
  page?: 'whiteboard editor';
  framework?: FrameworkId;
  /** Which rung was crossed. */
  rung: 'role' | 'pivot' | 'tag';
  /** Forward ('shape'->'role') or the reverse gesture. */
  direction: 'promote' | 'demote';
  /** Role id at the time of the gesture, when there is one. */
  role?: string;
  /** How many elements the single gesture wrote to. */
  elementCount: number;
}

export type FrameworkDiagramEvents = {
  FrameworkElementAdded: FrameworkElementEvent;
  FrameworkToolPicked: FrameworkElementEvent;
  FrameworkLegendCreated: FrameworkElementEvent;
  FrameworkElementPromoted: FrameworkPromotionEvent; // new
};
```

It stays inside ADR 0003's framework taxonomy — same `framework` segmentation,
same emission discipline — and `direction` gives the reversibility invariant a
measurable counterpart.

> **Amended 2026-08-01 (MF1 implementation, PR #89).** Two changes, both forced
> by § 6 of this same ADR.
>
> `framework` is **optional**. § 6 states that no rung requires the previous
> one — an element may carry a `pivotDocId` with no `role` at all — so a plain
> rectangle bound to a pivot record is a legal state that belongs to no
> framework. A required field would oblige the library to invent an identity,
> which is precisely what taking `FrameworkId` from ADR 0008 exists to stop. It
> is derived from the namespace of the element's `role` when there is one, and
> absent otherwise (absent rather than `'unknown'`, per the repo convention).
>
> `elementCount` is added, aligning with `ValidationExceptionEvent`: one gesture
> can promote a multi-element selection, and one event per gesture with a count
> is both cheaper and more truthful than N events. Where the selection's roles
> disagree, `role` and `framework` are omitted rather than guessed.
>
> **Emission site, for this rung.** ADR 0008 puts emission in `runCommand` "and
> nowhere else"; `pivot.bind` is the declared exception, recorded as resolved
> question 5 of that ADR. The bottleneck maps `CommandKind` onto the three
> creation events from a **static** `{ framework, element }` on the descriptor
> and receives neither the params nor the elements that actually changed, so it
> structurally cannot produce this event.

**Dependency.** `FrameworkElementEvent.framework` is a **closed union of seven
literals** (`telemetry-service/lifecycle.ts:42-49`) whose values have already
drifted from the flag spellings (telemetry `'cynefin'` vs flag
`'cynefin-estuarine'`). This ADR does **not** widen it with
`| (string & {})` — that would entrench a fifth spelling. It takes
`FrameworkId` from ADR 0008 (§ 1), which is the same unification #68 already
plans, and inherits #68's warning that the value rename breaks
already-collected PostHog data and must be sequenced first.

## Compatibility

| Direction                      | Behaviour                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Old document, new build        | Neither key is present → both read `undefined` (`decorators/field.ts:52-58`). Level 1 / neutral, exactly as today. Legacy `kind` still drives rendering, and **no role is inferred from it** (§ 5).                                                                                                                                                |
| New document, old build        | Keys present, undeclared, never read, never deleted. Load / edit / save lossless. **Preserved** on the five element-creation-from-props paths too, since #73 made the unknown-key branch write any encodable value verbatim — but see the amendment below for the shape that arrives.                                                              |
| `tags` on an old build         | Preserved, in **two different shapes** — see the amendment below the table. Load / edit / save keeps the nested `Y.Map` as an opaque Yjs type, and the snapshot transformer round-trips it generically. The five creation-from-props paths preserve it too, but **as a plain object**, because an undeclared key goes down the unknown-key branch. |
| Concurrent qualification       | Per-tag merge: two users setting _different_ tag ids on the same element both keep their value. Same tag id → last-write-wins on that key's `string[]`.                                                                                                                                                                                            |
| Surface element schema version | There is none. Surface elements carry no version and have no upgrade hook (unlike block schemas, where `externalSourceId` forced `affine:database` `version: 3 → 4`). Nothing to increment, nothing to migrate.                                                                                                                                    |
| Def pack removed / renamed     | Documents keep their ids. Unknown ids render as raw ids marked unknown. **Never** a load failure, never a silent deletion.                                                                                                                                                                                                                         |
| `formatVersion` unknown        | The whole pack is dropped with an `unsupported-format-version` issue. Documents still open; the tooling is simply unavailable.                                                                                                                                                                                                                     |

> **Amended 2026-08-02 (MF3 adversarial review of PR #95): the degraded shape
> is real, and reading it is this release's job.**
>
> This table's "New document, old build" row said the key is _dropped_ on the
> five element-creation-from-props paths, by analogy with ADR 0005's
> `pivotDocId`. For `tags` that analogy fails, and in the more dangerous
> direction: `_assignElementProp`'s unknown-key branch admits any value it can
> prove encodable, and the serialized form of the nested map — an object of
> arrays of strings — is exactly flat JSON. So a client predating this field
> **preserves the qualification, as a plain object**. Nothing is lost; the shape
> is simply not the one this ADR specifies.
>
> That makes the shape a fact a newer client MUST cope with, and it is why the
> release-ordering rule of this ADR (declare before writing, so the fleet floor
> tolerates the key) only means anything if the declaring release also **reads**
> the shape the floor produces. Left unhandled, the failure was not a missing
> tag but a destroyed one: `readElementTags` answered `{}` — the element looked
> unqualified, with no Nature section, no patch and no fact for the engine — and
> the next `setElementTag` replaced the plain object with a fresh `Y.Map`
> holding only the tag just posted, taking a colleague's qualification with it.
>
> The contract, therefore:
>
> - **Reading normalizes both shapes.** `readElementTags` / `elementTagValues`
>   accept a plain object as readily as a `Y.Map`.
> - **The first write converts, preserving content.** `setElementTag` seeds the
>   new `Y.Map` from the existing entries before applying the change. This is
>   the one case where replacing the whole value is right — a plain object was
>   never mergeable to begin with — so the degraded shape is transitional per
>   element and never survives a qualification gesture.
> - **Nothing is warned about.** A plain object under this key is a document
>   value of another vintage, not a programmer error, so `startObserve` stays
>   silent for it (it would otherwise log once per affected element per mount,
>   about something the user cannot act on).
>
> The persisted shape this ADR specifies is unchanged. What changed is the
> honesty of the compatibility claim.

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
  **The fix is already an established pattern in the repo, in two places**:
  `MindmapRenderViewExtension` is registered unconditionally while only
  `MindmapToolViewExtension` is gated (`view.ts:100-101`, comment: _"Mindmap
  rendering is always on; the flags gate only the senior buttons."_), and DDD
  Core Domain does the same with `DddCoreDomainRenderViewExtension` vs
  `DddCoreDomainViewExtension` (`view.ts:112-115`).
  **Follow-up, out of scope here:** generalize that split to every framework so
  the invariant holds visually, not merely at the persistence layer. Two
  independent precedents make this a generalization, not a promotion of a
  one-off.
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
- Level 3 becomes the raw material for the wave-3 rules engine: `roleIsA` +
  `tagsForRole` give inherited rule scoping for free.
- The repo now has two vocabularies for "what this element is" — legacy `kind`
  and `role` — for as long as Jalon 0's additive posture holds. The review rule
  is § 5's invariant: **a site that writes one writes the other**. What
  reviewers must catch is a mutation of one alone, or a backfill of `role` over
  existing documents — not the co-write at the creation site, which is
  prescribed.
- `*Facet*` in this codebase means the EDGY diagram and nothing else — the
  ambiguity an earlier draft had to warn about is designed out rather than
  documented around. The cost is a vocabulary gap with the PRD, bridged by the
  correspondence table at the top of this ADR until the PRD adopts
  "matérialité".
- Rejected: storing defs in the document. It would make a board unopenable
  against a changed pack and would duplicate host-owned configuration into
  user data.
- Rejected: a global (non-namespaced) tag vocabulary. Two universes will collide
  on `activity` — `edgy:activity` (an EDGY base element,
  `elements/edgy/node.ts:12`) already coexists with Wardley's level-3
  `data/practice/knowledge/activity`. Namespacing is not decoration here; it is
  the reason the collision is harmless.
