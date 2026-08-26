---
'@labre/data-view': patch
---

The Delete key clears a table selection, like Backspace already did

Table views bound the clearing shortcut to Backspace only. On a full keyboard —
and on every keyboard where Delete is the obvious key for "empty this" — pressing
Delete over a selected cell, a rectangle of cells, or a set of rows did nothing
at all, with no hint that another key was expected.

Delete now runs the same handler as Backspace in both the standard and the
virtualised table: it empties the selected cells, or deletes the selected rows.
Nothing changes for Backspace, and neither key does anything while a cell is
being edited, where Delete belongs to the text cursor.
