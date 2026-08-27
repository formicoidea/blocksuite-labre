---
'@labre/affine-block-surface': patch
---

feat(blocks): count relations, count artefacts per frame, and follow the graph

Four new rule families in the validation engine, plus one capability on an
existing one. All framework-agnostic: a framework declares data, the engine
knows a family and never a notation.

**`edge-degree`** — how many typed relations may arrive at, and leave, one node.
The half of a relation grammar no per-edge rule can express, because the mistake
is a COUNT and nothing is wrong with any single link: "this step begins the
process, so nothing points at it", "this step is not a dead end". Read off the
persisted `source → target` pairs, so the verdict survives every layout of the
same document, and one finding per node however many bounds it breaks.

**`role-count`** — how many artefacts of one role one INSTANCE of a frame must
carry. Existence and uniqueness, tallied per frame and reported ON it, so the
bracket lands on the frame and an arbitration made on one frame says nothing
about the frame beside it. Membership is containment only: an artefact floating
next to a frame has never satisfied a requirement about what is inside it.

**`edge-locality`** — a relation constrained relative to the frames its two ends
sit on: one relation stays inside a single frame, another only exists between
two. In the legal case and the illegal one the two ends carry exactly the same
roles, so nothing but the attribution can tell them apart — which is why no
grammar rule could ever say it.

**`reachability`** — every artefact must be reachable from a declared root by
following typed relations. The orphan question, and the first one in this engine
that no amount of looking at an element or at a relation can answer. A board
carrying no root at all is total silence: the missing root is `role-count`'s
finding, raised once, on the frame, rather than a wall of brackets with one
cause.

**`relation-endpoints` learns to see the link nobody typed.** Quick-connect and
auto-complete draw a connector carrying no role, so a framework's grammar read
it as absent while the user read it as drawn — a board that looks joined up and
validates as if nobody had joined anything. A rule can now ask for exactly one
kind of role-less link back: one drawn between two artefacts of its own
vocabulary. A plain link to a note, to a legend glyph, to a rectangle somebody
dropped on the board to think with, stays what it always was — somebody
pointing at something, and none of the framework's business.

Every family is linear in the elements and the relations, `reachability` is
`O(V + E)`, and none of them adds a pair-wise sweep: the 16 ms drawing budget
and the single quadratic term the engine already had are untouched.
