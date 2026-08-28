---
'@labre/affine-gfx-c4': patch
---

c4 boundaries know their level, and the zoom rules hold

C4's four levels are ZOOMS of one element — a software system is made up of
containers, each of which contains components — and until now the canvas could
not say so. A boundary was one undifferentiated frame, so "inside a boundary"
was the only fact a rule could read, and the mistakes that matter most on a C4
diagram are precisely the ones where the frame is at the wrong zoom.

A boundary now carries its level as its role: `c4:system-boundary` and
`c4:container-boundary`, both filed under the `c4:boundary` that already
existed. The tool writes the role and the variant together at the single place
that creates a boundary, so what the corner says and what the rules read can
never disagree. Everything written on the parent role — the two membership
rules, the automatic legend's "Boundary" row, the mermaid export — reaches both
children with nothing restated, and a boundary drawn before today keeps the
parent role and behaves exactly as it always did.

Three rules follow, and they cite C4's own abstractions rather than the review
checklist, because what they indict is a statement of the model itself:

- **a software system drawn inside a boundary** — the boundary already IS a
  system or a container, so the box is a mistyped container or a zoom that never
  happened;
- **a container drawn inside a container boundary** — that boundary is that
  container, drawn inside itself; only components belong in there;
- **a component no container boundary claims** — a component is part of a
  container, so a sheet that frames it with a system boundary alone has skipped
  the level between them.

All three are remarks on the Sketch level and warnings once the board is set to
Review checklist, which now promotes nine of the fourteen rules. None of them
has a second reading under which the drawing meant it.

Nothing new is said about a diagram drawn before this change: the third rule is
framed on the container boundary, and a document whose boundaries never declared
a level has no such frame, so it gains no finding it did not already have.
