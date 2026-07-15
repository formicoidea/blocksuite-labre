---
'@labre/affine-block-frame': patch
---

Fix new elements created inside a frame randomly rendering behind existing
frame children: the auto-adopted element now gets an index strictly above its
new siblings, so a freshly created shape always lands on top — matching the
behavior outside frames.
