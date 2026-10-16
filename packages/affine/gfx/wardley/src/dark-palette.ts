import type { NotationDarkPalette } from '@labre/affine-block-surface';

import { COLORS } from './consts';
import { PORTER_PANEL } from './legend';
import { ACCELERATOR_FILL, LINK_GREY, METHOD_FILL } from './node/consts';

/**
 * Wardley on a dark canvas (ADR 0039). The neutrals come from the shared
 * scale; these are the map's own values that would vanish on the dark card.
 *
 * - The four evolution bands step DARKER than the card, as they step darker
 *   than white in light: the gradient keeps its direction, and the dark
 *   selection accent keeps 3:1 on every band (`notation-dark-palettes`).
 * - The greys a node or a link is painted in keep the contrast they have on
 *   white, on the other side of the card.
 */
export const WARDLEY_DARK_PALETTE: NotationDarkPalette = {
  framework: 'wardley',
  colors: {
    [COLORS.band[0]]: '#101317',
    [COLORS.band[1]]: '#0b1016',
    [COLORS.band[2]]: '#060d16',
    [COLORS.band[3]]: '#020a16',
    [LINK_GREY]: '#909090',
    [METHOD_FILL]: '#313131',
    [ACCELERATOR_FILL]: '#434343',
    [PORTER_PANEL.backing]: '#26282b',
  },
  kept: [],
};
