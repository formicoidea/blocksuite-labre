---
'@labre/affine-shared': patch
'@labre/affine-widget-edgeless-selected-rect': patch
'@labre/affine-widget-remote-selection': patch
'@labre/affine-gfx-shape': patch
---

Selection, handles and remote cursors follow their element inside a scaled editor

An editor embedded in a host that scales it — a synced edgeless doc opened
inside another document — paints its blocks in the container's already scaled
space. The overlays drawn over those blocks were instead placed in real screen
pixels, so the container scaled them a second time: the selection rectangle, the
resize and element handles, the link chip, the remote cursors and the shape text
editor all drifted away from the shapes they belong to, and further away with
every scroll and zoom.

Every one of them now states its placement the way a block states its own, so
they sit on their element again. A standalone editor, where the host applies no
scale, is unaffected.
