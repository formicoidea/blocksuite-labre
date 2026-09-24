# Framework rules

**The rules every business framework obeys. Each one names the code that
enforces it, so you can check rather than trust.**

Where a rule is enforced by a test, the test is named. Where it is a
convention with no test yet, it says so.

## Tooling: the senior button and its menu

**R1. One senior button per framework, one icon, in descriptor order.**
`FRAMEWORK_DESCRIPTORS` in `packages/affine/all/src/frameworks.ts` carries
`iconKey`; the button's glyph is the 56×56 icon in `toolbar/icons.ts`. Row
order is the array order (`senior-row-order.unit.spec.ts`). `iconKey` is
non-empty, unique and registered in the framework's icon table
(`registry.unit.spec.ts`, "every framework declares its own senior icon key").

**R2. The sub-menu shows at most 13 artefacts plus "More artefacts…".**
`SENIOR_MENU_CAP = 14` and `SENIOR_MENU_RANKED_SLOTS = 13` in
`packages/framework/std/src/extension/command-registry.ts`; enforced by
`registry.unit.spec.ts`. Below the cap the whole authored row is shown with
no overflow entry. Which 13 is decided by recency (7) and frequency (6);
where each sits is the authored order.

**R3. A framework nominates at most 14 commands for the row** (the cap plus
the native-format import). Wardley alone is exempt from the nomination
budget, not from the rendered cap (ADR 0014, amended).

**R4. Eligibility is declared, never earned.** A command lists its
`surfaces` (`senior-menu`, `catalogue`, `palette`, `contextual-toolbar`,
`agent`). Usage ranking cannot pull a command into a surface it did not
declare. Every command is in the catalogue.

