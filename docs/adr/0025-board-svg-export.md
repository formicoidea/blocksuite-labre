# ADR 0025 — Every framework board exports as SVG

- Status: **accepted** (2026-09-16)
- Deciders: Mathieu Jolly
- Milestone: chantier « export SVG » (branch `feat/board-svg-export`)
- Related ADRs: [0008](0008-command-registry-foundation.md) (one command, every
  surface), [0010](0010-persisted-relation-direction.md) M3 (a "⋮" entry
  invokes a registered command), [0012](0012-framework-interchange-and-foreign-preservation.md)
  (interchange is per framework — and this is the one export that is not).

## The question

A board is something people take away. Today they can take away its _meaning_
in a native format — a Wardley map as `.owm`, a BPMN pool as BPMN XML, a C4
board as mermaid — and each of those was written by, and for, one framework.
None of them is a picture: an `.owm` file re-opened in another tool draws
whatever that tool draws, and six of the eleven board kinds have no native
format at all.

What an architect actually needs to paste into a slide, a wiki page or a PDF is
the board as it looks on the canvas, in a format that scales. That request is
identical for every framework, which is precisely why no framework should own
it.

## Decision

1. **The renderer that paints the canvas paints the file.** The export runs the
   existing `CanvasRenderer` against a `svgcanvas` 2D context instead of a
   `CanvasRenderingContext2D`, and serialises what it recorded. Every element
   renderer — present and future — is therefore an SVG renderer for free, and
   the file cannot drift from the screen because there is only one drawing
   routine.
2. **One core command, not one per framework.** `export.svg` is
   `owner: 'core'`, `availability: 'selection:framework'`, and its `when` asks
   one question: is a `FrameworkBackgroundElementModel` selected? It is
   registered from `SurfaceViewExtension` beside `validation.mapQuality`, and
   listed in `getCommands()` among the always-on core commands — a framework
   toggled off must still be able to export the boards already on the canvas
   (ADR 0009).
3. **One wildcard toolbar module, not one per board.**
   `custom:affine:surface:*#export-svg` merges the entry into the "⋮" of every
   canvas element and shows it when the selection holds a board. The bare
   `custom:affine:surface:*` key belongs to the exception toolbar and
   `affine:surface:*` to the root's misc module, so the owner suffix
   (`toolbarModuleKey`) is what lets a third contributor exist at all.
4. **It sorts last.** `z.z-export-svg`, after a framework's own
   `z.export-owm` / `z.export-xml` / `z.export-mermaid`: the native format says
   what the board _means_ and reads first; the picture reads last.
5. **The scope is the selected board's perimeter**, widened to the union of
   what is drawn on it, so a label overhanging an edge is not cut off. One
   click writes one file — the first selected board. Browsers throttle (and
   Safari silently drops) programmatic downloads fired in a burst, so a
   selection of three boards would yield an unpredictable number of files.
   Another board's background is in the file only when its frame lies wholly
   inside the exported one — a nested frame; a board that merely overlaps is a
   neighbour and stays out (amended 2026-09-17, below).

## Amendment — 2026-09-17: nested frames, and `getLineDash`

- **Nested frames are kept.** The first cut dropped _every_ other
  `FrameworkBackgroundElementModel` in the export area, to keep a neighbouring
  board out. UML nests frames inside the diagram frame by design (subject,
  activity partition, state region, combined fragment) and C4 nests a boundary
  in a board, so their frames vanished while their contents stayed.
  `selectBoardElements` now keeps a background whose `xywh` lies entirely
  inside the board's (edges may touch) and still drops one that overlaps
  without fitting, or that encloses the board.
- **The context speaks `getLineDash`.** svgcanvas 2.6.0 implements
  `setLineDash` but not `getLineDash`; the UML lifeline read the dash back and
  the whole export threw. `createSvgContext` now shims it from svgcanvas' own
  `lineDash` style, and the lifeline scopes its dash with `save`/`restore`
  instead. Two further gaps are known and harmless (the value is dropped, the
  render goes on): `lineDashOffset` (rough.js hachure dashes, the estuarine
  ghost overlay, which is not exported) and `letterSpacing` (the estuarine
  labels are written without their tracking).

## Amendment — 2026-10-04: what goes in the file, and the edgeless text

- **The "⋮" entry asks first.** It opens a small menu of three switches, all on
  by default — "Framework elements", "Other shapes and strokes", "Other texts"
  — and an Export button, built from the library's menu primitives
  (`menu.toggleSwitch`), not a modal of its own. The choice is remembered per
  editor for the session, never in the document nor in the browser. Every other
  surface (palette, catalogue, shortcut, agent) still runs `export.svg` with no
  dialog and gets everything; the options travel as the command's optional,
  re-validated params and are deliberately not declared as `params`, so the
  agent contract is unchanged. One export is still one `runCommand`, one usage
  record, and still no telemetry.
