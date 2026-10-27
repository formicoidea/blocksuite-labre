# ADR 0045 — Headless toolbox: a framework's toolbar items as pure builders

- Status: **accepted** (2026-10-27, approved by the maintainer with the first
  framework, C4)
- Deciders: Mathieu Jolly
- Related ADRs: [0012](0012-framework-interchange-and-foreign-preservation.md)
  (P3: readers are pure and editor-free; the materializer contract),
  [0008](0008-command-registry-foundation.md) (one descriptor per action),
  [0023](0023-every-displayed-string-through-a-key.md) (a creation site writes the
  resolved seed).
- **Not a red zone**: no schema, no stored field, no enum value, no publish
  script changes. The builders write the props the toolbar already writes.

## Context

A host with no editor — the Labre workspace connector, which lets an outside
model draw on a canvas over MCP, and labre-mcp — must be able to place the
very elements a user places from a framework's toolbar: a C4 container with
its three written tiers and the group that holds them, a BPMN gateway with
its outside label, an EDGY person, a context map's bounded context. Asked for
a C4 diagram, a model that cannot reach them draws rectangles and texts that
imitate them, and the app reads that drawing as nothing: no rules, no
reading, no export, no morph.

Two things stand in the way today:

1. **The composites are assembled only in the editor.** Each toolbar action
   (`createC4Node` in `gfx/c4/src/actions.ts` and its siblings) builds the
   node, its texts and its group inline, around three editor-only reads: the
   viewport centre, `translateKey(std, …)` and `gfx.layer.generateIndex()`.
   The preset tables (`c4NodeProps`, `bpmnNodeProps`, …) give the node alone.
2. **The readers cover three frameworks.** Wardley (OWM), BPMN (XML) and UML
   (PlantUML, XMI, draw.io) have editor-free readers (ADR 0012); C4, EDGY,
   Cynefin and the DDD boards have none, and some have no standard language
   to read.

## Decision

### Every toolbar item is a pure builder in the framework's editor-free entry

Each framework exports, from its `./interchange` entry (the editor-free graph
`interchange-headless.unit.spec.ts` holds), a **toolbox**: the list of its
toolbar items, each with a builder

```ts
build(at: { x: number; y: number }, texts?: Record<string, string>)
  => SerializedElementProps[]
```

that returns the elements the toolbar would create, in painting order, with
local `id`s and the group LAST — the exact contract a reader's result already
follows (ADR 0012 D3, `materializeInterchangeImport`). `at` is the top-left of
the item's box; `texts` fills its named text slots (a C4 component's `title`,
`typeLine`, `description`), and an absent slot takes the English fallback the
toolbar's seed resolves from.

Relations are toolbox items too: `link(kind)` returns the connector props of
one of the framework's relation styles (C4 relationship, BPMN sequence flow,
UML composition…), ends left to the caller.

### The editor action calls the builder

The toolbar action keeps what only an editor has — the viewport centre, the
translated seeds, the layer index, the selection — and gets the elements from
the builder. There is ONE assembly of a composite, which is what keeps a
component drawn by a host and one drawn by hand the same element (the reason
`presets.ts` exists, extended from one node to the whole artefact).

### What a toolbox does not do

- **No layout.** A builder places one item at the point it is given. Where
  things go on a board is the caller's (a human's pointer, a model's
  coordinates), never a builder's guess.
- **No translation.** A builder writes the texts it is given or the English
  fallback; resolving a seed in the host's language stays at the editor's
  creation site (ADR 0023).
- **No persistence.** A builder returns props; the caller writes them, through
  `surface.addElement` or the materializer.

### Rolled out framework by framework

C4 first (the PR that carries this ADR), then BPMN, EDGY, the DDD boards,
Cynefin/estuarine, Wardley's composites (market, pipeline, Porter) and UML.
A framework without an `./interchange` entry gains one for its toolbox. The
mind map is out of scope: its layout needs text measurement, which a server
does not have; it gets its own decision.

## Consequences

- A host draws any toolbar item without an editor, through the published
  `./interchange` entry, and gets the same elements as the toolbar.
- A parity test per framework holds the editor action and the builder to the
  same props (the action calls the builder; the spec asserts the builder's
  output against the preset tables and the role table).
- `interchange-headless.unit.spec.ts` keeps every toolbox out of the editor
  graph; a builder that needs the editor fails it.
- The toolbox list is data a host can show: item id, label key and fallback,
  text slots.

## Amended 2026-10-27 — the DDD boards build from `ddd-shared/headless`

**Red zone: publish script, awaiting the maintainer's approval.** This
amendment changes `scripts/build-bundles.mjs` and widens the allow-list of
`interchange-headless.unit.spec.ts`; neither is merged without the
maintainer's explicit approval.

The three DDD boards (Context Map, Core Domain Chart, Event Storming) draw
their artefacts from one shared package, `@labre/affine-gfx-ddd-shared`
(published as `labre-ddd-shared`): the palette tables (`CM_BUBBLE`,
`CM_RELATIONSHIPS`, `CLOUD`, `ES_STICKIES`, `CD_SUBDOMAINS`,
`TEAM_TOPOLOGIES`…) and the prefabs that place a sticky, a bubble, a dot, a
marker or a cloud. A board may import `ddd-shared` and never another board,
so the one assembly of each artefact this ADR asks for can only live there.
Its package index loads the editor (the prefabs need `std`, the senior button
is Lit), so a board's `./interchange` could not reach it.

Decided:

1. `ddd-shared` gains a `./headless` entry: its tables (`shared/consts.ts`)
   and the pure element builders (`shared/elements.ts`: `stickyElements`,
   `bubbleElement`, `dotElements`, `markerElements`, `cloudElements`,
   `dddConnectorElement`, `dddShapeElement`). The prefabs write what these
   return, adding only what an editor has (the viewport centre, the group
   command's "Group N" title and user layer). The package index re-exports
   all of it unchanged.
2. `interchange-headless.unit.spec.ts` allows `packages/affine/gfx/ddd-shared/`
   in a framework's `./interchange` graph, and bundles `ddd-shared ./headless`
   as an entry of its own, held to the same rules (no Lit, no store, no DOM).
3. `scripts/build-bundles.mjs` maps a shared bundle's SUBPATHS for the
   framework bundles, not only its root: `@labre/affine-gfx-ddd-shared/headless`
   becomes `@formicoidea/labre-ddd-shared/headless`. `buildShared` already
   published every `exports` key of the package; the rewrite table was the
   only thing missing, and without it the release would refuse the board's
   import.
4. `LABEL_COLOR`, `LABEL_FONT` and `LABEL_FONT_SIZE` move to an editor-free
   module of the surface (`extensions/legend-label.ts`) exported on
   `./interchange`, re-exported unchanged by `legend.ts`.

Rejected: a copy of each board's tables in the board, held by a parity test.
Three copies of the palettes, plus the cloud's outline generator, to avoid a
rewrite table line; and the copies would not be the one assembly this ADR
asks for.

The Context Map ships its toolbox with this amendment; the Core Domain Chart
and Event Storming follow on the same entry.
