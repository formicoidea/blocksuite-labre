import { EdgelessFrameManagerIdentifier } from '@labre/affine-block-frame';
import {
  AFFINE_FRAME_PREVIEW,
  type FramePreview,
} from '@labre/affine-fragment-frame-panel';
import type { FrameBlockModel } from '@labre/affine-model';
import { interchangeExportActions } from '@labre/affine-block-surface';
import {
  DocModeProvider,
  type TranslationParams,
  translateKey,
} from '@labre/affine-shared/services';
import {
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandFile,
  type CommandFileParams,
  getRegisteredCommands,
  isCommandAvailable,
  runCommandAsync,
} from '@labre/std';
import { GfxControllerIdentifier, type GfxModel } from '@labre/std/gfx';

import { frameworkDescriptor } from './frameworks.js';

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
 *
 * **The view actions** (amendment of 2026-10-13) are the same idea for a
 * host's MENU rather than its panel: `getViewActions` projects the commands
 * on the `'view-menu'` surface — the grid, the PNG and PDF export, Present —
 * into rows of data (label, icon key, check, disabled), and `runViewAction`
 * runs one and hands back the file an export produced. The host draws the
 * rows (Labre's header ⋯, section "This view"); nothing here renders.
 *
 * ponytail: `frameList` is a plain read, not a signal of the frame list; a
 * host follows reorders through `std.store.slots.blockUpdated` (08 says how).
 * A signal of the frame list is the upgrade path if two hosts ask.
 */

export {
  type AnyCommandDescriptor,
  type CommandFile,
  type CommandInvocation,
  type CommandOwner,
  type CommandSurface,
  getCommandIcon,
  getCommandsForSurface,
  getRegisteredCommands,
  runCommand,
  runCommandAsync,
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

/*
 * The properties panel (ADR 0035 §9b and §11). The editor asks the host to
 * show it through `PropertiesPanelExtension` and feeds the title band through
 * `TitleBandExtension` (both registered from `@labre/affine/shared/services`,
 * docs/integrate/04-host-seams.md); a host's own panel reads and writes the
 * same sheet it hands the band, from its own store. What it takes from here
 * is the band's vocabulary, so the panel and the chips read the same: the
 * types of a sheet and of a panel request, and the text a chip draws for a
 * value.
 */
export {
  formatPropertyValue,
  isPropertyValueEmpty,
} from '@labre/affine-fragment-doc-title';
export type {
  PropertiesPanelRequest,
  PropertiesPanelService,
  TitleBandNotShownPage,
  TitleBandProperty,
  TitleBandService,
  TitleBandSheetState,
} from '@labre/affine-shared/services';

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

/**
 * The live preview of a frame the library's own frame panel draws on each
 * card: a read-only mini editor clipped to the frame's bounds, repainted as
 * the frame's content changes. Not a picture — a host that wants a static
 * thumbnail renders one through `ExportManager` instead.
 *
 * Returns the element ready to be appended; `width` and `height` are the
 * preview box in CSS pixels (the panel's card is 280 × 166), `fillScreen`
 * covers the box instead of containing the frame. One mini editor per
 * preview: mount only the cards on screen. The element is defined by the
 * frame panel's view extension, so it renders nothing in an assembly where the
 * `frame` flag is off (ADR 0009) — the same assembly where there is no frame
 * to preview.
 */
export function createFramePreview(
  std: BlockStdScope,
  frame: FrameBlockModel,
  options: { width?: number; height?: number; fillScreen?: boolean } = {}
): FramePreview {
  const preview = document.createElement(AFFINE_FRAME_PREVIEW) as FramePreview;
  preview.std = std;
  preview.frame = frame;
  if (options.width !== undefined) preview.surfaceWidth = options.width;
  if (options.height !== undefined) preview.surfaceHeight = options.height;
  if (options.fillScreen !== undefined) preview.fillScreen = options.fillScreen;
  return preview;
}

/**
 * One entry of the current view's own actions — what a host draws in the
 * "This view" section of its menu (ADR 0034, amendment of 2026-10-13). Data
 * only: the host owns the menu, the row, the spinner and the toast; the
 * library owns what the entry does.
 */
export interface ViewAction {
  /**
   * The command id, stable across versions (`canvas.grid.toggle`): the key a
   * host maps its own icon, test id or placement to, and what it passes back
   * to {@link runViewAction}.
   */
  id: string;
  /**
   * The group the entry belongs to, from the command's `category`:
   * `'display'` (the grid), `'export'` (PNG, PDF), `'present'`. A host draws
   * a separator between groups, or places a group elsewhere (Labre keeps
   * "Present" in its header). Open: a later minor may add a group.
   */
  section: string;
  /** Resolved through the host's `TranslationExtension`, else English. */
  label: string;
  /** The `com.labre.*` key behind {@link label}, for a host that translates itself. */
  labelKey: string;
  /**
   * The `{{name}}` values {@link labelKey} is filled with, for a host that
   * translates itself — present only on a label that has placeholders (the
   * framework exports: `{ framework, extension }`, the framework's name
   * already resolved). {@link label} has them filled in.
   */
  labelParams?: TranslationParams;
  /** Stable asset key; `getCommandIcon(std, iconKey)` is the library's icon. */
  iconKey?: string;
  /** Present only on a toggle: the state a check mark shows. */
  checked?: boolean;
  /**
   * Listed but refused now (a write on a read-only document): draw it
   * disabled. An entry that does not apply at all is not listed.
   */
  disabled: boolean;
}

/** What {@link runViewAction} hands back. */
export interface ViewActionResult {
  /**
   * The file an export produced — the host downloads it, shares it, uploads
   * it. Absent for an action that makes none, and for an export that found
   * nothing to draw.
   */
  file?: CommandFile;
}

/** A `'view-menu'` entry, and the `{{name}}` values its label takes. */
interface ViewMenuEntry {
  command: AnyCommandDescriptor;
  labelParams?: TranslationParams;
}

/**
 * Everything on the `'view-menu'` surface: the registered commands, then
 * one export per framework `*:export` capability in the interchange registry
 * (`interchangeExportActions`, ADR 0034 amendment of 2026-10-14) — derived
 * at read time, so what a flag removed from the registry is not listed.
 */
function viewMenuEntries(std: BlockStdScope): ViewMenuEntry[] {
  const registered = getRegisteredCommands(std)
    .filter(command => command.surfaces.includes('view-menu'))
    .map(command => ({ command }));
  const derived = interchangeExportActions(std).map(
    ({ command, capability }) => {
      const framework = frameworkDescriptor(capability.framework);
      return {
        command,
        labelParams: {
          framework: framework
            ? translateKey(std, framework.labelKey, framework.labelFallback)
            : capability.framework,
          extension: capability.format.extensions[0],
        },
      };
    }
  );
  return [...registered, ...derived];
}

/**
 * The actions proper to the view the editor shows now, in their declared
 * order: the commands registered on the `'view-menu'` surface whose `scope`
 * is this mode (or `'global'`) and whose `when` holds, and on the canvas
 * one export per framework format the interchange registry can write.
 *
 * `mode` is the view the host shows; omitted, it is read from
 * `DocModeProvider`, and a provider that does not know (the library default
 * answers `null`) leaves the choice to registration — the canvas commands are
 * registered on the edgeless scope only. Flags apply by construction: a
 * `frame: false` assembly registers no "Present", so it is not listed.
 *
 * Reactive when read inside an `effect` or a `computed`: `checked`, `when`
 * and the read-only refusal read signals, so the list follows the grid, a
 * toggle, a peer's save or a document turning read-only. Read it again after a
 * mode switch: the `std` is rebuilt.
 */
export function getViewActions(
  std: BlockStdScope,
  mode?: 'page' | 'edgeless'
): ViewAction[] {
  const view = mode ?? std.getOptional(DocModeProvider)?.getEditorMode();
  return viewMenuEntries(std)
    .filter(
      ({ command }) =>
        command.scope === 'global' || !view || command.scope === view
    )
    .filter(({ command }) => !command.when || command.when(std))
    .sort((a, b) => (a.command.order ?? 0) - (b.command.order ?? 0))
    .map(({ command, labelParams }) => ({
      id: command.id,
      section: command.category ?? 'display',
      label: translateKey(
        std,
        command.labelKey,
        command.labelFallback,
        labelParams
      ),
      labelKey: command.labelKey,
      ...(labelParams ? { labelParams } : {}),
      ...(command.iconKey ? { iconKey: command.iconKey } : {}),
      ...(command.checked ? { checked: command.checked(std) } : {}),
      disabled: !isCommandAvailable(std, command),
    }));
}

/**
 * The exports of the view the editor shows now — the `'export'` section of
 * {@link getViewActions}, in the same order: what a host lists in ONE
 * "Export…" menu. On the page: Markdown and HTML. On the canvas: PNG and PDF
 * (with an `ExportManager`), draw.io, SVG (with a canvas renderer), one entry
 * per framework format the registry writes (`canvas.export.<framework>.<format>`,
 * listed while the board holds that framework's elements), then Markdown and
 * HTML. Every one resolves {@link runViewAction} with `{ file }` and downloads
 * nothing.
 */
export function getViewExports(
  std: BlockStdScope,
  mode?: 'page' | 'edgeless'
): ViewAction[] {
  return getViewActions(std, mode).filter(
    action => action.section === 'export'
  );
}

/**
 * Run one entry of {@link getViewActions} by its id, through `runCommand`'s
 * bottleneck (usage and telemetry recorded once), and wait for it.
 *
 * Resolves when the action is done — after the export has rendered — with the
 * file it produced, if any: the library renders, the host decides where the
 * bytes go, and nothing is downloaded behind its back. Rejects when the action
 * fails, so the host can say so. An id that is not a view action here, an
 * entry that no longer applies or a refused one runs nothing and resolves
 * with no file.
 */
export async function runViewAction(
  std: BlockStdScope,
  id: string
): Promise<ViewActionResult> {
  const command = viewMenuEntries(std).find(
    entry => entry.command.id === id
  )?.command;
  if (!command) return {};
  if (command.when && !command.when(std)) return {};
  if (!isCommandAvailable(std, command)) return {};

  const result: ViewActionResult = {};
  const params: CommandFileParams = {
    deliver: file => {
      result.file = file;
    },
  };
  await runCommandAsync(
    std,
    command,
    { surface: 'view-menu', source: 'context-menu' },
    params
  );
  return result;
}
