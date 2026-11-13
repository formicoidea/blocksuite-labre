---
'@labre/affine-database-view-block': patch
'@labre/affine-database-block': patch
---

A data-view (`affine:data-view`) cell whose stored value does not match its column (after a type change, an import, or a peer on another version) now reads as the column's default instead of reaching the views raw, where a malformed date or multi-select threw and a malformed checkbox rendered as ticked. The stored value is left untouched: nothing is written when the cell is read. Same rule as the database block (#656). A shape a reader still reads is kept as stored: a rich-text cell stored as a plain string keeps its text when edited or converted. `storedShapeIsReadable(type, value)` is exported for data sources that apply the same rule.
