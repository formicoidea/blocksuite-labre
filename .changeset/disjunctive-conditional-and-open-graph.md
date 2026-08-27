---
'@labre/affine-block-surface': patch
---

feat(blocks): a bound that either side may satisfy, one that waits to be armed, and a graph that starts where it is drawn

Three small extensions to the rule families, each closing a shape a real
notation makes and the engine could not express. All three are additive: absent,
every existing rule means exactly what it meant.

**`edge-degree.eitherMin`** — a DISJUNCTIVE floor. The four per-direction bounds
are conjunctive, and a whole class of requirement says the opposite: an artefact
must do one thing OR the other, and doing either is enough. A branching artefact
that neither splits nor merges takes one thing in, puts one thing out and
decides nothing — but `minIn: 2` would indict every split and `minOut: 2` every
merge, so no conjunction of the four says it. The bound is orthogonal to them
and reported last, because "nothing arrives here" names the side to act on and
"neither side has enough" does not.

**`role-count.ifPresent`** — a GUARD. Whole families of artefact are optional
alone and normative in pairs: a sketch may show neither a beginning nor an end,
but not one without the other. An unconditional minimum would state the wrong
thing twice — indicting the legitimate sketch, in the name of a requirement the
notation does not make — so the pairing is written as a bound plus a guard, and
the two directions are two rules. A frame the guard has not armed is not judged
at all, rather than judged and found compliant. The guard element has to be IN
the frame, on the same containment-only reading the counted subjects use.

**`reachability.implicitRoots`** — a second kind of beginning. A notation whose
start marker is optional has a silent way of saying where the work begins: draw
the artefact and point nothing at it. Two branches side by side, only one of
them marked, are both well-formed — and the traversal would have reported the
whole of the unmarked one as unreachable, a wall of brackets over a drawing that
is right. With the flag on, what survives is the only real defect: a ring
entered from nowhere, whose work can never begin. The zero-root silence is
unchanged in spirit and widened in fact — it now means no root of either kind.

Still linear, still `O(V + E)`, still no framework name anywhere in the engine.
