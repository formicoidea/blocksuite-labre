---
'@labre/affine-shared': patch
---

Copying several blocks writes them on separate lines in `text/plain`: `MixTextAdapter.fromSliceSnapshot` joined the copied top-level blocks with nothing, so "aaa" and "bbb" pasted as `aaabbb` in another application. A single copied block is written as before.
