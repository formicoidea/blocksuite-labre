---
'@labre/affine-components': patch
'@labre/affine-block-surface': patch
---

fix(edgeless): a selected qualification value can be un-picked again

Clicking a Wardley nature — or any tag value — a second time is how it is
removed. With a real mouse it did nothing: the row in force was the one row of
the dropdown that took no pointer at all, so the click fell **through** the tick
onto the section behind it and the qualification stayed put. The only way out
was to pick a different value, which for a single-valued tag means stating
something the user does not believe.

`editor-menu-action` renders a `data-selected` row inert
(`pointer-events: none`). That is right for a one-of-N menu — re-picking the
option already in force is a no-op, so swallowing the click costs nothing — and
wrong for a TOGGLE, where the selected row is the only one that can clear the
value. The tag rows now say which they are, with `data-toggle` beside the
`data-option` they already carried, and `editor-menu-action` gives a toggle its
pointer back. Every other option row — the C4 level menu, the validation profile
menu, the conversion and size menus — is a genuine one-of-N and keeps the inert
reading unchanged.

The integration spec no longer dispatches its clicks onto a node it chose
itself: it opens the dropdown as a user does and lets the browser's own hit test
say which node receives the event. That is what makes the defect visible from a
test at all — a dispatched click reaches a handler an inert row would never
have been given.
