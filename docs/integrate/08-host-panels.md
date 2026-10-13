# Host panels

**Your panel, the editor's verbs — and your menu, the view's actions.**

A host that draws its own panel beside the editor — a slide list, an artefact
catalogue, a selection pane — calls the editor through one module,
`@labre/affine/host-panels` (alias it like `./commands`,
[01-install.md](01-install.md)). It holds plain functions over the editor's
`std` (`editor.std`): no class, no state, no Lit type in a signature, so a
panel drawn in React types its calls without Lit. The library's own panels
call the same functions, which is what keeps the two behaving the same
(ADR 0034).

Every write is a command run through `runCommand`. The read-only refusal, the
no-op check, the single undo step and the telemetry live in the command's
action, once: a host panel does not re-check `store.readonly`, and a refused
write writes nothing.

```ts
import { frameCommands, runCommand } from '@labre/affine/host-panels';

const reorder = frameCommands.find(c => c.id === 'canvas.frame.reorder')!;

// Move the dragged slides before `target`, or to the end with `null`.
runCommand(
  editor.std,
  reorder,
  // the invocation the library's own frame panel uses
  { surface: 'contextual-toolbar', source: 'toolbar:general' },
  { ids: dragged, before: target?.id ?? null }
);
```

## Gesture → call

| Gesture                       | Call                                                                                                        | Note                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List a framework's artefacts  | `getCommandsForSurface(std, owner, 'catalogue')`, `getCommandIcon(std, command.iconKey)`                    | in the order the framework's senior menu shows them; flags are already applied (a gated framework lists nothing). The icon is the library's template: render it with Lit's `render`, or draw your own                                                                                                                                                     |
| Arm an artefact               | `armArtefact(gfx, owner, command)`, with `gfx = std.get(GfxControllerIdentifier)` (`@labre/affine/std/gfx`) | the ghost follows the next pointer move and the next click places it, as from the library's catalogue. Edgeless only                                                                                                                                                                                                                                      |
| Run any command               | `runCommand(std, command, { surface, source }, params)`                                                     | telemetry and usage are recorded here, once; the command's own action refuses a read-only document. `getRegisteredCommands(std)` lists what this editor registered                                                                                                                                                                                        |
| Read the canvas stack         | `selectionPaneTree(std)`                                                                                    | a signal of `SelectionPaneNode` rows: the layers, top first, each holding its elements, top first; ids only. Read it inside an `effect` to follow it                                                                                                                                                                                                      |
| Reorder canvas elements       | `canvas.element.reorder` (`{ ids, above }`, or `{ id, above }`) from `getRegisteredCommands(std)`           | `above: null` = the bottom of the stack; a selection that spans several stacks is refused. The layer and visibility commands are `canvas.layer.*` and `canvas.visibility.*`                                                                                                                                                                               |
| List the frames               | `frameList(std)`                                                                                            | presentation order, first slide first. Works in page mode too. A plain read, not a signal: to follow a reorder (yours, an undo, a peer's), subscribe to `std.store.slots.blockUpdated`, keep the events whose `flavour` is `affine:frame` (an `add`, a `delete`, or an `update` whose `props.key` is `presentationIndex`) and read `frameList(std)` again |
| Reorder the frames            | `canvas.frame.reorder` (`{ ids, before }`), from `frameCommands`                                            | `before: null` = the end; the moved frames keep their relative order. Refused: a read-only document, an unknown id, a `before` among the moved frames. A no-op writes nothing; a move is one undo step. Validate first with `reorderFramesParams` if you need to                                                                                          |
| Show a frame's live preview   | `createFramePreview(std, frame, { width?, height?, fillScreen? })`                                          | the card of the library's frame panel: a read-only mini editor clipped to the frame, repainted as its content changes — not a picture. Append the returned element (in React, through a ref); one mini editor per preview, so mount only the cards on screen. Defined by the frame panel's view extension: renders nothing where the `frame` flag is off  |
| Select                        | `selectModels(std, ids)`                                                                                    | replaces the selection, nothing enters text editing. Edgeless only: switch mode first (see [Timing](#timing))                                                                                                                                                                                                                                             |
| Frame a model in the viewport | `fitToModel(std, id, padding?)`                                                                             | smooth; `padding` is `[top, right, bottom, left]` in screen pixels and must include whatever of yours covers the canvas. Returns `false` for an unknown id. It never switches mode (see [Timing](#timing))                                                                                                                                                |

Run `canvas.frame.reorder` with the descriptor from `frameCommands`, not one
found in the registry: the registry lists it in edgeless mode only, and a slide
panel stays open in page mode.

## Timing

`fitToModel` moves the viewport of the canvas that is mounted now. Right
after `std.get(DocModeProvider).setEditorMode('edgeless')` the edgeless root
has not mounted yet, and when it does it sets its own viewport (the stored
one, or a fit to the whole canvas) over yours. The library's frame panel
therefore never fits after a switch: in page mode it stores the target first,
then switches, and the edgeless root applies it when it mounts:

```ts
std.get(EditPropsStore).setStorage('viewport', {
  xywh: frame.xywh,
  referenceId: frame.id,
  padding,
});
std.get(DocModeProvider).setEditorMode('edgeless');
```

(`EditPropsStore` and `DocModeProvider` come from
`@labre/affine/shared/services`.) Already in edgeless, call `fitToModel`
directly. The frame panel's "Present" button, which has no such handoff,
waits 100 ms after the switch before it sets the tool.

**Padding is yours to count.** The viewport spans the editor's container. A
panel docked over it hides part of the canvas, so the side it covers goes in
`padding`: the playground, with two 320 px panels docked over the right
edge, fits with `[50, 700, 50, 50]`. A panel laid out beside the editor, which
shrinks the container instead, needs no more than a margin.

## This view: the view actions

What is proper to the view the editor shows — the canvas grid, its PNG and
PDF export, the presentation — is the editor's, but the menu it sits in is
yours (Labre: the "This view" section of the header ⋯). The library lists
those actions as data and runs them; it draws no menu (ADR 0034, amendment
of 2026-10-13).

```ts
import {
  getViewActions,
  runViewAction,
  type ViewAction,
} from '@labre/affine/host-panels';

const actions: ViewAction[] = getViewActions(editor.std, mode); // mode: 'page' | 'edgeless'
const { file } = await runViewAction(editor.std, action.id);
if (file) download(file.blob, file.filename); // yours: a link, a share sheet…
```

A `ViewAction` is `{ id, section, label, labelKey, iconKey?, checked?,
disabled }`:

| Field      | What it is                                                                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`       | the command id, stable: key your own icons, test ids and placement on it                                                                                                                                        |
| `section`  | `'display'` (grid), `'export'` (PNG, PDF), `'present'`. Draw a separator between sections, or put one elsewhere (a header "Present" button). Open: a minor may add one                                          |
| `label`    | resolved through your `TranslationExtension`, else English; `labelKey` is the `com.labre.*` key if you translate yourself                                                                                       |
| `iconKey`  | `getCommandIcon(std, iconKey)` is the library's Lit icon; or map the key to your own set                                                                                                                        |
| `checked`  | present on a toggle only (the grid): draw a check or a switch                                                                                                                                                   |
| `disabled` | listed but refused now (saving the grid on a read-only document). An action that does not apply is not listed at all: "Save the grid for everyone" appears once the viewer toggled the grid, and leaves on save |

What you get today, in order:

| Mode     | Actions                                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| edgeless | `canvas.grid.toggle`, `canvas.grid.saveForEveryone` (after a toggle), `canvas.export.png`, `canvas.export.pdf`, `canvas.present` |
| page     | none yet                                                                                                                         |

**Follow it.** The list reads signals (the grid, its source, the document's
read-only state): call `getViewActions` inside an `effect` (or a `computed`)
from `@preact/signals-core` and the check, the follow-up and the disabled
state follow — a toggle from the palette, a peer's save. Read it again after
a mode switch: the `std` is rebuilt. `mode` is the view you show; omitted,
`DocModeProvider.getEditorMode()` answers, and where it answers `null` (the
library default) registration decides — the canvas actions are registered on
the edgeless scope only.

**Run it.** `runViewAction` runs the command through `runCommand`'s
bottleneck (usage, and telemetry where the command declares it, recorded
once) and **waits**: it resolves when the work is done and **rejects** when
it fails — show a spinner on the entry, a notice on failure. An export
resolves with `file` (a `Blob` and a sanitised file name) and downloads
nothing; an export with nothing to draw resolves without one. The same
commands run from the palette, with no one to hand the file to, download it
themselves. An id that is not a view action of this scope, or no longer
applies, runs nothing.

**Present from the page view** is yours to compose: switch to the canvas with
your own mode toggle (you own its state and the persisted mode), then run
`canvas.present` on the new `std` once the canvas has mounted. Labre waits
100 ms, as the library's frame panel does ([Timing](#timing)).

**Flags.** A flag removes tooling, never an entry a document needs:
`frame: false` registers no `canvas.present`, so it is not listed. The grid
and the exports are never gated.

A React menu, end to end:

```tsx
import { effect } from '@preact/signals-core';
import { useEffect, useState } from 'react';
import {
  getViewActions,
  runViewAction,
  type ViewAction,
} from '@labre/affine/host-panels';

function ThisViewSection({ std, mode }: Props) {
  const [actions, setActions] = useState<ViewAction[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(
    () => effect(() => setActions(getViewActions(std, mode))),
    [std, mode]
  );

  const run = (action: ViewAction) => {
    setBusy(action.id);
    runViewAction(std, action.id)
      .then(({ file }) => {
        if (file) download(file.blob, file.filename);
      })
      .catch(() => toast(t('editor.exportFailed')))
      .finally(() => setBusy(null));
  };

  return actions.map(action => (
    <button
      key={action.id}
      role={action.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={action.checked}
      disabled={action.disabled || busy !== null}
      data-testid={`view-action-${action.id}`}
      onClick={() => run(action)}
    >
      {action.label}
      {busy === action.id && <Spinner />}
    </button>
  ));
}
```

## The other direction

The editor asks the host to show a panel through four seams, one per panel the
library itself opens: `ArtefactCatalogueExtension`, `SelectionPaneExtension`,
`OutlinePanelExtension` and `PropertiesPanelExtension`. Each says what disappears when it is absent or
`null` in [04-host-seams.md](04-host-seams.md); there is no universal router.

There is no frame panel seam (ADR 0034): nothing in the library opens one.
Mount your own beside the editor. The "Present" button is the host's too:
`std.get(GfxControllerIdentifier).tool.setTool(PresentTool, { mode: 'fit' })`,
`PresentTool` from `@labre/affine/blocks/frame`, after switching to edgeless.

## The properties panel

The library draws no properties panel. The title band (the chips under the
page title and at the head of the page note) asks the host to show one
through `PropertiesPanelExtension`, and is fed by `TitleBandExtension`
(both from `@labre/affine/shared/services`, rows in
[04-host-seams.md](04-host-seams.md)). Your panel reads and writes the same
sheet you hand the band, from your own store: the band never caches a value,
so a write your panel makes shows in the chips as soon as your `sheet$`
signal changes.

```ts
import {
  PropertiesPanelExtension,
  TitleBandExtension,
} from '@labre/affine/shared/services';
import {
  formatPropertyValue,
  type PropertiesPanelRequest,
  type TitleBandProperty,
} from '@labre/affine/host-panels';

const extensions = [
  TitleBandExtension({
    sheet$: docId => sheets.signalFor(docId), // ready: the visible properties
    set: (docId, propertyId, value) => sheets.write(docId, propertyId, value),
    add: docId => openWorkspacePropertySettings(docId), // the band's "+"
    collapsed$: docId => deviceCollapsed(docId),
    setCollapsed: (docId, collapsed) => rememberCollapsed(docId, collapsed),
  }),
  PropertiesPanelExtension({
    open: (request: PropertiesPanelRequest) => sidebar.showProperties(request),
    close: () => sidebar.hideProperties(),
  }),
];

// In the panel, a value reads as its chip does.
const text = (property: TitleBandProperty) =>
  formatPropertyValue(property, locale);
```

| Gesture                     | Call                                              | Note                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The band's panel button     | your `open({ scope: 'page', docId })`             | the request names the page; open your panel on its sheet. `scope: 'source'` (a database's source and view) is declared in the type and sent by the database chrome when it ships; handle it or ignore it |
| Show a value as a chip does | `formatPropertyValue(property, locale?)`          | option labels for a select, the number preset's format, a localized date; `''` for an empty value and for a checkbox, which is a mark you draw                                                           |
| Tell an empty value         | `isPropertyValueEmpty(property)`                  | nullish, a blank string or an empty list; `false` is a value                                                                                                                                             |
| Write a value               | your own store, then your `sheet$` signal changes | the band and your panel share one source; the library never applies a value                                                                                                                              |

## What the module promises

- **It only widens.** In a minor, a function keeps its name and its
  parameters, a new parameter is optional, and no return gains `null`
  (`host-panels-signature.unit.spec.ts`).
- **A verb your panel needs and cannot find here is a gap in this module**,
  not a reason to import a widget package: open an issue on the library.

Back to [the documentation index](../README.md).
