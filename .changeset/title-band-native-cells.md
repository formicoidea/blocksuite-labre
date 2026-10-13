---
'@labre/data-view': minor
'@labre/affine-fragment-doc-title': minor
'@labre/affine-block-database': minor
---

The title band's chips are now the inline table's own cells (ADR 0035 §11, amended 2026-10-13): each value is drawn and edited by the cell renderer a table cell mounts for its type, with the table's look, in the page view and in the note header on the canvas. The checkbox toggles; a select or multi-select opens the table's tag menu, on the host's options only (no "Create", no option menu, no reordering, since the band cannot write a property's config); a date opens the table's date picker; a number, a progress and the text types open the table's inputs; a `link` or `url` is the database block's link cell. A number reads as in a table cell, unformatted unless `enable_database_number_formatting` is on, and a date reads `yyyy/MM/dd`. `TitleBandService` is unchanged: a committed value still goes through `set`, `null` for an emptied one, nothing for an unchanged one.

`@labre/data-view` gains a cell outside any view: `createStandaloneCell(meta, source)`, the `<dv-standalone-cell>` element that owns the table's edit lifecycle, and `StandaloneCellMetaExtension(meta)` / `StandaloneCellMetaProvider` for a cell type a package above registers (the database block registers its link cell). `Property` gains an optional `dataCanSet` (absent means writable), and the tag menu's `onOptionsChange` becomes optional: absent, its options are fixed. The text cell no longer writes its old value back after Enter.

Removed from the `doc-title` entry: `chipEditorKind` and `ChipEditorKind` (unused: the cell of each type decides what a click opens; no replacement). The key `com.labre.title-band.clear` is gone (the date picker's own Clear replaces it).
