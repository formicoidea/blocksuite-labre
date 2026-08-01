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
- Turning a partial selection into a linked doc no longer breaks a connector
  whose other end stays behind. That endpoint now becomes an **absolute
  position** — the same conversion the clipboard already applies through
  `serializeConnector` — instead of keeping an element id that means nothing
  in the new document. The connector arrives visible, selectable and at the
  place it occupied in the source document.
