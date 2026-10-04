---
'@labre/std': minor
'@labre/affine-model': minor
'@labre/affine-shared': minor
'@labre/affine-block-surface': minor
'@labre/affine-gfx-group': minor
'@labre/affine-widget-edgeless-toolbar': minor
'@labre/affine': minor
---

User layers on the canvas (ADR 0031, stage 6). The surface gains an optional
`layers` record (`SurfaceLayerRecord`: `name`, fractional `index`), and every
canvas element and gfx block an optional `layer` id (`undefined` = the default
layer, `'@default'`); stacking is layer rank first, then the existing
comparator, with a fast path that leaves a document without layers sorted
exactly as before. A group lives in one layer, stored on its outermost group;
frames hold elements from any layer; a dangling id reads as the default layer
and is never dropped. New elements, pasted blocks and imports land in the
viewer's active layer (session only, `CanvasActiveLayer`) unless they name a
layer of this surface. Bring forward / send backward stay inside the layer.
The selection pane lists layers as sections: create ("New layer"), rename in
place, reorder by drag, drop a row on a layer to move it there, collapse.
Commands `canvas.layer.create`, `.rename`, `.reorder`, `.moveElements`;
telemetry `CanvasLayerChanged`; the default layer name is seeded through the
new key `com.labre.layer.seed.name` ("Layer {{n}}"). The pane no longer lets a
pointer move over it reach the canvas.
