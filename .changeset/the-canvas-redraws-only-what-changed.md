---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-brush': patch
'@labre/affine-gfx-shape': patch
'@labre/affine-gfx-connector': patch
'@labre/affine-block-root': patch
'@labre/affine-model': patch
'@labre/global': patch
'@labre/std': patch
---

A big board stays responsive: the canvas redraws only what changed

Every element event repainted the whole surface, and every stacking canvas was
allocated at full viewport size however little of it a layer occupied — on a
1440x900 screen at device pixel ratio 2 that is about 20 MB of pixel buffer per
layer, whether the layer held one shape or a hundred. Editing a large map spent
most of its frame budget in redraws nothing on screen could tell apart.

A stacking canvas is now sized to the bound of the elements it actually holds,
clipped to the viewport, and canvases freed by a layer change are pooled for
reuse instead of being thrown away. A change to one element marks only the
layer it lives in, so a pan, a zoom or a single edit no longer forces a full
repaint. During a drag a layer's canvas is allowed to grow but never to shrink,
so the dragged element does not flicker at the edge of its own canvas; the full
redraw comes once, when the drag ends.

The DOM renderers for brush, highlighter, shape and connector now keep the
nodes they already built and overwrite their attributes, instead of rebuilding
the whole SVG subtree on every frame — a hundred redraws of one stroke now
allocate two nodes in total instead of two hundred.

Alongside: a block host re-reads its stacking order when the layers change, so
a reorder shows immediately; sending a mindmap node backwards moves the whole
mindmap once rather than each selected node in turn; and a connector whose path
is momentarily empty answers its geometry questions instead of throwing.
