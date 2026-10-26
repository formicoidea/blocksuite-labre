---
'@labre/affine': patch
---

Markdown adapters: a callout exports its marker unescaped (`> [!💡]`, not `> \[!💡]`) so GFM and Obsidian readers and a write-back keep it a callout (#520); a slice import keeps nested lists under `1.`, `1)`, `*` and `+` items, which the plain-text preprocessor used to fold into their parent's text (#519).
