---
'@labre/affine': patch
---

Make two data-view block edits undoable: changing a cell of one of the block's own columns and deleting one of those columns now take one undo step each, where Ctrl+Z used to skip them. Remove the `@labre/affine-shared/test-utils` export (the `./test-utils` entry of `@labre/affine-shared`): it exposed internal test fixtures, no host imported it, and there is no replacement.
