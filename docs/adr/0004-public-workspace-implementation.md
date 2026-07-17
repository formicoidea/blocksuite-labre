# ADR 0004 — Public production `Workspace` (`WorkspaceImpl`) exported from the library

- Status: accepted (July 2026)
- Deciders: Mathieu Jolly (with the labreapp team, via issue #58)

## Context

The only class implementing `Workspace` was `TestWorkspace`, marked
`@internal / do not use in production` and reachable only from the
`@labre/store/test` subpath. The production app (labreapp) therefore built its
workspace on a test class and aliased its public `EditorCollection` type to an
`@internal` symbol imported from a test entry point (issue #58).

Upstream AFFiNE has the **same** situation inside `blocksuite/`: the only
`Workspace` impl there is `TestWorkspace`; the production impl (`WorkspaceImpl`)
lives in the **app** layer (`packages/frontend/core`), not in the `store`
package. Mirroring upstream literally would mean labreapp reimplements the
workspace plumbing (`DocImpl`, `WorkspaceMetaImpl`, engine wiring) itself.

Upstream's `WorkspaceImpl` is also **sync-agnostic**: the root `Y.Doc` is
injected and sync is delegated to the app through `onLoadDoc`/`onLoadAwareness`/
`onCreateDoc` callbacks. labreapp does not work that way — it lets the
workspace create its own `Y.Doc` and wires persistence + realtime **externally,
on the raw `Y.Doc`s**, never touching the internal sync engine (confirmed by
grep on the app in #58).

## Decision

Deviate from upstream's app-side placement: export a public, **self-contained**
`WorkspaceImpl` from the `@labre/store` main entry (and thus `@labre/affine/store`).

- Self-contained (creates its own `Y.Doc`, internal engines) rather than
  upstream's injected-`rootDoc` form, because labreapp consumes exactly that
  surface and wires sync itself on the `Y.Doc`s. The internal sync engines
  default to in-memory no-ops.
- `WorkspaceImpl` (public) and `TestWorkspace` (`store/test`) are independent
  siblings of an internal `WorkspaceBase`; neither extends the other, so
  test-only evolutions never reach production.
- `TestWorkspace` stays under `store/test`; the doc/meta impls move to
  `store/src/impls/` with backward-compatible re-export shims so existing
  test/playground imports are unchanged.

The rationale for deviating (thin app consuming npm packages) is the same one
recorded in [ADR 0001](0001-assumed-divergence-from-upstream.md): we own this
code and specialize the library rather than keeping plumbing in the app.

## Consequences

- The app-side switch is one line (`import { WorkspaceImpl } from '@labre/store'`
  - type alias + constructor); no production code imports from `store/test`.
- The internal sync engines are inert by default — a consumer that does not
  wire persistence on the exposed `Y.Doc`s (`.doc`, `getDoc(...).spaceDoc`), or
  pass real `docSources`/`blobSources`, gets an in-memory-only workspace. This
  is documented on the class and in the store README.
- This is a deliberate divergence from upstream (they would cherry-pick a
  workspace impl into the app layer; we own it in the library). Noted for the
  periodic upstream-diff check so it is not mistaken for drift.
