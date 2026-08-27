---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine': patch
---

feat(blocks): imports and exports become declared interchange capabilities; the BPMN export is the first

Reading a foreign file and writing one stop being something a toolbar happens to
do and become a **declared platform capability**, registered the way validation
rules and profiles already are. The platform can now answer a question it could
not ask before: what can Labre read, what can it write, and for which framework.

The unit of declaration is the **triple** — framework × format × direction — and
a direction is never implied by its opposite. BPMN writes a `.bpmn` and cannot
yet read one; the registry says exactly that instead of leaving a caller to
assume a symmetry nobody implemented. The triple is also the id and the DI key,
so a capability whose id disagrees with its own three fields is refused at
registration, and a second capability cannot quietly take the first one's place.

Each format declares its **tier**, and the tier is what a user is entitled to
expect. A `semantic` format carries a model — `.bpmn`, mermaid, the OWM DSL — so
an import of one is a translation and owes the full preservation contract. A
`visual` format carries a rendering, so an import of one is best-effort
recognition of shapes and promises no round-trip. A single "Import…" entry that
hid the difference between the two would earn a support ticket per user.

The two halves are mirror images and neither knows what an editor is. An
exporter takes element models and returns the document, its suggested filename
and its mime type. An importer takes text and returns **serialized element
props** — never live models: it has no surface to add them to, and the caller
does the writing. That is what lets the same function serve an editor command
and an MCP tool, and lets both be tested with plain objects and no container.

**The `.bpmn` export shipped in #149 is the registry's first entry**, declared
as `bpmn:bpmn:export`. Nothing about the file it produces changes: the command
and the capability are two doors onto one serializer, walking one board through
one function, and a test pins that they emit the same bytes and name the
download the same thing.

Registering a capability is tooling, so it lives with the framework's flag: turn
`bpmn` off and the export is gone. What a past import wrote is content and is
gated by nothing — the board still opens, still paints, and keeps every byte it
was given.
