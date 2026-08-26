---
'@labre/affine-block-surface': patch
'@labre/affine-shared': patch
'@labre/affine': patch
---

feat(blocks): a framework background can declare zones its instances shape

Until now a background's zones were the framework's: the same four quadrants on
every Cynefin grid, the same four phases on every Wardley map. A framework can
now declare that its elements carry a partition of their OWN plot —
`instanceZones` names the model prop that holds it, which way the pieces stack,
the line drawn between two of them and the style their names are written in.
The named consumer is the **BPMN pool's lanes (couloirs)**, arriving in the next
tranche; this one is the platform capability alone, and no framework in the
library declares the field yet.

Sizes are relative **weights**, never lengths. A pool with lanes of `1, 2, 1`
gives the middle one half its height at any size, and dragging the pool taller
redistributes the extra space proportionally instead of leaving a gap under the
last band. It is the same reasoning every position in the primitive is a ratio
of the plot for: a background survives being stretched, and so must the
partition the user drew on it. A row with no finite, positive size is dropped
with a warning and its neighbours share the space — one band fewer, never an
invented one, and never a broken frame.

The dividers are painted with the zone tints they separate, under the
graduations and the axis lines; the names are written horizontally at the
top-left of each band, with the other texts. Zone names are drawn by the
renderer and are **not** double-clickable on the canvas: the label walk that
feeds the hit tester is a function of the declaration alone, and a zone is
created, deleted and renamed through its framework's own tooling.

The audit reports an instance's zones after the framework's, namespaced
(`lane:sales`) so a user-named zone cannot shadow a declared one, and carrying
the user's own wording in a new optional `name`. An element's `zone` fact
therefore now reads `lane:<id>` on a frame that partitions itself, with no
change to how it is resolved.

**No document changes**, and nothing on screen moves: a declaration that says
nothing about instance zones paints exactly the picture it painted before, down
to the canvas operation.
