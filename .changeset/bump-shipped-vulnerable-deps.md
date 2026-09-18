---
'@labre/affine-widget-page-dragging-area': patch
'@labre/affine-widget-keyboard-toolbar': patch
'@labre/affine-block-surface-ref': patch
'@labre/affine-widget-linked-doc': patch
'@labre/affine-block-surface': patch
'@labre/store': patch
---

Raise the floor of three runtime dependencies that ship inside the published
bundles to their smallest patched release: `fflate` (infinite loop on a
malformed ZIP64 archive), `nanoid` (infinite loop on a negative or zero id
size) and, transitively, `mdast-util-to-hast` (unsanitized `class` attribute).
Generated ids are unchanged: same alphabet, same default length.
