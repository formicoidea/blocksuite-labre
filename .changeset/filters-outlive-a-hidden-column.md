---
'@labre/data-view': patch
---

A filter keeps working after its column is hidden

Table and kanban views evaluated their filters against the visible properties
only. Hide the column a condition points at — a perfectly ordinary way to tidy a
table once the filter is set — and the condition evaluated against nothing: the
rows it was hiding came flooding back, while the filter chip in the toolbar
still claimed to be active.

Filters are now evaluated against the view's full property list. Hiding a column
changes what is drawn, never what is kept. The filter itself was never deleted,
so views that lost their filtering get it back on reload with no migration.
