---
'@labre/affine-model': minor
'@labre/affine-gfx-connector': minor
'@labre/affine-shared': minor
---

feat(edgeless): a connector carries two END labels beside its centre one — a multiplicity, a role name, a qualifier — each anchored beside the endpoint it belongs to and following that endpoint alone when a node moves. Four optional fields (`sourceLabel`, `sourceLabelXYWH`, `targetLabel`, `targetLabelXYWH`) are absent by default, so a connector that has none serialises exactly as before and an older build opens the document unchanged. Double-click near an endpoint to open that end's label; the connector toolbar gains "Source label" and "Target label". Canvas and DOM renderers paint the three boxes and clip the stroke around each. See `docs/adr/0020-connector-end-labels.md`.
