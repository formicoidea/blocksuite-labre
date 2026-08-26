import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import { BpmnPoolElementModel } from '@labre/affine-model';
import {
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
  translateKey,
} from '@labre/affine-shared/services';
import {
  BlockFlavourIdentifier,
  getRegisteredCommands,
  runCommand,
} from '@labre/std';
import { html, type TemplateResult } from 'lit';

import { bpmnLaneAddIcon, bpmnLaneRemoveIcon } from './icons.js';

const ResizeIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M9 5H5v4M15 19h4v-4" />
  <path d="M5 5l6 6M19 19l-6-6" />
</svg>`;

type BpmnPoolToggleProp = 'resizeEnabled';

/**
 * Build a toolbar toggle that flips a boolean flag on every selected pool:
 * `active` reflects the current state, `run` flips it (with an undo checkpoint).
 */
function booleanToggle(
  id: string,
  tooltip: string,
  icon: TemplateResult,
  prop: BpmnPoolToggleProp
) {
  return {
    id,
    tooltip,
    icon,
    active(ctx: ToolbarContext) {
      const models = ctx.getSurfaceModelsByType(BpmnPoolElementModel);
      return models.length > 0 && models.every(model => model[prop]);
    },
    run(ctx: ToolbarContext) {
      const models = ctx.getSurfaceModelsByType(BpmnPoolElementModel);
      if (!models.length) return;

      const enable = !models.every(model => model[prop]);
      ctx.std.store.captureSync();
      const crud = ctx.std.get(EdgelessCRUDIdentifier);
      for (const model of models) {
        crud.updateElement(model.id, { [prop]: enable });
      }
    },
  };
}

/**
 * A toolbar entry that INVOKES a registered command instead of restating what
 * it does — the shape `docs/adr/0010` M3 introduced for the typed-edge
 * inversion, and the reason a lane gesture has one behaviour, one availability
 * rule and one telemetry emission whether it is reached from here, from the
 * palette, from Settings › Shortcuts or from the agent.
 *
 * `generate` rather than a static entry because the i18n seam needs `std`:
 * `translateKey` is what reaches the host's catalogue, and a hard-coded English
 * tooltip would be the one wording a host could not override.
 */
function commandAction(
  id: string,
  commandId: string,
  labelKey: string,
  labelFallback: string,
  icon: TemplateResult
) {
  return {
    id,
    when: (ctx: ToolbarContext) => {
      const command = findCommand(ctx, commandId);
      return command !== undefined && (command.when?.(ctx.std) ?? true);
    },
    generate: (ctx: ToolbarContext) => {
      const label = translateKey(ctx.std, labelKey, labelFallback);
      return {
        icon,
        tooltip: label,
        run: (runCtx: ToolbarContext) => {
          const command = findCommand(runCtx, commandId);
          if (!command) return;
          runCommand(runCtx.std, command, {
            surface: 'contextual-toolbar',
            source: 'toolbar:general',
          });
        },
      };
    },
  };
}

const findCommand = (ctx: ToolbarContext, id: string) =>
  getRegisteredCommands(ctx.std).find(candidate => candidate.id === id);

export const bpmnPoolToolbarConfig = {
  actions: [
    booleanToggle(
      'a.toggle-resize',
      'Enable / lock resizing',
      ResizeIcon,
      'resizeEnabled'
    ),
    // The two lane gestures, next to the resize toggle: everything on this row
    // is about the SHAPE of the pool rather than about what is drawn in it.
    // Add before remove, because that is the order they can be used in — a pool
    // has no lane to remove until one has been added.
    commandAction(
      'b.add-lane',
      'bpmn.addLane',
      'com.labre.commands.bpmn.addLane',
      'Add lane',
      bpmnLaneAddIcon
    ),
    commandAction(
      'b.remove-lane',
      'bpmn.removeLane',
      'com.labre.commands.bpmn.removeLane',
      'Remove lane',
      bpmnLaneRemoveIcon
    ),
  ],
  when: ctx => ctx.getSurfaceModelsByType(BpmnPoolElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const bpmnPoolToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:bpmnPool'),
  config: bpmnPoolToolbarConfig,
});
