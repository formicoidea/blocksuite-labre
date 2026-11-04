---
'@labre/affine': minor
---

The image crop frame no longer moves: only its corner handles resize it.
Dragging inside the frame now pans the picture behind it, and a zoom slider
above the frame (1x to 4x, the new `com.labre.image.crop.zoom` key, « Zoom »)
zooms the picture about the frame's centre, as the wheel now does too. A pan or
a zoom keeps the box where it is: `xywh` is untouched on the canvas, and on a
page `width`/`height` (the whole picture) scale so the visible window keeps its
size. `<affine-slider>` gains a continuous mode, `range: { min, max, step? }`
beside the discrete `points`, with keyboard support and an ARIA slider role;
the discrete users are unchanged. Nothing persisted changes format (ADR 0037
amendment of 2026-11-04).
