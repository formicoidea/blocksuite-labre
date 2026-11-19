# ADR 0053 — An unreadable surface element is skipped, never fatal

- Status: **accepted** (2026-11-19)
- Deciders: the acceptance criteria of issue #669 (comment by the Labre V2
  release session, "The load guard: the behaviour Labre relies on"); two
  declared deviations from them below, the identity one to be confirmed by
  the product owner.
- **Red zones**: none touched. The change lives in `packages/framework/std`
  (`SurfaceBlockModel`, the `@observe` decorator) and in the telemetry watcher
  of `packages/affine/shared`. Nothing persisted changes: no key, no schema,
  no default; the load writes nothing at all.
- Related: #318 (an element whose `xywh` never arrived, the first
  `SurfaceDamageReason`), #681 (elements stored without `id`), ADR 0003
  (telemetry bus and taxonomy), ADR 0031 (why layers are not an element type),
  docs/lessons.md 6 (content dropped silently on resave).

## Context

`SurfaceBlockModel._initElementModels` built one model per entry of the
surface's elements map, in the block's `created` subscriber, and
`_createElementFromYMap` threw `Invalid element type: …` for a map whose
`type` was missing or not registered. The throw ended the loop: the elements
after the bad one were never built, the ones before it were never mounted, and
the surface watchers (group cascade, emptiness, user layers) were never set up.
One bad element, and the canvas opened empty. A remote update carrying such an
element threw from the Yjs observer the same way. A model that built but whose
MOUNT threw (an observer or `onCreated` choking on the map, e.g. a `mindmap`
whose `children` hold a `null` node) did the same.

Two writers produce such elements, and neither is hypothetical:

- **a newer client**: a release that adds an element type puts every older tab
  one sync away from an empty canvas;
