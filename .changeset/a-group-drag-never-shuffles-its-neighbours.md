---
'@labre/data-view': patch
---

Dragging a kanban group no longer scrambles the order of the others

Reordering groups spliced the moved key out of the list by the index of a
`findIndex` that was never checked. Drop a group onto something the list did not
know about — a group that had just been renamed away, or the group itself — and
the index was `-1`: the _last_ group was cut out instead, then the dragged one
was re-inserted near the end. The manual arrangement, which is what a kanban
board mostly is, came back wrong and stayed wrong, because that scrambled list
was written straight to the document.

A move that cannot be honoured is now a move that does not happen: unknown
group, unknown drop anchor, or a group dropped where it already sits all leave
the order exactly as it was, and nothing is written. Legitimate drags behave as
before.
