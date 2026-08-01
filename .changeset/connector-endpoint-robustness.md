---
'@labre/affine-block-surface': patch
'@labre/affine-block-root': patch
---

fix(edgeless): keep both connector endpoints valid on self-loops and partial clones

Two connector robustness fixes from the ADR 0010 recon (PR #86):

- `reassociateConnectorsCommand` re-points **both** endpoints of a self-loop
  connector (source and target on the same element). Previously an early
  `continue` left `target` bound to the old element id after a block
  conversion.
- `mapConnectorIds` (duplicate path) now falls back to the original endpoint
  id when that endpoint was not part of the cloned set, matching the
  clipboard's behaviour. Previously the endpoint id became `undefined`,
  detaching the connector from an element that still exists.
