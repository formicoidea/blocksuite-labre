---
'@labre/affine-gfx-edgy': patch
---

Every EDGY board is now born on its drawing instead of inside a wide empty
band, so clicking near the visible edge selects it. The room kept for the three
facet names is measured and asymmetric — the words are ("Identity" on the left,
"Architecture" on the right) — instead of one symmetric 140 either side, and the
padding round the circles drops from 8 reference units to 2.5, because that
padding is spent at the board's own scale: on the EDGY dynamic template, which
draws at 4.8, it was 32.4 model units of nothing on each of the four sides.

A new facets diagram is born at 687 × 466.5 rather than 874.5 × 487.5, and the
dynamic template's board at 1401.6 × 1339.2 rather than 1454.4 × 1392; in both
cases the Venn itself is drawn at exactly the same size, and the template's
twelve elements are placed from the same box as its board, so a freshly inserted
template is aligned. Its thumbnail follows the new framing.

A board created before this change keeps its `xywh`, so its drawing grows inside
it: a facets diagram by 4.5 %, sliding 27 units left (3.1 % of the width), and a
dynamic board by 3.8 %, its centre moving less than 3 units. Anything dropped on
top stays where it was and therefore shifts by that much relative to the
circles.
