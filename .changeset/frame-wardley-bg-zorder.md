---
'@labre/affine-block-frame': patch
---

fix(edgeless): keep frames raisable above wardley map backgrounds

A frame drawn on top of a large canvas backdrop (such as a Wardley map
background) could be auto-adopted as that backdrop's owner in reverse: the
backdrop's center fell inside the frame, so the frame swallowed the backdrop
as a child. Because a frame always renders behind everything it owns and
"bring to front" only reorders top-level siblings, the frame became buried
behind its own background with no way to raise it. A frame now refuses to
auto-adopt any element that fully encloses it.
