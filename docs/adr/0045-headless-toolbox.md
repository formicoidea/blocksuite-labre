# ADR 0045 — Headless toolbox: a framework's toolbar items as pure builders

- Status: **proposed** (2026-10-27, for the maintainer's approval with the
  first framework)
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
