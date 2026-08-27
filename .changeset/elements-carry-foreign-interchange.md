---
'@labre/std': patch
---

feat(std): elements can carry a sealed foreign-interchange payload per format — the ADR 0012 field

Every surface element gains one optional field, `interchange`: verbatim foreign
matter from an import, keyed by the FORMAT it came from (`bpmn`, `owm`, …) and
never by the framework, because a `.bpmn` file and an OWM file make different
promises about the same element.

Nothing writes it yet — this is the carrier ADR 0012 decided, landing ahead of
the importers that will fill it. It is dumb storage on purpose: the model holds
fragments, foreign attributes, the source file's own id and whatever an importer
chose to quarantine, and it never learns what any of that means. The
three-state contract an import obeys — **mapped** (there is a Labre artefact,
re-emitted from the drawing), **carried** (kept verbatim, re-emitted in place),
**quarantined** (kept, but re-emitting it would contradict the document) —
lives in the importers and exporters, and stays there.

Per element rather than in a table beside the document, because that is the only
shape that survives the day-to-day. Copy an imported task, duplicate it,
alt-drag it, turn it into a linked doc: the payload travels, because a copy
replays the element's own serialized props. Delete the task and the payload goes
with it, instead of leaving a row nothing will ever collect. Declared on the
base class rather than per subclass for the same reason and one more — a BPMN
sequence flow is a plain connector, and shared plumbing should not carry a
framework's name.

Costs nothing to a board that never met an import: the default is `undefined`
and no key is written, so an element stays byte-identical to one created before
the field existed. No schema version bump, no migration, every document on disk
opens unchanged.
