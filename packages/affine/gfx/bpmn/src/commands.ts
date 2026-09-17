import type { BpmnNodeKind } from '@labre/affine-model';
import { StrokeStyle } from '@labre/affine-model';
import type {
  BlockStdScope,
  CommandDescriptor,
  CommandLegendBox,
  CommandLegendEntry,
  CommandLegendRow,
} from '@labre/std';
import type { RoleId } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

import {
  activateBpmnAssociation,
  activateBpmnMessageFlow,
  activateBpmnSequenceFlow,
  addBpmnLane,
  bpmnLanesOf,
  bpmnPoolsForLaneEdit,
  bpmnPoolsSelected,
  createBpmnNode,
  createBpmnPool,
  exportBpmnXmlFile,
  importBpmnSvgFile,
  importBpmnXmlFile,
  removeBpmnLane,
} from './actions';
import {
  BPMN_EDGE_STYLE,
  type BpmnEdgeKey,
  NODE_FILL,
  NODE_SIZE,
} from './consts';
import { bpmnNodeProps } from './presets';
import { BPMN_ROLE, BPMN_ROLE_OF_KIND } from './roles';
import {
  bpmnAssociationIcon,
  bpmnCallActivityIcon,
  bpmnDataObjectIcon,
  bpmnDataStoreIcon,
  bpmnEndIcon,
  bpmnEndMessageIcon,
  bpmnEndTerminateIcon,
  bpmnExportXmlIcon,
  bpmnGatewayIcon,
  bpmnGatewayParallelIcon,
  bpmnGroupIcon,
  bpmnImportSvgIcon,
  bpmnImportXmlIcon,
  bpmnLaneAddIcon,
  bpmnLaneRemoveIcon,
  bpmnMessageIcon,
  bpmnPoolIcon,
  bpmnSequenceIcon,
  bpmnStartIcon,
  bpmnStartMessageIcon,
  bpmnStartTimerIcon,
  bpmnSubProcessIcon,
  bpmnTaskIcon,
  bpmnTaskServiceIcon,
  bpmnTaskUserIcon,
  bpmnTextAnnotationIcon,
  bpmnToolbarIcon,
} from './toolbar/icons';

/**
 * The BPMN toolbox as commands. Like EDGY, BPMN had a menu and zero manifest
 * entries before PF3 — invisible to Settings › Shortcuts (`docs/adr/0008`).
 *
 * ## Twenty-six, and the fifteen
 *
 * The descriptive-profile pack draws 17 artefacts, 3 connecting objects and 3
 * swimlane gestures; the two directions of the `.bpmn` format and the SVG
 * fallback that reads a picture of a process make 26, against a
 * senior sub-menu that holds 14. That is not a problem to be solved: PF6 built
 * the arbitration for exactly this day (`selectSeniorMenuCommands`), and past
 * the cap the sub-menu becomes the thirteen commands THIS user reaches for plus
 * "More artefacts…" — fourteen buttons, exactly the cap.
 *
 * What a framework still owes is a sensible COLD START, and it owes it twice:
 *
 * - the FIFTEEN it nominates for the row — the fourteen toolbox entries flagged
 *   `senior` below, plus `bpmn.importXml`, which carries its own nomination on
 *   its descriptor. The toolbox fourteen are one of each family plus the
 *   variants an architect reaches for hourly (the user and service tasks, the
 *   sub-process, the call activity, the parallel gateway, the message flow, the
 *   data object, the annotation). What stays out is the TRIGGER variants of
 *   start and end — a plain event is the honest first draft, and the envelope or
 *   the clock is a refinement — the data store, and the two things you reach for
 *   only once something is already drawn: the association and the group.
 *
 *   Since the eligibility ruling of 2026-08-28 this list is not merely a cold
 *   start but the whole ELIGIBLE pool: usage ranks membership inside it and can
 *   no longer promote a command from outside it, so a command left out of it
 *   lives in the catalogue sidepanel and nowhere else. That is the right home
 *   for `bpmn.exportXml`, whose subject is a board you already have and which is
 *   reached from the pool's "⋮" — it declines the row on purpose. And for
 *   `bpmn.importSvg`, which declines it for a different reason again: the row
 *   carries the NATIVE format, and the visual-tier fallback sits one click away
 *   behind "More artefacts…" — see the note on {@link importSvgCommand}.
 *
 *   `bpmn.importXml` does NOT, since the PO decision of the same day: an import
 *   is where a board COMES FROM, and the sub-menu is the first thing a user
 *   opens on an empty canvas. Fifteen nominations against a cap of fourteen is
 *   the arbitration doing its job, not an overflow — see the note on
 *   {@link importCommand}, which is where that reversal is argued;
 * - the THIRTEEN a user with no history actually meets, which is the authored
 *   head of those fifteen. That is a different list again, and it is the one
 *   that gets seen first — see the note on {@link SPECS} for why the
 *   declarations lead with the core rather than by family. The import is the
 *   last nomination, so it is one of the two the "More artefacts…" button covers
 *   until somebody reaches for it.
 *
 * All 26 are in the catalogue, all 26 are bindable from Settings › Shortcuts,
 * and none of them is unreachable.
 */