- **a writer outside the editor** (an importer, the host's workspace connector,
  an agent): a value Yjs refuses mid-transaction leaves a map with some keys
  and no `type` (the write side of #669, out of scope here).

Separately, the model took its id from the stored `id` prop while every lookup
(`_elementModels`, `getElementById`) is by the element's key in the map. An
element stored without `id` (#681: a template JSON written by `snapshotToDoc`
as is) got `model.id === undefined`; it painted, but its first `elementAdded`
or `elementUpdated` reached `GridManager` with `getElementById(undefined)`.

"Documents render everywhere, forever" (principle, CLAUDE.md) forbids all of
these outcomes.

## Decision

1. **Identity is the key.** A model is built with its key in the elements map
   as its id, at load and in the observer, whatever the stored `id` says
   (absent, not a string, empty, different). Nothing is written: the stored
   `id` stays as it was.
2. **Skip, do not fail.** An entry is skipped, with no model, when its value
   is not a map, its `type` is absent or not a string, its type is not
   registered, or its model throws while being built or MOUNTED. A failed mount
   is undone (`unmount`, itself guarded; the `@observe` teardown is registered
   before the observers start, so the ones started before the throw are
   detached). Every other element is built and mounted, and the watchers are
   set up. The same reading runs at load and in the elements-map observer, for
   any value a remote update adds, `null` included.
3. **Two in-memory reasons**, beside `missing-xywh`:
   - `unknown-type`: a string `type` this client does not register, most
     likely a newer client's;
   - `unreadable`: no string `type`, not a map, or a model whose construction
     or mount threw; a corrupt or half-written element.
     They are kept apart because a host counts them: the first says "upgrade",
     the second says "a writer is broken". The damage record carries the
     element's key and the stored type when it is a string (`''` otherwise),
     never a prop value and never the error.
4. **Every damage record is keyed by the element's key**, `missing-xywh`
   included, and a delete of that key removes it, whether the element had a
   model or not.
5. **Reported once, logged once per batch.** The skipped element enters
   `damagedElements` and is pushed through `elementDamaged`. One `console.warn`
   per batch (a load, or one observer event) gives the count and at most the
   first five keys with their reasons; what a constructor or a mount threw is
   passed to that line as extra arguments, so a bug in a registered type is
   not silently relabelled. The pre-existing one line per `missing-xywh`
   element (#318) is unchanged.
6. **Left untouched.** Its `Y.Map` is not deleted, repaired or rewritten, and
   the load emits no Yjs update. A client that can read it still sees it.
7. **No repair of a late completion.** The elements-map observer is shallow: a
   `type` that lands inside a skipped map in a LATER transaction is not seen
   until the document is opened again. No mechanism is built for it.
8. **A canvas holding only skipped elements is not empty**: `isEmpty` counts
   the stored elements and is recomputed on every change of the elements map,
   so a skipped element arriving or leaving by sync counts too.
9. **Telemetry mirrors the reason.** `DocumentDamaged` widens its `reason` to
   `missing-xywh | unknown-type | unreadable`; the watcher sends one event per
   reason present in a batch. No new event, no new seam, no flag.

### Declared deviations from the acceptance criteria

- **A missing `id` is not skipped** (criterion 1 lists it). Skipping it would
  open blank every document that renders today with id-less elements (#681:
  those without connectors open under 4.0.0). Identity being the key (§1),
  the stored `id` carries no information the surface needs. To be confirmed by
  the product owner.
- **A missing `xywh` is not skipped** (criterion 1 lists it). It keeps its
  #318 behaviour: built, mounted, painted with a zero-size bound, reported as
  `missing-xywh`; a host has counted it that way since #318.
- **"At most one console warning"** (criterion 2) holds per batch of skipped
  elements; a load that also carries `missing-xywh` elements writes one more
  line per such element (#318, unchanged).

## Consequences

- A newer client's element, or a half-written one, costs the reader that
  element only. The canvas opens, and the document keeps the element.
- An element stored without `id`, or with an `id` other than its key, now
  mounts under its key: `getElementById(key).id === key`, and its events
  carry the key.
- The cost to hosts: `SurfaceDamageReason` and `DocumentDamagedEvent.reason`
  are enum-like, append-only values (house rule), and gain two members. A host
  that `switch`es on them exhaustively gets a compile error at upgrade and
  must add a default branch; hosts should treat `reason` as an open string.
  A host that only counts sees nothing new but the new values.
- What a skipped element does NOT get, because it has no model. Each is a
  path the product owner may want followed up; none writes on load:
  - **Whole-document snapshot** (`SurfaceBlockTransformer.toSnapshot`,
    `blocks/surface/src/surface-transformer.ts:107`) serialises from the
    `Y.Map`, so the element survives an export / doc copy. A non-map value in
    the elements map would throw there (`:17`, `element.forEach`).
  - **Copy, duplicate, drag and frame templates** serialise from models
    (`blocks/root/src/edgeless/utils/clone-utils.ts:36`, `:145`;
    `widgets/drag-handle/src/middleware/blocks-filter.ts:31-33`;
    `blocks/frame/src/frame-template.ts:43`). A copied group serialises its
    whole `children` map, the skipped id included (`clone-utils.ts:82`); at
    paste that id has no new id, so the GROUP is dropped
    (`blocks/root/src/edgeless/clipboard/canvas.ts:28-34`, `console.error`
    then `return null`) and its readable children are pasted ungrouped
    (`clipboard/command.ts:201`, `:217`). A copied connector ending on a
    skipped element becomes a free end. The original stays in the document.
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
- **Copy, paste and duplicate of an element whose stored `id` is absent or
  wrong** — known limit, not a regression, left for a follow-up (outside the
  load path). These are exactly the #681 documents this ADR now opens. The
  cause: identity is the key, but `serialize()` still returns the STORED map,
  stored `id` included (`framework/std/src/gfx/model/surface/element-model.ts:479`),
  and the paste keys everything by that serialised `id`. All paths below are
  in `blocks/root/src/edgeless/clipboard/`:
  - copying two or more elements with no stored `id` pastes only ONE,
    silently: the paste deduplicates by `id` and `seen.has(undefined)` is
    true from the second one on (`command.ts:132`). In a #681 document no
    element has an `id`, so copying N shapes pastes one;
  - a group or a mindmap containing such an element is not pasted at all:
    its child has no entry in `oldToNewIdMap`, so it logs `Copy failed` and
    returns `null` (`canvas.ts:28-34` for a group, `44-54` for a mindmap);
  - a connector copied with such an element stays attached to the ORIGINAL
    element: `serializeConnector` finds the end in the selection by model id
    (the key) and keeps `{ id: key }` (`blocks/root/src/edgeless/utils/clone-utils.ts:95`),
    then the paste finds no new id for the key and keeps it
    (`canvas.ts:78-79`);
  - duplication and Alt-drag take the same path
    (`blocks/root/src/edgeless/interact-extensions/clone-ext.ts:13`,
    `prepareCloneData` then the same paste command).
    Nothing writes into the original: `addElement` assigns a new id and never
    copies the `id` key (`UNSAFE_ELEMENT_PROP_KEYS`).
- **A local `addElement` whose mount throws** (a bug in a registered type, not
  corrupt data) is now skipped like a loaded element: the model is removed,
  the Y.Map it just wrote stays in the document, `addElement` returns an id
  for which `getElementById` is `null`, and a `DocumentDamaged` `unreadable`
  is counted (`surface-model.ts:901-904`, `926-929`, `738`). Before, a
  half-mounted model stayed and the error was swallowed by `store.transact`.
  Known limit, not fixed here.
- **Pre-existing: a connector stored without `mode`** throws
  `unknown connector mode` in a microtask of the connector watcher, not at
  mount, so the guard does not catch it; `pendingFlag` then stays `true` and
  no connector path of that surface is recomputed for the session
  (`gfx/connector/src/connector-watcher.ts:121-129`,
  `gfx/connector/src/connector-manager.ts:1723`). Read from the code, not
  demonstrated. Not fixed here.
- **The `@observe` metadata quirk** (`framework/std/src/gfx/model/surface/decorators/common.ts:17`):
  `setObjectPropMeta` reads the table through the prototype chain and mutates
  what it finds, so a subclass of a concrete, already instantiated element
  class adds its observers to the parent's table. Inert today: no element
  class with `@observe` is extended by another concrete class (the guard
  spec's test types work around it). Not fixed here.
- **Known limit, pre-existing, not fixed here.** The elements-map observer
  handles `add` and `delete` only (`surface-model.ts`, `onElementsMapChange`).
  A peer that REPLACES the Y.Map under an existing key (`update` action)
  leaves a valid element's old model bound to the replaced map, and a skipped
  element replaced by a valid one stays skipped until reload.
- If a model is reported `missing-xywh` and then fails to mount, it is
  reported a second time, as `unreadable`; the record keeps the second.
- No placeholder is painted where a skipped element was (criterion 6 of the
  issue, optional).
