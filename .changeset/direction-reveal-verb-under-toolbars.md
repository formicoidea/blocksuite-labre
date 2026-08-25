---
'@labre/affine-gfx-connector': patch
'@labre/affine': patch
---

fix(edgeless): the direction label is the verb alone, and it stays under the toolbars

Second PO pass on the direction reveal (recette of 02/08/2026, points 4 and 5).
Two complaints, one about the layer and one about the length.

**It painted over the senior menu.** The label belongs to the canvas — it is
glued to a link, in model units, turning and scaling with the map — and the
toolbars overhang the canvas. Its host sat at `z-index: 2`, which cleared
`edgeless-toolbar-widget`'s `1`, and the senior menu rides on that host's
z-index because its sub-menus are appended inside its own subtree. The host is
at `0` now: under the bottom toolbar and under `editor-toolbar`'s
`--affine-z-index-popover`, and still over the canvas, since
`.widgets-container` has `contain: layout` and paints as a whole above
`.edgeless-container`. This is the deliberate reverse of the reading panel's
choice — that panel is what the user is reading, so the toolbars wait
underneath it; this one is part of the drawing.

The armed tool's hint now hangs upwards from its anchor line rather than
downwards, so the whole box clears the toolbar strip instead of having its
lower third clipped by the toolbar it no longer paints over.

**The label said too much.** `Kettle depends on Electricity` is a box longer
than most links: it overhung both ends and covered the very components it was
naming. The label is the **verb alone** now — `depends on` — still laid along
the link, still ending in a point aimed at the provider, and still turning that
point over when the edge is reversed. The two names are already drawn at both
ends of the line; what the drawing does not say is what the line MEANS.

Reading the names out of the document (`endpointNamesOf`) had no consumer left
and is deleted. The reading panel resolves its own names through
`readRelations`, where a name in prose is the point rather than an overlay.