interface Spec {
  id: string;
  label: string;
  iconKey: string;
  kind: 'artefact' | 'tool';
  /**
   * The catalogue section this entry is filed under. Kebab ids; the header
   * wording is the host's (`com.labre.catalogue.category.<id>`), with the
   * panel's own `humanizeCategory` as the fallback — so the framework names its
   * sections and invents no prose for them.
   */
  category:
    | 'events'
    | 'activities'
    | 'gateways'
    | 'flows'
    | 'data'
    | 'annotations'
    | 'swimlanes';
  /**
   * Nominated for the sub-menu — the fourteen TOOLBOX entries it may ever show,
   * beside the one nomination that is not a toolbox entry at all
   * ({@link importCommand}). Since 2026-08-28 this is an eligibility
   * declaration, not a starting position: usage ranks membership INSIDE the
   * nominated list and never promotes into it, and a cold start opens on its
   * first thirteen.
   */
  senior: boolean;
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
  /** Places the framework's board — see `CommandTelemetry.board`. */
  board?: true;
  /**
   * The artefact this entry draws. ONE declaration, three derivations: the
   * creation gesture, the role the command stamps and the legend row that
   * pictures it — so a swatch cannot end up showing a kind the button does not
   * draw.
   */
  node?: BpmnNodeKind;
  /** The connecting object this entry arms. Same, one declaration over. */
  edge?: BpmnEdgeKey;
  /**
   * The gesture, for the entries that are not "draw a node": the pool and the
   * three connecting objects. A spec with a {@link Spec.node} derives it.
   */
  run?: (std: BlockStdScope) => void;
}

/**
 * What a spec DOES — its own gesture, or the one its {@link Spec.node} implies.
 *
 * Total over {@link SPECS} by inspection, and loud rather than silent if it
 * ever stops being: a spec that drew nothing would be a button that does
 * nothing, which is worse than a module that refuses to load.
 */
function gestureOf(spec: Spec): (std: BlockStdScope) => void {
  if (spec.run) return spec.run;
  const kind = spec.node;
  if (!kind) {
    throw new Error(
      `bpmn: "${spec.id}" declares neither a node kind nor a run`
    );
  }
  return std => createBpmnNode(std, kind);
}

/**
 * Declaration order is DISPLAY order, and past the cap it is also the COLD
 * START — which is why it leads with the canonical core rather than with the
 * events.
 *
 * `selectSeniorMenuCommands` falls back to the authored head of the NOMINATED
 * list for a user who has invoked nothing yet. The row held seven when the
 * recette caught this, and an order grouped strictly by family spent all seven
 * on events: start, three of its variants, two ends, task. A first contact with
 * BPMN with no gateway, no sequence flow and no pool — every button drawing a
 * circle, and nothing to connect them with. Caught in a live recette, and it is
 * pure data.
 *
 * The first seven are therefore the seven artefacts a process cannot be drawn
 * without: start, end, task, exclusive gateway, sequence flow, pool, message
 * flow. Everything else follows in family blocks. The row seats thirteen since
 * 2026-08-28, which makes the head wider but not less load-bearing: a framework
 * whose declarations opened on six variants of one family would still meet a
 * user with a lopsided first contact. Nothing about position STABILITY changes
 * — author order is still the position law, and usage only ever changes
 * membership, never where a button sits (`docs/adr/0008`, amendments of
 * 2026-08-26 and 2026-08-28).
 *
 * The catalogue reads off the same order, so its headers now appear in
 * first-encounter order — events, activities, gateways, flows, swimlanes, data,
 * annotations — and the entries inside each keep author order. Both are better
 * reading than the strict grouping was: swimlanes climbs to where a pool
 * belongs, and the events section opens on the plain start and end rather than
 * burying them under their own variants.
 */
