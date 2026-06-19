---
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-mindmap': patch
---

fix(edgeless): keep senior-button sub-menus anchored to their button

Two senior-button sub-menus positioned themselves against the whole toolbar
instead of their own button, so they drifted once senior buttons can be hidden
at runtime:

- **Wardley map** right-aligned to the rightmost senior-tool slot (via a layout
  scan), which moves when buttons are toggled off.
- **Others** (the mindmap basket) had no `position: relative` on its host, so
  the popup's clip wrapper anchored to the toolbar and left-aligned there.

Both now right-align to their own button edge like every framework senior button
(Cynefin, EDGY, BPMN, DDD), which stays correct whatever buttons are hidden.
