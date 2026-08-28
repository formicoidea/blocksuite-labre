# ADR 0012 — The platform trades diagrams with the outside world, and preserves what it does not understand

- Status: **accepted** (August 2026) — accepted with the field landing in
  PR #157, under PO red-zone review: the status flip and the `interchange`
  accessor are approved in the same breath, because approving the field is what
  accepts D2/D3/D5 in practice. It adds one persisted field to
  `GfxPrimitiveElementModel`, i.e. to the Y.Map of **every** surface element,
  and it fixes the MEANING of that field for documents that will be written
  before any of it ships. That is the red zone `CLAUDE.md` names twice over
  (`packages/framework/std` gfx element plumbing, and a schema/model change that
  must stay loadable by older documents).
- Deciders: Mathieu Jolly
- Milestone: framework interchange — a platform capability, not a BPMN feature
- **Generalized on PO direction (2026-08-27).** The first draft decided the
  `.bpmn` round-trip alone. The decisions it took were not BPMN-shaped, so the
  PO directed that they be lifted to the platform: interchange is declared per
  **framework × format × direction**, BPMN is the **worked example** that
  proves the contract, and the `interchange` field was already keyed by format
  for exactly this. Nothing decided in the first draft is withdrawn.
- Precedent this ADR extends: **PR #73** — _preserve unknown props when copying
  surface elements_ (`docs/spikes/us-1-8-unknown-props-preservation.md`). That
  PR settled the principle — _"preserve what we do not understand"_ — and the
  mechanism, decorator-table routing at the two loss sites. This ADR applies the
  same principle to a second frontier: not a field a newer Labre wrote, but a
  fragment a foreign tool wrote.
- Related ADRs: [0009](0009-reversed-flag-contract.md) (an importer is tooling;
  what it wrote is content, and content is never gated),
  [0008](0008-command-registry-foundation.md) (the registry pattern this one
  copies, and where an import lands as a command),
  [0010](0010-persisted-relation-direction.md) (the role on an edge is the
  statement — an import must not invent one),
  [0007](0007-universe-tag-defs-format.md) (flat-JSON element props, the
  last-write-wins trade, and the promotion ladder a visual import lands on).
- **Blocks**: the `.bpmn` **import** chantier, and the interchange registry every
  other importer will be declared in. Import cannot be built before this is
  approved, because import is the only moment at which "what do we do with the
  part of the file we have no artefact for" can be decided — and it is decided
  once: the answer becomes a persisted field, and a persisted field is as hard
  to change as a schema.

## The question

Labre is accumulating one-way doors. PR #149 shipped BPMN export — a board
leaves as a spec-conformant `.bpmn`, seventeen kinds plus `group`, three edge
roles, pools, lanes and BPMNDI. A Wardley export exists too, but it lives in
**labre-mcp**, outside this repo, with its own serialization logic. A C4 →
mermaid exporter is being written right now in a parallel chantier. Each of
these was, or is about to be, a private arrangement between one framework and
one file format.

Two questions therefore, and the second is the one the PO raised:

1. **The round-trip question.** The external review of #149 is right:

   > Export alone proves nothing. The interoperability claim is the
   > **round-trip** — Labre → `.bpmn` → third-party tool → `.bpmn` → Labre — and
   > a round-trip that quietly deletes the part of the file it did not recognise
   > is worse than no round-trip at all, because the loss is invisible until
   > somebody re-opens the file in the tool that wrote it.

   A `.bpmn` in the wild is almost never the Descriptive subset Labre draws. It
   carries Analytic vocabulary (boundary events, inclusive gateways, event-based
   gateways), the executable half (`ioSpecification`, `conditionExpression`,
   `multiInstanceLoopCharacteristics`), and — in practice, on every file that has
   been through a real tool — a vendor's `extensionElements`: `camunda:*`,
   `zeebe:*`, `signavio:*`, and bpmn.io's own `bioc:stroke` / `bioc:fill`.

   So: **what does an import map, what does it keep without drawing, and what
   does it admit to losing?**

2. **The platform question.** That answer must not be written once per
   framework, by whoever happens to build the next importer, in whichever repo
   they happen to be standing in. **What is the seam an importer or an exporter
   plugs into, and who is allowed to implement one?**

This ADR answers both. The platform decisions are **P1–P3**; the preservation
decisions are **D1–D6**, taken against BPMN because that is the case we have
shipped half of and can therefore reason about honestly.

## Context

### 1. What Labre already trades, and where the code lives

| framework | format  | direction  | where the code is today                                                           |
| --------- | ------- | ---------- | --------------------------------------------------------------------------------- |
| BPMN      | `.bpmn` | export     | `packages/affine/gfx/bpmn/src/export.ts` — the lib                                |
| Wardley   | OWM DSL | export     | **labre-mcp** — outside this repo                                                 |
|           |         |            | _since PR B2: `gfx/wardley/src/export.ts`, and labre-mcp's copy is to be deleted_ |
| C4        | mermaid | export     | in flight, parallel chantier                                                      |
| _any_     | _any_   | **import** | nothing, anywhere                                                                 |

The shipped BPMN exporter already has the shape the rest should copy, and its
package index already states the split in a comment:

```ts
// Everything on the surface the exporter speaks about, in document order — the
// half of the export that needs an editor, kept apart from the half that does
export { bpmnBoardOf } from './actions.js';
// … models in, XML out — so a host can export a board it never rendered
export { exportBpmnXml } from './export.js';
```

`exportBpmnXml` is a **pure function**: element models in, string out, no
`BlockStdScope`, no surface, no DOM, no clock, no randomness. `bpmnBoardOf` is
the thin part that knows what a canvas is. That split is not an accident of
that PR; it is the whole seam, and P3 makes it the rule.

Two further properties of that exporter matter to everything below.

**It is deterministic.** `IdMinter` walks the board in document order, so the
same board always produces the same bytes — including the same ids.

**It refuses to guess.** A connector with no BPMN role is not an untyped
sequence flow, it is not a flow at all, and it is absent from the file (ADR
0010). A plain rectangle beside a pool is not an unnamed task. An import must
inherit that discipline in the other direction: a fragment we cannot read is
not a thing we may quietly decide is nothing.

### 2. What a semantic format says about the unknown

BPMN's extensibility is not a courtesy, it is a clause. §8.3.3:

> _"This approach results in more interchangeable models, because the standard
> elements are still intact and can still be understood by other BPMN adopters.
> It's only the additional attributes and elements that MAY be lost during
> interchange."_

Two XSD facts carry it, both on `tBaseElement` — i.e. on **every** BPMN element
with an id:

```xsd
<xsd:element ref="extensionElements" minOccurs="0" maxOccurs="1"/>
<xsd:anyAttribute namespace="##other" processContents="lax"/>
```

and `tExtensionElements` is `<xsd:any namespace="##any" processContents="lax"
maxOccurs="unbounded"/>`. So the format guarantees exactly two carriers for
foreign matter — a foreign-namespaced attribute anywhere, and an arbitrary
subtree under `extensionElements` — and `processContents="lax"` means a
validating parser is not even required to have the foreign schema.

Two more clauses bound the honesty budget:

- **`extension/@mustUnderstand`** (§8.3.3, Table 8.7) — a `definitions`-level
  declaration that an extension's semantics MUST be understood "in order to
  process the BPMN model correctly". A file that sets it is a file telling us
  our reading of it is wrong.
- **§15.1, Interchanging Incomplete Models** — implementers are expected to
  disregard missing required attributes and reduce `minOccurs`. This is what
  licenses a partial model, and it is what PR #149 already leans on. It licenses
  writing _less_ than the schema asks. It does not license writing _less than we
  were given_.

The spec's own word for what an implementer may drop is **MAY**, not SHOULD. It
permits loss on interchange; it does not prescribe it.

This is a BPMN clause, but the situation it describes is not BPMN's: every
semantic format Labre will read has a vocabulary wider than the one Labre draws.
That is what P2 generalizes and what D1 answers.

### 3. The precedent, and why it is the spine of this ADR

PR #73 found that two sites in `SurfaceBlockModel` copied a props object onto an
element by assigning each key — which reaches the Y.Map only for keys the class
declares as an accessor. The `@field()` set was therefore **a de facto
allow-list, applied silently**: an older client pasting an element carrying a
newer field produced a copy that looked right in that tab and had never existed
for any other peer.

Both sites now route through `_assignElementProp`: a declared key takes its
accessor, an undeclared key is written verbatim into the Y.Map, and only
identity (`id`, `type`) and the prototype-pollution keys are excluded.

The shape of that decision is the shape of this one, one layer out:

