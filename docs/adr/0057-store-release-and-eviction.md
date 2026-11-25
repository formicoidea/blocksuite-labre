# ADR 0057 — A disposed store lets go of Yjs, and the next one is built fresh

- Status: **accepted** (2026-11-24; the maintainer approved implementing it
  as written on 2026-11-24, with the product owner's three decisions below)
- Deciders: the product owner, on the three questions answered at the end; the
  maintainer, for the red zone. Proposed by the library session of
  2026-11-24, which re-verified issue #746 against the code and found its
  diagnosis partly wrong. Where the code differs from the proposal: "As
  implemented", at the end.
- **Red zone**: `packages/framework/store` (`Store`, `StoreContainer`,
  `HistoryExtension`, `StoreSelectionExtension`, the block model, the sync
  controller and the reactive layer). No code lands before a maintainer's
  explicit approval of this ADR. Nothing persisted changes: no Yjs key, no
  schema, no default; the release writes no Yjs update (guarded, below).
  `packages/framework/sync` and `packages/affine/model` are not touched. The
  call-site fixes (part 3) live outside the red zone.
- Related: #746, #720 (the editor teardown leak), docs/lessons.md 39,
  ADR 0004 (`WorkspaceImpl`), ADR 0041 (the last red-zone change to the
  store), `packages/integration-test/src/__tests__/edgeless/store-retention.spec.ts`.

## Context

#746 says a workspace keeps every store opened in it, that the
`BlockMetaService` throttle keeps each store alive until `store.dispose()`,
that a host leaks "about 75 KB per mount", and proposes, until a fix, that
the host call `store.dispose()` when it closes a document. Each claim was
checked against the code at 63635c2ab (yjs 13.6.27, rxjs 7.8.2).

### 1. Retention grows with documents opened, not with mounts

`TestWorkspace` and `WorkspaceImpl` are the same class body
(`store/src/test/test-workspace.ts:17`, `store/src/impls/workspace.ts:14`,
both `extends WorkspaceBase`), and both build a `DocImpl` per document
(`impls/workspace-base.ts:124-133`). Each `DocImpl` owns a `StoreContainer`
(`impls/doc.ts:112`), a `Map` of stores by key (`model/store-container.ts:11`)
that returns a cached store when the key is known (`:32-34`). The default
`doc.getStore()` is keyed by the sub-document's guid (`impls/doc.ts:151-153`),
so every mount of one document gets the same store. Measured: 20 remounts of
one document give one store, and the heap grows by the content each mount
adds (one shape: 18-20 KB per mount). Twenty distinct documents keep twenty
stores.

### 2. The throttle holds nothing pending

`BlockMetaService` pipes local `blockUpdated` events through
a 30 s `throttleTime`, grouped per block and event type
(`affine/shared/src/services/block-meta-service.ts:9`, `:31-32`), with
rxjs's default configuration, leading edge only
(`rxjs/dist/esm/internal/operators/throttle.js:6`: `leading = true,
trailing = false`). The first event of a window writes the meta at once;
the others of the window are dropped, not deferred. There is nothing to
flush at release. The issue's guard ("a local edit followed immediately by
an unmount still reaches the doc and its meta") holds by construction (read
from the code, not tested): the edit is in Yjs when the call returns, and
its meta was either written then or, for a later edit of the same window,
never would have been. The
subscription is in `store.disposableGroup` (`:27`), which `dispose()`
disposes (`model/store/store.ts:1311`). What the throttle does hold is the
store itself, for up to 30 s after its last local edit, through the timer
list: measured, the stores of a disposed and dropped workspace are freed
30.1-30.2 s after the drop when they were not disposed, 0.1 s after when
they were. A delay, bounded, and not a red-zone matter (`affine/shared`).

### 3. The holders are Yjs observers that `dispose()` leaves attached

A document's sub-`Y.Doc` lives in the workspace's root `Y.Doc` as long as
the workspace (`impls/doc.ts:21-35`). Whatever a store attached to it keeps
the store reachable. `Store.dispose()` (`model/store/store.ts:1299-1314`)
calls each store extension's `disposed()`, removes the deep observer on the
blocks map (only when the doc is ready, `:1303-1305`, while the constructor
attaches it unconditionally, `:641`), completes the slots, and disposes the
`DocCRUD` index (`model/store/crud.ts:73-77`). It does not detach:

