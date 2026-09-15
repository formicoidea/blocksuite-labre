---
'@labre/affine-model': minor
'@labre/affine-gfx-connector': minor
---

feat(edgeless): connectors gain two hollow endpoint heads, `TriangleHollow` and `DiamondHollow` — the UML 2.5.1 heads for generalization and realization (hollow closed triangle) and shared aggregation (hollow diamond). Both appear in the start- and end-point menus of the connector toolbar, and both render on the canvas and in the DOM renderer. The outline keeps the connector's stroke colour while the interior is the shared notation card fill, so a hollow head reads as white against the box it points at in every theme. `PointStyle` is persisted on every connector: the two members are appended, no existing value changes, and a build that predates them simply paints no head at that end rather than failing to load the document. See `docs/adr/0016-hollow-endpoint-styles.md`.
