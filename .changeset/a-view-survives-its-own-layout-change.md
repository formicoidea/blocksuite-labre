---
'@labre/data-view': patch
---

A view survives its own layout change, and a detail cell stops fighting itself

Four small pieces of database behaviour that all went wrong on the way out of an
interaction:

Switching a view's layout — table to kanban and back — kept the old view's
controller alive, because the cache holding it was keyed by the view id and the
id does not change when the layout does. The board that appeared was still being
driven by table logic: wrong hotkeys, wrong selection, wrong drag. The cache now
remembers the layout alongside the id, and drops the entry of a deleted view
instead of holding it forever.

Re-picking the layout a view already has now does nothing, instead of resetting
that view to the defaults of its own type and throwing away its column widths,
filters and groups.

Leaving edit mode in the record detail panel could loop: the cell's exit hook
writes its value back, the write re-asks for the selection, and the selection
runs the exit hook again. The panel now publishes the new selection before
running the hook, and ignores a selection identical to the one already applied,
so each hook fires once.

Finally, a number column now reads a pasted "11,451.4" or "$1,200" as the number
it obviously is, rather than discarding it because the grouping separators made
it unparseable.
