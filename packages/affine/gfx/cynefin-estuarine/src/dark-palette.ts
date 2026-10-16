import type { NotationDarkPalette } from '@labre/affine-block-surface';

import { COLORS as CYNEFIN } from './cynefin/consts';
import { COLORS as ESTUARINE, HEX_STROKE } from './estuarine/consts';

/**
 * Cynefin and Estuarine on a dark canvas (ADR 0039). The inks of the two
 * reference drawings go light, keeping the contrast they have on white; the
 * hues (the teal curve, the liminal green, the volatile red) stay as drawn.
 */
export const CYNEFIN_ESTUARINE_DARK_PALETTE: NotationDarkPalette = {
  framework: 'cynefin-estuarine',
  colors: {
    [CYNEFIN.boundary]: '#d6d6d6',
    [CYNEFIN.heading]: '#86878a',
    [CYNEFIN.body]: '#eaeaea',
    [ESTUARINE.axis]: '#ff8cbe',
    [ESTUARINE.axisLabel]: '#e95f4e',
    [ESTUARINE.liminalLabel]: '#4a984c',
    [ESTUARINE.label]: '#eaeaea',
    [HEX_STROKE]: '#eaeaea',
  },
};
