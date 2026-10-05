---
'@labre/affine-block-surface': minor
'@labre/std': minor
---

Dragging elements on the canvas towards the edge of the viewport now pans the
board, as the selection rectangle already did: within 20 px of the edge the
viewport keeps scrolling while the pointer is held there, the dragged elements
stay under the pointer, and the pan stops on release. The gesture is still one
undo step; nothing pans on a readonly board or for a locked element. An element
move also no longer snaps back to where it started when the board is panned
under it (wheel or auto-pan).
