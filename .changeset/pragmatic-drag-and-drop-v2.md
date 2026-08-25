---
'@labre/std': patch
'@labre/affine-block-table': patch
---

Drag and drop runs on Pragmatic drag-and-drop v2

`@atlaskit/pragmatic-drag-and-drop` moves to v2, its hitbox companion to v2 and
its auto-scroll companion to v3. The three majors only drop the legacy
TypeScript 4 type declarations, which we never consumed — the runtime API is
unchanged, so dragging blocks, table rows and columns, and the edge detection
that decides where a drop lands, all behave exactly as before.

The bump also brings in the fixes released since 1.x: custom native drag
previews now render in the browser's top layer instead of relying on a maximal
`z-index`, and previews inside Safari's top layer no longer pick up stray user
agent styles.
