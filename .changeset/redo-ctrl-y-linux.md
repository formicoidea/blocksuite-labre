---
'@labre/affine-block-root': patch
---

Ctrl+Y now redoes on Linux as well as Windows. The `redo-windows` alias was
gated on Windows alone, so on Linux the keystroke did nothing; it stays unbound
on mac, and its id is unchanged so persisted shortcut overrides keep resolving.
