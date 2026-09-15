# ADR 0019 — UML reads three formats: PlantUML, XMI 2.5.1 and draw.io

- Status: **accepted** (September 2026)
- Deciders: Mathieu Jolly
- Milestone: UML 2.5.1, tranche G
- Related ADRs:
  [0012](0012-framework-interchange-and-foreign-preservation.md) (the
  interchange contract every reader here obeys: P1–P3, D1–D6),
  [0017](0017-uml-one-framework-with-diagram-kinds.md) (one framework, one
  frame per diagram — what an imported file becomes),
  [0018](0018-connector-per-end-labels-deferred.md) (why an association's `1`
  arrives as a remark rather than as a label),
  [0014](0014-senior-submenu-rules.md) (the nomination budget one of these
  three commands spends).

## Context

Phase 1 of the UML pack shipped two WRITERS and no reader: `uml:plantuml:export`
and `uml:xmi:export`. `interchange-gating.unit.spec.ts` said so in as many
words — "phase 1 writes and cannot read" — and that asymmetry is the one thing
users asked about first. A framework nobody can get a diagram INTO is a
framework people draw one diagram in and abandon: the class model they want on
the canvas already exists, in a `.puml` next to the code, in a `.xmi` their
architect exported from Papyrus, or in a `.drawio` somebody sent them.

The PO decision of 14/09/2026 is **three formats in**. Not one, and not two:

- **PlantUML** is what a developer already has. It is the format a UML diagram
  lives in when it lives in a repository, and it is what the pack already
  writes, so reading it closes a round trip rather than opening a new door.
- **XMI 2.5.1** is what a modelling tool has. It is the OMG's own interchange
  format, it is what Papyrus, MagicDraw, StarUML and Enterprise Architect all
  export, and it is the only one of the three that carries a metamodel rather
  than a notation.
- **draw.io** is what everybody else has. It is, by volume, where the UML
  diagrams of the world actually are — and it is the one whose file carries no
  UML at all.

## Decision

### 1. Three formats, five capabilities, one pipeline

| capability            | tier       | direction | what the file carries                        |
| --------------------- | ---------- | --------- | -------------------------------------------- |
| `uml:plantuml:export` | `semantic` | out       | the model, as the source a human reads       |
| `uml:plantuml:import` | `semantic` | in        | the same                                     |
| `uml:xmi:export`      | `semantic` | out       | the model, as the OMG's interchange document |
| `uml:xmi:import`      | `semantic` | in        | the same                                     |
| `uml:drawio:import`   | `visual`   | in        | a drawing that LOOKS like UML                |

Five rows because ADR 0012's unit of declaration is the **triple** — a direction
is never implied by its opposite, and a second format is a second row rather
than an option on the first.

There is deliberately **no `uml:drawio:export`**. Writing a picture back is a
re-render, which P2 rules out; a board that came in from draw.io leaves through
PlantUML or XMI with its model intact, which is strictly more than it arrived
with.

Each reader is a pure function producing the same IR — `UmlModel`, the pivot the
two writers already take — and **one** materializer (`import.ts`,
`umlElementsFromModel`) turns models into element props. A parser that minted
element props of its own would be a second place for a class box's seeding to
drift from `createUmlClassifier`'s.

### 2. draw.io is the `visual` tier, and that is a promise, not modesty

An `.drawio` cell says `style="endArrow=block;endFill=0"`. It does not say
`uml:Generalization`. Every UML fact the reader produces is therefore a GUESS
made out of a style string and a blob of label HTML:

| what the file has                                    | what we read it as           |
| ---------------------------------------------------- | ---------------------------- |
| a box whose label is `<p>Name</p><hr>…<hr>…`         | a classifier, compartments   |
| a `swimlane` with `childLayout=stackLayout` and rows | the same, rows are members   |
| `«interface»` / `<<interface>>` on the first line    | an interface                 |
| `«enumeration»` / `<<enum>>`                         | an enumeration               |
| `shape=umlActor`                                     | an actor                     |
| `ellipse`                                            | a use case                   |
| `shape=note`                                         | a note (prose, kept whole)   |
| `shape=folder` / `package` / `umlFrame`              | a package                    |
| any other `«keyword»` on a bare rectangle            | a classifier with keywords   |
| `startArrow=diamond;startFill=0` (else filled)       | aggregation (composition)    |
| `endArrow=block`, solid / dashed line, any fill      | generalization / realization |
| …with the head not hollow                            | the same, plus a remark      |
| `dashed=1` + open head                               | dependency                   |
| `«include»` / `«extend»` on such an edge             | include / extend             |
| anything else                                        | association                  |

Three consequences follow from the tier and are enforced rather than merely
stated:

1. **The user is told before the file is read.** The command's own label and
   description say "recognise … best effort", where the two semantic ones say
   "open".
2. **No round-trip promise.** Re-exporting gives PlantUML or XMI, never the
   `.drawio` back.
3. **Everything unrecognised is `carried`, naming the cell id and the style that
   defeated it.** Nothing throws, and nothing is dropped in silence — a shape we
   cannot read is a remark the author can act on, and its geometry is kept so a
   later build that learns the shape can draw it where it was.

