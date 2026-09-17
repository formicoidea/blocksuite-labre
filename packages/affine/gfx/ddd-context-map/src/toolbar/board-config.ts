import {
  EdgelessCRUDIdentifier,
  legendToolbarAction,
  validationToolbarConfig,
} from '@labre/affine-block-surface';
import { ContextMapBoardElementModel } from '@labre/affine-model';
import {
  BOARD_RESIZE_TOGGLE,
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
 * The selected board's ALWAYS-ON row: the resize toggle, and nothing else. A
 * stored board must stay usable with the Context Map button switched off
 * (`docs/adr/0009`) — it keeps its handles, and everything already drawn on it,
 * legend boxes included, keeps being painted.
 *
 * The legend BUTTON moved out of here to {@link contextMapBoardToolingToolbarConfig}
 * (`docs/adr/0026`): generating one is a gesture the flag may take away, even
 * though what it writes is document content.
 */
export const contextMapBoardToolbarConfig = {
  actions: [
    {
      id: 'a.toggle-resize',
      tooltipWording: BOARD_RESIZE_TOGGLE,
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
  ],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(ContextMapBoardElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const contextMapBoardToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:contextMap'),
  config: contextMapBoardToolbarConfig,
});

/**
 * The board's FLAG-GATED row, whole: the legend button and the Validation
 * dropdown, in one module.
 *
 * They cannot be two, and that is a hard constraint rather than a preference:
 * `ToolbarModuleExtension` binds by DI variant, so a second module claiming
 * `custom:affine:surface:contextMap` throws `DuplicateServiceDefinitionError`
 * before the editor finishes setting up. The C4 board's own row was merged this
 * way first (`c4BoardToolingToolbarConfig`).
 *
 * Both entries go with the `ddd-context-map` flag for the same reason: turning
 * it off takes away the gesture that GENERATES legend elements and the choice of
 * how hard to check the map, and leaves the stored board its handles and
 * everything already written on it. The legend rows themselves are derived from
 * `contextMapCommands` — the module writes no table (`docs/adr/0026`).
 */
export const contextMapBoardToolingToolbarConfig: ToolbarModuleConfig = {
  actions: [
    legendToolbarAction({
      Model: ContextMapBoardElementModel,
      owner: 'ddd-context-map',
      // The WIRE value, which is not the module id: the framework is
      // `ddd-context-map` in code and `context-map` in PostHog (`frameworks.ts`
      // `telemetryKey`). Unchanged by the button becoming shared.
      framework: 'context-map',
    }),
    // The generic dropdown, not a Context Map variant of it: the config names no
    // framework — it reads the registered rules and profiles — so this is the
    // very same object c4, wardley and bpmn register.
    ...validationToolbarConfig.actions,
  ],
  when: contextMapBoardToolbarConfig.when,
};