const SPECS: Spec[] = [
  /* ── The core: a drawable process, from the first click ─────────────── */
  {
    id: 'addStartEvent',
    label: 'Start event',
    iconKey: 'bpmn.start',
    kind: 'artefact',
    category: 'events',
    senior: true,
    element: 'node:startEvent',
    node: 'startEvent',
  },
  {
    id: 'addEndEvent',
    label: 'End event',
    iconKey: 'bpmn.end',
    kind: 'artefact',
    category: 'events',
    senior: true,
    element: 'node:endEvent',
    node: 'endEvent',
  },
  {
    id: 'addTask',
    label: 'Task',
    iconKey: 'bpmn.task',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:task',
    node: 'task',
  },
  {
    id: 'addExclusiveGateway',
    label: 'Exclusive gateway',
    iconKey: 'bpmn.gateway',
    kind: 'artefact',
    category: 'gateways',
    senior: true,
    element: 'node:gatewayExclusive',
    node: 'gatewayExclusive',
  },
  {
    id: 'sequenceFlowTool',
    label: 'Sequence flow',
    iconKey: 'bpmn.sequence',
    kind: 'tool',
    category: 'flows',
    senior: true,
    element: 'connector:sequence',
    edge: 'sequenceFlow',
    run: activateBpmnSequenceFlow,
  },
  {
    id: 'addPool',
    label: 'Pool',
    iconKey: 'bpmn.pool',
    kind: 'artefact',
    category: 'swimlanes',
    senior: true,
    element: 'pool',
    board: true,
    run: createBpmnPool,
  },
  {
    // Seventh, and the last of the cold start: the moment there are two
    // participants there is a message between them, and it is the one arrow a
    // sequence flow may never stand in for.
    id: 'messageFlowTool',
    label: 'Message flow',
    iconKey: 'bpmn.message',
    kind: 'tool',
    category: 'flows',
    senior: true,
    element: 'connector:message',
    edge: 'messageFlow',
    run: activateBpmnMessageFlow,
  },
  /* ── Activities: the typed tasks and the two that stand for a process ─ */
  {
    id: 'addUserTask',
    label: 'User task',
    iconKey: 'bpmn.task.user',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:taskUser',
    node: 'taskUser',
  },
  {
    id: 'addServiceTask',
    label: 'Service task',
    iconKey: 'bpmn.task.service',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:taskService',
    node: 'taskService',
  },
  {
    id: 'addSubProcess',
    label: 'Sub-process',
    iconKey: 'bpmn.sub-process',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:subProcess',
    node: 'subProcess',
  },
  {
    id: 'addCallActivity',
    label: 'Call activity',
    iconKey: 'bpmn.call-activity',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:callActivity',
    node: 'callActivity',
  },
  /* ── The other gateway ──────────────────────────────────────────────── */
  {
    // `addParallelGateway`, matching the word order of the sibling that already
    // shipped (`addExclusiveGateway`) — a command id is a value a host override
    // table points at, and the pair reads as a pair in every list that sorts.
    id: 'addParallelGateway',
    label: 'Parallel gateway',
    iconKey: 'bpmn.gateway.parallel',
    kind: 'artefact',
    category: 'gateways',
    senior: true,
    element: 'node:gatewayParallel',
    node: 'gatewayParallel',
  },
  /* ── Event variants: what TRIGGERS a start, what an end does on the way
       out. Refinements of the two plain events above, so they follow them. ─ */
  {
    id: 'addMessageStartEvent',
    label: 'Message start event',
    iconKey: 'bpmn.start.message',
    kind: 'artefact',
    category: 'events',
    senior: false,
    element: 'node:startEventMessage',
    node: 'startEventMessage',
  },
  {
    id: 'addTimerStartEvent',
    label: 'Timer start event',
    iconKey: 'bpmn.start.timer',
    kind: 'artefact',
    category: 'events',
    senior: false,
    element: 'node:startEventTimer',
    node: 'startEventTimer',
  },
  {
    id: 'addMessageEndEvent',
    label: 'Message end event',
    iconKey: 'bpmn.end.message',
    kind: 'artefact',
    category: 'events',
    senior: false,
    element: 'node:endEventMessage',
    node: 'endEventMessage',
  },
  {
    id: 'addTerminateEndEvent',
    label: 'Terminate end event',
    iconKey: 'bpmn.end.terminate',
    kind: 'artefact',
    category: 'events',
    senior: false,
    element: 'node:endEventTerminate',
    node: 'endEventTerminate',
  },
  /* ── The last connecting object ─────────────────────────────────────── */
  {
    id: 'associationTool',
    label: 'Association',
    iconKey: 'bpmn.association',
    kind: 'tool',
    category: 'flows',
    senior: false,
    element: 'connector:association',
    edge: 'association',
    run: activateBpmnAssociation,
  },
  /* ── Data ───────────────────────────────────────────────────────────── */
  {
    id: 'addDataObject',
    label: 'Data object',
    iconKey: 'bpmn.data-object',
    kind: 'artefact',
    category: 'data',
    senior: true,
    element: 'node:dataObject',
    node: 'dataObject',
  },
  {
    id: 'addDataStore',
    label: 'Data store',
    iconKey: 'bpmn.data-store',
    kind: 'artefact',
    category: 'data',
    senior: false,
    element: 'node:dataStore',
    node: 'dataStore',
  },
  /* ── Artifacts: what an author writes ON the picture ────────────────── */
  {
    id: 'addTextAnnotation',
    label: 'Text annotation',
    iconKey: 'bpmn.text-annotation',
    kind: 'artefact',
    category: 'annotations',
    senior: true,
    element: 'node:textAnnotation',
    node: 'textAnnotation',
  },
  {
    // Filed with the annotation and not in a section of its own: both are
    // things an author writes ON the picture rather than parts of the process,
    // and BPMN 2.0.2 §10.4 exempts both from every rule for the same reason.
    id: 'addGroup',
    label: 'Group',
    iconKey: 'bpmn.group',
    kind: 'artefact',
    category: 'annotations',
    // Out of the fourteen, and not because it is unimportant: a lasso is drawn
    // round a part of the process that is already there, so it is never the
    // first thing reached for on a blank board — which is precisely what the
    // senior row is a shortcut to.
    senior: false,
    element: 'node:group',
    node: 'group',
  },
];

