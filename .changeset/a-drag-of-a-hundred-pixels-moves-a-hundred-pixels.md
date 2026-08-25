---
'@labre/std': patch
---

A drag of a hundred pixels moves the element a hundred pixels

The viewport reads how much an outer container scales the whole editor by
comparing the width the host paints with the width it lays out. The laid out
width comes from `offsetWidth`, which the browser only ever gives as a whole
number, so a host that happens to be a fraction of a pixel wide — a window on a
HiDPI screen, a column left with a fractional remainder — reported a scale of
about 1.0001 while nothing was scaled at all.

Everything that turns a pointer position into a board position divides by that
scale, so every drag came back short: an element pulled 100 pixels moved
99.986, and the further from the board origin, the further overlays sat from
the element they decorate. A difference smaller than that rounding is now read
as no scale at all, and a nested editor that really is scaled reads exactly as
before.
