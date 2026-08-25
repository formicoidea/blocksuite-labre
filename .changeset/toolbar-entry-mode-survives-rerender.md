---
'@labre/affine-widget-toolbar': patch
---

fix(edgeless): a re-render draws the row it is already wearing

PO recette of 25/08/2026. Zooming with a component selected still made
"Read this component" flicker — the entry alternating between its word, its
icon and a line of the "⋮" while the gesture ran. The PO named the display of
the label as the culprit, and the measurement agrees.

**What was flapping, measured.** Not the plan of the previous pass: a bare zoom
is clean, and stays clean. What the previous pass froze is the path that starts
from a room that CHANGED. There is a second path into the row, and it was not
frozen at all: the widget rebuilds the toolbar from the registry whenever
anything it watches moves — an element updated anywhere on the canvas, a block
updated, a selection re-emitted, something hovered — and each of those rebuilds
discarded the plan, painted the undegraded row, and only then measured it and
degraded it again. One flash of the full label per rebuild, plus a full replan
at whatever width the gesture happened to be passing through. Sampled entry by
entry, frame by frame, over a two-dozen frame zoom with one such write every
fourth frame, the entry read `icon → menu → label → menu`.

**The plan is state, and the render reads it.** The mode an entry appears in is
now an argument of its own render in every case: the row is asked which row it
is BEFORE anything is drawn, and a row that has not changed is drawn wearing
the plan already on screen — same entries, same modes, no DOM change, nothing
to see. Only a row that is genuinely different — different entries, different
words — is rendered whole, measured, and degraded. Re-renders during a gesture
are therefore free, and the accalmie is once again the only thing that decides.

Which row it is comes from a signature of the resolved entries, their words
included: an entry that changes its label changes what the row costs, and a
plan measured on the old words no longer describes it.

Nominal collapse is untouched, and so is the freeze of the previous pass: the
row is still measured whole when it is new, still gives way immediately when
the editor hands it less width, and is still replanned exactly once when the
viewport lands.
