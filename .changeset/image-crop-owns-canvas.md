---
'@labre/affine': patch
---

Cropping an image on the canvas no longer fights the canvas: while the crop frame is open the selection handles are hidden and the canvas zoom and pan are locked, so the frame's own corners can be dragged. The mouse wheel over the crop frame now zooms the picture inside it, around the pointer, in one undo step per scroll; this works on pages too.
