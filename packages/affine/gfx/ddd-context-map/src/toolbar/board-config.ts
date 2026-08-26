import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import {
  createAutoLegend,
  dddLegendIcon,
} from '@labre/affine-gfx-ddd-shared';
import { ContextMapBoardElementModel } from '@labre/affine-model';
import {
  TelemetryProvider,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';
import { html } from 'lit';

import { CONTEXT_MAP_AUTO_LEGEND } from '../legend';

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
 * legend of what is actually drawn on the board. Registered ALWAYS-ON
 * (`DddContextMapRenderViewExtension`) — a stored board must stay usable with
 * the Context Map button switched off (`docs/adr/0009`), legend included: a
 * legend is real editable elements, so generating one is authoring a document,
 * not tooling that a flag may take away.
 *
 * The palette's own Legend entry is untouched and still lists the FULL notation,
 * cloud included. The two gestures answer two different questions — "what does
 * this notation mean" and "what did we actually draw here" — so the module has
 * two, on purpose.
 */
export const contextMapBoardToolbarConfig = {
  actions: [
    {
      id: 'a.toggle-resize',
      tooltip: 'Enable / lock resizing',
      icon: ResizeIcon,
      active(ctx: ToolbarContext) {
        const models = ctx.getSurfaceModelsByType(ContextMapBoardElementModel);
        return models.length > 0 && models.every(model => model.resizeEnabled);
      },
      run(ctx: ToolbarContext) {
        const models = ctx.getSurfaceModelsByType(ContextMapBoardElementModel);
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
      tooltip: 'Generate the legend (notation present)',
      icon: dddLegendIcon,
      run(ctx: ToolbarContext) {
        const board = ctx.getSurfaceModelsByType(
          ContextMapBoardElementModel
        )[0];
        if (!board) return;
        createAutoLegend(ctx.std, board, CONTEXT_MAP_AUTO_LEGEND);
        ctx.std.getOptional(TelemetryProvider)?.track('FrameworkLegendCreated', {
          // The WIRE value, which is not the module id: the framework is
          // `ddd-context-map` in code and `context-map` in PostHog
          // (`frameworks.ts` `telemetryKey`, and the only value
          // `FrameworkElementEvent` accepts). Same convention as Wardley's own
          // legend button, so the two are comparable.
          framework: 'context-map',
          element: 'legend',
          page: 'whiteboard editor',
          segment: 'element toolbar',
          module: 'context-map toolbar',
        });
      },
    },
  ],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(ContextMapBoardElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const contextMapBoardToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:contextMap'),
  config: contextMapBoardToolbarConfig,
});
