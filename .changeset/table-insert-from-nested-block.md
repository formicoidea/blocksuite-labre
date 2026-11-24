---
'@labre/affine-block-table': patch
---

Inserting a table from a nested list item, a nested paragraph or a paragraph
inside a callout now works (#729, port of upstream toeverything/AFFiNE#14840).
Nothing happened before: the table was refused next to a block whose parent
cannot hold a table, and the error was swallowed. The table now goes after the
closest enclosing block that can have a table beside it, as the document
schema decides; the empty line left by the slash menu is still removed. A
readonly document gets no table.
