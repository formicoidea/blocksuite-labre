import {
  EdgelessCRUDIdentifier,
  legendToolbarAction,
  validationToolbarConfig,
} from '@labre/affine-block-surface';
import {
  EdgyBoardElementModel,
  EdgyFacetsElementModel,
} from '@labre/affine-model';
import {
  BOARD_RESIZE_TOGGLE,
  type ChromeWording,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';
import { html, type TemplateResult } from 'lit';

/** The two toolbar tooltips this file used to hard-code as English literals. */
const FACET_LABELS_TOGGLE: ChromeWording = [
  'com.labre.edgy.toolbar.facet-labels',
  'Show / hide facet labels',
];
const HOVER_SPOTLIGHT_TOGGLE: ChromeWording = [
  'com.labre.edgy.toolbar.hover-spotlight',
  'Enable / disable hover spotlight',
];

/** Every wording above, for `translations.ts`'s manifest contribution. */
export const EDGY_TOOLBAR_WORDINGS: readonly ChromeWording[] = [
  FACET_LABELS_TOGGLE,
  HOVER_SPOTLIGHT_TOGGLE,
];

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
  tooltip: string | ChromeWording,
  icon: TemplateResult,
  prop: 'resizeEnabled' | 'showLabels' | 'spotlightEnabled'
) {
  const models = (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(Model) as unknown as Record<string, boolean>[];
  return {
    id,
    tooltip: typeof tooltip === 'string' ? tooltip : tooltip[1],
    // The declared wording, when the caller gave one instead of a literal:
    // `combine` resolves it against the host's catalogue and writes it over
    // the English default above, so a playground with no catalogue reads
    // exactly what it read before (#183).
    tooltipWording: typeof tooltip === 'string' ? undefined : tooltip,
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

export const edgyToolbarConfig = {
  actions: [
    booleanToggle(
      EdgyFacetsElementModel,
      'a.toggle-resize',
      BOARD_RESIZE_TOGGLE,
      ResizeIcon,
      'resizeEnabled'
    ),
    booleanToggle(
      EdgyFacetsElementModel,
      'b.toggle-labels',
      FACET_LABELS_TOGGLE,
      LabelsIcon,
      'showLabels'
    ),
    // No spotlight toggle here: the hover spotlight is BOARD logic and lives on
    // the EDGY board toolbar below. The Venn only carries APPEARANCE (#195).
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
      BOARD_RESIZE_TOGGLE,
      ResizeIcon,
      'resizeEnabled'
    ),
    booleanToggle(
      EdgyBoardElementModel,
      'b.toggle-spotlight',
      HOVER_SPOTLIGHT_TOGGLE,
      SpotlightIcon,
      'spotlightEnabled'
    ),
  ],
  when: ctx => ctx.getSurfaceModelsByType(EdgyBoardElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const edgyBoardToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:edgyBoard'),
  config: edgyBoardToolbarConfig,
});

/**
 * A background's flag-gated row, WHOLE: the legend button and the Validation
 * dropdown, in ONE module — registered by `EdgyViewExtension` on the `custom:`
 * flavour slot of each of the two frames.
 *
 * ## Why one module and not two
 *
 * `renderToolbar` merges exactly four slots per element and
 * `ToolbarModuleExtension` binds by DI variant, so a second module claiming
 * `custom:affine:surface:edgy` throws `DuplicateServiceDefinitionError` before
 * the editor finishes setting up. The always-on module above holds the
 * APPEARANCE toggles a stored board must keep; these two entries are gated by
 * the same flag and appear together or not at all.
 *
 * ## Why the legend moved out of the always-on half
 *
 * It used to sit with the toggles, argued as authoring. `docs/adr/0026` (which
 * amends `docs/adr/0009`) reverses that reading: GENERATING a legend is
 * tooling — it is the framework telling you what its notation means — while the
 * legend it wrote is content, made of plain shapes, text and this pack's own
 * always-on renderers, and keeps being painted with the flag off.
 *
 * `c.legend` and not the factory's default `b.`: the sort is lexicographic and
 * both frames already spend `a.` and `b.` on their toggles.
 */
function toolingConfig<
  T extends typeof EdgyFacetsElementModel | typeof EdgyBoardElementModel,
>(Model: T): ToolbarModuleConfig {
  return {
    actions: [
      legendToolbarAction({
        id: 'c.legend',
        Model,
        owner: 'edgy',
        framework: 'edgy',
      }),
      // The generic dropdown, not an EDGY variant of it: the config names no
      // framework — it reads the registered rules and profiles — so this is the
      // very same object wardley, bpmn, the context map and C4 register.
      ...validationToolbarConfig.actions,
    ],
    when: (ctx: ToolbarContext) => ctx.getSurfaceModelsByType(Model).length > 0,
  };
}

export const edgyToolingToolbarConfig = toolingConfig(EdgyFacetsElementModel);
export const edgyBoardToolingToolbarConfig = toolingConfig(
  EdgyBoardElementModel
);

export const edgyToolingToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:surface:edgy'),
  config: edgyToolingToolbarConfig,
});

export const edgyBoardToolingToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:surface:edgyBoard'),
  config: edgyBoardToolingToolbarConfig,
});
