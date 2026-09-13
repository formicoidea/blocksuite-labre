# Framework rules

**The rules every business framework obeys. Each one names the code that
enforces it, so you can check rather than trust.**

Where a rule is enforced by a test, the test is named. Where it is a
convention with no test yet, it says so.

## Tooling: the senior button and its menu

**R1. One senior button per framework, one icon, in descriptor order.**
`FRAMEWORK_DESCRIPTORS` in `packages/affine/all/src/frameworks.ts` carries
`iconKey`; the button's glyph is the 56×56 icon in `toolbar/icons.ts`. Row
order is the array order (`senior-row-order.unit.spec.ts`). No test checks
icon uniqueness across frameworks yet.

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
BPMN and C4 follow it; **Wardley's OWM export currently declares no
`contextual-toolbar` surface**, which is a deviation to fix, not a precedent.

**R6. The legend is a button on the selected board's toolbar**, not a
command: absent from catalogue, palette and shortcuts (product decision,
2026-08-27). It emits `FrameworkLegendCreated` by hand. Six of eight
frameworks have one; Cynefin does not by ADR 0013; BPMN's absence is
undocumented.

**R7. Chords use the framework's prefix letter**, and only Wardley has
allocated one (`w`). A prefix must be unique and outside
`RESERVED_EDGELESS_KEYS` (`registry.unit.spec.ts`).

## Templates

**R8. The Templates category holds the worked examples and one entry per
artefact command.** Examples are hand-composed snapshots (`templates/maps.ts`
for Wardley); the rest is derived by `templateFromCommand`. Both populations
live in one flat category named after the framework
(`templates-parity.unit.spec.ts` in each framework). There is no
"prefab" or "example" type in the data model; the distinction is structural.

## Boards

**R9. A board is picked by its border**, a 10 screen-pixel band constant at
every zoom, plus its title bands (BPMN participant band, C4 title band).
`backgroundIncludesPoint` in
`packages/affine/model/src/elements/framework-background/hit-test.ts`;
`framework-background-hit-test.unit.spec.ts`. An already-selected board can
be dragged from anywhere inside (`ignoreTransparent: false`). Double-click in
a label zone edits the label.

**R10. A board is a floor, never a lid.** Anything overlapping a board is
kept above it; boards can stack and each stays under its own artefacts.
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
toolbar. No minimum size is enforced; C4 clamps a board shorter than its
header instead.

**R14. Extend `FrameworkBackgroundElementModel`; never copy its overrides.**
Boards that re-implemented them were skipped by `instanceof` and dropped
elements sank (PR #231).

## Artefacts

**R15. An artefact is a native shape with a discriminator**, or a group of
native elements. `WardleyNodeElementModel extends ShapeElementModel` with a
`kind` field; a pipeline, a market, a C4 node are groups of shape, text and
connectors built by `actions.ts`. So an artefact inherits move, resize,
colour, anchors and the shape toolbar. The group is the unit of identity:
morphs are registered on `GroupElementModel`.

**R16. Labels are free-text elements grouped with the shape, never text on
the shape.** The preset refuses to write `text`; the label has its own role
(`wardley:label`, kind `text`). Two declared exceptions: the Porter glyph's
letter and an area's name.

**R17. One preset per artefact**, in `presets.ts`, read by creation and by
morph. Creation sites and morphs never restate sizes or fonts.

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

**R22. Rules run only when a board of the framework exists on the surface.**
A lone node is a sketch. A node beside a map _is_ judged and attributed to
the nearest map: that is the "element outside its board" finding. Rules
match roles, never shape types (`backgroundRole` through `roleIsA`).

**R23. A rule family declares its dependency scope** (`RULE_SCOPES`, ADR
0015). A rule may widen it, never narrow it. A new family without a scope
line fails to compile.

**R24. Rules, profiles, nudges, reading, interchange, audit criteria are
tooling**: registered from the flag-gated extension. Flag off means no
finding; persisted profile ids and ticks stay written, unread.

**R25. A framework may ship no rules, by decision.** Cynefin/Estuarine (ADR
0013). Reading is not validation: every framework ships a reading profile
(`reading-coverage.unit.spec.ts`).

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

**R30. Every user-visible string is a `com.labre.*` key** derived in
`translations.ts` from the declarations, so the published framework bundle
is not silently short of keys (`manifest.unit.spec.ts`). That includes seeds,
the text a creation action writes into the document: they are resolved at
placement, never by changing a model default. A new displayed literal with no
key fails `literals.unit.spec.ts` (ADR 0016).

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

Next: [03-anatomy.md](03-anatomy.md).
