---
'@labre/affine-components': patch
'@labre/affine-database-engine': patch
---

No entry of a menu of a base is out of reach any more in a short window, with
the mouse and with the keyboard. Menus are placed `fixed` against the window:
on a short page (a base of three rows opened on its full page) a column menu
ran past the bottom edge and its last entries ("Duplicate", "Delete") could
not be reached. This predates the release (4.0.0 behaves the same).

- Every menu opened with `popMenu`, with the default placement or a caller's
  own middleware, and every nested sub-menu, is capped at the room on the side
  it opens on when its content is taller, and then scrolls inside itself; a
  menu that fits carries no cap and no scroll. A menu that fits by less than
  8px is capped and scrolls by those few pixels. The field it opens on (a
  shown search, a column's name) stays in view above the list, covering the
  panel's top padding.
- The arrow keys, down and up, scroll the highlighted entry wholly into view,
  below the field stuck at the top; nothing else scrolls a panel: not the
  pointer, not a sub-menu closing, not a click in a margin. The menu does not
  wrap and has no Home or End.
- The tag selector of a select or multi-select cell caps its options list at
  the room its field leaves, the field staying in view, and its arrows bring
  the selected option into view (they wrap). The date picker of a date cell
  shifts to stay inside the window; with no room on either side it covers its
  cell, and a window shorter than the calendar still cuts its bottom.
- New exports of `@labre/affine-components/context-menu`, for the base's own
  popups: `capToRoom`, `scrollDeltaToShow`, `scrollViewOf`, `WINDOW_PADDING`.

Not covered: a scrolled page under the library's own lockfile. There,
`@floating-ui/utils` 0.2.9 counts `container-type` as making a containing
block (Chrome does not), and a popup opened on an inline base in a scrolled
page lands off its anchor, outside the window. `@floating-ui/utils` 0.2.11 and
later fix it, within the `^0.2.9` range `@floating-ui/dom` asks for; a host
that resolves one of them (Labre resolves 0.2.11) does not have the defect.

Nothing stored, no seam, no new key.
