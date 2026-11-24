# ADR 0057 — A disposed store lets go of Yjs, and the next one is built fresh

- Status: **proposed** (2026-11-24)
- Deciders: the product owner, on the three questions answered at the end; the
  maintainer, for the red zone. Proposed by the library session of
  2026-11-24, which re-verified issue #746 against the code and found its
  diagnosis partly wrong.
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
