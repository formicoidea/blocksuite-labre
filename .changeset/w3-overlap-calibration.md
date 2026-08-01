---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-wardley': patch
'@labre/std': patch
---

W3 measures the words, not the box they were written in

The overlap rule was reporting things nobody can see. Two captures from the
acceptance, same cause: a Wardley label is created 120 to 200 units wide
whatever it says, so a name of three letters leaves most of its box blank —
and the rule was measuring the box. A dependency crossing that empty margin
raised label/link; two labels whose words were thirty units apart raised
label/label.

**A role can now say it is TEXT.** `RoleKind` gained a third value next to
`node` and `edge`, and `no-overlap` measures a `text` role by the ink its
words occupy inside its box, placed where the alignment puts it. The engine
still measures nothing on a canvas: a `measureText` per label per pass would
cost, and would make the same map validate differently depending on which
fonts a host happens to have loaded. The width is declared — characters ×
font size × the mean advance of a humanist sans — and deliberately on the low
side, so what error remains mostly falls towards silence. Against the real
renderer at Inter 18 a name reads between a third narrow (an all-caps acronym)
and 6 % wide; an integration test prints those numbers and pins the band.

**A rule can now say how deep a collision has to be.** `minPenetration`, in
model units: how far the two geometries reach INTO each other, which for a
link crossing a name is how far under the edge of it the line actually goes.
Wardley's W3 declares 4 — a link grazing the top of a name and two names
sharing a hair of ink are silent, a link through the middle of a name (13
units deep) and a name written across a node are not.

Nothing else moved: the same overlaps are reported, on the same pairs, with
the same severity and the same exceptions. Documents are untouched — no
schema, no stored value, no migration.
