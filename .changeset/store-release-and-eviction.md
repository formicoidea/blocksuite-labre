---
'@labre/store': minor
'@labre/std': patch
'@labre/affine-shared': minor
'@labre/affine-widget-drag-handle': patch
'@labre/affine-block-embed-doc': patch
'@labre/affine-fragment-frame-panel': patch
'@labre/affine-block-surface-ref': patch
'@labre/affine-block-attachment': patch
'@labre/affine-block-image': patch
'@labre/affine-block-embed': patch
'@labre/affine-block-bookmark': patch
'@labre/affine-block-root': patch
'@labre/affine-block-surface': patch
'@labre/affine-block-frame': patch
'@labre/affine-widget-keyboard-toolbar': patch
'@labre/affine-gfx-mindmap': patch
'@labre/affine-database-block': patch
'@labre/affine-database-view-block': patch
---

`store.dispose()` now releases a store for good (#746, ADR 0057). It detaches
every Yjs observer the store and its blocks attached (their props' proxies,
`Text` and `Boxed` included), its awareness listener and its `selectionV2`
entry, and destroys its undo manager; the surface model detaches its
elements observer too. The document's container forgets the store, so the
next `doc.getStore()` builds a new, live store from Yjs instead of handing
the disposed one back. A release writes nothing to Yjs: nothing stored is
lost or changed. A reopened document starts with an empty undo history.

**New throw:** a disposed store throws a `BlockSuiteError`
(`ErrorCode.ModelCRUDError`) from `load()` and from every mutation entry
point (`addBlock`, `addBlocks`, `addSiblingBlocks`, `updateBlock`,
`deleteBlock`, `moveBlocks`, `transact`, `withoutTransact`, `undo`, `redo`);
its reads keep answering its last state, and a second `dispose()` does
nothing. `load()` used to revive a disposed store half-way, deaf to remote
changes. Two stores on the same document (the editor's and a query
preview, a readonly mirror) still share one proxy per nested prop, so they
can never read different nested values, and each is now notified of nested
changes (a second store was not); releasing one store leaves the other's
reactive. `BlockMetaService` subscribes once per store however often
`load()` runs.

**New API:** `store.disposed` answers whether a store was released: code
that resumes after an `await` checks it before writing. The library's own
gestures do (an image or attachment upload or measure, « Replace », «
Embed view », « Turn into image », link-preview refreshes, the embed and
keyboard-toolbar dialogs, paste preparation, « create linked doc », the
mindmap import, the drag merges, « turn into source »): a document closed
while one waits is left alone, nothing written and nothing thrown. A
`load(initFn)` whose `initFn` disposes of the store attaches nothing
afterwards. `doc.defaultStore` (never builds one) and
`doc.defaultStoreChanged` tell when a document gets or loses its default
store; `followDefaultStore(doc, attach)` (`@labre/affine-shared/utils`)
follows another document's default store without keeping it. The linked-doc
card, the data-view source and the surface-ref use them: a document closed
while another document shows it is released, and the card refreshes when
it is opened again. `DocDisplayMetaService` no longer builds the store of
every linked document it names.

`doc.getStore({ readonly: false })` now returns one store per document, as
`readonly: true` does, instead of building a new one on every call, and
`doc.removeStore({ readonly: false })` forgets it. It stays a store distinct
from the default `doc.getStore()`; with an `id` it is still keyed by the id.

The library's own previews release their query stores: the drag image when
the drag ends, the linked-doc card when it needs other blocks or
disconnects, the frame card and the surface-ref note when they disconnect.
Previews asking for the same store share it through the new
`holdPreviewStore(doc, options)` (`@labre/affine-shared/utils`): the last
release disposes of it. The frame card used to remove its store under the
wrong key and kept every one.
