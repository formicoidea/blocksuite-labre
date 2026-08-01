# ADR 0006 — `PivotPropertiesProvider`: the injectable `docId` → properties seam

- Status: **proposed** (August 2026) — requires human approval.
- Deciders: Mathieu Jolly
- Milestone: "PF+MF" refoundation, Jalon 0 (contract seams)
- Companion ADRs: [0005](0005-element-docid-seam.md) (where the `docId` comes
  from), [0007](0007-universe-tag-defs-format.md) (what gets mirrored onto the
  record). The three form **one contract, frozen together**.

## Context

ADR 0005 gives a surface element an optional `docId` pointing at a host-owned
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
  (`telemetry-service/block-lifecycle-watcher.ts:131-133`). Same shape for
  `NotificationProvider` (`notification-service.ts:53-76`).
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

export interface PivotPropertiesService {
  /**
   * MUST return synchronously and MUST NOT throw. The returned signal may
   * start at `loading` and settle later; the library never awaits it.
   * Caching, deduplication, revalidation and cancellation are the host's
   * business.
   */
  properties$(docId: string): ReadonlySignal<PivotQueryState>;

  /**
   * Optional zero-cost cache peek, for cases where the library wants to avoid
   * even a `loading` flash. Must be O(1) and side-effect free.
   */
  peek?(docId: string): PivotSnapshot | undefined;

  /** See § 4. Fire-and-forget; returns `void`, deliberately not a Promise. */
  publishOccurrenceFacets?(patch: OccurrenceFacetPatch): void;
}

export const PivotPropertiesProvider = createIdentifier<PivotPropertiesService>(
  'LabrePivotPropertiesService'
);

export function PivotPropertiesExtension(
  service: PivotPropertiesService
): ExtensionType {
  return {
    setup: di => {
      di.override(PivotPropertiesProvider, () => service);
    },
  };
}
```

`properties$` returning a signal **synchronously** is the load-bearing part of
this ADR: it makes it structurally impossible for a call site to block. There is
no `Promise`-returning method on the read path, so no call site can `await` one.

### 2. Two-speed hover, and the speeds never mix

| Speed                    | Source                    | Timing                        | Content                                                                          |
| ------------------------ | ------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| **1 — element facts**    | The element itself        | Synchronous, always, zero I/O | Label, element type, universe, role, type-3 tags (ADR 0007), whether it is bound |
| **2 — pivot properties** | `PivotPropertiesProvider` | Asynchronous, optional        | `PivotSnapshot.title` + `properties[]`                                           |

Rules:

- Speed 1 renders **immediately, unconditionally**, and is complete on its own.
  It is never a placeholder for speed 2 and never shows a spinner.
- Speed 2 is **appended below** speed 1. Speed-1 content must not move when
  speed 2 settles. No reserved empty space, no skeleton the size of a guess.
- `loading` renders nothing for at least `PIVOT_HOVER_SKELETON_DELAY_MS = 200`;
  a fast host is invisible.
- `missing` / `error` render one discreet line. They never surface a host stack
  trace and never block dismissal of the card.
- The hover card is dismissible at all times regardless of query state.

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
export type OccurrenceFacetPatch = {
  /** The bound pivot record. */
  docId: string;
  /** Where the qualification was authored. */
  elementId: string;
  /** Universe id, e.g. 'wardley'. */
  universe: string;
  /** Role id, e.g. 'wardley:component'. `undefined` once the role is cleared. */
  role: string | undefined;
  /** Type-3 tags: tag def id -> selected value ids. Empty = cleared. */
  tags: Record<string, string[]>;
};
```

- Returns `void`. The library cannot await it, cannot retry it, cannot observe
  its failure. A host that throws inside it breaks only itself — call sites wrap
  it in `try {} catch {}` and swallow.
- Provenance is **fixed** at `derived-from-occurrence` and is not a parameter.
  The host must not merge these into authored properties, and must not write
  back into the element.
- **Unidirectional.** There is no reverse channel. A change on the record never
  mutates an element. If a record and its occurrences disagree, the occurrence
  is the truth for the element and the record is the truth for the record; the
  library reconciles nothing.

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
  `publishOccurrenceFacets` are optional members; `PivotPropertyValue` is a
  discriminated union that consumers must handle exhaustively **with a default
  branch** (an unknown `kind` renders as nothing, never throws), so new value
  kinds can be added without breaking an older host or an older library.

## Consequences

- The host's latency budget is decoupled from the editor's. There is no timeout
  to tune in the library because there is nothing to time out.
- The provider is testable in isolation: a fake returning
  `signal({ status: 'ready', snapshot })` is three lines.
- Two things now consume `docId` (ADR 0005 § 4): this provider, and the wave-3
  rules engine. The rules engine reads the same `PivotProperty[]`, so facts and
  hover display cannot diverge.
- The library gains a vocabulary (`PivotPropertyValue`) it must keep stable.
  Adding a value kind is cheap; changing one is a breaking change for every
  host. Reviewers should treat this union as public API.
- Rejected: a `Promise`-returning `getProperties(docId)`. It reads more
  naturally and is exactly why it is dangerous — every call site becomes a
  place where someone can add an `await` in front of a gesture.
- Rejected: letting the host supply a renderer for the pivot section. It would
  be convenient and it would end the "the library never renders the record"
  invariant on the first sprint that needs a custom widget.
