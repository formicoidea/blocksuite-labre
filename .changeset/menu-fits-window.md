---
'@labre/affine-components': patch
'@labre/affine-database-engine': patch
---

No entry of a menu is ever out of reach any more. Menus are placed `fixed`
against the window: on a short page (a base of three rows opened on its full
page, in a short window) a column menu ran past the bottom edge and its last
entries ("Duplicate", "Delete") could not be reached.

- Every menu opened with `popMenu`, with the default placement or a caller's
  own middleware, and every nested sub-menu, is capped at the room on the side
  it opens on when its content is taller, and then scrolls inside itself; a
  menu that fits carries no cap and no scroll. The field it opens on (a shown
  search, a column's name) stays in view above the list.
- The arrow keys scroll the highlighted entry into the panel's view; nothing
  else scrolls a panel: not the pointer, not a sub-menu closing, not a click
  in a margin (the hidden search field now takes the focus without
  scrolling).
- The tag selector of a select or multi-select cell caps its options list at
  the room its field leaves, the field staying in view; the date picker of a
  date cell shifts to stay inside the window (a window shorter than the
  calendar still cuts its bottom).

Nothing stored, no seam, no new key, no new export.
