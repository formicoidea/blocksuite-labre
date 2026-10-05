---
'@labre/affine-block-root': patch
---

With user layers (unreleased), a duplicated, alt-dragged or copy-pasted frame,
image, attachment, bookmark, embed or other canvas block now stays in its
source's layer, as elements, notes and edgeless texts already did, instead of
landing in the viewer's active layer; a copy of a block hidden for everyone
stays hidden. A paste from another document still lands in the active layer.