- the per-block observers: the sync controller's `yBlock.observe`
  (`model/block/sync-controller.ts:39`, attached by the constructor at
  `:126`), the block model's `sys:children` and `yBlock` observers
  (`model/block/block-model.ts:120`, `:123`; `dispose()` at `:137-141`
  completes subjects, `[Symbol.dispose]` at `:154-157` unsubscribes
  subscriptions, neither unobserves), the store `Text`'s `Y.Text` observer
  (`reactive/text/text.ts:82`), the flat model's observer
  (`reactive/flat-native-y/index.ts:150`), the nested-prop proxies
  (`reactive/proxy.ts:206`, `:337`) and `Boxed` (`reactive/boxed.ts:119`).
  No `unobserve` exists in the package outside `store.ts:1304`;
- the awareness `change` listener of `StoreSelectionExtension`, an inline
  closure (`extension/selection/selection-extension.ts:56-95`) its
  `disposed()` never removes (`:101-105`); every `load()` adds one more,
  since `load()` re-runs every extension's `loaded()` (`store.ts:1286-1288`);
- the `Y.UndoManager` of `HistoryExtension`
  (`extension/history/history-extension.ts:22-24`): `disposed()` removes the
  extension's own listeners (`:71-78`) but never calls `destroy()`, so the
  manager's `afterTransaction` handler stays on the sub-document
  (`yjs/src/utils/UndoManager.js:268`; `destroy()` removes it, `:395-399`);
- the nested-prop proxies, a second way: `proxies` is a module-level
  `WeakMap` keyed by the Yjs type (`reactive/memory.ts:3`). Its key lives as
  long as the document, so its value, the proxy, and the `onChange` the proxy
  closes over (`sync-controller.ts:231`), stay reachable. And
  `createYProxy` returns the proxy already registered for a type
  (`reactive/proxy.ts:356-358`): a second store over the same document
  reuses the FIRST store's proxy for every nested prop, bound to that
  store's model. Read from the code, not demonstrated;
- each selection extension's entry in the local awareness state:
  `setLocalSelection` adds a key per extension instance
  (`yjs/awareness.ts:62-68`, key `${store.id}:${nanoid()}`,
  `selection-extension.ts:15`) and nothing removes it.

Measured in the store package alone (Node, `--expose-gc`, `WeakRef`, 20
documents in one open `TestWorkspace`, each loaded and edited once): 20 of
20 stores alive with no dispose, with `dispose()`, and with `dispose()` plus
`removeStore`; 20 of 20 when the workspace is dropped without `dispose()`
(the awareness interval holds it); 0 of 20 when it is disposed and dropped.
On one document, after 11 cycles of `getStore`, `load`, `dispose`,
`removeStore`: one block's observers went from 2 to 22, the awareness
`change` listeners from 1 to 11, the sub-document's `afterTransaction`
handlers from 1 to 11; the blocks map's deep observer, the one `dispose()`
removes, back to 0.

Measured in Chromium (the spec above and a throwaway variant, 20 documents
mounted in edgeless with one shape, 3 before the baseline, two runs per
case):

| Case                                         | Stores alive | JS heap per document |
| -------------------------------------------- | ------------ | -------------------- |
| unmounted, store kept (what a host does)     | 20 / 20      | 85-89 KB             |
| unmounted, `dispose()` + `removeStore`       | 20 / 20      | 69-80 KB             |
| one document remounted 20 times              | 1 store      | 18-20 KB per mount   |
| 20 `getStore({ query })`, disposed + removed | 20 / 20      | not measured         |
| 20 `getStore({ readonly: false })`           | 20 distinct  | not measured         |

Part of the per-document heap is the document's own Yjs content, which the
root `Y.Doc` keeps whatever happens to the store; the split was not
measured. Releasing the store cannot free it; unloading a sub-document is a
sync-level change this ADR does not propose.

### 4. The issue's interim mitigation is harmful

- **`store.dispose()` alone** leaves the store in its container. The next
  `doc.getStore()` returns the same, disposed store. Its `load()` re-creates
  the disposable group and re-subscribes the internal slot handler
  (`store.ts:1279-1283`), but does not re-attach the deep observer, and the
  slots it completed (`:1306-1310`) never emit again. Measured: a block a
  remote peer added after the reopen is in the Yjs map and not in the
  reopened store; a `blockUpdated` subscriber of the reopened store never
  fires. After `removeStore`, a fresh store sees the remote block. The
  document looks open and is deaf.
- **`dispose()` plus `removeStore`** does give the next mount a working
  store, and frees nothing (the table above): the old store's per-block
  observers are still attached and still run on every change to its blocks,
  beside the new store's.
- **`doc.dispose()`** is not "close a document": it calls
  `this._yBlocks.clear()` (`impls/doc.ts:128-132`), which deletes every
  block in the Yjs document, and that deletion syncs to every peer and to
  storage. It is what `workspace.removeDoc()` calls
  (`impls/workspace-base.ts:216`).

### 5. Query stores grow without bound

