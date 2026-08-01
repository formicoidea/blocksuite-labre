# ADR 0006 — `PivotPropertiesProvider`: the injectable `pivotDocId` → properties seam

- Status: **proposed** (August 2026) — requires human approval.
- Deciders: Mathieu Jolly
- Milestone: "PF+MF" refoundation, Jalon 0 (contract seams)
- Companion ADRs: [0005](0005-element-docid-seam.md) (where the `pivotDocId` comes
  from), [0007](0007-universe-tag-defs-format.md) (what gets mirrored onto the
  record). The three form **one contract, frozen together**.

## Context

ADR 0005 gives a surface element an optional `pivotDocId` pointing at a host-owned
**pivot record**. Something must turn that string into something a user can see
on hover — without the library ever learning what a pivot record is, and without
the host's data layer ever getting between the user and their gesture.

The library already has a well-worn seam for exactly this shape of problem, in
three flavours (`packages/affine/shared/src/services/`):

- **Pure host seam, no default** — `TelemetryProvider`
  (`telemetry-service/telemetry-service.ts:66-78`): `createIdentifier` + a
  `XExtension(service)` factory calling `di.override`. Consumers resolve with
  `std.getOptional(...)` and optional-chain
  (`packages/affine/blocks/latex/src/commands.ts:58`), or guard and return
  (`telemetry-service/block-lifecycle-watcher.ts:131-133`). Same _seam_ shape
  for `NotificationProvider` (`notification-service.ts:53-76`) — though
  `NotificationExtension` registers with `di.addImpl`
  (`notification-service.ts:62`) where `TelemetryExtension` uses `di.override`
  (`telemetry-service.ts:75`). The distinction is not cosmetic: ADR 0007 § 3's
  idempotency argument rests entirely on it.
- **In-lib default that hosts may override** — `DocModeService`
  (`doc-mode-service.ts:66-69`), `DocDisplayMetaService`
  (`doc-display-meta-service.ts:63-87`).
- **Presence used as a feature toggle** — `QuickSearchProvider`; the edgeless
  "Link" menu item is hidden when it is absent
  (`packages/affine/blocks/root/src/edgeless/configs/toolbar/more.ts:469`,
  documented in `docs/element-link-integration.md`).

The closest existing neighbour is `DocDisplayMetaExtension`
(`doc-display-meta-service.ts:48-61`), which maps a `docId` to a title and an
icon. Two things about it are worth copying and one is worth _not_ copying:

```ts
export interface DocDisplayMetaExtension {
  icon: (
    docId: string,
    referenceInfo?: DocDisplayMetaParams
  ) => ReadonlySignal<TemplateResult>;
  title: (
    docId: string,
    referenceInfo?: DocDisplayMetaParams
  ) => ReadonlySignal<string>;
}
```

Copy: **it returns synchronously**, and it returns a `ReadonlySignal` rather
than a value or a `Promise` — the caller binds it into Lit and the answer
arrives later without anyone awaiting anything. Do not copy: it returns
`TemplateResult`, i.e. the host hands the library rendered markup. That is
exactly what we must forbid here.

Also relevant: `linked-doc-content-service.ts` is the repo's most recent
fork-added seam and already documents the "degraded preview instead of spinning
forever" posture; and `user-service/user-service.ts` is the existing template
for _remote_ id → info with `userInfo$` / `isLoading$` / `error$` signals.

## Decision

### 1. One optional provider, in `@labre/affine-shared/services`

New file `packages/affine/shared/src/services/pivot-properties-service.ts`,
re-exported from `services/index.ts`.

