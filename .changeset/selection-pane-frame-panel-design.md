---
'@labre/affine-shared': patch
'@labre/affine-fragment-frame-panel': patch
'@labre/affine-widget-edgeless-toolbar': patch
---

The selection pane (unreleased) now looks and drags like the frame panel. Its
header is the frame panel's header — a 36px row, a secondary-text title and
20px icon buttons for new layer, filter and close — read from the new shared
`panelHeaderStyles` in `@labre/affine-shared/styles`, which the frame panel
uses too (its title colour now follows the theme's secondary-text token in
dark mode as well). A drag starts at 5px on either axis (the frame panel's
threshold, now `PANEL_DRAG_THRESHOLD_PX`), selects the row it picks up, shows
the row at its own width under the pointer, shows its cursor over the whole
editor and keeps Escape from closing the pane until the row is released.
