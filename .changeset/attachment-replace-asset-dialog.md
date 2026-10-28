---
'@labre/affine': patch
---

"Replace" on an attachment card's toolbar now opens the host's asset dialog when an `AssetPickerExtension` is registered: `pick({ kind: 'file', mode: 'replace', multiple: false, docId })`, the card takes the first ref's `sourceId`, `name`, `type` and `size` by reference (no `BlobSource.set`), in one undo step. Without the seam it still opens the system file chooser and uploads the file. A host's `pick` may now receive `kind: 'file'` with `mode: 'replace'`.
