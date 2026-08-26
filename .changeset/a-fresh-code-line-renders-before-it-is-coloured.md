---
'@labre/affine-block-code': patch
---

A fresh code line renders before it is coloured

Syntax colours arrive asynchronously: while shiki re-tokenises the snippet, the
inline editor is already drawing the line the user just typed. The token table
still described the previous, shorter text, so the new line pointed past the end
of it and the render threw — taking the whole code block down mid-typing.

A line the highlighter has no tokens for is now drawn as plain text, and picks
up its colours on the next pass.
