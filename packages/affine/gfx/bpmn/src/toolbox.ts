import type {
  FrameworkToolbox,
  SerializedElementProps,
  ToolboxItem,
  ToolboxLink,
  ToolboxPoint,
} from '@labre/affine-block-surface/interchange';
import type { BpmnLane, BpmnNodeKind } from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';

import { bpmnCommandsManifest } from './commands-manifest';
import {
  type BpmnEdgeKey,
  bpmnLabelMode,
  LANE_NAME_FALLBACK,
  NODE_LABEL,
  NODE_SIZE,
  POOL_NAME_FALLBACK,
  POOL_REF_HEIGHT,
  POOL_REF_WIDTH,
} from './consts';
import {
  bpmnConnectorProps,
  bpmnLabelBoxFor,
  bpmnLabelProps,
  bpmnNodeProps,
  bpmnPoolProps,
} from './presets';

/**
 * BPMN's toolbar as pure builders (`docs/adr/0045`): what `createBpmnNode`,
 * `createBpmnPool`, the lane gesture and the three flow tools place, with no
 * editor behind them. The actions call these, so an artefact a host places
 * and one placed from the toolbar are the same elements.
 */

/** The text slot of a flow object, an artefact or a data shape. */
export interface BpmnNodeTexts {
  /** The name; the kind's English seed when absent. */
  name?: string;
}

/**
 * A BPMN artefact at `at` (its top-left), as the toolbar places it.
 *
 * An inscribed kind (activities, the annotation, the group) is ONE element
 * carrying its name inside. An external kind (events, gateways, data shapes)
 * is the bare symbol, its name as a `bpmn:label` text centred under it, and
 * the group that makes the two one artefact, last (R38). The symbol's id is
 * `<local>:node` either way, which is what a flow attaches to.
 */
export function bpmnNodeElements(
  kind: BpmnNodeKind,
  at: ToolboxPoint,
  texts: BpmnNodeTexts = {},
  local: string = kind
): SerializedElementProps[] {
  const { w, h } = NODE_SIZE[kind];
  const name = texts.name?.trim() || NODE_LABEL[kind];
  const id = (part: string) => `${local}:${part}`;
  const xywh = new Bound(at.x, at.y, w, h).serialize();
  if (bpmnLabelMode(kind) === 'inscribed') {
    return [{ ...bpmnNodeProps(kind, { xywh, text: name }), id: id('node') }];
  }
  const label = bpmnLabelBoxFor(kind, at.x + w / 2, at.y + h / 2);
  const members = [
    // `text: undefined` and not no key: the symbol is born bare exactly as the
    // toolbar's is, and `bpmnNodeProps` passes the key through unchanged.
    { ...bpmnNodeProps(kind, { xywh, text: undefined }), id: id('node') },
    { ...bpmnLabelProps(name, label.x, label.y), id: id('label') },
  ];
  return [
    ...members,
    {
      type: 'group',
      id: id('group'),
      children: Object.fromEntries(members.map(m => [m.id, true])),
    },
  ];
}

/** The text slots of a pool. */
export interface BpmnPoolTexts {
  /** The participant's name; `Pool` when absent. */
  name?: string;
  /** One lane name per line, top to bottom; no lane when absent. */
  lanes?: string;
}

/**
 * A pool at `at`, at the size the toolbar draws it, with the lanes it is
 * given.
 *
 * Each lane is what one click on "Add lane" appends to a fresh pool: an equal
 * weight of 1, and `Lane N` when its line is blank. Its id is `<local>-lane-N`
 * and not a minted one: a builder mints nothing, and an id unique within the
 * pool is all a lane needs (the importer's own `lane-N` fallback).
 */
