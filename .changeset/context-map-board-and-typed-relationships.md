---
'@labre/affine-model': minor
'@labre/affine-gfx-ddd-shared': minor
'@labre/affine-gfx-ddd-context-map': minor
'@labre/affine': minor
---

feat(edgeless): a context map is drawn on a board, and its relationships are typed

A Context Map now has a **board** to be drawn on — a white card, deliberately
without axes or zones, because nothing about where a bounded context sits on the
sheet means anything. What the board is for is the frame: it is what tells the
tool which artefacts belong to the map, and it is what a per-map level of
requirement is written on. It is created 1400 × 900 from a new first entry in the
Context Map palette and can be stretched freely in either direction.

The nine **relationship patterns changed gesture**. They used to drop a little
drawing in mid-air — a line between two points, an abbreviation tag, two letters
— that looked like the notation and said nothing: the line was attached to
nothing, so nobody, human or machine, could tell which contexts it related, and
the user still had to drag both ends onto the bubbles by hand. Choosing a pattern
now arms the link tool, pre-styled (dashed for Separate Ways and Big Ball of Mud,
an arrowhead towards the downstream end for the five upstream/downstream ones),
and the user draws the relationship between two contexts. For the patterns that
have a direction the tool says which way to drag: from the upstream context to
the downstream one.

That is what makes the map **readable by the tool**, and five checks come with
it. It says so when a relationship loops back onto its own context, when the same
pattern is drawn twice between the same two contexts, when a context is parked
off the board, and — the two that are really about DDD — when a couple carries
both a Conformist and an Anticorruption Layer, or a Customer/Supplier plus a
pattern that contradicts it. An Anticorruption Layer on a Customer/Supplier is
reported more quietly, at every level of requirement, because it is a question
and not a mistake: it is legitimate while a model is being retired, and only the
team knows whether that is the case. Everything else stays silent — a
relationship drawn onto a cloud, onto a note, onto anything the model has not
named is somebody sketching.

Two levels of requirement ship with it, **Sketch** (the default: findings are
recorded, the canvas says nothing) and **Strict**, chosen per board from the
board's toolbar, plus a four-point quality checklist the tool cannot judge for
you: every relationship carries a discussed pattern, Separate Ways are
documented, every downstream of a Big Ball of Mud is protected, the map has a
legend.

**Nothing already drawn changes.** Maps made before this release carry no roles,
so not one of them is judged, and the old relationship drawings keep rendering
exactly as they are — they are simply drawings now, and the tool has nothing to
say about them. Redrawing one with the new tool is what makes it a statement.
