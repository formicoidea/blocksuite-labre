---
'@labre/affine-gfx-cynefin-estuarine': patch
---

An Estuarine map's axes follow the size it is given

Stretching an Estuarine background used to leave the drawing at its authored
proportions, centred, with short axes floating in empty margins: the map was
fitted uniformly and letterboxed. It now follows the element in both
directions — the time axis runs the full real width, the energy axis the full
real height, arrowheads land at the real ends, and the three reference curves
cover the whole plane, because a negotiated boundary belongs to the plane and
not to a picture.

What is NOT stretched: stroke widths, arrowhead triangles and every word
(axis letters, curve legends) keep one isotropic scale, so a map pulled
sideways gets no fat lines, no elongated arrowheads and no squashed type.

A map left at its authored 690 × 801 ratio — including one simply scaled up or
down — paints exactly what it painted before. Nothing in the document changed.

Cynefin is untouched on purpose: its background is a figurative drawing, and
the uniform fit is the right answer there.
