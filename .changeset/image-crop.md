---
'@labre/affine-model': minor
'@labre/affine-block-image': minor
'@labre/affine-block-surface': patch
'@labre/affine-widget-drag-handle': patch
---

Crop an image, on a page and on the canvas (ADR 0036). The image toolbar gains « Crop » with four presets — Free, 16:9, 4:3, 1:1 — and « Original image » once a crop exists. A preset writes the largest centred window of its ratio and opens the crop frame; in the frame, drag the window to move it and a corner to resize it (the ratio is held unless free); Escape, Enter or a press elsewhere closes it. Each drag is one undo step, nothing is written when nothing changed, and nothing at all on a readonly page. The crop is a view: the image's bytes and `sourceId` never change, and « Original image » removes it.

Stored format: `affine:image` gains one optional `crop` prop (`{ x, y, w, h, mask? }`, normalised to the source, `mask` an append-only token), default `undefined`, never written on load. Read it with the new `readImageCrop` (a damaged value reads as the whole image); `imageCropSourceRect` gives the source rectangle a raster export draws. On the canvas the box (`xywh`) is the visible part and moves with the crop in the same transaction; on a page `width`/`height` keep describing the whole picture. A client before this change shows the whole image (stretched into the cropped box on the canvas) and keeps the key. The canvas PNG/PDF export, the canvas clipboard and a page image dropped on the canvas honour the crop. New keys: `com.labre.image.toolbar.crop`, `com.labre.image.toolbar.crop.free`, `com.labre.image.toolbar.crop.ratio-16-9`, `com.labre.image.toolbar.crop.ratio-4-3`, `com.labre.image.toolbar.crop.ratio-1-1`, `com.labre.image.toolbar.crop.original`.
