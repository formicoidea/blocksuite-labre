---
'@labre/affine-database-engine': minor
'@labre/affine-database-block': patch
---

The view toolbar of a database (filter, sort, search, view settings "⋯", New
and the arrow of the host's menu beside it) is now driven from the keyboard
(#678): each control is in the tab order in visual order, named, activated
by Enter and Space, and shows a 2px `--affine-primary-color` focus ring under
`:focus-visible`. The toolbar is no longer at opacity 0 while one of its
controls holds the focus, and it is shown at rest on a database opened as the
page itself (the views' `PageLayoutKey`, as the table's page layout already
reads it); inline in a text it still appears on hover. Filter, sort and view
settings menus opened from the keyboard give the focus back to their control
when they close, Escape included. Search is a named button that opens its
field with the focus inside; Escape clears the text, a second Escape closes the
field and returns to the button. A host that fills `DatabaseNewRowMenuExtension`
receives the chevron as `anchor` with the focus on it when Enter or Space
opened the menu: give it back to `anchor` when your menu closes.

No new translation key: the search button and its field are named by
`com.labre.filterable-list.search-placeholder` ("Search", one chrome word, one
key), and the "⋯" button by `com.labre.data-view.view-settings` ("View
settings"); both now also reach these controls, so check that your
catalogue's wording of the first reads as a button name.