Two subtleties are worth writing down, and both are about reading the style
rather than guessing at intent.

**The diamond is tested first.** draw.io's own aggregation style carries
`dashed=1` as well, so a dependency test that ran first would read four of
draw.io's own UML example's aggregations as dependencies.

**The two ends read their fill differently, and that is a fact about draw.io.**
mxGraph resolves `endFill` / `startFill` with a default of `1`, so a style that
names no fill renders a SOLID head. What follows from that differs per end
(lead's ruling of 15/09/2026, recorded for the PO):

- a **diamond** means one of two UML relationships and the fill says which, so
  it is READ: `startFill=0` is §11.5.4's shared aggregation, and anything else —
  an absent fill included — is the composite one, because that is what draw.io
  paints;
- a **block head** means one UML relationship whatever its fill. Ordinary
  draw.io arrows are `classic` or `open`; `block` is what the UML stencil
  writes. So a solid line with a block head is §9.2.4's generalization and a
  dashed one is §10.4.4's realization, fill or no fill.

Reading the block head's fill was tried and reversed, and the corpus is why:
draw.io's own UML class example writes its inheritance arrow as
`dashed=0;endArrow=block` with no fill at all — a 2013 file, painted by draw.io
today as a filled triangle — and demoting it to an association would lose the
one arrow whose meaning is least in doubt, on the strength of a stencil detail.

The drawing is still wrong, and the author is the only one who can fix it, so
every non-hollow block head raises a `warning`: _read as a generalization, but
the arrowhead is drawn filled; UML draws the generalization triangle hollow
(`endFill=0`)._ The board is right, the file is not, and the report says which.

### 3. The compressed-payload split

A `.drawio` file holds its `<mxGraphModel>` as **base64 of a raw deflate of
URI-encoded XML**. Inflating it needs `DecompressionStream`: a platform API, and
asynchronous. ADR 0012 P3 makes every reader a pure, synchronous function of
text — that is what lets labre-mcp call the same function the command calls, and
what lets a unit suite prove a format with six string literals. The two cannot
both be true in one function, so they are two:

| where                                       | what it does                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `drawio-import.ts` — `importDrawio`         | pure, sync, takes DECODED `<mxGraphModel>` XML                           |
| `interchange.ts` — `UML_DRAWIO_IMPORT.run`  | the same, and answers a still-compressed payload with one `warning` note |
| `drawio-decode.ts` — `decodeDrawio`         | async, `DecompressionStream`, identity for plain XML                     |
| `interchange-import.ts` — the `decode` hook | where the command runs it, before the reader                             |

The hook is on the shared pipeline (`InterchangeImportOptions.decode`) rather
than inside the UML command, because a container that is not the document is not
a UML problem: a zipped `.eapx` or an `.asta` would take the same seam. What it
throws is shown as the import's failure notification, exactly as a reader's own
refusal is.

**No dependency.** `pako` and `fflate` were both rejected: forty kilobytes in
every bundle that imports this package, for a function the runtime already has.
A runtime without `DecompressionStream` gets a NAMED error telling the user to
re-save from draw.io with File › Properties › Compressed turned off — not a
`TypeError` about an undefined constructor.

### 4. What is carried, and what is quarantined, per format

ADR 0012 D1 and D5: **carried** means kept verbatim on the nearest mapped
element and re-emitted in place; **quarantined** means kept in the document and
deliberately NOT re-emitted, because re-emitting it would write a file that
contradicts the drawing.

- **PlantUML** — a line the grammar cannot read is `carried`, named, with its
  text. Skinparams and layout directives (`together`, `hide`, `remove`) are
  `carried`: they say how to DRAW, and the drawing is the board's. Nothing is
  quarantined: the writer builds its document out of the diagram, so there is no
  slot a fragment could be spliced back into and nothing for one to contradict.
- **XMI** — every element with no Labre artefact is quarantined VERBATIM under
  `interchange.xmi`, with `UML_XMI_QUARANTINE_REASON.unmapped`; a relationship
  whose end names an element the file never declares is quarantined with
  `danglingEnd`. The distinction from PlantUML is the metamodel: an XMI file is
  a model, and a fragment of one is a fact about the model that we neither draw
  nor destroy.
- **draw.io** — everything is `carried`, and `quarantined` is structurally
  always zero. Quarantine only means something for a format Labre writes back,
  and there is no draw.io writer.

The per-end labels of an association — the `1`s beside a hollow diamond — are
`carried` for all three, because the connector has one label and ADR 0018 defers
the rest. The note says which END each one was on, so nothing has to be guessed
when per-end labels land.

### 5. Layout: the file's when it has one, ours when it does not

- **draw.io** always carries geometry. One draw.io unit is one model unit — both
  are CSS-pixel-shaped — so the only transform is a **translation**: the
  drawing's own minimum corner goes to the frame's plot origin plus a margin.
  The reader normalises to `(0, 0)` and the materializer adds the frame offset,
  which keeps each of them free of the number the other one owns.
- **XMI** carries geometry only when the file ships `umldi` / `notation` shapes.
  Papyrus's `.uml` alone does not, and is accepted with an invented layout.
- **PlantUML** never carries any. It is a source; the renderer lays it out.

An invented layout is declared as an `invented-layout` note (D4 forbids claiming
an invented position came from the file) and is **deterministic**: rows by
generalization depth — §9.2.4 draws the general classifier above the specific
one, so a hierarchy read top to bottom is drawn top to bottom — `240 × 140`
slots on a 60-unit gutter, containers laid out recursively and sized to fit,
document order as the only tie-break. No randomness, no clock, no measurement of
anything but the sizes handed in.

### 6. The round-trip promise, and its limit

For the two semantic formats: **a file this pack wrote, re-imported, is the same
model** — the same classifiers with the same members, the same relationships
between the same ends. It is pinned by `import-roundtrip.unit.spec.ts` over the
phase-1 export fixtures.

What is NOT promised, and never will be, is byte equality of the drawing.
Surface identity is Labre's and never the file's (D3), positions are re-laid out
when the format carries none, and the bottom row of every reader's loss table
says so: an import is a NEW board beside whatever is on the surface, never a
merge into it.

**Containment is drawn, not written — so the fixed point starts at the second
export.** On this canvas a use case is IN a subject, and a class is IN a
package, because it is drawn inside one: `model.ts`, `plantuml.ts` and `xmi.ts`
all read the nesting geometrically, and there is no stored parent link to read
instead. XMI carries no such geometry — a `uml:UseCase` owned by nothing is what
the writer emits for a case the author drew inside a subject rectangle — so the
first re-import lays that case out by the invented layout, outside the subject,
and the diagram it produces states slightly less than the one it came from. The
SECOND export then writes what the second board draws, and from there the cycle
is stable: export → import → export is a fixed point from the second turn on,
never from the first. `xmi-import.unit.spec.ts` pins exactly that, over a use
case diagram whose three cases are drawn inside a `Shop` subject. It is a fact
about the FORMAT — the file carries a model, and containment drawn on a canvas
is not part of that model — and not a defect in either end of the pipeline.
PlantUML is unaffected: `package P { }` is syntax, so the nesting survives as
text.

### 7. One import in the sub-menu, and it cost the note its seat

R5 puts an import in the senior sub-menu, on the PO ruling of 2026-08-28 that
nominated `bpmn.importXml`: a board comes FROM a file, and the sub-menu is the
first thing a user opens on an empty canvas. The budget (ADR 0014,
`registry.unit.spec.ts`) is `SENIOR_MENU_CAP` nominations per owner plus the
single deliberate over-nomination the PO authorized that day — which BPMN has
spent. UML nominated exactly fourteen.

So one of the three takes a seat and the other two do not, and the one is
**`uml.importXmi`**: the OMG's own format, what every modelling tool writes, and
the one that reads back what this pack exports. `uml.addNote` stood down for it
and is one click away in the catalogue behind "More artefacts…".

That trade is a **PO curation point**, not a tranche's to settle. It is recorded
as a `ponytail:` comment at `uml.addNote`'s declaration
(`gfx/uml/src/commands.ts`) with the reasoning — the note is the only nominated
artefact that ANNOTATES a diagram rather than being part of one — so it can be
overturned with usage data behind it after the phase-2 recette.

## Consequences

- UML declares five interchange capabilities; `DECLARED_CAPABILITIES` in
  `interchange-gating.unit.spec.ts` gains 5, and the UML row lists all five with
  their tiers.
- Three commands (`uml.importPlantuml`, `uml.importXmi`, `uml.importDrawio`),
  taking the catalogue count to 59 and the registry to 176.
- The shared import pipeline gains one optional seam, `decode`, and BPMN,
  Wardley and C4 are untouched by it.
- A `.xml` file is now claimed by three frameworks (BPMN, UML XMI, UML draw.io).
  That is exactly the case ADR 0012 designed `interchangeImportersByExtension`
  for — a LIST per extension, and a UI or a user chooses. Nothing infers a
  framework from a filename.
- draw.io is the library's second `visual`-tier semantic-ish reader after the
  SVG sketch, and the first one that produces framework ARTEFACTS rather than
  plain shapes. If that turns out to mislead users about what they are getting,
  the fix is the command's wording and not the reader — the tier is already the
  honest label.

## Open questions

1. **A multi-page `.drawio` is one import of its first page.** A file with four
   pages is four diagrams and this draws one sheet; concatenating them would
   produce a drawing neither page ever was. A page picker is the obvious answer
   and is not in this tranche.
2. **Papyrus `.uml` + `.notation` pairs.** The `.uml` is accepted alone with an
   invented layout. Reading the two together needs a multi-file import gesture
   the pipeline does not have.
3. **Per-end labels** (ADR 0018) would turn five `carried` remarks per real
   class diagram into drawn multiplicities. Until then, every reader records the
   end each one belonged to rather than dropping it.
