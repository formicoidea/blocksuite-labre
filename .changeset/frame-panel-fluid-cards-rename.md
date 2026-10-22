---
'@labre/affine-fragment-frame-panel': minor
'@labre/affine': minor
---

The frame panel's cards take the panel's width and the frame's proportions (a portrait frame is capped at a square) and follow the panel when it is resized: a wider panel shows bigger cards, so fewer at once. A double-click on a card's name now opens a field committed once through `canvas.frame.rename`: Enter or leaving the field saves in one undo step, Escape and an unchanged name write nothing, a read-only document opens no field (it was a rich text written on every key). The order still changes by dragging a card, and a double-click on a preview still frames it on the canvas.

`@labre/affine/host-panels` widens for a host's own slide list: `createFramePreview(std, frame, { fluid: true })` draws the same fluid preview; `createPanelReorderDrag`, `panelReorderGap` and their types are the library panels' drag-to-reorder gesture; `selectionPaneCommands` carries `canvas.frame.rename`, runnable in page mode like `canvas.frame.reorder`. Nothing stored changes.
