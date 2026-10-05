---
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-edgy': patch
'@labre/affine-block-surface': patch
'@labre/affine-widget-edgeless-toolbar': patch
---

Selection pane fixes from the product owner's review (the pane is unreleased). A
row no longer shows a raw `com.labre.*` key: the ten Wardley roles and three EDGY
board roles that declared a `labelKey` with no `labelFallback` now carry their
English wording, and a role with no wording at all reads as its element type.
The filter offers frames only: `selectionPaneFilterTargets` answers frames
only, and the `com.labre.selection-pane.filter.board` key is gone.
Layer rows are listed whatever the filter (`filterSelectionPaneTree` keeps every
layer node); a layer the filter empties says "{{count}} hidden by the filter"
(new key `com.labre.selection-pane.layer.filtered`), and "New layer" opens the
new layer's name field, focused and scrolled into view. Dragging a row now shows
a ghost under the pointer and a line at the gap it would land in (the frame
panel's model); the gap under the last row is a target, a frame's members stand
for their frame, and a gap the row cannot go to shows no line and a
`not-allowed` cursor instead of failing silently.