/* ── The legend, subscribed rather than tabulated ──────────────────────── */

/**
 * The legend of a pool is not a table: every row below is DERIVED from the
 * command that draws the artefact, from the same preset the gesture creates it
 * with, and it is listed only when the pool actually contains one (ADR 0026,
 * `legendFromCommands`).
 *
 * ## The swatch box, and why BPMN asks for a bigger one than UML
 *
 * UML tells its figures apart by full-box silhouettes (a stick figure, a
 * divided box, an ellipse) and is comfortable at 34 × 24. BPMN puts its
 * distinctions in CORNER MARKERS — the person and the cog are `0.24 × unit` in
 * the top-left (`node/node-renderer.ts`) — so it needs about 30 % more: at
 * 44 × 30 a task's marker is ~6 px and a gateway's arms ~6 px, which is the
 * floor at which they read at all.
 *
 * ## The one known visual limit
 *
 * The group's dashed lasso uses the renderer's fixed `[12, 12]` dash pattern
 * (`consts.ts` says why there is no dotted stroke to ask for): across 44 units
 * that is about two dashes, and down 29 it is none. The row is still
 * distinguishable from the text annotation — which draws no closed rectangle —
 * but it does not READ as dotted, and nothing in this file can change that.
 */
const SWATCH_W = 44;
const SWATCH_H = 30;

const BPMN_LEGEND_BOX: CommandLegendBox = {
  // No `titleWording`: every board that has a legend says the same generic
  // "Legend", which is what the platform falls back to (`BOARD_LEGEND_TITLE`).
  width: 300,
  rowHeight: 36,
  swatchWidth: SWATCH_W,
  swatchHeight: SWATCH_H,
};

/**
 * The three roles whose row must match EXACTLY, and no others.
 *
 * `bpmn:start-event`, `bpmn:end-event` and `bpmn:task` are the three roles with
 * a row that also have children (`roles.ts`). Without `exact`, a pool holding
 * only a message start event would light the plain "Start event" row too — a
 * bare circle nobody drew. The families that have no row at all
 * (`bpmn:event`, `bpmn:activity`, `bpmn:gateway`, `bpmn:data`,
 * `bpmn:flow-object`) need no such care: they are never stamped.
 */
const EXACT_ROLES: ReadonlySet<RoleId> = new Set([
  BPMN_ROLE.startEvent,
  BPMN_ROLE.endEvent,
  BPMN_ROLE.task,
]);

