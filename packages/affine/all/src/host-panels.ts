import { EdgelessFrameManagerIdentifier } from '@labre/affine-block-frame';
import type { FrameBlockModel } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier, type GfxModel } from '@labre/std/gfx';

/**
 * `@labre/affine/host-panels` — the verbs a host's own panel calls (ADR 0034
 * §4, docs/integrate/08-host-panels.md).
 *
 * A host that draws its own artefact catalogue, selection pane or slide list
 * needs a handful of editor verbs: list a framework's artefacts, arm one, run
 * a command, read the canvas stack, list the frames in presentation order,
 * select a model, frame it in the viewport. They existed before this module,
 * spread over four packages and three levels of abstraction (`armArtefact` in
 * the edgeless toolbar widget, `selectionPaneTree` in the surface block, the
 * command registry in `std`, the frame order in the frame block), and no page
 * named them together. This module gathers them, so a host imports one entry
 * and never a widget package.
 *
 * **Why a façade and not a seam.** A seam is the editor asking the host for
 * something (show a panel, open a document); its absence needs a degraded
 * behaviour and a row in the seams table. Here the direction is the other way:
 * the host calls the editor, and nothing degrades — a host that draws no panel
 * simply calls nothing. So: plain named functions over an `std`, no class, no
 * object holding state, no registration. The library's own panels and a
 * host's call the same functions and the same commands, which is what keeps
 * their behaviour the same; every WRITE goes through a core command run by
 * `runCommand` (`canvas.frame.reorder`, `canvas.element.reorder`, …), so the
 * read-only refusal, the no-op check, the single undo step and the telemetry
 * happen once whoever draws the pixels.
 *
 * **No Lit type is named here.** `lit` is only a dev dependency of
 * `@labre/affine`, and a host that draws its panel in React must be able to
 * type its calls without it (`host-panels-signature.unit.spec.ts` reads this
 * file). `getCommandIcon` still returns what the icon tables hold; a host
 * renders it with Lit's `render` or uses its own icons.
 *
 * **This module only widens.** A function, a parameter or a return type a
 * host calls keeps its 0.46 shape in every minor: a new parameter is optional,
 * a return never gains `null` (`host-panels-signature.unit.spec.ts`, which
 * `yarn build` typechecks; docs/lessons.md 33). A verb a host panel needs and
 * cannot find here is a gap in this module, not a reason to import a widget
 * package.
 */

export {
  type AnyCommandDescriptor,
  type CommandInvocation,
  type CommandOwner,
  type CommandSurface,
  getCommandIcon,
  getCommandsForSurface,
  getRegisteredCommands,
  runCommand,
} from '@labre/std';
export { armArtefact } from '@labre/affine-widget-edgeless-toolbar';
export {
  type SelectionPaneNode,
  selectionPaneTree,
} from '@labre/affine-block-surface';
export {
  frameCommands,
  type ReorderFramesParams,
  reorderFramesParams,
} from '@labre/affine-block-frame';

/**
 * The document's frames in presentation order, first slide first — the order
 * `canvas.frame.reorder` writes and the presentation walks. Works in page mode
 * too: the frame manager is registered with the frame block in both.
 */
export function frameList(std: BlockStdScope): FrameBlockModel[] {
  return std.get(EdgelessFrameManagerIdentifier).frames;
}

/**
 * Select `ids` on the canvas, the way a click on a panel row does: the
 * selection replaces the current one and nothing enters text editing. Edgeless
 * only — page mode shows no canvas selection.
 */
export function selectModels(std: BlockStdScope, ids: readonly string[]) {
  std.get(GfxControllerIdentifier).selection.set({
    elements: [...ids],
    editing: false,
  });
}

/**
 * Move the viewport, smoothly, so model `id` fills it within `padding`
 * (top, right, bottom, left, in screen pixels) — the frame panel's "fit to
 * frame". `false` when no canvas model has that id; nothing moves then.
 *
 * It never switches the editor's mode: the host knows which mode it shows, and
 * a host in page mode switches first (`DocModeProvider`).
 */
export function fitToModel(
  std: BlockStdScope,
  id: string,
  padding: [number, number, number, number] = [0, 0, 0, 0]
): boolean {
  const gfx = std.get(GfxControllerIdentifier);
  const model = gfx.getElementById<GfxModel>(id);
  if (!model?.elementBound) return false;
  gfx.viewport.setViewportByBound(model.elementBound, padding, true);
  return true;
}
