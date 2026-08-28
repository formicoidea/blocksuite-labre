---
'@labre/affine-gfx-wardley': minor
'@labre/affine': patch
---

feat(edgeless): a Wardley map arrives from and leaves as an OnlineWardleyMaps `.owm` file

Two new entries in the Wardley catalogue, and they are one subject in two
directions: **Import Wardley map (OWM)** and **Export Wardley map (OWM)**.

**Import** is in the Wardley sub-menu, because on an empty canvas that row is
the first thing you open and "start from the map somebody sent me" belongs in
it. Pick a `.owm` (or `.wm`) file and the map is on the board: the axes, every
component, anchor, market, ecosystem and pipeline where the file's coordinates
put them, every dependency drawn from the consumer to what it needs, every
`evolve` line drawn as an evolved twin with the red arrow that says it is
moving, and the notes. It needs nothing selected. It writes, so it withdraws
from every surface on a read-only document rather than sitting there lit and
doing nothing. The whole file is one undo step, and it arrives in view.

**Export** is in the catalogue, the command palette and the agent surface. It
downloads the whole map as an `.owm`, ready to open in any Wardley mapping tool.
It reads and never writes, so it is offered on a locked map and on a read-only
document — which is precisely the board somebody wants to take away. It appears
whenever there is a Wardley map on the board, because a Wardley component has no
"evolution" property: where it sits on the plot **is** its coordinate, so with no
map there is nothing to measure against.

**The import says what it cost.** A notification names what was drawn and what
was carried — kept verbatim in the document, invisible on the canvas, because
Labre draws no artefact for it. Everything the pack does not draw is carried and
given back on the next export, in place: `style`, `size`, the evolution-axis
labels, `annotation`, the attitudes, `submap`, `url`, `accelerator`, the flow
links, a link with a `;` context, a pipeline with a `{ … }` body, and every `//`
comment. A modifier written on a line that IS drawn — `label [12, -8]`,
`(build)`, `inertia` — comes back on that very line rather than at the bottom of
the file.

**And it never claims a position it invented.** A statement with no coordinates —
`anchor Client`, which is how half the maps in the wild are written — is laid out
at the top of the value chain and the report says, by name, that the file did not
say where it goes. Unreadable coordinates get the same treatment plus a warning.

**Export warnings reach the user too.** A board with two maps on it (an `.owm`
holds one), an artefact with no name (a component is identified by its name), a
component sitting off the plot, an evolution arrow that also climbs the value
chain, a link with a loose end — each is a sentence the format has no way to
write down, and the person who clicked Export is the one entitled to hear about
it. The file still downloads, and it is still valid.

Both notifications go through the host's notification service; a standalone
playground registers none and degrades to silence.

**The Wardley sub-menu now has a "More artefacts…" button.** Fifteen commands is one past the fourteen the row seats, so — exactly as BPMN's does — the Wardley palette becomes the thirteen artefacts you reach for most, plus one button that opens the full catalogue. Nothing became unreachable, and everything is still in the catalogue, the command palette and Settings › Shortcuts.

**The serializer now lives in the library.** It used to live outside this
repository, which meant one format with two implementations that nothing
compared. `exportWardleyOwm` and `importWardleyOwm` are pure functions exported
from the Wardley package, so the editor command and any host tool call the same
one — and the round trip they make together is pinned: a map this library wrote
comes back byte for byte, and a map it did not settles after a single cycle.
