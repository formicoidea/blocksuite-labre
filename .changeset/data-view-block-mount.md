---
'@labre/affine-database-view-block': patch
---

The `affine:data-view` block element no longer throws while it is constructed: its view logic is now built on first render, as the database block's is. The block still does not render (its data source predates the current database engine); that is tracked separately.
