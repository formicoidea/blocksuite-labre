---
'@labre/affine-shared': minor
'@labre/affine-components': minor
'@labre/affine-block-embed-doc': minor
---

New host seam `PageDropExtension({ verdict, drop })`: a page dragged from the host's own chrome (a sidebar tree) into the editor. On every dragover the editor asks `verdict({ types, docId })`: a refused page draws no drop line and the browser shows its no-drop cursor (a read-only document always refuses); an accepted one draws the drop line. On the drop the host's `drop({ dataTransfer, docId })` decides what it means (Labre moves the page under the open one) and returns `{ pageId, undo?, redo? }`; the editor places an ordinary `affine:embed-linked-doc` card on the drop line, or centred on the drop point on the canvas, in one undo step that also calls the host's `undo` / `redo`. No stored format changes. Without the seam nothing changes.
