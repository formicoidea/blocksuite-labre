import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import type { TemplateResult } from 'lit';

import {
  activateBpmnAssociation,
  activateBpmnMessageFlow,
  activateBpmnSequenceFlow,
  addBpmnLane,
  bpmnLanesOf,
  bpmnPoolsForLaneEdit,
  createBpmnNode,
  createBpmnPool,
  removeBpmnLane,
} from './actions';
import {
  bpmnAssociationIcon,
  bpmnCallActivityIcon,
  bpmnDataObjectIcon,
  bpmnDataStoreIcon,
  bpmnEndIcon,
  bpmnEndMessageIcon,
  bpmnEndTerminateIcon,
  bpmnGatewayIcon,
  bpmnGatewayParallelIcon,
  bpmnGroupIcon,
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
} from './toolbar/icons';

/**
 * The BPMN toolbox as commands. Like EDGY, BPMN had a menu and zero manifest
 * entries before PF3 — invisible to Settings › Shortcuts (`docs/adr/0008`).
 *
 * ## Twenty-three, and the fourteen
 *
 * The descriptive-profile pack draws 17 artefacts, 3 connecting objects and 3
 * swimlane gestures, which is a catalogue of 23 against a senior sub-menu that
 * holds 14. That is not a problem to be solved: PF6 built the arbitration for
 * exactly this day (`selectSeniorMenuCommands`), and past the cap the sub-menu
 * becomes the seven commands THIS user reaches for plus "More artefacts…".
 *
 * What a framework still owes is a sensible COLD START — the fourteen it would
 * put in the row if it had to choose, which is what the ranking falls back to
 * and what a host reading the manifest sees. Ours is: one of each family,
 * plus the variants an architect reaches for hourly (the user and service
 * tasks, the sub-process, the call activity, the parallel gateway, the message
 * flow, the data object, the annotation). What stays out is the TRIGGER
 * variants of start and end — a plain event is the honest first draft, and the
 * envelope or the clock is a refinement — the data store, and the two things
 * you reach for only once something is already drawn: the association and the
 * group. All 23 are in the catalogue, all 23 are bindable from Settings ›
 * Shortcuts, and none of them is unreachable.
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
  /** In the fourteen the sub-menu shows before any usage is measured. */
  senior: boolean;
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
  run: (std: BlockStdScope) => void;
}

