---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-uml': patch
---

Export SVG now works for a sequence diagram with a lifeline (it used to fail silently), and keeps the frames nested inside the exported board — UML subjects, partitions, regions and fragments, C4 boundaries — while still leaving out a neighbouring board that only overlaps it.
