---
'@labre/affine-block-frame': patch
'@labre/affine-gfx-template': patch
'@labre/affine-block-image': patch
'@labre/affine-block-attachment': patch
---

With user layers (unreleased), a frame drawn with the frame tool, made from the
selection (`f`), placed from the frame menu presets or the surface-ref slash
menu now lands in the viewer's active layer instead of always in the default
layer, keeping the index the frame stacking rules give it. A template insertion
and images or attachments put on the canvas land in the active layer too, as
ADR 0031 §6 says. With only the default layer, nothing new is written.
