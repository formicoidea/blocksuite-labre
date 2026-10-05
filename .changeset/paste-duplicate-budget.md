---
'@labre/affine-block-root': patch
'@labre/affine-shared': patch
'@labre/std': patch
---

Duplicating or pasting a large selection no longer freezes the page:
duplicating a frame holding 400 shapes and 5 groups now takes about 0.6 s
instead of 4.7 s (8.7 s in 0.43.1), and one undo removes it whole. Pasted
canvas elements are created with their final stacking index instead of being
re-indexed one by one, the layer manager finds an element's place by bisection
instead of comparing it with every element of the board, and the last-used
style merge no longer validates every plain value against the colour schema.
