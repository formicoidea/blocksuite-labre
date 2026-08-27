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
A capability's two halves are declared as one union, so an importer handed over
as an export does not compile.

**An export now says what it could not write down.** A board can hold sentences
BPMN has no way to express, and until now the person who clicked Export was the
only one not told. Three of them, each of which was a code comment: artefacts
drawn outside every pool are in the file but most BPMN tools will not draw them,
because only a pool has a shape to hold them; a message flow on a board with no
pool is left out rather than quietly demoted to "is followed by"; and an arrow
with a loose end, or an end attached to something that is not a BPMN artefact,
cannot be written at all, because BPMN requires both ends of a flow to be named.
A connector you deliberately left neutral is not one of these and says nothing —
it states nothing, so it loses nothing.

**An import report names things, it does not only count them.** Alongside the
mapped / carried / quarantined counts, a report carries a note per item worth
naming — which element, its id in the source file verbatim, and what happened to
it: kept but not re-emitted, an id we could not give back, a position the file
never carried, or a warning that our reading may be wrong. A tool that says "I
lost some things" and cannot say which has told you nothing you can act on. A
report also records the format version it actually read.

**The `.bpmn` export shipped in #149 is the registry's first entry**, declared
as `bpmn:bpmn:export`. Nothing about the file it produces changes. There is no
second door: "Export BPMN XML" runs the declared capability and downloads what
it returns, so the document, the file name and the content type all come from
one place and cannot drift apart.

Registering a capability is tooling, so it lives with the framework's flag: turn
`bpmn` off and the export is gone. What a past import wrote is content and is
gated by nothing — the board still opens, still paints, and keeps every byte it
was given.
