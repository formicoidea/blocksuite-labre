import { NOTATION_NEUTRALS } from '@labre/affine-shared/headless';

// Its own module so the headless interchange entry (`./interchange`) can read
// it without the legend's editor graph: the DDD element builders of
// `@labre/affine-gfx-ddd-shared/headless` write their captions in these three
// values (`docs/adr/0045`). `legend.ts` re-exports them unchanged.

/**
 * The ink and the type a notation writes its labels in: the legend box's rows,
 * and the words the DDD prefabs set beside a dot or a marker.
 *
 * Declared HERE and re-exported by `@labre/affine-gfx-ddd-shared`, rather than
 * the other way round, because that bundle depends on this one and a legend
 * must not depend on a DDD bundle to be drawn.
 */
export const LABEL_COLOR = NOTATION_NEUTRALS.ink;
export const LABEL_FONT = 'blocksuite:surface:Inter';
export const LABEL_FONT_SIZE = 14;
