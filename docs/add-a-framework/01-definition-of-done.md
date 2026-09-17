# Definition of done

**A framework is done when every line below is true and the parity tests in
`packages/affine/all` are green.**

## The six conditions (from `CLAUDE.md`)

1. **Model.** Element models in `packages/affine/model/src/elements/<id>/`,
   registered in `SurfaceElementModelMap`, with a loadability story for
   existing documents (optional fields default to `undefined`, enum values
   append-only).
2. **Store and view extensions**, registered in
   `packages/affine/all/src/extensions/{store,view}.ts`. The view is split
   in two: `<Id>RenderViewExtension` (always on) and `<Id>ViewExtension`
   (flag-gated).
3. **A flag** in `packages/affine/all/src/flags.ts` (`OPTIONAL_BLOCKS`) and
   a descriptor in `frameworks.ts`: one flag, one descriptor, one drawing
   (R35). The flag gates tooling only.
4. **Telemetry** through command descriptors (`telemetry: { framework,
element, board }`); the board-placing command declares `board: true`.
5. **Unit tests**, plus an integration spec since it renders on the canvas.
6. **One changeset.**

## What the shared tests will demand

These fail until the framework is complete. Read them as the checklist:

| Test                                                          | Demands                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `all/__tests__/commands/registry.unit.spec.ts`                | a descriptor for every framework and a framework for every descriptor; unique command ids prefixed by the framework id; an `iconKey` on every command; a descriptor `iconKey` that is unique, `<segment>.toolbar` and registered in the framework's icon table; a chord prefix that is unique and not a reserved edgeless key; at most 14 senior-menu nominations (the cap plus the native import); every command in the catalogue |
| `all/__tests__/commands/board-role.unit.spec.ts`              | one command that places the board, with `telemetry.board: true` and the board's element name                                                                                                                                                                                                                                                                                                                                       |
| `all/__tests__/commands/legend-subscription.unit.spec.ts`     | a legend row for every role the framework's commands stamp, and no row naming a role the vocabulary does not declare; no swatch carrying a role. Shipping no legend at all is an exemption named in the test, with its ADR                                                                                                                                                                                                         |
| `all/__tests__/reading-coverage.unit.spec.ts`                 | a role vocabulary and at least one reading profile, registered from the real view extension                                                                                                                                                                                                                                                                                                                                        |
| `all/__tests__/flags/template-categories-gating.unit.spec.ts` | a Templates category that disappears when the flag is off                                                                                                                                                                                                                                                                                                                                                                          |
| `all/__tests__/toolbar/senior-row-order.unit.spec.ts`         | the render half registered immediately before the tooling half                                                                                                                                                                                                                                                                                                                                                                     |
| `all/__tests__/translations/manifest.unit.spec.ts`            | every key matches `com.labre.`, unique, sorted                                                                                                                                                                                                                                                                                                                                                                                     |
| `<id>/__tests__/templates-parity.unit.spec.ts`                | one derived template per artefact command, re-running identically                                                                                                                                                                                                                                                                                                                                                                  |
| `<id>/__tests__/commands-manifest.unit.spec.ts`               | the manifest equals the descriptors row for row                                                                                                                                                                                                                                                                                                                                                                                    |

## What cannot be gated

The renderer, the element views, the interaction, the contextual toolbar of a
placed element, the role vocabulary, the stacking rule. A document drawn while
the flag was on must paint and stay editable while it is off.

## What is optional, and must be declared as such

Validation rules and profiles, nudges, legend, interchange, natures. A
framework that ships none of one kind says so in an ADR (ADR 0013 for
Cynefin) so that a coverage audit does not report it as missing. UML:
natures, nudges and audit criteria not shipped, imports in phase 2, per
ADR 0017.

The legend is the cheap one: it is a `legend` field on the commands already
written plus one line in the gated toolbar module (ADR 0026), so skipping it
is a statement about the notation, not a corner cut.

## Acceptance by the product owner

- The senior button appears in the row, in `FRAMEWORK_DESCRIPTORS` order,
  with its own icon.
- The sub-menu shows the artefacts; past thirteen, the "More artefacts…"
  entry opens the catalogue.
- Each artefact can be placed, moved, connected, morphed, copied and undone
  like a shape.
- The board is picked by its border, sits under its artefacts, and shows its
  contextual toolbar with legend, export, resize toggle.
- Legend lists exactly what is drawn on the board, with the real glyphs, and a
  second click adds no row to what the first one wrote.
- With the flag off: no button, no chords, no templates, no rules, no Legend
  and no Validation; the resize toggle, the exports and a legend already
  generated stay, and a stored board still paints.

Next: [02-framework-rules.md](02-framework-rules.md).
