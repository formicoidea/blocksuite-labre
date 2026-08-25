---
'@labre/std': patch
---

A canvas block sits where a scaled host draws it

Inside an embedded edgeless doc the host scales the whole editor, and the
blocks that are not painted on the canvas — notes, images, every component
built on `GfxBlockComponent` — were placed with a transform stated in the
unscaled space. The container then scaled it again, so at any host scale other
than 1 those blocks drifted away from their own element and from the canvas
elements they belong next to: selection, toolbars and handles followed the
element, the visible block did not.

The placement now divides by the host's own scale, so block and canvas agree
again at every scale. An unscaled editor is unaffected.
