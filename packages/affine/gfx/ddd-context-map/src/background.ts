import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';
import { CLOUD, CM_BUBBLE, FONT_FAMILY } from '@labre/affine-gfx-ddd-shared';

import { CONTEXT_MAP_ROLE } from './roles';

/**
 * The Context Map board, DECLARED (the `FrameworkBackgroundDef` primitive).
 *
 * The emptiest declaration in the library, and deliberately so: **no axes, no
 * zones**. A Context Map is a graph, not a chart — a bounded context drawn top
 * left says nothing more than one drawn bottom right, and graduating the card
 * would invent a frame of reference the framework does not have. What the
 * declaration is for here is the ROLE and the geometry: `context-map:board` is
 * what a rule frames its subjects against, and it is what a per-map validation
 * profile is written on.
 *
 * The palette carries the notation's two boundary colours even though nothing in
 * this file paints them. Same precedent as the Wardley tone convention: a
 * palette entry is a declared REFERENCE, so the day a `tone-convention` rule
 * asks "is this bubble drawn in the map's own blue" the answer is already
 * written down, in one place, beside the card it belongs to.
 */
export const CONTEXT_MAP_BACKGROUND: FrameworkBackgroundDef = {
  type: 'contextMap',
  role: CONTEXT_MAP_ROLE.board,
  geometry: {
    // Wide and free: a context map grows sideways as contexts are found, so
    // neither dimension is locked to the other and the handles are offered from
    // the start — the opposite call from the Wardley map, which is a frame of
    // reference you place things on rather than a sheet you spread out.
    width: 1400,
    height: 900,
    lockAspectRatio: false,
    resizable: true,
    margin: { top: 24, right: 24, bottom: 24, left: 24 },
  },
  chrome: {
    fontFamily: FONT_FAMILY,
    palette: {
      card: '#ffffff',
      cardBorder: '#d5d9e0',
      /** The bounded-context pill: the map's own blue. */
      context: CM_BUBBLE.fill,
      contextBorder: CM_BUBBLE.stroke,
      /** The cloud / Big Ball of Mud: the map's own grey-violet. */
      cloud: CLOUD.fill,
      cloudBorder: CLOUD.stroke,
    },
    surface: {
      fill: '@card',
      border: { color: '@cardBorder', width: 1.5, radius: 12 },
    },
  },
};
