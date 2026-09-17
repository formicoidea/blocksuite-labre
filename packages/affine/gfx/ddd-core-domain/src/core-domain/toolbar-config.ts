import {
  legendToolbarAction,
  validationToolbarConfig,
} from '@labre/affine-block-surface';
import { CoreDomainChartElementModel } from '@labre/affine-model';
import type {
  ToolbarContext,
  ToolbarModuleConfig,
} from '@labre/affine-shared/services';

/**
 * The selected chart's FLAG-GATED row, whole: the legend button and the
 * Validation dropdown, in one module.
 *
 * They cannot be two, and that is a hard constraint rather than a preference:
 * `ToolbarModuleExtension` binds by DI variant, so a second module claiming
 * `custom:affine:surface:coreDomain` throws `DuplicateServiceDefinitionError`
 * before the editor finishes setting up. The C4 board's own row was merged this
 * way first (`c4BoardToolingToolbarConfig`).
 *
 * The chart has no always-on row left at all: the legend was its only entry, and
 * generating one is a gesture the `ddd-core-domain` flag may take away
 * (`docs/adr/0026`) — while what the gesture already WROTE is document content,
 * painted by the always-on renderers whatever the flag says. A stored chart with
 * the flag off keeps its elements, its handles and its legend boxes; it simply
 * offers no button.
 *
 * The rows themselves are derived from `coreDomainCommands` — this module writes
 * no table.
 */
export const coreDomainChartToolingToolbarConfig: ToolbarModuleConfig = {
  actions: [
    legendToolbarAction({
      // FIRST in the row, as it has been since the chart's legend button
      // shipped: the toolbar sorts lexicographically by id.
      id: 'a.legend',
      Model: CoreDomainChartElementModel,
      owner: 'ddd-core-domain',
      // The WIRE value, which is not the module id: the framework is
      // `ddd-core-domain` in code and `core-domain` in PostHog
      // (`frameworks.ts` `telemetryKey`). Unchanged by the button becoming
      // shared.
      framework: 'core-domain',
    }),
    // The generic dropdown, not a Core Domain variant of it: the config names no
    // framework — it reads the registered rules and profiles — so this is the
    // very same object c4, wardley and bpmn register.
    ...validationToolbarConfig.actions,
  ],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(CoreDomainChartElementModel).length > 0,
};
