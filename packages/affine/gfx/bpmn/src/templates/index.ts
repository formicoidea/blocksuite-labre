import {
  makeTemplateSnapshot,
  type SurfaceElementsJSON,
  surfaceText,
  type Template,
  type TemplateCategory,
} from '@labre/affine-gfx-template';
import {
  type BpmnNodeKind,
  ConnectorMode,
  FontFamily,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
} from '@labre/affine-model';

import {
  END_WIDTH,
  EVENT_END,
  EVENT_START,
  INNER_FONT_SIZE,
  MESSAGE_STROKE,
  MESSAGE_WIDTH,
  NEUTRAL_STROKE,
  NODE_FILL,
  NODE_SIZE,
  NODE_STROKE_WIDTH,
  SEQUENCE_STROKE,
  SEQUENCE_WIDTH,
  START_WIDTH,
  TASK_RADIUS,
} from '../consts';
import { BPMN_ROLE, BPMN_ROLE_OF_KIND } from '../roles';

/**
 * The kinds the shipped cards draw — and no more.
 *
 * `Extract` rather than a hand-written union: the names are CHECKED against the
 * model's own {@link BpmnNodeKind}, so this can never drift away from it, while
 * the cards stay honest about the ones they actually lay out. The two typed
 * tasks joined it with the "Message exchange" card; the descriptive profile's
 * remaining kinds have no template yet, and when they get one it is this line
 * that widens again.
 */
type NodeKind = Extract<
  BpmnNodeKind,
  | 'startEvent'
  | 'endEvent'
  | 'task'
  | 'taskUser'
  | 'taskService'
  | 'gatewayExclusive'
>;

/**
 * One BPMN flow-object node, as a surface-element JSON entry.
 *
 * Every kind that {@link NodeKind} admits paints its own body natively, as an
 * ellipse, a rounded rect or a diamond. The GLYPH-BODIED kinds (`dataObject`,
 * `dataStore`, `textAnnotation`) do not: they are created unfilled and
 * unstroked and the renderer draws their silhouette, so a card that spelled one
 * out here would insert an invisible rectangle. `group` is out for a neighbouring
 * reason — it is `hollow`, and the branches below all fill. When any of them
 * earns a card, this helper reads `NODE_PRESETS` instead of branching.
 */
function node(kind: NodeKind, x: number, y: number, text?: string) {
  const { w, h } = NODE_SIZE[kind];
  const base: Record<string, unknown> = {
    type: 'bpmnNode',
    kind,
    // A template must produce the same typed artefacts as the toolbox, or a
    // process started from a preset would read differently from a hand-drawn
    // one.
    role: BPMN_ROLE_OF_KIND[kind],
    filled: true,
    fillColor: NODE_FILL,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    xywh: `[${x},${y},${w},${h}]`,
  };
  if (kind === 'startEvent')
    return {
      ...base,
      shapeType: 'ellipse',
      strokeColor: EVENT_START,
      strokeWidth: START_WIDTH,
    };
  if (kind === 'endEvent')
    return {
      ...base,
      shapeType: 'ellipse',
      strokeColor: EVENT_END,
      strokeWidth: END_WIDTH,
    };
  if (kind === 'gatewayExclusive')
    return {
      ...base,
      shapeType: 'diamond',
      strokeColor: NEUTRAL_STROKE,
      strokeWidth: NODE_STROKE_WIDTH,
    };
  return {
    ...base,
    shapeType: 'rect',
    radius: TASK_RADIUS,
    strokeColor: NEUTRAL_STROKE,
    strokeWidth: NODE_STROKE_WIDTH,
    text: surfaceText(text ?? 'Task'),
    color: NEUTRAL_STROKE,
    fontFamily: FontFamily.Inter,
    fontSize: INNER_FONT_SIZE,
    textAlign: 'center',
  };
}

function pool(x: number, y: number, w: number, h: number, name = 'Pool') {
  return {
    type: 'bpmnPool',
    role: BPMN_ROLE.pool,
    name,
    xywh: `[${x},${y},${w},${h}]`,
  };
}

/** A sequence-flow connector; ids are remapped on insert. */
function seq(source: string, target: string) {
  return {
    type: 'connector',
    // Both ends are BOUND, so this arrow relates two named things and its
    // direction is a claim the template makes: source first, target next
    // (`docs/adr/0010`).
    role: BPMN_ROLE.sequenceFlow,
    mode: ConnectorMode.Orthogonal,
    stroke: SEQUENCE_STROKE,
    strokeWidth: SEQUENCE_WIDTH,
    strokeStyle: StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Triangle,
    source: { id: source, position: [0.5, 0.5] },
    target: { id: target, position: [0.5, 0.5] },
  };
}

