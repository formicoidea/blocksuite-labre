# ADR 0012 — The platform trades diagrams with the outside world, and preserves what it does not understand

- Status: **proposed** (August 2026) — requires human approval. It adds one
  persisted field to `GfxPrimitiveElementModel`, i.e. to the Y.Map of **every**
  surface element, and it fixes the MEANING of that field for documents that
  will be written before any of it ships. That is the red zone `CLAUDE.md`
  names twice over (`packages/framework/std` gfx element plumbing, and a
  schema/model change that must stay loadable by older documents).
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

| framework | format  | direction  | where the code is today                            |
| --------- | ------- | ---------- | -------------------------------------------------- |
| BPMN      | `.bpmn` | export     | `packages/affine/gfx/bpmn/src/export.ts` — the lib |
| Wardley   | OWM DSL | export     | **labre-mcp** — outside this repo                  |
| C4        | mermaid | export     | in flight, parallel chantier                       |
| _any_     | _any_   | **import** | nothing, anywhere                                  |

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

A third possibility is worth naming so nobody rediscovers it as a bug:
**a semantic format can still be partial by absence.** Mermaid has no Wardley
diagram type, so a mermaid → Wardley import can recover the graph — components
and dependencies — and cannot recover what mermaid never wrote: the visibility
and maturity coordinates that _are_ a Wardley map. That import is semantic (it
reads a model) and lossy at the source (the model is missing an axis). It
belongs in the semantic tier, and the chantier that builds it owes the user an
explicit answer to "where do the coordinates come from" — laid out, or authored
afterwards. Flagged here so that answer is designed rather than defaulted.

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

| framework   | format      | direction    | tier       | status                                                                                                                                             |
| ----------- | ----------- | ------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BPMN**    | `.bpmn` XML | Labre → file | semantic   | **shipped** (PR #149) — to be re-declared as a registry capability                                                                                 |
| **BPMN**    | `.bpmn` XML | file → Labre | semantic   | **next chantier** — the worked example D1–D6 specifies                                                                                             |
| **BPMN**    | SVG         | file → Labre | visual     | roadmap — recognition only, no round-trip                                                                                                          |
| **Wardley** | OWM DSL     | Labre → file | semantic   | **exists in labre-mcp, outside the lib** — to be **migrated** onto a lib exporter                                                                  |
| **Wardley** | OWM DSL     | file → Labre | semantic   | roadmap — `component` / `anchor` / `evolve` / `pipeline` and the `[visibility, maturity]` pair map onto the Wardley element models almost directly |
| **Wardley** | mermaid     | file → Labre | semantic\* | roadmap — \*partial by absence: graph structure only, no coordinates (P2)                                                                          |
| **Wardley** | SVG         | file → Labre | visual     | roadmap — recognition only                                                                                                                         |
| **C4**      | mermaid     | Labre → file | semantic   | **in flight**, parallel chantier — lands **on this registry**, not beside it                                                                       |

Two notes the chantiers should not have to rediscover:

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
  /** Attributes we do not model — foreign-namespaced and standard alike. */
  attrs?: Record<string, string>;
  /** Child fragments, serialized: `extensionElements`, unmodelled children,
   *  and whole carried elements that were children of this one. */
  children?: string[];
  /** DI fragments describing anything in `children`. */
  di?: string[];
  /** Fragments kept but NOT re-emitted, with the reason (D5). */
  quarantined?: { fragment: string; reason: string }[];
}
```

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

A format with **no** geometry at all — OWM DSL, mermaid — inverts the first
bullet rather than contradicting it: there is nothing to be authoritative, so the
importer lays out and says so in the report. It never claims a position it
invented came from the file.

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

## What is knowingly lost, and what is merely invisible

The honesty table, for the BPMN round-trip. "Invisible" is not "lost" — the
distinction is the deliverable of this ADR, and the report must draw it in the
same words. **Every semantic capability owes its own version of this table**;
that obligation is the generalization, and it is what turns the tier in P2 into
something a reviewer can check.

| what                                                                     | state                             | round-trip result                                                  |
| ------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------ |
| the plane offset (§12.3)                                                 | **lost**                          | shape exact, absolute origin at `(0, 0)`                           |
| surface identity across a re-import                                      | **lost**                          | a new board, never a merge into the old one                        |
| a colour set in bpmn.io                                                  | **lost on export** (quarantined)  | imports grey, re-exports without the vendor colour                 |
| expanded sub-process rendering                                           | **lost on export** (quarantined)  | drawn collapsed; the body survives in the document                 |
| lane nesting                                                             | **lost on export** (quarantined)  | flat lanes with joined names; the nesting survives in the document |
| `<import>` of a multi-file set                                           | **lost on export** (quarantined)  | single-file import only                                            |
| `conditionExpression`, `default` on a flow                               | **carried**                       | invisible on canvas, re-emitted verbatim                           |
| loop / multi-instance / compensation markers                             | **carried**                       | a plain task on canvas, marked again in the file                   |
| `ioSpecification`, `dataInputAssociation`                                | **carried**                       | re-emitted verbatim on the activity                                |
| `documentation`                                                          | **carried**                       | re-emitted verbatim                                                |
| Analytic elements (boundary / inclusive / event-based, `transaction`, …) | **carried** on the enclosing pool | not drawn; re-emitted in place                                     |
| `camunda:` / `zeebe:` / `signavio:` extensions                           | **carried**                       | re-emitted verbatim                                                |
| the 17 kinds, pools, flat lanes, 3 edge roles, DI                        | **mapped**                        | drawn and re-emitted from the drawing                              |

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
2. **SVG recognition scope, per framework.** What a Wardley SVG importer is
   allowed to guess is not what a BPMN one is. Each visual capability owes a
   one-paragraph statement of its heuristics and its known failure modes; none
   is written yet.
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
