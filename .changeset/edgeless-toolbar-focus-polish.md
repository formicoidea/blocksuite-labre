---
'@labre/affine-widget-edgeless-toolbar': patch
'@labre/affine-components': patch
---

Canvas toolbar keyboard focus, as accepted on #691 (ADR 0054, amendment of
2026-11-21). Tab from the canvas now comes back to the toolbar button the user
last used — the last one the keyboard stood on, clicked (primary button) or
pressed through the Alt+←/→ highlight — instead of always the active tool,
which a placed shape turned back into the first button; until the toolbar is
used, it is the active tool's, as before. A clicked one-shot button (Undo, Add
file) therefore becomes the stop too. A click still focuses nothing; a tool
picked from the canvas moves no stop; a remembered tool on another page of the
senior row has the row turned to it; one folded away by a narrow width leaves
the stop on the active tool, and the first Tab there makes that the one used
last. Nothing is stored. Sub-menus are unchanged.

The keyboard's ring is drawn whole: on the large tools (Note, Pen, the
frameworks…) it sits inside the toolbar, clear of its border, instead of on
it and cut at the bottom; every large tool drawn as one button (Note, Text,
Add file, Shape, the frameworks…) gets the same ring round its whole cell,
where Text's crossed its lettering and Add file's left the card and paperclip
out; the pen and the eraser keep one ring each; every ring is drawn above the
tool's artwork, which used to hide part of it; the buttons of a slide-out menu
draw their ring on their own box again, not 2px inside it over the icon. On a
colour swatch, everywhere the colour grid is used, the selection ring (now
28px) and the focus ring are drawn from one box, concentric at any pixel ratio,
where they sat visibly off-centre. In the slide-out menus a control the
keyboard reaches at the strip's edge (the width slider, the last swatch) is
scrolled in with its ring; a mouse press on a half-shown control no longer
slides the strip under the pointer. After a prefix (the pen menu's pens) the
strip's content starts 5px further right and the menu is 5px wider. An Escape
typed while a menu is still sliding shut no longer opens it again.
