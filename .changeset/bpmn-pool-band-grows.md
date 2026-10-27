---
'@labre/affine': minor
---

BPMN pool and lane title bands now grow with their names: a long participant name wraps onto up to three lines up its band, a long lane name onto up to two, and the band thickens to hold them instead of cutting the name. All lanes of a pool share the widest lane band, so their edges stay aligned. Only a name longer still is cut with an ellipsis; the stored name stays whole, nothing new is saved in the document, and the SVG export paints the same bands. The framework-background primitive gains `fit: 'wrap'` (with `maxLines`) for side-band and lane-band labels, and `backgroundBandWidths` to read the resulting band widths.
