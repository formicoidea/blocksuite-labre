---
'@labre/affine': minor
---

A host can choose the view a database opens on. `DatabaseInitialViewExtension({ initialView })` (`@labre/affine/blocks/database`) is asked `initialView({ blockId })` once, when the block builds its data source; a view id the block has opens that view, anything else keeps the previous behaviour (the view this tab last showed, else the first). Absent or `null`, nothing changes. Opening on a view writes nothing to the document.