| PR #73                                         | this ADR                                           |
| ---------------------------------------------- | -------------------------------------------------- |
| the unknown is a **field a newer Labre wrote** | the unknown is a **fragment a foreign tool wrote** |
| loss site: copy / paste / turn-into-linked-doc | loss site: import                                  |
| the allow-list was the `@field()` set          | the allow-list would be `BPMN_XML_OF_KIND`         |
| chosen: write it verbatim into the Y.Map       | chosen: carry it verbatim on the element           |

The parallel is exact enough that rejecting preservation here would require
overturning #73's principle rather than merely declining to extend it.

## Platform decisions

### P1 — Interchange is a registry, one entry per (framework, format, direction)

An importer or an exporter is a **declared platform capability**, registered the
way rules, profiles and commands already are — `createIdentifier` plus an
`…Extension` helper — and not a function some toolbar happens to call.

```ts
/** A format Labre can read or write, and what it promises. See P2. */
export interface InterchangeFormat {
  /** Stable id. THE KEY under which foreign matter is carried (D2). */
  id: string; // 'bpmn' | 'owm' | 'mermaid' | 'svg'
  tier: 'semantic' | 'visual';
  /** For the file picker and the download name. */
  extensions: readonly string[]; // ['.bpmn']
  mime?: string;
}

/** One direction of one format for one framework. */
export interface InterchangeCapability {
  /** `${framework}:${format.id}:${direction}` — unique, and the DI key. */
  id: string;
  framework: string; // 'bpmn' | 'wardley' | 'c4'
  format: InterchangeFormat;
  direction: 'import' | 'export';
  /** The pure function. See P3 — this is the whole contract. */
  run: InterchangeImporter | InterchangeExporter;
}

/** A framework registers its interchange here; nothing else registers any. */
export const InterchangeIdentifier =
  createIdentifier<InterchangeCapability>('Interchange');

export function InterchangeExtension(
  capabilities: readonly InterchangeCapability[]
): ExtensionType;
```

Three properties are load-bearing.

**The unit is the triple, not the format.** "BPMN reads `.bpmn`" and "Wardley
reads SVG" are separate capabilities with separate guarantees, and a direction
is not implied by its opposite: BPMN export shipped in #149 and BPMN import has
not been written. Declaring them separately is what lets the roadmap below be a
table of real rows rather than a wish.

**The signatures are mirror images, and neither touches an editor.**

```ts
type InterchangeExporter = (
  board: FrameworkBoard, // element models, in document order
  options: ExportOptions
) => { text: string; report: InterchangeReport };

type InterchangeImporter = (
  text: string,
  options: ImportOptions
) => { elements: SerializedElementProps[]; report: InterchangeReport };
```

An importer returns **serialized element props, not live models** — it has no
surface to add them to, and giving it one would destroy the property P3 exists
to protect. The caller does the writing: `surface.addElement` from the editor
command, or a document mutation from labre-mcp. This is the exact mirror of
`bpmnBoardOf` / `exportBpmnXml` and it keeps the parser testable with plain
objects and no DI, which is how `export.unit.spec.ts` already gets its 46 tests.

**Registration is flag-gated; what it wrote is not.** `InterchangeExtension` is
registered from the framework's **flag-gated** view extension, beside
`ValidationRuleExtension`, because offering to read a file is tooling. ADR 0009
is satisfied and the distinction is sharp: turning the `bpmn` flag off removes
the import command; it does not touch one element the last import created, nor
one byte of `interchange` those elements carry. Content stays unconditional,
which is the whole of 0009.

#### Divergences accepted at implementation (PR #159)

The registry above is a sketch and the sketch was wrong in four places. PR #159
built it, the divergences were reviewed on their merits and accepted, and they
are recorded HERE rather than in a merged pull request, because the next
capability author will read this file and not that thread. **The signatures
below are the ones that exist**; the block above is kept for the reasoning it
carries, not as an API.

**1. An exporter takes the surface's elements, not a `FrameworkBoard`.**

```ts
type InterchangeExporter = (
  elements: readonly GfxPrimitiveElementModel[],
  context: InterchangeExportContext
) => InterchangeExportResult;
```

There is no `FrameworkBoard` and there cannot be a useful one: BPMN's board is
`{pools, nodes, connectors}`, a Wardley board is nothing like it, and a type
covering both is either `unknown` or a union that grows a member per framework.
The capability is handed the surface's elements in document order and picks out
what it speaks about itself — `bpmnBoardFrom` is that step for BPMN. The
framework-shaped split lives inside the framework; the registry's signature
stays framework-agnostic. Document order is still the caller's, and still
matters, for the reason the sketch gave.

**2. An export result carries the file's envelope, not a three-way report.**

```ts
interface InterchangeExportResult {
  text: string;
  filename: string;
  mime: string;
  warnings?: readonly string[];
}
```

`mapped / carried / quarantined` classifies foreign matter against Labre's
vocabulary, and an exporter reads nothing foreign — the classification is the
**importer's alone**. What an export does have is a **loss channel**: a board
can hold sentences the format cannot write down, and the person who clicked
Export is the one entitled to hear about it. BPMN populates it with three, each
of which existed as a code comment before this PR: flow objects drawn outside
every pool (in the file, undrawn by any tool, because a participant-less process
has no shape on a collaboration plane); message flows on a poolless board
(dropped, never demoted to a sequence flow); and typed arrows with an end that is
loose or attached to something that is not a BPMN artefact. `filename` and `mime`
are here so that one place decides what a `.bpmn` download is called and what
content type it carries.

**3. The report says WHICH, not only how many.**

```ts
interface InterchangeReport {
  mapped: number;
  carried: number;
  quarantined: number;
  notes: readonly InterchangeNote[];
  sourceVersion?: string;
}

interface InterchangeNote {
  kind:
    | 'carried'
    | 'quarantined'
    | 'substituted-id'
    | 'invented-layout'
    | 'warning';
  elementId?: string;
  sourceId?: string;
  element?: string;
  message: string;
}
```

Three integers and a bag of strings would have silently narrowed five sentences
of this ADR: D1's quarantined column is _listed_ in the report, D3 _records the
substitution_ of an id it could not keep and the lane disagreement it resolved,
D4 _names_ a shape that arrived with no diagram and says so when it laid one
out, D5 surfaces `mustUnderstand` _by name_, and the Consequences promise a
product surface rather than a log line. The five `kind`s are those cases and are
meant to stay closed. `sourceVersion` is where P2's amended _"a capability
records the format version it read"_ actually lands — nothing else in the
registry had room for it. The counts remain, because a UI wants a headline it can
render without walking a list; neither derives from the other.

**4. A capability is a union discriminated on `direction`, and its id cannot
lie.**

```ts
type InterchangeCapability =
  | (InterchangeCapabilityBase & {
      direction: 'export';
      run: InterchangeExporter;
    })
  | (InterchangeCapabilityBase & {
      direction: 'import';
      run: InterchangeImporter;
    });
```

`run: InterchangeImporter | InterchangeExporter` made every call site cast and
made "declared as an import, implemented as an export" undetectable — no runtime
check can tell two functions apart by looking, so the type system is the only
place that lie can be caught. What runtime CAN check, `InterchangeExtension`
now does: it refuses a capability whose `id` is not `interchangeCapabilityId()`
of its own three fields, and refuses a `framework` or `format.id` containing the
`:` that separates them (`('a','b:c')` and `('a:b','c')` mint one key, and each
id agrees with its own triple). Both fire at container setup, never mid-session.
The DI container already refused a collision; these refuse a lie.

One thing this ADR asked for that #159 did **not** ship, deliberately:
`GfxPrimitiveElementModel.interchange` (D2). It is a persisted field on every
surface element — the red zone twice over — and belongs to its own PR under
human review, which is where it is being done.

### P2 — Two format tiers, and they promise different things

The tier is declared on the format, and it is the single most load-bearing field
in the registry, because it is what a user is entitled to expect.

|                                | **semantic**                                     | **visual**                              |
| ------------------------------ | ------------------------------------------------ | --------------------------------------- |
| examples                       | `.bpmn` XML, mermaid, OWM DSL                    | SVG                                     |
| what the file contains         | a **model** — typed elements and their relations | a **rendering** — paths, rects and text |
| import is                      | a translation                                    | **recognition**, and it is heuristic    |
| preservation contract (D1, D2) | **full**: mapped / carried / quarantined         | **none**                                |
| writes `interchange`           | yes                                              | **no**                                  |
| round-trip promise             | yes, per D3–D6                                   | **none, and none is implied**           |
| what lands on the canvas       | typed artefacts carrying roles                   | a **sketch** the author then promotes   |

**Semantic formats get the whole contract.** They carry meaning, the meaning is
wider than Labre's vocabulary, and the difference is exactly what D1–D6 are
about.

