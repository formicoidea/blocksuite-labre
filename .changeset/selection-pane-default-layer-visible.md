---
'@labre/std': patch
'@labre/affine-shared': patch
'@labre/affine-block-surface': patch
'@labre/affine-widget-edgeless-toolbar': patch
---

In the selection pane (unreleased), "Layer 1" is shown from the start: a canvas
with no layer record lists one layer row, the default layer, named with the
first-layer seed (`com.labre.layer.seed.name`, n = 1) and holding every row,
and the headless `selectionPaneTree(std)` returns that same single
`'@default'` layer node, so a host-drawn pane shows the same thing. Nothing is
written to show it, on load or on opening the pane: the default layer's record
is written only by a gesture that needs it — renaming it, hiding it for
everyone, or creating a second layer (which keeps the name it shows). Its eye
hides it for you with nothing written, it is the active layer, and a row dropped
on it leaves any other layer. The default layer is the one that cannot be
deleted, so a canvas keeps one layer at least: its row menu has no delete, and
`canvas.layer.delete` is withdrawn (`when`) while it is the only layer. New
helper `userLayerName(std, id)`.
