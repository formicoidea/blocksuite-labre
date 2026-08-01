# ADR 0005 — The surface element → `pivotDocId` seam

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

### 1. A new, distinct optional field `pivotDocId` on `GfxPrimitiveElementModel`

```ts
// packages/framework/std/src/gfx/model/surface/element-model.ts
export abstract class GfxPrimitiveElementModel<
  Props extends BaseElementProps = BaseElementProps,
> implements GfxCompatibleInterface
{
  /**
   * Identity binding to a host-owned **pivot record**: this element is an
   * *occurrence* of the document `pivotDocId`. Many elements, across many boards,
   * may carry the same `pivotDocId` — that is the point.
   *
   * Opaque to the library: the framework never dereferences it, never fetches
   * it, never renders it. Reading it is the job of the host, through
   * `PivotPropertiesProvider` (ADR 0006).
   *
   * Orthogonal to {@link linkedDocId} / {@link externalLink}, which are a
   * *hyperlink* (navigation), not an identity. An element may carry both.
   */
  @field()
  accessor pivotDocId: string | undefined = undefined;
}
```

`BaseElementProps` gains `pivotDocId?: string`.

**Why a second doc-id-shaped field rather than reusing `linkedDocId`.** They
differ on every axis that matters: cardinality (`linkedDocId` is one target per
element and is _exclusive_ with `externalLink`; `pivotDocId` is many-elements-to-one
record), lifecycle (a hyperlink is chosen from a search modal; a binding is
created by promotion, ADR 0007), consumers (an arrow that navigates vs. a hover
card and a rules engine), and reversibility semantics. Overloading
`linkedDocId` would silently break the "at most one is set" invariant asserted
in `docs/element-link-integration.md` and change the behaviour of the shipped
`edgeless-element-link` widget
(`packages/affine/widgets/edgeless-selected-rect/src/edgeless-element-link.ts:96,136-142`).

**Naming — session-architect arbitration, final call belongs to the approver.**
An earlier draft proposed the bare `docId`. It is withdrawn. `docId` is already
this repo's word for "the id of a document" in a _different_ sense —
`DocDisplayMetaExtension.icon(docId)` / `.title(docId)`
(`doc-display-meta-service.ts:48-58`) and ADR 0006's own
`properties$(docId: string)`. With `linkedDocId` sitting on the same class, a
bare `docId` reads as the general case of which `linkedDocId` is a
specialization — exactly backwards. `pivotDocId` makes `properties$(el.pivotDocId)`
self-documenting, and reads consistently against `PivotOccurrence` /
`isPivotBound` / `collectPivotOccurrences`.

