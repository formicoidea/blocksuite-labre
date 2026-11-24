---
'@labre/affine-database-engine': patch
---

A shortcut typed in a database view's search field now stays in the field
(#730, upstream toeverything/AFFiNE#15900): Ctrl/Cmd+A selects the search
text instead of selecting every row of the table, and Ctrl/Cmd+Z undoes the
typing instead of undoing the document. Every key typed in a text field of
the view toolbar, the views bar or the quick-setting bar is the field's,
Escape excepted: from a search field opened with the mouse, Escape still
reaches the page, as before. Shortcuts typed on a toolbar control (not a
field) still go through to the editor.

Hosts: a document-level shortcut of your own (Ctrl/Cmd+K, Ctrl+S) no longer
fires while the caret is in one of these fields, since the keydown stops at
the bar; listen in the capture phase if one must still fire there.
