---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-shared': patch
'@labre/affine': patch
---

feat(edgeless): interchange imports share one materializer, reporter and picker — and **Import BPMN XML** joins the senior sub-menu

**Importing a `.bpmn` file no longer starts with finding the catalogue.** The
entry is in the BPMN sub-menu, beside the artefacts, which is the first thing a
user opens on an empty canvas — and an empty canvas is exactly where somebody
who was just sent a process is standing. The PO decision of 2026-08-28 reverses
the earlier reading ("the sub-menu is a row of things you draw") for the import
alone: a board comes _from_ a file. The export keeps the old reading — it is
what you do to a board you already have, and it is reached from the pool it is
about. The row itself is unchanged in size: BPMN's toolbox has been past the cap
for a while, so the sub-menu still shows thirteen ranked buttons plus **More
artefacts…**, and the import takes a slot only for the user who actually reaches
for it.

The picker now filters on what the format itself declares, which is why a
process saved as `.xml` — half the tools in the wild write one — can be picked
again where the old hard-coded filter had it greyed out. What the file _is_ is
still decided by the reader, which refuses anything that is not a BPMN
`<definitions>`.

**Under it, the import glue became the platform's rather than BPMN's.** Writing
an imported board onto the surface, repairing the connector ends that named the
source file's ids, fitting the drawing into view, and saying what the import
cost were written once for BPMN and were never about BPMN. They are now four
functions in `@labre/affine-block-surface` — `materializeInterchangeImport`,
`reportInterchangeImport`, `runInterchangeImportFile` and
`interchangeImportersByExtension` — and they are the **public import API**: a
host builds its own canvas import UI on them, and a framework's import command
is one call. BPMN's own entry points are unchanged and behave identically.

`interchangeImportersByExtension` answers "what could read a file called this",
and answers with a **list**: `.svg` will be claimed by several frameworks at
once, because which framework's vocabulary a picture is a picture _of_ is not a
fact about a filename, and guessing on the user's behalf is the one thing
`docs/adr/0012` refuses.

**One report wording for every format, instead of one per format.** The
notification composes the format's own name into a shared set of translation
keys (`com.labre.interchange.import.*`), so a host translates "file imported"
once rather than once per reader we ship, and a new format is never silently
untranslated. What a BPMN user reads is unchanged, down to the version line.
