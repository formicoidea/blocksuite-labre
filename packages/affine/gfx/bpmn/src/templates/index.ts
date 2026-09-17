import {
  makeTemplateSnapshot,
  type SurfaceElementsJSON,
  surfaceText,
  type Template,
  type TemplateCategory,
  templateFromCommand,
} from '@labre/affine-gfx-template';
import {
  type BpmnNodeKind,
  ConnectorMode,
  PointStyle,
  StrokeStyle,
} from '@labre/affine-model';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import type { BlockStdScope, CommandDescriptor } from '@labre/std';

import { bpmnCommands } from '../commands';
import {
  EVENT_END,
  EVENT_START,
  GROUP_STROKE,
  MESSAGE_STROKE,
  MESSAGE_WIDTH,
  NEUTRAL_STROKE,
  NODE_SIZE,
  POOL_BAND_FILL,
  POOL_FRAME_COLOR,
  SEQUENCE_STROKE,
  SEQUENCE_WIDTH,
} from '../consts';
import { bpmnNodeProps, bpmnPoolProps } from '../presets';
import { BPMN_ROLE } from '../roles';

/**
 * The seeds the two worked scenes write — declared once so the scene builder
 * and the manifest ({@link ../translations.ts}) read the very same fallback,
 * never a restated literal. `com.labre.bpmn.example.<scene>.<slug>`, per
 * `docs/adr/0023`.
 */
export const SIMPLE_PROCESS_SEED = {
  poolName: {
    key: 'com.labre.bpmn.example.simple-process.pool-name',
    fallback: 'Process',
  },
  submitRequest: {
    key: 'com.labre.bpmn.example.simple-process.submit-request',
    fallback: 'Submit request',
  },
  fulfil: {
    key: 'com.labre.bpmn.example.simple-process.fulfil',
    fallback: 'Fulfil',
  },
  reject: {
    key: 'com.labre.bpmn.example.simple-process.reject',
    fallback: 'Reject',
  },
} as const;

/**
 * The two worked scenes' and the free-standing "Sequence flow" swatch's own
 * tile names — a `nameKey` per hand-composed card, since none of the three
 * derives from a command (`Template.nameKey`; `resolveTemplateName` checks it
 * BEFORE `commandId`). `com.labre.bpmn.template.<slug>`, distinct from the
 * `com.labre.bpmn.example.<scene>.*` seeds the two scenes WRITE — a tile name
 * is chrome (re-rendered every time the panel opens), a seed is content
 * (translated once, at insertion).
 */
export const BPMN_TEMPLATE_NAME_SIMPLE_PROCESS: ChromeWording = [
  'com.labre.bpmn.template.simple-process',
  'Simple process',
];
export const BPMN_TEMPLATE_NAME_MESSAGE_EXCHANGE: ChromeWording = [
  'com.labre.bpmn.template.message-exchange',
  'Message exchange',
];
export const BPMN_TEMPLATE_NAME_SEQUENCE_FLOW: ChromeWording = [
  'com.labre.bpmn.template.sequence-flow',
  'Sequence flow',
];

export const MESSAGE_EXCHANGE_SEED = {
  customer: {
    key: 'com.labre.bpmn.example.message-exchange.customer',
    fallback: 'Customer',
  },
  supplier: {
    key: 'com.labre.bpmn.example.message-exchange.supplier',
    fallback: 'Supplier',
  },
  placeOrder: {
    key: 'com.labre.bpmn.example.message-exchange.place-order',
    fallback: 'Place order',
  },
  confirmOrder: {
    key: 'com.labre.bpmn.example.message-exchange.confirm-order',
    fallback: 'Confirm order',
  },
} as const;

/**
 * One seed's resolved text — the host's catalogue when `std` is a real
 * inserting editor, the English fallback when building the module's own
 * `content` (no editor exists yet at that point).
 */
function seedText(
  std: BlockStdScope | undefined,
  def: { key: string; fallback: string }
): string {
  return std ? translateKey(std, def.key, def.fallback) : def.fallback;
}

