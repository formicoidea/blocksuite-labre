---
'@labre/affine-gfx-brush': patch
'@labre/affine-gfx-shape': patch
'@labre/affine-gfx-connector': patch
'@labre/affine-block-surface': patch
'@labre/std': patch
---

Pen and highlighter strokes paint in the DOM, and every canvas element stacks where its layer says

The DOM renderer knew how to paint shapes and connectors but not brush or
highlighter strokes, so a board rendered through it lost every pen mark. Both
strokes now have a DOM renderer of their own, drawing the same path the canvas
renderer draws.

Stacking was decided twice and disagreed. Each element renderer set its own
`z-index` while a canvas layer only ever reserved a single CSS index, however
many elements it held — so a shape and the note stacked just above it could
claim the same value and overlap the wrong way round. A canvas layer now
reserves one index per element, exactly like a block layer, and the `z-index`
is written once, by the DOM renderer, for every element it paints.
