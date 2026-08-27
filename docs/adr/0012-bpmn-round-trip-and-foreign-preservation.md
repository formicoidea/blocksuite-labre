# ADR 0012 — The BPMN round-trip preserves what it does not understand

- Status: **proposed** (August 2026) — requires human approval. It adds one
  persisted field to `GfxPrimitiveElementModel`, i.e. to the Y.Map of **every**
  surface element, and it fixes the MEANING of that field for documents that
  will be written before any of it ships. That is the red zone `CLAUDE.md`
  names twice over (`packages/framework/std` gfx element plumbing, and a
  schema/model change that must stay loadable by older documents).
- Deciders: Mathieu Jolly
- Milestone: BPMN — interoperability, the chantier AFTER export
- Precedent this ADR extends: **PR #73** — _preserve unknown props when copying
  surface elements_ (`docs/spikes/us-1-8-unknown-props-preservation.md`).
  That PR settled the principle — _"preserve what we do not understand"_ — and
  the mechanism, decorator-table routing at the two loss sites. This ADR applies
  the same principle to a second frontier: not a field a newer Labre wrote, but
  a fragment a foreign tool wrote.
- Related ADRs: [0009](0009-reversed-flag-contract.md) (nothing a stored
  document needs may be gated; an import writes stored documents),
  [0010](0010-persisted-relation-direction.md) (the role on an edge is the
  statement — an import must not invent one),
  [0007](0007-universe-tag-defs-format.md) (flat-JSON element props, and the
  last-write-wins trade a whole-value field takes).
- **Blocks**: the `.bpmn` **import** chantier. Import cannot be built before this
  is approved, because import is the only moment at which the decision "what do
  we do with the part of the file we have no artefact for" can be taken, and it
  is taken once — the answer becomes a persisted field, and a persisted field is
  as hard to change as a schema.

## The question

PR #149 shipped export: a board leaves as a spec-conformant `.bpmn` file,
seventeen kinds plus `group`, three edge roles, pools, lanes and BPMNDI. The
external review's objection is correct and is the reason this ADR exists:

> Export alone proves nothing. The interoperability claim is the **round-trip** —
> Labre → `.bpmn` → third-party tool → `.bpmn` → Labre — and a round-trip that
> quietly deletes the part of the file it did not recognise is worse than no
> round-trip at all, because the loss is invisible until somebody re-opens the
> file in the tool that wrote it.

A `.bpmn` in the wild is almost never the Descriptive subset Labre draws. It
carries Analytic vocabulary (boundary events, inclusive gateways, event-based
gateways), the executable half (`ioSpecification`, `conditionExpression`,
`multiInstanceLoopCharacteristics`), and — in practice, on every file that has
been through a real tool — a vendor's `extensionElements`: `camunda:*`,
`zeebe:*`, `signavio:*`, and bpmn.io's own `bioc:stroke` / `bioc:fill`.

So: **what does import v1 map, what does it keep without drawing, and what does
it admit to losing?**

## Context

### 1. What Labre speaks today

`packages/affine/gfx/bpmn/src/export.ts` is the whole vocabulary, and it is
compile-total over it:

| Labre                                         | BPMN                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| 17 `BpmnNodeKind`s (`BPMN_XML_OF_KIND`)       | 14 distinct element names + 3 event definitions                            |
| `BpmnPoolElementModel`                        | `participant` + `process` (or a lone `process` when the board has no pool) |
| `pool.lanes` (`BpmnLane[]`, relative weights) | a **flat** `laneSet`                                                       |
| lane membership                               | recomputed from geometry by `bpmnLaneOf`, never stored                     |
| 3 edge roles (`roles.ts`)                     | `sequenceFlow`, `messageFlow`, `association`                               |
| `xywh`, connector `absolutePath`              | `BPMNShape` / `BPMNEdge` bounds and waypoints                              |

Two properties of the exporter matter to everything below.

**It is pure and deterministic.** Element models in, string out. `IdMinter`
walks the board in document order, so the same board always produces the same
bytes — including the same ids.

**It refuses to guess.** A connector with no BPMN role is not an untyped
sequence flow, it is not a flow at all, and it is absent from the file (ADR
0010). A plain rectangle beside a pool is not an unnamed task. The import must
inherit this discipline in the other direction: a fragment we cannot read is
not a thing we may quietly decide is nothing.

### 2. What the format says about the unknown

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

## Decision

### D1 — Import v1 sorts every node of the file into three states

