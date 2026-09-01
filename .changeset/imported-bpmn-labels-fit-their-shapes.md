---
'@labre/affine-gfx-bpmn': patch
---

fix(edgeless): imported bpmn labels fit their shapes

A `.bpmn` file drawn by another tool places its artefacts at that tool's own
scale — bpmn.io's normative sizes are a 100×80 task and a 36-unit event, against
this pack's 120×72 and 56 — while the label was materialized with the type and
the margin calibrated for the pack's own boxes: an 18-unit font inside the
shape's fixed 20-unit horizontal inset. In an imported task that left 60 units
of line and broke the label in the middle of a word ("Étudie / r le dossie / r");
in an imported event it left no room at all, and the name sprawled across the
canvas.

An artefact read from a file now has its label fitted to the box the file gave
it: the font and the margin shrink with the symbol, and the text is `Contained`,
so the renderer keeps shrinking it until it fits rather than painting it past
the shape. Artefacts placed from the catalogue are untouched, and the geometry
the file drew is written back unchanged — the fix is visual only, and the XML
round trip is the same file it was.
