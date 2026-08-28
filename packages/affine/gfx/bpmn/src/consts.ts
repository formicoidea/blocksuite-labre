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

/**
 * The call activity's border, which the spec draws THICK — it is the one way to
 * tell it from the sub-process, since both carry the same `+` marker. Same
 * weight as the end-event ring, and for the same reason: this is the heaviest
 * line the notation uses, and it is spent on "this one stands for a whole
 * process defined somewhere else".
 */
export const CALL_ACTIVITY_WIDTH = END_WIDTH;

/** Task corner radius (absolute px — a lightly rounded rectangle). */
export const TASK_RADIUS = 10;

/**
 * The group's corner radius — twice a task's, because it is drawn at three
 * times the size and a 10-unit corner on a 300-unit box reads as a square one.
 */
export const GROUP_RADIUS = 20;

/**
 * The group's dashed border.
 *
 * Grey and not the flow objects' near-black: a group is furniture drawn AROUND
 * the work, and it is the one artefact on the canvas guaranteed to overlap
 * several others. At the neutral stroke it out-shouts everything it encloses,
 * which is the exact opposite of what a lasso is for. Every tool that draws
 * BPMN makes the same call; the spec prescribes the dash and says nothing about
 * the colour.
 */
export const GROUP_STROKE = '#8e8d91';

/** Inner-text font for the task label. */
export const INNER_FONT_SIZE = 18;

/**
 * Default node sizes (model units) per kind.
 *
 * Three sizes carry the whole scale: the 56-unit event, the 120×72 task and the
 * 72-unit gateway. Everything the descriptive profile adds takes one of them —
 * a message start is a start event, a user task is a task — except the three
 * data/artifact shapes, which have no sibling to inherit from:
 *
 *  - `dataObject` is a PORTRAIT page (3:4), 64 tall so it stands beside a
 *    56-unit event without looking like a shrunken task;
 *  - `dataStore` is the event's own diameter, which is what a cylinder needs to
 *    read as one rather than as a squashed ellipse;
 *  - `textAnnotation` is wider than a task and shorter — it holds a sentence,
 *    not a verb phrase.
 *
 * These three are ~1.2–1.4× bpmn.io's normative pixel sizes, which is the ratio
 * this pack's event and task already sit at against the same reference.
 *
 * `group` is on no scale at all: it is a LASSO, so it has to be born big enough
 * to have something in it. 300×200 holds two tasks and the arrow between them,
 * which is the smallest thing anybody draws a group around.
 */
export const NODE_SIZE: Record<BpmnNodeKind, { w: number; h: number }> = {
  startEvent: { w: 56, h: 56 },
  startEventMessage: { w: 56, h: 56 },
  startEventTimer: { w: 56, h: 56 },
  endEvent: { w: 56, h: 56 },
  endEventMessage: { w: 56, h: 56 },
  endEventTerminate: { w: 56, h: 56 },
  task: { w: 120, h: 72 },
  taskUser: { w: 120, h: 72 },
  taskService: { w: 120, h: 72 },
  subProcess: { w: 120, h: 72 },
  callActivity: { w: 120, h: 72 },
  gatewayExclusive: { w: 72, h: 72 },
  gatewayParallel: { w: 72, h: 72 },
  dataObject: { w: 48, h: 64 },
  dataStore: { w: 56, h: 56 },
  textAnnotation: { w: 140, h: 48 },
  group: { w: 300, h: 200 },
};

/**
 * Default inner text per kind.
 *
 * The activities carry one, because a rectangle with nothing written in it says
 * nothing at all. Events and gateways do not: their meaning is the glyph, and
 * BPMN puts whatever name they have OUTSIDE the symbol.
 *
 * `dataObject` and `dataStore` are empty for the same reason plus one of our
 * own: the spec puts their name under the shape, the native inner text can only
 * go inside it, and inside is where the folded page and the cylinder already
 * are. The user can still type — the text simply overflows, which is the
 * honest failure rather than a label painted over the glyph.
 */
export const NODE_LABEL: Record<BpmnNodeKind, string> = {
  startEvent: '',
  startEventMessage: '',
  startEventTimer: '',
  endEvent: '',
  endEventMessage: '',
  endEventTerminate: '',
  task: 'Task',
  taskUser: 'User task',
  taskService: 'Service task',
  subProcess: 'Sub-process',
  callActivity: 'Call activity',
  gatewayExclusive: '',
  gatewayParallel: '',
  dataObject: '',
  dataStore: '',
  // The one artefact that IS its text.
  textAnnotation: 'Annotation',
  // The group's label is a CategoryValue in the spec. A plain editable string
  // is the v1 of that: it names the lasso, and it is drawn top-left rather than
  // centred so it does not float over whatever the group encloses.
  group: 'Group',
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
 * Width of a lane's own title band, in model units — the strip immediately
 * inside the participant band, with the lane name turned on its side.
 *
 * Four units narrower than {@link POOL_BAND_WIDTH}, and for the same reason the
 * font is two points smaller: the two strips sit side by side, so the
 * subordinate one has to say so. Identical widths read as a single 56-unit
 * gutter rather than as a participant containing lanes, which is exactly the
 * relationship the picture has to carry.
 *
 * NO fill, divider only — what bpmn.io, Camunda and Visio all draw. A second
 * grey strip beside the pool's own would double the furniture and leave the
 * flow area looking inset by two margins.
 */
export const POOL_LANE_BAND_WIDTH = 24;

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

// The lane-name hit box used to be a corner box declared here
// (`POOL_LANE_NAME_HIT_WIDTH` / `_HEIGHT`). Since the PO's recette moved the
// name into a title band, the target IS that band: `element-view.ts` reads it
// from `backgroundInstanceZoneBand`, so there is nothing left to declare and
// nothing left that can drift away from what is painted.

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

/**
 * Message-flow connector preset — the dashed line that crosses between pools.
 *
 * Same ink and same weight as the sequence flow: what tells the two apart is
 * the DASH and the endpoints (an open circle where the message leaves, an open
 * arrowhead where it lands), which is exactly the distinction BPMN draws.
 */
export const MESSAGE_STROKE = '#262626';
export const MESSAGE_WIDTH = 2;

/**
 * Association connector preset — the line that ties a note or a data object to
 * the work it is about.
 *
 * ## Dashed, not dotted (simplification, and why it is survivable)
 *
 * BPMN draws a message flow DASHED and an association DOTTED. This editor's
 * `StrokeStyle` has three members — `Solid`, `Dash`, `None` — and the dash
 * pattern is a fixed `[12, 12]` no framework can tighten, so there is no dotted
 * stroke to ask for. Drawing it thinner instead is not available either: a
 * connector's `strokeWidth` is a closed enum (`2 | 4 | … | 12`) the props store
 * validates, and 2 is already the floor.
 *
 * So the association ships with the message flow's own line, and carries the
 * distinction entirely on its ENDPOINTS: a message flow always shows a circle
 * where it leaves and an arrowhead where it lands, an association shows neither
 * at either end. That is a difference the eye reads at a glance and, unlike the
 * dot pattern, it is one the notation itself means — an association has no
 * direction to point in. A rule reads the `role`, which is exact either way.
 */
export const ASSOCIATION_STROKE = '#262626';
export const ASSOCIATION_WIDTH = 2;
