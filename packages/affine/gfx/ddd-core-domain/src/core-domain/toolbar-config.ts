import {
  createAutoLegend,
  dddLegendIcon,
} from '@labre/affine-gfx-ddd-shared';
import { CoreDomainChartElementModel } from '@labre/affine-model';
import {
  TelemetryProvider,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';

import { CORE_DOMAIN_AUTO_LEGEND } from './legend';

/** Contextual toolbar for a selected Core Domain background: insert its legend. */
const coreDomainToolbarConfig = {
  actions: [
    {
      id: 'a.legend',
      tooltip: 'Generate the legend (notation present)',
      icon: dddLegendIcon,
      run(ctx) {
        const bg = ctx.getSurfaceModelsByType(CoreDomainChartElementModel)[0];
        if (!bg) return;
        createAutoLegend(ctx.std, bg, CORE_DOMAIN_AUTO_LEGEND);
        ctx.std.getOptional(TelemetryProvider)?.track('FrameworkLegendCreated', {
          // The WIRE value, which is not the module id: the framework is
          // `ddd-core-domain` in code and `core-domain` in PostHog
          // (`frameworks.ts` `telemetryKey`). Unchanged by this rework — the
          // button is the same gesture, it just detects by role now.
          framework: 'core-domain',
          element: 'legend',
          page: 'whiteboard editor',
          segment: 'element toolbar',
          module: 'core-domain toolbar',
        });
      },
    },
  ],
  when: ctx =>
    ctx.getSurfaceModelsByType(CoreDomainChartElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const coreDomainToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:coreDomain'),
  config: coreDomainToolbarConfig,
});
