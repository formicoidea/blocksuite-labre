---
'@labre/affine-components': patch
'@labre/affine-gfx-template': patch
---

A closed popup stops following its anchor

Menus, sub-menus and the edgeless template panel are kept glued to the element
that opened them by a floating-ui positioning loop. That loop installs scroll
and resize listeners on every ancestor plus a resize observer, and it hands
back a function that removes them again. Three of them threw that function
away: the loop kept measuring a popup that had already been removed, and its
listeners kept the popup, its anchor and everything they closed over alive.
Opening and closing a context menu or the template panel repeatedly therefore
grew memory and slowly made scrolling heavier.

Each of the three now stops its loop: a sub-menu when its owning item is
removed even though the sub-menu is still open, a popup when it closes, and the
template panel both when it closes and when the toolbar button goes away.
Positioning while a popup is open is unchanged.