`getStore({ readonly, query })` keys a store by its query
(`store-container.ts:74-81`). `getStore({ readonly: false })` with no `id`
falls into the branch that mints a key with the workspace's id generator
(`store-container.ts:23-27`, reached because `impls/doc.ts:149-150` passes
no id when `readonly` is defined): a new, unreachable-by-key store per call,
and `removeStore({ readonly: false })` returns early (`:59-60`). The library
itself leaks query stores:

- the drag preview builds one per drag (`widgets/drag-handle/src/helpers/preview-helper.ts:70-71`)
  and never removes or disposes of it;
- the linked-doc card preview builds one per render
  (`blocks/embed-doc/src/common/render-linked-doc.ts:183-191`), same;
- the frame preview removes with the wrong key: it creates
  `{ readonly: true, query }` (`fragments/frame-panel/src/card/frame-preview.ts:135`)
  and removes `{ query }` (`:137`), whose readonly key reads `'false'`
  (`store-container.ts:83-85`), so the entry stays; it never disposes;
- the surface-ref note removes its store (`blocks/surface-ref/src/portal/note.ts:50`)
  but never disposes of it (created at `:112-115`).

Not a query store, but the same growth by reference: a consumer that
resolves linked-doc titles or icons through `DocDisplayMetaService` builds
the default store of every linked document it resolves
(`affine/shared/src/services/doc-display-meta-service.ts:110`, `:169`),
observers included, and that store stays for the workspace's life whether
or not the document is ever opened.

Noticed in passing, not part of this decision: `note.ts:33-45` fills
`this.ancestors` and builds its query from a local `ancestors` set that
stays empty, so the query matches nothing by id.

### 6. Where "75 KB per mount" came from

`editor-teardown.spec.ts` builds a fresh `TestWorkspace` per mount and its
cleanup disposes of the store AND the workspace
(`integration-test/src/__tests__/utils/setup.ts:209-214`). Its 75 KB per
mount is what the harness keeps once both are gone, not what a long-lived
workspace keeps per store; docs/lessons.md 39 is amended to say so.

## Decision (proposed)

Three parts, landed in this order, one PR each.

