---
'@labre/affine': patch
---

The layout picker of a view's settings (Table, Gallery, List, Kanban) fits a
phone: below 480px its tiles wrap two by two and shrink with the sheet instead of
running past its edge, a label too long for its tile ends with an ellipsis, and
on a touch screen every tile is at least 44px high. A wide screen keeps the
single row it had.
