---
'@labre/affine-gfx-bpmn': patch
'@labre/affine': patch
---

feat(blocks): a re-exported board gives back what the import did not understand

The previous release taught Labre to READ a `.bpmn` and to keep, verbatim and on
the element it came off, every part of the file it has no artefact for — a
boundary event, a `camunda:` extension, a vendor's namespace declaration. It
kept all of it in the document and wrote none of it back. A file with a boundary
event survived the import and was lost on the next export, which is the
invisible loss the whole chantier exists to prevent, delayed by one step.

This release closes the loop. **The exporter reads the payload the importer
wrote** and puts each piece back where it came from: an attribute onto the
element its scope names, a fragment inside the element it was a child of, a
carried flow node into the process, its `BPMNShape` back onto the plane, the
file's namespace declarations back onto `definitions`. `isExecutable="true"` is
given back instead of being downgraded to `false` on every round trip.

**Where a fragment goes is the schema's answer, not the payload's.** A scope
records which element a fragment was a child of and says nothing about which
slot of it — and `tProcess` is an `xsd:sequence`, so a carried `<auditing>`
written after the lane set is a document a validating parser refuses even though
every character of it is right. Placement is derived from the same XSD sequences
the exporter already writes its own children in: the base type's children first,
then lane sets, flow elements, artifacts, and the resource roles that follow
them. Carried matter lands in a legal slot, always.

**The claim is a fixed point, and it is a test.** Read a file this library did
not write, export it, and read it again: the carried payloads are identical, key
for key, and the second export is byte-identical to the first. That mirrors the
round-trip guarantee a Labre-drawn board already had, on matter Labre does not
understand — which is the harder half and the one an architect actually relies
on. A board that never met an import writes exactly the bytes it wrote before.

Two things the writer found and fixed on the way, both of which would have been
silent:

- **the file's own prefix.** bpmn.io writes BPMN's namespace as `bpmn2:` and
  this library writes it as `bpmn:`. Fragments are stored with the prefixes the
  file spelled them in, so a document that declares only `xmlns:bpmn` cannot
  parse a single one of them. The reader now keeps a declaration unless the
  prefix AND the URI are both ones the writer makes anyway;
- **quarantine defeated by its own leftovers.** The body of an expanded
  sub-process is quarantined (D5); its inner shapes were then orphaned, carried
  by the residue sweep, and would have been drawn by the writer. Quarantine now
  takes the whole subtree's diagram with it.

What still does not round-trip is in the loss table, in `import.ts` and in ADR
0012, and two rows are new because the writer put them there: a carried shape
keeps the source file's coordinates, so once the drawing has been moved it lands
beside the process rather than inside it (the export says so); and a file that
binds one of this library's own four prefixes to some other namespace keeps that
declaration in the document and out of the file, because writing it back would
rebind the prefix every `dc:Bounds` is written under. Quarantined material is
never re-emitted, by design and by test.
