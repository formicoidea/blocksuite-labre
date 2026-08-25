---
'@labre/std': patch
'@labre/affine-widget-toolbar': patch
---

A group measures its children once per change, not once per look

The bound of a group is the union of the bounds of everything it contains, and
it was recomputed from scratch on every single read of `xywh` — while the
renderer, the hit test, the selection rect and the toolbar anchor read it many
times per frame. A board with large groups spent most of a pan or a drag
re-adding the same rectangles together.

The union is now computed once per change instead: the surface refreshes the
group when a child moves, is rotated, hidden, added or removed, and merely
marks it stale for the props only some elements fold into their own bound (the
vertices of a polygon, the label of a connector), so the next read still sees
the right rectangle. On a group of 200 elements, 500 reads between two moves
went from ~230 ms to ~5 ms.

The toolbar likewise measures the selection once when it changes, instead of on
every frame of a pan.
