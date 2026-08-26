import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import { EventStormingBoardElementModel } from '@labre/affine-model';
import {
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';
import { html } from 'lit';

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

/**
 * The selected board's contextual toolbar. One action, because the board has
 * one property: whether it offers its resize handles. Registered ALWAYS-ON
 * (`DddEventStormingRenderViewExtension`) — a stored board must stay usable
 * with the Event Storming button switched off (`docs/adr/0009`).
 */
export const eventStormingBoardToolbarConfig = {
  actions: [
    {
      id: 'a.toggle-resize',
      tooltip: 'Enable / lock resizing',
      icon: ResizeIcon,
      active(ctx: ToolbarContext) {
        const models = ctx.getSurfaceModelsByType(
          EventStormingBoardElementModel
        );
        return models.length > 0 && models.every(model => model.resizeEnabled);
      },
      run(ctx: ToolbarContext) {
        const models = ctx.getSurfaceModelsByType(
          EventStormingBoardElementModel
        );
        if (!models.length) return;
        const enable = !models.every(model => model.resizeEnabled);
        ctx.std.store.captureSync();
        const crud = ctx.std.get(EdgelessCRUDIdentifier);
        for (const model of models) {
          crud.updateElement(model.id, { resizeEnabled: enable });
        }
      },
    },
  ],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(EventStormingBoardElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const eventStormingBoardToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:eventStorming'),
  config: eventStormingBoardToolbarConfig,
});
