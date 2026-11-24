---
'@labre/affine-block-code': patch
---

The browser spellchecker no longer underlines code in a code block: the
block's editable area now has `spellcheck="false"`. Paragraphs and other text
blocks keep the browser default. Fixes #733 (upstream
toeverything/AFFiNE#15902).