**Visual import is best-effort recognition, and says so.** An SVG has no roles,
no relations and no vocabulary — a Wardley component and a text box are both
`<rect>` plus `<text>`. An SVG importer is therefore a **heuristic**: it maps
geometry and stroke patterns onto plausible shapes, and it will be wrong. It
makes exactly one promise, that the picture arrives on the canvas as editable
elements, and it makes no other. It writes **no** `interchange` payload, because
there is nothing to preserve that the elements themselves do not already carry —
an SVG round-trip would be a re-render, not a round-trip, and pretending
otherwise would be the dishonesty this ADR exists to prevent.

This is not a lesser status; it is a different rung of a ladder the platform
already has. ADR 0007's three-level precision typology puts a plain shape at
**level 1 (free surface)** and a role-bearing artefact at **level 2 (_nature
première_)**. A visual import lands the whole drawing at level 1, and the author
**promotes** what matters — which is the platform's standing rule, _promotion,
never conversion_. Nobody's SVG is silently declared to be a process.

**Say it plainly in the product, not only here.** The import surface must name
the tier before the file is read: "recognise shapes from an SVG (best effort,
no round-trip)" is a different sentence from "import a BPMN process", and a
single "Import…" entry that hides the difference would earn a support ticket per
user.

A third case is worth naming so nobody rediscovers it as a bug: **a semantic
capability may target a format version that has not stabilized yet, and it must
then say which version it read.** Mermaid → Wardley is that case. It targets
mermaid's **experimental Wardley diagram type**, which carries the visibility and
maturity coordinates natively — so the capability is squarely semantic, takes the
full contract, and needs no invented axis. Two consequences the implementing
chantier owes an answer to, rather than defaulting one:

- **Until that type stabilizes upstream, the OWM DSL route is the reference
  Wardley import.** It is the one whose vocabulary is settled, and it is what a
  user should be pointed at when both are offered.
- **A mermaid file predating the type** — plain `graph` / `flowchart` syntax —
  is the documented fallback, not a second tier. Such an import recovers the
  graph (components and dependencies) and cannot recover coordinates the file
  never carried. The chantier must answer "where do the coordinates come from"
  explicitly — laid out on import, or authored afterwards — and the report must
  say which of the two happened. **An invented axis presented as read from the
  file is forbidden**, here as everywhere else in this ADR.

The general rule behind the case: **a capability records the format version it
read**, and where a format is in motion the tier is decided by what the targeted
version carries, not by what the oldest file in the wild happens to lack.

#### Answered at implementation (PR #173, the SVG importer)

The first visual-tier capability shipped as **two** capabilities —
`bpmn:svg:import` and `wardley:svg:import` — and answered this ADR's **open
question 2** on the way. Recorded HERE rather than in a merged pull request, for
the reason P1's own divergences section gives: the next capability author reads
this file and not that thread.

**1. One parser, two declarations, and the heuristics statement is written
once.** Open question 2 asks for "a one-paragraph statement of heuristics and
known failure modes" **per visual capability**. Both capabilities wrap ONE pure
function — `parseSvgSketch`, in `svg-sketch.ts` under
`packages/affine/blocks/surface/src/extensions/` — so they make identical
guesses, and the statement is the module
documentation of that file, referenced by both declarations and pinned by a test
asserting `capability.run === parseSvgSketch`. Two copies of one paragraph would
have gone out of step with each other and with the code. **What a visual
capability is allowed to guess, answered:** geometry, and nothing else — shapes,
strokes, and text as EDITABLE free text. No role, no relation, no framework
vocabulary. What a Wardley SVG importer is allowed to guess turns out to be
exactly what a BPMN one is, because the answer is "nothing about the
vocabulary"; the day one of them wants more, it writes its own parser and its
own paragraph beside it. **The known failure modes live in that module's
documentation and nowhere else** — the "where it is known to be wrong" paragraph
of `svg-sketch.ts`, which is the one place both capabilities point at and the
only copy anybody has to keep true.

**2. Nothing is dropped silently, at the granularity of the KIND — and that
sentence had to be EARNED.** D1's discipline has no counterpart here — a visual
import classifies nothing, because it carries nothing — but its principle does,
and the reader honours it: every construct it ignores produces exactly ONE
`warning` note, per kind and never per instance. A file with four hundred
`<use>` instances is one fact about that file.

Three consequences, each of which was a silent loss when this reader was first
written and is a note now. The SANITIZER is a second dropping stage and reports
like the first: its removals are read off `DOMPurify.removed` and named, because
`<use>` and `<foreignObject>` never reach the walk at all and a drawing built
out of symbol instances would otherwise arrive empty with only "nothing was
recognised" to explain it. **Hidden content is skipped rather than imported
black**: `display:none` and `visibility:hidden` subtrees draw nothing where the
file came from, and SVG's initial `fill` is BLACK — so importing an exporter's
off-canvas scaffolding "faithfully" puts a slab over the board. And what is
altered rather than dropped is reported too: transparency flattened, a
percentage corner radius refused, a `currentColor` substituted, a font size in a
unit no pure function can resolve.

Two exceptions, both deliberate and both stated in the module. `<title>`,
`<desc>` and `<metadata>` are dropped in SILENCE, because they render nothing
and a note each would be three lines of noise on the first import of every real
file. And a short list of things the reader ALTERS where no note could help —
estimated text boxes, collapsed whitespace, ignored `tspan` positioning and
`dy`, unread `stroke-dasharray` — is named in that same paragraph rather than
in the report, because a remark a user can do nothing about is a remark that
teaches them to dismiss the ones they can.

**3. The five note kinds stay closed, and a visual import uses one of them.**
Every note it emits is a `warning`. `carried` and `quarantined` describe a
payload this tier does not write; `substituted-id` and `invented-layout`
describe promises it does not make. `mapped` is the only count with anything to
say.

