---
'@labre/affine-gfx-group': patch
'@labre/std': patch
---

A readonly peer never deletes an emptied group locally; the duplicate group-relation watcher is removed.
