---
'@labre/affine': patch
---

fix(edgeless): pressing "Generate legend" a second time now REFRESHES the
board's legend instead of stacking an identical box on top of the first one.
The placement is derived from the board, so the copies landed at the same pixel
and were invisible — one legend to the eye, N groups and N × ~15 elements in
the document. The box is replaced in a single undo step (one Ctrl+Z brings the
previous one back whole), which also means hand retouching of the box — a moved
box, a renamed group, a recoloured swatch — is lost on a regenerate. Every
framework that has a legend gets this from the shared button. Known limit: a
legend generated before 0.42, when the `core:legend` role shipped, carries no
role, is not recognised and still stacks; nothing is backfilled, so such a box
has to be deleted by hand once.
