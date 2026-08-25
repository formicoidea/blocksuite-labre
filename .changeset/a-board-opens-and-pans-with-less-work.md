---
'@labre/affine-shared': patch
'@labre/affine-widget-drag-handle': patch
---

A board opens and pans with less work

Opening an editor downloaded every canvas font before anything else, even the
faces no document on screen asks for. The fonts a board paints with on its
first frame are now fetched straight away and the rest arrive a few seconds
later, four at a time, while the browser is idle. The same face registered
twice is now registered once. Nothing observable changes: the canvas is still
repainted once every font is in.

Panning or zooming an edgeless board recomputed the drag handle's position
twice per frame and rewrote six inline styles each time, whether or not the
handle had moved. The position is now measured once, applied at most once per
frame, and written only where it actually differs.

Hovering in page mode ran a note lookup on every straight pointer move and
skipped it on every diagonal one — a guard that had the test inverted. The
lookup now runs when the pointer actually reaches a different block, so the
handle also follows a diagonal move.