1. **`Store.dispose()` releases everything the store attached, and the
   container forgets it.**
   - It detaches every observer it or its blocks attached to Yjs: the blocks
     map's deep observer, unconditionally; for every block, the sync
     controller's, the model's, and those of the `Text`, flat-model, proxy
     and `Boxed` instances it created. Each is kept as a handle when attached
     so it can be released; a block removed while the store lives releases
     its own (`store.ts:779-780` is where it is disposed today).
   - `HistoryExtension.disposed()` calls `undoManager.destroy()`.
   - `StoreSelectionExtension` keeps its awareness handler as a field,
     removes it in `disposed()`, attaches it once however often `load()`
     runs, and removes its own key from the local `selectionV2`.
   - A store never reuses a proxy another store created: the `proxies`
     registry becomes per store (or keyed by store and type), and a release
     drops the store's entries. The exact shape is settled in the PR, with
     the guard below.
   - `StoreContainer` evicts the disposed store under the key it created it
     with; `removeStore` stays and becomes idempotent. The next
     `getStore()` with that key builds a new store from Yjs.
   - `load()` on a disposed store no longer revives it (see "A stale
     reference").
2. **`getStore({ readonly: false })` is keyed.** `readonly: false` gets a
   stable key, like `readonly: true` (`{ readonlyKey: 'false', query }`), in
   `getStore` and in `removeStore`: two calls return one store. It stays a
   store distinct from the default one: `store/src/__tests__/doc.unit.spec.ts:257-285`
   toggles the default store's local `readonly` and expects the
   `readonly: false` store not to follow.
3. **The library's own call sites release their query stores**: the drag
   preview when the drag ends, the linked-doc card when it re-renders or
   disconnects, the frame preview with the key it created, the surface-ref
   note by disposing before removing. One test each.

### No Yjs mutation at release

Releasing reads and detaches; it writes nothing. `UndoManager.destroy()`
removes handlers and writes nothing (`UndoManager.js:395-399`). Removing a
key from the local awareness state changes ephemeral presence, not the
document; peers see this client's selection in that document disappear,
which is what closing it means. There is nothing to flush (Context 2). Guard:
the state vectors of the sub-document and of the root document are equal
before and after `dispose()`, and no `update` event fires on either.

### What a release loses

Nothing stored. In memory: the undo and redo stacks (a reopened document
starts with an empty history); the local selection; the store's local
`readonly` toggle; every subscription to its slots and signals (completed;
a host that subscribed must subscribe on the new store); the `extensions`
and `provider` passed to the first `getStore` (the next call's apply, which
the cache ignores today); the block-meta throttle window (the first local
edit after a reopen writes the meta at once, a gesture's write, not a
release's).

### A stale reference

After a release, whoever still holds the old store holds a dead object. It
**throws** a `BlockSuiteError` from `load()` and from every mutation entry
point (`addBlock`, `addBlocks`, `updateBlock`, `deleteBlock`, `moveBlocks`,
`transact`); reads answer their last state (product owner, 2026-11-24).

The alternative, warning once per store and doing nothing, is not taken: a
write through a released store either is lost or lands in Yjs without the
store seeing it; both are silent, and silent loss is what this repo refuses
(docs/lessons.md 6). Reads keep answering because teardown code
legitimately reads while it unmounts. It ships as a
minor with a changeset line naming the new throw, like ADR 0056's: no
well-formed call changes behaviour, and the call it breaks (`load()` to
revive a disposed store) never worked (Context 4).

### Why not a weak cache

A `WeakRef` or `WeakMap` cache in the container changes nothing today: the
store is strongly reachable from the Yjs side (the observers, the
`UndoManager`, the `proxies` values whose keys live as long as the
document), so the entry is never collected while the workspace is open.
Once those edges are cut, a weak cache would make a store's identity depend
on garbage-collection timing: two mounts of one document would get the same
store or not, and the undo stack would vanish at a collection nobody chose.
A collected store cannot detach anything either: `FinalizationRegistry`
callbacks are not guaranteed to run, and run late. Release is an explicit
call.

### Rejected options

- **Documentation only, "the host calls `store.dispose()`"** (the issue's
  interim): harmful today (Context 4) and frees nothing even with
  `removeStore`.
- **Ref-counted self-release when the last editor unmounts**: the library
  cannot tell a close from a remount. The container's `keyed` mode switch,
  a route change or a tab switch unmount and remount in sequence; a count
  that reaches zero between the two would destroy the undo stack mid-
  session. Readers that do not go through an editor (a host's read-only
  mirror, a preview, an exporter) would need to join the count. The host
  knows when a document is closed for good; it says so with `dispose()`.
- **Changing the throttle** (flush, trailing edge, a shorter window): there
  is nothing pending (Context 2), `dispose()` already ends the subscription,
  and the 30 s hold is bounded. A trailing edge would add meta writes after
  the user stopped typing, for no retention gain.

### Guard tests required with the code

Unit, in `packages/framework/store`:

1. Release writes nothing: equal state vectors of the sub-document and the
   root document across `dispose()`, no `update` event.
2. Release detaches everything: after `dispose()`, one block's Yjs observer
   count, the blocks map's deep observers, the awareness `change` listeners
   and the sub-document's `afterTransaction` handlers are back to their
   values before the store was opened; after N open/dispose cycles, they do
   not grow.
3. Reopen is fresh and live: the next `getStore()` returns a new store; it
   contains a block a remote peer added after the release, and its slots
   fire.
4. A disposed store throws on `load()` and on each mutation entry point;
   reads still answer.
5. `getStore({ readonly: false })` twice returns one store, distinct from
   the default one; `doc.unit.spec.ts` "local readonly" stays green.
6. Two live stores on one document (the default and a read-only query
   preview): disposing of the preview leaves the default store reactive to
   nested-prop changes (the shared `proxies`).
7. A local edit then an immediate `dispose()`: the edit and, with
   `enable_block_meta`, its meta are in Yjs (the issue's guard; true today,
   held from now on).
8. _Added 2026-11-25, see "As implemented":_ a database cell edit (number,
   text, date, progress, link) left and closed in one task, the store
   disposed right after: the value is in Yjs, written once, and nothing
   throws (`database/engine/src/__tests__/cell-write-at-teardown.unit.spec.ts`,
   `database/block/src/__tests__/link-cell-write-at-teardown.unit.spec.ts`,
   `integration-test/src/__tests__/page/database-cell-saved-at-close.spec.ts`).

Integration: the three assertions of `store-retention.spec.ts` that pin
today's leak (20 disposed stores alive, 20 preview stores alive, 20 distinct
`readonly: false` stores) fail, and each is replaced by the target written
next to it (none alive, one store). Call sites: one test per site of part 3.

## What stays loadable

Everything: no key, schema, default or enum value changes, and the release
writes nothing to Yjs (guard 1). A document opened by a client with or
without this change reads and writes identically.

## Consequences

- A host closes a document for good with `store.dispose()` once this
  lands; until then, `docs/integrate/02-mount.md` says the opposite (keep the
  store, reuse it, only `workspace.dispose()` frees), and that page changes
  with the code.
- A host that keeps every document it opened (no dispose) keeps one store
  per document, as today: the cache is the point, and the growth is bounded
  by the documents opened, not by the mounts.
- The document's Yjs content stays in the root `Y.Doc` while the workspace
  lives; this ADR does not change it.
- Every attached observer now has a handle kept for its release: a small
  memory cost per block, paid back at release.
- Previews and mirrors built on a second store stop borrowing the first
  store's proxies (part 1): a nested-prop change reaches each store through
  its own proxy. The guard 6 is what proves it.

## Product owner decisions (2026-11-24)

The three questions this ADR left open were answered by the product owner on
2026-11-24. The status stays **proposed** until the maintainer approves the
red-zone code change itself.

1. **Undo across close and reopen: accepted.** A released document reopens
   with an empty history.
2. **A stale reference throws.** The recommendation above is adopted: a
   disposed store throws from `load()` and from every mutation entry point;
   reads keep answering their last state.
3. **`TestWorkspace` in the Labre app: acknowledged, no migration asked.**
   The app builds its workspace on the library's test class; retention is
   identical with `WorkspaceImpl` (Context 1), so this fix does not depend on
   it. Moving the host off `store/test` (ADR 0004) remains a separate host
   decision.

## Maintainer approval (2026-11-24)

The maintainer approved implementing this ADR as written, with the product
owner's three decisions above, on 2026-11-24. Approved and nothing else: no
Yjs key, schema, default, snapshot format or sync protocol changes;
`packages/framework/sync` and `packages/affine/model` are not touched.

## As implemented

The three parts landed with #746. Where the code differs from, or goes
beyond, the decision above, and why:

- **Nested props: one proxy tree per Yjs type, shared by the stores of a
  document; a store adds a listener.** (Corrected 2026-11-25, see the
  amendment below: the first landing gave each store its own proxies and
  could not hold.) A block prop that is a `Y.Map` or a `Y.Array` resolves
  to the shared tree of that type (`attachYProxy`,
  `store/src/reactive/proxy.ts`): one proxy per type in the module-level
  registry, as before ADR 0057, so two stores on one document read the same
  nested values whoever writes and however. Each store's sync controller
  registers its `onChange` on the tree (a preview is now notified of nested
  changes; the registry used to bind the tree to the first store alone);
  releasing a store takes its listeners back, and the tree detaches from
  Yjs, and leaves the registry, with its last listener. A block's `Text`
  and `Boxed` props, its own observers and a flat-data block's map stay per
  store, in the block's `ReleaseScope` (`store/src/reactive/release-scope.ts`).
  The prop-level handles are `WeakRef`s (an observer whose Yjs type was
  collected holds nothing; a strong handle per nested replacement would make
  a live store grow), swept as the set doubles; a block removed while the
  store lives releases its own. `stashProp` / `popProp` reach the shared
  trees again.
- **Every block model is disposed at release, and the surface detaches from
  `dispose()`.** The decision lists the store package's observers; in
  edgeless the surface model's `elements` map observer (and its element
  models' own) held the store as well, and the store-retention spec measured
  it. `SurfaceBlockModel` (`packages/framework/std`, outside the red zone)
  runs the teardown it ran on `deleted` from `dispose()` too. So after a
  release the surface's element models are unmounted (`getElementById`
  answers `null`); the store's own reads (`getBlock`, `root`, a model's
  props) answer their last state.
