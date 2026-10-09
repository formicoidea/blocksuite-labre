# Host panels

**Your panel, the editor's verbs.**

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

## The other direction

The editor asks the host to show a panel through three seams, one per panel the
library itself opens: `ArtefactCatalogueExtension`, `SelectionPaneExtension`
and `OutlinePanelExtension`. Each says what disappears when it is absent or
`null` in [04-host-seams.md](04-host-seams.md); there is no universal router.

There is no frame panel seam (ADR 0034): nothing in the library opens one.
Mount your own beside the editor. The "Present" button is the host's too:
`std.get(GfxControllerIdentifier).tool.setTool(PresentTool, { mode: 'fit' })`,
`PresentTool` from `@labre/affine/blocks/frame`, after switching to edgeless.

## What the module promises

- **It only widens.** In a minor, a function keeps its name and its
  parameters, a new parameter is optional, and no return gains `null`
  (`host-panels-signature.unit.spec.ts`).
- **A verb your panel needs and cannot find here is a gap in this module**,
  not a reason to import a widget package: open an issue on the library.

Back to [the documentation index](../README.md).
