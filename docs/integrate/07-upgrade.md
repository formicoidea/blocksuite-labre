# Upgrade

**Small hops. Read the changelog. Type the lists.**

## Versioning

The library follows [Semantic Versioning](https://semver.org): `major.minor.patch`.
What each number promises to a host:

| Bump                                     | Promise                                                                                 | Examples                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **patch** (`0.39.1` → `0.39.2`)          | Nothing you wrote changes behaviour. Upgrade blind.                                     | a bug fix, a rendering fix, a dependency bump                                                                         |
| **minor** (`0.39.x` → `0.40.0`)          | Something new; everything old still works. Read the changelog for what you may now use. | a new framework, a new seam, a new flag key, a new command                                                            |
| **major** (`0.x` → `1.0`, `1.x` → `2.0`) | Something you wrote must change. The changelog says what and how.                       | a descriptor shape change, a seam signature change, a removed flag key, a stored-format change that needs a migration |

Until `1.0`, SemVer allows minors to break. **This library does not use that
allowance**: a `0.x` minor is treated as non-breaking, and a breaking change
bumps the major even in `0.x`. Earlier releases did not follow this strictly
(0.33 changed the descriptor shape in a minor); from 0.40 on they do.

The bump is decided by the changeset a contributor writes, not by the
release script: `yarn ci:version` reads the pending changesets and applies
the highest bump they declare. See
[../contribute/02-workflow.md](../contribute/02-workflow.md).

Every `@labre/*` package versions in lockstep (a fixed group in
`.changeset/config.json`), and every bundle carries the umbrella's version.
A framework bundle pins the exact core version it was built with. Bump every
`@formicoidea/*` range together.

Changelogs are per package in the repo (`packages/**/CHANGELOG.md`); the core
bundle's changelog aggregates them.

## Which range to declare

- `~0.39.0` (patch-only) if you upgrade by hand and want no surprise. The
  safe default while the library is `0.x`.
- `^0.39.0` once you trust the "minor never breaks" rule above and run the
  checklist below on every install.
- Never a bare `*` or `latest`: two bundles at different versions is the
  "two copies" incident in [01-install.md](01-install.md).

## What breaks between versions

Typical changes a host sees, from the Labre app's history:

| Kind                                | Example                                                                                | How to catch it                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| a descriptor changes shape          | 0.33: frameworks moved from `{ flag, viewExtension }` to `{ flag, extensions: [...] }` | compile error if you typed the map as `Record<FrameworkId, …>`             |
| a new framework appears             | 0.33: `c4`                                                                             | compile error on the same typed map; a missing button otherwise            |
| a key is added to `OPTIONAL_BLOCKS` | 0.3x: `edgeless-media`, `template`, `link`                                             | nothing to do if you iterate the exported list                             |
| a seam is added                     | pivot picker, catalogue panel                                                          | a button appears or disappears: check [04-host-seams.md](04-host-seams.md) |
| a peer's semantics change           | signals-core 1.14 `batch()`                                                            | pin the version the library tests with                                     |

Six weeks of library in one hop produced three compile breaks and one silent
behaviour change. Upgrade at every minor.

## 0.43 → 0.44

What a host sees:

| Kind                                   | Change                                                                                                                                                                                                                                                                                                                                                                        | What to do                                                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| a seam is added                        | `SelectionPaneExtension({ open, close })` / `SelectionPaneProvider`: the library draws its own selection pane, and a button opens it from the edgeless toolbar                                                                                                                                                                                                                | nothing to keep the library's pane; your own pane, or `null` to remove it, per [04-host-seams.md](04-host-seams.md)                                   |
| a setting is added                     | `edgelessShowGrid` in `GeneralSettingSchema`, through the existing `EditorSettingExtension`                                                                                                                                                                                                                                                                                   | optional: your default for the canvas grid. Absent means on; a viewer's toggle and a document's saved setting both win over it                        |
| commands are added                     | `canvas.selectionPane.toggle`; `canvas.element.reorder` / `.lock` / `.unlock`; `canvas.group.rename`, `canvas.frame.rename`; `canvas.layer.create` / `.rename` / `.reorder` / `.moveElements` / `.delete`; `canvas.visibility.hideLocal` / `.hideForEveryone` / `.showAll`; `canvas.grid.toggle` / `.saveForEveryone` — all `owner: 'core'`, run through `runCommand`         | nothing if you list commands from `getRegisteredCommands`; a host pane drives layers and visibility with them and reads `selectionPaneTree(std)`      |
| stored fields are added                | `layers`, `showGrid` on the surface; `layer`, `hiddenForEveryone` on elements and gfx blocks; `textDecoration` on canvas text; an `overline` inline attribute                                                                                                                                                                                                                 | nothing to migrate; read what a 0.43 client does with them in [05-persistence-and-sync.md](05-persistence-and-sync.md#fields-that-appeared-in-044)    |
| telemetry events are added             | `SelectionPaneOpened`, `CanvasVisibilityChanged`, `CanvasLayerChanged`, `CanvasGridToggled` (ids and counts only)                                                                                                                                                                                                                                                             | nothing; your `track` receives them (taxonomy in the telemetry service README)                                                                        |
| a behaviour changes                    | a framework board is no longer lowered under what it covers when the user MOVES it; it still is when it is placed (ADR 0033)                                                                                                                                                                                                                                                  | nothing; existing documents paint as before                                                                                                           |
| a behaviour changes                    | an alt-drag clone is ONE undo step: the first undo removes the copy (it used to only move it back onto its source)                                                                                                                                                                                                                                                            | update a smoke test that counted two undos                                                                                                            |
| a behaviour changes                    | "Export SVG" asks what to include from a board's "⋮" (palette, catalogue, shortcut and agent paths still export everything), marks every element with `data-labre-*` attributes (ids and vocabulary only, never text) and the root with `data-labre-svg="1"`, writes static SVG 1.1 paints (`rgb()` plus `*-opacity`, `none` for transparent), and draws edgeless text blocks | nothing; a consumer of the file sees the attributes and the paints                                                                                    |
| a behaviour changes                    | "Turn into" offers Callout, under the same switches as the slash-menu item: the `enable_callout` feature flag (`FeatureFlagService`, off by default) and `{ callout: false }`                                                                                                                                                                                                 | set `enable_callout` if you want callouts offered at all                                                                                              |
| a behaviour changes                    | a new BPMN event, gateway, data object or data store carries its name as a separate text grouped under the symbol, seeded with its type's name; activities are created at 180×108. Documents drawn before keep their inner text, unmigrated (R38, ADR 0029)                                                                                                                   | nothing; translate the new `com.labre.bpmn.seed.<kind>` keys                                                                                          |
| wordings gain fallbacks                | ten Wardley roles and three EDGY board roles that had a key and no English fallback now carry one, so a missing translation no longer shows a raw `com.labre.*` key                                                                                                                                                                                                           | nothing                                                                                                                                               |
| translation keys are added and retired | new keys for the selection pane, layers, the `canvas.*` commands, the SVG export options, the reading panel's zones and lanes, overline; `com.labre.commands.wardley.importSvg.description` is retired for `…importSvg.recognised.description` (the old French said the opposite of the new behaviour)                                                                        | diff the key manifests of the two versions (`yarn i18n:manifest <version>.csv`, [05-release.md](../contribute/05-release.md)) and translate the delta |

## Write the host so a change is a compile error

```ts
import type { FrameworkId } from '@labre/affine/std';
import { FRAMEWORK_DESCRIPTORS } from '@labre/affine/frameworks';

const BUNDLES: Record<FrameworkId, FrameworkBundle> = {
  wardley: wardleyFramework,
  edgy: edgyFramework,
  // a framework the library gains and you forgot here fails to compile
};

// order comes from the library, never restated
const FRAMEWORKS = FRAMEWORK_DESCRIPTORS.map(d => BUNDLES[d.id]);
```

## Checklist per upgrade

1. Bump every `@formicoidea/*` range to the same version.
2. Reinstall with a lockfile check that no second copy appeared.
3. Typecheck. Fix the compile errors first; they are the intended ones.
4. Run your editor smoke tests: mount, type, draw, switch mode, reload.
5. Diff [04-host-seams.md](04-host-seams.md) against your registrations.
6. Read the flag list: a new key defaults to enabled.

## Requests to the library

Open an issue on the library repository. If issues are disabled there, the
Labre app tracks pending requests in its own `docs/adr/0002`; the library
maintainers read it.
