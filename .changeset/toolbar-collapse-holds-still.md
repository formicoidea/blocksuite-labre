---
'@labre/affine-shared': patch
'@labre/affine-widget-toolbar': patch
---

fix(edgeless): the contextual toolbar holds still while the map moves

PO review of 02/08/2026, second pass, point 1. Zooming in or out with an element
selected made its toolbar hesitate: the row seemed to try several widths, and
several places, before settling. It now decides ONCE, when the viewport lands.

**What was oscillating.** Not the anchoring — the position the toolbar is given
moves once per frame, steadily, in the direction of the zoom, before this change
as after it. It was the row's own COMPOSITION. A zoom moves the room the row has
on every frame, and the fitter replanned on every one of them: over a two-dozen
frame zoom the same entry went from its word, to its icon, into the "⋮" menu,
and back to its word again. Since the row is anchored by its left edge, each of
those widths moved its other three, which is what read as the toolbar changing
its mind about where to sit.

**Replan at the accalmie.** While the room is still moving, the plan on screen
is frozen: the row keeps its composition for the whole gesture, however long it
lasts, and is replanned once — for the width the gesture ENDED on. A viewport
that has stopped changing for 150ms has landed, and a wheel zoom that breathes
between two notches is covered by the viewport saying, itself, that it is still
zooming.

**Hysteresis.** A change of a few pixels is not a change. Two measurements that
alternate by a pixel — a rounded rect, a fractional zoom, a scrollbar coming and
going — used to be two different rooms and could compose the row two different
ways, forever; below the threshold they are now one room and the row is left
alone. The threshold is smaller than the narrowest thing the row could give up,
so no real degradation is ever delayed by it.

Nominal collapse is untouched: the row is still measured whole on selection and
still gives way immediately when the editor hands it less width.