/**
 * A glyph row: the artefact itself, painted at swatch size by the very renderer
 * that paints it on the board — the creation preset minus three keys.
 *
 *  - `role`, because the legend is drawn IN the pool it documents and the scan
 *    detects by role: a swatch carrying one would list itself the next time,
 *    and all 21 validation rules would count it (`rules.ts`);
 *  - `xywh`, because the box belongs to the layout, which fits {@link
 *    CommandLegendRow.aspect} inside the swatch column;
 *  - `text`, because `bpmnNodeProps` writes the artefact's default caption at
 *    18 px with `TextFitMode.Overflow`: a "Task" that size would spill across
 *    the whole box. Without it `fontSize` / `textAlign` / `textFitMode` are
 *    inert, so there is no reason to strip those too.
 *
 * `radius` is the one prop SCALED to the swatch, and it has to be: it is an
 * absolute, unbounded value (`drawRect` calls `arcTo` with it), so the group's
 * 20 and the task's 10 would both round a 44 × 30 box into a pill.
 * `strokeWidth` is deliberately NOT scaled — the thin ring against the thick
 * one, and the call activity's heavy border against the sub-process's, IS the
 * notation, and at 30 units the 2-against-4 ratio reads better than at 56.
 */
function nodeRow(kind: BpmnNodeKind): CommandLegendRow {
  const {
    role: _role,
    xywh: _xywh,
    text: _text,
    ...props
  } = bpmnNodeProps(kind, { xywh: '[0,0,0,0]' });
  const size = NODE_SIZE[kind];
  return {
    swatch: 'glyph',
    // Read by nothing for a glyph row — the element carries its own fill and
    // stroke — and written all the same, because `CommandLegendRow` asks for a
    // colour and the paper is the honest answer. UML does the same.
    color: NODE_FILL,
    props: {
      ...props,
      radius: Math.round((Number(props.radius) || 0) * (SWATCH_H / size.h)),
    },
    aspect: size.h > 0 ? size.w / size.h : 1,
  };
}

/**
 * An edge row: the line the tool actually arms, endpoints and all, drawn by the
 * connector renderer at swatch width rather than approximated by a bar.
 *
 * `dashed` is kept beside the props although the connector carries its own
 * `strokeStyle`: it is the one fact about an edge row a pure test can read
 * without a renderer, and it is DERIVED from the same table, so the two can
 * never disagree.
 */
function edgeRow(key: BpmnEdgeKey): CommandLegendRow {
  const style = BPMN_EDGE_STYLE[key];
  return {
    swatch: 'edge',
    color: style.stroke,
    dashed: style.strokeStyle === StrokeStyle.Dash,
    props: { ...style },
  };
}

/**
 * The row a spec subscribes, or none.
 *
 * The pool subscribes nothing on purpose: it is the SHEET the legend is drawn
 * on, and listing it would be listing the paper — the same call C4's board and
 * UML's frame make about themselves.
 */
function legendOf(spec: Spec): CommandLegendEntry | undefined {
  if (spec.edge) {
    return { role: BPMN_ROLE[spec.edge], row: edgeRow(spec.edge) };
  }
  if (!spec.node) return undefined;
  const role = BPMN_ROLE_OF_KIND[spec.node];
  return {
    role,
    row: nodeRow(spec.node),
    ...(EXACT_ROLES.has(role) ? { exact: true } : {}),
  };
}

const toolboxCommands: CommandDescriptor[] = SPECS.map((spec, order) => {
  const legend = legendOf(spec);
  return {
    id: `bpmn.${spec.id}`,
    owner: 'bpmn',
    kind: spec.kind,
    labelKey: `com.labre.commands.bpmn.${spec.id}`,
    labelFallback: spec.label,
    category: spec.category,
    iconKey: spec.iconKey,
    // The catalogue holds all of them; `senior` decides which fourteen the
    // sub-menu opens on before this user has reached for anything.
    surfaces: spec.senior
      ? ['senior-menu', 'catalogue', 'palette', 'agent']
      : ['catalogue', 'palette', 'agent'],
    order,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'always',
    run: gestureOf(spec),
    telemetry: { framework: 'bpmn', element: spec.element, board: spec.board },
    ...(legend ? { legend } : {}),
    // The board carries the BOX the rows are laid out in, and only the board:
    // exactly one command per framework may declare it.
    ...(spec.board ? { legendBox: BPMN_LEGEND_BOX } : {}),
  };
});

/**
 * The LANE commands (B4) — the first BPMN entries that are not a toolbox slot.
 *
 * A lane is a subdivision of a pool that already exists, so there is nothing to
 * pick up off a palette and drop: these act on a SELECTION. That is why they
 * decline `'senior-menu'` — a permanently greyed entry in the sub-menu of a
 * framework you have not drawn anything with yet is furniture, not an
 * affordance. They keep `'catalogue'`, which every framework command carries,
 * so a host catalogue and Settings › Shortcuts still list them, and they join
 * `'contextual-toolbar'`, whose entry is declared by the pool's own
 * `ToolbarModuleConfig` and INVOKES these — one behaviour, one availability
 * rule, one telemetry emission (`docs/adr/0008`, `docs/adr/0010` M3).
 */
