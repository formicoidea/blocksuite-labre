---
'@labre/store': minor
'@labre/std': patch
'@labre/affine-shared': patch
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
changes. A second store on the same document (a query preview, a readonly
mirror) no longer borrows the first store's nested-prop proxies, so it is
notified of nested changes. `BlockMetaService` subscribes once per store
however often `load()` runs.
