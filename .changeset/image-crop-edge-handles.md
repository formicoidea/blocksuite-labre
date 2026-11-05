---
'@labre/affine': minor
---

The image crop frame gains four edge handles, a short bar at the middle of each
side, that resize it along one axis: the dragged edge moves and the opposite
edge stays put. A free frame changes that one dimension only; a 16:9, 4:3 or 1:1
frame grows its other dimension with it, centred, and is pushed back inside the
picture at its border. Like the corners, an edge drag keeps the picture still,
the box follows the window, and one drag is one undo step. Each bar is named by
a new key, `com.labre.image.crop.edge.top`, `.right`, `.bottom` and `.left`
(« Resize from the top edge »…). Nothing persisted changes format (ADR 0037
amendment of 2026-11-05).
