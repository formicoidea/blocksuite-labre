---
'@labre/affine': patch
---

Code block: the stored `language` is no longer rewritten while rendering (alias → id normalisation and the unknown → `null` fallback are derived for display), so opening a document writes nothing and a read-only store stays untouched; the language picker writes through `updateBlock` after `captureSync`, one undo step; the HTML and Notion importers store `null` for plain text instead of `'Plain Text'`.
