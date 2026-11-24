---
'@labre/affine-block-table': patch
---

"Move Up" in a table row's menu moves the row up (#731, port of upstream
toeverything/AFFiNE b90edc1); it did nothing before. "Move Down" on the last
row and "Move Right" on the last column no longer give the moved item the
order key of the first one, and a move that leaves a row or a column where it
is (first row up, last column right, a drag dropped in place) writes nothing,
so it adds no empty undo step. A row or column added or moved past the end
lands after the last one with a key of its own. Readonly tables refuse moves.