/**
 * The BPMN palette — DERIVED from the toolbox, one template per artefact
 * command.
 *
 * Every single-artefact entry below is what its command actually draws, run once
 * against a recording surface. It used to be a hand-written restatement of the
 * same artefacts through a private `node()` builder, and it had drifted exactly
 * as far as a copy drifts: none of the eleven nodes carried the
 * `textFitMode: Overflow` the pack has written since #160, the events and
 * gateways had lost their typography on an early return, the labels were English
 * literals outside the translation seam (#192), and six kinds out of seventeen
 * had a template at all. Derived, none of that can happen again — and
 * `templates-parity.unit.spec.ts` re-runs each command and compares, so the day
 * a creation site changes the palette changes with it.
 *
 * The two worked SCENES stay hand-composed: a process end to end and a
 * two-party message exchange are arrangements of a dozen artefacts, which no
 * single command draws. They are built on the same presets
 * ({@link bpmnNodeProps}, {@link bpmnPoolProps}), and the same test checks their
 * composition AND runs the rule pack over them — which is what caught the
 * "Message exchange" card violating `bpmn.pool-start-without-end` at insertion.
 */

/** The command a derived template is the picture of. Throws rather than skips. */
function byId(id: string): CommandDescriptor {
  const command = bpmnCommands.find(entry => entry.id === id);
  if (!command) throw new Error(`[bpmn] templates: no command "${id}"`);
  return command;
}

/**
 * A scene node, from the same description the toolbox draws from.
 *
 * The scene owns the BOX and the words and nothing else — every visual prop
 * comes from {@link bpmnNodeProps}. Undefined keys are dropped because that is
 * what `surface.addElement` stores, so a scene artefact stays comparable with a
 * derived one.
 */
function node(kind: BpmnNodeKind, x: number, y: number, text?: string) {
  const { w, h } = NODE_SIZE[kind];
  return defined({
    ...bpmnNodeProps(kind, { xywh: `[${x},${y},${w},${h}]` }),
    // A snapshot carries a serialized `Y.Text`, never a bare string.
    ...(text === undefined ? {} : { text: surfaceText(text) }),
  });
}

/** A scene participant, from the same description the toolbox draws from. */
const pool = (x: number, y: number, w: number, h: number, name: string) =>
  defined(bpmnPoolProps({ xywh: `[${x},${y},${w},${h}]`, name }));

/** Drop the keys a preset left undefined — what `addElement` would store. */
function defined(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined)
  );
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
 *
 * Hand-written, and the one artefact card that cannot derive:
 * `bpmn.sequenceFlowTool` ACTIVATES a tool rather than drawing anything, so
 * there is nothing to record — the user draws it.
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

/* ── Previews ─────────────────────────────────────────────────────────────
 *
 * One 135×80 sketch per card, in the toolbar glyphs' own shapes
 * (`../toolbar/icons.ts`). A preview has one job, which is to look like what
 * lands on the board.
 */

const A =
  'width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"';

/** An event: the ring weight says start or end, the glyph says what triggers it. */
const eventPreview = (stroke: string, width: number, glyph = '') =>
  `<svg ${A} fill="none"><circle cx="67" cy="40" r="20" stroke="${stroke}" stroke-width="${width}"/>${glyph}</svg>`;

/** An activity: one rounded rectangle, and a marker tells the kinds apart. */
const taskPreview = (glyph = '', width = 2.4) =>
  `<svg ${A} fill="none"><rect x="34" y="24" width="66" height="32" rx="6" stroke="${NEUTRAL_STROKE}" stroke-width="${width}"/>${glyph}</svg>`;

/** A gateway: one diamond, one marker each. */
const gatewayPreview = (marker: string) =>
  `<svg ${A} fill="none"><path d="M67 16 L92 40 L67 64 L42 40 Z" stroke="${NEUTRAL_STROKE}" stroke-width="2.4" stroke-linejoin="round"/><path d="${marker}" stroke="${NEUTRAL_STROKE}" stroke-width="2.2" stroke-linecap="round"/></svg>`;

const ENVELOPE = `<rect x="59" y="35" width="16" height="11" stroke="${NEUTRAL_STROKE}" stroke-width="1.4"/><path d="M59 35 L67 42 L75 35" stroke="${NEUTRAL_STROKE}" stroke-width="1.4" stroke-linejoin="round"/>`;
const CLOCK = `<circle cx="67" cy="40" r="9" stroke="${NEUTRAL_STROKE}" stroke-width="1.4"/><path d="M67 40 V33 M67 40 L72 43" stroke="${NEUTRAL_STROKE}" stroke-width="1.4" stroke-linecap="round"/>`;

