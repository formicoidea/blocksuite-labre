---
'@labre/affine-gfx-ddd-core-domain': patch
---

The Core Domain Chart's frame now sits on its drawing instead of a tenth of the
element away from it, so clicking near the visible edge selects the chart. The
margins are each the ink they host (4 / 8 / 37 / 48 instead of 24 / 54 / 50 / 60) and a new chart is born at 842 × 787 so its plot is the 786 × 746 it has
always been — a new chart is drawn at exactly the same absolute size as before.

A chart created before this change keeps its `xywh`, so its plot grows into the
freed margins: +7.4 % wide and +4.4 % tall on a chart still at its old birth
size. The drawing is the same drawing, but the zone boundaries move with the
plot — 16 units, 1.8 % of the element's width, for the Core / Supporting divide
— so an artefact whose centre sits inside that band changes zone, and with it
the verdict of any rule that reads its zone.
