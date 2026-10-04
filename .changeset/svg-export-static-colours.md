---
'@labre/affine-block-surface': patch
---

"Export SVG" now writes every fill, stroke and gradient stop as an SVG 1.1
paint: a translucent colour (the Wardley area and pipeline washes, the DDD
zones) leaves as `rgb()` plus `fill-opacity` / `stroke-opacity` / `stop-opacity`
instead of an 8-digit hex, and `transparent` leaves as `none`, so PowerPoint and
other SVG 1.1 importers keep the board's colours instead of substituting their
theme colour. Stored values are unchanged.
