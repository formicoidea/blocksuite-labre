---
'@labre/affine-block-latex': patch
---

A wide equation can be scrolled through again

An equation block centred its rendered formula in a box that scrolls
sideways, so a long equation was shrunk to its own width and the part that
overflowed sat outside the scrollable area — you could see it was cut off but
never reach it. The formula now takes the full width of the block; short
equations stay centred exactly as before.
