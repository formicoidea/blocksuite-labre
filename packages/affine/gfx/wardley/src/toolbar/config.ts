import {
  EdgelessCRUDIdentifier,
  legendToolbarAction,
  validationToolbarConfig,
} from '@labre/affine-block-surface';
import { WardleyBackgroundElementModel } from '@labre/affine-model';
import {
  BOARD_LEGEND_COMPONENTS,
  BOARD_RESIZE_TOGGLE,
  type ChromeWording,
  commandMoreAction,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';
import { html, type TemplateResult } from 'lit';

import { wardleyExportOwmIcon, wardleyLegendIcon } from './icons';

/** The seven toolbar tooltips this file used to hard-code as English literals. */
const EVOLUTION_AXIS_TOGGLE: ChromeWording = [
  'com.labre.wardley.toolbar.evolution-axis',
  'Evolution axis (X)',
];
const EVOLUTION_PHASE_LABELS_TOGGLE: ChromeWording = [
  'com.labre.wardley.toolbar.evolution-phase-labels',
  'Evolution phase labels',
];
const COLUMNS_TOGGLE: ChromeWording = [
  'com.labre.wardley.toolbar.columns',
  'Columns (dividers)',
];
const CORNER_LABELS_TOGGLE: ChromeWording = [
  'com.labre.wardley.toolbar.corner-labels',
  'Labels Uncharted / Industrialized',
];
const GRADIENT_TOGGLE: ChromeWording = [
  'com.labre.wardley.toolbar.gradient',
  'Show / hide the gradient',
];
const VALUE_CHAIN_AXIS_TOGGLE: ChromeWording = [
  'com.labre.wardley.toolbar.value-chain-axis',
  'Value Chain axis (Y)',
];
const VISIBILITY_LABELS_TOGGLE: ChromeWording = [
  'com.labre.wardley.toolbar.visibility-labels',
  'Labels Visible / Invisible',
];

/** Every wording above, for `translations.ts`'s manifest contribution. */
export const WARDLEY_TOOLBAR_WORDINGS: readonly ChromeWording[] = [
  EVOLUTION_AXIS_TOGGLE,
  EVOLUTION_PHASE_LABELS_TOGGLE,
  COLUMNS_TOGGLE,
  CORNER_LABELS_TOGGLE,
  GRADIENT_TOGGLE,
  VALUE_CHAIN_AXIS_TOGGLE,
  VISIBILITY_LABELS_TOGGLE,
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

/** Gradient swatch — show/hide the variant gradient. */
const GradientIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <defs>
    <linearGradient id="wardleyToolbarGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="currentColor" stop-opacity="0.85" />
      <stop offset="1" stop-color="currentColor" stop-opacity="0.1" />
    </linearGradient>
  </defs>
  <rect
    x="4"
    y="5"
    width="16"
    height="14"
    rx="2"
    fill="url(#wardleyToolbarGrad)"
    stroke="currentColor"
    stroke-width="1.4"
  />
</svg>`;

/** Horizontal axis with a right-pointing arrow (Evolution / X). */
const XAxisIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M3 17h15" />
  <path d="M15 14l3 3-3 3" />
</svg>`;

/** Vertical axis with an up-pointing arrow (Value Chain / Y). */
const YAxisIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M7 21V6" />
  <path d="M4 9l3-3 3 3" />
</svg>`;

/** Dashed vertical column dividers. */
const ColumnsIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-dasharray="3 3"
>
  <path d="M9 4v16M15 4v16" />
</svg>`;

/** Column labels (short bars under the columns). */
const ColumnLabelsIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="currentColor"
  stroke="none"
>
  <rect x="3" y="15" width="4.5" height="3" rx="1" />
  <rect x="9.75" y="15" width="4.5" height="3" rx="1" />
  <rect x="16.5" y="15" width="4.5" height="3" rx="1" />
</svg>`;

/** Corner labels (Uncharted / Industrialized, top corners). */
const CornerLabelsIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="currentColor"
  stroke="none"
>
  <rect x="3" y="5" width="6" height="3" rx="1" />
  <rect x="15" y="5" width="6" height="3" rx="1" />
</svg>`;

/** Visibility labels (Visible / Invisible) — an eye. */
const VisibilityIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
  <circle cx="12" cy="12" r="2.4" />
</svg>`;

type WardleyToggleProp =
  | 'resizeEnabled'
  | 'showGradient'
  | 'showXAxis'
  | 'showYAxis'
  | 'showColumnDividers'
  | 'showColumnLabels'
  | 'showCornerLabels'
  | 'showVisibilityLabels';

/**
 * Build a toolbar toggle that flips a boolean flag on every selected Wardley
 * background: `active` reflects the current state, `run` flips it (with an
 * undo checkpoint). An optional `when` predicate hides the button.
 */
function booleanToggle(
  id: string,
  tooltip: string | ChromeWording,
  icon: TemplateResult,
  prop: WardleyToggleProp,
  when?: (ctx: ToolbarContext) => boolean
) {
  return {
    id,
    tooltip: typeof tooltip === 'string' ? tooltip : tooltip[1],
    // The declared wording, when the caller gave one instead of a literal:
    // `combine` resolves it against the host's catalogue and writes it over
    // the English default above, so a playground with no catalogue reads
    // exactly what it read before (#183).
    tooltipWording: typeof tooltip === 'string' ? undefined : tooltip,
    icon,
    when: when ?? true,
    active(ctx: ToolbarContext) {
      const models = ctx.getSurfaceModelsByType(WardleyBackgroundElementModel);
      return models.length > 0 && models.every(model => model[prop]);
    },
    run(ctx: ToolbarContext) {
      const models = ctx.getSurfaceModelsByType(WardleyBackgroundElementModel);
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

export const wardleyToolbarConfig = {
  actions: [
    booleanToggle(
      'a.toggle-resize',
      BOARD_RESIZE_TOGGLE,
      ResizeIcon,
      'resizeEnabled'
    ),
    // Group 1 — evolution (X) side: axis, phase labels, columns, corner
    // labels, and the gradient toggle.
    {
      id: 'b.evolution',
      actions: [
        booleanToggle(
          'b.1-axis-x',
          EVOLUTION_AXIS_TOGGLE,
          XAxisIcon,
          'showXAxis'
        ),
        booleanToggle(
          'b.2-column-labels',
          EVOLUTION_PHASE_LABELS_TOGGLE,
          ColumnLabelsIcon,
          'showColumnLabels'
        ),
        booleanToggle(
          'b.3-columns',
          COLUMNS_TOGGLE,
          ColumnsIcon,
          'showColumnDividers'
        ),
        booleanToggle(
          'b.4-corner-labels',
          CORNER_LABELS_TOGGLE,
          CornerLabelsIcon,
          'showCornerLabels'
        ),
        // Only relevant when the selection has a gradient variant.
        booleanToggle(
          'b.5-gradient',
          GRADIENT_TOGGLE,
          GradientIcon,
          'showGradient',
          ctx =>
            ctx
              .getSurfaceModelsByType(WardleyBackgroundElementModel)
              .some(model => model.variant !== 'classic')
        ),
      ],
    },
    // Group 2 — value-chain (Y) side: axis and Visible/Invisible labels.
    {
      id: 'c.value-chain',
      actions: [
        booleanToggle(
          'c.1-axis-y',
          VALUE_CHAIN_AXIS_TOGGLE,
          YAxisIcon,
          'showYAxis'
        ),
        booleanToggle(
          'c.2-visibility-labels',
          VISIBILITY_LABELS_TOGGLE,
          VisibilityIcon,
          'showVisibilityLabels'
        ),
      ],
    },
    // The OWM export, in the "⋮" — R5 of
    // `docs/add-a-framework/02-framework-rules.md`, the position
    // `bpmn.exportXml` and `c4.exportMermaid` already hold on their own boards.
    // This module is registered ALWAYS-ON (`view.ts`) while the commands are
    // flag-gated, and that needs no extra guard: the entry's `when` looks the
    // command up in the registry and withdraws when the wardley flag left it
    // unregistered.
    commandMoreAction(
      'z.export-owm',
      'wardley.exportOwm',
      'com.labre.commands.wardley.exportOwm',
      'Export Wardley map (OWM)',
      wardleyExportOwmIcon
    ),
  ],
  when: ctx =>
    ctx.getSurfaceModelsByType(WardleyBackgroundElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const wardleyToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:wardley'),
  config: wardleyToolbarConfig,
});

/**
 * The map's flag-gated row, WHOLE: the Legend button and the Validation
 * dropdown, in one module.
 *
 * ## Why they cannot be two modules
 *
 * `renderToolbar` merges exactly four slots per element — `<flavour>`,
 * `custom:<flavour>` and the two `affine:surface:*` wildcards — and
 * `ToolbarModuleExtension` binds by DI variant, so a second module claiming
 * `custom:affine:surface:wardley` would throw
 * `DuplicateServiceDefinitionError` before the editor finished setting up. Two
 * slots, and Wardley has three things to put on a selected map: the axis and
 * label toggles (always-on, `<flavour>`, above), the legend and the level of
 * requirement. The precedent is C4's `c4BoardToolingToolbarConfig`.
 *
 * ## Why the legend moved OUT of the always-on half
 *
 * Because GENERATING one is tooling, and `docs/adr/0009` gates tooling: the
 * flag off takes away the gesture that writes legend elements, exactly as it
 * takes away the sub-menu that draws components. What the gesture already
 * wrote is document CONTENT and keeps being painted — the box is plain shapes,
 * text and `wardleyNode`s with no role, all drawn by the always-on renderers.
 * The axis and label toggles stay always-on for the opposite reason: a stored
 * map must keep its axes whatever the flag says.
 *
 * Sorting keeps the row readable across the merge — `a.` … `d.legend` from the
 * two modules, then `z.validation` — whatever order they were registered in.
 */
export const wardleyBoardToolingToolbarConfig: ToolbarModuleConfig = {
  actions: [
    // `d.legend` and not the factory's default `b.legend`: the row is sorted
    // lexicographically by id and the two axis groups already hold `b.` and
    // `c.`, so the legend reads after the toggles it documents the map beside.
    legendToolbarAction({
      id: 'd.legend',
      Model: WardleyBackgroundElementModel,
      owner: 'wardley',
      framework: 'wardley',
      tooltipWording: BOARD_LEGEND_COMPONENTS,
      icon: wardleyLegendIcon,
    }),
    // The generic dropdown, not a Wardley variant of it: the config names no
    // framework — it reads the registered rules and profiles — so this is the
    // very same object c4, bpmn and the context map register.
    ...validationToolbarConfig.actions,
  ],
  when: wardleyToolbarConfig.when,
};

export const wardleyBoardToolingToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:surface:wardley'),
  config: wardleyBoardToolingToolbarConfig,
});
