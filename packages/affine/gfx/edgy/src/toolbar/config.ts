import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import {
  createAutoLegend,
  dddLegendIcon,
} from '@labre/affine-gfx-ddd-shared';
import {
  EdgyBoardElementModel,
  EdgyFacetsElementModel,
} from '@labre/affine-model';
import {
  TelemetryProvider,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';
import { html, type TemplateResult } from 'lit';

import { EDGY_AUTO_LEGEND } from '../legend';

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

/** Tag — show / hide the facet name labels. */
const LabelsIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M3 8.5l6-4.5 12 0 0 16-12 0-6-4.5z" />
  <circle cx="8" cy="12" r="1.4" />
</svg>`;

/** Spot with rays — enable / disable the hover spotlight. */
const SpotlightIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
>
  <circle cx="12" cy="12" r="3.4" />
  <path
    d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20M6.3 6.3l1.8 1.8M15.9 15.9l1.7 1.7M17.7 6.3l-1.8 1.8M8.1 15.9l-1.7 1.7"
  />
</svg>`;

/**
 * Build a toolbar toggle that flips a boolean flag on every selected element
 * of the given class: `active` reflects the current state, `run` flips it
 * (with an undo checkpoint).
 */
function booleanToggle<
  T extends typeof EdgyFacetsElementModel | typeof EdgyBoardElementModel,
>(
  Model: T,
  id: string,
  tooltip: string,
  icon: TemplateResult,
  prop: 'resizeEnabled' | 'showLabels' | 'spotlightEnabled'
) {
  const models = (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(Model) as unknown as Record<string, boolean>[];
  return {
    id,
    tooltip,
    icon,
    active(ctx: ToolbarContext) {
      const all = models(ctx);
      return all.length > 0 && all.every(model => model[prop]);
    },
    run(ctx: ToolbarContext) {
      const all = models(ctx);
      if (!all.length) return;

      const enable = !all.every(model => model[prop]);
      ctx.std.store.captureSync();
      const crud = ctx.std.get(EdgelessCRUDIdentifier);
      for (const model of all) {
        crud.updateElement((model as unknown as { id: string }).id, {
          [prop]: enable,
        });
      }
    },
  };
}

/**
 * The legend action, shared by the two EDGY backgrounds: both frame the same
 * notation, so both answer the same question — "what is actually drawn here" —
 * with the same table ({@link EDGY_AUTO_LEGEND}) and the same box.
 *
 * Registered ALWAYS-ON (`EdgyRenderViewExtension`) with the toggles it sits
 * next to: a legend is real, editable elements written into the document, so
 * generating one is authoring, not tooling a flag may take away
 * (`docs/adr/0009`).
 */
function legendAction<
  T extends typeof EdgyFacetsElementModel | typeof EdgyBoardElementModel,
>(Model: T, id: string) {
  return {
    id,
    tooltip: 'Generate the legend (notation present)',
    icon: dddLegendIcon,
    run(ctx: ToolbarContext) {
      const background = ctx.getSurfaceModelsByType(Model)[0] as unknown as
        | { xywh: string }
        | undefined;
      if (!background) return;
      createAutoLegend(ctx.std, background, EDGY_AUTO_LEGEND);
      ctx.std.getOptional(TelemetryProvider)?.track('FrameworkLegendCreated', {
        // The WIRE value from `frameworks.ts` (`telemetryKey`), which for EDGY
        // happens to be the module id itself. Same field set as Wardley's and
        // the three DDD legend buttons, so the four are comparable.
        framework: 'edgy',
        element: 'legend',
        page: 'whiteboard editor',
        segment: 'element toolbar',
        module: 'edgy toolbar',
      });
    },
  };
}

export const edgyToolbarConfig = {
  actions: [
    booleanToggle(
      EdgyFacetsElementModel,
      'a.toggle-resize',
      'Enable / lock resizing',
      ResizeIcon,
      'resizeEnabled'
    ),
    booleanToggle(
      EdgyFacetsElementModel,
      'b.toggle-labels',
      'Show / hide facet labels',
      LabelsIcon,
      'showLabels'
    ),
    booleanToggle(
      EdgyFacetsElementModel,
      'c.toggle-spotlight',
      'Enable / disable hover spotlight',
      SpotlightIcon,
      'spotlightEnabled'
    ),
    legendAction(EdgyFacetsElementModel, 'd.legend'),
  ],
  when: ctx => ctx.getSurfaceModelsByType(EdgyFacetsElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const edgyToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:edgy'),
  config: edgyToolbarConfig,
});

export const edgyBoardToolbarConfig = {
  actions: [
    booleanToggle(
      EdgyBoardElementModel,
      'a.toggle-resize',
      'Enable / lock resizing',
      ResizeIcon,
      'resizeEnabled'
    ),
    booleanToggle(
      EdgyBoardElementModel,
      'b.toggle-spotlight',
      'Enable / disable hover spotlight',
      SpotlightIcon,
      'spotlightEnabled'
    ),
    legendAction(EdgyBoardElementModel, 'c.legend'),
  ],
  when: ctx => ctx.getSurfaceModelsByType(EdgyBoardElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const edgyBoardToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:edgyBoard'),
  config: edgyBoardToolbarConfig,
});
