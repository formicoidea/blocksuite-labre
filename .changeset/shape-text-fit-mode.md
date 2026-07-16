---
'@labre/affine-model': minor
'@labre/affine-gfx-shape': minor
---

Shape text fit modes: a new `textFitMode` prop on shapes (and polygons)
chooses how text and bounds reconcile — `grow` (fixed font, the shape grows;
the previous and default behavior), `contained` (fixed shape, the font size
shrinks so the text fits — post-it behavior) or `overflow` (fixed shape and
font; the text may paint past the bounds). Existing documents are untouched:
the prop reads `grow` via the field fallback. In contained/overflow the
resize clamp ("cannot shrink below the text") is lifted.
