---
'@labre/std': patch
---

An element deleted in the same transaction that adds another no longer emits
`elementUpdated` after it has left the surface (#681). Until now it stayed
mounted until its `elementRemoved`, which comes after the transaction's
`elementAdded`: a group read in that window (the board stacking rule reads
every top-level bound on a local addition) recomputed its bound and emitted an
update whose id `getElementById` no longer resolved, and the spatial index
threw `Cannot read properties of null (reading 'externalXYWH')`. The element
is now silenced as it leaves the surface; `elementAdded` and `elementRemoved`
keep their order and their payload, and an `elementRemoved` subscriber still
reads the removed model.
