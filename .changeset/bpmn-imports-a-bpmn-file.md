---
'@labre/affine-gfx-bpmn': patch
'@labre/affine-shared': patch
'@labre/affine': patch
---

feat(edgeless): a `.bpmn` file imports from the catalogue — with an honest report — and export warnings reach the user

The reader shipped in #160 and nobody could reach it. **Import BPMN XML** is the
door: open the BPMN catalogue, pick the entry, choose a `.bpmn` file, and the
process is on the canvas — pools, lanes, all seventeen artefacts, the sequence
flows, the message flows and the associations, laid out where the file's diagram
drew them, and brought into view.

It needs nothing selected, which is the point: the moment you want it most is on
an empty board. So it declines the pool's contextual toolbar (a contextual
toolbar is a statement about a selection) and the senior sub-menu (which is what
you reach for to draw something), and lives in the catalogue, the command
palette and the agent surface. It does declare one precondition — it writes, so
it withdraws from every surface on a read-only document rather than sitting
there lit and doing nothing. It is keyless by default and bindable from
Settings › Shortcuts like every other framework command.

The whole imported file arrives in view: the fit is computed from the shapes,
which is what makes a process a bpmn.io user dragged far across their canvas
land at a readable size rather than as a speck beside the origin.

**It is filed in a new `interchange` section, and the export moved in beside
it.** The two directions of one format are one subject — this board as a `.bpmn`
file, out and in — and the export was under `swimlanes` only because the pool's
"⋮" is where it is reached from and a section of one is not a section. Nothing
moved inside any section: a category is where a command is filed, not where it
sits.

**The import says what it cost.** A notification names what was drawn, what was
carried (kept verbatim in the document, invisible on the canvas, because Labre
has no artefact for it) and what was quarantined (kept, and deliberately never
written back, because re-emitting it would produce a file that contradicts the
drawing) — plus the BPMN version and the tool that wrote the file, so
"bpmn.io drew it differently" is answerable in one line. When there are remarks,
a second notification spells them out; past a handful it defers to a
`console.table` that always holds all of them. That is v1 of the report (ADR
0012's open question 4): the
destination is the conformity panel, where an import remark belongs beside a
validation finding, and the console is named as a stopgap rather than dressed up
as a home.

A file that is not a readable BPMN document — malformed XML, a DMN decision
model, a choreography — is refused with the reader's own sentence, which knows
which of those it was. Nothing is drawn, and nothing is half-drawn.

What arrives is a new board beside whatever was already on the surface, never a
merge, and the whole file is one undo step.

**And the export's warnings finally reach somebody.** The writer has been
recording what a board says that BPMN has no way to write down — a message flow
on a board with no pool, an arrow with a loose end, an artefact drawn outside
every pool that most tools will not render, an imported id that could not be
given back — and the command threw the list away. It now raises one
notification. The file still downloads, and it is still valid: a warning names
what the format could not carry, not a failure.

Both notifications go through the host's notification service. A standalone
playground registers none and degrades to silence — the elements are on the
surface either way.
