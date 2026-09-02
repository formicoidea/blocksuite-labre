---
'@labre/affine-widget-edgeless-toolbar': patch
---

fix(edgeless): the slide-out menu wears the toolbar's own corner radius

The popup that slides out above the edgeless toolbar (the senior sub-menus,
the shape menu — everything rendered through `edgeless-slide-menu`) rounded
its top corners at 8px while the toolbar it sits on rounds at 16px, so the
two read as different chrome. The popup now uses the toolbar's 16px radius;
its bottom edge stays square, as before, where it merges into the bar.
