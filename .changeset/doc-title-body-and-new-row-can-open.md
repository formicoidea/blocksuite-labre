---
'@labre/affine-fragment-doc-title': minor
'@labre/affine-block-database': minor
'@labre/data-view': minor
---

A database's full page no longer writes into its note from the title, and the menu beside "New" can be offered per database (ADR 0035, amendment of 2026-10-14).

- `<doc-title>` gains `bodyBlockId` (optional). Set to the database block a full page shows, Enter and ArrowDown leave the title for that block (the first cell of a table or kanban view, through the new `DatabaseBlockComponent.focusFirstCell()`) and never add a paragraph to the note. Unset, the title behaves as before.
- `DatabaseNewRowMenuService` gains `canOpen?({ blockId, viewId })` (type `DatabaseNewRowMenuTarget`): the chevron beside "New" is drawn only where it returns `true`, asked at each render. Absent, every view keeps its chevron, as before.
