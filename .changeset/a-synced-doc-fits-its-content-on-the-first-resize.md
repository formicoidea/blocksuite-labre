---
'@labre/affine-block-embed-doc': patch
---

An embedded synced doc fits its content on the first resize after a zoom change

The block refits the nested editor to its content whenever it is resized, and
that fit reads the nested viewport's bounding rect — a value cached until the
viewport's own resize observer clears it. The fit was installed before the
nested editor rendered, so its observer ran first and the first resize after a
zoom change fitted to the size the block had before: the content inside the
block was visibly the wrong size until the next resize.

The fit is now installed after the nested editor has rendered, so it always
reads an up-to-date size.
