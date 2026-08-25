---
'@labre/affine-block-surface': patch
---

The surface canvas fits its block again inside a scaled host

An embedded edgeless doc is drawn by a host that scales the whole editor, and
the viewport reports its size through `getBoundingClientRect()` — a size that
already carries that outer scale. The canvas was sized from those numbers and
then scaled a second time by the container, so at any host scale other than 1
it spilled past the block it belongs to: everything painted on the canvas —
the Wardley, EDGY, DDD and Cynefin frameworks included — sat outside the
block's own frame.

The canvas now carries the inverse of that scale, so all drawing stays in the
surface's own coordinate space. An unscaled editor is unaffected.
