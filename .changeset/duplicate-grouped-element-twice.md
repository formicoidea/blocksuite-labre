---
'@labre/affine-block-root': patch
'@labre/affine-block-frame': patch
---

Duplicating or pasting a group inside a frame no longer leaves its children
claimed by both the frame and the group, and a duplicate no longer copies such
a child twice. The paste now takes its own children back from a frame that
adopted them before their group existed, the frame manager no longer adopts a
block that a group already claims (nor writes on a readonly store), and the
clone order visits each element once, so documents that already hold a doubly
claimed child duplicate it once without being rewritten.
