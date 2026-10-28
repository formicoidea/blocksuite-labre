---
'@labre/affine': patch
---

`TitleBandService.configure(docId, propertyId, anchor)`, optional: a right-click on a property chip's name under the page title (and in the note header on the canvas) asks the host to open its menu for that property under the name, and keeps the browser's menu from showing. Not on a read-only document, nor for a touch long-press. Without it, the right-click is the browser's, as before.
