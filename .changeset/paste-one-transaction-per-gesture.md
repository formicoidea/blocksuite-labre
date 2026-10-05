---
'@labre/affine-block-root': patch
'@labre/affine-block-frame': patch
---

Pasting or duplicating canvas elements writes them, and their final stacking
indexes, in one Yjs transaction instead of two per element: duplicating 50
shapes sends peers one update instead of 100, and inside a frame the frame's
adoptions follow in a single second update instead of one per element. The
paste starts a new undo step, so one undo removes the whole paste and nothing
from the gesture before it. Blocks (notes, texts, images, attachments) are
still created one transaction each, because their creation is asynchronous.
