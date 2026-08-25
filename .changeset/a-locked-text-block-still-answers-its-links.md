---
'@labre/affine-block-edgeless-text': patch
---

A link inside a locked text block can be followed again

Locking a text block on the canvas puts its whole content behind
`pointer-events: none`, which is what keeps a stray click from starting an edit
— but it also swallowed clicks on the hyperlinks inside, so a reference in a
locked annotation could be read and never opened.

Links inside a locked block now take the pointer back, cursor included. Nothing
else in the content becomes interactive, and an unlocked block is unchanged.
