import type {
  FrameworkPalette,
  NamedPalette,
} from '@labre/affine-components/color-picker';
import {
  neutralPalettes,
  paletteColorAction,
  shapeToolbarConfig,
} from '@labre/affine-gfx-shape';
import {
  type ChromeWording,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';

/**
 * The twelve EDGY swatches' own names, resolved by `resolvePaletteLabel`
 * (`@labre/affine-components/color-picker`) through each swatch's own
 * {@link NamedPalette.labelWording} — see Wardley's own
 * `WARDLEY_PALETTE_WORDINGS` (`../../wardley/src/toolbar/node-config.ts`)
 * for the same mechanism applied to a sibling framework; the two never
 * import each other.
 *
 * Exported so `../translations.ts` can list them in the manifest under
 * source `chrome`.
 */
export const EDGY_PALETTE_WORDING_IDENTITY: ChromeWording = [
  'com.labre.edgy.palette.identity',
  'Identity',
];
export const EDGY_PALETTE_WORDING_ARCHITECTURE: ChromeWording = [
  'com.labre.edgy.palette.architecture',
  'Architecture',
];
export const EDGY_PALETTE_WORDING_EXPERIENCE: ChromeWording = [
  'com.labre.edgy.palette.experience',
  'Experience',
];
export const EDGY_PALETTE_WORDING_ORGANISATION: ChromeWording = [
  'com.labre.edgy.palette.organisation',
  'Organisation',
];
export const EDGY_PALETTE_WORDING_BRAND: ChromeWording = [
  'com.labre.edgy.palette.brand',
  'Brand',
];
export const EDGY_PALETTE_WORDING_PRODUCT: ChromeWording = [
  'com.labre.edgy.palette.product',
  'Product',
];
export const EDGY_PALETTE_WORDING_IDENTITY_LIGHT: ChromeWording = [
  'com.labre.edgy.palette.identity-light',
  'Identity light',
];
export const EDGY_PALETTE_WORDING_ARCHITECTURE_LIGHT: ChromeWording = [
  'com.labre.edgy.palette.architecture-light',
  'Architecture light',
];
export const EDGY_PALETTE_WORDING_EXPERIENCE_LIGHT: ChromeWording = [
  'com.labre.edgy.palette.experience-light',
  'Experience light',
];
export const EDGY_PALETTE_WORDING_ORGANISATION_LIGHT: ChromeWording = [
  'com.labre.edgy.palette.organisation-light',
  'Organisation light',
];
export const EDGY_PALETTE_WORDING_BRAND_LIGHT: ChromeWording = [
  'com.labre.edgy.palette.brand-light',
  'Brand light',
];
export const EDGY_PALETTE_WORDING_PRODUCT_LIGHT: ChromeWording = [
  'com.labre.edgy.palette.product-light',
  'Product light',
];

export const EDGY_PALETTE_WORDINGS: readonly ChromeWording[] = [
  EDGY_PALETTE_WORDING_IDENTITY,
  EDGY_PALETTE_WORDING_ARCHITECTURE,
  EDGY_PALETTE_WORDING_EXPERIENCE,
  EDGY_PALETTE_WORDING_ORGANISATION,
  EDGY_PALETTE_WORDING_BRAND,
  EDGY_PALETTE_WORDING_PRODUCT,
  EDGY_PALETTE_WORDING_IDENTITY_LIGHT,
  EDGY_PALETTE_WORDING_ARCHITECTURE_LIGHT,
  EDGY_PALETTE_WORDING_EXPERIENCE_LIGHT,
  EDGY_PALETTE_WORDING_ORGANISATION_LIGHT,
  EDGY_PALETTE_WORDING_BRAND_LIGHT,
  EDGY_PALETTE_WORDING_PRODUCT_LIGHT,
];

/**
 * The typical EDGY palette, surfaced as ready-made swatches in the EDGY node
 * color picker (facet + intersection colours, saturated then pastel), followed
 * by the default editor palette.
 */
const EDGY_PALETTES: NamedPalette[] = [
  {
    key: 'Identity',
    value: '#00ea4e',
    labelWording: EDGY_PALETTE_WORDING_IDENTITY,
  },
  {
    key: 'Architecture',
    value: '#034cee',
    labelWording: EDGY_PALETTE_WORDING_ARCHITECTURE,
  },
  {
    key: 'Experience',
    value: '#ff0056',
    labelWording: EDGY_PALETTE_WORDING_EXPERIENCE,
  },
  {
    key: 'Organisation',
    value: '#00caf4',
    labelWording: EDGY_PALETTE_WORDING_ORGANISATION,
  },
  { key: 'Brand', value: '#ffa500', labelWording: EDGY_PALETTE_WORDING_BRAND },
  {
    key: 'Product',
    value: '#cf00ff',
    labelWording: EDGY_PALETTE_WORDING_PRODUCT,
  },
  {
    key: 'Identity light',
    value: '#80ffb7',
    labelWording: EDGY_PALETTE_WORDING_IDENTITY_LIGHT,
  },
  {
    key: 'Architecture light',
    value: '#a6c0ff',
    labelWording: EDGY_PALETTE_WORDING_ARCHITECTURE_LIGHT,
  },
  {
    key: 'Experience light',
    value: '#ff99bd',
    labelWording: EDGY_PALETTE_WORDING_EXPERIENCE_LIGHT,
  },
  {
    key: 'Organisation light',
    value: '#80eaff',
    labelWording: EDGY_PALETTE_WORDING_ORGANISATION_LIGHT,
  },
  {
    key: 'Brand light',
    value: '#ffd580',
    labelWording: EDGY_PALETTE_WORDING_BRAND_LIGHT,
  },
  {
    key: 'Product light',
    value: '#e599ff',
    labelWording: EDGY_PALETTE_WORDING_PRODUCT_LIGHT,
  },
];

/**
 * From the default editor palette we keep ONLY the neutrals (greys, white,
 * black, transparent) — the historical colours are dropped in favour of the
 * EDGY swatches above.
 */
export const EDGY_PALETTE_LIST: NamedPalette[] = [
  ...EDGY_PALETTES,
  ...neutralPalettes(),
];

/**
 * EDGY's page of the colour pickers' carousel (`docs/adr/0027`) — the same
 * list its node picker is seeded with, offered on every other picker too.
 * Registered from the FLAG-GATED view extension: offering hues is tooling
 * (`docs/adr/0009`).
 */
export const EDGY_FRAMEWORK_PALETTE: FrameworkPalette = {
  framework: 'edgy',
  labelWording: ['com.labre.framework.edgy', 'EDGY'],
  palettes: EDGY_PALETTE_LIST,
};

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
