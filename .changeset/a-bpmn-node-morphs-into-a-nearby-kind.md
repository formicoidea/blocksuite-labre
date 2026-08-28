---
'@labre/affine-block-surface': patch
'@labre/affine-components': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-shared': patch
'@labre/affine': patch
---

feat(edgeless): a BPMN node changes into a nearby kind from its own toolbar

Realising mid-draft that the rectangle should have been a **user task** used to
cost a delete, a re-draw, a re-connect and a re-typed label — and every sequence
flow attached to the node with it. Select a BPMN node now and its contextual
toolbar carries a **Change type** dropdown: pick the user task, the timer start,
the parallel gateway, the call activity, and the element stays the same element.
Same box, same words, same wires, same id. What DOES change is the artefact's
kind, its role and its appearance: a morph resets styling to what the target
kind is born as, so a morphed node and one drawn fresh from the palette are the
same element. One ctrl+z puts it back.

What a node may become is **declared data**, not a derivation: six families —
the three tasks, the three starts, the three ends, the two gateways, the two
data artefacts, and the sub-process with the call activity. Nothing crosses
between them, because a task and an end event are not the same claim about a
process; and the text annotation and the group belong to no family at all, so
the dropdown never appears on them. The role tree was the tempting source and
the wrong one — it makes a task and a sub-process both activities, and only a
human knows which pairs a reader accepts as "the same artefact, said more
precisely".

The capability itself is generic (`morphToolbarConfig`, in the surface package)
and names no framework: a second framework gets the same dropdown by declaring
its own families, its own patch per kind and its own icons, exactly as it
already registers its validation rules. BPMN is the first taker, and registers
it from its flag-gated half — a morph is tooling, so switching the framework off
takes the menu away and leaves every node drawn, painted and checked as before.

Kind and role are rewritten together in one atomic write per element, so the
validation engine re-judges the board on its own and no rule ever sees an
element that is half one artefact and half another. The patch is the shipped
creation preset in full, which matters concretely for one pair on today's
table: a sub-process and a call activity are the same rounded rectangle and
differ only in border thickness, so a call activity really does come out with
the thick border that IS the distinction between them. Everywhere else the
members of a family already share a preset, and the full patch is kept anyway —
insurance for the day a family gains a member that styles itself differently,
and the guarantee that morph and palette can never disagree.

One new telemetry event, `FrameworkElementMorphed`, carrying the two roles, the
framework and how many elements one gesture rewrote — never board content. It is
its own event rather than a creation one for the reason `FrameworkElementPromoted`
is: a morph inserts nothing, and counting it as a creation would inflate
"elements added per framework" forever.
