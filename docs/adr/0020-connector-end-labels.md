# ADR 0020 — A connector carries three labels: a centre and two ends

- Status: **accepted** (2026-09-15)
- Deciders: Mathieu Jolly
- Milestone: UML 2.5.1, tranche H
- Supersedes: [0018](0018-connector-per-end-labels-deferred.md) (per-end labels
  deferred), whose phase 2 this executes.
- Related ADRs:
  [0012](0012-framework-interchange-and-foreign-preservation.md) (what an
  exporter may promise per framework and format),
  [0016](0016-hollow-endpoint-styles.md) (the precedent for widening an element
  every framework persists),
  [0017](0017-uml-one-framework-with-diagram-kinds.md) §6 (which forwarded the
  question to 0018).

## Context

ADR 0018 wrote the argument and deferred the change: UML puts a multiplicity and
a role name at an association's **ENDS**, the connector element carries exactly
**one** label, and widening an element every framework in the library persists
is the red zone (`CLAUDE.md`). Phase 1 shipped the centre label as the
association's name and left multiplicities as free text the author places.

The demand arrived with the rest of the UML pack: the exporters have nowhere to
read a multiplicity from (0018's own consequence: "PlantUML and XMI export
carries no multiplicities until phase 2"), the importers have nowhere to write
one, and a free-text element beside an end does not follow that end when the
node moves — which is the whole value of an end label.

0018 also fixed the shape of the answer in advance. This ADR executes it, with
one correction to its §"Phase 2" sketch.

## Decision

### Four FLAT optional fields, not two nested records

0018 proposed "a small record of the same parts the centre label has". It is
four flat fields instead:

```ts
@field() accessor sourceLabel: Y.Text | undefined = undefined;
@field() accessor sourceLabelXYWH: XYWH | undefined = undefined;
@field() accessor targetLabel: Y.Text | undefined = undefined;
@field() accessor targetLabelXYWH: XYWH | undefined = undefined;
```

The reason is **observation**, and it is not a style preference. The bridge that
turns typing into a repaint is `watchText` inside `syncElementFromY`
(`packages/framework/std/src/gfx/model/surface/element-model.ts`): it walks the
element's own `Y.Map` and subscribes to every **top-level** value that is
`instanceof Y.Text`. That is where the centre `text` gets its observation, and
the only place — `text` carries no `@observe` decorator, because it does not
need one.

A `Y.Text` nested inside a `Y.Map` inside the element would be invisible to that
walk. It would have needed an `@observe` bridge written specially for it: a
second mechanism for the one thing the centre label already does, on the code
path where getting it wrong means a peer sees a stale multiplicity and nobody
notices until a review. Four flat keys buy the same observation, for free, on
the same line of the same function.

The two end labels reuse the connector's **`labelStyle` and
`labelConstraints`** — one font, one colour, one size per connector. No new
persisted style fields: three captions in three fonts is not a diagram anyone
asked for.

### `undefined` means ABSENT, so there is no migration

`@field()` deliberately does not write an `undefined` default into the Y.Map
(see its `init`). A connector with no end label therefore stores exactly the
keys it stored before this ADR — pinned as an explicit key list in
`packages/affine/model/src/__tests__/connector-end-labels.unit.spec.ts`, so a
future field that starts writing a default shows up as a failing test rather
than as a document that an older build reads differently.

A document written after this ADR opens on an older build as a connector with a
centre label and two keys it ignores; ADR 0012's preservation rule covers the
round trip.

### An end label follows ITS endpoint

The centre label is re-derived from `labelOffset.distance` on every re-route: it
rides the middle of the path. An end label must not be, and must not be
translated by the connector's own delta either — dragging one of the two nodes
moves one end and leaves the other exactly where it was, so both of those rules
slide the far label off the line it annotates.

`ConnectorPathGenerator.updatePath` therefore translates each end box by **how
far that end's endpoint travelled**, which is also the only rule that preserves
a box the author dragged somewhere else. `moveTo` — the whole connector being
dragged — translates all three boxes by the same offset, because there both
endpoints move together. Both writes sit behind the same `persistLabelXYWH` /
readonly gate the centre box already had: these are `@field()`s, so a peer that
merely watches a connector move must not write them.

Where a label has no box yet, one pure helper answers for everyone:

```ts
connectorEndLabelBox(path, end, size, distance = 12): XYWH
```

in `packages/affine/model/src/elements/connector/end-label.ts` — anchored
`distance` units along the path from that endpoint and pushed off the line by
half its own height, with the tangent taken in the source → target orientation
at both ends so the two labels sit on the SAME side. The editor seeding a new
label, the renderer painting one and any future hit test all get the same
answer without reimplementing it.

### Rendering is three boxes, not one

`renderLabel` takes a label (`text`, `xywh`, `style`, `constraints`) instead of
the connector, and is called once per present caption. The line's `evenodd` clip
gains **one subtracted rect per label**, so a multiplicity punches the stroke
exactly as the centre name always has. The DOM twin keeps three retained
`<div>`s, keyed `center` / `source` / `target`, and drops the node of a caption
that goes away.

### One editor, one `which`

`mountConnectorLabelEditor` gains a `'center' | 'source' | 'target'` selector,
and its two byte-alike copies are unified first — shipping the selector on one
of them would give a connector whose end labels are editable from the toolbar
but not from a double-click. `endLabelEditing` is `@local()`, the end twin of
`labelEditing`: which label this client has open is a property of the editing
session, not of the document, and mounting an editor on one end must not blank
the other two.

## Alternatives rejected

Both alternatives 0018 rejected stand, and for its reasons: **texts grouped with
the connector** (a group's members keep their own `xywh`, so the multiplicity
drifts away from the end when the node moves) and **a second connector element
type** (it duplicates the routing engine, the binding logic and the toolbar for
one framework).

One more, specific to phase 2:

- **A `labelOffset`-style `{ distance, anchor }` per end** instead of a stored
  box. Rejected: it makes an end label unplaceable by hand — every re-route
  would snap it back to the computed anchor — and it adds two more persisted
  fields to buy a default that `connectorEndLabelBox` already computes from the
  path for free.

## Consequences

- **Older clients ignore the fields.** They paint the centre label, ignore two
  keys, and write the document back with them intact (ADR 0012). Nothing they
  can do makes a document this build cannot read.
- **The exporters can read them.** PlantUML writes `A "1" -- "0..*" B`, XMI
  writes `lowerValue` / `upperValue` and the role `name` on each `ownedEnd`, and
  the importers write the fields instead of carrying end text under
  `interchange.*`. 0018's consequence "no multiplicities until phase 2" is
  closed by this ADR.
- **Rules may now judge an end label**, where 0018 said explicitly that none
  could. The UML rule set's silence about a missing multiplicity is a product
  decision now, not a mechanical limit; a rule that fires on end-label syntax is
  a `label-syntax` family member and carries its own ADR.
- **Three captions can now overlap on a short connector.** A path shorter than
  the anchor distance puts both default boxes at its far endpoint, which is
  honest about there being no room rather than pretending there is; the author
  moves the nodes apart or drags the boxes.

## Amendments

**2026-09-15 (tranche J, recette PO).** A connector that carries a framework
`role` claims two `CONNECTOR_END_LABEL_GRAB` discs beside its endpoints in
`includesPoint`, each stopping at the box of the element — canvas element or
block — that end is bound to, so a double-click beside an arrowhead reaches the
end label instead of the editor's add-text-here handler; a connector with no
role keeps the hairline hit test it has always had.