export function bpmnPoolElement(
  at: ToolboxPoint,
  texts: BpmnPoolTexts = {},
  local = 'pool'
): SerializedElementProps {
  const names = (texts.lanes ?? '').split('\n').map(line => line.trim());
  const lanes: BpmnLane[] = texts.lanes?.trim()
    ? names.map((name, i) => ({
        id: `${local}-lane-${i + 1}`,
        name: name || LANE_NAME_FALLBACK.replace('{{n}}', String(i + 1)),
        size: 1,
      }))
    : [];
  return {
    ...bpmnPoolProps({
      xywh: new Bound(at.x, at.y, POOL_REF_WIDTH, POOL_REF_HEIGHT).serialize(),
      name: texts.name?.trim() || POOL_NAME_FALLBACK,
    }),
    id: local,
    // Absent until the first lane, as on a pool drawn from the toolbar.
    ...(lanes.length > 0 ? { lanes } : {}),
  };
}

/** The connector a flow tool is armed with, between two ends. */
export function bpmnFlowElement(
  edge: BpmnEdgeKey,
  from: string,
  to: string,
  label?: string
): SerializedElementProps {
  return {
    ...bpmnConnectorProps(edge),
    source: { id: from },
    target: { id: to },
    ...(label?.trim() ? { text: label.trim() } : {}),
  };
}

/** The toolbar command's label, so a host names an item as the toolbar does. */
function label(commandId: string) {
  const row = bpmnCommandsManifest.find(r => r.id === commandId);
  return {
    labelKey: row?.labelKey ?? commandId,
    labelFallback: row?.labelFallback ?? commandId,
  };
}

const nodeItem = (
  id: string,
  kind: BpmnNodeKind,
  commandId: string
): ToolboxItem => ({
  id,
  ...label(commandId),
  texts: ['name'],
  size: NODE_SIZE[kind],
  build: (at, texts, local) => bpmnNodeElements(kind, at, texts, local),
});

const flowLink = (
  id: string,
  edge: BpmnEdgeKey,
  commandId: string
): ToolboxLink => ({
  id,
  ...label(commandId),
  build: (from, to, text) => bpmnFlowElement(edge, from, to, text),
});

/** Every item of the BPMN toolbar that places elements, in the toolbar's order. */
export const BPMN_TOOLBOX: FrameworkToolbox = {
  framework: 'bpmn',
  items: [
    nodeItem('start-event', 'startEvent', 'bpmn.addStartEvent'),
    nodeItem('end-event', 'endEvent', 'bpmn.addEndEvent'),
    nodeItem('task', 'task', 'bpmn.addTask'),
    nodeItem(
      'exclusive-gateway',
      'gatewayExclusive',
      'bpmn.addExclusiveGateway'
    ),
    {
      id: 'pool',
      ...label('bpmn.addPool'),
      texts: ['name', 'lanes'],
      size: { w: POOL_REF_WIDTH, h: POOL_REF_HEIGHT },
      build: (at, texts, local) => [bpmnPoolElement(at, texts, local)],
    },
    nodeItem('user-task', 'taskUser', 'bpmn.addUserTask'),
    nodeItem('service-task', 'taskService', 'bpmn.addServiceTask'),
    nodeItem('sub-process', 'subProcess', 'bpmn.addSubProcess'),
    nodeItem('call-activity', 'callActivity', 'bpmn.addCallActivity'),
    nodeItem('parallel-gateway', 'gatewayParallel', 'bpmn.addParallelGateway'),
    nodeItem(
      'message-start-event',
      'startEventMessage',
      'bpmn.addMessageStartEvent'
    ),
    nodeItem('timer-start-event', 'startEventTimer', 'bpmn.addTimerStartEvent'),
    nodeItem('message-end-event', 'endEventMessage', 'bpmn.addMessageEndEvent'),
    nodeItem(
      'terminate-end-event',
      'endEventTerminate',
      'bpmn.addTerminateEndEvent'
    ),
    nodeItem('data-object', 'dataObject', 'bpmn.addDataObject'),
    nodeItem('data-store', 'dataStore', 'bpmn.addDataStore'),
    nodeItem('text-annotation', 'textAnnotation', 'bpmn.addTextAnnotation'),
    nodeItem('group', 'group', 'bpmn.addGroup'),
  ],
  links: [
    flowLink('sequence-flow', 'sequenceFlow', 'bpmn.sequenceFlowTool'),
    flowLink('message-flow', 'messageFlow', 'bpmn.messageFlowTool'),
    flowLink('association', 'association', 'bpmn.associationTool'),
  ],
};
