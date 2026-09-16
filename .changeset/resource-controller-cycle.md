---
'@labre/affine-components': patch
---

The blob state subscription no longer writes a signal inside the effect that creates it, which raised `Cycle detected` on a synchronously emitting host.
