---
'@labre/data-view': minor
'@labre/affine-block-database': minor
'@labre/affine-shared': minor
'@labre/affine-fragment-doc-title': minor
'@labre/affine-database-editor': minor
'@labre/affine': minor
---

Three database seams and option edits from the title band (ADR 0035 §9a to §9c, issues B9, B10, B12). `DatabaseOpenRowExtension({ open })` (`@labre/affine/blocks/database`) receives every row a view opens when the source's rows are documents, with the view's stored `openIn` as `mode` (`side` when absent) and `newTab` for a Ctrl/Cmd click; without it, rows open in the detail panel as before. The view options' "Properties" asks `PropertiesPanelExtension` with `scope: 'source'`, and the bundle's `affine-database-properties-panel` element draws the view's properties list for the host to mount where it wants; without the seam, the popover stays. `DataSourcePickerExtension({ list, createDatabase?, createSource? })` (`@labre/affine/shared/services`) adds a "Linked view of a database" slash entry that inserts a view of an existing source (`popDataSourcePicker` in `@labre/core-database/view`); registered without `createDatabase`, "Table View" and "Kanban View" leave the slash menu, with it they ask the host for a new database. `TitleBandService.setData?` and `TitleBandProperty.dataWritable?` let a select chip create and rename options. New keys: `com.labre.database.properties-panel.{title,show-all,hide-all,unavailable}`, `com.labre.database.picker.{title,new-source,new-database,empty}`, `com.labre.database.slash.linked-view` and `.linked-view.description`. Nothing is written on load.
