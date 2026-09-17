# Step by step

**From an empty folder to a senior button, in the order the tests unlock.
Copy Wardley at each step; the example id is `cynefin` when a real file is
shorter than Wardley's.**

Before starting: read [02-framework-rules.md](02-framework-rules.md) once,
and write the ADR if the framework needs a stored field the base models do
not have.

## Step 1. The models

In `packages/affine/model/src/elements/<id>/`:

```ts
// background.ts
export class MyBackgroundElementModel extends FrameworkBackgroundElementModel {
  override get type() {
    return 'myBoard';
  }
}

// node.ts
export type MyNodeKind = 'a' | 'b'; // append-only
export class MyNodeElementModel extends ShapeElementModel {
  override get type() {
    return 'myNode';
  }
  @field('a' as MyNodeKind) accessor kind: MyNodeKind = 'a';
}
```

Add both to `SurfaceElementModelMap` in `elements/index.ts`. Extend the base
classes; never copy their overrides (R14).

Test: a model spec that creates each type and reads its props back.

## Step 2. The package

Create `packages/affine/gfx/<id>/` from Wardley's `package.json`,
`tsconfig.json` and `vitest.config.ts`. Name `@labre/affine-gfx-<id>`,
`private: true`, `sideEffects: false`, exports `.`, `./view`,
`./commands-manifest`. Run `yarn install` so the workspace links it.

## Step 3. The board

- `consts.ts` and `background.ts`: the `FrameworkBackgroundDef` (margins,
  axes, bands, label zones).
- `element-renderer.ts`: `createFrameworkBackgroundRenderer(MY_BACKGROUND)`
  in an `ElementRendererExtension`.
- `element-view.ts`: the view with `dblclick` on label zones, and the
  `Interaction` extension.
- `toolbar/config.ts`: the board's contextual toolbar (resize toggle now;
  export later, and Legend with Validation in the gated module later still).

Test: render the background into a canvas stub; hit-test the border and a
label zone.

## Step 4. The artefacts

- `presets.ts`: one props object per artefact kind.
- `node/node-renderer.ts`, `node/node-view.ts`, `node/consts.ts`.
- `actions.ts`: `createMyNode(gfx, kind)` that adds the shape, a free-text
  label, and groups them (R15, R16). Read sizes from `presets.ts` only.
- `toolbar/node-config.ts`.

Test: `createMyNode` produces a group of shape plus text with the expected
role and props.

## Step 5. Roles and reading

- `roles.ts`: `MY_ROLE` as const, `MY_ROLES: RoleDefs` with ids
  `my:<local>`, kinds, parents, edge directions.
- `reading.ts`: a `ReadingProfile` covering every node role.

Test: `roles.unit.spec.ts` (namespacing, kebab-case, `satisfies`).

## Step 6. The render extension

`view.ts`, first half:

```ts
export class MyRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-my-render-gfx';
  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(MyView);
    context.register(MyElementRendererExtension);
    context.register(MyNodeView);
    context.register(MyNodeRendererExtension);
    context.register(RoleVocabularyExtension(MY_ROLES));
    if (this.isEdgeless(context.scope)) {
      context.register(MyInteraction);
      context.register(myToolbarExtension);
      context.register(myNodeToolbarExtension);
    }
  }
}
```

Register it in `all/src/extensions/view.ts`, unconditionally. At this point
a document containing your elements paints.

## Step 7. Commands

`commands.ts`: one descriptor per artefact, one for the board (with
`telemetry: { board: true }`), `owner: 'my'`, `surfaces`, `iconKey`,
`category`, `labelKey` with fallback, `run: gfx => createMyNode(gfx, 'a')`.
Then `commands-manifest.ts` (copy the projection) and `translations.ts`.

Add the id to `FRAMEWORK_IDS` in `std`, to `OPTIONAL_BLOCKS` in `flags.ts`,
to the telemetry `framework` union, and the descriptor to `frameworks.ts`:

```ts
{
  id: 'my',
  labelKey: 'com.labre.framework.my', labelFallback: 'My framework',
  iconKey: 'my.toolbar',
  telemetryKey: 'my', telemetrySegment: 'my toolbox',
  bundle: 'framework-my', info: 'myFramework',
  pkg: '@labre/affine-gfx-my', dir: 'affine/gfx/my',
  extensions: [
    { viewExtension: 'MyRenderViewExtension' },
    { flag: 'my', viewExtension: 'MyViewExtension' },
  ],
  shortcuts: true,
}
```

Tests: `registry.unit.spec.ts`, `board-role.unit.spec.ts`,
`commands-manifest.unit.spec.ts`, `manifest.unit.spec.ts` for translations.

## Step 8. The tooling extension

- `toolbar/icons.ts` (56×56 toolbar icon, 24×24 artefact icons),
  `toolbar/senior-tool.ts`, `toolbar/my-senior-button.ts`,
  `toolbar/my-menu.ts` (`extends EdgelessCommandMenu`), `effects.ts`.
- `myCommandIcons` holds one entry per command `iconKey` **plus**
  `'my.toolbar': myToolbarIcon` — the descriptor's `iconKey` from step 7 must
  resolve through `getCommandIcon` (`registry.unit.spec.ts`, "every framework
  declares its own senior icon key").
- `templates/index.ts`: `[...examples, ...templateFromCommand(myCommands)]`.
- `view.ts`, second half:

```ts
export class MyViewExtension extends ViewExtensionProvider {
  override name = 'affine-my-gfx';
  override effect() {
    super.effect();
    effects();
  }
  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(CommandExtension(myCommands, myCommandIcons));
      context.register(mySeniorTool);
      context.register(TemplateCategoryExtension(myTemplateCategory));
      context.register(ReadingProfileExtension(MY_READING));
    }
  }
}
```

Register it in `all/src/extensions/view.ts` behind `on('my')`, immediately
after the render half.

Tests: `templates-parity.unit.spec.ts`, `reading-coverage.unit.spec.ts`,
`template-categories-gating.unit.spec.ts`, `senior-row-order.unit.spec.ts`.

## Step 9. Optional layers

In the order of value: legend (a `legend` entry on each artefact command, a
`legendBox` on the board's, and `legendToolbarAction(…)` merged into the
gated `custom:affine:surface:<board>` module beside Validation — no
`legend.ts`, no button to build, no telemetry to emit; ADR 0026), rules and
profiles (default profile most permissive, every rule with a
`backgroundRole` and its family's scope),
nudges, natures, interchange (pure `export.ts`/`import.ts`, an
`InterchangeCapability` per format and direction, export on the board
toolbar, import in the sub-menu), morph. Each in the gated half, each with
its spec. If you skip one on purpose, say so in an ADR.

## Step 10. The integration spec

`packages/integration-test/src/__tests__/edgeless/<id>.spec.ts`: mount
edgeless, run the board command, run an artefact command, assert the group
exists, assert the board is under it, click the border and assert selection,
toggle the flag and assert the button is gone while the board still paints.

## Step 11. Changeset, docs, PR

`yarn changeset` (minor on the new package and on `@labre/affine`). Add a
line to [../understand/05-what-is-a-framework.md](../understand/05-what-is-a-framework.md)'s
list. Open the PR with the checklist from
[05-review-checklist.md](05-review-checklist.md) filled in.

## Step 12. The bundle

Nothing to write: `scripts/build-bundles.mjs` reads `frameworks.ts`. Run
`yarn build:bundles` once and check `dist-bundles/framework-my/` has
`descriptor.ts`, `view.ts`, `commands-manifest.ts` and `index.ts`.

Next: [05-review-checklist.md](05-review-checklist.md).
