# ADR 0032 — A Wardley SVG import recognises the map it is a picture of

- Status: **accepted** (2026-10-04)
- Deciders: Mathieu Jolly
- Milestone: product decision "importing a Wardley SVG yields native Wardley
  objects" (2026-10)
- **Supersedes, for Wardley only**, the answer ADR 0012 recorded under P2,
  _Answered at implementation (PR #173)_, point 1: "what a visual capability
  is allowed to guess: geometry, and nothing else", and the
  `wardley:svg:import` row of its roadmap ("the SAME parser BPMN declares").
  Everything else in P2 stands, for Wardley as for every framework (§8).
- Related ADRs: [0003](0003-telemetry-bus-and-taxonomy.md) (ids only),
  [0007](0007-universe-tag-defs-format.md) (the promotion ladder a sketch
  lands on), [0009](0009-reversed-flag-contract.md) (an importer is tooling),
  [0012](0012-framework-interchange-and-foreign-preservation.md),
  [0025](0025-board-svg-export.md) (the export this ADR adds markers to).
- **Red zone: none in the CLAUDE.md sense** — no schema, no stored field, no
  enum. It reverses part of an accepted platform decision and adds attributes
  to a file Labre publishes, which needs the maintainer's approval the same
  way.

## Why a new ADR and not an amendment to 0012

`docs/contribute/06-decisions.md`: never edit an accepted decision — add a
dated amendment, or supersede it and link both ways. The amendments this repo
carries add or withdraw at the margin (0009's legend sentence, 0025's nested
frames). This one reverses a stated rule for one framework, adds a marker
vocabulary to an export another ADR owns, and fixes a detection protocol with
its own alternatives — a decision, not a margin note. It also has to be
**proposed** before it is accepted, and an amendment has no status of its own.
On acceptance, ADR 0012 gains a dated amendment under P2 pointing here, and
its open question 2 gains the same pointer; nothing in its accepted text
changes.

ADR 0012 anticipated the case in its own words: "the day one of them wants
more, it writes its own parser and its own paragraph beside it", and open
question 2 "re-opens the day a framework wants narrower or wider recognition
than the shared parser gives it". This is that day, for Wardley.

## Context

What exists, verified:

- `wardley.importSvg` (`packages/affine/gfx/wardley/src/commands.ts:508-535`)
  runs `WARDLEY_SVG_IMPORT`, a `tier: 'visual'` capability whose `run` IS the
  shared `parseSvgSketch` (`packages/affine/gfx/wardley/src/interchange.ts:130-163`),
  pinned by identity (`gfx/wardley/src/__tests__/interchange.unit.spec.ts:66-73`).
  BPMN declares the same function (`gfx/bpmn/src/interchange.ts:403`, pinned at
  `gfx/bpmn/src/__tests__/interchange.unit.spec.ts:174`).
- `parseSvgSketch` (`packages/affine/blocks/surface/src/extensions/svg-sketch.ts:1245-1288`)
  is geometry only: `<rect>` → rectangle, `<circle>` → ellipse, paths → brush
  strokes, `<text>` → free text, no role (module statement, `svg-sketch.ts:41-122`).
  It parses for a verdict, then sanitises the SOURCE with DOMPurify
  `USE_PROFILES: { svg: true }` and walks only what comes back, naming every
  removal (`svg-sketch.ts:1147-1233`). Only `parseSvgSketch` and the three
  format constants are exported (`svg-sketch.ts:133-135`).
- The visual tier writes no `interchange` payload and reports `carried: 0,
quarantined: 0` (`svg-sketch.ts:1275-1285`), pinned by an anti-decay test
  (`blocks/surface/src/__tests__/svg-sketch.unit.spec.ts:84`).
- The OWM text importer already produces every native Wardley prop
  (`gfx/wardley/src/import.ts:407`, its builders from `import.ts:1010`), and
  the plot helpers that turn `[visibility, evolution]` into a surface point and
  back are pure and exported: `owmPlotOf`, `owmPointOf`, `owmCoordsOf`
  (`gfx/wardley/src/export.ts:240-296`).
- `importInterchangeFile` re-checks `store.readonly` after its awaits and
  materialises the whole result between two `captureSync()` calls — one undo
  step (`packages/affine/blocks/surface/src/extensions/interchange-import.ts:641-718`).
  A reader may hand provisional local ids that the materializer uses to wire
  connectors and groups, then discards (`interchange-import.ts:77-95`).

The four producers, read in their sibling repositories (read-only):

| producer                             | what marks it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OnlineWardleyMaps** export         | the plot is `<rect id="fillArea" x="0" y="0" width height>` (`frontend/src/components/map/foundation/MapBackground.tsx:20-26`), the export wraps the live map in `translate(35, 45)` (`frontend/src/components/MapEnvironment.tsx:600-640`); ids `element_<id>` (`map/MapComponent.tsx:271`), `element_circle_<id>` / `element_square_<id>` / `ecosystem_circle_<id>` / `market_circle_<id>` (`map/renderers/ComponentRenderer.tsx:223`, `237`, `251`, `265`), `pipeline_box_<id>` (`map/Pipeline.tsx:77`), `modern_link_<from>_<to>` (`map/ComponentLink.tsx:133`), `modern_evolving_link_<from>_<to>` (`map/EvolvingComponentLink.tsx:92`), `accelerator_element_<id>` (`map/MapAccelerator.tsx:39`), `method_<id>` (`map/MethodElement.tsx:27`), `modern_note_text_<id>` (`map/Note.tsx:271`), `mapTitle` (`map/MapTitle.tsx:92`) |
| **wardley-map-renderer** (labre-mcp) | every layer wrapped in `<g data-layer="…">` (`src/render/compose-core.ts:96`), names `title, axes, pipelines, edges, evolvesTo, nodes, steps, accelerators, labels, notes, legend` (`src/render/layer-list.ts:24-36`); the axes layer draws the x axis from `(plot.left, plot.bottom)` to `(plot.right, plot.bottom)` and the y axis from `(plot.left, plot.bottom)` to `(plot.left, plot.top)` (`src/render/axes-layer.ts:55-67`); in interactive mode only, `data-id` + `data-kind` ∈ `component, pipeline, relation, label, evolve, step, title, legend, background` (`src/render/svg-primitives.ts:34-41`)                                                                                                                                                                                                                       |
| **Labre's own export** (ADR 0025)    | nothing semantic today: the canvas renderers replay into svgcanvas and the file carries geometry only (`blocks/surface/src/extensions/export-svg/render.ts:80-112`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **anything else**                    | nothing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Decision

### 1. Still the visual tier; recognition is a reader's skill, not a third tier

`WARDLEY_SVG_FORMAT` stays `tier: 'visual'`. The file is a rendering, so P2's
promises are unchanged: **no `interchange` payload, `carried` and
`quarantined` stay `0`, no round-trip is promised**, and the anti-decay test
keeps asserting no `interchange` key at any depth. What changes is what the
reader may GUESS: for Wardley, roles, relations and coordinates — when it can
say where they came from (§3).

`WARDLEY_SVG_IMPORT.run` becomes `importWardleySvg`, a pure function in
`packages/affine/gfx/wardley/src/svg-import.ts` whose module documentation is
Wardley's heuristics statement — ADR 0012's open question 2, answered beside
the parser that makes the guesses. The identity pin in
`interchange.unit.spec.ts:66-73` is replaced by its opposite (Wardley no longer
wraps the shared parser) plus the anti-decay assertion run against
`importWardleySvg`.

### 2. One import, two passes, one result

1. **Sanitise once**, with the shared code. `svg-sketch.ts` exports two more
   functions, both pure: `sanitizeSvg(source, notes)` (today's
   `parseSvgRoot`, unchanged, `svg-sketch.ts:1147-1233`) and
   `sketchSvgTree(root, notes, { skip })` (today's `walk`, `svg-sketch.ts:1001`,
   which then leaves alone every node in `skip`). `parseSvgSketch` becomes the composition of the two
   with an empty `skip`, so BPMN's behaviour is byte-for-byte what it was.
2. **Recognise**, on the sanitised tree: detect the producer (§4), recover the
   plot (§5), and emit Wardley **statements** — the intermediate the OWM DSL
   reader already builds (nodes with kind, name, `[visibility, evolution]`;
   links; evolve pairs; pipelines; notes; the map title) — plus the set of SVG
   nodes it consumed.
3. **Build** native props from the statements with the OWM importer's own
   builders (`import.ts:1010-1177`), so a map that arrives from a picture and
   one that arrives from an `.owm` file are the same elements. The builders
   attach `interchange.owm`; the SVG path drops it and wires connectors with
   provisional local ids instead (`interchange-import.ts:77-95`), the
   mechanism readers already use for handles a file never named.
4. **Sketch the rest**: `sketchSvgTree(root, notes, { skip: consumed })`.

**The mixed case is the normal case.** Recognised → native, the remainder →
sketch, in ONE `elements` array, so `importInterchangeFile` writes both inside
its one undo step (`interchange-import.ts:707-718`). A logo, a hand-drawn
annotation or a legend the recogniser did not consume lands exactly where
today's sketch would have put it.

### 3. What the report says

The five note kinds stay closed (ADR 0012, PR #159 point 3); the import uses
three of them and one existing field:

- `sourceVersion` names the producer and the marker version it read —
  `'OnlineWardleyMaps SVG'`, `'wardley-map-renderer SVG'`
  (`'… (interactive)'` when `data-id` was present), `'Labre SVG 1'`, or
  `'SVG (recognised by shape)'` — which is what P2's "a capability records the
  format version it read" is for.
- `invented-layout`, once per map, when the producer is certain but no plot
  was found (§5) and the map was laid out from the drawing's extent. The
  sentence says that evolution and visibility were ESTIMATED, not read.
- `warning`, one per kind as today: "N shapes were not recognised as Wardley
  and arrive as a sketch", a dangling link end (the OWM reader's sweep, PR B2
  point 4), and everything the sketch pass already reports.
- `mapped` counts every element written, native or sketch; the headline is
  rendered from the notes, as now.

### 4. Producers, in a fixed order; a detection is certain only on a marker

Detection runs in this order and stops at the first certain match; each step
is a structural check on the sanitised tree, never a text search on the
source.

1. **Labre** — the root `<svg>` carries `data-labre-svg` with a version this
   reader knows (§6). Certain. First, because it is the only producer whose
   file states roles exactly.
2. **wardley-map-renderer** — at least the `axes` and `nodes`
   `<g data-layer>` groups exist. Certain. With `data-id` / `data-kind`
   present, relations are bound by id; without, by geometry (an edge end
   within the node's radius), inside a producer already known.
3. **OnlineWardleyMaps** — a `fillArea` rect AND at least one
   `element_circle_` / `pipeline_box_` / `market_circle_` / `ecosystem_circle_`
   id. Certain. Links bind by the two ids in `modern_link_<from>_<to>`.
4. **Heuristic** — no marker. The reader looks for a plot (§5) and, only if it
   finds one, reads circles with an adjacent `<text>` inside it as components
   and straight segments joining two of them as dependencies. Nothing else is
   promoted: no pipeline, inertia, accelerator or evolve arrow is guessed from
   bare geometry.

"Certain" means certain about the PRODUCER, not trusted: a marker can be
forged. Forging buys native Wardley elements built from validated values
(§7) — exactly what typing them would give — so certainty is a routing
decision, never a privilege.

### 5. The plot is recovered from the file, or the map is not a map

| producer  | plot                                                                                                                                        | evolution / visibility                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Labre     | the board's `data-labre-xywh` → `owmPlotOf(bound)` (`export.ts:240-254`): exact                                                             | `owmCoordsOf(plot, cx, cy)` (`export.ts:285-296`)                              |
| renderer  | the two axis lines of `data-layer="axes"`: `{ x0: left, y0: top, width: right - left, height: bottom - top }`                               | same function, same plot type                                                  |
| OWM       | `#fillArea`, in the coordinates of its parent group (the export's `translate(35, 45)` applied)                                              | same function                                                                  |
| heuristic | two perpendicular lines meeting bottom-left, each longer than half the drawing's extent, with the recognised circles inside their rectangle | same function; and the map's four evolution labels, if drawn, are NOT required |

Each `[visibility, evolution]` is then placed on a new native Wardley board at
the reference size with `owmPointOf(owmPlotOf(board), v, e)` — the OWM
importer's own placement. So the coordinates are READ off the file's plot,
and the board is Labre's.

- **Producer certain, plot missing** (an OWM file whose `fillArea` was
  stripped): the drawing's bounding box stands in for the plot and the report
  says `invented-layout`. ADR 0012's rule is about presenting an invented axis
  as read; saying it was invented is what makes it legal.
- **Heuristic, plot missing**: nothing is promoted. The whole file is a
  sketch, with one `warning` ("no map axes were found, so nothing was
  recognised as a Wardley map"). Guessing a plot for a picture whose producer
  is unknown is the invented axis 0012 forbids.

### 6. Labre's export starts writing markers, ids and roles only

ADR 0025's renderer stays the only drawing routine. The export loop — not
any element renderer — wraps each element it replays in a `<g>` carrying:

| attribute                       | value                                       | on                  |
| ------------------------------- | ------------------------------------------- | ------------------- |
| `data-labre-svg`                | `"1"`, the marker version                   | the root `<svg>`    |
| `data-labre-id`                 | the element id                              | every element group |
| `data-labre-type`               | the element type (`shape`, `connector`, …)  | every element group |
| `data-labre-role`               | the role id, when the element has one       | every element group |
| `data-labre-xywh`               | the stored bound, in the file's coordinates | every element group |
| `data-labre-source` / `-target` | the bound element ids                       | connector groups    |
| `data-labre-group`              | the parent group's id                       | grouped elements    |

- **Generic, not Wardley's.** The export reads only base-class fields, so
  every board's SVG carries them and the next framework that wants a
  recogniser needs no export change. Only Wardley gets a recogniser here.
- **Allowed by ADR 0025**: its decisions are about who draws (the renderer)
  and what is in scope (the board's perimeter); attributes draw nothing, and
  "it paints on the canvas" and "it paints in the file" stay the same sentence.
- **Privacy.** Ids and vocabulary only. Never `pivotDocId` — the field's own
  contract says no exporter may read it (`packages/framework/std/src/gfx/model/surface/element-model.ts:634`);
  never `interchange`, tags, links or any text: a name is read back from the
  `<text>` the renderer already drew, so no prose appears in the file that the
  picture does not already show.
- **Size.** About 150 bytes per element by construction (one `<g>`, five
  attributes, a 21-character id); some 75 kB on the 500-element bench map.
  The stage that ships it measures the real figure on that map and states it
  in its PR.
- A host or a user that wants a bare picture gets none of this only if asked
  for: open point 3.

### 7. Security: ids are ids, and nothing runs

- The sanitiser is the shared one, unchanged; the recogniser walks only its
  output. DOMPurify keeps `data-*` attributes by default and keeps `id` in its
  SVG profile, but its DOM-clobbering guard can drop an `id` whose value names
  a `document` property; the corpus (§9) pins that every marker of the four
  producers survives, so a DOMPurify upgrade that changes either fails a test
  rather than a user's import.
- A marker value is DATA: `data-labre-id`, an OWM id or a renderer `data-id`
  is used only as a provisional local name, which `surface.addElement`
  replaces with a nanoid (`interchange-import.ts:83-86`). `__proto__`,
  `constructor` and friends are keys of a `Map`, never of an object.
- Roles are checked against `WARDLEY_ROLES` (`gfx/wardley/src/roles.ts:55-72`):
  an unknown role is a sketch, never a new role. `data-labre-xywh` and every
  coordinate must parse as finite numbers; anything else sends that element
  to the sketch with one `warning`.
- `<style>`, `<script>` and event attributes are never evaluated — the reader
  reads attributes and text content, and the sanitiser has already removed
  what could run.
- `store.readonly` is re-checked after the awaits, by `importInterchangeFile`
  (`interchange-import.ts:690-701`); the reader itself writes nothing (P3).

### 8. What stays true of ADR 0012

- For **BPMN and every other framework**, P2 and the PR #173 answer stand
  untouched: `bpmn:svg:import` keeps `run: parseSvgSketch`, geometry and
  nothing else, still pinned by identity.
- For **Wardley**, P2 stands except the one sentence superseded: the tier, the
  absence of payload, the absence of a round-trip promise, the report's closed
  vocabulary, and "the import surface names the tier before the file is read".
- **The OWM DSL remains the reference Wardley import.** A picture recognised
  well is still a picture: names are what the renderer drew (truncated labels
  stay truncated), and nothing of the source tool's model beyond the drawing
  survives.
- **P3 holds**: the reader is a pure function exported from the package
  index, so labre-mcp calls the same one.

### 9. The corpus

`packages/affine/gfx/wardley/src/__tests__/corpus/svg/`, beside the OWM
corpus, every file checked in with the producer and version that wrote it:

- the tea-shop map (already in `owm-corpus.ts`) exported by OnlineWardleyMaps,
  by wardley-map-renderer in static AND interactive mode, and by Labre's
  `export.svg`;
- one OWM export exercising pipelines, markets, ecosystems, evolve, inertia,
  accelerators, notes and annotations;
- a mixed file: an OWM export with a logo and a hand-drawn note added;
- a heuristic map drawn in a vector editor, and one non-map SVG (a BPMN
  picture) that must yield **zero** native elements;
- a hostile file: `<script>`, `onload`, forged markers, ids `__proto__` and
  `element_<script>`, non-finite coordinates.

The property each certain-producer file asserts: **the SVG of a map imports
to the same map as its OWM text** — same roles, same links, every
`[visibility, evolution]` within `0.01`. That is the test that keeps
"recognised" from drifting into "looks about right".

## Consequences

- **Two Wardley readers of one meaning.** The SVG path reuses the OWM
  builders, so the only Wardley-specific code it adds is detection and plot
  recovery; anything a builder learns, both paths learn.
- **The command's wording changes.** "Import SVG sketch" with a description
  that says the axes are not read becomes a description that names the three
  recognised producers and says the rest arrives as a sketch. That is a NEW key:
  `com.labre.commands.wardley.importSvg.description` is deprecated rather
  than reworded, because the host's French for it says the opposite of the new
  English, and a reworded fallback would leave the French lying. Delivered to
  the host as information. Placement stays the catalogue (ADR 0012, PR #173
  point 4): open point 4.
- **Every exported board SVG grows** by the markers (§6), for every framework.
- **`svg-sketch.ts` gains two exports**, and its module statement gains one
  sentence: a framework may claim nodes before the sketch walk, and then owes
  its own statement for what it claims.
- **Telemetry unchanged**: `runCommand` already emits `board:import-svg`
  (`commands.ts:534`). A producer dimension would describe the user's file
  source, not an id of ours, and is not added.

## Alternatives rejected

- **A third tier (`'recognised'`).** The tier is declared on the FORMAT
  (ADR 0012 P2), and an `.svg` is one format whoever reads it; a third value
  would make BPMN's `.svg` and Wardley's `.svg` two formats with one
  extension, and every consumer of `tier` would grow a branch.
- **Promote Labre's own SVG to the semantic tier** (a round-trip through
  `data-*`). It would mean carrying `interchange` on a picture and promising
  a round-trip ADR 0012 rejected for the visual tier. Labre-to-Labre already
  has two lossless routes: the clipboard and the OWM DSL.
- **One importer with a confidence score per element.** A number the user
  cannot act on; certainty is a property of the producer, and the report
  already has the words for what is invented.
- **Recognise only Labre's own export.** Covers the case that matters least:
  the product decision names OWM and the renderer because that is where the
  pictures people send come from.
- **Embed the OWM DSL text in Labre's SVG** (a `<metadata>` block). It puts
  every name and note in the file a second time — prose in a marker — and
  the sketch reader drops `<metadata>` in silence by design.

## Open points for the maintainer

1. Supersede P2 for Wardley in a new ADR (this one) rather than amend 0012 —
   confirm.
2. For an unmarked SVG, promote components and dependencies only when a plot
   is found, and never guess pipelines, inertia or evolve arrows — confirm.
3. Should every board SVG carry the markers by default, with no opt-out?
   Recommended: yes — ids and roles only, and the picture already shows
   everything they name.
4. Does the recognising import move up to the senior sub-menu now that it
   yields a map, or stay in the catalogue behind the OWM import?
   Recommended: stay; OWM is still the reference route.
5. Is `0.01` the right tolerance for "the same map" in the corpus test?

Resolved at acceptance: 1 confirmed, 2 confirmed, 3 yes, 4 stays in the catalogue; 5 is settled by the corpus test of the first recognising stage.
