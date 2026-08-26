import type { BpmnNodeKind } from '@labre/affine-model';

/**
 * Visual constants for the BPMN basics. Style "C" (hybrid): spec-accurate
 * shapes and line weights, with accent colour only on the event rings — the
 * task and gateway stay neutral. All of these are just the creation-time
 * defaults; every value is an editable shape property afterwards.
 */

/** Accent stroke for the start event (thin green ring). */
export const EVENT_START = '#43a06b';
/** Accent stroke for the end event (thick red ring). */
export const EVENT_END = '#cf5648';
/** Neutral stroke for task / gateway (matches the EDGY base shapes). */
export const NEUTRAL_STROKE = '#262626';
/** Default fill for events / task / gateway. */
export const NODE_FILL = '#ffffff';

/** BPMN line weights: thin start ring, thick end ring, regular elsewhere. */
export const START_WIDTH = 2;
export const END_WIDTH = 4;
export const NODE_STROKE_WIDTH = 2;

/** Task corner radius (absolute px — a lightly rounded rectangle). */
export const TASK_RADIUS = 10;

/** Inner-text font for the task label. */
export const INNER_FONT_SIZE = 18;

/** Default node sizes (model units) per kind. */
export const NODE_SIZE: Record<BpmnNodeKind, { w: number; h: number }> = {
  startEvent: { w: 56, h: 56 },
  endEvent: { w: 56, h: 56 },
  task: { w: 120, h: 72 },
  gatewayExclusive: { w: 72, h: 72 },
};

/** Default inner text per kind (only the task carries a label). */
export const NODE_LABEL: Record<BpmnNodeKind, string> = {
  startEvent: '',
  endEvent: '',
  task: 'Task',
  gatewayExclusive: '',
};

/**
 * Pool (background container) defaults — read by the `BPMN_POOL_BACKGROUND`
 * declaration (`background.ts`), which is the only thing that draws a pool.
 */
export const POOL_BAND_WIDTH = 28;
export const POOL_FRAME_COLOR = '#262626';
/**
 * The card. The same white every framework background paints — it is what
 * `DEFAULT_BACKGROUND_SURFACE` gives a declaration that names no fill, and what
 * the Wardley map, the Core Domain Chart and the Context Map board all declare.
 */
export const POOL_CARD_FILL = '#ffffff';
export const POOL_BAND_FILL = '#f4f4f5';
export const POOL_FRAME_WIDTH = 1.5;
export const POOL_CORNER_RADIUS = 6;
export const POOL_NAME_FONT_SIZE = 15;
export const POOL_NAME_COLOR = '#262626';
export const POOL_FONT_FAMILY = 'Inter, sans-serif';

/**
 * Lane (couloir) name size — two units under the participant's own.
 *
 * The pool names WHO does the work and the lane names which part of them does
 * it: a subdivision reads as a subdivision when its label is quieter than the
 * one it sits under. Two units is the smallest difference that survives being
 * zoomed out, which is the size the distinction has to hold at.
 */
export const POOL_LANE_NAME_FONT_SIZE = 13;

/**
 * How close to an internal lane boundary a pointer has to be, in MODEL units,
 * for the gesture to be a separator drag rather than a click on the pool.
 *
 * Symmetric, so the zone is 12 units wide. Model units and not view pixels on
 * purpose: the grab zone then scales with the drawing, exactly like the lane it
 * belongs to, and a pool zoomed out to a thumbnail does not become a strip of
 * overlapping hit zones with no lane left between them.
 */
export const POOL_LANE_GRAB = 6;

/**
 * The smallest a lane may be dragged to, in model units of a pool at its
 * REFERENCE height ({@link POOL_REF_HEIGHT}).
 *
 * A floor and not a minimum height: sizes are weights, so this is converted to
 * a weight against the pool's current total before it is applied. 24 units is
 * about one line of a lane name plus its inset — below that the band cannot
 * show what it is, and a lane nothing can be put in and nothing can be read off
 * is one the user did not mean to make.
 */
export const POOL_LANE_MIN_HEIGHT = 24;

/**
 * The corner of a lane that opens its name for editing on a double click, in
 * model units — measured from the lane's top-left, where the primitive draws
 * the name (8 in, baseline 18 down).
 *
 * Generously bigger than the words: an unnamed lane has no glyphs to aim at, so
 * a box the size of the text would be unhittable exactly when it is needed. The
 * view widens it further, to a 44-pixel touch target, whenever the board is
 * zoomed out far enough that these units are smaller than a fingertip.
 */
export const POOL_LANE_NAME_HIT_WIDTH = 180;
export const POOL_LANE_NAME_HIT_HEIGHT = 30;

/**
 * The size a fresh pool is created at. Unlike a map, a pool is NOT grown to
 * cover the ones already on the board: pools sit side by side, one per
 * participant, and a second lane that matched the first one's height would
 * claim room the process has not asked for.
 *
 * `actions.ts` and the templates still write these two numbers themselves; the
 * declaration names them so there is somewhere for them to converge.
 */
export const POOL_REF_WIDTH = 560;
export const POOL_REF_HEIGHT = 200;

/** Sequence-flow connector preset. */
export const SEQUENCE_STROKE = '#262626';
export const SEQUENCE_WIDTH = 2;
