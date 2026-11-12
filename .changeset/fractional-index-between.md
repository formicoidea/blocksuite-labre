---
'@labre/affine-shared': patch
---

`generateFractionalIndexingKeyBetween(a, b)` no longer returns a key that sorts after `b` when `b` continues the shared prefix with a `0` (repeatedly inserting a table row or column right after the first one could reorder it). Only newly generated keys change; keys already stored in documents are read and compared as before.