- **More entry points throw than the six listed.** Reading the class gave
  eleven: `load`, `addBlock`, `addBlocks`, `addSiblingBlocks`, `updateBlock`,
  `deleteBlock`, `moveBlocks`, `transact`, `withoutTransact`, `undo`, `redo`.
  The error is a `BlockSuiteError` with `ErrorCode.ModelCRUDError`, the code
  the store throws for a write a readonly store refuses. Not guarded: a
  write that bypasses the `Store` class (a model's `props` setter, a nested
  prop proxy, a `Text` method). It lands in Yjs, where every live store sees
  it; the released store does not. Guarding them means a disposed check in
  the reactive layer's write paths, left for a follow-up if a host meets it.
- **`dispose()` sets its flag first and runs every step.** A write attempted
  while releasing throws instead of landing; an extension whose `disposed()`
  throws does not leave the rest attached (the first error is rethrown at
  the end).
- **`BlockMetaService` owns its subscription** (`packages/affine/shared`,
  outside the red zone): subscribed once however often `load()` runs (it
  subscribed once per call), ended in its `disposed()`.
- **What stays attached, by Yjs's design.** `Y.UndoManager`'s constructor
  adds an anonymous `destroy` listener to the sub-document that
  `destroy()` cannot remove: one small listener per store opened on a
  document, closing over the destroyed manager (its listeners cleared, no
  store reachable), for the document's life.
