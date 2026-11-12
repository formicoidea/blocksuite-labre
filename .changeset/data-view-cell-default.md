---
'@labre/affine-database-view-block': patch
---

A data-view (`affine:data-view`) cell whose stored value does not match its column (after a type change, an import, or a peer on another version) now reads as the column's default instead of reaching the views raw, where a malformed date or multi-select threw and a malformed checkbox rendered as ticked. The stored value is left untouched: nothing is written when the cell is read. Same rule as the database block (#656).