const LANE_COMMON = {
  owner: 'bpmn',
  kind: 'action',
  // The same section as the pool they divide: the catalogue reads "here is the
  // frame, and here is what you do to it" in one place, which is where a reader
  // looking for lanes actually looks.
  category: 'swimlanes',
  surfaces: ['catalogue', 'contextual-toolbar', 'palette', 'agent'],
  scope: 'edgeless',
  // Keyless by intent — still bindable from Settings › Shortcuts, which is what
  // `toShortcutDescriptor` being total buys.
  defaultKeys: { mac: [], other: [] },
  availability: 'selection',
} satisfies Partial<CommandDescriptor>;

const laneCommands: CommandDescriptor[] = [
  {
    ...LANE_COMMON,
    id: 'bpmn.addLane',
    labelKey: 'com.labre.commands.bpmn.addLane',
    labelFallback: 'Add lane',
    descriptionKey: 'com.labre.commands.bpmn.addLane.description',
    descriptionFallback:
      'Divide the selected pool into lanes; the new one takes an equal share.',
    iconKey: 'bpmn.lane-add',
    // Ranked after every toolbox entry, so the catalogue reads "here is what
    // BPMN draws" before "here is what you do to it". They still land in the
    // `swimlanes` section beside the pool — a section is where a command is
    // FILED, and `order` only decides where it sits inside it.
    order: SPECS.length,
    run: addBpmnLane,
    telemetry: { framework: 'bpmn', element: 'pool:lane-add' },
    // Narrows `'selection'`, never contradicts it: a selection holding no
    // unlocked pool has nothing to divide. Read-only rides in
    // `bpmnPoolsForLaneEdit` for the reason the union documents — it holds ONE
    // value, and `'selection'` is the precondition a catalogue has to show.
    when: std => bpmnPoolsForLaneEdit(std).length > 0,
  },
  {
    ...LANE_COMMON,
    id: 'bpmn.removeLane',
    labelKey: 'com.labre.commands.bpmn.removeLane',
    labelFallback: 'Remove lane',
    descriptionKey: 'com.labre.commands.bpmn.removeLane.description',
    descriptionFallback:
      'Remove the last lane of the selected pool. Nothing drawn in it moves.',
    iconKey: 'bpmn.lane-remove',
    order: SPECS.length + 1,
    run: removeBpmnLane,
    telemetry: { framework: 'bpmn', element: 'pool:lane-remove' },
    // …and additionally: a pool with no lane has none to remove.
    when: std =>
      bpmnPoolsForLaneEdit(std).some(model => bpmnLanesOf(model).length > 0),
  },
];

/**
 * The EXPORT — the first BPMN command whose subject is the whole board.
 *
 * ## Why it hangs off the pool's toolbar and still exports everything
 *
 * A pool is the only thing on the canvas that is unambiguously "this drawing is
 * a BPMN process", so it is where a reader looks for what to do with one. What
 * it is NOT is the scope: a BPMN document is a process, half a process is not a
 * smaller process, and a file holding one participant of a two-participant
 * collaboration would be a picture of a conversation with one side deleted. The
 * selected pool decides the FILENAME and nothing else — see
 * {@link exportBpmnXmlFile}.
 *
 * ## Surfaces
 *
 * It declines `'senior-menu'` for the same reason the lane gestures do: the
 * sub-menu is what you reach for to DRAW something, and this draws nothing. It
 * keeps `'catalogue'`, which is not a category claim but the registry's own
 * invariant — the catalogue is the TOTAL surface, and a command missing from it
 * is unreachable the moment its framework overflows the fourteen slots (pinned
 * by `registry.unit.spec.ts`). On the row itself it sits in the "⋮" menu rather
 * than as a button: it is the rarest thing anybody does to a pool, and the row
 * is already three entries wide.
 */
const exportCommand: CommandDescriptor = {
  id: 'bpmn.exportXml',
  owner: 'bpmn',
  kind: 'action',
  labelKey: 'com.labre.commands.bpmn.exportXml',
  labelFallback: 'Export BPMN XML',
  descriptionKey: 'com.labre.commands.bpmn.exportXml.description',
  descriptionFallback:
    'Download the whole board as a BPMN 2.0 XML file, ready to open in any BPMN tool.',
  // Filed with the import it is the other half of — see {@link INTERCHANGE}.
  // It shipped filed under `swimlanes`, because the pool's "⋮" is where it is
  // REACHED from and there was no better section for a command with no sibling;
  // a category is where a command is FILED, and it has one now.
  category: 'interchange',
  iconKey: 'bpmn.export-xml',
  surfaces: ['catalogue', 'contextual-toolbar', 'palette', 'agent'],
  order: SPECS.length + 2,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'selection',
  run: exportBpmnXmlFile,
  telemetry: { framework: 'bpmn', element: 'pool:export-xml' },
  // A pool in the selection, and no more than that: an export READS, so unlike
  // the lane gestures it is offered on a locked pool and on a read-only
  // document — which is precisely the board somebody wants to take away.
  when: std => bpmnPoolsSelected(std).length > 0,
};