- **Part 2 keeps an `id` above `readonly: false`.** The key rule is one
  function for `getStore` and `removeStore` (`StoreContainer._keyOf`):
  `readonly: true` or a query keys by query, as before; then an `id` keys
  by id, as before (so `{ id: guid, readonly: false }` is still the default
  store); only then does `readonly: false` key as
  `{ readonlyKey: 'false' }` instead of minting a random key. No caller in
  the repo relied on the random key; the only ones were the store's own
  "local readonly" test and the retention spec.
- **Part 3 counts holds instead of disposing per call site.** A query
  store is cached by its options, and two of the four sites share one: every
  frame card of a document asks for the same frame filter, and every
  surface-ref note portal asks for the same (empty, see Context 5) query.
  Disposing of it when one card or portal goes would have left the others
  rendering a dead store. `holdPreviewStore` (`@labre/affine-shared/utils`)
  hands each preview a hold; the last release disposes of the store, at the
  end of the task, so a preview moved in the DOM (disconnected then
  reconnected at once) keeps it. The drag image releases its holds when the
  drag ends (`onDrop` of the draggable, which also fires on a cancel); the
  linked-doc card swaps its hold when a render needs other blocks, keeps it
  when the blocks are the same, and releases it on disconnect; the frame
  preview and the note portal release on disconnect. The note portal's empty
  query is left as Context 5 found it.
- **Other call sites.** `getStore({ readonly: true })` in the surface-ref
  block and in the synced-doc block and toolbar is one store per document,
  never released, bounded by the documents opened: the stores a host closes
  are default stores, these are not, so they are not affected by a release
  (a documented retention, as before ADR 0057). `DocDisplayMetaService`
  no longer builds a store at all (see the amendment). The canvas viewer's
  readonly store goes with the workspace it builds and disposes of.
