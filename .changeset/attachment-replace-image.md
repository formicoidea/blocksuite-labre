---
'@labre/affine-block-attachment': patch
'@labre/affine-shared': patch
'@labre/affine': patch
---

"Replace" on an attachment card answered with an image makes it an image block in the
same place, with its caption, and on a canvas its corner and depth, in one undo step
when the host's ref carries its size. A host may now offer images for `kind: 'file'`,
`mode: 'replace'`.

An html attachment in a note on a canvas no longer needs the note entered first:
"Interact", full screen, the height handle and the frame while interacting take the
pointer above the note's mask, and the height follows the pointer at any zoom or note
scale (ADR 0048).
