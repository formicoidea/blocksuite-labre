---
'@labre/affine-inline-link': patch
---

fix(inline): a struck link is drawn struck

Applying strikethrough (or underline) to a link lit the toolbar button and
changed nothing on screen. The link node handed `affineTextStyles` an override
object naming `text-decoration: none`, and that override is spread LAST — so it
erased the decoration the function had just computed from the `strike` and
`underline` marks.

The override no longer names a decoration. A plain link still shows none,
because `affineTextStyles` already defaults to `none` on its own; a struck link
now shows the line, and an underlined link the underline.