const SPECS: Spec[] = [
  /* ── Events ─────────────────────────────────────────────────────────── */
  {
    id: 'addStartEvent',
    label: 'Start event',
    iconKey: 'bpmn.start',
    kind: 'artefact',
    category: 'events',
    senior: true,
    element: 'node:startEvent',
    run: std => createBpmnNode(std, 'startEvent'),
  },
  {
    id: 'addMessageStartEvent',
    label: 'Message start event',
    iconKey: 'bpmn.start.message',
    kind: 'artefact',
    category: 'events',
    senior: false,
    element: 'node:startEventMessage',
    run: std => createBpmnNode(std, 'startEventMessage'),
  },
  {
    id: 'addTimerStartEvent',
    label: 'Timer start event',
    iconKey: 'bpmn.start.timer',
    kind: 'artefact',
    category: 'events',
    senior: false,
    element: 'node:startEventTimer',
    run: std => createBpmnNode(std, 'startEventTimer'),
  },
  {
    id: 'addEndEvent',
    label: 'End event',
    iconKey: 'bpmn.end',
    kind: 'artefact',
    category: 'events',
    senior: true,
    element: 'node:endEvent',
    run: std => createBpmnNode(std, 'endEvent'),
  },
  {
    id: 'addMessageEndEvent',
    label: 'Message end event',
    iconKey: 'bpmn.end.message',
    kind: 'artefact',
    category: 'events',
    senior: false,
    element: 'node:endEventMessage',
    run: std => createBpmnNode(std, 'endEventMessage'),
  },
  {
    id: 'addTerminateEndEvent',
    label: 'Terminate end event',
    iconKey: 'bpmn.end.terminate',
    kind: 'artefact',
    category: 'events',
    senior: false,
    element: 'node:endEventTerminate',
    run: std => createBpmnNode(std, 'endEventTerminate'),
  },
  /* ── Activities ─────────────────────────────────────────────────────── */
  {
    id: 'addTask',
    label: 'Task',
    iconKey: 'bpmn.task',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:task',
    run: std => createBpmnNode(std, 'task'),
  },
  {
    id: 'addUserTask',
    label: 'User task',
    iconKey: 'bpmn.task.user',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:taskUser',
    run: std => createBpmnNode(std, 'taskUser'),
  },
  {
    id: 'addServiceTask',
    label: 'Service task',
    iconKey: 'bpmn.task.service',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:taskService',
    run: std => createBpmnNode(std, 'taskService'),
  },
  {
    id: 'addSubProcess',
    label: 'Sub-process',
    iconKey: 'bpmn.sub-process',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:subProcess',
    run: std => createBpmnNode(std, 'subProcess'),
  },
  {
    id: 'addCallActivity',
    label: 'Call activity',
    iconKey: 'bpmn.call-activity',
    kind: 'artefact',
    category: 'activities',
    senior: true,
    element: 'node:callActivity',
    run: std => createBpmnNode(std, 'callActivity'),
  },
  /* ── Gateways ───────────────────────────────────────────────────────── */
  {
    id: 'addExclusiveGateway',
    label: 'Exclusive gateway',
    iconKey: 'bpmn.gateway',
    kind: 'artefact',
    category: 'gateways',
    senior: true,
    element: 'node:gatewayExclusive',
    run: std => createBpmnNode(std, 'gatewayExclusive'),
  },
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
    run: std => createBpmnNode(std, 'gatewayParallel'),
  },
  /* ── Connecting objects ─────────────────────────────────────────────── */
  {
    id: 'sequenceFlowTool',
    label: 'Sequence flow',
    iconKey: 'bpmn.sequence',
    kind: 'tool',
    category: 'flows',
    senior: true,
    element: 'connector:sequence',
    run: activateBpmnSequenceFlow,
  },
  {
    id: 'messageFlowTool',
    label: 'Message flow',
    iconKey: 'bpmn.message',
    kind: 'tool',
    category: 'flows',
    senior: true,
    element: 'connector:message',
    run: activateBpmnMessageFlow,
  },
  {
    id: 'associationTool',
    label: 'Association',
    iconKey: 'bpmn.association',
    kind: 'tool',
    category: 'flows',
    senior: false,
    element: 'connector:association',
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
    run: std => createBpmnNode(std, 'dataObject'),
  },
  {
    id: 'addDataStore',
    label: 'Data store',
    iconKey: 'bpmn.data-store',
    kind: 'artefact',
    category: 'data',
    senior: false,
    element: 'node:dataStore',
    run: std => createBpmnNode(std, 'dataStore'),
  },
  /* ── Artifacts ──────────────────────────────────────────────────────── */
  {
    id: 'addTextAnnotation',
    label: 'Text annotation',
    iconKey: 'bpmn.text-annotation',
    kind: 'artefact',
    category: 'annotations',
    senior: true,
    element: 'node:textAnnotation',
    run: std => createBpmnNode(std, 'textAnnotation'),
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
    run: std => createBpmnNode(std, 'group'),
  },
  /* ── Swimlanes ──────────────────────────────────────────────────────── */
  {
    id: 'addPool',
    label: 'Pool',
    iconKey: 'bpmn.pool',
    kind: 'artefact',
    category: 'swimlanes',
    senior: true,
    element: 'pool',
    run: createBpmnPool,
  },
];

const toolboxCommands: CommandDescriptor[] = SPECS.map((spec, order) => ({
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
  run: spec.run,
  telemetry: { framework: 'bpmn', element: spec.element },
}));

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
    // Ranked after the toolbox entries, so the catalogue reads "here is what
    // BPMN draws" before "here is what you do to it" — and, since the pool is
    // the last of them, the two land directly under it in the same section.
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

export const bpmnCommands: CommandDescriptor[] = [
  ...toolboxCommands,
  ...laneCommands,
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
};
