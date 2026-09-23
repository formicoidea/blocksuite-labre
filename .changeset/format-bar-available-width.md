---
'@labre/affine-widget-toolbar': patch
'@labre/affine-components': patch
---

The selection toolbar keeps its whole row at every window size: it now measures the room the editor has instead of what a row centred on the selection would overhang by, slides along the edge rather than sending an action into the "⋮", and can no longer paint outside its own background.
