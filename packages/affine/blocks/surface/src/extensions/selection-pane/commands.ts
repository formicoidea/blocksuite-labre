import {
  CanvasLocalVisibility,
  SelectionPaneProvider,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import type {
  AnyCommandDescriptor,
  BlockStdScope,
  CommandDescriptor,
  CommandInvocation,
} from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { z } from 'zod';

import {
  renamePaneFrame,
  renamePaneGroup,
  reorderPaneElements,
  setPaneElementsHiddenForEveryone,
  setPaneElementsLocked,
} from './actions.js';
import { setUserLayersHiddenForEveryone } from '../user-layers/actions.js';
import { SelectionPaneModel } from './tree.js';

/**
 * The selection pane's commands (ADR 0031, stage 2), `owner: 'core'`: the pane
 * belongs to no framework, and `'core'` owners are exempt from the id-prefix
 * rule (ADR 0008).
 *
 * The pane's own rows invoke the parameterised ones through `runCommand`, and
 * so does a host's pane: the read-only refusal lives in the action, once.
 */

/** How the user reached the pane, as `SelectionPaneOpened` reports it. */
function openedFrom(
  invocation: CommandInvocation
): 'toolbar' | 'palette' | 'shortcut' {
  if (invocation.surface === 'shortcut') return 'shortcut';
  if (invocation.source === 'toolbar:general') return 'toolbar';
  // The palette and the agent both invoke the command by name.
  return 'palette';
}

const paneService = (std: BlockStdScope) =>
  std.getOptional(SelectionPaneProvider);

/**
 * Open the pane, or put the library's own panel away when it is the one on
 * screen.
 *
 * Toggling needs a state the two-verb seam does not carry, so it reads the
 * library panel's own (`SelectionPaneModel.open$`). A host that replaced the
 * panel keeps its open state to itself: for it, the toggle always opens, and
 * closing is the host's own control.
 *
 * Emits `SelectionPaneOpened` from its body, and only when it opens — see the
 * telemetry README for why this command self-emits like `doc.copyLink`.
 *
 * Opening writes nothing, so no read-only guard: the pane is how a reader finds
 * what is on a canvas they cannot edit.
 */
const toggleSelectionPane: AnyCommandDescriptor = {
  id: 'canvas.selectionPane.toggle',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.selection-pane.toggle',
  labelFallback: 'Selection pane',
  descriptionKey: 'com.labre.command.canvas.selection-pane.toggle.description',
  descriptionFallback:
    'List the elements of the canvas by stacking order, to select, lock, rename or reorder them.',
  keywords: ['layers', 'objects', 'z-order', 'stack'],
  surfaces: ['palette', 'agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  // `null` from `SelectionPaneExtension(null)` switches the pane off; the
  // command then disappears rather than opening nothing.
  when: std => !!paneService(std),
  run: (std, invocation) => {
    const service = paneService(std);
    if (!service) return;
    const model = std.getOptional(SelectionPaneModel);
    if (model?.open$.peek()) {
      service.close();
      return;
    }
    service.open();
    std.getOptional(TelemetryProvider)?.track('SelectionPaneOpened', {
      page: 'whiteboard editor',
      source: openedFrom(invocation),
    });
  },
};

/*
 * "An `id` or a non-empty `ids`" is checked in `run`, not with a zod `refine`:
 * a refined schema is a `ZodEffects`, which `describeCommandParams` cannot
 * project, so the agent manifest would lose the whole parameter contract.
 */
export const reorderElementParams = z.object({
  // The element or gfx block to move.
  id: z.string().min(1).optional(),
  // Several models of ONE stack, moved as a block in their current relative
  // order (the selection pane's multi-row drag, ADR 0034). Added beside `id`,
  // which stays: a caller passing `id` alone is unchanged.
  ids: z.array(z.string().min(1)).optional(),
  // The model they land directly ABOVE, stacked with them; `null` puts them
  // at the bottom of their stack.
  above: z.string().min(1).nullable(),
});

export type ReorderElementParams = z.infer<typeof reorderElementParams>;

const reorderElement: CommandDescriptor<ReorderElementParams> = {
  id: 'canvas.element.reorder',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.element.reorder',
  labelFallback: 'Move in the stack',
  descriptionKey: 'com.labre.command.canvas.element.reorder.description',
  descriptionFallback:
    'Place an element directly above another one in the stacking order.',
  // Agent only: without an explicit target there is nothing to say where.
  surfaces: ['agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  params: reorderElementParams,
  run: (std, _invocation, params) => {
    const parsed = reorderElementParams.safeParse(params);
    if (!parsed.success) {
      console.error('canvas.element.reorder: invalid params', parsed.error);
      return;
    }
    const { id, ids = [], above } = parsed.data;
    const moving = id === undefined ? ids : [id, ...ids];
    if (!moving.length) {
      console.error('canvas.element.reorder: needs an id or ids');
      return;
    }
    reorderPaneElements(std, moving, above);
  },
};

export const lockElementsParams = z.object({
  /**
   * The models to act on. Omitted: the current canvas selection. Each one is
   * locked ON ITS OWN — never wrapped into a group.
   */
  ids: z.array(z.string()).optional(),
});

export type LockElementsParams = z.infer<typeof lockElementsParams>;

function lockTargets(std: BlockStdScope, params: unknown): string[] {
  const parsed = lockElementsParams.safeParse(params ?? {});
  if (!parsed.success) return [];
  return (
    parsed.data.ids ?? std.get(GfxControllerIdentifier).selection.selectedIds
  );
}

function lockCommand(locked: boolean): CommandDescriptor<LockElementsParams> {
  const verb = locked ? 'lock' : 'unlock';
  return {
    id: `canvas.element.${verb}`,
    owner: 'core',
    kind: 'action',
    labelKey: `com.labre.command.canvas.element.${verb}`,
    labelFallback: locked ? 'Lock each element' : 'Unlock each element',
    descriptionKey: `com.labre.command.canvas.element.${verb}.description`,
    descriptionFallback: locked
      ? 'Lock every selected element on its own, without grouping them.'
      : 'Unlock every selected element on its own.',
    surfaces: ['palette', 'agent'],
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'editable',
    when: std =>
      std.get(GfxControllerIdentifier).selection.selectedIds.length > 0,
    params: lockElementsParams,
    run: (std, _invocation, params) => {
      setPaneElementsLocked(std, lockTargets(std, params), locked);
    },
  };
}

export const renameGroupParams = z.object({
  id: z.string().min(1),
  title: z.string(),
});

export type RenameGroupParams = z.infer<typeof renameGroupParams>;

const renameGroup: CommandDescriptor<RenameGroupParams> = {
  id: 'canvas.group.rename',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.group.rename',
  labelFallback: 'Rename group',
  descriptionKey: 'com.labre.command.canvas.group.rename.description',
  descriptionFallback: 'Give a group a new title.',
  surfaces: ['agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  params: renameGroupParams,
  run: (std, _invocation, params) => {
    const parsed = renameGroupParams.safeParse(params);
    if (!parsed.success) {
      console.error('canvas.group.rename: invalid params', parsed.error);
      return;
    }
    renamePaneGroup(std, parsed.data.id, parsed.data.title);
  },
};

/**
 * A frame's row is renamed in place like a group's (ADR 0031, amendments:
 * frames are rows). Its own command rather than `canvas.group.rename` widened:
 * the agent reads a command's wording, and a frame is not a group.
 */
const renameFrame: CommandDescriptor<RenameGroupParams> = {
  id: 'canvas.frame.rename',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.frame.rename',
  labelFallback: 'Rename frame',
  descriptionKey: 'com.labre.command.canvas.frame.rename.description',
  descriptionFallback: 'Give a frame a new title.',
  surfaces: ['agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  params: renameGroupParams,
  run: (std, _invocation, params) => {
    const parsed = renameGroupParams.safeParse(params);
    if (!parsed.success) {
      console.error('canvas.frame.rename: invalid params', parsed.error);
      return;
    }
    renamePaneFrame(std, parsed.data.id, parsed.data.title);
  },
};

export const hideLocalParams = z.object({
  /** The models to act on. Omitted: the current canvas selection. */
  ids: z.array(z.string()).optional(),
  /**
   * Whole user layers to act on instead (ADR 0031 stage 7). When given,
   * `ids` and the selection are ignored.
   */
  layerIds: z.array(z.string()).optional(),
  /** `false` shows them again. Omitted: hide. */
  hidden: z.boolean().optional(),
});

export type HideLocalParams = z.infer<typeof hideLocalParams>;

function reportVisibility(
  std: BlockStdScope,
  hidden: boolean,
  count: number,
  scope: 'local' | 'everyone' = 'local',
  target: 'element' | 'layer' = 'element'
) {
  if (!count) return;
  std.getOptional(TelemetryProvider)?.track('CanvasVisibilityChanged', {
    page: 'whiteboard editor',
    target,
    scope,
    hidden,
    count,
  });
}

/**
 * Hide elements for THIS viewer only (ADR 0031 §8) — or, with
 * `hidden: false`, show them again; the pane's eye is both.
 *
 * Nothing is written to the document, so there is no read-only guard: a
 * reader may hide what is in their way. Self-emits `CanvasVisibilityChanged`
 * with the number of elements the gesture actually changed.
 */
const hideLocal: CommandDescriptor<HideLocalParams> = {
  id: 'canvas.visibility.hideLocal',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.visibility.hide-local',
  labelFallback: 'Hide for me',
  descriptionKey: 'com.labre.command.canvas.visibility.hide-local.description',
  descriptionFallback:
    'Hide the selected elements on your screen only. Nothing changes for anyone else.',
  surfaces: ['palette', 'agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'selection',
  when: std => !!std.getOptional(CanvasLocalVisibility),
  params: hideLocalParams,
  run: (std, _invocation, params) => {
    const visibility = std.getOptional(CanvasLocalVisibility);
    const parsed = hideLocalParams.safeParse(params ?? {});
    if (!visibility || !parsed.success) return;
    if (parsed.data.layerIds) {
      const hidden = parsed.data.hidden ?? true;
      const layers = parsed.data.layerIds;
      const count = hidden
        ? visibility.hideLayers(layers)
        : visibility.showLayers(layers);
      reportVisibility(std, hidden, count, 'local', 'layer');
      return;
    }
    const ids =
      parsed.data.ids ?? std.get(GfxControllerIdentifier).selection.selectedIds;
    const hidden = parsed.data.hidden ?? true;
    const count = hidden ? visibility.hide(ids) : visibility.show(ids);
    reportVisibility(std, hidden, count);
  },
};

export const hideForEveryoneParams = z.object({
  /** The models to act on. Omitted: the current canvas selection. */
  ids: z.array(z.string()).optional(),
  /**
   * Whole user layers to act on instead: `hidden: true` on each record, one
   * write per layer, never one per member (ADR 0031 §7).
   */
  layerIds: z.array(z.string()).optional(),
  /** `false` shows them again, for everyone. Omitted: hide. */
  hidden: z.boolean().optional(),
});

export type HideForEveryoneParams = z.infer<typeof hideForEveryoneParams>;

/**
 * Hide elements for EVERYONE (ADR 0031 §7) — or, with `hidden: false`, show
 * them again for everyone. Written to the document and synced: every viewer,
 * every peer, stops painting and picking them, while rules, legends and
 * semantic exports keep counting them (§9). Refused on a read-only document
 * (`availability`, and again in the action). Self-emits
 * `CanvasVisibilityChanged` with `scope: 'everyone'` and the count actually
 * written.
 */
const hideForEveryone: CommandDescriptor<HideForEveryoneParams> = {
  id: 'canvas.visibility.hideForEveryone',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.visibility.hide-for-everyone',
  labelFallback: 'Hide for everyone',
  descriptionKey:
    'com.labre.command.canvas.visibility.hide-for-everyone.description',
  descriptionFallback:
    'Hide the selected elements for everyone who opens this document. They stay in the document and in the selection pane.',
  surfaces: ['palette', 'agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  when: std =>
    std.get(GfxControllerIdentifier).selection.selectedIds.length > 0,
  params: hideForEveryoneParams,
  run: (std, _invocation, params) => {
    const parsed = hideForEveryoneParams.safeParse(params ?? {});
    if (!parsed.success) return;
    if (parsed.data.layerIds) {
      const hidden = parsed.data.hidden ?? true;
      const count = setUserLayersHiddenForEveryone(
        std,
        parsed.data.layerIds,
        hidden
      );
      reportVisibility(std, hidden, count, 'everyone', 'layer');
      return;
    }
    const ids =
      parsed.data.ids ?? std.get(GfxControllerIdentifier).selection.selectedIds;
    const hidden = parsed.data.hidden ?? true;
    const count = setPaneElementsHiddenForEveryone(std, ids, hidden);
    reportVisibility(std, hidden, count, 'everyone');
  },
};

/**
 * Show everything this viewer hid. Stays in the palette whatever the pane
 * seam says: with `SelectionPaneExtension(null)` it is the one way back.
 */
const showAll: AnyCommandDescriptor = {
  id: 'canvas.visibility.showAll',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.visibility.show-all',
  labelFallback: 'Show hidden elements',
  descriptionKey: 'com.labre.command.canvas.visibility.show-all.description',
  descriptionFallback:
    'Show again every element and layer you hid on your screen.',
  surfaces: ['palette', 'agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  when: std => {
    const visibility = std.getOptional(CanvasLocalVisibility);
    return (
      (visibility?.hiddenIds$.peek().size ?? 0) > 0 ||
      (visibility?.hiddenLayerIds$.peek().size ?? 0) > 0
    );
  },
  run: std => {
    const visibility = std.getOptional(CanvasLocalVisibility);
    reportVisibility(std, false, visibility?.showAll() ?? 0);
    reportVisibility(
      std,
      false,
      visibility?.showAllLayers() ?? 0,
      'local',
      'layer'
    );
  },
};

export const selectionPaneCommands: AnyCommandDescriptor[] = [
  toggleSelectionPane,
  reorderElement,
  lockCommand(true),
  lockCommand(false),
  renameGroup,
  renameFrame,
  hideLocal,
  hideForEveryone,
  showAll,
];