```ts
import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';
import type { ReadonlySignal } from '@preact/signals-core';

/** Typed, render-free property values. No markup, ever. */
export type PivotPropertyValue =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number; unit?: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'date'; value: string } // ISO-8601
  | { kind: 'tags'; value: string[] }
  | { kind: 'user'; value: { id: string; name: string } }
  | { kind: 'ref'; value: { docId: string; label?: string } };

export type PivotProperty = {
  /** Stable, host-defined key. Used for ordering and diffing, not display. */
  key: string;
  /** Display label, already localized by the host. */
  label: string;
  value: PivotPropertyValue;
  /**
   * Where the value came from. `derived-from-occurrence` marks properties the
   * host wrote back from a board occurrence (see § 4); the library renders
   * them distinctly and never lets the user edit them here.
   */
  provenance?: 'authored' | 'derived-from-occurrence';
};

export type PivotSnapshot = {
  docId: string;
  title: string;
  /** Host-ordered. The library preserves the order and does not sort. */
  properties: PivotProperty[];
};

export type PivotQueryState =
  | { status: 'loading' }
  | { status: 'ready'; snapshot: PivotSnapshot }
  /** The binding is dangling: record deleted, or not visible to this user. */
  | { status: 'missing' }
  | { status: 'error'; reason?: string };

/** Which properties the hover popup asks for. See § 1bis. */
export type PivotPropertiesConfig = {
  /**
   * Property keys the hover popup displays, in this order. The provider MUST
   * load and return ONLY these.
   * `[]` disables speed 2 entirely while keeping the provider registered.
   */
  hoverFields: readonly string[];
};

export interface PivotPropertiesService {
  /**
   * MUST return synchronously and MUST NOT throw. The returned signal may
   * start at `loading` and settle later; the library never awaits it.
   * Caching, deduplication, revalidation and cancellation are the host's
   * business — `fields` is part of the cache key.
   *
   * `fields` is the configured list, passed explicitly on every call. The
   * provider MUST NOT load, compute or return properties outside it.
   */
  properties$(
    pivotDocId: string,
    opts: { fields: readonly string[] }
  ): ReadonlySignal<PivotQueryState>;

  /**
   * Optional zero-cost cache peek, for cases where the library wants to avoid
   * even a `loading` flash. Must be O(1) and side-effect free.
   */
  peek?(
    pivotDocId: string,
    opts: { fields: readonly string[] }
  ): PivotSnapshot | undefined;

  /** See § 4. Fire-and-forget; returns `void`, deliberately not a Promise. */
  publishOccurrenceMaterialities?(patch: OccurrenceMaterialityPatch): void;
}

export const PivotPropertiesProvider = createIdentifier<PivotPropertiesService>(
  'LabrePivotPropertiesService'
);

export const PivotPropertiesConfigIdentifier =
  createIdentifier<PivotPropertiesConfig>('LabrePivotPropertiesConfig');

export function PivotPropertiesExtension(
  service: PivotPropertiesService,
  config: PivotPropertiesConfig
): ExtensionType {
  return {
    setup: di => {
      di.override(PivotPropertiesProvider, () => service);
      di.override(PivotPropertiesConfigIdentifier, () => config);
    },
  };
}
```

**Both** methods are called inside `try {} catch {}` by the library, and a
throw is treated as `{ status: 'error' }` (for `properties$`) or swallowed (for
`publishOccurrenceMaterialities`). The `MUST NOT throw` on `properties$` is a contract
for hosts, not an assumption the library is entitled to make: it sits on the
hover path, and an unguarded MUST NOT there is one bad host build away from
crash-on-hover.

`properties$` returning a signal **synchronously** is the load-bearing part of
this ADR: it makes it structurally impossible for a call site to block. There is
no `Promise`-returning method on the read path, so no call site can `await` one.

### 1bis. The popup content is host-configured, and that is a performance contract

The hover popup's content is **not** fixed by the library. The host declares
which properties it wants, and the provider does work for those only.

**Form: configured at injection, passed explicitly on every call.** Both halves
are deliberate.

_Configured at injection_ (`PivotPropertiesExtension(service, config)`) because
that is where this repo already puts host configuration — the same shape as
`NotificationExtension(service)` and `TelemetryExtension(service)`. The host
decides its popup once, at wiring time; no lib-side call site has to know the
field list, and no per-element or per-hover plumbing carries it.

