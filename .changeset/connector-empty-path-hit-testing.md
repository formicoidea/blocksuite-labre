---
'@labre/affine-model': patch
'@labre/global': patch
'@labre/affine-gfx-connector': patch
---

fix(edgeless): hit-testing a degraded connector (empty path) no longer throws

Follow-up to the absent-endpoint render fix: a connector whose endpoint
references a vanished element keeps its last bound, so it stays indexed and
hoverable — and `getElementByPoint` calls `includesPoint` on every mouse
move. `includesPoint` (Curve mode), `getNearestPoint`,
`getPointByOffsetDistance` and `getOffsetDistanceByPoint` now degrade on an
empty path (miss / element origin / bound center / midpoint) instead of
throwing. At the source, `getBezierParameters` handles a zero-length path
the same way it already handled a single point.

Also: `_getConnectorEndElement` no longer casts away null, and
`updatePath` skips the redundant `path = []` rewrite (no signal
notification when the path is already empty).
