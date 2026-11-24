---
'@labre/affine-block-table': patch
---

A drag selection across table cells follows the pointer while the page or the
table scrolls (#728, port of upstream toeverything/AFFiNE 05dd274). The
selected area used to be computed from cell positions captured when the
button went down, so after a scroll it no longer matched the cells under the
pointer, and a scroll with the pointer at rest updated nothing. The cell
positions are now read again on every move and on every scroll during the
drag. A table removed while a drag selection is in progress no longer leaves
that selection's listeners on the window (the column, row and width drags are
unchanged).
