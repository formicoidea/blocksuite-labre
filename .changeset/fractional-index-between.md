---
'@labre/affine-shared': patch
---

`generateFractionalIndexingKeyBetween(a, b)` no longer returns a key that sorts after `b` when `b` continues the shared prefix with a `0` (repeatedly inserting a table row or column right after the first one could reorder it). Only newly generated keys change; keys already stored in documents are read and compared as before, and a forged key in a document can no longer stall the insert. A neighbour key the fractional-indexing package cannot handle (a forged run of thousands of `z` overflowed its recursion with a `RangeError`) now fails with a `BlockSuiteError` (code `DefaultRuntimeError`, the key is not quoted): the table insert fails before writing anything and the editor keeps working. No key is refused for its length, and every other error of the package is thrown as before.