/**
 * The IMPORT — the other direction of the same format, and the first BPMN
 * command that needs nothing on the board at all.
 *
 * ## `interchange`, and why the export moved into it
 *
 * These two are one subject: this board as a `.bpmn` file, out and in. The
 * export was filed under `swimlanes` because that is the toolbar it is reached
 * from and because a section of one is not a section; a category is where a
 * command is FILED and not where it is reached from, and filing the pair apart
 * would make the catalogue say that taking a process away and bringing one back
 * are different kinds of thing. `order` is untouched, so nothing MOVES inside a
 * section — the position law of `docs/adr/0008` is about rank, and this is
 * membership.
 *
 * ## Surfaces: four, and the one it declines
 *
 * `'senior-menu'` since the PO decision of 2026-08-28, which REVERSES the
 * ruling this comment used to carry ("the sub-menu is a row of things you DRAW,
 * and this draws nothing you chose"). The distinction survives for the EXPORT,
 * which is still catalogue-and-toolbar only: an export is what you do to a
 * board you already have, and it is reached from the pool it is about. An
 * import is where a board COMES FROM. On an empty canvas the sub-menu is the
 * first thing a user opens, and "start from a file somebody sent me" belongs in
 * that row beside "start from a start event" — asking them to find the
 * catalogue sidepanel first was the friction the decision names.
 *
 * The row itself is not at risk: BPMN's catalogue has outgrown the cap since
 * #157, so `selectSeniorMenuCommands` already ranks the nomination list down to
 * thirteen buttons plus "More artefacts…", and this entry takes a slot only
 * when the user actually reaches for it. It is the fifteenth nomination, and
 * nothing about the arbitration changes.
 *
 * No `'contextual-toolbar'`, and that is the difference from the export — a
 * contextual toolbar is a statement about a SELECTION, and the moment this
 * command is most wanted is on an empty board with nothing selected at all. It
 * keeps `'catalogue'` (the registry's total surface — a command missing from it
 * is unreachable), `'palette'` and `'agent'`.
 *
 * ## `'editable'`, which is the first use of it in the repo
 *
 * An import needs no selection — but it WRITES, so a read-only document is a
 * document it cannot run on, and that is a precondition a catalogue has to be
 * able to show. `'editable'` is exactly that value and it has been in the union
 * since `docs/adr/0008` (`Availability`, `command-registry.ts`); nothing had
 * reached for it before. `'always'` would light the entry on a read-only
 * document, do nothing when clicked, and put the same untruth into the
 * serializable manifest a host reads — which is the one thing `availability`
 * exists to prevent.
 *
 * The guard inside {@link importBpmnXmlFile} stays: a declaration is what a
 * surface renders from, and the action is what actually touches the store.
 *
 * The mirror image of the export, which READS and is therefore `'selection'` on
 * a pool and offered on a read-only document precisely because that is the
 * board somebody wants to take away.
 */
const importCommand: CommandDescriptor = {
  id: 'bpmn.importXml',
  owner: 'bpmn',
  kind: 'action',
  labelKey: 'com.labre.commands.bpmn.importXml',
  labelFallback: 'Import BPMN XML',
  descriptionKey: 'com.labre.commands.bpmn.importXml.description',
  descriptionFallback:
    'Open a BPMN 2.0 XML file as a board. What Labre cannot draw is kept in the document, and the import says what it was.',
  category: 'interchange',
  iconKey: 'bpmn.import-xml',
  surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
  order: SPECS.length + 3,
  scope: 'edgeless',
  // Keyless by intent, like every other BPMN entry: past fourteen a framework
  // binds by host override rather than by shipping a default chord. Still
  // bindable from Settings › Shortcuts, which is what `toShortcutDescriptor`
  // being total buys.
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  run: importBpmnXmlFile,
  // `board:` and not `pool:`: the export names the pool whose toolbar launched
  // it, and this one is launched with no pool anywhere.
  telemetry: { framework: 'bpmn', element: 'board:import-xml' },
};

