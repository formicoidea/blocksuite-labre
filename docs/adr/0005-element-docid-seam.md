# ADR 0005 — The surface element → `docId` seam

- Status: **proposed** (August 2026) — requires human approval before any code
  lands (it touches the surface element schema, a de facto red zone under
  `CLAUDE.md`).
- Deciders: Mathieu Jolly
- Milestone: "PF+MF" refoundation, Jalon 0 (contract seams)
- Companion ADRs: [0006](0006-pivot-properties-provider.md) (how the bound
  record is read), [0007](0007-universe-tag-defs-format.md) (what qualifies the
  element). The three form **one contract, frozen together**.

## Context

User story MF1: a surface element on an edgeless board must be able to _be an
occurrence of_ a **pivot record** — a document owned by the host application
(labreapp) that holds the durable, cross-board identity of a business object
("the Payments component", "the Onboarding journey"). A Wardley `component`
drawn on three different maps is the _same_ component; today the library has no
way to say so.

Three facts from the existing code shape the answer.

**1. A precedent exists at block level: `externalSourceId`.**
`packages/affine/model/src/blocks/database/database-model.ts:20-24,37` adds an
optional `externalSourceId?: string` to `affine:database`, consumed only when a
host registers `DatabaseDataSourceProvider`
(`packages/affine/blocks/database/src/service/index.ts:20-25`), resolved
optionally at `packages/affine/blocks/database/src/database-block.ts:165-169`:

```ts
const provider = this.std.getOptional(DatabaseDataSourceProvider);
const dataSource =
  provider && this.model.props.externalSourceId
    ? provider.createDataSource(this.model, initFn)
    : new DatabaseBlockDataSource(this.model, initFn);
```

That precedent is the right _shape_ but it paid a cost we do not have to pay:
block schemas carry a `version`, so the field forced `version: 3 → 4`
(`database-model.ts:41`, changelog in `packages/affine/model/CHANGELOG.md:93`).

**2. Surface elements have no schema version at all.** A surface element is a
`Y.Map` whose keys are written one by one by the `@field()` accessor decorator
(`packages/framework/std/src/gfx/model/surface/decorators/field.ts:18-88`). The
read path is:

```ts
get(this: GfxPrimitiveElementModel) {
  return (
    (this.yMap.doc ? this.yMap.get(prop as string) : null) ??
    this._preserved.get(prop as string) ??
    fallback
  );
}
```

An absent key reads as the fallback. There is no version counter, no upgrade
hook, no validation of the key set — nothing ever enumerates the `Y.Map`'s keys
against the class's declared fields. The load path
(`surface-model.ts:347`, `_createElementFromYMap` at `:179`) even passes
`skipFieldInit: true`, so declared defaults never overwrite persisted values.
The only hard failure on load is an **unknown element `type`**, which throws
`Invalid element type` (`surface-model.ts:197-199`) — a key nobody declares is
simply a key nobody reads.

**3. A near-neighbour already lives on the base class.**
`GfxPrimitiveElementModel` already carries `externalLink` and `linkedDocId`
(`element-model.ts:364-373`), documented in `docs/element-link-integration.md`.
That is a **hyperlink**: at most one of the two is set, it is picked through
`QuickSearchProvider`, and a hover arrow opens it via
`RefNodeSlotsProvider.docLinkClicked`. It answers "where does this arrow take
me", not "what is this element an occurrence of".

## Decision

### 1. A new, distinct optional field `docId` on `GfxPrimitiveElementModel`

```ts
// packages/framework/std/src/gfx/model/surface/element-model.ts
export abstract class GfxPrimitiveElementModel<
  Props extends BaseElementProps = BaseElementProps,
> implements GfxCompatibleInterface
{
  /**
   * Identity binding to a host-owned **pivot record**: this element is an
   * *occurrence* of the document `docId`. Many elements, across many boards,
   * may carry the same `docId` — that is the point.
   *
   * Opaque to the library: the framework never dereferences it, never fetches
   * it, never renders it. Reading it is the job of the host, through
   * `PivotPropertiesProvider` (ADR 0006).
   *
   * Orthogonal to {@link linkedDocId} / {@link externalLink}, which are a
   * *hyperlink* (navigation), not an identity. An element may carry both.
   */
  @field()
  accessor docId: string | undefined = undefined;
}
```

`BaseElementProps` gains `docId?: string`.

**Why a second doc-id-shaped field rather than reusing `linkedDocId`.** They
differ on every axis that matters: cardinality (`linkedDocId` is one target per
element and is _exclusive_ with `externalLink`; `docId` is many-elements-to-one
record), lifecycle (a hyperlink is chosen from a search modal; a binding is
created by promotion, ADR 0007), consumers (an arrow that navigates vs. a hover
card and a rules engine), and reversibility semantics. Overloading
`linkedDocId` would silently break the "at most one is set" invariant asserted
in `docs/element-link-integration.md` and change the behaviour of the shipped
`edgeless-element-link` widget
(`packages/affine/widgets/edgeless-selected-rect/src/edgeless-element-link.ts:96,136-142`).
_Open question for approval:_ `pivotDocId` reads less ambiguously next to
`linkedDocId`. We propose `docId` because it matches the host's vocabulary and
ADR 0006/0007 signatures; renaming is free **only before** the first document is
written.

### 2. No version increment, no migration, no upgrade hook

Surface elements have no schema version, so there is nothing to increment. The
field is additive and absent-reads-`undefined`. **No migration code is
written, and none is needed.** This is the one respect in which the seam is
cheaper than the `externalSourceId` precedent.

### 3. Binding is synchronous and dependency-free