/**
 * A message-flow connector; ids are remapped on insert.
 *
 * The same shape as {@link seq} and the same claim — both ends are BOUND, so
 * the arrow relates two named things — but a different sentence: "sends a
 * message to", from the participant that sends to the one that receives
 * (`docs/adr/0010`). Its style is the one `activateBpmnMessageFlow` arms the
 * connector tool with, so a message flow dropped from this card and one drawn
 * by hand are indistinguishable in the document.
 */
function msg(source: string, target: string) {
  return {
    type: 'connector',
    role: BPMN_ROLE.messageFlow,
    mode: ConnectorMode.Orthogonal,
    stroke: MESSAGE_STROKE,
    strokeWidth: MESSAGE_WIDTH,
    strokeStyle: StrokeStyle.Dash,
    frontEndpointStyle: PointStyle.Circle,
    rearEndpointStyle: PointStyle.Arrow,
    source: { id: source, position: [0.5, 0.5] },
    target: { id: target, position: [0.5, 0.5] },
  };
}

/**
 * A standalone (free) sequence-flow arrow for the prefab card.
 *
 * NEUTRAL on purpose (`docs/adr/0010` § Compatibility, and the same call the
 * Wardley "Link" swatch makes): this is a horizontal stroke bound to nothing —
 * a sample of a STYLE, in a palette. A typed edge claims "this is followed by
 * that", and a stroke attached to neither end has no this and no that to say it
 * about. Drawing it with the sequence-flow tool, or dropping this one and then
 * attaching both of its ends, is what makes it a statement.
 */
function freeSeq(): Record<string, unknown> {
  return {
    type: 'connector',
    mode: ConnectorMode.Orthogonal,
    stroke: SEQUENCE_STROKE,
    strokeWidth: SEQUENCE_WIDTH,
    strokeStyle: StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Triangle,
    source: { position: [0, 0] },
    target: { position: [140, 0] },
  };
}

const single = (el: Record<string, unknown>): SurfaceElementsJSON => ({
  a: el,
});

const PREVIEW_ATTRS =
  'width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"';

