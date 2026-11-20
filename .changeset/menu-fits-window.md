---
'@labre/affine-components': patch
---

A menu never runs past the window any more. Menus are placed `fixed` against
the window: on a short page (a base of three rows opened on its full page, in
a short window) a column menu ran past the bottom edge and its last entries
("Duplicate", "Delete") could not be reached. Every menu opened with `popMenu`,
with the default placement or a caller's own middleware, and every nested
sub-menu now ends its placement with `fitToWindowHeight`
(`@labre/affine-components/context-menu`): capped at the room on the side it
opens on, the panel scrolls inside itself, and the entry the arrow keys
highlight is scrolled into the panel's view. A menu that fits keeps its
height. Nothing stored, no seam, no new key.
