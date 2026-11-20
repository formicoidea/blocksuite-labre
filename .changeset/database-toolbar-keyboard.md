---
'@labre/affine-database-engine': minor
'@labre/affine-database-block': patch
'@labre/affine-fragment-doc-title': patch
'@labre/affine-database-editor': patch
---

The view toolbar of a database (filter, sort, search, view settings "⋯", New
and the arrow of the host's menu beside it) is now driven from the keyboard
(#678): each control is in the tab order in visual order, named, activated
by Enter and Space (a key held down activates once), and shows a 2px
`--affine-primary-color` focus ring under `:focus-visible`. The toolbar is no
longer at opacity 0 while one of its controls holds the focus, and it is shown
at rest on a database opened as the page itself (the views' `PageLayoutKey`,
as the table's page layout already reads it); inline in a text it still
appears on hover. Menu buttons say their state (`aria-expanded`); filter and
sort, once a filter or a sort exists, say whether the quick-setting bar they
toggle is shown. Filter, sort and view settings menus opened from the keyboard
give the focus back to their control when they close, Escape included (the view
settings take two Escapes: the first leaves their name field). Search is a
named button that opens its field with the focus inside; Escape clears the
text, a second Escape closes the field and returns to the button.

Behaviour that changes for a host:

- the toolbar takes the keys of its own model, and only in keyboard mode: a
  key without Ctrl, Meta or Alt (Enter, Space, Escape, letters, arrows,
  Backspace, Delete) typed on a control the reader TABBED to
  (`:focus-visible`), or in the search field, no longer reaches the editor,
  the view's keys or your listeners on the document (with a cell still
  selected, Tab used to move the cell and a letter edited it); Tab and
  Shift+Tab on a control always move the focus. A mouse click on a control
  takes no focus (its mousedown is prevented, the search field's excepted),
  so after a pointer gesture the view keeps its keys as before. Shortcuts with
  a modifier (undo) always go through;
- Escape in the search field no longer reaches the editor, your listeners or
  the open popups' Escape;
- the folded search field is `inert`: out of the tab order and of the
  accessibility tree, reached through the Search button;
- Tab in the title of a page of one block (`<doc-title .bodyBlockId>`, a
  base's full page) now leaves the title for that block's controls, the view
  toolbar first, and Shift+Tab comes back. An ordinary document's title keeps
  Tab, as before. For that, the editor host of `affine-database-page` leaves
  the tab order (`tabindex="-1"`, still focusable by script): Tab stopped on
  it between the title and the views, and the editor keeps a Tab pressed
  there;
- a host that fills `DatabaseNewRowMenuExtension` receives the chevron as
  `anchor` with the focus on it when Enter or Space opened the menu: give it
  back to `anchor` itself (not to a descendant) when your menu closes.

No new translation key: the search button and its field are named by
`com.labre.filterable-list.search-placeholder` ("Search", one chrome word, one
key), and the "⋯" button by `com.labre.data-view.view-settings` ("View
settings"); check that your catalogue's wording of the first reads as a button
name.
