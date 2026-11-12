---
'@labre/affine-database-block': patch
---

A database cell whose stored value does not match its column (after a type change, an import, or a peer on another version) now reads as the column's default instead of `undefined`, so the cell renders and readers get a value of the expected type. The stored value is left untouched: nothing is written when the cell is read (#656).
