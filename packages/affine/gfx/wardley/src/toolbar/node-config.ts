import {
  neutralPalettes,
  paletteColorAction,
  shapeToolbarConfig,
} from '@labre/affine-gfx-shape';
import type { Palette } from '@labre/affine-model';
import {
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';

import { INERTIA_COLOR, METHOD_FILL, WARDLEY_RED } from '../node/consts';

/**
 * The Wardley **evolution cycle**, surfaced as ready-made swatches in the node
 * colour picker: Wonder / Peace / War, the three climatic phases a component
 * travels through in Simon Wardley's pattern — saturated first, then the light
 * shades for a fill under a label — followed by the three colours the notation
 * itself already uses (the evolution arrow's red, the inertia bar, a method's
 * neutral fill).
 *
 * They are SHORTCUTS, never constraints: nothing in the map reads a colour, so
 * an author is free to ignore them, and the custom picker stays one click away.
 */
const WARDLEY_PALETTES: Palette[] = [
  { key: 'Wonder', value: '#3ec9f2' },
  { key: 'Peace', value: '#5b9cf6' },
  { key: 'War', value: '#9d6df0' },
  { key: 'Wonder light', value: '#b9e9fa' },
  { key: 'Peace light', value: '#c6dbfc' },
  { key: 'War light', value: '#d9c9fa' },
  { key: 'Wardley red', value: WARDLEY_RED },
  { key: 'Inertia', value: INERTIA_COLOR },
  { key: 'Method grey', value: METHOD_FILL },
];

/**
 * From the default editor palette we keep ONLY the neutrals — the historical
 * colours are dropped in favour of the Wardley swatches above.
 */
export const WARDLEY_PALETTE_LIST: Palette[] = [
  ...WARDLEY_PALETTES,
  ...neutralPalettes(),
];

/**
 * Wardley nodes are {@link ShapeElementModel} subclasses, so the shape toolbar's
 * actions (which target `getSurfaceModelsByType(ShapeElementModel)`) operate on
 * them directly. We re-register only the line-style action plus a colour picker
 * seeded with the Wardley swatches, so the circle's fill / stroke color / stroke
 * width stay editable — while excluding the shape-only actions (switch type, add
 * inner text, edit vertices) that don't make sense for a Wardley node.
 */
const KEEP_ACTION_IDS = new Set(['d.style']);

const wardleyNodeToolbarConfig = {
  actions: [
    ...shapeToolbarConfig.actions.filter(action =>
      KEEP_ACTION_IDS.has(action.id)
    ),
    paletteColorAction('e.color', WARDLEY_PALETTE_LIST),
  ],
  when: shapeToolbarConfig.when,
} as ToolbarModuleConfig;

export const wardleyNodeToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:wardleyNode'),
  config: wardleyNodeToolbarConfig,
});
