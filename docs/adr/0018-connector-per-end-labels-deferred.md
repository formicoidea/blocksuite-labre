# ADR 0018 — Per-end connector labels are deferred; phase 1 uses free text

- Status: **accepted** (September 2026)
- Deciders: Mathieu Jolly
- Milestone: UML 2.5.1, tranche D
- Related ADRs:
  [0012](0012-framework-interchange-and-foreign-preservation.md) (what an
  exporter may promise per framework and format),
  [0016](0016-hollow-endpoint-styles.md) (the other connector change UML asked
  for, and the precedent for widening a shared element),
  [0017](0017-uml-one-framework-with-diagram-kinds.md) §6, which forwards this
  question here.

## Context

UML writes an association's **multiplicity and role name at its ENDS**, not at
its middle. 2.5.1 §11.5.4 (p. 201) is explicit: the multiplicity of a property
shown as an association end is written **without brackets**, beside that end,
next to the role name — `1`, `0..1`, `*`, `1..*`, `-owner 1`. The association's
own name, when it has one, sits at the middle. So a fully adorned association
carries up to **three** pieces of text, in three places, and only the middle one
is the association's name.

The connector element carries **exactly one label**, and every part of the stack
is built around that singularity:

- the model — `ConnectorLabelProps` in
  `packages/affine/model/src/elements/connector/connector.ts` (l. 71-80) is one
  `text?: Y.Text` plus the five fields that place and paint it: `labelXYWH`
  (l. 503-504, `XYWH | undefined`, no default), `labelOffset` (l. 480-484,
  `{ distance: 0.5, anchor: Center }` — one distance along the path),
  `labelStyle` (l. 489-497), `labelConstraints` (l. 465-469) and `labelDisplay`
  (l. 474-475). `labelEditing` (l. 509-510) is `@local()`; the rest are
  `@field()`, i.e. persisted. `hasLabel()` (l. 299-307) is a single boolean over
  that one set, and `elementBound` (l. 119-120), `labelIncludesPoint` (l. 343)
  and the move handler (l. 371-374) each read `labelXYWH!` once.
- the renderer — `renderLabel` in
  `packages/affine/gfx/connector/src/element-renderer/index.ts` (l. 241-259) is
  called from exactly **one** site (l. 111-120), after a single clip rect
  punched out of the line at l. 71-75 so the stroke does not run under the text.
- the editor — `mountConnectorLabelEditor` in
  `packages/affine/gfx/connector/src/text/edgeless-connector-label-editor.ts`
  (l. 31-71) seeds `text` / `labelXYWH` / `labelOffset` when they are missing and
  mounts one `EdgelessConnectorLabelEditor` bound to the connector; the
  double-click path in `view/view.ts` (l. 50-60) has no notion of _which_ label
  was hit, because there is only one.

Nothing here is UML-specific, and nothing here is wrong. It is a connector with
a caption, which is what every other framework in this library needs.

## Decision

### Phase 1: the centre label carries the name, the ends are free text

The single label carries the thing UML puts in the middle:

- the **association name** (`owns`, `manages`);
- a **«stereotype»** on any typed edge;
- the **`«include»` / `«extend»` keyword** on a use-case dependency.

Multiplicities and role names are **free text elements the author places** beside
the end — the level-1 free surface this editor has always had, the same
mechanism a reader already uses for an annotation the notation does not model.
They are not grouped with the connector, not owned by it, and not produced by any
UML command.

This is a deliberate floor, not a gap left open. A multiplicity is written on a
minority of the associations an architect actually draws on a whiteboard, and the
cost of the alternative is a schema change to an element every framework in the
library persists.

### Phase 2: two optional fields, in their own PR

When the demand justifies the red zone, the shape is already known:

1. **Model** — `sourceLabel?` / `targetLabel?` on `ConnectorLabelProps`, each a
   small record of the same parts the centre label has (`text`, `xywh`,
   `offset`, `style`). Both **default to `undefined`**, so no stored connector
   changes and **there is no migration**: a document written before phase 2
   deserialises with two absent fields, and a document written after it opens on
   an older build as a connector with a centre label and two ignored keys
   (ADR 0012's preservation rule covers the round trip).
2. **Renderer** — a third and fourth `renderLabel` call site, each with **its own
   clip rect** added to the `evenodd` path at l. 71-75, so an end label punches
   the line the way the centre one does.
3. **Editor** — `mountConnectorLabelEditor` gains a **selector** (`'center'`,
   `'source'`, `'target'`) chosen from the hit point, since a double-click can
   now land on three boxes.
4. **Exports** — the PlantUML and XMI writers read the two new fields and emit
   real multiplicities; until then they emit none.

That is a **schema change to an existing element model — the red zone**
(`CLAUDE.md`). It gets its own PR, its own review and its own ADR amendment, and
it is not smuggled in beside a framework pack.

## Alternatives rejected

- **Texts grouped with the connector.** A `GroupElementModel` holding the
  connector and two text elements, the way an artefact groups its label (R16).
  Rejected: a group's members keep their own `xywh`. When a node moves, the
  connector re-routes and the texts stay where they were — the multiplicity
  drifts away from the end it belongs to. The whole value of an end label is
  that it follows the end.
- **A second connector element type** carrying three labels. Rejected: it
  duplicates the routing engine, the binding logic, the endpoint styles and the
  toolbar, for one framework, and splits every consumer that switches on
  `connector`.
- **Auto-seeding the centre label with `«include»` / `«extend»`.** Tempting,
  since those two keywords are not optional in the notation. Rejected for phase
  1: the connector tool **arms a style, not a text** — a framework's edge action
  writes `role`, `stroke*` and the two endpoint styles, and there is no seam for
  handing the tool a label to write when the connector is completed. Adding one
  is an engine change, and it is deferred with this decision rather than bolted
  onto the UML pack.

## Consequences

- **No rule judges an end label in phase 1.** The UML rule set reads roles,
  endpoints and placement only — consistent with ADR 0017 §4, which already says
  the engine judges a drawing and not a model. In particular no rule fires on an
  association that carries no multiplicity, and `rules.unit.spec.ts` asserts that
  silence explicitly, so a later phase cannot quietly start scolding old
  diagrams.
- **PlantUML and XMI export carries no multiplicities until phase 2.** An export
  round trip is lossless for what the model holds and silent about what it does
  not; a free-text multiplicity beside an end is exported as what it is, a text
  element.
- **The catalogue and the worked examples show multiplicities as free text**, so
  the shipped examples are honest about the mechanism rather than implying a
  field that does not exist.
- **A coverage audit reporting "UML associations have no multiplicity field" is
  closed against this ADR**, and reopened only by the phase-2 PR.
