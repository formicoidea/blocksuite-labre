---
'@labre/affine-shared': patch
'@labre/affine-widget-edgeless-selected-rect': patch
---

Auto-complete puts the caret in the note it just created, and its panel where it was clicked

Completing a shape into a note asked the browser to place the caret at a point
measured from the editor's own top left corner, while the browser reads such a
point from the window's. Wherever the editor is not flush against the window —
a sidebar, a header, a panel — the caret was dropped that far away from the new
note, and typing went nowhere. The panel of shape and note choices was opened
from the pointer with the same mismatch, in the opposite direction.

Both now speak the coordinates the browser does. The panel also states its own
position, and the edges it keeps away from, in the space of the container an
embedding host may have scaled, so it stays on screen there too.
