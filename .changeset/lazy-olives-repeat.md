---
'@labre/affine-model': patch
'@labre/global': patch
'@labre/std': patch
---

An element whose `xywh` is missing from the document reads `[0,0,0,0]`, is reported once in the console and no longer floods it on every frame.
