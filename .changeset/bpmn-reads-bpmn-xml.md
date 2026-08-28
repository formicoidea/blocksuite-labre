---
'@labre/affine-gfx-bpmn': patch
'@labre/affine': patch
---

feat(blocks): a `.bpmn` file becomes a board, and what Labre cannot draw travels sealed

BPMN could write a `.bpmn` and not read one. It can now read one, which is what
turns last release's export into an **interoperability claim** rather than a
download: Labre → `.bpmn` → bpmn.io → `.bpmn` → Labre, with the part of the file
Labre has no artefact for still in it at the end.

The reader sorts every node of the file into three states and never a fourth.
**Mapped** is the vocabulary the pack draws — the seventeen kinds, the pools,
the lanes, the three edge roles, the diagram — and it lands as ordinary,
editable artefacts: a task read out of a file and a task drawn from the palette
are the same element in the document, down to the stroke width. **Carried** is
everything with no artefact and a home to ride on: a `camunda:` extension, a
`documentation`, an `ioSpecification`, and the Analytic vocabulary the
descriptive profile leaves out — a boundary event, an inclusive gateway — kept
whole on the pool of the process they were written in, with the namespace
declarations without which they could never be read again. **Quarantined** is
the short list of things that are kept and deliberately not written back,
because writing them back would produce a file that contradicts the drawing: a
vendor colour beside a shape whose fill the author can now change, the body of
an expanded sub-process drawn collapsed, a nested lane set beside the flat one
that replaced it, an `<import>` of a document nobody resolved.

What is kept is filed under the source element it came off, so two lanes of one
pool that each carry a `camunda:owner` still have two owners afterwards, and a
flow whose end is something Labre does not draw — a boundary event's error path,
the commonest Analytic construct there is — is kept whole beside the event it
runs to rather than drawn as an arrow attached to nothing.

Nothing is dropped in silence. The import returns a **report** — three counts
and a list of notes naming what happened to what, by the file's own ids — and
the notes are precise enough to act on: which fragment was quarantined and why,
which shape arrived with no diagram and was placed by Labre rather than by the
file, which lane the file lists an artefact in when the drawing puts it in
another one. Where the file's `flowNodeRef` and its diagram disagree, the
**drawing wins**: Labre stores no lane membership, it reads it off the geometry,
and a second source of truth would be contradicted by the first drag.

**The round trip is a fixed point.** A board exported, read back and exported
again is byte-identical — every id in the second file is one the first file
handed over, because an import records what it was given and an export gives it
back. That is now pinned twice: once over plain objects, and once through a live
store, a connector manager and a real browser parser.

A file's own losses are written down rather than discovered: the loss table
lives beside the reader, and says which rows are invisible (and recoverable) and
which are gone.

Two things this release does not do. There is no menu entry yet — the reader is
a pure function and a declared registry capability (`bpmn:bpmn:import`), and the
file picker, the report panel and the export warnings toast are the next
chantier's. And the carried and quarantined payloads are written to the document
without yet being written back out to a `.bpmn`: the reader puts them there
whole, and the writer that puts them back is the other half.
