---
'@labre/affine-database-engine': minor
'@labre/affine-database-block': patch
---

The views bar and the quick-setting bar of a database are now driven from the
keyboard, as the view toolbar beside them has been since 4.1.0 (#678's
follow-up): each view tab, "N more", "+", the sort chip, each filter chip,
each filter group chip and "Add filter" is a named `role="button"` in the tab
order, in visual order, activated by Enter and Space (a key held down
activates once), with the toolbar's 2px `--affine-primary-color` ring under
`:focus-visible`. The current view's tab says so (`aria-current="true"`)
and, on a writable view, that it opens a menu (`aria-haspopup`, `aria-expanded` while open); a tab the
bar's width hides is out of the tab order and of the accessibility tree
(`visibility: hidden`), reached through "N more". A menu opened from the
keyboard gives the focus back to its control when it closes; when that
control left with what the menu did (the last filter or sort removed, the
current view deleted), the focus goes to the view settings "⋯". A view picked
from the keyboard keeps the focus on its tab.

Tab from a base's full-page title now reaches the current view's tab first,
then the other tabs and "+", then Filter. Inline, the views bar sits between
the text before the database and the toolbar.

The rule is the toolbar's: the bars take only the keys of their own model,
and only in keyboard mode; after any mouse gesture the content behaves as
before (a pressed control has no `tabindex` for the length of the press).
Shortcuts with a modifier (undo, redo, a host's) always go through.

`DataViewRootUI.restoreFocus(selector?)` takes an optional selector of the
element to focus (default `[data-view-focus-fallback]`, the previous
behaviour).

A redo (Ctrl+Shift+Z, Ctrl+Y) typed on a control of the database (the view
settings "⋯" after an undo that brought a view back) now reaches the
editor: a title or text cell holding a leftover caret no longer swallows a
key whose target is outside it. Typing in a cell is unchanged.

Not reached from the keyboard yet: the rows of the sort panel (a rule's
property, its order, its ✕) inside the menu the sort chip opens; its "Add
sort" and "Delete" (all sorts) are.
