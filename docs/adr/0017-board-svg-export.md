# ADR 0017 — Every framework board exports as SVG

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