_Passed explicitly to `properties$`_ rather than left for the provider to read
from its own config, because:

- **The cache key must be complete.** The provider is told to cache and dedupe
  (§ 1). If `fields` were implicit, a config change would silently serve a
  stale snapshot computed for a different field set. `(pivotDocId, fields)` is
  the honest key.
- **It keeps `properties$` a pure function of its arguments** — testable with a
  literal, with no container in the test.
- **It leaves room for a second surface** to request a different set later
  without a second provider registration or a breaking signature change.

The config is resolved with `std.getOptional(PivotPropertiesConfigIdentifier)`
like everything else here. Absent config with a provider present is a host
wiring error, not a crash: it degrades to `hoverFields: []`, which means speed 1
only — the same behaviour as no provider at all (§ 3).

**The performance contract, stated as an obligation on the provider:**

- The provider **MUST NOT** load, compute, join or return properties outside
  `fields`. This is the whole point: a pivot record may carry dozens of
  properties, several of them expensive (rollups, permissions-filtered
  relations), and a hover must not pay for what it will not draw.
- Unknown or unauthorized keys in `fields` are **skipped silently** — the
  provider returns the subset it can supply. It never errors, never returns a
  placeholder row, and never blocks the rest.
- `hoverFields: []` means the library **does not call `properties$` at all**.
  Not "calls it and ignores the answer" — no call, no request, no work. This is
  the deliberate opt-out for hosts that want the hover to stay purely local.
- Ordering is the host's: the library renders `properties[]` in the order the
  provider returns it and does not sort (§ 1, `PivotSnapshot`). `hoverFields`
  order is the requested order; a provider that reorders is within its rights
  and the library will not second-guess it.

**This is also what bounds speed 2 of the two-speed hover.** § 2 guarantees that
speed 1 never waits on speed 2, which protects _latency_. Field selection
protects _cost_: without it, "the async complement is off the critical path"
would still let a hover trigger an unbounded fan-out on the host's data layer
for properties nobody displays. The two mechanisms are complementary, and
neither substitutes for the other.

### 2. Two-speed hover, and the speeds never mix

| Speed                    | Source                    | Timing                        | Content                                                                           |
| ------------------------ | ------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| **1 — element facts**    | The element itself        | Synchronous, always, zero I/O | Label, element type, framework, role, type-3 tags (ADR 0007), whether it is bound |
| **2 — pivot properties** | `PivotPropertiesProvider` | Asynchronous, optional        | `PivotSnapshot.title` + `properties[]`, restricted to `hoverFields` (§ 1bis)      |

Rules:

- Speed 1 renders **immediately, unconditionally**, and is complete on its own.
  It is never a placeholder for speed 2 and never shows a spinner.
- Speed 2 is **appended below** speed 1. Speed-1 content must not move when
  speed 2 settles. No reserved empty space, no skeleton the size of a guess.
- `loading` renders **nothing at all** for the first
  `PIVOT_HOVER_LOADING_DELAY_MS = 200`, so a fast host is invisible. Past that
  threshold it renders **one single-line "Loading…" row appended below speed 1** —
  fixed height, no reserved block, no shimmer, nothing sized to a guess about
  the answer. (The constant was previously named `…_SKELETON_…`, for a skeleton
  this same rule forbids.)
- `missing` / `error` replace that row with one discreet line. They never
  surface a host stack trace and never block dismissal of the card.
- The hover card is dismissible at all times regardless of query state.

Speed 1 reads `role` and `tags` straight off the element, so it is a pure
function of data already in memory — no `getOptional`, no provider, no
possibility of a slow path.

Speed 2 is skipped entirely — no call, no `loading` row — when `hoverFields` is
empty or no config is registered (§ 1bis). In that state the popup is
speed 1 only and is indistinguishable from the no-provider case below.

### 3. Degradation when the provider is absent

