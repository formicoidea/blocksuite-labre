---
'@labre/affine-block-table': patch
---

Table columns resize on the whiteboard again

On the canvas, grabbing a column edge — or a column/row drag handle — moved the
whole table instead of the column: the edgeless layer picks up the pointer
first, so the gesture became a block drag before the table's own listener ever
saw it. The affordance was there, it just did nothing you wanted.

The table now claims a gesture that starts on one of its handles, so resizing
and reordering behave the same on a page and on a whiteboard. Dragging anywhere
else in the table still selects cells, and moving the table itself is unchanged.
