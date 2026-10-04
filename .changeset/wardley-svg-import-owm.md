---
'@labre/affine-gfx-wardley': minor
'@labre/affine-block-surface': minor
---

Wardley's "Import SVG sketch" now recognises a map exported by OnlineWardleyMaps and draws it as native Wardley elements — components, anchors, markets, ecosystems, climate arrows, pipelines, evolutions, inertia, notes, dependencies and the title — with anything else in the file arriving as a sketch in the same import (ADR 0032); the SVG sketch reader exposes `sanitizeSvg`, `sketchSvgTree` and `svgFrameOf` so a framework can claim part of a picture first, and BPMN's import is unchanged.
