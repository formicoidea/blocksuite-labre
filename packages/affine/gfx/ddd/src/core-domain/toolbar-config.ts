import { CoreDomainChartElementModel } from '@labre/affine-model';
import {
  TelemetryProvider,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';
import { html } from 'lit';

import { createCoreDomainLegend } from './legend';

const legendIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6" />
  <circle cx="7" cy="9" r="1.6" fill="currentColor" />
  <circle cx="7" cy="14" r="1.6" fill="currentColor" />
  <path d="M11 9 H18 M11 14 H18" stroke="currentColor" stroke-width="1.4" />
</svg>`;

/** Contextual toolbar for a selected Core Domain background: insert its legend. */
const coreDomainToolbarConfig = {
  actions: [
    {
      id: 'a.legend',
      tooltip: 'Insert legend (notation present in the chart)',
      icon: legendIcon,
      run(ctx) {
        const bg = ctx.getSurfaceModelsByType(CoreDomainChartElementModel)[0];
        if (!bg) return;
        createCoreDomainLegend(ctx.std, bg);
        ctx.std.getOptional(TelemetryProvider)?.track('FrameworkLegendCreated', {
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
