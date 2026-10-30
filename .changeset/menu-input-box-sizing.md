---
'@labre/affine': patch
---

A menu's text field (a view's name, a new source's name) and its type-ahead field stay inside the menu in a host without a global `box-sizing: border-box` reset: the field declares its own box and shrinks with its row, where it ran a few pixels past the menu's right edge.
