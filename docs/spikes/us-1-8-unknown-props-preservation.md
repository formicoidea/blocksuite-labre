# US-1.8 follow-up — preserving unknown surface element props

**Status:** implemented
**Scope:** red zone (`packages/framework/std` gfx element plumbing). Follow-up
to the spike recorded in [`us-1-8-role-field-compat.md`](./us-1-8-role-field-compat.md).
**Date:** 2026-08-01

## What the spike found

Q2/Q3 of the spike established that every _edit_ path on a gfx primitive
element preserves a prop the running element class does not declare (field
writes, stash/pop, undo/redo, `serialize()`, the surface snapshot
transformer) — but that two _bulk assignment_ sites in `SurfaceBlockModel`
silently dropped it:

- `_createElementFromProps` — paste, duplicate, alt-drag clone and
  "turn into linked doc";
- `updateElement` — a bulk update carrying a key the class does not declare.

Both sites copy incoming props by assigning them onto the element model
instance. Only a key backed by an `@field()` accessor reaches the Y.Map; an
unrecognised key became an ordinary JavaScript own property — readable in the
running tab, invisible to every peer, gone on reload. The `@field()` accessor
set was a _de facto_ allow-list, applied silently.

"Turn into linked doc" is the destructive case: it writes the lossy copy into
the new doc and then deletes the source, so nothing survives to recover from.

## What changed

Both sites now go through one helper,
`SurfaceBlockModel._assignElementProp`
(`packages/framework/std/src/gfx/model/surface/surface-model.ts`):

- a key the element class declares (any `@field()`, `@local()` or plain
  accessor — tested with `key in element`) still goes through that accessor,
  unchanged;
- a key the class does **not** recognise is written verbatim into the element's
  Y.Map instead of being dropped on the instance.

Both call sites already run the whole props object through `_propsToY` first,
which is key-agnostic, so the native→Y conversion (`Y.Text` / `Y.Map` wrapper
payloads) applies to unknown keys too. Values stay flat JSON, as the spike's
Q3 caveat 1 requires.

### Exclusions

A short deny-list (`UNSAFE_ELEMENT_PROP_KEYS`) is applied before both branches:

| Key                                     | Why                                                                                                                                                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`, `type`                            | The element identity. `_createElementFromProps` writes both explicitly and destructures them out of `rest`, but `updateElement` did not: `updateElement(id, other.serialize())` would otherwise stamp a stale identity into the document. Both are prototype getters, so the old code threw a `TypeError` instead. |
| `__proto__`, `constructor`, `prototype` | Prototype pollution. `__proto__` and `constructor` resolve on `Object.prototype`, so the `key in element` test alone would route them to the (pre-existing, unsafe) instance assignment; `prototype` is not `in` an instance at all and would have been forwarded to the Y.Map. They are dropped outright.         |

Deliberately **not** excluded: `index` and `seed`. Both are declared
`@field()` on `GfxPrimitiveElementModel`, so they already take the accessor
branch and their behaviour is unchanged.

## What this changes for users

The semantics of every paste, duplicate, alt-drag clone, "turn into linked
doc" and programmatic bulk update become **"preserve what we do not
understand"** — which is the Yjs contract everywhere else in this codebase,
including the surface snapshot transformer and every single-key field write.

Concretely, a client running an older version of the library can now copy an
element annotated by a newer one without silently stripping the annotation.
The board no longer drifts into a half-annotated state, and "turn into linked
doc" no longer destroys data.

The cost is that a caller passing a junk key to `addElement` / `updateElement`
now persists it. Every real call site was audited; the only offender was a dead
`controllers: []` in `packages/affine/gfx/connector/src/connector-tool.ts`,
removed in the same change. `applyLastProps`
(`packages/affine/shared/src/services/edit-props-store.ts`) is unaffected: the
props it merges underneath are zod-stripped at `recordLastProps` time, so it
cannot contribute an unknown key. Templates are unaffected too — the template
service writes through `SurfaceBlockTransformer.elementFromJSON`, which never
went through these two sites.

## No schema change

No block schema version bump, no migration, no new field. This only changes
which keys a bulk assignment forwards. Documents written before and after are
mutually loadable, exactly as Q1/Q4 of the spike concluded.

## Tests

`packages/framework/std/src/__tests__/gfx/element-unknown-props.unit.spec.ts` —
the three `LOSS:` tests the spike left behind are now preservation tests, plus:
preservation through "turn into linked doc" (the destructive path), through
`updateElement`, a `serialize` → `addElement` → `serialize` round trip that is
identical apart from the id, proof that a declared `@local()` prop still stays
out of the document, and proof that prototype-polluting keys and a forged
`id`/`type` never reach the Y.Map.
