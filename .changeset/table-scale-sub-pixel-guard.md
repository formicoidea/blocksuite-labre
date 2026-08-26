---
'@labre/affine-block-table': patch
---

fix(blocks): guard table scale detection against sub-pixel rounding

`getScale()` compared `getBoundingClientRect().width` to `offsetWidth` to
detect a CSS transform, but `offsetWidth` is rounded to an integer while the
rect is fractional. On a fractional devicePixelRatio (Windows 175% → dpr 1.75)
a plain fractional CSS width therefore read as a phantom ~1.0001 scale, which
skewed the selection overlay rects and — worse — the column widths persisted
into the document on resize drag.

The fix: within rounding distance (|rect.width − offsetWidth| ≤ 0.5) there is
no transform, return exactly 1. Same guard rationale as the sub-pixel fix
pattern; the identical unguarded quotient in the std gfx viewport is tracked
separately.
