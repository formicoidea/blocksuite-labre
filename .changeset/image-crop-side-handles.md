---
'@labre/affine': minor
---

The image crop frame gains four side handles beside its corners: a side
resizes one dimension, the opposite side pinned (`ns-resize` / `ew-resize`).
On a ratio preset (16:9, 4:3, 1:1) a side keeps the ratio by scaling the
other dimension about its centre line, and stops where the picture stops it.
Every handle offers a 44px target to a coarse pointer. The wheel over the
frame now stops at 4x, like the zoom slider; a window already past 4x is not
thrown back. The element toolbar is hidden while the frame is open, page and
canvas, and shown again when it closes. One handle drag is still one undo
step. Nothing persisted changes format.
