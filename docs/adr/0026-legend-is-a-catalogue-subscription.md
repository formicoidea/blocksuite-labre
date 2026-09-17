# ADR 0026 — A legend is a subscription to the catalogue

- Status: **accepted** (2026-09-17)
- Deciders: Mathieu Jolly
- Milestone: chantier « légende automatique généralisée » (PRs #368, #369,
  #370, #371, #372, #373)
- Related ADRs: [0008](0008-command-registry-foundation.md) (the command
  registry is the source; menus, shortcuts, palette and agent are
  projections), [0009](0009-reversed-flag-contract.md) (flags gate tooling,
  never content — amended below),
  [0013](0013-cynefin-framworks-carries-no-validation-rules.md) (a framework
  may ship no legend, and says so).

## Context

Six frameworks had an automatic legend and each one had written its own:
`legend.ts` beside the commands (C4 156 lines, EDGY 166, UML 273, Context Map
88, Event Storming 71, Core Domain 96), a button on the board's contextual
toolbar, and a copy of the same `track('FrameworkLegendCreated')` call. Wardley
had 946 lines that recognised what to describe by `instanceof` and by fill
colour, which is how a connector restyled red counted as an evolution arrow, a
rect tinted `#1f2328` as an inertia bar, and a market's three inner dots as
three components. BPMN had no legend at all and nothing recorded the absence.

Nothing connected a table to the commands beside it. A framework could gain an
artefact and not gain a row; a row could go on naming a role that had been
renamed out of existence. The seventh table was about to be written for BPMN
when the PO decided (2026-09-16) to generalise instead.

The catalogue already holds everything a row needs: which artefacts a framework
draws, in which order, under which category, and — inside `run` — which role
each one stamps.

## Decision

1. **A command subscribes its own row.** `CommandDescriptor.legend` carries one
   `CommandLegendEntry` or several: the role the row stands for, the swatch to
   draw (`dot`, `square`, `line`, `glyph`, `edge`, `custom`), and optionally its
   own wording, prefix or section. The command that puts the BOARD down carries
   `legendBox` instead: the box's title, width, row pitch, swatch size and the
   blocks that are not rows (a Wardley variant's gradient, its five-forces
   panel). Declared in `@labre/std` beside `CommandTelemetry`.
2. **The legend of a board is derived, never written.**
   `legendFromCommands(std, owner, present)` walks the owner's commands in
   `order`, keeps the rows whose role — or a role that specialises it, unless
   the entry asks for `exact` — is carried by an element inside the board's
   perimeter, files each row under its own declared `section` or else under the
   command's catalogue category, and drops the empty sections. Sections open in
   DECLARATION order, not in the order the first row happens to light: a legend
   is a key to a notation, so the same framework reads the same way on every
   board it describes. Rows are de-duplicated by role across the whole legend —
   two commands drawing the same role make one row.
3. **The platform lives in `blocks/surface`**, beside the validation engine and
   for the same reason: BPMN and Wardley must not take a dependency on a DDD
   bundle to document themselves. `extensions/legend.ts` holds the engine and
   the box, `extensions/legend-toolbar.ts` the button and the emitter.
4. **One button factory, one emitter.** `legendToolbarAction` builds the entry
   every framework's board toolbar shows — parameterised by the board model,
   the command owner and the telemetry key — and `trackLegendCreated` is the
   only place `FrameworkLegendCreated` is emitted. The wire values are
   unchanged: the framework's telemetry key, the element `legend`, the page
   `whiteboard editor`, the segment `element toolbar` and the module
   `<key> toolbar`. The module is a parameter rather than a derivation, because
   UML's historical value is `uml toolbox`.
5. **The legend stays a button and is never a command.** Generating one is
   about a board you have selected and about nothing else, so it is absent from
   the catalogue, the palette and Settings › Shortcuts (PO arbitration,
   2026-08-27). `toCommandManifestEntry` is an explicit list of sixteen fields,
   so `legend` and `legendBox` do not cross the host seam by construction.
6. **The button is flag-gated, everywhere.** Generating a legend is TOOLING: it
   lives in the framework's `custom:affine:surface:<board>` module, merged with
   the Validation dropdown because a flavour carries exactly one such module.
   The legend it wrote is CONTENT — native shapes and role-less framework nodes,
   painted by the always-on render extension — and keeps being painted with the
   flag off.
7. **A legend glyph never carries a role.** The swatch helper strips one a row
   might declare. A glyph with a role would list itself the next time a legend
   was generated, would be counted by every validation rule on the board, and
   would be written into the framework's export.
8. **Every role a command stamps has a row**, directly or through a
   specialisation, unless an exemption names it and gives a reason.

## Test coverage

`legend-subscription.unit.spec.ts` (`packages/affine/all`) is the generic
guard. No static field carries a role — it is stamped inside `run` — so the
check RUNS every `artefact` and `tool` command against `recordAction`'s
recording fake and reads back the props of what it created plus the options of
any tool it armed, which is where a typed connector's role lives. Both
directions are asserted: no stamped role without a row, and no row naming a
role the vocabulary does not declare. A third case pins that no swatch declares
a role.

The board's own command is excluded by construction (`telemetry.board`), and
`cynefin-estuarine` by ADR 0013. The named exemptions are the roles that are
not artefacts: the three tiers of a C4 label, the five of a UML one, EDGY's
facets frame, Wardley's pipeline handle and its beside-the-artefact label. A
variant needs no exemption (C4's `addMobile` stamps `c4:container`, which
`addContainer`'s row covers) and neither does a specialisation (EDGY's
twenty-two verbs are covered by `edgy:relation`). A control block runs the same
check on synthetic commands, so the suite cannot pass on an empty reading.

## Consequences

- **Five Legend buttons moved from always-on to flag-gated** (the three DDD
  frameworks, the two EDGY frames), joining C4's and Wardley's. A framework
  switched off shows neither Legend nor Validation on a stored board; the
  resize toggle, the lanes, the axis toggles and the exports stay, and a legend
  already drawn keeps being painted.
- **The BPMN export now filters by ROLE.** A legend glyph is a real `bpmnNode`
  with a real `kind`, so the old class-based filter would have written
  seventeen ghost `<task>` / `<startEvent>` / `<dataObject>` elements into the
  participant's process. `bpmnBoardFrom` keeps a node only when
  `model.role === BPMN_ROLE_OF_KIND[model.kind]`, the precedent being C4's
  `isC4Node`. Roles arrived on 2026-08-26 with nothing backfilled, so **a
  process drawn before that date is no longer exported**. The PO took the cost;
  the changeset says so. A `.bpmn` in and out is unaffected — the importer and
  the templates both build through `bpmnNodeProps`.
- **A Wardley map drawn before 2026-08-01 yields an empty box.** Detection is
  by role and those maps carry none; the "no backfill" promise `roles.ts` made
  already covered it. Three false positives disappear with the colour
  heuristics.
- **Wardley's legend reads differently.** The rows are the same, the glyphs,
  the gradient and the Porter panel are identical, but they now read in command
  order under `Nodes`, `Connectors` and `Areas` sub-titles, inside the shared
  box (title band 32, corner radius 8, label size 13) — so the box is taller.
  The PO signed it off rather than parameterise the box for one framework.
- **Two other readings follow the command order they are now derived from.**
  C4 lists Component before Database, and its Relations section before Frames;
  UML lists its elements in the order the sub-menu offers them.
- **Cynefin still has no legend**, by ADR 0013: the estuarine sheet names its
  own regions, and a key beside it would restate the drawing.
- **No i18n key moved.** A row's words come from its own `labelWording`, else
  from the role's, else from the command's; a section's from its own wording,
  else from the catalogue's `com.labre.catalogue.category.*`. Nothing new was
  minted and nothing was orphaned (`manifest.unit.spec.ts`).
- **A new framework writes no legend code at all.** It declares `legend` on the
  commands it already has and adds `legendToolbarAction` to the gated toolbar
  module it already has. There is no `legend.ts` to write, no button to build,
  no telemetry to emit — see
  [R6](../add-a-framework/02-framework-rules.md).
