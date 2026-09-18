import type {
  FrameworkPalette,
  NamedPalette,
} from '@labre/affine-components/color-picker';
import { neutralPalettes } from '@labre/affine-gfx-shape';
import type { ChromeWording } from '@labre/affine-shared/services';

import { COLORS as CYNEFIN_COLORS } from '../cynefin/consts.js';
import { COLORS as ESTUARINE_COLORS } from '../estuarine/consts.js';

/**
 * The Cynefin / Estuarine swatches' own names, resolved by
 * `resolvePaletteLabel` (`@labre/affine-components/color-picker`) through each
 * swatch's own {@link NamedPalette.labelWording} — the mechanism
 * `WARDLEY_PALETTE_WORDINGS` established, reused here without either package
 * naming the other.
 *
 * Exported so `../translations.ts` can list them under source `chrome`: a
 * swatch's name is toolbar chrome, re-rendered on every locale switch, never
 * seeded into a document.
 */
export const CYNEFIN_ESTUARINE_PALETTE_WORDING_ITERATE: ChromeWording = [
  'com.labre.cynefin.palette.iterate-teal',
  'Iterate teal',
];
export const CYNEFIN_ESTUARINE_PALETTE_WORDING_LIMINAL: ChromeWording = [
  'com.labre.estuarine.palette.liminal-green',
  'Liminal green',
];
export const CYNEFIN_ESTUARINE_PALETTE_WORDING_LIMINAL_DARK: ChromeWording = [
  'com.labre.estuarine.palette.liminal-green-dark',
  'Liminal green dark',
];
export const CYNEFIN_ESTUARINE_PALETTE_WORDING_VOLATILE: ChromeWording = [
  'com.labre.estuarine.palette.volatile-red',
  'Volatile red',
];
export const CYNEFIN_ESTUARINE_PALETTE_WORDING_AXIS: ChromeWording = [
  'com.labre.estuarine.palette.axis-plum',
  'Axis plum',
];

export const CYNEFIN_ESTUARINE_PALETTE_WORDINGS: readonly ChromeWording[] = [
  CYNEFIN_ESTUARINE_PALETTE_WORDING_ITERATE,
  CYNEFIN_ESTUARINE_PALETTE_WORDING_LIMINAL,
  CYNEFIN_ESTUARINE_PALETTE_WORDING_LIMINAL_DARK,
  CYNEFIN_ESTUARINE_PALETTE_WORDING_VOLATILE,
  CYNEFIN_ESTUARINE_PALETTE_WORDING_AXIS,
];

/**
 * The hues the two boards of this pack are actually drawn in.
 *
 * ONE page for two diagrams, because they are one framework id
 * (`cynefin-estuarine`) and an author works across both. Cynefin contributes
 * the teal of its "iterate" curve — the only colour on a frame whose other
 * inks are the shared notation neutrals — and Estuarine the three its curve
 * legends are drawn in plus the plum of its two axes.
 *
 * Every value is read off the two `COLORS` tables rather than restated, so the
 * shelf and the painted frames cannot drift apart. They are SHORTCUTS, never
 * constraints: nothing on either board reads a colour.
 */
const CYNEFIN_ESTUARINE_PALETTES: NamedPalette[] = [
  {
    key: 'Iterate teal',
    value: CYNEFIN_COLORS.teal,
    labelWording: CYNEFIN_ESTUARINE_PALETTE_WORDING_ITERATE,
  },
  {
    key: 'Liminal green',
    value: ESTUARINE_COLORS.liminal,
    labelWording: CYNEFIN_ESTUARINE_PALETTE_WORDING_LIMINAL,
  },
  // The LIMINAL legend's own darker green — the curve's colour is too light to
  // read as words over the map.
  {
    key: 'Liminal green dark',
    value: ESTUARINE_COLORS.liminalLabel,
    labelWording: CYNEFIN_ESTUARINE_PALETTE_WORDING_LIMINAL_DARK,
  },
  {
    key: 'Volatile red',
    value: ESTUARINE_COLORS.volatile,
    labelWording: CYNEFIN_ESTUARINE_PALETTE_WORDING_VOLATILE,
  },
  {
    key: 'Axis plum',
    value: ESTUARINE_COLORS.axis,
    labelWording: CYNEFIN_ESTUARINE_PALETTE_WORDING_AXIS,
  },
];

/**
 * From the default editor palette we keep ONLY the neutrals — the historical
 * colours say nothing in this notation.
 */
export const CYNEFIN_ESTUARINE_PALETTE_LIST: NamedPalette[] = [
  ...CYNEFIN_ESTUARINE_PALETTES,
  ...neutralPalettes(),
];

/**
 * This pack's page of the colour pickers' carousel (`docs/adr/0027`).
 * Registered from the FLAG-GATED view extension, because offering hues is
 * TOOLING: a board drawn while the flag was on keeps every colour it was
 * painted with when the flag goes off (`docs/adr/0009`).
 */
export const CYNEFIN_ESTUARINE_FRAMEWORK_PALETTE: FrameworkPalette = {
  framework: 'cynefin-estuarine',
  labelWording: [
    'com.labre.framework.cynefin-estuarine',
    'Cynefin / Estuarine',
  ],
  palettes: CYNEFIN_ESTUARINE_PALETTE_LIST,
};
