import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import { createAutoLegend, dddLegendIcon } from '@labre/affine-gfx-ddd-shared';
import { EventStormingBoardElementModel } from '@labre/affine-model';
import {
  BOARD_LEGEND_NOTATION,
  BOARD_RESIZE_TOGGLE,
  TelemetryProvider,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';
import { html } from 'lit';

import { EVENT_STORMING_AUTO_LEGEND } from '../legend';

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
 * The selected board's contextual toolbar: the resize toggle, and the automatic
 * legend of the sticky kinds actually stuck to the board. Registered ALWAYS-ON
 * (`DddEventStormingRenderViewExtension`) — a stored board must stay usable with
 * the Event Storming button switched off (`docs/adr/0009`), legend included: a
 * legend is real editable elements, so generating one is authoring a document,
 * not tooling that a flag may take away.
 *
 * This is the module's ONLY legend gesture: the Event Storming palette never had
 * a static Legend entry, and a wall of colour-coded stickies is exactly the
 * board a reader needs one for.
 */
export const eventStormingBoardToolbarConfig = {
  actions: [
    {
      id: 'a.toggle-resize',
      tooltipWording: BOARD_RESIZE_TOGGLE,
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
    {
      id: 'b.legend',
      tooltipWording: BOARD_LEGEND_NOTATION,
      icon: dddLegendIcon,
      run(ctx: ToolbarContext) {
        const board = ctx.getSurfaceModelsByType(
          EventStormingBoardElementModel
        )[0];
        if (!board) return;
        createAutoLegend(ctx.std, board, EVENT_STORMING_AUTO_LEGEND);
        ctx.std
          .getOptional(TelemetryProvider)
          ?.track('FrameworkLegendCreated', {
            // The WIRE value, which is not the module id: the framework is
            // `ddd-event-storming` in code and `event-storming` in PostHog
            // (`frameworks.ts` `telemetryKey`, and the only value
            // `FrameworkElementEvent` accepts). Same convention as Wardley's own
            // legend button, so the two are comparable.
            framework: 'event-storming',
            element: 'legend',
            page: 'whiteboard editor',
            segment: 'element toolbar',
            module: 'event-storming toolbar',
          });
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
