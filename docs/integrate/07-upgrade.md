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

## 0.45 → 0.46

One intended compile break, for a host that registered the sidebar seam
inherited from AFFiNE: it is removed, not deprecated (a public export is not a
persisted identifier, ADR 0034 §2), and the fix is one rename. Every other type
a host implements or calls keeps its 0.45 shape. What a host sees:

| Kind                       | Change                                                                                                                                                                                                                                                                   | What to do                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| commands are added         | `canvas.frame.reorder { ids, before }` (`before: null` = the end), `owner: 'core'`, on the agent surface, exported with `frameCommands` and `reorderFramesParams`; `canvas.element.reorder` also accepts `ids` (`id` still works)                                        | nothing if you list commands from `getRegisteredCommands`; a slide panel of your own reorders with it ([08-host-panels.md](08-host-panels.md))                          |
| exports are added          | `@labre/affine/host-panels`: the verbs a host's own panel calls, gathered from four packages, plus `frameList`, `selectModels` and `fitToModel`                                                                                                                          | alias the subpath like `./commands`; import your panel's verbs from it rather than from a widget package                                                                |
| a seam is replaced         | `SidebarExtension` / `SidebarService` / `SidebarExtensionIdentifier` are removed; `OutlinePanelExtension({ open, close } \| null)` / `OutlinePanelProvider` replace them. Its only caller is the note toast's "View in TOC" link, now offered only when the seam answers | compile error if you implemented the old seam: register `OutlinePanelExtension({ open: () => showOutline(), close })` instead. Nothing to do if you never registered it |
| a behaviour changes        | the frame panel's drag refuses a read-only document, draws its drop line under the last card for a drop at the end, and is one undo step (it writes through `canvas.frame.reorder`)                                                                                      | nothing                                                                                                                                                                 |
| a behaviour changes        | the selection pane's drag moves every selected row of one stack together (a selection spanning several stacks is refused), and Escape during a drag cancels it: nothing is written and the pane stays open                                                               | update a smoke test that pressed Escape to close the pane mid-drag                                                                                                      |
| translation keys are added | `com.labre.command.canvas.frame.reorder` and its `.description`                                                                                                                                                                                                          | translate the delta (`yarn i18n:manifest`)                                                                                                                              |

## 0.43 → 0.45 (0.44.0 was versioned but never published)

No compile break: every type a host implements or calls keeps its 0.43
shape. `ReadingProfile.frame.label` and `.none` are optional and, absent,
read the 0.43 wording (`READING_FRAME_DEFAULT_WORDING`);
`renderBoardSvg(std, board)` still returns a `BoardSvgExport`, and only the
new overload with options can return `null`. What a host sees:

