---
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-edgy': patch
'@labre/affine-widget-edgeless-toolbar': patch
---

Selection pane fixes from the product owner's review (the pane is unreleased). A
row no longer shows a raw `com.labre.*` key: the ten Wardley roles and three EDGY
board roles that declared a `labelKey` with no `labelFallback` now carry their
English wording, and a role with no wording at all reads as its element type.