**R5. Import sits in the sub-menu, export on the board's contextual
toolbar.** A board comes _from_ a file; you export a board you already have.
BPMN, C4 and Wardley follow it (the OWM export is scoped to the selected
map's perimeter). That is about a framework's NATIVE format. The **SVG export
is generic** and needs nothing from a framework: one core command
(`export.svg`) and one wildcard toolbar module
(`custom:affine:surface:*#export-svg`) serve every board — see R34.

_One_ import per framework takes the sub-menu seat, not all of them: the
nomination budget is `SENIOR_MENU_CAP` per owner plus the single
over-nomination the PO authorized on 2026-08-28, which `bpmn.importXml` spent
(`registry.unit.spec.ts`). A framework that reads several formats nominates the
one a user is most likely to arrive with and leaves the rest in the catalogue —
BPMN nominates `.bpmn` and not its SVG fallback; UML nominates `uml.importXmi`
and leaves PlantUML and draw.io one click away, which cost `uml.addNote` its
seat (ADR [0019](../adr/0019-uml-import-formats.md) §7). A framework already at
the cap therefore arrives at a curation question, and records the trade where
the demoted entry is declared rather than settling it in a tranche.

**R6. The legend is SUBSCRIBED by the commands, and its button is gated**
(ADR [0026](../adr/0026-legend-is-a-catalogue-subscription.md)). A framework
writes no legend code: each command that draws an artefact declares its row
on `CommandDescriptor.legend` (the role, the swatch, optionally a section),
the board's command declares the box on `legendBox`, and
`legendFromCommands` (`blocks/surface/src/extensions/legend.ts`) derives what
the board actually shows — rows in command order, filtered by the roles drawn
inside the perimeter, under declared sections or the command's catalogue
category, in declaration order, one row per role.

The button is `legendToolbarAction(…)` in the framework's
`custom:affine:surface:<board>` module, merged with the Validation dropdown
(one `custom:` module per flavour). It is a BUTTON, never a command: absent
from catalogue, palette and shortcuts (product decision, 2026-08-27), which
`registry.unit.spec.ts` pins by the per-owner command counts and by
`not.toHaveProperty('legend')` on the manifest. It is gated because generating
a legend is tooling; the legend already drawn is content and keeps being
painted. `trackLegendCreated` is the single emitter of
`FrameworkLegendCreated`.

A board has **one** legend: the button REGENERATES, replacing the box it finds
inside the board's perimeter rather than stacking a second one at the same
pixel (issue #391, ADR 0026's 2026-09-23 amendment) — so hand retouching of the
box is lost on a second press, one Ctrl+Z brings it back, and a legend drawn
before the `core:legend` role shipped in 0.42 is not recognised. A framework
gets this from the factory and has nothing to declare for it.

Every role a command stamps is covered by a row, directly or through a
specialisation, unless an exemption names it and says why
(`legend-subscription.unit.spec.ts` in `packages/affine/all`, which RUNS the
commands to find the roles). Eight of nine frameworks have a legend; Cynefin
has none by ADR 0013, which is the exemption the same test reads.

**R7. Chords use the framework's prefix letter**, and only Wardley has
allocated one (`w`). A prefix must be unique and outside
`RESERVED_EDGELESS_KEYS` (`registry.unit.spec.ts`).

**R7b. An artefact command is PLACED, not run** (PO decision, 2026-09-16;
lettered rather than renumbered so the thirty references below stay valid).
Choosing a command of kind `artefact` — in the sub-menu, in the catalogue, or
with Enter on the keyboard highlight — arms `ArtefactPlacementTool`
(`packages/affine/widgets/edgeless-toolbar/src/placement/`) instead of running
it: a dashed ghost at the command's true footprint follows the cursor, Shift+S
cycles the armed artefact backwards along the owner's row, and the click on
the canvas is what runs the command. The action still creates at the viewport
centre — no framework code takes a point — and the tool moves what was created
by the offset between that centre and the click. Kind `tool` is unaffected: a
link tool, the evolution arrow and `wardley.addAreaPolygon` arm their own
gesture and run on the spot, as before. A framework needs no code for any of
this beyond its senior button naming its own owner
(`artefact-placement.unit.spec.ts`).

## Templates

**R8. The Templates category holds the worked examples and one entry per
artefact command.** Examples are hand-composed snapshots (`templates/maps.ts`
for Wardley); the rest is derived by `templateFromCommand`. Both populations
live in one flat category named after the framework
(`templates-parity.unit.spec.ts` in each framework). There is no
"prefab" or "example" type in the data model; the distinction is structural.

## Boards

**R9. A board is picked by its border**, a 10 screen-pixel band constant at
every zoom, plus its title bands (BPMN participant band, C4 title band, UML
frame heading band, UML partition band — on the top or left edge by
orientation — and UML region band). A board's inner zones follow the same
shape whatever the notation calls them: after the activity partition, UML's
second zone is the combined fragment's **operand band** — horizontal, separated
by a dashed line per §17.6.4.1, added from the fragment's toolbar as a lane is
added to a BPMN pool (ADR
[0022](../adr/0022-uml-sequence-diagrams-scope.md) §3).
`backgroundIncludesPoint` in
`packages/affine/model/src/elements/framework-background/hit-test.ts`;
`framework-background-hit-test.unit.spec.ts`. An already-selected board can
be dragged from anywhere inside (`ignoreTransparent: false`). Double-click in
a label zone edits the label. A marquee takes a board only when it holds the
whole board (`boxSelectable`, the native frame block's rule): a rectangle drawn
on the sheet lassoes what is drawn there, never the sheet.

**R37. A board's border sits ON its drawing.** R9 makes the border the only
thing a board is caught by, so every model unit between the ink and the `xywh`
is a unit of nowhere: invisible, unselectable, and exported as blank by R34. A
board therefore claims no room it does not paint. For a DECLARED background,
that is `geometry.margin`: each margin is the reach of the furniture it hosts —
an arrowhead tip is the plot edge, an end label overhangs it by half its
advance, a rotated axis title reaches in by its ASCENT and never by its length —
measured, never rounded up (`gfx/ddd-core-domain/src/core-domain/background.ts`;
`background.unit.spec.ts` → "the frame sits on the drawing"). For a framework
that fits an AUTHORED artwork, it is the crop box it fits, whose allowances are
measured per side because words are not symmetric
(`gfx/edgy/src/consts.ts`, `facets-crop.unit.spec.ts`). The fit itself is one
function, `refScale` in
`packages/affine/blocks/surface/src/framework-background/fit.ts` — a uniform,
centred letterbox, shared by every framework that reproduces a drawing.

A uniform fit letterboxes as soon as the user drags the board off the artwork's
proportion, and no margin can help with that: the board is then cropped back
onto its drawing when the resize handle is LET GO
(`gfx/cynefin-estuarine/src/cynefin/crop.ts`, `cynefin-crop.unit.spec.ts`). The
crop belongs to the gesture — `handleResize`'s `onResizeEnd`, before the
manager commits the stashed `xywh`, so a resize and its crop are one write and
one undo step. Never a cascade on `xywh`: that would re-crop, on every peer's
screen, a board nobody on that screen touched (principle 4, the `local` guard).

**R10. A board is a floor, never a lid.** Anything overlapping a board is
kept above it; boards can stack and each stays under its own artefacts — but a
board that wholly ENCLOSES another board is the sheet that one is drawn on and
stays under it, so a frame holding inner backgrounds (UML subject, partition,
region, fragment; C4 boundary) is not raised over them when it is moved or
resized.
Framework-agnostic, idempotent (undo-safe), ignores remote changes, never
restacks nested elements.
`packages/affine/blocks/surface/src/framework-background/stacking.ts`;
`stacking.unit.spec.ts`. Always registered.

**R11. A board is not a container.** Membership is computed at read time:
whole containment for the board, centre point for inner regions (zones,
lanes). Ties go to the smaller id. Nothing moves with a board.
`framework-background/facts.ts`.

**R12. A board is never a connector endpoint** (`connectable = false`) and
never frame content.

**R13. Resize is a per-board toggle** (`resizeEnabled`) exposed on its
toolbar. No minimum size is enforced; C4 — and the UML frame — clamps a board
shorter than its header instead.

**R14. Extend `FrameworkBackgroundElementModel`; never copy its overrides.**
Boards that re-implemented them were skipped by `instanceof` and dropped
elements sank (PR #231). The same holds on the VIEW side: extend
`DeclaredBackgroundView` — or `FrameworkBackgroundView` when the board paints
its words without a declaration — from
`packages/affine/blocks/surface/src/framework-background/background-view.ts`,
and say only WHERE the labels are. Copying the in-place `<input>` instead is
how four boards ended up with no double-click rename at all (issue #355); the
gesture is pinned once, in `framework-background-view.unit.spec.ts`. Every
board extends it, UML's five frames included. A label whose target no
`{ [prop]: value }` patch can express (a UML fragment's operand guard, kept
inside an array) returns its own `commit` from `labelAt`; it never copies the
editor.

**R34. Every board exports as SVG**, and gets it for free. "Export SVG" sits in
the "⋮" of every board's contextual toolbar — one core command `export.svg`
(`packages/affine/blocks/surface/src/extensions/export-svg/command.ts`) and one
wildcard module `custom:affine:surface:*#export-svg` (`…/export-svg/toolbar.ts`),
both keyed on `FrameworkBackgroundElementModel` and neither naming a framework
(ADR 0025). A framework contributes nothing; what it must not do is draw its
board as anything other than a `FrameworkBackgroundElementModel` (R14). A
frame nested wholly inside the exported board (a UML partition, a C4 boundary)
is part of its picture; a board that only overlaps it is not. The file is drawn
by svgcanvas 2.6.0, so a renderer sticks to the 2D calls it implements:
`isPointInPath`/`isPointInStroke` are absent, and `getLineDash` exists only as
the export's shim — scope a dash with `save`/`restore` rather than reading it
back (ADR 0025, amendment of 2026-09-17).
`export-svg-boards.unit.spec.ts` names every framework's board class and checks
the entry lights up for each; `board-svg-export.spec.ts` (integration) renders
one board of every kind and parses the result. Numbered R34 — the file's numbers
are allocated in order of creation, not by section, and existing rules are never
renumbered.

## Artefacts

**R15. An artefact is a native shape with a discriminator**, or a group of
native elements. `WardleyNodeElementModel extends ShapeElementModel` with a
`kind` field; a pipeline, a market, a C4 node are groups of shape, text and
connectors built by `actions.ts`. So an artefact inherits move, resize,
colour, anchors and the shape toolbar. The group is the unit of identity:
morphs are registered on `GroupElementModel`.

**R16. A gravitating label is a free-text element grouped with the shape,
never text on the shape.** Whether a symbol's label gravitates or is inscribed
is decided by R38, on the symbol's size alone; R16 governs how a gravitating
label is built. The preset refuses to write `text`; the label has its own role
(`wardley:label`, `bpmn:label`, kind `text`) and is a native group member of
the symbol. Three declared exceptions: the Porter glyph's letter, an area's
name, and a connector's labels — the centre `text` and the two end labels of
ADR 0020 are fields of the connector, because a label that must follow a moving
endpoint cannot be a sibling in a group. Amended 2026-09-24 (ADR
[0029](../adr/0029-label-mode-by-symbol-size.md)): the rule used to read as
"every label is free text"; a label that fits its symbol is now inscribed.

**R17. One preset per artefact**, in `presets.ts`, read by creation and by
morph. Creation sites and morphs never restate sizes or fonts.

**R38. A label is inscribed only if it fits; otherwise it gravitates.** A
catalogue symbol carries its name one of two ways: INSCRIBED, as the shape's
own `text`, or GRAVITATING, as a free text element grouped with the symbol
(R16). The only criterion is the symbol's size: if a normal-size text (18 model
units) of two five-letter words does not fit legibly inside the shape at its
canonical creation size, without enlarging it, the label gravitates. The test
is arithmetic, `fitsInscribedLabel({ w, h, shapeType })` in
`packages/affine/shared/src/utils/label-mode.ts`: the inner box is the shape
minus the native text insets (10 vertical, 20 horizontal), reduced to its
inscribed rectangle (×0.7 per side for an ellipse, ×0.5 for a diamond, ×1 for a
rect or polygon); the probe "Hello World" fits on one line (11 × 0.5 × 18 wide,
1.2 × 18 high) or on two (5 × 0.5 × 18 wide, 2 × 1.2 × 18 high). The 18 is the
reference size of the test, not a mandate: a framework keeps its own label
size. The rule forbids inscribing a text that does not fit; it does not forbid
placing a separate text inside a silhouette that holds it (C4, UML, the Context
Map cloud comply). The test never enlarges the symbol: a canonical size is a
product decision (the BPMN activities' 1.5× of 2026-09-24 was one), and the
label mode follows from it, never the other way round. Enforced by
`label-mode.unit.spec.ts` in `gfx/bpmn` (every kind of `NODE_SIZE` checked
against `bpmnLabelMode`), the arithmetic by `label-mode.unit.spec.ts` in
`affine/shared`; a framework that adopts the rule adds the same per-kind spec.
Two recorded deviations, each with a Backlog ticket: Wardley `porter` (a
60-unit ellipse whose inscribed letter IS the notation) and DDD Event Storming
`hotspot` (a 120-unit diamond whose `Contained` fit shrinks the font). ADR
[0029](../adr/0029-label-mode-by-symbol-size.md).

## Semantics

**R18. Roles are namespaced `<framework>:<local>`**, kebab-case, with a
`kind` of `node`, `edge` or `text`, an optional `parent` for `roleIsA`, and
for edges a `direction` (verb, gesture hint). One `RoleDefs` table per
framework, built with `Object.create(null)`, registered **always on**
through `RoleVocabularyExtension`. Tested per framework
(`roles.unit.spec.ts`).

**R19. Natures are a separate level-3 axis** (`natures.ts`, ADR 0007),
shipped through `UniverseTagDefsExtension` from the gated extension.

**R20. The persisted direction of a typed edge is semantic**: source is the
subject of the role's verb, target the object (ADR 0010). Preserve it through
every transform.

## Validation

**R21. Nothing blocks.** Severities are `warning` (shown) and `audit`
(audit panel only). `blocking-overridable` exists in the type and is used by
nobody. The default profile is the most permissive and writes nothing on the
element. Changing profile leaves granted exceptions alone.

**The strict profile IS the check-up** (PO, 2026-09-16): a level that NAMES a
rule at a drawn severity puts it on the drawing path, `moment: 'on-demand'`
included, so its findings appear on the canvas on the switch and on every edit
afterwards. A rule nothing promotes keeps its declared moment and is reached
only by `runCheckup`. A rule too costly for the gesture path therefore stays
`audit` at EVERY level — that is the only way to keep it off, and it is what
`uml.unreachable-*` does.

**R22. Rules run only when a board of the framework exists on the surface.**
A lone node is a sketch. A node beside a map _is_ judged and attributed to
the nearest map: that is the "element outside its board" finding. Rules
match roles, never shape types (`backgroundRole` through `roleIsA`).
Known gap: a rule names **one** `appliesTo` role, so a framework whose
vocabulary has no single "any artefact" role cannot cover all of it — UML's
`element-outside-frame` and `composition-single-owner` apply to
`uml:classifier` only, and an actor, use case, object, package or note beside
the frame is silence (`gfx/uml/src/rules.ts` docblock). It closes the day a
family accepts several subject roles.

**R23. A rule family declares its dependency scope** (`RULE_SCOPES`, ADR
0015). A rule may widen it, never narrow it. A new family without a scope
line fails to compile. Seventeen families today, and the last two are the only
ones the engine grew for a framework rather than the other way round.

The sixteenth is `label-syntax` (ADR 0021), the only one whose verdict is a
FUNCTION the framework ships rather than a table the engine interprets — a
notation's grammar is a parser, and `gfx/uml/src/grammar.ts` is already that
parser for the exporters. It is `'element'`-scoped (the subject's own words),
judges each non-blank, non-elided line unless `perLine: false`, and a rule of it
is not serializable: a declaration whose `parse` is missing evaluates nothing
and warns once.

The seventeenth is `border-proximity` (ADR 0024), the only one whose frame of
reference is another ARTEFACT's outline rather than the sheet: the subject's
CENTRE must sit within a declared tolerance, in model units, of the perimeter of
a carrier `node` role it overlaps. Overlap is the gate — a subject touching no
carrier raises nothing, so the family judges a glyph the author has already put
on a box and never one dropped on open canvas. One finding per subject, both ids
indicted, measured against the nearest carrier. `'surface'`-scoped for
`attachment`'s reason: the carriers are collected from the whole surface and
bounded by no frame. A carrier that is not a `node` role, or a tolerance of
zero, evaluates nothing and warns once.

**R24. Rules, profiles, nudges, reading, interchange, audit criteria are
tooling**: registered from the flag-gated extension. Flag off means no
finding; persisted profile ids and ticks stay written, unread.

**R25. A framework may ship no rules, by decision.** Cynefin/Estuarine (ADR
0013). Reading is not validation: every framework ships a reading profile
(`reading-coverage.unit.spec.ts`).

A profile reads AS MANY typed edges as the notation draws — `relation` is the
one it is read through first, `alsoRelations` the rest — and no two of its
tables may answer for one edge (`roleIsA` overlap; checked by
`reading-coverage.unit.spec.ts`). One table per profile was the original
contract and the PO's UML recette of 2026-09-14 retired it: the panel says
"No typed link touches this component" both when a framework declined to read a
line and when it could not, so a use case whose one link was an `«include»`
read as unconnected. Each table names its own two wordings; the panel groups by
table, and a connector's per-end labels (ADR 0020 — a UML multiplicity) ride
with the far end's name.

**R26. The validation of a 500-element map fits in one 16 ms frame**, asserted
by `validation.bench.unit.spec.ts`; flag-off costs under 0.05 ms.

## Interchange

**R27. A capability is `framework:format:direction`**, registered from the
gated extension, with a `run` that is a pure function of elements and text.
Importers return serialized props, not live models. Unknown data rides on the
element under `interchange[formatId]`. Ids that lie or collide are refused at
boot (ADR 0012).

## Identity and telemetry

**R28. One identity, spelled once.** `FrameworkId` equals the flag key,
the command owner and the descriptor id. `telemetryKey` keeps the historical
wire value and is frozen (`registry.unit.spec.ts`).

**R29. Command telemetry is emitted by `runCommand`** from the descriptor's
`telemetry` field (`command-telemetry.ts`). Nothing emits in `actions.ts`.
The board-placing command declares `board: true` (`board-role.unit.spec.ts`).
Arming an artefact (R7b) is not an invocation: it emits nothing and records no
usage, exactly as picking a shape variant does. The emission happens when the
artefact LANDS, through the same `runCommand`, so a framework's numbers are
what they were — a user who arms one and changes their mind has not used it.

**R30. Every user-visible string is a `com.labre.*` key** derived in
`translations.ts` from the declarations, so the published framework bundle
is not silently short of keys (`manifest.unit.spec.ts`). That includes seeds,
the text a creation action writes into the document: they are resolved at
placement, never by changing a model default. A new displayed literal with no
key fails `literals.unit.spec.ts` (ADR 0023) — including the values of a seed
table keyed by KIND (`UML_NAME_SEED`, `NODE_LABEL`), which that guard reads as
its own pattern since a table keyed by kind carries no prose-shaped property
name for the others to match.

## Packaging

**R31. `frameworks.ts` is data-only** (type-only imports, no Lit) because the
bundle build script reads it.

**R32. The package exports `.` (headless data), `./view` (the two
providers) and `./commands-manifest` (a few hundred bytes for a settings
pane).** `private: true`, `sideEffects: false`.

## Colour

**R33. Neutrals come from one scale; hues stay per framework.** Inks, greys,
borders and the card fill (board strips included: no tinted bands) are read from
`NOTATION_NEUTRALS` (`@labre/affine-shared/consts`), whose values are
Wardley's. A framework's `consts.ts` names them (`NODE_STROKE =
NOTATION_NEUTRALS.ink`) rather than restating a hex, and previews, toolbar
glyphs and templates interpolate those names too. Exceptions are neutrals
borrowed from an official source (stencil exceptions: the C4 stencil's
`#444444`, the EDGY stencil ink `#262626` of its base-shape pictograms, the
Cynefin and Estuarine SVGs, the EDGY facet picto) and greys that carry a
meaning. A creation default is copied into the element, so changing the scale
repaints render-time chrome only: code that recognises an element by its stored
colour must keep accepting the value older documents carry. **A colour used to
recognise a stored element stays a literal and is never derived from the
scale** (Wardley's `INERTIA_COLOR`, `LINK_GREY`, `WARDLEY_RED`): a change of
ink would otherwise orphan every element already drawn with it. Pinned by
`notation.unit.spec.ts` (affine-shared) and an assertion in every module that
reads the scale (its background, consts, legend or template spec).

**R36. A framework with its own hues registers them from its FLAG-GATED view
extension.** One `FrameworkPaletteExtension({ framework, labelWording,
palettes })` in `…ViewExtension.setup()`, beside the senior tool, carrying the
module's existing `*_PALETTE_LIST` and the framework's existing
`com.labre.framework.*` wording — nothing is restated. Every contextual colour
picker on the canvas then offers that page in its carousel, opening on it for
elements whose origin is the framework (its role's namespace, else a
connector's two ends, else the smallest board containing it). Offering hues is
tooling: with the flag off the page disappears and every colour already stored
stays (ADR [0009](../adr/0009-reversed-flag-contract.md),
[0027](../adr/0027-framework-palettes-carousel.md)). A framework whose colours
come from an official SVG registers nothing. Enforced by
`framework-palettes-gating.unit.spec.ts` (`packages/affine/all`), which pins
the palettes present with the flags on and their absence with them off.

## Identity: one framework is one drawing

**R35. A framework is one drawing.** Split into several frameworks when the
boards are distinct sheets with disjoint vocabularies that never mix on one
surface: DDD is event storming, core domain chart and context map — three
boards, three buttons, three flags. Keep one framework when the notations share
one frame and one sheet, and an artefact of one has a meaning when dropped on
the board of the other: UML draws classes, use cases and activities under one
`<kind> <name>` heading, so it is one framework and the kind is a field of the
board. Admissibility ("a use case has no place on a class diagram") is then a
`view-admissibility` rule, not a second framework. Practical test: "can I drop
an artefact of A on a board of B and have it mean something?" Yes → one
framework. Convention, no test enforces it (ADR 0017).

Next: [03-anatomy.md](03-anatomy.md).
