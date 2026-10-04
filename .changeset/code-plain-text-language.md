---
'@labre/affine-block-code': minor
---

The code block's language picker now starts with a "Plain Text" entry that
clears the block's language (no highlighting), shows the active mark when the
block has none, joins the recently-used order like any other language, and is
found by typing "plain", "text", "none" or its label. It reuses the existing
`com.labre.code.language.plain-text` key; no stored format changes.