- **Context 2 corrected (2026-11-25): a pending write did exist.** The
  block-meta throttle holds nothing, as Context 2 says, but five database
  cell editors (number, text, date, progress, link) deferred their exit
  write by one animation frame through `BaseCellRenderer.valueSetNextTick`
  (`database/engine/src/core/property/base-cell.ts`). An exit followed by
  the editor's teardown and `store.dispose()` in the same task left that
  frame behind: it wrote through the released store, threw `store … is
disposed`, and the edit was lost. The first full integration run after
  part 1 met it eight times, all in `database-toolbar-pointer.spec.ts`.
  Fixed at the root, not by a disposed guard: the base cell keeps the
  pending value and its frame (`valueSetNextTick`, base-cell.ts:169), writes
  it at once when the cell leaves the DOM (`disconnectedCallback`,
  base-cell.ts:183-198), cancels the frame so it never
  writes twice, lets a newer immediate write cancel an older pending one,
  writes at once when the cell is already out of the DOM, and drops a
  deferred write if the property turned readonly meanwhile. A write that
  still reaches a disposed store keeps throwing. Why the write was deferred
  could not be traced: the code predates the fork (imported by "sync back
  from affine", f444caa0d) and the upstream reference clone is shallow. Read
  from the callers, the exit hook runs inside the view's selection change
  (a subscription, an `effect` on mobile) while it still flips
  `isEditing$` and blurs; the flush leaves that path deferred and only runs
  at teardown, where the cell has no exit of its own in progress. Guard 8.
- **Found, not changed.** While a store lives, every change to a `Text` prop
  attaches one more observer to its `Y.Text`: the prop's signal is fed a new
  `Text` per change (`sync-controller.ts`, `_getPropsProxy`). Measured: ten
  edits, ten observers. They are now released with the store; stopping the
  growth changes what the `text$` signal holds, which consumers may compare
  by identity, so it is left for its own change.

## Amendment — 2026-11-25: three findings of the second review, fixed

An independent review of the branch found two regressions against the base
and a broken contract. Each is fixed here; the guards are named.

1. **Nested writes inside a transaction did not reach a second store.** The
   first landing gave each store its own nested-prop proxies and recognised
   a sibling store's write by the transaction ORIGIN (`{ proxy: true,
target }`). Yjs keeps the outer origin of a nested transaction, so a
   nested write made inside `store.transact`, an `updateBlock(model, () =>
…)` callback or any outer transaction (the house's mandatory path for
   nested writes) carried the store's client id; the other store's proxy
   took it for its own and kept the old value, and an editable second store
   running the database `updateCells` pattern then recreated a row it
   thought missing and dropped the editor's cells. Recognising one's own
   write by the transaction instead would still be too coarse (two stores'
   proxies writing in one transaction) and would need every handler to be
   idempotent. The fix restores the base's design, one proxy per Yjs type
   shared by every store, and makes only the release per store (a listener
   per store on the shared tree, the tree detached with its last listener).
   Divergence is then impossible by construction. Guard:
   `store/src/__tests__/two-stores-nested-props.unit.spec.ts` (12 cases, 10
   red on the first landing: inside `transact`, deeper, array push, both
   stores in one transaction, remote interleaved, splice and reorder, map in
   map, `Text` and `Boxed` inside a nested prop, `updateBlock` callback,
   `updateCells` on an editable second store), and guard 6 in
   `store-release.unit.spec.ts` (one proxy for both stores, detached with the
   last). What still differs per store, as on the base: a flat-data block's
   map (a second store does not see another store's local flat writes) and
   each store's top-level `Text` / `Boxed` instances (they read Yjs
   directly, so they cannot diverge).
2. **A write after an `await` threw on a closed document.** "No
   well-formed call changes behaviour" (under "A stale reference") was
   wrong for asynchronous gestures: an upload, a measure, a dialog or a
   fetch that resumes after the host disposed of the store used to write
   through it, and now throws, while `readonly`, `hasBlock` and `getBlock`
   answer "writable and present". `store.disposed` is the public answer;
   the library's own gestures check it after each `await` and abandon the
   gesture (nothing written, nothing thrown), as they do when the store
   turned readonly meanwhile. Sites fixed: « Embed view » on a video and «
   Turn into image » (`blocks/attachment/src/embed.ts`), « Replace »
   (`attachment-block.ts`), `addImageBlocks` / `addSiblingImageBlocks` /
   `addImages` and `resetImageSize` (`blocks/image/src/utils.ts`), the
   attachment uploads and picker, the image asset picker and insert command,
   the bookmark, GitHub, Loom, YouTube and iframe refreshes and their slash
   menus, the keyboard toolbar's embed actions, the synced-doc « duplicate
   as note », the edgeless cut and paste preparation, the « create linked
   doc » prompts and quick search link, the mindmap import, the drag-handle
   merges, the database « turn into source », the frame adoption microtask
   and the surface clipboard's prepared blocks. Guards:
   `attachment/src/__tests__/closed-mid-gesture.unit.spec.ts`,
   `video-embed-ratio.unit.spec.ts` (« a document closed meanwhile »),
   `image/src/__tests__/closed-mid-upload.unit.spec.ts`. Also: `load(initFn)`
   returns early when `initFn` disposed of the store, so no extension
   attaches again (`store-release.unit.spec.ts`).
3. **Components of another document kept, or went deaf to, a released
   default store.** The default store is shared across the workspace. The
   doc now tells when it gets or loses one: `doc.defaultStore` (never
   builds one) and `doc.defaultStoreChanged` (the store when built, `null`
   when released or removed), and `followDefaultStore(doc, attach)`
   (`@labre/affine-shared/utils`) attaches to the open store, lets it go at
   its release and attaches again when the document is opened again, never
   building it. Consumers, with their verdicts:
   - linked-doc card (`embed-linked-doc-block.ts`): followed, refreshed on
     reopen; and its imperative preview render runs `untracked`: a card
     connected during its note's update read the linked document's
     `root.children` inside the NOTE's render effect, which then kept the
     released store alive (found with a heap snapshot);
   - data-view source (`database/view-block/src/data-source.ts`): follows
     each document, drops a released store's blocks, reads them again on
     reopen. Nothing builds this source on render on this base (#754); its
     `dataSource` getter still can;
   - `DocDisplayMetaService`: keyed its title and icon caches by the default
     store, building it for every linked document it resolved and again
     after a release; now keyed by document id, no store;
   - surface-ref to an element of another document: the element is read
     from that document's readonly store (the one its preview renders), not
     from the default store;
   - synced-doc block, its card and its toolbar: readonly stores, not
     affected (documented retention, one per document, as before);
   - the inline reference node, the doc title and the outline: read through
     `DocDisplayMetaService` or their own editor's store, not affected;
   - canvas viewer: its own workspace, not affected;
   - the import/export transformers' `docCRUD.get`: one-shot, not listeners.
     Guards: `store/src/__tests__/store-container.unit.spec.ts` (the signal),
     `shared/src/__tests__/utils/follow-default-store.unit.spec.ts` (the
     helper, and display meta building no store),
     `view-block/src/__tests__/data-source-follows-docs.unit.spec.ts`, and
     `integration-test/src/__tests__/page/cross-doc-store-release.spec.ts`: A
     mounted with its card (or its surface-ref) to B, B's default store
     disposed and collected, B then edited on a fresh store, A shows the
     edit.

## Amendment — 2026-11-25: two findings of the third review, fixed

1. **A table cell's `Text` was released twice.** A flat-data block binds each
   `Text` and `Boxed` of a nested prop more than once: when `initializeData`
   reads it, then again when it is assigned into its nested proxy
   (`bindOnChangeIfNeed`, then the transform). That is the base's behaviour,
   and it was harmless there: `bind` only set the callback, and each instance
   observes Yjs once, from its constructor (one observer per cell `Y.Text`
   and `Boxed` map while the store is open, on the base as now, and one
   `blockUpdated` per edit). The first landing made a scoped `bind` also
   track the target, and `ReleaseScope.track` kept one handle per call, so
   `store.dispose()` unobserved a cell twice and Yjs warned "Tried to remove
   event handler that doesn't exist" (30 times in the integration run, one
   per table cell; none on the base). `ReleaseScope` now holds a target once
   (a `WeakSet`), and every `_release` (`Text`, `Boxed`, `ReactiveYArray`,
   `ReactiveYMap`, `ReactiveFlatYMap`) is idempotent. The same review of the
   path found a `Text` written into a cell through the flat proxy (the
   table's whole-cell write) bound with a closure over the store's
   `onChange` and never tracked, so it kept the store after the release:
   `bindOnChangeIfNeed` now takes the block scope. Unchanged, as on the base:
   a `Boxed` written into a new cell is never bound to the store (it notifies
   nothing), so its own observer holds nothing of it; a `Text` written back
   to its own cell leaves the model's text reading empty (a base bug,
   reported, not touched here). Guards: `store-release.unit.spec.ts`, « a
   Text and a Boxed in a flat block's nested prop » (red before: two
   warnings; one handler left on a locally written cell).
2. **The linked-doc card built the other document's default store again.**
   Its `linkedDoc` getter asked `getStore({ id })`, the default store's key,
   from the title, the render, the empty check and `_load` (run on every
   document-list change): after a host closed B, any re-render of a card to
   B, or any rename in the workspace, rebuilt B's default store, which
   nobody released. The card now reads existence, title and trash from the
   `Doc` and its meta, and content from `LinkedDocSource`
   (`embed-doc/src/common/linked-doc-source.ts`): B's default store while it
   is open; when nobody has B open and the card must load content, a counted
   readonly store of its own (`holdPreviewStore`), released with the card
   (the base built the default store there); once the default store it read
   is released, nothing until a store comes back (title from meta, the
   empty-preview body; building a store then would only work around the
   host's close). The card hears the changes of whichever store it reads
   (fourth review: on its own store it heard none, so a peer's new block
   never showed): the listening moves from its own store to the default one
   and to none with the reads, once per change; a store opened while the
   card waited for content refreshes it after the host's task. Guards: `embed-doc/src/__tests__/linked-doc-source.unit.spec.ts`
   and `cross-doc-store-release.spec.ts` (B's `defaultStore` null after the
   close, after a forced re-render and reload of the card, after another
   document and B are renamed, and after the collection; the card shows B's
   renamed title; red before on the rebuilt store).

   Every other place that asks another document for a store, re-audited:

   - data-view source: built every document's default store when built, a
     closed one included; it now never builds one and lists the documents
     open (`data-source-follows-docs.unit.spec.ts`, red before). Its
     `dataSource` getter is deprecated and read by no registered entry;
   - the transformers' `docCRUD.get` (the store's own and the linked-doc
     widget's HTML, Markdown, Notion and zip ones): « one-shot » above was
     the wrong verdict, it built the default store of every synced document
     exported and every linked document a paste or an import checked, and
     that store stayed. It now answers the open default store, else the
     readonly one (`storeToRead`, `@labre/affine-shared/utils`; guards in
     `follow-default-store.unit.spec.ts` and `store-release.unit.spec.ts`);
   - surface-ref: scanning the workspace for the referenced element built a
     readonly store for every document scanned; the document is now found
     from its Yjs blocks, and the readonly store is built for that one
     document, the one the preview renders;
   - synced-doc block, card and toolbar: readonly stores, one per synced
     document shown, as before (documented retention);
   - `DocDisplayMetaService`, the inline reference node, the linked-doc
     menus, quick search and the « more » menus, the database link cell and
     title column: meta only, no store;
   - the paste middleware: `getDoc` for existence only;
   - the frame panel: a counted preview store of its own document;
   - creation paths (`createDefaultDoc`, « create linked doc » from a note,
     a slice or edgeless elements): the new document's store, by design;
   - canvas viewer: its own workspace.

Also from that review: `defaultStoreChanged` announces in order (a
subscriber that opens the document again inside a `null` no longer lets
later subscribers see the new store before the `null`;
`store-container.unit.spec.ts`), and a cell's `disconnectedCallback` runs
its teardown in a `finally`, so a flush that throws on a store the host
disposed of first does not skip it (`cell-write-at-teardown.unit.spec.ts`).
