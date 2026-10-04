---
'@labre/std': minor
'@labre/affine-model': minor
'@labre/affine-components': minor
'@labre/affine-shared': minor
'@labre/affine-block-surface': minor
'@labre/affine-widget-edgeless-toolbar': minor
'@labre/affine': minor
---

Hide canvas elements for everyone (ADR 0031, stage 5). A new optional stored
field `hiddenForEveryone` (`true` or absent, never `false`) on every canvas
element and on the fifteen gfx block schemas: the element stays in the document,
in the selection pane (marked) and in what rules, legends and semantic exports
count, but no viewer paints or picks it, and the SVG / PNG exports leave it out.
It is not `hidden`, which mindmap collapse keeps owning: expanding a branch never
unhides a node hidden for everyone. Unhiding removes the key. New command
`canvas.visibility.hideForEveryone` (`hidden: false` shows again; refused on a
read-only document; one undo step), reached from the selection pane's new row
menu (right click, or the row's "more" button), whose entry is painted with the
theme warning tokens through a new `warning-item` menu-button class.
`CanvasVisibilityChanged` gains `scope: 'everyone'`. New in `@labre/std`:
`GfxController.hiddenForEveryone` (`GfxHiddenForEveryone`, the synced set the
paint and pick predicate reads) and `isStoredHiddenForEveryone(model)`.
