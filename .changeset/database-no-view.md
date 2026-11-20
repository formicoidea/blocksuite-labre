---
'@labre/affine-database-engine': patch
'@labre/affine-database-block': patch
'@labre/affine-database-view-block': patch
---

A database whose every view was deleted no longer disappears (ADR 0035,
amendment of 2026-11-20). Deleting the only view ("⋯" › Delete, or the tab's
menu) used to leave nothing on the page: no title, no views bar, no "+", no
table, and no way back but Ctrl+Z. Such a database, or one stored with no
view, now draws its title row (with its "⋯") above an empty state: "No view",
and, where a view may be added, a hint and a "New view" button that opens what
the views bar's "+" opens (with `labre-core-database`, the database's sources;
without it, the layouts). A read-only document, or `{ database: false }`, shows
the status alone. The same holds for the `affine:data-view` block, on the
canvas and on a base's full page. Nothing is written: undo brings the view
back, redo the empty state, and a peer's deletion lands on it too.

From the keyboard, deleting the last view puts the focus on "New view" (or on
the status) instead of the page's body; a mouse deletion moves no focus.

A view current only by an id that no longer exists (deleted by a peer, an undo
or a host's later `remove()`) is no longer drawn as nothing: the first view is
shown, as `currentViewId$` now reads past the stale id.

"Delete" on the last view is unchanged and still reaches the host's
`deleteView`, which decides what goes with it.

For a host that renders `DataViewRootUILogic` itself: the empty state is drawn
where nothing was; pass `noViewHeader` to draw a header above it.
`canAddView` and `popAddViewMenu` are exported from the engine: the "+"
gesture, shared by the views bar and the empty state.

New translation keys (English fallback): `com.labre.data-view.no-view` "No
view", `com.labre.data-view.no-view.hint` "The rows are kept. Add a view to
show them." The button reuses `com.labre.data-view.views-bar.add-view` ("New
view").
