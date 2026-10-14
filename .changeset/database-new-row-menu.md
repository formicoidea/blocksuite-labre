---
'@labre/data-view': minor
'@labre/affine-block-database': minor
'@labre/affine': minor
---

Two additions for a host that backs a database with its own pages (ADR 0035, amendment of 2026-10-14). **The menu beside "New":** `DatabaseNewRowMenuExtension({ open })` (`@labre/affine/blocks/database`, identifier `DatabaseNewRowMenuProvider`) draws a chevron beside the "New" button of every view (table, kanban, gallery, list, calendar, inline and on the full page); a click calls `open({ anchor, blockId, viewId })` and the host draws its menu (its templates). "New" itself still adds a row through the source's `rowAdd`, where a host applies its default template. Absent or `null`, "New" is the single button it was. The chevron's label and tooltip is the new key `com.labre.database.new-record.more` ("Templates and options"); 44px on a coarse pointer. **A text column for hosted sources:** `hostedTextColumnConfig` (same entry) is data-view's plain-text preset (type `text`, a string value, the table's plain-text cell) offered by "+ property" and "Type" on a source that lists it in `getPropertyMetas` and answers it from `propertyMetaGet('text')`. The inline database does not offer it: its Text stays `rich-text`. No stored field changes.
