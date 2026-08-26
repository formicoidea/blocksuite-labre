---
'@labre/affine-gfx-bpmn': patch
'@labre/affine': patch
---

feat(edgeless): bpmn elements declare their roles and the sequence flow speaks

BPMN artefacts now carry a **semantic role** beside the `kind` they already had.
`kind` has not moved and still decides which glyph is painted; what it is no
longer is the authority on what the glyph MEANS. That authority is the role, and
it is what everything written about a process from now on reads — because on this
canvas the whole notation is drawn with three native shapes, and an ellipse is a
start event, an end event or somebody's doodle depending entirely on what the
author meant.

Ten roles ship: the three families BPMN's own taxonomy has — **event**,
**activity**, **gateway** — with the four artefacts of the lean pack underneath
them (start event, end event, task, exclusive gateway), the **pool** as the frame
they are drawn in, and the two connecting objects. Declaring the families now,
with one or two children each, is what lets the message and timer events, the
sub-process and the parallel gateway arrive later as leaves rather than as a
reshuffle: anything written about "an event" is written once and stays written.

The **sequence flow becomes a typed edge**. It says "is followed by", so its
source is what happens first and its target is what comes next — and the tool now
says so before the user draws, rather than leaving the meaning of the arrow to
depend on which end their finger landed on first. Hovering a sequence flow
reveals that sentence, and the arrow can be reversed from its toolbar, on a
process opened with the BPMN tooling switched off as much as on. The **message
flow** is declared alongside it ("sends a message to") and stamped by nothing
yet: it is reserved for the tool that draws it.

The shipped templates produce exactly the artefacts the palette does, so a
process started from a preset reads the same as a hand-drawn one — with one
deliberate exception, the free arrow of the "Sequence flow" card, which is
attached to nothing and therefore claims nothing.

**Nothing already drawn changes.** Processes made before this release carry no
roles, so nothing is judged and nothing is said about them; they keep rendering
exactly as they are. Drawing with the tools again is what makes them statements.
