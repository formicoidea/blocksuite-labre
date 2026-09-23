---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-cynefin-estuarine': patch
---

A Cynefin frame dragged off its proportion no longer keeps the empty bands it
letterboxes: when the resize handle is let go, its border comes back onto the
drawing, so the board can be selected by the edge you can see. At 1600 × 600
that is 383 model units of nothing removed from each side. The picture itself is
untouched — same shape, same size, same centre — and the resize and its crop are
one undo step. A frame stretched before this change is cropped the next time it
is resized; nothing is rewritten behind the user's back, and a readonly document
writes nothing at all.

The uniform fit the three hand-drawn frameworks share (Cynefin, Estuarine, EDGY
and the DDD stencils) was copied in three packages and is now one function in
`@labre/affine-block-surface`, so the crop reads the very function the renderer
paints through.
