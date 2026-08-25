---
'@labre/affine-block-table': patch
---

Keyboard shortcuts work inside a table cell, and stay there

A table cell used to swallow every keystroke that was not Escape or Tab, so
none of the shortcuts a person uses while writing — bold, italic, underline,
code, the bracket helpers — did anything once the caret was in a table. The
only way to format text in a cell was the toolbar.

The cell now lets those keystrokes through to a keymap registered for the table
itself: the shortcuts work in the cell and are answered there, rather than
leaking out to the document and acting on the page. Tab still stays inside the
table, and the framework chords (Wardley and friends) are untouched — they have
never armed while the caret is in editable text.
