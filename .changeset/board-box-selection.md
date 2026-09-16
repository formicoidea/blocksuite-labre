---
'@labre/std': patch
'@labre/affine-model': patch
---

fix(blocks): a framework board joins a box (marquee) selection only when the rectangle holds the whole board — the native frame block's rule. A rectangle dragged on the sheet lassoes what is drawn there and never the sheet itself, so a board is picked by its border and bands only (rule R9). The model carries the answer (`boxSelectable`) and the default element view defers to it, for every framework's boards at once.
