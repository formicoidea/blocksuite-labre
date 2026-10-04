---
'@labre/std': minor
'@labre/affine-shared': minor
'@labre/affine-block-surface': minor
'@labre/affine-widget-edgeless-toolbar': minor
'@labre/affine': minor
---

Hide and delete a whole user layer (ADR 0031, stage 7). A layer row in the
selection pane gets an eye (hide the layer for yourself: nothing written,
remembered per document in `localStorage` under `localHiddenLayers`) and a menu
with "Hide for everyone" — one `hidden: true` on the layer's record, never a
write per member, painted with the theme warning tokens — and "Delete layer",
which removes the layer with everything in it in one undo step (not offered for
the default layer; a connector of another layer whose ends were there stays,
loose). `canvas.visibility.hideLocal` and `canvas.visibility.hideForEveryone`
accept `layerIds`; `canvas.visibility.showAll` also shows the layers you hid;
new command `canvas.layer.delete`. `gfx.localVisibility` gains
`registerLayers` / `hiddenLayerIds$`, and `GfxController.hiddenForEveryone`
gains `layerIds$`: a model whose effective layer is hidden is not painted,
picked or exported, and rules still count it. The selection pane seam's row now
states what `null` leaves behind.
