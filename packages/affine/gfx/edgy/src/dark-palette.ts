import type { NotationDarkPalette } from '@labre/affine-block-surface';

import { COLORS } from './consts';
import { NODE_STROKE } from './node/consts';

/**
 * EDGY on a dark canvas (ADR 0039): the facet hues, and the facets' white
 * centre, separators and pictograms, are the standard and stay exactly as
 * drawn. Only the stencil ink, a near-black that would vanish on the dark
 * card, turns into the shared light ink. The Architecture blue is kept though
 * it reads at 2.9:1 on the dark card: it is the standard's.
 */
export const EDGY_DARK_PALETTE: NotationDarkPalette = {
  framework: 'edgy',
  colors: { [NODE_STROKE]: '#eaeaea' },
  kept: [COLORS.architecture],
};
