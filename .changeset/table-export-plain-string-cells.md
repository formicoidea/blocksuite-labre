---
'@labre/affine-block-table': patch
---

Markdown, plain-text and HTML export (and copy as Markdown) no longer fail on
a table cell stored as a plain string or with no text at all (#732, port of
the table part of upstream toeverything/AFFiNE 89bdb9c). Such cells come from
imported or older snapshots or from a host write; a string cell now exports
its text and a cell without text exports as an empty cell, exactly like the
equivalent rich-text cells. Export only reads the snapshot: nothing is
rewritten.
