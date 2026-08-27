---
'@labre/affine-gfx-bpmn': patch
'@labre/affine-model': patch
'@labre/affine': patch
---

feat(edgeless): the BPMN pack draws the whole descriptive profile

The BPMN pack knew four artefacts: a start event, an end event, a task and an
exclusive gateway. That is enough to draw a diagram and not enough to draw a
PROCESS — the moment an architect has to say what starts the thing, who does the
work, what the parallel branch is, or which system of record it writes to, they
were drawing rectangles and explaining them in a meeting. Sixteen artefacts now
ship: the **descriptive conformance subclass** of BPMN 2.0, which is the subset
the standard itself defines for people who model processes rather than execute
them.

What arrives: the **message** and **timer** starts and the **message** and
**terminate** ends; the **user** and **service** tasks, the collapsed
**sub-process** and the **call activity**; the **parallel gateway**; and the
three artefacts a process needs to point at things outside itself — the **data
object**, the **data store** and the **text annotation**.

Each is drawn the way the notation draws it, and each is drawn ON the shape it
already was: a message start is the same thin green ring with an envelope in it,
a user task the same rounded rectangle with a person in its corner, a call
activity the same rectangle with the border thickened to say "this stands for a
whole process defined somewhere else". Nothing was re-skinned, so a process drawn
last month sits beside one drawn today and they are the same picture.

Two deliberate simplifications against the reference rendering, both noted in the
code: a message END event's envelope is drawn hollow rather than solid — the
thick red ring already says it is an end, and it says it from further away — and
the timer has no hour ticks. An expanded (drilled-into) sub-process is not here
either: `subProcess` is the collapsed representation, the `+` box, because an
expanded one is a container with its own flow inside it and that is a different
feature.

**Fourteen roles** join the vocabulary underneath the families that were declared
for exactly this — the message and timer starts under `bpmn:start-event`, the
user and service tasks under `bpmn:task`, the parallel gateway under
`bpmn:gateway` — so everything already written about "an event" or "an activity"
keeps applying, unchanged, to artefacts that did not exist when it was written.
Two families are new: **`bpmn:data`**, because the paperwork is not the work and
a rule about what a process DOES must never reach a data store; and
**`bpmn:association`**, the one edge in this library with no verb at all, since
"this note is about that task" reads the same from either end.

**Nothing already drawn changes.** The new artefacts are new VALUES of the field
every BPMN node already carries — no schema change, no migration, no backfill. A
process authored before this release loads byte for byte and paints exactly as it
did.

The palette entries, shortcuts and templates for the twelve new artefacts follow
in the next release; this one is the model, the vocabulary and the rendering.
