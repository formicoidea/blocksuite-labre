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

/**
 * The typical EDGY palette, surfaced as ready-made swatches in the EDGY node
 * color picker (facet + intersection colours, saturated then pastel), followed
 * by the default editor palette.
 */
const EDGY_PALETTES: Palette[] = [
  { key: 'Identity', value: '#00ea4e' },
  { key: 'Architecture', value: '#034cee' },
  { key: 'Experience', value: '#ff0056' },
  { key: 'Organisation', value: '#00caf4' },
  { key: 'Brand', value: '#ffa500' },
  { key: 'Product', value: '#cf00ff' },
  { key: 'Identity light', value: '#80ffb7' },
  { key: 'Architecture light', value: '#a6c0ff' },
  { key: 'Experience light', value: '#ff99bd' },
  { key: 'Organisation light', value: '#80eaff' },
  { key: 'Brand light', value: '#ffd580' },
  { key: 'Product light', value: '#e599ff' },
];

/**
 * From the default editor palette we keep ONLY the neutrals (greys, white,
 * black, transparent) — the historical colours are dropped in favour of the
 * EDGY swatches above.
 */
const EDGY_PALETTE_LIST: Palette[] = [...EDGY_PALETTES, ...neutralPalettes()];

/**
 * EDGY fill / stroke colour picker — identical to the shape one but seeded with
 * the EDGY palette swatches (`.palettes`).
 */
const edgyColorAction = paletteColorAction('e.color', EDGY_PALETTE_LIST);

/**
 * EDGY nodes are {@link ShapeElementModel} subclasses, so the shape toolbar's
 * actions operate on them directly. We reuse the line-style + text actions, add
 * the EDGY-seeded color picker, and drop the actions that don't fit an EDGY base
 * shape (switch shape type, edit polygon vertices).
 */
const KEEP_FROM_SHAPE = (id: string) =>
  id === 'd.style' || id === 'f.text' || id.startsWith('g.text-');

const edgyNodeToolbarConfig = {
  actions: [
    ...shapeToolbarConfig.actions.filter(action => KEEP_FROM_SHAPE(action.id)),
    edgyColorAction,
  ],
  when: shapeToolbarConfig.when,
} as ToolbarModuleConfig;

export const edgyNodeToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:edgyNode'),
  config: edgyNodeToolbarConfig,
});
