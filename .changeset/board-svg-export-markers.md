---
'@labre/affine-block-surface': minor
'@labre/affine-gfx-wardley': minor
---

"Export SVG" now marks every element it draws with `data-labre-*` attributes (its id, type, role, bound, connector ends and group — ids and vocabulary only, never text) and stamps the file with `data-labre-svg="1"`, and Wardley's SVG import reads Labre's own export back as the same native map.
