---
'@labre/affine-widget-edgeless-toolbar': patch
'@labre/affine-components': patch
---

Canvas toolbar keyboard focus, as accepted on #691 (ADR 0054, amendment of
2026-11-21). Tab from the canvas now comes back to the toolbar button the user
last used — the last one the keyboard stood on, clicked or pressed through the
Alt+←/→ highlight — instead of always the active tool, which a placed shape
turned back into the first button; until the toolbar is used, it is the active
tool's, as before. A click still focuses nothing; a tool picked from the canvas
moves no stop; a remembered tool on another page of the senior row has the row
turned to it; one folded away by a narrow width leaves the stop on the active
tool. Nothing is stored. Sub-menus are unchanged.

The keyboard's ring is drawn whole: on the large tools (Note, Pen, the
frameworks…) it sits inside the toolbar, clear of its border, instead of on
it and cut at the bottom; on a colour swatch the selection ring (now 28px)
and the focus ring are concentric on whole pixels with an even 1px gap,
where they sat visibly off-centre; in the slide-out menus a control at the
strip's edge (the width slider, the last swatch) is scrolled in with its
ring. An Escape typed while a menu is still sliding shut no longer opens it
again.
