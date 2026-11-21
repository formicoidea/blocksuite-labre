---
'@labre/affine-database-engine': minor
'@labre/affine-database-block': patch
'@labre/affine-database-view-block': patch
---

A database whose every view was deleted no longer disappears (ADR 0035,
amendment of 2026-11-20). Deleting the only view ("⋯" › Delete, or the tab's
menu) used to leave nothing on the page: no title, no views bar, no "+", no
table, and no way back but Ctrl+Z. Such a database, or one stored with no
view, now draws its title row (with its "⋯") above an empty state: "No view",
and, where a view may be added, a hint and a "New view" button that opens what
the views bar's "+" opens (with `labre-core-database`, the database's sources,
and "Create source" once a name is typed in its search; without it, the
layouts). A read-only document, or `{ database: false }`, shows the status
alone. It holds inline, on the canvas and on a base's full page. Nothing is
written: undo brings the view back, redo the empty state, and a peer's deletion
lands on it too.

Native rows with no view under a host that sets `requireSource` are locked, so
they offer no "New view": the empty state now shows their read-only notice, and
"Move into a database" turns them into a host source that offers "New view".

Focus (WCAG 2.4.3): when a removal leaves no view and nothing holds the focus
once the empty state has drawn, the focus goes to "New view" (or to the status
where there is no button), whether the removal came from the keyboard, from a
host's `deleteView` → `remove()`, an undo or a redo; an undo that brings the
view back gives it to the view's "⋯". A peer's write and a mouse gesture move
nothing, and the page never scrolls to the block. A preset picked from the
empty state's menu with the keyboard lands the focus on the new view's "⋯". A
click in the frame takes no focus.

A view current only by an id that no longer exists (deleted by a peer, an undo
or a host's later `remove()`) is no longer drawn as nothing: the first view is
shown (`ViewManagerBase.currentViewId$` reads past a stale id).

"Delete" on the last view is unchanged and still reaches the host's
`deleteView`, which decides what goes with it.

For the host:

- Two new translation keys (English fallback):
  `com.labre.data-view.no-view` "No view",
  `com.labre.data-view.no-view.hint` "Add a view to show this database's
  rows." The button reuses `com.labre.data-view.views-bar.add-view` ("New
  view").
- `deleteView`: close your confirmation dialog, its focus return included,
  before you call `remove()`; a dialog still holding the focus when the view
  goes keeps it, and returns it to the "⋯" the removal takes away (the Labre
  shell today calls `remove()` before `sourceTrashStore.done()`: swap them).
- The focus rule needs remote updates applied with an origin: one applied
  without reads as local and would move the focus on an idle peer.
- A host that builds its own `DataViewRootUILogic` now gets the empty state
  where it got nothing; `DataViewRendererConfig` gains two optional members,
  `noViewHeader` (what of your header to draw above it) and `onChangeView` (a
  view added from it). The 4.0 config still types.

The `affine:data-view` block passes its header too, but is not verified: it
throws at construction and its data source implements neither `viewManager`
nor `readonly$`, both older than this change.
