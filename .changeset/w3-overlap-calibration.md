---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-wardley': patch
'@labre/std': minor
---

W3 measures the words, not the box they were written in

The overlap rule was reporting things nobody can see. Two captures from the
acceptance, same cause: a Wardley label is created 120 to 200 units wide
whatever it says, so a name of three letters leaves most of its box blank —
and the rule was measuring the box. A dependency crossing that empty margin
raised label/link; two labels whose words were thirty units apart raised
label/label.

**A role can now say it is TEXT** (`RoleKind` gains a third value next to
`node` and `edge`, hence the `minor` on `@labre/std`). `no-overlap` measures a
`text` role by the ink its words occupy inside its box, placed where the
alignment puts it — and hands a ROTATED text its whole box back, because
narrowing one is how a miss gets built rather than a warning too many.

The engine still measures nothing on a canvas: a `measureText` per label per
pass would cost, and would make the same map validate differently depending on
which fonts a host happens to have loaded. The width is declared, per character
and by CLASS — thin `i l I j` and punctuation, narrow `f t r`, wide `m w M W`,
capitals, full-width scripts, and the rest. One mean advance was the first
answer and it read `utility` half as wide again as it is drawn, which put a
ghost 20 units past the last letter and a false positive on every link crossing
it. Against the real renderer at Inter 18, over a 28-name bench, the table now
lands between 11 % narrow and dead on — **never wide, on any of them**. The
test prints every line and fails outside ±15 %.

**A rule can now say how deep a collision has to be.** `minPenetration`, in
model units: how far the two geometries reach INTO each other, which for a
link crossing a name is how far under the edge of it the line actually goes.
Wardley's W3 declares 4 — a link grazing the top of a name and two names
sharing a hair of ink are silent, a link through the middle of a name (13
units deep) and a name written across a node are not.

Nothing else moved: the same overlaps are reported, on the same pairs, with
the same severity and the same exceptions. Documents are untouched — no
schema, no stored value, no migration.
