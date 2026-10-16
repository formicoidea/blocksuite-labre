import type { NotationDarkPalette } from '@labre/affine-block-surface';

import { BOUNDARY_NAME_COLOR, BOUNDARY_STROKE } from './consts';

/**
 * C4 on a dark canvas (ADR 0039). The blue ladder (person, system, container,
 * component) is the standard and stays as stored, with its own text colour on
 * its own fill. Only the greys and the black drawn straight on the card (a
 * boundary, its name, a relationship) go light.
 */
export const C4_DARK_PALETTE: NotationDarkPalette = {
  framework: 'c4',
  colors: {
    // Also `RELATIONSHIP_STROKE`: the stencil draws both in one grey.
    [BOUNDARY_STROKE]: '#bdbdbd',
    [BOUNDARY_NAME_COLOR]: '#eaeaea',
  },
  kept: ['#08427b', '#073b6f'],
};
