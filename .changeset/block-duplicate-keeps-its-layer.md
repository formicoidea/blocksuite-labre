---
'@labre/affine-block-root': patch
'@labre/affine-block-surface': patch
'@labre/affine-block-bookmark': patch
'@labre/affine-block-embed': patch
'@labre/affine-block-embed-doc': patch
'@labre/affine-widget-edgeless-selected-rect': patch
'@labre/affine-widget-note-slicer': patch
---

With user layers (unreleased), a duplicated, alt-dragged or copy-pasted frame,
image, attachment, bookmark, embed or other canvas block now stays in its
source's layer, as elements, notes and edgeless texts already did, instead of
landing in the viewer's active layer; a copy of a block hidden for everyone
stays hidden. A paste from another document still lands in the active layer.
A block made from another one also lands beside it: the note an auto-complete
arrow clones, the note the slicer splits off, the block that replaces a link
when its view changes, a linked doc turned into a synced doc and back, and the
note "Duplicate as note" puts beside a synced doc. `sourceLayerOf` is exported
beside `applyCreationLayer` for host code doing the same.
