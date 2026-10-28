---
'@labre/affine': patch
---

The canvas's "Add file" tool (the senior button, and the media item of the mind map basket) now opens the host's asset dialog when an `AssetPickerExtension` is registered, like the note menu's Image and File buttons already did: `pick({ kind: 'file', mode: 'insert', multiple: false, docId })`, an `image/*` ref lands as an image block and any other as an attachment card, by reference (no `BlobSource.set`). Without the seam it still opens the system file chooser.
