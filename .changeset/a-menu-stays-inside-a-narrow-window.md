---
'@labre/affine-components': patch
---

A menu opened near the edge of a narrow window stays on screen

Menus were allowed to pick between four corners of their button and were then
nudged four pixels away from it, but nothing kept the result inside the window.
On a constrained viewport — a split view, a small laptop screen, the editor
embedded in a panel — all four corners can overflow, and the menu simply hung
off the edge with its items out of reach.

Menus now slide back into view when they would otherwise overflow, keeping an
eight pixel margin. A menu that already fits does not move, so toolbars and
their submenus open exactly where they used to.