Not two. The middle one is the whole point.

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

**Decided: option (a), a per-element opaque payload.** Declared once on
`GfxPrimitiveElementModel` and keyed by interchange format:

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

It mirrors `validationExceptions` and `profileId` field for field, and for the
reasons those two are already written down on that class:

- **`undefined`, and no key written.** An element that never met an import stays
  byte-identical to one created before the field existed. Optional field, no
  schema version bump, no migration, every document on disk opens unchanged.
- **Declared on the BASE class, not per subclass.** A `sequenceFlow` carrying a
  `conditionExpression` is a **connector**, and `ConnectorElementModel` is a
  shared model that will never be a BPMN class. Declaring `bpmnForeign` there
  would put a framework's name on the shared plumbing — the exact thing
  `validationExceptions` was declared on the base class to avoid. Keying by
  format instead (`interchange.bpmn`) also means the C4 → mermaid chantier does
  not have to reopen this decision.
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
  export report records the substitution. Export stays pure — it reads this
  field, it never writes one.
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

### D4 — Geometry: BPMNDI wins at import, `xywh` wins at export

Stated flatly because the symmetric-sounding alternative is wrong in both
directions.

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

### D5 — Quarantine: the four cases where preservation ≠ re-emission

"Re-emit verbatim" is safe exactly while the carried fragment does not
contradict something Labre owns. The general rule:

> **A carried fragment is quarantined when re-emitting it would produce a
> document that contradicts the drawing.**

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

Everything above attaches a fragment to "the nearest mapped element". Some
fragments have no such element: `definitions`-level `extension` declarations,
unreferenced root elements (`message`, `signal`, `error`, `itemDefinition`,
`resource`), foreign attributes on `definitions` itself, and a whole carried
element that lived in a process no participant named.

These ride on **the pool that the file's first `participant` became**, in
document order. A file with no participant — a bare `process`, which is exactly
what a poolless Labre board exports as — has a pool minted for it, and that
pool carries `interchange.bpmn.element = 'process'`, which is what tells export
to write the poolless form back rather than inventing a collaboration the author
never drew.

The asymmetry, stated rather than discovered: **delete that pool and the file's
document-scope residue goes with it.** Accepted. It is one Y.Map value that
copy-pastes, undoes and syncs with an element the user can see, which is the
whole argument of D2; the alternative is the doc-level table D2 rejected; and an
architect who has deleted the only pool of an imported process has deleted the
process.

## What is knowingly lost, and what is merely invisible

The honesty table. "Invisible" is not "lost" — the distinction is the deliverable
of this ADR, and the import report must draw it in the same words.

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
- **Widening `BpmnNodeKind` to the Analytic set.** A separate product decision
  with its own toolbox, glyph and rule cost; carrying is what lets it be
  deferred without losing anything in the meantime.
- **Adopting foreign DI extensions.** bpmn.io's `bioc:` namespace and the OMG
  non-normative colour extension are the obvious candidates for a later
  chantier — mapping them onto `strokeColor` / `fillColor` would lift case 1 out
  of quarantine in both directions at once. Not v1.
- **Merge / re-import onto an existing board.** The seam is `interchange.bpmn.id`;
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
- **The import report becomes a product surface, not a log line.** Its three
  columns are exactly the three states of D1. Where it is shown is the import
  chantier's question (ADR 0011 is the obvious answer); that it must exist is
  this ADR's.
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
- **Integration**: import a two-pool Camunda file into a live editor and assert
  the drawn board, the lane bands and the report's three counts.

## Open questions

Genuinely open — each needs the import chantier to answer it, and none blocks
the decisions above.

1. **Is a payload size ceiling needed?** Nothing caps `interchange` in v1. A
   pathological file (generated BPMN, thousands of extension elements) would
   produce a document that is mostly foreign matter. A cap that drops data
   contradicts D2, so the only honest cap is a refusal at import time — which
   needs a number nobody has.
2. **Where the import report is shown**, and whether it is re-readable after the
   session that produced it. ADR 0011's editor-anchored panel is the obvious
   home; whether the report is persisted on the board is a separate call.
3. **Does an imported board stay unprofiled forever, or is the author prompted
   once?** The non-goal says import chooses nothing; it does not say the UI
   stays silent.
4. **Is merge / re-import wanted at all?** If yes, `interchange.bpmn.id` needs a
   uniqueness story across a document; if no, it is a record and nothing more.
