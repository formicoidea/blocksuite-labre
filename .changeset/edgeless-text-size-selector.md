---
'@labre/affine': minor
---

Add a font size selector to the edgeless text toolbar

The context toolbar of a free text component on the canvas offered font,
color, style and alignment but no size — the only way to size text was
dragging the selection handles, which makes consistent sizing across a board
tedious. The edgeless text block has no `fontSize` prop by design (its visual
size is `scale` over the 15px base font), so the new dropdown drives `scale`:
presets (16–128) plus a custom integer input, displayed as the pixel size
users reason about. Picking a size rescales the block exactly like
ratio-locked corner resizing (top-left anchored, layout width preserved, so
text wrapping does not change), and undo restores each step.

Also registers the surface and edgeless-text packages in the root vitest
workspace so their unit tests run in CI.
