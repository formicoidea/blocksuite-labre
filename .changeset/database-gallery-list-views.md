---
'@labre/data-view': minor
'@labre/affine-block-database': minor
'@labre/affine': minor
---

Two new database views, Gallery and List (ADR 0035 §1, issues B6 and B7), stored under the modes `gallery` and `list`. A gallery draws one card per row, its title then its visible properties; a list draws one line per row, the title on the left and the visible properties as chips on the right (an empty value draws no chip; on a narrow screen the chips wrap under the title). Both are the table transposed, not a new drawing: every value is drawn and edited by the cell renderer a table cell mounts, with the table's tag menu, date picker and inputs, and while a value edits the rows hold still as in a table. Per-view visibility is stored as table and kanban store it, `columns[].hide`, and the view's Properties popover hides, shows and reorders; filter, sort and search are the engine's. "New page" adds a row at the end and opens it; a click on a card or a row outside its values, or on its open button, opens the row through the detail panel, as the table and kanban open buttons do. A new gallery or list shows the title only, as in Notion; switching a table, a board or a calendar to a gallery or a list (and back to a table or a board) keeps the filter and the sort. One UI serves desktop and mobile (44px rows on a touch screen); editing on mobile follows the block's read-only state. A card has no cover image yet. Nothing is written when a stored gallery or list view is drawn. A value a hosted source has not delivered yet draws the table's skeleton and cannot be edited over; a source whose rows are documents titles its cards and rows through `titleOf`, as its table does.

The database block registers both presets and gives them the table's toolbar (filter, sort, search, view options, New). New key `com.labre.data-view.new-page` ("New page", `@labre/data-view/translations`); the open button reuses `com.labre.open-doc.open`. `<dv-standalone-cell>` gains an optional `onEditingChange(editing)` callback, told when its editor opens and closes.

A host older than this version meeting a stored `gallery` or `list` view takes its unknown-view path (ADR 0035 §6).
