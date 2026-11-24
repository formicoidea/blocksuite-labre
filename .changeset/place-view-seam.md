---
'@labre/affine-shared': minor
'@labre/affine-database-block': minor
'@labre/affine-database-editor': minor
---

A host can confirm (or refuse) the placement of a view of one of its
existing sources before the library writes it (issue #701, ADR 0035
amendment of 2026-11-22). `DataSourcePickerService` gains an optional
`placeView(request)`, the symmetric of `deleteView`: "+ view" picking a
source, "Linked view of a database", the creation popover's "Link an existing
source" and "Source" in a view's settings hand the host a request naming the
gesture, the database, the source, the document and the block, and write the
view (one undo step) only when the host calls `request.place()`. Never called
for a source the gesture created, an undo, a redo, a paste or a remote
change. Without `placeView`, every gesture places at once, as before. New
exports: `placeViewThroughHost` and `ViewPlacementRef`
(`@labre/affine-database-block`), `DataSourcePickerViewPlacement` and
`DataSourcePickerPlacementGesture` (`@labre/affine-shared/services`).