The cost asymmetry decides it: before the first write the change is one
`git grep`; after it, there is **no migration runner in
`packages/framework/store` and no version tag that does anything**
(spike [#67](https://github.com/formicoidea/blocksuite-labre/pull/67) § 4). When
one branch of a naming decision is free and the other is unfixable, ambiguity
loses by default.

`PivotOccurrence` and `OccurrenceFacetPatch` (ADR 0006) use `pivotDocId` as
well — one spelling per concept. The single exception is
`PivotPropertiesService.properties$(docId)`, which keeps the bare parameter name
because that provider is generic over documents and does not presuppose a pivot
binding.

### 2. No version increment, no migration, no upgrade hook

Surface elements have no schema version, so there is nothing to increment. The
field is additive and absent-reads-`undefined`. **No migration code is
written, and none is needed.** This is the one respect in which the seam is
cheaper than the `externalSourceId` precedent.

### 3. Binding is synchronous and dependency-free

Setting the binding is exactly one `Y.Map` write inside the store transaction
already opened by the `@field()` setter (`field.ts:71-78`):

```ts
surface.updateElement(elementId, { pivotDocId });
store.captureSync(); // mandatory — see ADR 0007 § 6
```

`captureSync()` is **not optional**. `store.transact()` is not an undo
boundary: the `Y.UndoManager` is built with no `captureTimeout`
(`packages/framework/store/src/extension/history/history-extension.ts:22-24`),
so the Yjs default of 500 ms merges consecutive transactions. Without it, a bind
issued within 500 ms of a drag is undone _together with the drag_. Rationale and
the full rule are in ADR 0007 § 6.

**Hard rule:** the code path that binds an element MUST NOT `await` anything,
MUST NOT call `PivotPropertiesProvider`, and MUST NOT require the pivot record
to exist or be reachable. A binding to a record that does not (yet) exist is a
legal, persisted state; it resolves to `{ status: 'missing' }` at read time
(ADR 0006). Creating the record, if the gesture implies one, is the host's
concern and happens off the critical path.

Correspondingly `pivotDocId` participates in **no** `@derive`, `@convert` or
`@watch` chain and is read by **no** renderer. It cannot move, resize or
restyle anything.

### 4. Two _decision_ consumers, plus the library's own plumbing

Consumers that turn `pivotDocId` into something a user or a rule acts on —
**exactly two**:

1. **Hover / peek (host).** The hover card shows the element's own facts
   immediately and appends the pivot record's properties when — and only
   when — the host resolves them. Contract in ADR 0006.
2. **Rules engine, wave 3 (host).** Type-3 qualifications (ADR 0007) mirrored
   onto the bound record become _validation facts_ carrying the provenance
   `derived-from-occurrence`. The library supplies the facts; it evaluates no
   rule.

Library-internal readers, which decide nothing and render nothing — an
exhaustive list, extendable only by amending this ADR:

- `collectPivotOccurrences` and `isPivotBound` (§ 5), pure functions;
- `PivotFacetPublisher` (ADR 0006 § 4), which copies the id into an
  `OccurrenceFacetPatch` and forgets it.

The prohibition that matters is unchanged and absolute: **no renderer, no
hit-test, no layout, no exporter** may read `pivotDocId`. An earlier draft
phrased this as "exactly two consumers, no others", which the ADR's own § 5
violated on arrival; the rule is restated here so it is enforceable in review.

### 5. Backlinks are computed, never persisted

The library ships one pure, synchronous collector and nothing else:

```ts
// packages/framework/std/src/gfx/model/surface/pivot.ts
export type PivotOccurrence = {
  /** The bound pivot record. */
  pivotDocId: string;
  /** The surface element that is an occurrence of it. */
  elementId: string;
  /** Element type, e.g. 'shape' | 'wardleyNode' | 'edgyNode'. */
  elementType: string;
};

/** O(n) over the surface's elements. Allocates nothing persistent. */
export function collectPivotOccurrences(
  surface: SurfaceBlockModel
): PivotOccurrence[];

export type PivotBoundElement = GfxPrimitiveElementModel & {
  pivotDocId: string;
};
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
| Old document, new build | `yMap` has no `pivotDocId` key → the accessor reads `undefined` (`field.ts:52-58`). Unbound, exactly as today.                                                                                                                                                              |
| New document, old build | The key is present but no accessor declares it. Nothing reads it and nothing deletes it: `syncElementFromY` (`element-model.ts:567`) mirrors _every_ entry into `_preserved`, declared or not. Load / edit / save is lossless. **Except on duplicate & paste** — see below. |
| Concurrent edits        | One `Y.Map` key, scalar value → Yjs last-write-wins at key granularity. Two users binding the same element to different records converge on one; no corruption.                                                                                                             |
| Flags off               | `pivotDocId` lives on the base class in `@labre/std`, outside the flag registry. Documents carrying it open with every framework flag disabled.                                                                                                                             |
| Deleted pivot record    | The `pivotDocId` string survives on the element. Resolution yields `{ status: 'missing' }` (ADR 0006); nothing is cleaned up automatically — the library never deletes host data.                                                                                           |
| Deleted _element_       | The occurrence disappears from `collectPivotOccurrences` immediately. So that the record does not keep facets attributed to an occurrence that no longer exists, deletion publishes a retraction — ADR 0006 § 4.3.                                                          |
| Undo / redo of a bind   | Reverts the `Y.Map` key like any other field, and re-publishes, because the publisher is driven by local Yjs transactions rather than by the command layer — ADR 0006 § 4.1.                                                                                                |

**One cost, stated honestly — the other has since been removed.**

1. ~~Storage: one wasted `Y.Map` key per element.~~ **No longer true.** The
   first draft priced `@field()`'s `init()` at one key per element even when the
   value is `undefined`, and accepted it for symmetry with `externalLink` /
   `linkedDocId`. PR [#71](https://github.com/formicoidea/blocksuite-labre/pull/71)
   has since changed `init()` to return early on an `undefined` default
   (`decorators/field.ts`), so an optional field stays **absent** from the
   `Y.Map` until something actually assigns it. An element that never binds is
   byte-identical to one created before the field existed — which is precisely
   what lets the field ship with no version bump and no migration (§ 2). This
   ADR **depends on that behaviour**: `pivotDocId` MUST keep an `undefined`
   default and MUST NOT be given a non-`undefined` one, or the cost returns on
   every brush stroke.

   Note the corollary #71's review established: a key written and then cleared
   leaves a tombstone (`yMap.has('pivotDocId') === true`, value `undefined`).
   Absent and present-but-`undefined` are indistinguishable to the getter
   (`field.ts:52-58`), so this is inert — but it means "unbind" does not restore
   byte-identity, only semantic neutrality.

2. **Undeclared keys are dropped by element-creation-from-props, not by load.**
   This ADR does not re-derive the analysis: it is the subject of spike
   [#67](https://github.com/formicoidea/blocksuite-labre/pull/67), whose
   conclusions are adopted here in full.

   All losing paths funnel through `_createElementFromProps`
   (`surface-model.ts:168-173`), which replays props with
   `elementModel.model[key] = props[key]`; with no `@field()` accessor backing
   the key, the value lands on a plain JS own property and never reaches Yjs.
   The `@field()` set is a silent, de facto allow-list. **Five** user-visible
   paths, per #67:

   1. paste — `edgeless/clipboard/canvas.ts:97`
   2. duplicate — `edgeless/utils/clipboard-utils.ts:29-50`
   3. alt+drag clone — `interact-extensions/clone-ext.ts:11-23`
   4. turn-into-linked-doc — `toolbar/render-linked-doc.ts:94-95`
   5. `updateElement` called with an undeclared key

   #67 grades cross-document copy/paste **"NO-GO as-is for the edgeless
   clipboard"** (GO for the doc-snapshot path, which replays every key verbatim
   through `surface-transformer.ts`).

   **The residual risk is worse than "the copy is unbound", and #67 says so
   plainly:** the loss is _undetectable at the moment it happens_ — no
   exception, no warning, no telemetry. The pasted element carries the value as
   an in-memory JS property, so it **looks correct in the session and vanishes
   on reload**, and never existed for any other peer. The original keeps its
   binding, the copy does not, so a board drifts into a half-bound state with no
   user action that looks destructive; it surfaces weeks later when a framework
   view or an export silently under-reports.

   The hazard is nonetheless **transitional**, and #67's recommendation #1 is
   why: declaring the accessor on the **base class** makes duplicate/paste
   preserve it for every primitive type at once. #67's recommendation #4 —
   ship the declaration release _before_ any release that writes the field, so
   the fleet floor tolerates it — is adopted as a release-ordering constraint on
   this ADR's implementation, to be stated in its changeset.

   The three tests named `LOSS: …` in
   `packages/framework/std/src/__tests__/gfx/element-unknown-props.unit.spec.ts`
   and
   `packages/affine/blocks/surface/src/__tests__/surface-transformer-unknown-props.unit.spec.ts`
   are the executable record of this caveat. They assert today's undesirable
   behaviour on purpose; if a future change makes `_createElementFromProps`
   forward unknown keys, they fail, and that failure is the signal to update
   #67's spike document — not to weaken the tests.

## Consequences

- The binding gesture is one transaction and cannot be slowed, blocked or
  failed by the host's data layer. This is the invariant that makes the pivot
  record safe to introduce at all.
- The library gains **no** knowledge of what a pivot record is. Running
  standalone (playground, tests) with no provider registered, `pivotDocId` is inert
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
