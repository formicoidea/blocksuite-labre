---
'@labre/affine-gfx-mindmap': patch
---

Fix the Mind Map / Others senior toolbar buttons not opening on touch devices.
The draggable controller calls `preventDefault` on `touchstart`, which suppresses
the synthesized click that opens the menu, so tapping the icon did nothing
(Others) or only the non-icon edge responded (Mind Map). Wire the controller's
`onElementClick` (a tap without drag) to the same toggle as the button click,
and add `touch-action: manipulation` for snappier taps.
