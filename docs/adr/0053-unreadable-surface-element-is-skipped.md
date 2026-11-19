# ADR 0053 — An unreadable surface element is skipped, never fatal

- Status: **accepted** (2026-11-19)
- Deciders: the product owner set the acceptance criteria on issue #669 (the
  comment "The load guard: the behaviour Labre relies on").
- **Red zones**: none touched. The change lives in `packages/framework/std`
  (`SurfaceBlockModel`) and in the telemetry watcher of
  `packages/affine/shared`. Nothing persisted changes: no key, no schema, no
  default; the load writes nothing at all.
- Related: #318 (an element whose `xywh` never arrived, the first
  `SurfaceDamageReason`), ADR 0003 (telemetry bus and taxonomy), docs/lessons.md
  6 (content dropped silently on resave).

## Context

`SurfaceBlockModel._initElementModels` built one model per entry of the
surface's elements map, in the block's `created` subscriber, and
`_createElementFromYMap` threw `Invalid element type: …` for a map whose
`type` was missing or not registered. The throw ended the loop: the elements
after the bad one were never built, the ones before it were never mounted, and
the surface watchers (group cascade, emptiness, user layers) were never set up.
One bad element, and the canvas opened empty. A remote update carrying such an
element threw from the Yjs observer the same way.

Two writers produce such elements, and neither is hypothetical:

- **a newer client**: a release that adds an element type puts every older tab
  one sync away from an empty canvas;
- **a writer outside the editor** (an importer, the host's workspace connector,
  an agent): a value Yjs refuses mid-transaction leaves a map with some keys
  and no `type` (the write side of #669, out of scope here).

"Documents render everywhere, forever" (principle, CLAUDE.md) forbids both
outcomes.

## Decision

1. **Skip, do not fail.** An entry of the elements map is skipped, with no
   model, when it is not a map, has no string `type` or no non-empty string
   `id`, names a type this client does not register, or its model throws while
   being built. Every other element is built and mounted, and the watchers are
   set up. The same reading runs at load and in the elements-map observer, so
   a remote update takes the same path.
2. **Two in-memory reasons**, beside `missing-xywh`:
   - `unknown-type`: a string `type` this client does not register, which is
     most likely a newer client's;
   - `unreadable`: everything else (no type, no id, not a map, a model that
     threw), which is a corrupt or half-written element.
     They are kept apart because a host counts them: the first says "upgrade",
     the second says "a writer is broken". The damage record carries the
     elements-map key and the stored type when it is a string (`''` otherwise),
     never a prop value.
3. **Reported once.** The skipped element enters `damagedElements` and is
   pushed through `elementDamaged`, like `missing-xywh`. One `console.warn`
   per batch (a load, or one observer event), listing ids and reasons. A
   remote delete of a skipped element takes its record away.
4. **Left untouched.** Its `Y.Map` is not deleted, repaired or rewritten, and
   the load emits no Yjs update. A client that can read it still sees it.
5. **No repair of a late completion.** The elements-map observer is shallow: a
   `type` that lands inside a skipped map in a LATER transaction is not seen
   until the document is opened again. No mechanism is built for it.
6. **A canvas holding only skipped elements is not empty**: `isEmpty` counts
   the stored elements, not the models.
7. **Telemetry mirrors the reason.** `DocumentDamaged` widens its `reason` to
   `missing-xywh | unknown-type | unreadable`; the watcher sends one event per
   reason present in a batch. No new event, no new seam, no flag.
8. A missing `xywh` keeps its #318 behaviour: built, painted with a zero-size
   bound, reported as `missing-xywh`. It is not skipped.

## Consequences

- A newer client's element, or a half-written one, costs the reader that
  element only. The canvas opens, and the document keeps the element.
- `SurfaceDamageReason` gains two values. A host that `switch`es on it
  exhaustively sees a compile error at upgrade, which is the point; one that
  only counts it sees nothing.
- What a skipped element does NOT get, because it has no model. Each is a
  path the product owner may want followed up; none writes on load:
  - **Whole-document snapshot** (`SurfaceBlockTransformer.toSnapshot`,
    `blocks/surface/src/surface-transformer.ts:107`) serialises from the
    `Y.Map`, so the element survives an export / doc copy. A non-map value in
    the elements map would throw there (`:17`, `element.forEach`).
  - **Copy, duplicate, drag and frame templates** serialise from models
    (`blocks/root/src/edgeless/utils/clone-utils.ts:36`, `:145`;
    `widgets/drag-handle/src/middleware/blocks-filter.ts:31-33`;
    `blocks/frame/src/frame-template.ts:43`): a skipped child of a copied
    group is not copied, and a copied connector ending on it becomes a free
    end. The original stays in the document.
  - **Deleting a group** that lists a skipped child
    (`framework/std/src/gfx/model/surface/surface-model.ts`, `deleteElement`)
    deletes what this client can read; the skipped child stays in the map.
  - **A connector ending on a skipped element** gets no path
    (`gfx/connector/src/connector-watcher.ts:99-111` requires both ends) and
    is not drawn; nothing is written.
  - **A mindmap listing a skipped node** builds its tree with a `null`
    element for that node (`affine/model/src/elements/mindmap/mindmap.ts:391`,
    `:416`); a layout that reads the node's bound would throw. Not exercised
    here (the model package is a red zone).
- No placeholder is painted where a skipped element was (criterion 6 of the
  issue, optional).
