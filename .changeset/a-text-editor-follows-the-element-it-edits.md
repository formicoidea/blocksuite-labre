---
'@labre/affine-gfx-text': patch
'@labre/affine-gfx-group': patch
'@labre/affine-widget-frame-title': patch
'@labre/affine-widget-drag-handle': patch
---

Inline title editors and the drag handle follow their element inside a scaled editor

An editor embedded in a host that scales it — a synced edgeless doc opened
inside another document — paints its elements in the container's already
scaled space. The text editor mounted on a canvas text, on a group title and
on a frame title, and the drag handle's hover area, were instead placed in
real screen pixels, so the container scaled them a second time: clicking a
title opened its editor somewhere else on the board, and the handle appeared
away from the block it drags.

Each of them now states its placement the way the element it sits on states
its own. A standalone editor, where the host applies no scale, is unaffected.
