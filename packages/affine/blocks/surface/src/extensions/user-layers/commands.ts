import { TelemetryProvider } from '@labre/affine-shared/services';
import type {
  AnyCommandDescriptor,
  BlockStdScope,
  CommandDescriptor,
} from '@labre/std';
import { DEFAULT_LAYER_ID, GfxControllerIdentifier } from '@labre/std/gfx';
import { z } from 'zod';

import {
  createUserLayer,
  deleteUserLayer,
  moveModelsToUserLayer,
  renameUserLayer,
  reorderUserLayer,
  userLayersBottomUp,
} from './actions.js';

/**
 * The user layers' commands (ADR 0031 §12), `owner: 'core'`, on the palette
 * and the agent. The library's pane runs them through `runCommand`, and so
 * does a host's: the read-only refusal and the undo step live in the
 * actions, once.
 *
 * Each self-emits `CanvasLayerChanged` (see the telemetry README) when it
 * wrote something — ids and counts only, never a layer name.
 */

export type CanvasLayerAction =
  | 'create'
  | 'rename'
  | 'reorder'
  | 'delete'
  | 'move-elements';

export function reportLayerChange(
  std: BlockStdScope,
  action: CanvasLayerAction,
  memberCount?: number
) {
  const layerCount = userLayersBottomUp(
    std.get(GfxControllerIdentifier).surface
  ).length;
  std.getOptional(TelemetryProvider)?.track('CanvasLayerChanged', {
    page: 'whiteboard editor',
    action,
    layerCount,
    ...(memberCount === undefined ? {} : { memberCount }),
  });
}

export const createLayerParams = z.object({
  /** Omitted: the seeded name, "Layer n". */
  name: z.string().optional(),
});

export type CreateLayerParams = z.infer<typeof createLayerParams>;

const createLayer: CommandDescriptor<CreateLayerParams> = {
  id: 'canvas.layer.create',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.layer.create',
  labelFallback: 'New layer',
  descriptionKey: 'com.labre.command.canvas.layer.create.description',
  descriptionFallback:
    'Add a layer on top of the others. New elements go into it until you choose another.',
  keywords: ['layer', 'calque'],
  surfaces: ['palette', 'agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  params: createLayerParams,
  run: (std, _invocation, params) => {
    const parsed = createLayerParams.safeParse(params ?? {});
    if (!parsed.success) return;
    if (createUserLayer(std, parsed.data.name) === null) return;
    reportLayerChange(std, 'create');
  },
};

export const renameLayerParams = z.object({
  id: z.string().min(1),
  name: z.string(),
});

export type RenameLayerParams = z.infer<typeof renameLayerParams>;

const renameLayer: CommandDescriptor<RenameLayerParams> = {
  id: 'canvas.layer.rename',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.layer.rename',
  labelFallback: 'Rename layer',
  descriptionKey: 'com.labre.command.canvas.layer.rename.description',
  descriptionFallback: 'Give a layer a new name.',
  surfaces: ['agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  params: renameLayerParams,
  run: (std, _invocation, params) => {
    const parsed = renameLayerParams.safeParse(params);
    if (!parsed.success) {
      console.error('canvas.layer.rename: invalid params', parsed.error);
      return;
    }
    if (!renameUserLayer(std, parsed.data.id, parsed.data.name)) return;
    reportLayerChange(std, 'rename');
  },
};

export const reorderLayerParams = z.object({
  id: z.string().min(1),
  /** The layer it lands directly ABOVE; `null` puts it at the bottom. */
  above: z.string().min(1).nullable(),
});

export type ReorderLayerParams = z.infer<typeof reorderLayerParams>;

const reorderLayer: CommandDescriptor<ReorderLayerParams> = {
  id: 'canvas.layer.reorder',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.layer.reorder',
  labelFallback: 'Move layer',
  descriptionKey: 'com.labre.command.canvas.layer.reorder.description',
  descriptionFallback:
    'Place a layer directly above another one: everything in it stacks there.',
  surfaces: ['agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  params: reorderLayerParams,
  run: (std, _invocation, params) => {
    const parsed = reorderLayerParams.safeParse(params);
    if (!parsed.success) {
      console.error('canvas.layer.reorder: invalid params', parsed.error);
      return;
    }
    if (!reorderUserLayer(std, parsed.data.id, parsed.data.above)) return;
    reportLayerChange(std, 'reorder');
  },
};

export const moveElementsToLayerParams = z.object({
  /** Omitted: the current canvas selection. */
  ids: z.array(z.string()).optional(),
  layerId: z.string().min(1),
});

export type MoveElementsToLayerParams = z.infer<
  typeof moveElementsToLayerParams
>;

const moveElementsToLayer: CommandDescriptor<MoveElementsToLayerParams> = {
  id: 'canvas.layer.moveElements',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.layer.move-elements',
  labelFallback: 'Move to layer',
  descriptionKey: 'com.labre.command.canvas.layer.move-elements.description',
  descriptionFallback:
    'Move the selected elements to another layer. A grouped element moves with its group.',
  surfaces: ['agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  params: moveElementsToLayerParams,
  run: (std, _invocation, params) => {
    const parsed = moveElementsToLayerParams.safeParse(params);
    if (!parsed.success) {
      console.error('canvas.layer.moveElements: invalid params', parsed.error);
      return;
    }
    const ids =
      parsed.data.ids ?? std.get(GfxControllerIdentifier).selection.selectedIds;
    const count = moveModelsToUserLayer(std, ids, parsed.data.layerId);
    if (!count) return;
    reportLayerChange(std, 'move-elements', count);
  },
};

export const deleteLayerParams = z.object({
  /** The layer to delete; `'@default'` is refused. */
  id: z.string().min(1),
});

export type DeleteLayerParams = z.infer<typeof deleteLayerParams>;

/**
 * Delete a layer and everything in it, in one undo step (ADR 0031 §10). The
 * default layer cannot be deleted, which is what keeps a canvas at one layer
 * at least (ADR 0031 amendments): with the default layer alone — recorded or
 * not — there is nothing to delete, so `when` withdraws the command rather
 * than letting it fail.
 */
const deleteLayer: CommandDescriptor<DeleteLayerParams> = {
  id: 'canvas.layer.delete',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.layer.delete',
  labelFallback: 'Delete layer',
  descriptionKey: 'com.labre.command.canvas.layer.delete.description',
  descriptionFallback:
    'Delete a layer and every element in it. One undo brings them all back.',
  surfaces: ['agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  when: std =>
    userLayersBottomUp(std.get(GfxControllerIdentifier).surface).some(
      layer => layer.id !== DEFAULT_LAYER_ID
    ),
  params: deleteLayerParams,
  run: (std, _invocation, params) => {
    const parsed = deleteLayerParams.safeParse(params);
    if (!parsed.success) {
      console.error('canvas.layer.delete: invalid params', parsed.error);
      return;
    }
    const removed = deleteUserLayer(std, parsed.data.id);
    if (removed === null) return;
    reportLayerChange(std, 'delete', removed);
  },
};

export const userLayerCommands: AnyCommandDescriptor[] = [
  createLayer,
  renameLayer,
  reorderLayer,
  moveElementsToLayer,
  deleteLayer,
];
