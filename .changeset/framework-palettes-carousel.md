---
'@labre/affine-components': minor
'@labre/std': patch
'@labre/affine-shared': patch
'@labre/affine-block-frame': patch
'@labre/affine-block-root': patch
'@labre/affine-gfx-brush': patch
'@labre/affine-gfx-connector': patch
'@labre/affine-gfx-shape': patch
'@labre/affine-gfx-text': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-edgy': patch
'@labre/affine-gfx-c4': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-ddd-event-storming': patch
'@labre/affine-gfx-ddd-context-map': patch
'@labre/affine-gfx-ddd-core-domain': patch
'@labre/affine-gfx-cynefin-estuarine': patch
---

Colour pickers on the canvas page through the palettes of the active frameworks: the editor palette is always the first page, and the picker opens on the palette of the framework the selected element belongs to — its own role, else the ends of a connector, else the smallest framework board it sits on. A connector between two Wardley components, a label beside them or a frame drawn round the map can now be tinted with the framework's own hues instead of a hex typed from memory. Offering a palette is tooling: a framework switched off simply loses its page, and every colour already stored stays exactly as it was drawn.
