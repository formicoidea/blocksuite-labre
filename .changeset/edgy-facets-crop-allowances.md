---
'@labre/affine-gfx-edgy': patch
---

The EDGY facets diagram is born on its drawing instead of inside 127 units of
nothing, so clicking near the visible edge selects the board. The room kept for
the three facet names is now measured and asymmetric — the words are ("Identity"
on the left, "Architecture" on the right) — instead of one symmetric 140 either
side, and a new diagram is born at 687 × 466.5 rather than 874.5 × 487.5, with
the Venn itself drawn at exactly the same size.

A facets board created before this change keeps its `xywh`, so its drawing grows
by 4.5 % and slides 27 units left (3.1 % of the width) and 4 units down: anything
dropped on top of it stays where it was and therefore shifts by that much
relative to the circles. Only a board that is cropped AND shows its names is
concerned — the EDGY dynamic template hides them, and its geometry is untouched.
