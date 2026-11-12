---
'@labre/affine-database-engine': patch
'@labre/affine-database-block': patch
---

A read-only database (a public share, a reader's view, a page in the trash) now opens its rows on desktop when they are pages and the host registered `DatabaseOpenRowExtension`: the table keeps its open button on the title column and a kanban card opens on a click, as the phone table already did. Editing stays off and opening writes nothing; without an opener, or over rows that are blocks, a read-only view behaves as before.