| Kind                                   | Change                                                                                                                                                                                                                                                                                                                                                                                                         | What to do                                                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a seam is added                        | `SelectionPaneExtension({ open, close })` / `SelectionPaneProvider`: the library draws its own selection pane, and a button opens it from the edgeless toolbar                                                                                                                                                                                                                                                 | nothing to keep the library's pane; your own pane, or `null` to remove it, per [04-host-seams.md](04-host-seams.md)                                                        |
| a setting is added                     | `edgelessShowGrid` in `GeneralSettingSchema`, through the existing `EditorSettingExtension`                                                                                                                                                                                                                                                                                                                    | optional: your default for the canvas grid. Absent means on; a viewer's toggle and a document's saved setting both win over it                                             |
| commands are added                     | `canvas.selectionPane.toggle`; `canvas.element.reorder` / `.lock` / `.unlock`; `canvas.group.rename`, `canvas.frame.rename`; `canvas.layer.create` / `.rename` / `.reorder` / `.moveElements` / `.delete`; `canvas.visibility.hideLocal` / `.hideForEveryone` / `.showAll`; `canvas.grid.toggle` / `.saveForEveryone` — all `owner: 'core'`, run through `runCommand`                                          | nothing if you list commands from `getRegisteredCommands`; a host pane drives layers and visibility with them and reads `selectionPaneTree(std)`                           |
| stored fields are added                | `layers`, `showGrid` on the surface; `layer`, `hiddenForEveryone` on elements and gfx blocks; `textDecoration` on canvas text; an `overline` inline attribute                                                                                                                                                                                                                                                  | nothing to migrate; read what a 0.43 client does with them in [05-persistence-and-sync.md](05-persistence-and-sync.md#fields-that-appeared-in-044)                         |
| telemetry events are added             | four new keys in `TelemetryEventMap`: `SelectionPaneOpened`, `CanvasVisibilityChanged`, `CanvasLayerChanged`, `CanvasGridToggled` (ids and counts only)                                                                                                                                                                                                                                                        | nothing for an adapter that forwards `track(event, props)`; a host typing an exhaustive `Record<keyof TelemetryEventMap, …>` adds the four keys (telemetry service README) |
| a behaviour changes                    | a framework board is no longer lowered under what it covers when the user MOVES it; it still is when it is placed (ADR 0033)                                                                                                                                                                                                                                                                                   | nothing; existing documents paint as before                                                                                                                                |
| a behaviour changes                    | an alt-drag clone is ONE undo step: the first undo removes the copy (it used to only move it back onto its source)                                                                                                                                                                                                                                                                                             | update a smoke test that counted two undos                                                                                                                                 |
| a behaviour changes                    | "Export SVG" asks what to include from a board's "⋮" (palette, catalogue, shortcut and agent paths still export everything), marks every element with `data-labre-*` attributes (ids and vocabulary only, never text) and the root with `data-labre-svg="1"`, writes static SVG 1.1 paints (`rgb()` plus `*-opacity`, `none` for transparent), and draws edgeless text blocks at their real place in the stack | nothing; a consumer of the file sees the attributes and the paints                                                                                                         |
| a behaviour changes                    | Callout is offered by default, in the slash menu and in "Turn into"; `{ callout: false }` removes both. `FeatureFlagService`'s `enable_callout` is deprecated and no longer read ([03-flags.md](03-flags.md))                                                                                                                                                                                                  | drop any `enable_callout` you set; to hide Callout, `{ callout: false }`                                                                                                   |
| a behaviour changes                    | when a host's `EdgelessClipboardConfig.createBlock` pastes a canvas block, the `index` it wrote is replaced by the paste's planned index, and the snapshot's `layer` / `hiddenForEveryone` are restored after it ([05-persistence-and-sync.md](05-persistence-and-sync.md#a-host-block-on-the-clipboard))                                                                                                      | nothing; do not rely on the index your config writes                                                                                                                       |
| a behaviour changes                    | a new BPMN event, gateway, data object or data store carries its name as a separate text grouped under the symbol, seeded with its type's name; activities are created at 180×108. Documents drawn before keep their inner text, unmigrated (R38, ADR 0029)                                                                                                                                                    | nothing; translate the new `com.labre.bpmn.seed.<kind>` keys                                                                                                               |
| a bundle declares a dependency         | `@formicoidea/labre-ddd-shared` now declares `yjs`, which it imports at run time (it relied on hoisting)                                                                                                                                                                                                                                                                                                       | nothing                                                                                                                                                                    |
| wordings gain fallbacks                | ten Wardley roles and three EDGY board roles that had a key and no English fallback now carry one, so a missing translation no longer shows a raw `com.labre.*` key                                                                                                                                                                                                                                            | nothing                                                                                                                                                                    |
| translation keys are added and retired | new keys for the selection pane, layers, the `canvas.*` commands, the SVG export options, the reading panel's zones and lanes, overline; `com.labre.commands.wardley.importSvg.description` is retired for `…importSvg.recognised.description` (the old French said the opposite of the new behaviour); the never-read `com.labre.note.display-mode.tooltip` is removed and may leave your catalogue           | diff the key manifests of the two versions (`yarn i18n:manifest <version>.csv`, [05-release.md](../contribute/05-release.md)) and translate the delta                      |

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

Next: [08-host-panels.md](08-host-panels.md).
