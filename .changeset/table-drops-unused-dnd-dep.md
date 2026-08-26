---
'@labre/affine-block-table': patch
---

Remove the unused `@atlaskit/pragmatic-drag-and-drop` dependency from the table block. Table drag behaviour goes through `@labre/std`'s `DndController`, which owns the real dependency, so the table package now ships a slimmer dependency set.
