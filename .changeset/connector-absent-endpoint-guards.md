---
'@labre/affine-gfx-connector': patch
---

fix(edgeless): guard connector path generation against absent endpoint elements

`ConnectorPathGenerator.updatePath` no longer throws a `TypeError` when a
connector endpoint holds `{ id }` (no position) referencing an element that
is absent from the store — a latent state previously reachable only because
`connectorWatcher` filters it upstream. All three modes were affected:
Straight and Curve dereferenced `.xywh` after an unguarded `as Connectable`
cast, and Orthogonal destructured the empty result of
`_computeStartEndPoint` into undefined points.

Degraded behavior: the unresolvable endpoint falls back to its stored
position when there is one; otherwise the connector keeps its last bound —
a deliberate change from the former `[0,0,1,1]` collapse, so the ghost stays
where the user last saw it — and RENDERING paints an empty path instead of
crashing. The scope is the render path only: hit-testing over the empty
path (`includesPoint`, `getNearestPoint`) can still throw from
`getBezierParameters`, which does not handle a zero-length path — tracked
as follow-up work, same root cause.
