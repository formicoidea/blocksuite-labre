---
'@labre/affine-gfx-connector': patch
---

A connector endpoint dragged inside a frame stays where it is dropped (#740,
port of upstream toeverything/AFFiNE f0e5009). It used to snap to one of the
frame's edge anchors wherever it was inside the frame. A frame is now reached
only within 8 units of its border, the distance at which an endpoint already
attached to any element's outline; an endpoint over a shape drawn in the frame
still attaches to that shape. Framework boards are unchanged: they were never
connection targets, and an endpoint inside one stays free unless it is over a
node.
