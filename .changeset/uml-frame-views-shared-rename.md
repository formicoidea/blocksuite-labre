---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-uml': patch
---

refactor(edgeless): the UML frames (diagram, subject, partition, composite state, combined fragment) now use the shared double-click rename of every framework board instead of a copy of it; nothing changes for the user. The shared editor accepts an optional `commit` on a label, for a name that a single property write cannot store (a fragment's operand guard). The UML diagram toolbar uses the shared "⋮" command entry.
