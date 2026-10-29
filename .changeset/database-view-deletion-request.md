---
'@labre/affine': minor
---

Two optional members on the data-source picker. `deleteView(request)`: deleting a view of a host database (a block with an `externalSourceId`, on a writable document) asks the host first; it removes the view with `request.remove()` (one undo step, `false` when it could not), or keeps it by not calling it. Never called for a deleted block, an undo, a redo or a remote change. `viewHistory(view, 'undo' | 'redo')` reports each local undo and redo of such a removal. New types `DataSourcePickerViewRef` and `DataSourcePickerViewDeletion` (`@labre/affine/shared/services`). A host that sets neither sees no change.
