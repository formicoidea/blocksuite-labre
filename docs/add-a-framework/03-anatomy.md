# Anatomy of a framework package

**Mirror `packages/affine/gfx/wardley`. Required files first, optional
layers after.**

```
packages/affine/gfx/<id>/
├── package.json            @labre/affine-gfx-<id>, private, sideEffects false
├── vitest.config.ts
├── tsconfig.json
└── src/
    ├── index.ts            headless public surface
    ├── view.ts             <Id>RenderViewExtension + <Id>ViewExtension
    ├── effects.ts          customElements.define for the tooling elements
    ├── consts.ts           visual constants of the board
    ├── background.ts       the board's plot declaration
    ├── element-renderer.ts board renderer + ElementRendererExtension
    ├── element-view.ts     board view: interaction, dblclick label zones
    ├── node/               the artefact element: view, renderer, consts
    ├── actions.ts          create/morph/activate functions shared by menu and shortcuts
    ├── presets.ts          birth props of every artefact
    ├── commands.ts         CommandDescriptor[] + icon map
    ├── commands-manifest.ts hand-committed projection of commands.ts
    ├── translations.ts     com.labre.* entries derived from the declarations
    ├── roles.ts            RoleDefs
    ├── reading.ts          ReadingProfile
    ├── templates/          the Templates category
    ├── toolbar/            senior-tool.ts, <id>-senior-button.ts, <id>-menu.ts, icons.ts, config.ts, node-config.ts
    └── __tests__/          *.unit.spec.ts + corpus/
```

## Required

| File                                                                  | Role                                                                                                                                                                                                                                                              | Registered from                     |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `index.ts`                                                            | What a host or a headless tool reads without an editor: roles, presets, background geometry, parsers. Never deep-import from a framework; if two consumers read a value, it is here.                                                                              | —                                   |
| `view.ts`                                                             | The two providers. Render half: element views, renderers, interaction, contextual toolbars, role vocabulary, self-coherence watchers. Gated half: `effects()`, commands, rules, profiles, nudges, interchange, natures, templates category, reading, senior tool. | `all/src/extensions/view.ts`        |
| `effects.ts`                                                          | `customElements.define` for the senior button and the menu. Called from the gated provider's `effect()`.                                                                                                                                                          | —                                   |
| `background.ts` + `consts.ts`                                         | The board's declaration (`FrameworkBackgroundDef`): margins, axes, bands, label zones. Read by the renderer, the hit-test and any headless layout.                                                                                                                | —                                   |
| `element-renderer.ts`                                                 | `createFrameworkBackgroundRenderer(BACKGROUND)` wrapped in `ElementRendererExtension`.                                                                                                                                                                            | render                              |
| `element-view.ts`                                                     | The board's `GfxElementModelView`: `dblclick` on label zones, `includesPoint` widening, the `Interaction` extension.                                                                                                                                              | render                              |
| `node/`                                                               | The artefact's view, renderer and constants. The model itself lives in `packages/affine/model/src/elements/<id>/`.                                                                                                                                                | render                              |
| `actions.ts`                                                          | `create<Artefact>(gfx, …)`, grouping base elements, reading `presets.ts`. No telemetry here.                                                                                                                                                                      | —                                   |
| `presets.ts`                                                          | The one description of each artefact's birth props. Creation and morph both read it.                                                                                                                                                                              | —                                   |
| `commands.ts`                                                         | `CommandDescriptor[]` with `owner: '<id>'`, `surfaces`, `iconKey`, `telemetry`, and the icon map.                                                                                                                                                                 | gated (`CommandExtension`)          |
| `commands-manifest.ts`                                                | The serializable projection, held equal by a test.                                                                                                                                                                                                                | —                                   |
| `translations.ts`                                                     | `translationEntries` derived from commands, roles, background, rules, nudges, profiles, reading.                                                                                                                                                                  | merged in `all/src/translations.ts` |
| `roles.ts`                                                            | `RoleDefs` with `as const satisfies Record<Key, Id>`.                                                                                                                                                                                                             | render (`RoleVocabularyExtension`)  |
| `reading.ts`                                                          | What the panel proposes on click.                                                                                                                                                                                                                                 | gated (`ReadingProfileExtension`)   |
| `templates/index.ts`                                                  | `[...handComposed, ...templateFromCommand(commands)]` as one `TemplateCategory`.                                                                                                                                                                                  | gated (`TemplateCategoryExtension`) |
| `toolbar/senior-tool.ts`, `-senior-button.ts`, `-menu.ts`, `icons.ts` | The senior tool registration, the button (56×56 icon), the menu (`extends EdgelessCommandMenu`).                                                                                                                                                                  | gated                               |
| `toolbar/config.ts`, `toolbar/node-config.ts`                         | Contextual toolbar modules for the board (legend, export, resize toggle) and the artefact.                                                                                                                                                                        | render                              |

## Optional layers

| File                                       | Role                                                                                        | Registered from                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------ |
| `rules.ts`, `profiles.ts`                  | `ValidationRule[]` with `backgroundRole`; profiles with `isDefault` on the most permissive. | gated                          |
| `nudges.ts`                                | `QualityNudge[]`, a checklist.                                                              | gated                          |
| `audit-criteria.ts`                        | Criteria for the AI audit seam.                                                             | gated                          |
| `natures.ts`                               | Level-3 `UniverseTagDefs`.                                                                  | gated                          |
| `legend.ts`                                | Builds the legend group; wired as a button in `toolbar/config.ts`.                          | —                              |
| `morph.ts`                                 | Morph specs registered on the group flavour with an owner key.                              | gated                          |
| `interchange.ts`, `export.ts`, `import.ts` | Capabilities and the pure parser/serializer pair.                                           | gated (`InterchangeExtension`) |
| `gradient.ts`                              | Analytic background washes.                                                                 | —                              |
| `node/<x>-watcher.ts`                      | A watcher keeping a placed element self-coherent (glyph vs tag). Authors nothing.           | render                         |

## Elsewhere in the repo

| Path                                                                     | What to add                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/affine/model/src/elements/<id>/`                               | `<Id>BackgroundElementModel extends FrameworkBackgroundElementModel`, `<Id>NodeElementModel extends ShapeElementModel` with `@field` props; entries in `SurfaceElementModelMap` |
| `packages/affine/all/src/flags.ts`                                       | the key in `OPTIONAL_BLOCKS`                                                                                                                                                    |
| `packages/affine/all/src/frameworks.ts`                                  | the descriptor: id, labelKey, chordPrefix (if any), telemetryKey, bundle, pkg, dir, the two extensions                                                                          |
| `packages/affine/all/src/extensions/view.ts`                             | the render half, then the gated half behind `on('<id>')`                                                                                                                        |
| `packages/affine/all/src/translations.ts`, `shortcuts.ts`, `commands.ts` | the framework's entries                                                                                                                                                         |
| `packages/framework/std` (`FRAMEWORK_IDS`)                               | the id in the union                                                                                                                                                             |
| `packages/affine/shared/src/services/telemetry-service/lifecycle.ts`     | the `framework` union member                                                                                                                                                    |
| `scripts/build-bundles.mjs`                                              | nothing, if `frameworks.ts` is complete: the script reads it                                                                                                                    |
| `packages/integration-test/src/__tests__/edgeless/<id>.spec.ts`          | the canvas spec                                                                                                                                                                 |
| `.changeset/<name>.md`                                                   | the changeset                                                                                                                                                                   |

Next: [04-step-by-step.md](04-step-by-step.md).
