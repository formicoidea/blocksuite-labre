---
'@labre/affine-gfx-text': patch
---

`charWidth.calculate` keeps one width per character: a character beyond one UTF-16 unit (an emoji) is no longer cached under its first unit, which every emoji from U+1F300 to U+1F64F shares. A canvas text whose long word of emojis is cut by `wrapText` now breaks where the emojis' own widths say. A text without emoji measures and wraps as before, and no stored size is rewritten.
