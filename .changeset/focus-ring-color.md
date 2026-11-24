---
'@labre/affine': minor
'@labre/affine-components': minor
'@labre/affine-widget-edgeless-toolbar': minor
---

Every keyboard focus ring now reads `--affine-focus-ring-color` first, then
the token it read before (issue #724). A host theme can give the ring its
own colour, for instance one that keeps 3:1 under the toolbars' hover veils
in dark while the accent stays dark enough to fill a control with a white
label. The library ships no value: without it, nothing changes.
