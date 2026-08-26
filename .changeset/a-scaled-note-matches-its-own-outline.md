---
'@labre/affine-block-note': patch
---

A note resized on the canvas no longer drifts away from its own outline

A note carries a `scale` of its own on top of the viewport zoom, and that scale
was applied to a wrapper _inside_ the block while the block element itself was
laid out from the unscaled bound. At any scale other than 100% the two parted
company: the painted content ran past the element's box, so the selection
rectangle, the hit area and everything anchored to the block — the toolbar, the
resize handles, the collapse arrow — sat where the note used to be rather than
where it now looks.

The scale now belongs to the block element's transform, the single place that
already carries the zoom, so box and content are the same size again at every
scale. Notes at 100% are unaffected.