const previews = {
  process: `<svg ${PREVIEW_ATTRS} fill="none"><circle cx="16" cy="40" r="8" stroke="#43a06b" stroke-width="2"/><rect x="34" y="31" width="26" height="18" rx="3" stroke="#262626" stroke-width="1.6"/><path d="M78 31 L88 40 L78 49 L68 40 Z" stroke="#262626" stroke-width="1.4"/><path d="M73 37 L83 43 M83 37 L73 43" stroke="#262626" stroke-width="1.2"/><circle cx="118" cy="40" r="8" stroke="#cf5648" stroke-width="3"/><path d="M24 40 H34 M60 40 H68 M88 40 H110" stroke="#262626" stroke-width="1.2"/></svg>`,
  startEvent: `<svg ${PREVIEW_ATTRS} fill="none"><circle cx="67" cy="40" r="20" stroke="#43a06b" stroke-width="3"/></svg>`,
  endEvent: `<svg ${PREVIEW_ATTRS} fill="none"><circle cx="67" cy="40" r="20" stroke="#cf5648" stroke-width="5"/></svg>`,
  task: `<svg ${PREVIEW_ATTRS} fill="none"><rect x="34" y="24" width="66" height="32" rx="6" stroke="#262626" stroke-width="2.4"/></svg>`,
  gateway: `<svg ${PREVIEW_ATTRS} fill="none"><path d="M67 16 L92 40 L67 64 L42 40 Z" stroke="#262626" stroke-width="2.4" stroke-linejoin="round"/><path d="M58 31 L76 49 M76 31 L58 49" stroke="#262626" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  sequence: `<svg ${PREVIEW_ATTRS} fill="none"><path d="M24 40 H96" stroke="#262626" stroke-width="2.4" stroke-linecap="round"/><path d="M94 33 L108 40 L94 47 Z" fill="#262626"/></svg>`,
  pool: `<svg ${PREVIEW_ATTRS} fill="none"><rect x="14" y="20" width="107" height="40" rx="3" stroke="#262626" stroke-width="2"/><path d="M30 20 V60" stroke="#262626" stroke-width="1.8"/><rect x="14" y="20" width="16" height="40" fill="#f4f4f5"/><path d="M30 20 V60" stroke="#262626" stroke-width="1.8"/></svg>`,
  // Two participants stacked, and the dashed line between them is the whole
  // point of the card: a message flow is the one arrow that crosses a pool.
  // Its source terminator is a FILLED disc, matching what `renderCircle`
  // actually paints rather than the hollow ring the norm asks for — a preview
  // has one job, which is to look like what lands on the board.
  messageExchange: `<svg ${PREVIEW_ATTRS} fill="none"><rect x="14" y="8" width="107" height="27" rx="3" stroke="#262626" stroke-width="1.6"/><rect x="14" y="8" width="11" height="27" fill="#f4f4f5"/><path d="M25 8 V35" stroke="#262626" stroke-width="1.4"/><rect x="14" y="45" width="107" height="27" rx="3" stroke="#262626" stroke-width="1.6"/><rect x="14" y="45" width="11" height="27" fill="#f4f4f5"/><path d="M25 45 V72" stroke="#262626" stroke-width="1.4"/><circle cx="36" cy="21.5" r="4.5" stroke="#43a06b" stroke-width="1.6"/><rect x="52" y="14" width="30" height="15" rx="3" stroke="#262626" stroke-width="1.6"/><rect x="52" y="51" width="30" height="15" rx="3" stroke="#262626" stroke-width="1.6"/><path d="M45 21.5 H52" stroke="#262626" stroke-width="1.4"/><circle cx="67" cy="31.5" r="2.2" fill="#262626"/><path d="M67 34 V48" stroke="#262626" stroke-width="1.4" stroke-dasharray="3 2.4"/><path d="M64 46 L67 50 L70 46" stroke="#262626" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

/**
 * The BPMN basics: two worked scenes — a process end to end and a two-party
 * message exchange — plus a prefab for each of the lean artefacts.
 */
function bpmnTemplates(): Template[] {
  const process: SurfaceElementsJSON = {
    pool: pool(0, 0, 640, 200, 'Process'),
    start: node('startEvent', 40, 72),
    task1: node('task', 116, 64, 'Submit request'),
    gw: node('gatewayExclusive', 272, 64),
    task2: node('task', 376, 20, 'Fulfil'),
    task3: node('task', 376, 124, 'Reject'),
    end: node('endEvent', 556, 72),
    c1: seq('start', 'task1'),
    c2: seq('task1', 'gw'),
    c3: seq('gw', 'task2'),
    c4: seq('gw', 'task3'),
    c5: seq('task2', 'end'),
    c6: seq('task3', 'end'),
  };

  /**
   * Two participants, and the one arrow that is allowed to cross between them.
   *
   * The card exists because the message flow is the piece of BPMN people get
   * wrong first: a sequence flow may never leave its pool, and the thing that
   * does leave is a different statement with a different line. Laying the two
   * pools out one above the other and drawing both flows once is the shortest
   * way to show that — the solid arrow stays home, the dashed one crosses.
   *
   * Stacked vertically with a 40-unit gutter, so the message flow is a straight
   * orthogonal drop between two tasks that already line up.
   */
  const messageExchange: SurfaceElementsJSON = {
    customer: pool(0, 0, 640, 200, 'Customer'),
    supplier: pool(0, 240, 640, 200, 'Supplier'),
    start: node('startEvent', 40, 72),
    ask: node('taskUser', 140, 64, 'Place order'),
    answer: node('taskService', 140, 304, 'Confirm order'),
    // Inside the first participant: what happens, and in what order.
    inside: seq('start', 'ask'),
    // Across the two: who told whom.
    across: msg('ask', 'answer'),
  };

  const t = (
    name: string,
    preview: string,
    elements: SurfaceElementsJSON
  ): Template => ({
    name,
    type: 'template',
    preview,
    content: makeTemplateSnapshot(elements, name),
  });

  return [
    t('Simple process', previews.process, process),
    t('Message exchange', previews.messageExchange, messageExchange),
    t('Start event', previews.startEvent, single(node('startEvent', 0, 0))),
    t('End event', previews.endEvent, single(node('endEvent', 0, 0))),
    t('Task', previews.task, single(node('task', 0, 0))),
    t(
      'Exclusive gateway',
      previews.gateway,
      single(node('gatewayExclusive', 0, 0))
    ),
    t('Sequence flow', previews.sequence, single(freeSeq())),
    t('Pool', previews.pool, single(pool(0, 0, 560, 200))),
  ];
}

export const bpmnTemplateCategory: TemplateCategory = {
  name: 'BPMN',
  templates: bpmnTemplates(),
};