Every call site uses `std.getOptional(PivotPropertiesProvider)` — the pattern
already used for `TelemetryProvider`, `NotificationProvider`,
`DatabaseDataSourceProvider` (`database-block.ts:165`) and `PeekViewProvider`.
With no provider registered:

- Hover shows speed 1 only. No spinner, no empty "Properties" section, no error.
- Any affordance whose _only_ purpose is to reach the record (e.g. "Open
  record") is **hidden**, not disabled — the `QuickSearchProvider` precedent.
- Binding, unbinding and type-3 qualification all keep working. They are
  element-local writes and do not need the host (ADR 0005 § 3).

**No noop default is registered.** Unlike telemetry — where a noop keeps the bus
uniformly wired — absence here is a _meaningful_ state (standalone playground,
tests, a labreapp build that failed to register). Making it the tested default
keeps the degraded path honest. `PivotPropertiesExtension` remains the only way
in.

### 4. The write-back is one-way, typed, and cannot block

The library never writes to the pivot record. When type-3 qualification changes
on a bound element (ADR 0007), it _announces_ it and forgets:

```ts
export type OccurrenceMaterialityPatch = {
  /** The bound pivot record. */
  pivotDocId: string;
  /** Which occurrence this patch describes. The host's primary key, with pivotDocId. */
  elementId: string;
  /**
   * Framework identity — `FrameworkId` from ADR 0008.
   *
   * **Amended 2026-08-02 (MF3 implementation, PR #92): OPTIONAL.** ADR 0007 § 6
   * states that no rung of the ladder requires the previous one, so a plain
   * rectangle bound to a pivot record — no role at all — is a legal state that
   * belongs to no framework. A required field would oblige the library to
   * invent an identity, which is precisely what taking `FrameworkId` from
   * ADR 0008 exists to stop. Same amendment, same argument and same date as
   * ADR 0007 § 7's on the twin telemetry field. Absent rather than
   * `'unknown'`, per the repo convention.
   */
  framework?: FrameworkId;
  /** Role id, e.g. 'wardley:component'. `undefined` once the role is cleared. */
  role: string | undefined;
  /**
   * Type-3 tags: tag def id -> selected value ids. `{}` = cleared.
   * A plain object on purpose: this is a transport DTO, not the persisted
   * shape. On the element the same data is a nested `Y.Map<string[]>`
   * (ADR 0007 § 4) so that concurrent qualification merges per tag; the patch
   * is a flattened snapshot of it, produced with `.toJSON()`.
   */
  tags: Record<string, string[]>;
  /**
   * `false` = this occurrence no longer exists (element deleted, or unbound).
   * The host must drop every derived materiality keyed by (pivotDocId, elementId).
   * When `false`, `role` is `undefined` and `tags` is `{}`.
   */
  present: boolean;
};
```

Baseline properties, unchanged from the first draft: the method returns `void`
(the library cannot await it, retry it, or observe its failure); provenance is
**fixed** at `derived-from-occurrence` and is not a parameter; and the channel
is **unidirectional** — a change on the record never mutates an element, and
the library reconciles nothing.

What follows are the four points the first draft left unspecified. They are the
only part of this contract that crosses the boundary, and they are the hard
part.

#### 4.1 The trigger: local Yjs transactions, not the setter and not the command layer

Publication is performed by **one** library-side `LifeCycleWatcher`,
`PivotMaterialityPublisher`, and by nothing else. It subscribes to surface element
add / update / remove and publishes **only when the change payload carries
`local === true`** (`local: transaction.local`, `element-model.ts:562`).

Two candidate designs are rejected, both for concrete reasons:

- **Not the `@field()` setter** (`field.ts:59-88`). The setter runs only on a JS
  assignment. Undo/redo and every remote peer's change arrive through
  `model.yMap.observe(...)` in `syncElementFromY` (`element-model.ts:540-580`)
  and never touch it. Publishing from the setter means: qualify a bound element,
  press Ctrl+Z, and the element reverts while the record keeps the derived
  materiality — a silent, permanent desync on the very first undo.
- **Not the command / action layer.** Same defect for the same reason: undo is
  not a command, so the desync survives. (This was the shape an earlier
  iteration of this ADR was directed toward; it is rejected here on the undo
  case, and the arbitration is flagged for the approver.)

Gating the observer on `local` is what makes the observer route correct rather
than merely implementable:

| Event                           | `local` | Publishes?                               |
| ------------------------------- | ------- | ---------------------------------------- |
| Author qualifies an element     | `true`  | Yes, on the authoring client only        |
| Author presses Ctrl+Z / Ctrl+Y  | `true`  | Yes — this is what fixes the undo desync |
| Remote peer receives the change | `false` | No                                       |

Because `_onChange` is also invoked directly on the stash/pop path
(`element-model.ts:321-329`, with `local: true`), one user gesture can produce
several payloads for the same element. The publisher therefore **coalesces per
`elementId` within one microtask** and publishes the element's _current full
state_, never a delta.

> **Amended 2026-08-02 (MF3 implementation, PR #92).** Two properties the
> original text left implicit, both load-bearing in practice:
>
> - **Elements already on the surface at mount are NOT published.** They are not
>   a local change, and republishing a whole board on every editor open would
>   flood the host with patches it already holds. Resynchronisation is the
>   rebuild path of § 4.2 (`collectPivotOccurrences`), deliberately, because it
>   is the one that cannot drift.
> - **De-duplication is on the patch, not only on the microtask.** The publisher
>   keeps the last fingerprint per `(pivotDocId, elementId)` and drops a patch
>   identical to it. Coalescing alone does not stop a drag from re-announcing an
>   unchanged qualification once per frame; patches being full-state and
>   idempotent is what makes dropping the repeat safe.

#### 4.2 Multi-client de-duplication

Exactly one client publishes per change: the one whose Yjs transaction it is.
There is no leader election, no lock and no acknowledgement — `local` already
partitions the fleet into exactly one publisher and N−1 silent observers.

Patches are **full-state and idempotent**: replaying the same patch twice, or
publishing a state the host already holds, converges. This is what makes the
`void`, unobservable return type survivable.

The channel is therefore **best-effort and eventually consistent**, and the ADR
says so rather than pretending otherwise: if the authoring client is offline
from the host at that moment, the patch is lost, and the record stays stale
until the next local change to that element. The safety net is that the
**element is always the source of truth** — a host can rebuild every derived
materiality at any time by scanning occurrences with `collectPivotOccurrences`
(ADR 0005 § 5). Derived materialities are a cache of the boards, never a second
original.

#### 4.3 Occurrence deletion — no orphaned materialities

Deleting a bound, qualified element changes no tag, so a change-driven design
would publish nothing and the record would keep materialities attributed to an
occurrence that no longer exists. "The library never deletes host data" would
quietly become "the library leaks host data".

The publisher therefore emits a **retraction** — `present: false`, `role:
undefined`, `tags: {}` — on each of:

- the element being removed from the surface;
- its `pivotDocId` being cleared (unbind);
- its `pivotDocId` being changed (retraction for the old record, followed by a
  normal patch for the new one).

The host drops every derived materiality keyed by `(pivotDocId, elementId)`. Authored
properties are untouched — a retraction is not a record deletion.

Deleting the whole _document_ is out of the library's reach: no local
transaction on the surface ever fires. That case is the host's, and the rebuild
path in § 4.2 is its remedy.

#### 4.4 N occurrences → 1 record

ADR 0005 § 1 makes many-elements-to-one the whole point, and duplicate/paste
trivially produces two elements carrying the same `pivotDocId` on the same
board. The rule:

- Derived materialities are stored **per occurrence**, keyed by
  `(pivotDocId, elementId)` — that is why `elementId` is in the patch and why
  § 4.3 can retract precisely.
- The record's derived view is the **union over live occurrences, each
  attributed to its `elementId`**. Two occurrences whose tags disagree
  **coexist as two attributed contributions**; neither overwrites the other.
- The library **never merges them, never picks a winner, and never observes the
  result**. Presenting a divergence — or flagging it as a finding — is the
  wave-3 rules engine's job, and it is precisely the kind of fact that engine
  exists to surface.

This is the reason `elementId` is not an optional diagnostic field: without it
the contract has no answer for its own headline case.

### 5. The library never renders the pivot record

Enforced structurally: `PivotSnapshot` carries **no** `TemplateResult`, no HTML
string, no component reference — a deliberate divergence from
`DocDisplayMetaExtension`, which does return `TemplateResult`.

Concretely the library MAY render a compact, read-only key/value list of
`PivotProperty` inside its own hover card. It MUST NOT render the record's own
layout, MUST NOT offer editing affordances for record-owned data, and MUST NOT
navigate. Opening the record reuses the existing seam rather than inventing one:
`RefNodeSlotsProvider.docLinkClicked` from `@labre/affine-inline-reference`,
already the documented route for element links
(`docs/element-link-integration.md`), or `PeekViewProvider`
(`packages/affine/components/src/peek/service.ts`) where a peek is wanted.

## Compatibility

- **Purely additive.** New file, new identifier, no existing signature changes,
  no document format change. Nothing in `packages/framework/store` or `sync` is
  touched.
- **Documents are unaffected.** Nothing this ADR describes is persisted. A
  document written with a provider registered is byte-identical to one written
  without.
- **Standalone (playground, unit tests) is the default path** — no provider,
  speed 1 only.
- **Flags.** The seam sits in `@labre/affine-shared`, outside the
  `OPTIONAL_BLOCKS` registry (`packages/affine/all/src/flags.ts`). Every
  document opens and saves whatever the flag state; flags gate the _tooling_
  that offers to bind, never the ability to load a bound document.
- **Forward-compatible interface evolution.** `peek` and
  `publishOccurrenceMaterialities` are optional members; `PivotPropertyValue` is a
  discriminated union that consumers must handle exhaustively **with a default
  branch** (an unknown `kind` renders as nothing, never throws), so new value
  kinds can be added without breaking an older host or an older library.
- **`hoverFields` is host data, not a lib enum.** The library never validates a
  key against a list it owns, so a host can add a property to its records and
  surface it in the popup with a config change and no library release. The
  contract is only that unknown keys are skipped silently (§ 1bis).

## Consequences

- The host's latency budget is decoupled from the editor's. There is no timeout
  to tune in the library because there is nothing to time out.
- The provider is testable in isolation: a fake returning
  `signal({ status: 'ready', snapshot })` is three lines.
- Two things now _decide_ on `pivotDocId` (ADR 0005 § 4): this provider, and the wave-3
  rules engine. The rules engine reads the same `PivotProperty[]`, so facts and
  hover display cannot diverge.
- The library gains a vocabulary (`PivotPropertyValue`) it must keep stable.
  Adding a value kind is cheap; changing one is a breaking change for every
  host. Reviewers should treat this union as public API.
- The popup's cost is now bounded by configuration rather than by convention.
  A host that adds an expensive rollup to its pivot records does not slow every
  hover in the product unless it also adds the key to `hoverFields`.
- Rejected: a `Promise`-returning `getProperties(pivotDocId)`. It reads more
  naturally and is exactly why it is dangerous — every call site becomes a
  place where someone can add an `await` in front of a gesture.
- Rejected: letting the library pick a default `hoverFields` (say, "the first
  five"). The library does not know which properties are cheap, which are
  meaningful, or which the user is allowed to see. A wrong default here is a
  performance regression the host cannot opt out of; requiring the config is
  the honest cost.
- Rejected: per-call field selection chosen by the lib-side hover card. The
  library has no basis for deciding what the host's popup should contain, and
  it would put the field list in every call site instead of one wiring point.
- Rejected: letting the host supply a renderer for the pivot section. It would
  be convenient and it would end the "the library never renders the record"
  invariant on the first sprint that needs a custom widget.