Setting the binding is exactly one `Y.Map` write inside the store transaction
already opened by the `@field()` setter (`field.ts:71-78`):

```ts
surface.updateElement(elementId, { docId });
```

**Hard rule:** the code path that binds an element MUST NOT `await` anything,
MUST NOT call `PivotPropertiesProvider`, and MUST NOT require the pivot record
to exist or be reachable. A binding to a record that does not (yet) exist is a
legal, persisted state; it resolves to `{ status: 'missing' }` at read time
(ADR 0006). Creating the record, if the gesture implies one, is the host's
concern and happens off the critical path.

Correspondingly `docId` participates in **no** `@derive`, `@convert` or
`@watch` chain and is read by **no** renderer. It cannot move, resize or
restyle anything.

### 4. Exactly two named consumers

1. **Hover / peek (host).** The hover card shows the element's own facts
   immediately and appends the pivot record's properties when — and only
   when — the host resolves them. Contract in ADR 0006.
2. **Rules engine, wave 3 (host).** Type-3 qualifications (ADR 0007) mirrored
   onto the bound record become _validation facts_ carrying the provenance
   `derived-from-occurrence`. The library supplies the facts; it evaluates no
   rule.

No other consumer may read `docId` without amending this ADR. In particular
**no renderer, no exporter, no layout code**.

### 5. Backlinks are computed, never persisted

The library ships one pure, synchronous collector and nothing else:

```ts
// packages/framework/std/src/gfx/model/surface/pivot.ts
export type PivotOccurrence = {
  /** The bound pivot record. */
  docId: string;
  /** The surface element that is an occurrence of it. */
  elementId: string;
  /** Element type, e.g. 'shape' | 'wardleyNode' | 'edgyNode'. */
  elementType: string;
};

/** O(n) over the surface's elements. Allocates nothing persistent. */
export function collectPivotOccurrences(
  surface: SurfaceBlockModel
): PivotOccurrence[];

export type PivotBoundElement = GfxPrimitiveElementModel & { docId: string };
export function isPivotBound(
  el: GfxPrimitiveElementModel
): el is PivotBoundElement;
```

There is **no** index, no reverse map, no cache, and nothing written back into
the document. Cross-document aggregation ("every board where this component
appears") is the host's job, built from per-document calls to
`collectPivotOccurrences`. The repository has no backlink infrastructure today
and this ADR deliberately does not introduce one.

### 6. Scope

Surface elements only (`GfxPrimitiveElementModel` and its subclasses). Canvas
**blocks** (`affine:note`, `affine:image`, `affine:edgeless-text`…) are block
models with a versioned schema; binding them would be a `version` bump in
`packages/affine/model` — a red zone — and is explicitly **out of scope** for
Jalon 0.

## Compatibility

| Direction               | Behaviour                                                                                                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Old document, new build | `yMap` has no `docId` key → the accessor reads `undefined` (`field.ts:52-58`). Unbound, exactly as today.                                                                                                                                                                   |
| New document, old build | The key is present but no accessor declares it. Nothing reads it and nothing deletes it: `syncElementFromY` (`element-model.ts:567`) mirrors _every_ entry into `_preserved`, declared or not. Load / edit / save is lossless. **Except on duplicate & paste** — see below. |
| Concurrent edits        | One `Y.Map` key, scalar value → Yjs last-write-wins at key granularity. Two users binding the same element to different records converge on one; no corruption.                                                                                                             |
| Flags off               | `docId` lives on the base class in `@labre/std`, outside the flag registry. Documents carrying it open with every framework flag disabled.                                                                                                                                  |
| Deleted pivot record    | The `docId` string survives. Resolution yields `{ status: 'missing' }` (ADR 0006); nothing is cleaned up automatically — the library never deletes host data.                                                                                                               |

**Two costs, stated honestly.**

1. `@field()`'s `init()` writes the key into the `Y.Map` at element creation
   even when the value is `undefined` (`field.ts:39-48`), so every newly created
   surface element gains one key. Same cost already paid by `externalLink` and
   `linkedDocId`; accepted for symmetry rather than introducing a second
   storage mechanism.
2. **Undeclared keys are dropped by duplicate / paste, not by load.**
   `_createElementFromProps` (`surface-model.ts:168-173`) replays serialized
   props with `elementModel.model[key] = props[key]`; with no accessor backing
   the key it lands as a plain own property and is never written to the `Y.Map`
   (`packages/affine/blocks/root/src/edgeless/clipboard/canvas.ts:97`,
   `.../edgeless/utils/clone-utils.ts:51`). So a _pre-`docId`_ build that copies
   a bound element produces an unbound copy. Snapshot import/export is not
   affected — `surface-transformer.ts` (`_elementToJSON` / `elementFromJSON`)
   replays every key verbatim. This is a **transitional** hazard only: it
   disappears once the field ships, and it degrades to "the copy is unbound",
   never to data corruption.

## Consequences

- The binding gesture is one transaction and cannot be slowed, blocked or
  failed by the host's data layer. This is the invariant that makes the pivot
  record safe to introduce at all.
- The library gains **no** knowledge of what a pivot record is. Running
  standalone (playground, tests) with no provider registered, `docId` is inert
  data.
- "Which boards mention this component" is a recomputation, always. It can never
  drift from the document, and it can never be corrupted by a bad write —
  because there is no write.
- Two doc-id-shaped fields now coexist on the base class. The distinction is
  documented on both accessors and in `docs/element-link-integration.md`;
  reviewers should treat any code reading one as a stand-in for the other as a
  bug.
- Rejected: an element-side array of bindings (`docIds: string[]`). One element
  is one occurrence of one thing; multi-binding would make the occurrence table
  ambiguous and has no user story behind it.
