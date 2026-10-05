---
'@labre/affine-block-surface': patch
'@labre/affine-widget-edgeless-toolbar': patch
---

In the selection pane (unreleased), a frame is an ordinary row again, listed at
its real place in the stack inside its layer, its members right above it as
siblings (never nested): the headless `selectionPaneTree(std)` carries a
`kind: 'block'`, `type: 'affine:frame'` node for each frame. A frame row shows
its title, renames in place through the new agent command `canvas.frame.rename`
(keys `com.labre.command.canvas.frame.rename`, "Rename frame", and
`com.labre.command.canvas.frame.rename.description`, "Give a frame a new
title."), has its eye, lock and row menu, and drags like any row. Under a frame
filter the list keeps that frame's own row with its members. Hiding or deleting
a layer hides or deletes the frames listed in it. Nothing stored changes.