- **What a switch removes is read off the document, never per framework**
  (`export-svg/parts.ts`). A framework element is the board, anything whose
  role shares the board's role namespace (`es:board` owns `es:command`), the
  generated legend (`core:legend`) and its glyphs, and a role-less element
  grouped with any of those — a framework artefact is a group in which one
  member carries the role (an EDGY person and its name, a Wardley market and
  its dots). Everything else is an "other text" when it is a `text` element,
  an "other shape" otherwise; another framework's elements lying on the board
  count by their type. A board with no role (Cynefin) owns itself alone.
  `export-svg-parts.unit.spec.ts` in `packages/affine/all` runs every
  framework's real board and artefact commands and checks each switch removes
  exactly its part.
- **With "Framework elements" off, the board is not drawn** and the file covers
  what remains. Nothing left means no file, and a toast through the
  notification seam when a host provides one.
- **The edgeless text is the one block drawn** — an exception to "Blocks are not
  exported" above, because it is what the text tool creates by default and its
  absence read as "my texts are not exported". It is redrawn as VECTOR text by
  a painter registered from its own package (`BlockSvgPainterExtension`, keyed
  by flavour): the surface package cannot import the canvas text metrics, which
  sit above it. Plain text per paragraph in the block's own style (inline
  bold, italic and colour flattened, no list bullets), wrapped as the block
  wraps, rotated and scaled as on screen, painted over the canvas elements
  rather than at its layer index. Notes, images and embeds stay out.

## Amendment — 2026-10-04: the file says what each group is ([ADR 0032](0032-wardley-svg-recognises-roles.md) §6)

- **Every element the export replays is wrapped in one `<g>`** carrying
  `data-labre-id`, `data-labre-type`, `data-labre-role` (when it has one),
  `data-labre-xywh` (its stored bound, in the file's coordinates), and
  `data-labre-source` / `data-labre-target` on a connector and
  `data-labre-group` on a grouped element; the root `<svg>` carries
  `data-labre-svg="1"`, the marker version. The loop in `render.ts` draws one
  element per `renderBoundTo` pass inside that group
  (`SvgContext.markedGroup`), so paint order and every renderer are
  unchanged, and the decisions above — who draws, what is in scope — stand:
  the attributes draw nothing.
- **Ids and vocabulary, never prose.** Base-class fields only, so every board's
  file carries them and no framework is named in the export; never
  `pivotDocId`, `interchange`, a tag, a link or any text — a name is read back
  from the `<text>` the renderer already drew. Pinned in
  `wardley-svg-roundtrip.spec.ts`.
- **On by default, no opt-out** (ADR 0032, open point 3, resolved at
  acceptance). Measured on a 501-element Wardley map: 179 bytes an element,
  about 90 kB, against the ADR's estimate of 150.
- **What reads them:** Wardley's SVG import, which recognises its own export
  first and gets back the same map (ADR 0032 §4.1).

## Why not resvg

`resvg` is a _rasteriser_: it turns SVG into PNG. It answers the opposite
question, adds a WASM binary to a library published source-first (principle G),
and would still need something to produce the SVG in the first place.

## Why not a per-element SVG serializer

Writing `toSvg()` on every element model is the design that guarantees drift:
thirty-odd renderers would each need a second implementation, kept in step by
review alone, and a new framework would ship a board that exports as a blank
rectangle until somebody noticed. Replaying the 2D context is the only approach
where "it paints on the canvas" and "it paints in the file" are the same
sentence.

## Consequences

- **`Path2D` needs a shim.** `svgcanvas` implements the 2D context interface but
  not `Path2D`, which several renderers build paths with. The export installs a
  recording `Path2D` for the duration of the render and replays it into the
  context.
- **Blocks are not exported.** Notes, images, embeds and anything else drawn as
  DOM sit outside the canvas renderer. A board's _canvas_ content is the whole
  of what the file holds, and that is the promise the label makes: "the selected
  board and everything drawn **on** it".
- **Fonts travel by name.** The SVG names the font family; a viewer without it
  substitutes. Embedding the glyphs would multiply the file size by the font.
- **Rule [R34](../add-a-framework/02-framework-rules.md) and principle K.** A
  framework satisfies both by extending `FrameworkBackgroundElementModel` and
  doing nothing else. `export-svg-boards.unit.spec.ts` refuses a board declared
  any other way; `board-svg-export.spec.ts` renders one of every kind in a
  browser.
- **No telemetry, for now.** `CommandTelemetry.framework` is typed on
  `FrameworkId` and this command can name none: the surface package knows a
  board by its model class and nothing maps `bpmnPool` back to `bpmn` without
  importing the framework packages the layering forbids. Usage is still
  measured — `runCommand` records it outside the telemetry condition. A
  board → framework lookup, if one is ever declared, reopens this.