/**
 * The SVG FALLBACK import — the visual tier, named as such before the picker
 * opens.
 *
 * ## Why it is not in the senior sub-menu, and that is an arbitration
 *
 * `bpmn.importXml` took the fifteenth nomination on the PO's ruling of
 * 2026-08-28, and that ruling was about where a BPMN board comes FROM: a file
 * somebody sent you, in the format the framework speaks. This is the other
 * kind of file — a picture of a process, from a tool that does not export
 * `.bpmn` at all — and it lands one click away, in the artefact catalogue
 * behind "More artefacts…", rather than taking a sixteenth slot in a row that
 * seats fourteen. The registry spec's budget assertion allows exactly ONE
 * over-nomination per owner and BPMN has spent it; this entry deliberately does
 * not contest it.
 *
 * **Flagged for the PO**: if the fallback turns out to be what people actually
 * reach for — a `.svg` is what most drawing tools export — this is a one-line
 * change (`surfaces` gains `'senior-menu'`), and it is a curation decision
 * rather than a merge.
 *
 * ## The label says the tier, because P2 requires it BEFORE the file is read
 *
 * "Import SVG sketch", and a description that spends its whole sentence on what
 * this is not: best effort, shapes and text, no round-trip. ADR 0012 is blunt
 * about the cost of getting this wrong — "a single 'Import…' entry that hides
 * the difference would earn a support ticket per user" — and the surface is the
 * only place the difference can be stated, because the report comes AFTER the
 * decision to open the file.
 */
const importSvgCommand: CommandDescriptor = {
  id: 'bpmn.importSvg',
  owner: 'bpmn',
  kind: 'action',
  labelKey: 'com.labre.commands.bpmn.importSvg',
  labelFallback: 'Import SVG sketch',
  descriptionKey: 'com.labre.commands.bpmn.importSvg.description',
  descriptionFallback:
    'Best effort: recognises shapes and text, no round-trip. What arrives is a sketch you then promote into BPMN artefacts.',
  // Filed with the two `.bpmn` directions: the subject is the same one — this
  // board, and a file it came from or goes to.
  category: 'interchange',
  iconKey: 'bpmn.import-svg',
  surfaces: ['catalogue', 'palette', 'agent'],
  order: SPECS.length + 4,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  // It WRITES, so a read-only document is one it cannot run on — the same
  // reasoning as `bpmn.importXml`, and the value the catalogue renders from.
  availability: 'editable',
  run: importBpmnSvgFile,
  telemetry: { framework: 'bpmn', element: 'board:import-svg' },
};

export const bpmnCommands: CommandDescriptor[] = [
  ...toolboxCommands,
  ...laneCommands,
  exportCommand,
  importCommand,
  importSvgCommand,
];

export const bpmnCommandIcons: Record<string, TemplateResult> = {
  'bpmn.start': bpmnStartIcon,
  'bpmn.start.message': bpmnStartMessageIcon,
  'bpmn.start.timer': bpmnStartTimerIcon,
  'bpmn.end': bpmnEndIcon,
  'bpmn.end.message': bpmnEndMessageIcon,
  'bpmn.end.terminate': bpmnEndTerminateIcon,
  'bpmn.task': bpmnTaskIcon,
  'bpmn.task.user': bpmnTaskUserIcon,
  'bpmn.task.service': bpmnTaskServiceIcon,
  'bpmn.sub-process': bpmnSubProcessIcon,
  'bpmn.call-activity': bpmnCallActivityIcon,
  'bpmn.gateway': bpmnGatewayIcon,
  'bpmn.gateway.parallel': bpmnGatewayParallelIcon,
  'bpmn.sequence': bpmnSequenceIcon,
  'bpmn.message': bpmnMessageIcon,
  'bpmn.association': bpmnAssociationIcon,
  'bpmn.data-object': bpmnDataObjectIcon,
  'bpmn.data-store': bpmnDataStoreIcon,
  'bpmn.text-annotation': bpmnTextAnnotationIcon,
  'bpmn.group': bpmnGroupIcon,
  'bpmn.pool': bpmnPoolIcon,
  'bpmn.lane-add': bpmnLaneAddIcon,
  'bpmn.lane-remove': bpmnLaneRemoveIcon,
  'bpmn.export-xml': bpmnExportXmlIcon,
  'bpmn.import-xml': bpmnImportXmlIcon,
  'bpmn.import-svg': bpmnImportSvgIcon,
  // The senior button's 56×56 glyph, so `FrameworkDescriptor.iconKey` resolves
  // through `getCommandIcon`.
  'bpmn.toolbar': bpmnToolbarIcon,
};
