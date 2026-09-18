---
'@labre/affine-components': patch
'@labre/affine-shared': patch
---

A colour picker's palette name now reads as the panel's title, on the same left edge as its labels and its swatches, and clicking it swaps the swatches for a list of every palette — each row showing its own colours, one click to any of them. Paging (by the list or by a wheel anywhere over the picker) slides the swatches in from the side the palette came from, with a spring settle that stops under `prefers-reduced-motion`, and the panel keeps its width throughout.
