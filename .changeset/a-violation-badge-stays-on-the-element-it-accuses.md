---
'@labre/affine-block-surface': patch
---

A validation badge stays on the element it accuses inside a scaled editor

The PF7 marks — the amber badge, the band that makes a bracket clickable, and
the detail bubble they open — are drawn over the canvas, but were placed in
real screen pixels while the container they live in is the one an embedding
host scales. In a synced edgeless doc opened inside another document the
container applied its scale a second time and the badge accused a blank patch
of paper several elements away, with the bubble flipping at the wrong edge.

They now state their placement the way the element under them does. In a
standalone editor, where the host applies no scale, nothing moves.
