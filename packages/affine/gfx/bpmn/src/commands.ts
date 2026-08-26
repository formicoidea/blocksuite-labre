import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import type { TemplateResult } from 'lit';

import {
  activateBpmnSequenceFlow,
  addBpmnLane,
  bpmnLanesOf,
  bpmnPoolsForLaneEdit,
  createBpmnNode,
  createBpmnPool,
  removeBpmnLane,
} from './actions';
import {
  bpmnEndIcon,
  bpmnGatewayIcon,
  bpmnLaneAddIcon,
  bpmnLaneRemoveIcon,
  bpmnPoolIcon,
  bpmnSequenceIcon,
  bpmnStartIcon,
  bpmnTaskIcon,
} from './toolbar/icons';

/**
 * The BPMN toolbox as commands. Like EDGY, BPMN had a menu and zero manifest
 * entries before PF3 — invisible to Settings › Shortcuts (`docs/adr/0008`).
 */
interface Spec {
  id: string;
  label: string;
  iconKey: string;
  kind: 'artefact' | 'tool';
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
  run: (std: BlockStdScope) => void;
}

const SPECS: Spec[] = [
  {
    id: 'addStartEvent',
    label: 'Start event',
    iconKey: 'bpmn.start',
    kind: 'artefact',
    element: 'node:startEvent',
    run: std => createBpmnNode(std, 'startEvent'),
  },
  {
    id: 'addEndEvent',
    label: 'End event',
    iconKey: 'bpmn.end',
    kind: 'artefact',
    element: 'node:endEvent',
    run: std => createBpmnNode(std, 'endEvent'),
  },
  {
    id: 'addTask',
    label: 'Task',
    iconKey: 'bpmn.task',
    kind: 'artefact',
    element: 'node:task',
    run: std => createBpmnNode(std, 'task'),
  },
  {
    id: 'addExclusiveGateway',
    label: 'Exclusive gateway',
    iconKey: 'bpmn.gateway',
    kind: 'artefact',
    element: 'node:gatewayExclusive',
    run: std => createBpmnNode(std, 'gatewayExclusive'),
  },
  {
    id: 'sequenceFlowTool',
    label: 'Sequence flow',
    iconKey: 'bpmn.sequence',
    kind: 'tool',
    element: 'connector:sequence',
    run: activateBpmnSequenceFlow,
  },
  {
    id: 'addPool',
    label: 'Pool',
    iconKey: 'bpmn.pool',
    kind: 'artefact',
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
  category: 'flow',
  iconKey: spec.iconKey,
  surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
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
  category: 'flow',
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
    // Ranked after the six toolbox entries, so the catalogue reads
    // "here is what BPMN draws" before "here is what you do to it".
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
  'bpmn.end': bpmnEndIcon,
  'bpmn.task': bpmnTaskIcon,
  'bpmn.gateway': bpmnGatewayIcon,
  'bpmn.sequence': bpmnSequenceIcon,
  'bpmn.pool': bpmnPoolIcon,
  'bpmn.lane-add': bpmnLaneAddIcon,
  'bpmn.lane-remove': bpmnLaneRemoveIcon,
};