**4. The surface names the tier, and the fallback is not in the senior row.**
P2 requires the import surface to say what it is about to do before the file is
read; both commands are labelled "Import SVG sketch" with a description that
spends its whole sentence on what this is not ("Best effort: recognizes shapes
and text, no round-trip"). They are declared on `catalogue`, `palette` and
`agent` and DECLINE `senior-menu`: the sub-menu carries a framework's
native-format import (`bpmn.importXml`, and `wardley.importOwm`, both shipped),
which is the route P2 already says a user should be pointed at, and the fallback
lives one click away behind "More artefacts…". That is a curation call, flagged
for the PO as one, and it is a one-line change either way.

### P3 — Parsers live in the lib; the editor and labre-mcp are both callers

**PO decision, recorded.** Import functions are to be exposed as **labre-mcp**
tools as well as editor commands, and a Wardley export already exists in
labre-mcp today, implemented outside this repo.

The decision:

> **Every parser and every serializer is a pure function in a lib package,
> registered in the interchange registry. Both consumers — the editor's toolbar
> commands and labre-mcp's tools — call the same function. Serialization logic
> is never implemented outside this repo.**

```
      packages/affine/gfx/<framework>/src/interchange/*.ts
                    (pure: text ↔ element props)
                              │
              ┌───────────────┴───────────────┐
   editor command                       labre-mcp tool
   (registry lookup,                    (direct import from
    surface writes)                      the published package)
```

Why this way round, and not "labre-mcp owns the text formats":

- **One source of truth per format.** A format is a body of accumulated,
  hard-won detail — #149's NCName minting, its attribute-value normalization,
  its §12.3 plane translation, its two happy-dom `DOMParser` traps. A second
  implementation elsewhere does not stay equivalent; it diverges, and it
  diverges silently because nothing compares them.
- **The tests are here.** 46 unit tests, mutation-tested against four escapes,
  plus a live-chromium integration spec. A parser in labre-mcp inherits none of
  that and can afford none of it.
- **Purity makes it portable, so there is no cost to paying it.** A function that
  takes element models and returns a string needs no editor, so labre-mcp can
  call it directly — which is precisely why `exportBpmnXml` is already exported
  from the package index today. The seam exists; P3 only forbids going round it.
- **The registry is the editor's view of the same functions, not a second
  gate.** labre-mcp does not need DI and does not use it: it imports the pure
  function. The registry is what makes the capability appear in a menu, a
  command palette entry (ADR 0008) and an agent-visible command.

**Consequence, and it is work in another repo:** the existing labre-mcp Wardley
export is to be **migrated onto a lib exporter**. Generalizing export beyond BPMN
happens in `blocksuite-labre`; labre-mcp becomes a thin caller that resolves a
file path or a text blob, calls the lib, and returns the result. This is in the
roadmap table below as a row, not a footnote.

**One packaging obligation follows.** A function both consumers call must be
exported from the package's public `index.ts` — not reachable only by deep
import — and it must not drag DI-only types into its signature. `exportBpmnXml`
and `bpmnBoardOf` already satisfy this; every new capability must, and it is
cheap to check.

## The roadmap

The PO's named matrix, as the initial roadmap. **Not all of it is v1** — this
ADR builds the seam and the BPMN import chantier is the first row that moves.

| framework   | format      | direction    | tier     | status                                                                                                                                                                                                                       |
| ----------- | ----------- | ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BPMN**    | `.bpmn` XML | Labre → file | semantic | **shipped** (PR #149) — to be re-declared as a registry capability                                                                                                                                                           |
| **BPMN**    | `.bpmn` XML | file → Labre | semantic | **next chantier** — the worked example D1–D6 specifies                                                                                                                                                                       |
| **BPMN**    | SVG         | file → Labre | visual   | **shipped** (PR #173) — recognition only, no round-trip; `bpmn:svg:import`, over the shared parser                                                                                                                           |
| **Wardley** | OWM DSL     | Labre → file | semantic | **shipped** (PR B2) — `exportWardleyOwm`, a pure function on this registry. labre-mcp becomes a caller and deletes its own serializer; until it does, that duplicate is the last standing violation of P3                    |
| **Wardley** | OWM DSL     | file → Labre | semantic | **shipped** (PR B2), and the **reference Wardley import** — `component` / `anchor` / `market` / `ecosystem` / `pipeline` / `note` / `evolve` and the `->` links are mapped; every other statement is carried                 |
| **Wardley** | mermaid     | file → Labre | semantic | roadmap — **awaits mermaid's experimental wardley type** (coordinates carried natively once stabilized; OWM DSL is the reference route until then, and a pre-type mermaid file falls back to graph-without-coordinates — P2) |
| **Wardley** | SVG         | file → Labre | visual   | **shipped** (PR #173) — recognition only; `wardley:svg:import`, the SAME parser BPMN declares, because a picture says nothing about which vocabulary it is a picture of                                                      |
| **C4**      | mermaid     | Labre → file | semantic | **in flight**, parallel chantier — lands **on this registry**, not beside it                                                                                                                                                 |

Three notes the chantiers should not have to rediscover:

- **Two of these rows wait on the same upstream.** Mermaid's Wardley diagram type
  and its C4 family are both experimental, and both are on this roadmap. The
  registry is what makes that survivable: a capability is a declaration plus a
  pure function, so a format that moves upstream costs a re-pinned golden corpus
  in one package rather than a change to the seam. Neither row is a reason to
  delay the seam, and neither should be shipped without recording which version
  of the syntax it was written against (P2).
- **C4 → mermaid is the registry's first new consumer and its first test.** It is
  being written now. It should declare an `InterchangeCapability` rather than a
  bespoke command, so that the second exporter costs a table row instead of a
  design. Mermaid's C4 diagram family (`C4Context`, `C4Container`, `Person`,
  `System`, `Rel`) is explicitly experimental upstream and its syntax has moved
  before; that instability is a reason to keep the serializer pure and pinned by
  golden-file tests, not a reason to delay.
- **The Wardley migration is a deletion, not a port.** The goal state is that
  no serialization logic for any Labre framework exists outside this repo.

## The worked example: BPMN import

The decisions below are taken against BPMN. They are stated in BPMN's vocabulary
because that is the only way to state them honestly, and the general form of each
is the sentence in bold.

### D1 — An import sorts every node of the file into three states

**General form: a semantic import classifies, it never silently discards.**
Three states, not two. The middle one is the whole point.

| state           | means                                                                                     | on the canvas   | on the next export                       |
| --------------- | ----------------------------------------------------------------------------------------- | --------------- | ---------------------------------------- |
| **mapped**      | there is a Labre artefact for it                                                          | drawn, editable | re-emitted **from the drawing**          |
| **carried**     | no artefact; kept verbatim on the nearest mapped element                                  | invisible       | re-emitted **verbatim**, in place        |
| **quarantined** | kept in the document, but re-emitting it would produce a document that contradicts itself | invisible       | **not** re-emitted; listed in the report |

**Mapped** is exactly the vocabulary PR #149 already writes, read backwards.
The inverse of `BPMN_XML_OF_KIND` is not a function and the import must not
pretend otherwise: `startEvent` is four kinds depending on its event-definition
child; `subProcess` and `callActivity` are mapped only in their collapsed form;
`dataObjectReference` is mapped and the `dataObject` behind it is folded into
it; `group` is mapped and its label is fetched through `categoryValueRef`.
Edges map by element name onto the three `BPMN_ROLE` values, and roles are
re-stamped through the inverse of `BPMN_ROLE_OF_KIND` — an imported element is
a statement in the same sense a drawn one is (ADR 0010).

**Carried** is everything else that has a home: Analytic and executable
vocabulary (`boundaryEvent`, `inclusiveGateway`, `eventBasedGateway`,
`businessRuleTask`, `sendTask` / `receiveTask`, `transaction`,
`adHocSubProcess`, `conditionExpression`, `ioSpecification`,
`dataInputAssociation`, `multiInstanceLoopCharacteristics`, `documentation`,
`isForCompensation`, `default`, …), plus every foreign attribute and every
`extensionElements` subtree.

**Quarantined** is the short, named list in D5. It exists because "re-emit
verbatim" has exactly one failure mode, and naming it is cheaper than
discovering it.

**Refusal is at the document level and has one case.** A `definitions` whose
only root is a `choreography` or a `conversation` is declined whole, by name,
with no partial import — half a choreography is not a smaller choreography.
Everything else is imported.

### D2 — The carrier is a per-element field, not a document-level side table

**General form: foreign matter rides on the element it came from, keyed by
format.** Declared once on `GfxPrimitiveElementModel`:

```ts
/** Verbatim foreign matter from an interchange import, keyed by format id. */
@field()
accessor interchange: Record<string, ForeignInterchange> | undefined = undefined;

interface ForeignInterchange {
  /** The element's id in the source file, verbatim. See D3. */
  id?: string;
  /** Its source element name, when the element itself was carried, not mapped. */
  element?: string;
  /** Attributes we do not model, by SCOPE then by name. See below. */
  attrs?: Record<InterchangeScope, Record<string, string>>;
  /** Child fragments, serialized, by the scope of the element they were in. */
  children?: Record<InterchangeScope, string[]>;
  /** DI fragments, by the scope of what they draw. */
  di?: Record<InterchangeScope, string[]>;
  /** Fragments kept but NOT re-emitted, with the reason (D5). */
  quarantined?: { fragment: string; reason: string }[];
}
```

**The three carrying members are keyed by SCOPE, and that was settled by the
first importer's review rather than by this draft.** The draft's flat
`Record<name, value>` was wrong in a way that could not have been repaired
later: one Labre element stands for SEVERAL source elements — a pool is a
`participant` and its `process`, plus a `laneSet`, every `lane`, the
`BPMNShape` that draws it, and, on the first pool, the `collaboration` and
`definitions` — so two lanes carrying one foreign attribute left one value in a
persisted Y.Map and a report that said two. It also could not support
re-emission at all, because nothing recorded which element an attribute came
off. A scope is the source element's **id, verbatim**, or an `@`-prefixed ROLE
key (`@self`, `@shape`, and whatever else a format needs) for a source element
with no id of its own; `@` is not an XML NameStartChar, so the two vocabularies
cannot collide. The rule for a fragment is always the same: **the scope is the
element it was a child of**, because that is where an exporter has to put it
back.

The key is the **format** id (`interchange.bpmn`, `interchange.owm`), never the
framework — a `.bpmn` and an OWM file make different promises about the same
element, and only a visual-tier import writes nothing at all (P2).

It mirrors `validationExceptions` and `profileId` field for field, and for the
reasons those two are already written down on that class:

- **`undefined`, and no key written.** An element that never met an import stays
  byte-identical to one created before the field existed. Optional field, no
  schema version bump, no migration, every document on disk opens unchanged.
- **Declared on the BASE class, not per subclass.** A `sequenceFlow` carrying a
  `conditionExpression` is a **connector**, and `ConnectorElementModel` is a
  shared model that will never be a BPMN class. Declaring `bpmnForeign` there
  would put a framework's name on the shared plumbing — the exact thing
  `validationExceptions` was declared on the base class to avoid. It is also
  what makes the field survive the generalization this ADR just went through:
  the C4 and Wardley importers need no new field and no new decision.
- **Declared at all, rather than relying on #73's verbatim-Y.Map fallback.**
  #73's fallback would already carry an undeclared key through a paste, but a
  field nothing declares is a field nothing can be tested against, nothing can
  strip, and nothing can find. Preservation that only works by accident is not
  a contract.
- **Flat JSON.** One level deep, Yjs-encodable, written once at import and never
  mutated afterwards — so the Yjs cost is one insert per element, not one per
  keystroke. The trade is `lanes`' trade and ADR 0007's: the whole value is one
  Y.Map entry, so two peers writing it concurrently resolve last-write-wins on
  the whole blob. Nobody edits this value, so the window is the import itself.

**Why not (b), a document-level side table keyed by element id.** It reads
better on a whiteboard and loses on all four of the properties that matter:

|                                     | (a) per-element field                                           | (b) doc-level side table                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| copy / paste / duplicate / alt-drag | travels with the element — that is precisely what #73 made true | **lost**: the clipboard payload is `element.serialize()`, which is the element's Y.Map and nothing else                                            |
| turn-into-linked-doc                | travels                                                         | **lost**, and the originals are deleted right after — #73's "fatal one", reintroduced                                                              |
| delete an element                   | the payload goes with it                                        | the row is **orphaned forever**; nothing GCs it, and the id it is keyed on is reissued by nobody, so it is silent dead weight in every future save |
| undo a delete                       | the element comes back whole                                    | the element comes back and its row was never removed, so this one case works — asymmetrically, by luck rather than by design                       |
| where it lives                      | an existing element field                                       | a **new block-schema prop** on the surface or page block, which is the deeper half of the red zone                                                 |

The deletion asymmetry is the decisive one. A side table is correct exactly
until a user deletes a task, and after that it is a document that quietly grows.

**Why not (c), drop with a warning.** Two reasons, and the first is the repo's
own: it is #73's bug with a nicer error message. A warning at import time is
read once, by one person, in one session; the file it describes is then edited
for six months by people who never saw it. It is also the PRD's honesty
principle inverted — a tool that says "I lost some things" and cannot say which,
where, or how to get them back has told the user nothing they can act on. The
export module already refuses to guess in the other direction; an import that
guesses "this mattered to nobody" is the same failure with the sign flipped.

### D3 — Identity: keep the file's id verbatim; never invert the sanitization

**General form: record what we were given, never reconstruct what we think we
sent.**

`toNcName` is **not** injective and this ADR does not try to make it one. `id`
is `xsd:ID` throughout BPMN, surface ids are nanoid-shaped and routinely open on
a digit, so an id that does not open on a letter or `_` gets a `_` prefix — and
a surface id that genuinely began with `_` produces the same NCName. `IdMinter`
resolves the collision with a counting suffix. Inverting `_7abc` → `7abc` would
be a guess about which of the two it was.

So:

- **Import stores the file's id verbatim** in `interchange.bpmn.id`. The surface
  element gets a fresh nanoid, as every surface element always has: surface
  identity is Labre's and is never the file's.
- **Export prefers `interchange.bpmn.id`** when it is a valid NCName and unused
  in the document being written; otherwise it mints as it does today and the
  report records the substitution. Export stays pure — it reads this field, it
  never writes one.
- **A Labre-authored element gains no id on export.** Its exported id is
  `toNcName(surfaceId)` plus a suffix that depends only on document order, which
  is deterministic, so the same board exports the same ids every time.

That yields the guarantee worth stating precisely, because it is the one an
architect will actually rely on:

> **The id map converges after one cycle.** The first export renames (surface id
> → NCName). Every export after an import is a fixed point: import records what
> it was given, export gives it back.

What a Labre → tool → Labre cycle preserves, and what it does not:

|                                            | preserved                                                                                                                                                                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| semantic identity (which element is which) | **yes**, through the file's id, as long as the third-party tool preserves ids — bpmn.io does                                                                                                                                                   |
| **surface** identity                       | **no.** Re-importing an edited file produces a **new** board beside the old one, never an update of it. Import is an import, not a merge. `interchange.bpmn.id` is the seam a future merge would need; building the merge is not this chantier |
| positions and sizes                        | yes, up to the plane offset (D4)                                                                                                                                                                                                               |
| lanes                                      | names, order and proportions yes; membership recomputed (below)                                                                                                                                                                                |
| roles on nodes and edges                   | yes, re-stamped from the element name + event definition                                                                                                                                                                                       |

**Lane membership is recomputed from geometry, and the file's `flowNodeRef` is
only checked against it.** Labre has no stored membership — `bpmnLaneOf` derives
it from the centre of the node, and the audit, the rules and the exporter all
read that one function. Storing the file's opinion would create a second source
of truth that the first drag contradicts. Where the two disagree on import, the
DI is authoritative for the picture and the disagreement goes in the report.

### D4 — Geometry: the file's diagram wins at import, the canvas wins at export

**General form: whichever side is authoritative for the picture is authoritative
for the geometry, and that side changes with the direction.** Stated flatly
because the symmetric-sounding alternative is wrong in both directions.

- **Import**: `dc:Bounds` → `xywh`, verbatim. No scaling, no snapping, no
  re-layout. A shape with no DI is still imported, gets a deterministic swept
  position, and is named in the report.
- **Export**: `xywh` → bounds. The canvas is authoritative for the picture,
  which is what PR #149 already does.
- **Waypoints**: an edge with **more than two** `di:waypoint`s has them restored
  onto the connector; an edge with exactly two does not. A two-point edge is
  what a straight source → target connector produces anyway, and freezing it as
  an explicit path would stop it re-routing when a node is dragged.
- **The §12.3 translation is not invertible, and we accept it.** Export shifts
  the whole drawing so its top-left is `(0, 0)`, because DI bounds are relative
  to the plane and a tool that clamps at zero would fold half the process onto
  its own edge. The offset is not written anywhere in the file, so import cannot
  restore it: a board whose top-left was at `(-4000, 1200)` comes back at
  `(0, 0)`. Relative positions, sizes and routings are exact. The offset is a
  viewport fact, not a model fact, and the picture is the shape.

A format that carries **coordinates but no pixels** — OWM DSL, and mermaid's
Wardley type — satisfies the first bullet through its own axes rather than
through a `dc:Bounds`: the pair _is_ the authoritative position, and the importer
projects it onto the plot instead of laying anything out. A source carrying **no**
position at all inverts the bullet rather than contradicting it: there is nothing
to be authoritative, so the importer lays out and says so in the report. It never
claims a position it invented came from the file.

### D5 — Quarantine: the four cases where preservation ≠ re-emission

**General form: a carried fragment is quarantined when re-emitting it would
produce a document that contradicts the drawing.** "Re-emit verbatim" is safe
exactly while the carried fragment does not contradict something Labre owns.

Four cases, and the list is meant to be closed and testable:

| #   | case                                                                          | why re-emitting is wrong                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Colour extensions** — `bioc:stroke` / `bioc:fill`, `color:background-color` | They collide with `strokeColor` / `fillColor`, which Labre owns and the user can change. Re-emitting a stale `bioc:fill` beside a recoloured shape writes a file that disagrees with itself.                                                              |
| 2   | **Expanded sub-process** — `isExpanded="true"` with a body                    | The pack draws the collapsed form only. The semantic body and its descendants' DI are carried; re-emitting them under a shape flagged collapsed is a document whose model and diagram disagree.                                                           |
| 3   | **Nested lanes** — `lane/childLaneSet`                                        | `pool.lanes` is flat. Import flattens to the leaf lanes and names them by joined path ("Sales / Back office"); the original `childLaneSet` is carried. Export writes the flat set, so re-emitting the nested one alongside would describe the pool twice. |
| 4   | **`definitions`-level `<import>` and cross-file QName references**            | §15.3.1 requires the file set to be self-contained. v1 reads one file; re-emitting an `<import>` we never resolved would claim a resolution we do not have.                                                                                               |

Quarantined material is **kept in the document** — nothing is destroyed, and a
later chantier that learns to draw an expanded sub-process finds the body
waiting for it. It is simply not written back.

`extension/@mustUnderstand="true"` is not quarantine — it is a **document-level
warning**, surfaced by name in the report, because it is the file telling us our
reading of it may be wrong. The import proceeds; the report says so.

### D6 — The document-scope residue, and its one accepted asymmetry

**General form: what has no element to ride on rides on the framework's
background element, and that is a stated asymmetry, not an oversight.**

Everything above attaches a fragment to "the nearest mapped element". Some
fragments have no such element: `definitions`-level `extension` declarations,
unreferenced root elements (`message`, `signal`, `error`, `itemDefinition`,
`resource`), foreign attributes on `definitions` itself, and a whole carried
element that lived in a process no participant named.

These ride on **the pool that the file's first `participant` became**, in
document order — the framework's background element, which is already where
`profileId` lives for exactly the same reason. A file with no participant — a
bare `process`, which is exactly what a poolless Labre board exports as — has a
pool minted for it, and that pool carries `interchange.bpmn.element = 'process'`,
which is what tells export to write the poolless form back rather than inventing
a collaboration the author never drew.

The asymmetry, stated rather than discovered: **delete that pool and the file's
document-scope residue goes with it.** Accepted. It is one Y.Map value that
copy-pastes, undoes and syncs with an element the user can see, which is the
whole argument of D2; the alternative is the doc-level table D2 rejected; and an
architect who has deleted the only pool of an imported process has deleted the
process.

#### Divergences accepted at implementation (PR #160, the importer)

D1–D6 were written before a reader existed. Building one found four places where
the text and the code cannot both stand; each was reviewed on its merits and is
recorded HERE rather than in a merged pull request, for the reason P1's own
divergences section gives — the next capability author reads this file and not
that thread. **Where this section and the decisions above disagree, this section
is what the code does.**

**1. D3's satellite rule, and it changes ids for every board.** D3 says export
prefers `interchange.<fmt>.id`. That alone is not enough for the fixed point it
promises: an element drags SATELLITE ids with it — a pool's `process` and
`laneSet`, every `BPMNShape` and `BPMNEdge`, a data object's `dataObject`, a
group's `category` — and those were minted from the SURFACE id, which the file
never carried and an import must never guess. So they are now minted from the id
the element **settled on** (the file's, when it was given one). Two visible
consequences, both accepted: a pooled process is written as
`Process_Participant_x` where it used to be `Process_x`, and a lane's id is
written unprefixed, because a lane that arrived as `Lane_3` has to leave as
`Lane_3` and not as `Lane_Lane_3`. Without this, the second file agrees with the
first on every semantic id and differs on every diagram id — a round trip that
looks right and is not.

**2. D6's minted pool gives the poolless form back only while it is the whole
board.** D6 mints a pool for a file with no participant and has it carry
`element: 'process'`, so the writer knows to write the poolless form. It does not
say what happens when the author then draws a SECOND pool beside it. Answer: from
that moment the board is a collaboration and the imported pool is a participant
like any other. The alternative — keeping it participant-less — leaves a pool the
architect can see and drag with no shape in the exported file, drawn by nothing
that opens it, which is the invisible-loss failure this ADR exists to prevent.

**3. D1's refusal is a CHOREOGRAPHY refusal; a conversation is carried.** D1
declines "a `definitions` whose only root is a `choreography` or a
`conversation`". A `conversation` is never a root — §10.6 makes it a child of
`collaboration` — so as written the sentence describes a file that cannot exist.
The reader refuses a root `choreography` (and `globalChoreographyTask`) by name,
and a conversation inside a collaboration is CARRIED like any other vocabulary
the pack does not draw. That is the better behaviour: the process beside it is
real and importable, and refusing the file would lose it to make a point.

**4. `mapped` counts what became a drawn artefact, lanes included.** A lane is
drawn, editable and is not an element of its own, so it is counted; and the pool
D6 mints for a bare `process` is counted too, because there IS a source element
it is the artefact for — the `process` — which is exactly what
`element: 'process'` records. The count is of source nodes that got an artefact,
not of surface elements created.

#### Divergences accepted at implementation (PR #164, the writer)

The reader was built against D1–D6; the writer was built against the reader.
Six places where the decisions above are incomplete rather than wrong, recorded
HERE for the reason both sections above give — the next capability author reads
this file and not that thread. **Where this section and the decisions above
disagree, this section is what the code does.**

**1. A scope says which element, and the XSD says where inside it.** D2 states
the rule as _"the scope is the element it was a child of, because that is where
an exporter has to put it back"_. That is true of the parent and silent about
the position, and `tProcess` is an `xsd:sequence` — `documentation* →
extensionElements? → … → laneSet* → flowElement* → artifact* →
resourceRole*` — so a carried `<auditing>` written after the lane set is a
document a validating parser refuses, every character of it correct. Placement
is therefore **derived from the schema**, from the same sequences the exporter
already writes its own children in, with the open slot as the default: a name
the tables do not know goes to `flowElement*` in a process (the one unbounded
substitution group it has) and to the conversation tail in a collaboration
(which has no flow elements at all). One consequence, and it is in the loss
table: a fragment comes back in a legal slot, not necessarily the slot the file
had it in.

**2. A namespace declaration is filtered on the PAIR, not on the URI.** #160
declined to carry any `xmlns:` whose URI was one of the four this library
writes, to keep a Labre file's payload empty. That is right about the URI and
wrong about the prefix: bpmn.io writes the model namespace as `bpmn2:`, every
carried fragment is stored with the prefixes the file spelled it in, and a
document declaring `xmlns:bpmn` and not `xmlns:bpmn2` cannot parse a single one
of them. The reader now skips only an exact `(prefix, URI)` match of a
declaration the writer makes anyway — so `xmlns:bpmn2` is carried, the three DI
declarations a normal file spells identically are not, and the empty-payload
property is untouched. A file that binds one of the library's own four prefixes
to something else is carried and **not** written back, because re-emitting it
would rebind the prefix every `dc:Bounds` in the document is under; the export
warns.

**3. A carried diagram element keeps the file's coordinates, and the plane may
have moved.** D4 has export translate the drawing so its top-left sits at the
plane origin (§12.3). A carried `BPMNShape` is given back character for
character — that is what makes the payload a fixed point, and rewriting the
numbers inside a fragment would mean the second read stored something the first
never saw — so where the translation is not a no-op the carried shape lands
`(dx, dy)` away from where it belongs. Verbatim and correctly-placed are
genuinely different sentences here, verbatim wins, and the loss table and the
export's own warning both say so. Nothing is lost; something is displaced.

**4. Quarantine is a third answer to "was this diagram element accounted for".**
D5 quarantines the body of an expanded sub-process. The reader's residue sweep
then found the body's inner `BPMNShape`s **orphaned** — nothing declared what
they drew any more — and carried them, so the writer would have drawn a body
the quarantine exists to suppress. The quarantine now takes the whole subtree's
diagram with it, and the sweep skips a quarantined id. This is the case NIT-2 of
#160's review predicted would "start biting when re-emission lands"; it bit on
the first run.

**5. Every carried fragment is written back at most once, and the unit is the
`xsd:ID`.** D6 files `definitions`- and `collaboration`-scope residue on _the
first pool_. "First" is the reader's document order, and the writer is handed
the board's — and a pool can be copy-pasted, deleted, or drawn before the
imported one. So the writer asks every pool.

The deduplication that follows is **not** document-scope-only, and the first cut
of this PR got that wrong. `interchange` is declared on the base element model
precisely so a payload survives a paste (PR #73), so a pool imported from a
`.bpmn` and then copy-pasted holds its carried boundary event, its lane's
`documentation` and its `BPMNShape` twice as well — at `@process`, at a lane
scope and on the plane, none of which is document scope. **The guard is
document-wide and applies at every re-emission site.**

Its key is the **`xsd:ID` a carried fragment's root claims**, not the fragment's
text, because uniqueness of the id is the invariant and text identity is neither
necessary nor sufficient for it: two pools imported from two different files
each carrying `<message id="Msg_1" name="A"/>` and `<message id="Msg_1"
name="B"/>` are different strings and cannot both be written. First claim wins —
it is the one already written and already referenced — and a second, DIFFERENT
fragment under the same id is reported. Text identity remains the fallback for
an **id-less fragment at document scope**, where two pools carrying one payload
carry one fragment; an id-less fragment at element scope is never deduplicated,
because two tasks may each carry their own `<documentation>` and those are two
fragments rather than one written twice.

**6. Neither half of a carried attribute is trusted as markup.** The serializer
escapes attribute VALUES and interpolates NAMES, which is the one asymmetry in
that module that decides the SHAPE of the document rather than its content: a
value says anything and stays inside its quotes, a name does not. A "name" of
`x="1"><task id="INJECTED"/><y z` closes its own element and opens two more, so
the damage is not confined to the element carrying the payload — it unbalances
the file. `interchange` is ordinary collaborative Y.Map data (any peer with
write access, any hand-edited document, any paste from a board that met a
different importer), so a carried name is written only if it IS a name: an
NCName, or the `prefix:local` pair of them every foreign attribute in a `.bpmn`
wears. Refused names stay in the document and are reported.

The FRAGMENT half of the same question is deliberately not guarded, and that is
D2 rather than an oversight: verbatim re-emission of arbitrary foreign matter
cannot be made safe without re-parsing it, which a pure function of the board
cannot do. The reader/writer pair is the trust boundary, and it is stated as one
in `export.ts`'s `XmlFragment`.

#### Divergences accepted at implementation (PR B2, the OWM DSL pair)

D1–D6 were written against a format with ids, a diagram section and an XML
tree. The OWM DSL has none of the three, and building both directions of it
found four places where the decisions above are silent rather than wrong. They
are recorded HERE for the reason the two sections above give — the next
capability author reads this file and not that thread.

**1. A composite artefact needs handles the file never gave it.** D3 stores the
source id verbatim and forbids inventing one. OWM has no ids at all — the NAME
is the identity — so the reader files each element's name under
`interchange.owm.id`, and the materializer's endpoint map is a fold over the
names. Two artefacts on this canvas are COMPOSITES whose own wiring has to
resolve through that same map and which the file names nothing for: a market
(three inner dots joined by three connectors) and the twin an `evolve` line
draws. Each such element therefore gets a minted handle plus
`element: 'market'` / `element: 'evolve'`, which is what marks the id as a
handle rather than a claim about the file. The writer reads `element` before it
reads `id` and never gives a minted one back as a name. Minting is deterministic
and collision-checked against every declared name.

**2. A name is a sibling element, so the writer has to find it — and nearest
does not work.** BPMN carries a label on the artefact; here it is a separate
free text carrying `wardley:label`, and "which node is this the name of" is a
question the document does not answer. The naive rule (nearest node to the label
box) is wrong on a real map and provably so: two components 60 units apart
horizontally and 17 vertically — nothing on a 1530-wide plot, and exactly what
the tea-shop corpus holds — put the lower one's centre INSIDE the upper one's
label box. The writer instead asks how far each label is from where a label for
THAT node would have been written, computed from the node's own half-size, and
assigns greedily by distance with document order as the tie-break. It is the one
heuristic in a semantic capability and it is named as one.

**3. The reader draws no GROUP, and the elements it writes are ungrouped.** The
toolbox groups a circle with its name; `templates/maps.ts`, which is the
precedent for "coordinates in, serialized props out", does not. Neither does
this reader, and the reason is the seam rather than taste:
`materializeInterchangeImport` rewrites CONNECTOR endpoints and nothing else, so
a group's `children` would name file-level ids nothing resolves. Grouping an
imported map is a gesture the author can make; a broken group is one they cannot
undo.

**4. D1 needs a fourth question for a format whose statements REFER to each
other.** The three states sort each node of the file by what became of it, and
that is complete for `.bpmn`, where a `sequenceFlow` names ids the same document
declares and a reader can see both. The OWM DSL has no ids: a link names its two
ends by NAME, and a name nothing declares is not a malformed line — it is a
perfectly well-formed statement about something that is not there. Such a link
is `mapped` by every reading of D1 (it became a connector), and the connector
routes to an empty path and is invisible on the canvas, so a file with one typo
in it imported as "2 drawn, 0 carried, 0 quarantined" while an arrow the user
could see in their old tool was silently gone. The reader now sweeps every link
end against the declared names and reports a `warning` per dangling END. No new
state and no change to D1's three — but a capability whose format lets one
statement refer to another owes this sweep, and the next one should not have to
rediscover it.

**5. This capability quarantines nothing, and that is a finding about the
format.** D5's four cases all have the same shape: a carried fragment that
contradicts something the drawing owns. Every statement the OWM DSL writes is a
standalone line with no nesting and no cross-references, so a carried one cannot
contradict a drawn one — the reader carries `style`, `annotation`, the
attitudes, `submap`, `url`, `size`, `accelerator`, the flow links and the
comments, and the writer gives all of them back verbatim. The count is zero
because the format has no such case, not because the case is unimplemented.
`sourceVersion` follows the same honesty: the DSL declares no version, so the
reader reports the DIALECT it read and marks a file holding nothing this library
does not itself write, rather than claiming an authorship no byte in the file
asserts.

## What is knowingly lost, and what is merely invisible

The honesty table, for the BPMN round-trip. "Invisible" is not "lost" — the
distinction is the deliverable of this ADR, and the report must draw it in the
same words. **Every semantic capability owes its own version of this table**;
that obligation is the generalization, and it is what turns the tier in P2 into
something a reviewer can check.

**Updated when the writer half landed (PR #164).** Every "re-emitted" below
was a promise when this table was first written and is a passing test now; the
rows that moved are marked, and the two rows the writer ADDED are the honest
price of it.

| what                                                                             | state                             | round-trip result                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| the plane offset (§12.3)                                                         | **lost**                          | shape exact, absolute origin at `(0, 0)`                                                                                                                                                                                                                                                                                       |
| surface identity across a re-import                                              | **lost**                          | a new board, never a merge into the old one                                                                                                                                                                                                                                                                                    |
| **a carried shape's position, once the drawing has moved** _(new)_               | **lost**                          | a carried fragment is given back character for character, so it keeps the source file's coordinates while everything drawn is translated to the plane origin. The export warns. Nothing is lost; something is displaced                                                                                                        |
| **an `xmlns:` rebinding one of Labre's own four prefixes** _(new)_               | **lost on export**                | kept in the document, not written back: re-emitting it would rebind the prefix every `dc:Bounds` in the file is written under. The fragments carried under it ARE written and are then read under Labre's binding — reinterpreted rather than lost, which is the worse half, so the warning names both                         |
| **an `xmlns:` declared on anything but `definitions`** _(new)_                   | **lost**                          | the reader carries declarations off `definitions` only, so a fragment relying on one scoped to its own ancestor comes back unparseable. bpmn.io and Camunda both hoist, so it is theoretical on a real file                                                                                                                    |
| **a carried element whose id another carried element already claimed** _(new)_   | **lost on export**                | the first is written and the rest are not — an `xsd:ID` is unique across a document, and a pool duplicated by a paste carries its whole payload twice. The duplicates stay in the document; the export names them where the two disagree, and writes an exact duplicate once in silence — one thing carried twice is one thing |
| **two pools disagreeing about one `definitions` attribute** _(new)_              | **lost on export**                | one value can be written and the last wins; matter carried from the other file is then read under it. Both stay in the document and the export warns                                                                                                                                                                           |
| **a carried fragment's SLOT inside its parent** _(new)_                          | **lost, and re-derived**          | the scope records which element a fragment was a child of, not which slot of it. The writer places it from the XSD sequence — always legal, not necessarily where the file had it                                                                                                                                              |
| a colour set in bpmn.io                                                          | **lost on export** (quarantined)  | imports grey, re-exports without the vendor colour                                                                                                                                                                                                                                                                             |
| expanded sub-process rendering                                                   | **lost on export** (quarantined)  | drawn collapsed; the body and its DI survive in the document                                                                                                                                                                                                                                                                   |
| lane nesting                                                                     | **lost on export** (quarantined)  | flat lanes with joined names; the nesting survives in the document                                                                                                                                                                                                                                                             |
| `<import>` of a multi-file set                                                   | **lost on export** (quarantined)  | single-file import only                                                                                                                                                                                                                                                                                                        |
| **`process/@isExecutable="true"`** _(was lost, now round-trips)_                 | **carried**                       | written back on the `process`, overriding the `false` the writer mints                                                                                                                                                                                                                                                         |
| **a file's own prefix for a namespace (`bpmn2:`)** _(was lost, now round-trips)_ | **carried**                       | re-declared on `definitions`, without which every fragment carried under it is unparseable                                                                                                                                                                                                                                     |
| `conditionExpression`, `default` on a flow                                       | **carried**                       | invisible on canvas, re-emitted verbatim                                                                                                                                                                                                                                                                                       |
| loop / multi-instance / compensation markers                                     | **carried**                       | a plain task on canvas, marked again in the file                                                                                                                                                                                                                                                                               |
| `ioSpecification`, `dataInputAssociation`                                        | **carried**                       | re-emitted verbatim on the activity                                                                                                                                                                                                                                                                                            |
| `documentation`                                                                  | **carried**                       | re-emitted verbatim                                                                                                                                                                                                                                                                                                            |
| Analytic elements (boundary / inclusive / event-based, `transaction`, …)         | **carried** on the enclosing pool | not drawn; re-emitted into the flow-element slot they came out of, with their `BPMNShape` back on the plane                                                                                                                                                                                                                    |
| a flow onto a carried node (a boundary event's error path)                       | **carried**                       | never drawn loose; re-emitted with the node it runs to, its `BPMNEdge` included                                                                                                                                                                                                                                                |
| `camunda:` / `zeebe:` / `signavio:` extensions                                   | **carried**                       | re-emitted verbatim, with the declarations they need                                                                                                                                                                                                                                                                           |
| the 17 kinds, pools, flat lanes, 3 edge roles, DI                                | **mapped**                        | drawn and re-emitted from the drawing                                                                                                                                                                                                                                                                                          |

A carried element is not on the canvas, so no validation rule sees it and no
audit counts it. That is correct and must be said out loud in the report:
**Labre judges the process it can draw, not the file it is holding.**

## Non-goals

- **Executable semantics.** Nothing here interprets a condition, an expression,
  a listener or a form. Carried, never evaluated.
- **Choreography and conversation.** Declined at the document level (D1).
- **A round-trip promise for the visual tier.** P2 is explicit: SVG import is
  recognition, produces a level-1 sketch, and promises nothing else.
- **A generic "any format" importer.** The registry's unit is the triple. There
  is no framework-agnostic reader, and a format nobody declared a capability for
  is a format Labre does not read.
- **Widening `BpmnNodeKind` to the Analytic set.** A separate product decision
  with its own toolbox, glyph and rule cost; carrying is what lets it be
  deferred without losing anything in the meantime.
- **Adopting foreign DI extensions.** bpmn.io's `bioc:` namespace and the OMG
  non-normative colour extension are the obvious candidates for a later
  chantier — mapping them onto `strokeColor` / `fillColor` would lift case 1 out
  of quarantine in both directions at once. Not v1.
- **Merge / re-import onto an existing board.** The seam is `interchange.<fmt>.id`;
  the chantier is not this one.
- **Choosing a validation profile from the file.** An imported board takes no
  `profileId`. A `.bpmn` does not declare which of our profiles it wants, and
  guessing would judge an architect's file against rules they never chose.

## Consequences

- **A red-zone field on every element.** `interchange` is declared on
  `GfxPrimitiveElementModel`, so every element in every document gains a
  potential key. It stays `undefined` and unwritten until an import touches it,
  which is why this is additive rather than a migration — but it is still a
  change to `packages/framework/std` gfx element plumbing and must not merge on
  CI green alone.
- **labre-mcp's Wardley export becomes a caller, and its serializer is deleted.**
  Cross-repo work, sequenced after a lib Wardley exporter exists. Until it does,
  the duplicate stands and is the one known violation of P3 — recorded here so
  it is tracked rather than normalised. The end state is that **no serialization
  logic for any Labre framework lives outside this repo.**

  _The lib exporter exists since PR B2_ (`exportWardleyOwm`, exported from
  `@labre/affine-gfx-wardley`'s index alongside `WARDLEY_BACKGROUND`, which is
  the plot both sides have to agree about). The cross-repo half is now the only
  thing standing between this row and the end state, and it is a deletion.

- **Export generalization happens here, not in labre-mcp.** Wardley, C4 and
  every framework after them get their exporter in `packages/affine/gfx/*`, as
  a registry capability. labre-mcp gains tools, not parsers.
- **The C4 → mermaid chantier in flight acquires a dependency.** It should
  declare an `InterchangeCapability` rather than a bespoke command. If the
  registry is not ready when it lands, it must at minimum keep its serializer a
  pure function in its own package so that adopting the registry later is a
  registration line, not a rewrite.
- **Documents get bigger, unevenly.** A Camunda file's `extensionElements` are
  a few kB per activity. The blob is written once and never mutated, so the
  sync cost is an insert, not a stream — but a board imported from a heavily
  extended file is materially larger than one drawn by hand. No cap is set in
  v1 (see open questions).
- **Preservation is now testable, which it was not.** Because the payload is a
  declared field rather than #73's accidental-Y.Map fallback, a golden corpus
  can assert on it, and a regression that starts dropping extensions fails a
  test instead of a customer.
- **Export gains one read and no writes.** `export.ts` stays a pure function of
  the board; it simply consults `interchange.bpmn` for the id and the verbatim
  fragments. The quarantine list is the only new branch.
- **The report becomes a product surface, not a log line.** Its three columns are
  exactly the three states of D1, and it is returned by the pure function — so
  the MCP tool and the editor command show the user the same thing. Where it is
  shown is the import chantier's question (ADR 0011 is the obvious answer); that
  it must exist is this ADR's.
- **Round-trip stability is now a claim we can make and pin.** After one cycle,
  `export(import(f)) == f` modulo a documented, tested allow-list of
  differences. Before this ADR the honest claim was "export produces a file
  bpmn.io opens", which is a much weaker sentence.

## Rejected alternatives

- **Document-level side table keyed by element id** — D2's table. Loses the
  clipboard, loses turn-into-linked-doc, orphans rows on every deletion, and
  needs a block-schema prop.
- **Drop the unmapped with a warning** — #73's bug with better copy. Also the
  only option that makes the round-trip claim false.
- **Leave parsers in labre-mcp, or split them by direction** ("import in the lib,
  export in the MCP"). Two implementations of one format that nothing compares.
  The split-by-direction variant is worse than either pure option, because the
  round-trip properties D3 and the fixed-point test depend on the two directions
  agreeing about ids, geometry and quarantine.
- **One capability per format, with the framework inferred from the file** — a
  `.bpmn` is a BPMN file so the inference looks free, but SVG and mermaid are
  read by several frameworks and the inference is exactly the guess this ADR
  forbids everywhere else.
- **Give SVG import the preservation contract too** — it would mean carrying the
  source SVG on every element, which preserves a rendering nobody can re-derive
  meaning from. Recognition plus the promotion ladder is both cheaper and more
  honest.
- **Placeholder shapes for unmapped elements** — a rectangle on the canvas the
  author never drew, cannot meaningfully edit, and which the audit and the rules
  would then have to be taught to ignore. It also breaks the exporter's own
  discipline: the file would gain a shape nobody stated.
- **Invert the NCName sanitization on import** — `_7abc` has two preimages.
  Recording what we were given is strictly better than reconstructing what we
  think we sent.
- **Store lane membership from `flowNodeRef`** — a second source of truth that
  the first drag contradicts. Geometry already decides, in one function, for
  four consumers.
- **Re-emit everything verbatim, with no quarantine** — produces files whose
  model and diagram disagree (D5 cases 2 and 3) and whose colours contradict the
  canvas (case 1). Verbatim is the default, not the rule.
- **Refuse to import files outside the Descriptive subset** — the honest-looking
  option that is actually the least useful: almost no real file is inside it,
  and refusing is a stronger loss than carrying.

## Test coverage this implies

- **Registry totality.** Every registered capability has a unique
  `framework:format:direction` id; every semantic-tier capability has a loss
  table in its package docs and a golden corpus; every visual-tier capability
  asserts it writes **no** `interchange` key. That last one is the test that
  keeps P2 from decaying into a preference.
- **Purity, pinned.** Each capability's `run` is called in a unit test with plain
  object stubs and no DI container, as `export.unit.spec.ts` already does. A
  capability that cannot be called that way has broken P3 and fails.
- **A golden corpus, checked in.** Files produced by bpmn.io and Camunda
  Modeler, plus one file per quarantine case. For each: import → re-export →
  compare with the source under a **documented allow-list** of differences. The
  allow-list is the artefact under test — every entry in it is a line of the
  loss table, and an entry nobody can point at a table row for is a regression.
- **The fixed-point property.** For a board built from the mapped vocabulary
  only, `export(import(export(board)))` is byte-identical to `export(board)`.
- **The convergence property (D3).** Ids differ between the first and second
  export of a hand-drawn board, and are identical between the second and third.
- **Quarantine totality.** A test per D5 case asserting the fragment is present
  in the element's payload and absent from the re-export — both halves, because
  each alone passes for the wrong reason.
- **Preservation through the clipboard**, mirroring #73's own specs: duplicate
  an imported task, assert the copy carries the same `interchange.bpmn`; run it
  through turn-into-linked-doc and assert the same.
- **`toNcName` non-injectivity pinned** as a unit test, so nobody later "fixes"
  it into an invertible encoding and silently changes every id in every file.
- **Flag independence (ADR 0009).** With the framework's flag off, a board
  produced by a previous import still opens, paints and keeps its `interchange`
  payload; only the import command is gone.
- **Integration**: import a two-pool Camunda file into a live editor and assert
  the drawn board, the lane bands and the report's three counts.

## Open questions

Genuinely open — each needs the chantier that meets it, and none blocks the
decisions above.

1. **Which MCP tool surface exposes import — a file path, or inline text?** The
   lib function takes a string either way (P3), so this is entirely labre-mcp's
   call, and it is a real one: a path means the MCP server reads the user's
   filesystem, inline text means a large `.bpmn` travels through a tool call.
   Likely both, with the path form gated; not decided here.
2. ~~**SVG recognition scope, per framework.**~~ **Answered** by PR #173 — see
   _Answered at implementation (PR #173, the SVG importer)_ under P2. The
   statement is written once, in `svg-sketch.ts`, because both shipped visual
   capabilities wrap one parser; the answer to "what is a visual capability
   allowed to guess" is _geometry, and nothing about the vocabulary_. The
   question re-opens the day a framework wants narrower or wider recognition
   than the shared parser gives it.
3. **Is a payload size ceiling needed?** Nothing caps `interchange` in v1. A
   pathological file (generated BPMN, thousands of extension elements) would
   produce a document that is mostly foreign matter. A cap that drops data
   contradicts D2, so the only honest cap is a refusal at import time — which
   needs a number nobody has.
4. **Where the report is shown**, and whether it is re-readable after the session
   that produced it. ADR 0011's editor-anchored panel is the obvious home;
   whether the report is persisted on the board is a separate call.
5. **Does an imported board stay unprofiled forever, or is the author prompted
   once?** The non-goal says import chooses nothing; it does not say the UI
   stays silent.
6. **Is merge / re-import wanted at all?** If yes, `interchange.<fmt>.id` needs a
   uniqueness story across a document; if no, it is a record and nothing more.
