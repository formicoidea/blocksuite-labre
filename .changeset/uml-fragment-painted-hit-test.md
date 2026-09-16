---
'@labre/affine-gfx-uml': patch
---

fix(edgeless): a combined fragment's rename gestures follow the words the canvas actually paints. A split fragment stored before operands existed can carry both a declared `name` and its `operands`, and the renderer already hides the declared guard behind operand zero's so the corner is not painted twice — but the hit test still derived a rename box from the stored model, so a double-click in that corner opened an in-place editor on a string nothing draws. The view now hit-tests against the same painted declaration the renderer is handed, so no label is clickable where none is drawn.
