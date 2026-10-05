---
'@labre/affine-gfx-ddd-shared': patch
---

The `@formicoidea/labre-ddd-shared` bundle now declares `yjs`, which its
prefabs import at run time: a host no longer depends on another package
hoisting it. The other bundles' dependency lists are unchanged.
