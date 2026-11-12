---
'@labre/affine-database-block': patch
'@labre/affine-database-engine': patch
---

A database cell whose stored value does not match its column (after a type change, an import, or a peer on another version) now reads as the column's default instead of `undefined`, so the cell renders and readers get a value of the expected type. The stored value is left untouched: nothing is written when the cell is read (#656). A shape a reader still reads is kept as stored: a rich-text cell stored as a plain string keeps its text when edited, converted, exported as JSON or copied by drag-to-fill (as a source or a target, in the table and the virtual table). `storedShapeIsReadable(type, value)` is exported for data sources that apply the same rule.
