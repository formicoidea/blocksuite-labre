---
'@labre/affine-block-table': patch
---

A table selection no longer wipes the canvas selection: in edgeless, placing the caret in a table cell or selecting then clearing a column keeps the note in edit mode and leaves other selected canvas elements selected (#659, upstream toeverything/AFFiNE#15791).