const previews = {
  process: `<svg ${A} fill="none"><circle cx="16" cy="40" r="8" stroke="${EVENT_START}" stroke-width="2"/><rect x="34" y="31" width="26" height="18" rx="3" stroke="${NEUTRAL_STROKE}" stroke-width="1.6"/><path d="M78 31 L88 40 L78 49 L68 40 Z" stroke="${NEUTRAL_STROKE}" stroke-width="1.4"/><path d="M73 37 L83 43 M83 37 L73 43" stroke="${NEUTRAL_STROKE}" stroke-width="1.2"/><circle cx="118" cy="40" r="8" stroke="${EVENT_END}" stroke-width="3"/><path d="M24 40 H34 M60 40 H68 M88 40 H110" stroke="${SEQUENCE_STROKE}" stroke-width="1.2"/></svg>`,
  startEvent: eventPreview(EVENT_START, 3),
  startEventMessage: eventPreview(EVENT_START, 3, ENVELOPE),
  startEventTimer: eventPreview(EVENT_START, 3, CLOCK),
  endEvent: eventPreview(EVENT_END, 5),
  endEventMessage: eventPreview(EVENT_END, 5, ENVELOPE),
  endEventTerminate: eventPreview(
    EVENT_END,
    5,
    `<circle cx="67" cy="40" r="8" fill="${NEUTRAL_STROKE}"/>`
  ),
  task: taskPreview(),
  taskUser: taskPreview(
    `<circle cx="41" cy="31" r="2.6" stroke="${NEUTRAL_STROKE}" stroke-width="1.2"/><path d="M37.4 38 a3.6 3.6 0 0 1 7.2 0" stroke="${NEUTRAL_STROKE}" stroke-width="1.2"/>`
  ),
  taskService: taskPreview(
    `<circle cx="41" cy="32" r="3.4" stroke="${NEUTRAL_STROKE}" stroke-width="1.2"/><circle cx="41" cy="32" r="1" fill="${NEUTRAL_STROKE}"/><path d="M41 27.4 V29 M41 35 V36.6 M36.4 32 H38 M44 32 H45.6" stroke="${NEUTRAL_STROKE}" stroke-width="1.2" stroke-linecap="round"/>`
  ),
  // Neither carries the notation's collapsed `[+]`: it opens nothing in Labre
  // and the board does not paint it, so a card that did would be advertising a
  // drawing the command never makes.
  subProcess: taskPreview(),
  // The thick border IS the distinction: this box stands for a process defined
  // elsewhere (`presets.ts`, `CALL_ACTIVITY_WIDTH`).
  callActivity: taskPreview('', 4.5),
  gateway: gatewayPreview('M58 31 L76 49 M76 31 L58 49'),
  gatewayParallel: gatewayPreview('M67 30 V50 M57 40 H77'),
  dataObject: `<svg ${A} fill="none"><path d="M52 14 H76 L88 26 V66 H52 Z" stroke="${NEUTRAL_STROKE}" stroke-width="2.2" stroke-linejoin="round"/><path d="M76 14 V26 H88" stroke="${NEUTRAL_STROKE}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  dataStore: `<svg ${A} fill="none"><path d="M48 22 V58 C48 62 56 65 67 65 C78 65 86 62 86 58 V22" stroke="${NEUTRAL_STROKE}" stroke-width="2.2" stroke-linejoin="round"/><ellipse cx="67" cy="22" rx="19" ry="6" stroke="${NEUTRAL_STROKE}" stroke-width="2.2"/></svg>`,
  textAnnotation: `<svg ${A} fill="none"><path d="M46 16 H36 V64 H46" stroke="${NEUTRAL_STROKE}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M54 28 H100 M54 40 H100 M54 52 H86" stroke="${NEUTRAL_STROKE}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  group: `<svg ${A} fill="none"><rect x="18" y="12" width="99" height="56" rx="10" stroke="${GROUP_STROKE}" stroke-width="2.2" stroke-dasharray="7 5"/></svg>`,
  sequence: `<svg ${A} fill="none"><path d="M24 40 H96" stroke="${SEQUENCE_STROKE}" stroke-width="2.4" stroke-linecap="round"/><path d="M94 33 L108 40 L94 47 Z" fill="${SEQUENCE_STROKE}"/></svg>`,
  pool: `<svg ${A} fill="none"><rect x="14" y="20" width="107" height="40" rx="3" stroke="${POOL_FRAME_COLOR}" stroke-width="2"/><path d="M30 20 V60" stroke="${POOL_FRAME_COLOR}" stroke-width="1.8"/><rect x="14" y="20" width="16" height="40" fill="${POOL_BAND_FILL}"/><path d="M30 20 V60" stroke="${POOL_FRAME_COLOR}" stroke-width="1.8"/></svg>`,
  // Two participants stacked, and the dashed line between them is the whole
  // point of the card: a message flow is the one arrow that crosses a pool.
  // Its source terminator is a FILLED disc, matching what `renderCircle`
  // actually paints rather than the hollow ring the norm asks for — a preview
  // has one job, which is to look like what lands on the board.
  messageExchange: `<svg ${A} fill="none"><rect x="14" y="8" width="107" height="27" rx="3" stroke="${POOL_FRAME_COLOR}" stroke-width="1.6"/><rect x="14" y="8" width="11" height="27" fill="${POOL_BAND_FILL}"/><path d="M25 8 V35" stroke="${POOL_FRAME_COLOR}" stroke-width="1.4"/><rect x="14" y="45" width="107" height="27" rx="3" stroke="${POOL_FRAME_COLOR}" stroke-width="1.6"/><rect x="14" y="45" width="11" height="27" fill="${POOL_BAND_FILL}"/><path d="M25 45 V72" stroke="${POOL_FRAME_COLOR}" stroke-width="1.4"/><circle cx="33" cy="21.5" r="4.5" stroke="${EVENT_START}" stroke-width="1.6"/><rect x="46" y="14" width="26" height="15" rx="3" stroke="${NEUTRAL_STROKE}" stroke-width="1.6"/><circle cx="88" cy="21.5" r="4.5" stroke="${EVENT_END}" stroke-width="2.6"/><rect x="46" y="51" width="26" height="15" rx="3" stroke="${NEUTRAL_STROKE}" stroke-width="1.6"/><path d="M41 21.5 H46 M72 21.5 H83" stroke="${SEQUENCE_STROKE}" stroke-width="1.4"/><circle cx="59" cy="31.5" r="2.2" fill="${MESSAGE_STROKE}"/><path d="M59 34 V48" stroke="${MESSAGE_STROKE}" stroke-width="1.4" stroke-dasharray="3 2.4"/><path d="M56 46 L59 50 L62 46" stroke="${MESSAGE_STROKE}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

/* ── The two worked scenes ────────────────────────────────────────────────── */

/**
 * A hand-composed card — what is left once the artefacts are derived.
 *
 * `build` takes the OPTIONAL inserting editor: called with none, at module
 * load, for the English `content`; called again with the real `std` as
 * {@link Template.localize}, so the two builds read the very same layout and
 * differ only in the words a seed resolves to (`docs/adr/0023`).
 */
const scene = (
  name: string,
  preview: string,
  build: (std?: BlockStdScope) => SurfaceElementsJSON,
  nameKey?: string
): Template => ({
  name,
  type: 'template',
  preview,
  nameKey,
  content: makeTemplateSnapshot(build(), name),
  localize: std => makeTemplateSnapshot(build(std), name),
});

function process(std?: BlockStdScope): SurfaceElementsJSON {
  return {
    pool: pool(0, 0, 640, 200, seedText(std, SIMPLE_PROCESS_SEED.poolName)),
    start: node('startEvent', 40, 72),
    task1: node(
      'task',
      116,
      64,
      seedText(std, SIMPLE_PROCESS_SEED.submitRequest)
    ),
    gw: node('gatewayExclusive', 272, 64),
    task2: node('task', 376, 20, seedText(std, SIMPLE_PROCESS_SEED.fulfil)),
    task3: node('task', 376, 124, seedText(std, SIMPLE_PROCESS_SEED.reject)),
    end: node('endEvent', 556, 72),
    c1: seq('start', 'task1'),
    c2: seq('task1', 'gw'),
    c3: seq('gw', 'task2'),
    c4: seq('gw', 'task3'),
    c5: seq('task2', 'end'),
    c6: seq('task3', 'end'),
  };
}

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
 *
 * ## The end event, which is not decoration
 *
 * The customer pool shipped with a start event and no end, which is a verbatim
 * violation of BPMN 2.0.2 p.246 and of `bpmn.pool-start-without-end` — a
 * `warning` the moment anybody switched the card to the descriptive profile.
 * Factory content teaching the mistake the rule pack reports is the worst
 * possible first BPMN diagram, and nothing in the repository compared the two
 * until this slice ran the rules over the shipped cards. The customer's process
 * now closes where it should: order placed, then done.
 */
function messageExchange(std?: BlockStdScope): SurfaceElementsJSON {
  return {
    customer: pool(
      0,
      0,
      640,
      200,
      seedText(std, MESSAGE_EXCHANGE_SEED.customer)
    ),
    supplier: pool(
      0,
      240,
      640,
      200,
      seedText(std, MESSAGE_EXCHANGE_SEED.supplier)
    ),
    start: node('startEvent', 40, 72),
    ask: node(
      'taskUser',
      140,
      64,
      seedText(std, MESSAGE_EXCHANGE_SEED.placeOrder)
    ),
    done: node('endEvent', 320, 72),
    answer: node(
      'taskService',
      140,
      304,
      seedText(std, MESSAGE_EXCHANGE_SEED.confirmOrder)
    ),
    // Inside the first participant: what happens, and in what order.
    inside: seq('start', 'ask'),
    closes: seq('ask', 'done'),
    // Across the two: who told whom.
    across: msg('ask', 'answer'),
  };
}

export const bpmnTemplateCategory: TemplateCategory = {
  name: 'BPMN',
  // Reuses the senior button's own key — see `TemplateCategory.nameKey`.
  nameKey: 'com.labre.framework.bpmn',
  templates: [
    scene(
      'Simple process',
      previews.process,
      process,
      BPMN_TEMPLATE_NAME_SIMPLE_PROCESS[0]
    ),
    scene(
      'Message exchange',
      previews.messageExchange,
      messageExchange,
      BPMN_TEMPLATE_NAME_MESSAGE_EXCHANGE[0]
    ),
    /* ── The core: a drawable process, from the first click ─────────────── */
    templateFromCommand(byId('bpmn.addStartEvent'), previews.startEvent),
    templateFromCommand(byId('bpmn.addEndEvent'), previews.endEvent),
    templateFromCommand(byId('bpmn.addTask'), previews.task),
    templateFromCommand(byId('bpmn.addExclusiveGateway'), previews.gateway),
    scene(
      'Sequence flow',
      previews.sequence,
      () => ({ a: freeSeq() }),
      BPMN_TEMPLATE_NAME_SEQUENCE_FLOW[0]
    ),
    templateFromCommand(byId('bpmn.addPool'), previews.pool),
    /* ── Activities ─────────────────────────────────────────────────────── */
    templateFromCommand(byId('bpmn.addUserTask'), previews.taskUser),
    templateFromCommand(byId('bpmn.addServiceTask'), previews.taskService),
    templateFromCommand(byId('bpmn.addSubProcess'), previews.subProcess),
    templateFromCommand(byId('bpmn.addCallActivity'), previews.callActivity),
    /* ── The other gateway ──────────────────────────────────────────────── */
    templateFromCommand(
      byId('bpmn.addParallelGateway'),
      previews.gatewayParallel
    ),
    /* ── Event variants ─────────────────────────────────────────────────── */
    templateFromCommand(
      byId('bpmn.addMessageStartEvent'),
      previews.startEventMessage
    ),
    templateFromCommand(
      byId('bpmn.addTimerStartEvent'),
      previews.startEventTimer
    ),
    templateFromCommand(
      byId('bpmn.addMessageEndEvent'),
      previews.endEventMessage
    ),
    templateFromCommand(
      byId('bpmn.addTerminateEndEvent'),
      previews.endEventTerminate
    ),
    /* ── Data, and what an author writes ON the picture ──────────────────── */
    templateFromCommand(byId('bpmn.addDataObject'), previews.dataObject),
    templateFromCommand(byId('bpmn.addDataStore'), previews.dataStore),
    templateFromCommand(
      byId('bpmn.addTextAnnotation'),
      previews.textAnnotation
    ),
    templateFromCommand(byId('bpmn.addGroup'), previews.group),
  ],
};
