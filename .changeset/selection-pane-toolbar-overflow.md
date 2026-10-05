---
'@labre/affine-widget-edgeless-toolbar': patch
---

The selection pane's toolbar button (unreleased) no longer disappears when the
editor is narrow: like the frame and undo tools, it moves into the edgeless
toolbar's "more tools" menu, where its entry ("Selection pane", the existing
`com.labre.selection-pane.title` key) toggles the pane.
