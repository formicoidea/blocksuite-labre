---
'@labre/affine-block-surface': patch
'@labre/affine': patch
---

An interchange import whose document turns read-only while the file is being read now says so and writes nothing, instead of failing silently in a rejected promise.
