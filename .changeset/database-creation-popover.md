---
'@labre/affine': minor
---

With a host data-source picker that creates databases, "Table View" and "Kanban View" now insert the database at once and offer its source in a popover ("New empty source", "Link an existing source"), connected in one undo step; closing the popover keeps the native database. New: `connectDatabaseToSource`, `DatabaseCreationMenuExtension` / `DatabaseCreationMenuIdentifier` (`@labre/affine/blocks/database`), `databaseCreationMenu` (`@labre/core-database/view`), the optional `initialRows` of `insertDatabaseBlockCommand` and `databaseViewInitTemplate`, and the picker's `offerCreate` option. A host without the `core-database` bundle keeps the 0.61 path.
