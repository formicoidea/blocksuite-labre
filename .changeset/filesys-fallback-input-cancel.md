---
'@labre/affine-shared': patch
---

The fallback file picker (browsers without `showOpenFilePicker`) now removes its hidden `<input type="file">` when the dialog is cancelled, not only when a file is chosen; a dismissed dialog no longer leaves one input behind in the page body.
