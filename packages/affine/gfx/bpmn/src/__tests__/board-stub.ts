import {
  type BpmnLane,
  BpmnNodeElementModel,
  type BpmnNodeKind,
  BpmnPoolElementModel,
  ConnectorElementModel,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';

import { POOL_BAND_WIDTH } from '../consts';
import { BPMN_XML_OF_KIND, type BpmnExportBoard } from '../export';
import { BPMN_ROLE } from '../roles';

/**
 * Plain stubs for a BPMN board, shared by every spec that needs one.
 *
 * Prototype-grafted objects rather than real element models, because the
 * serializer and the interchange capability are pure functions over a handful
 * of accessors: nothing here needs a surface, a store or a canvas, and the day
 * one of them does, this file is where that stops being true.
 *
 * Shared rather than copied so that the export spec and the interchange spec
 * cannot silently drift onto two different boards and both keep passing.
 */

export const POOL_W = 560;
export const POOL_H = 200;
export const BAND = POOL_BAND_WIDTH;

/** The seventeen kinds, read off the mapping so the list cannot drift. */
export const ALL_KINDS = Object.keys(BPMN_XML_OF_KIND) as BpmnNodeKind[];

export function fakePool(
  id: string,
  bound: [number, number, number, number],
  options: { name?: string; lanes?: BpmnLane[] } = {}
): BpmnPoolElementModel {
  const pool = Object.create(BpmnPoolElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(pool, {
    id: { value: id, enumerable: true },
    name: { value: options.name, enumerable: true },
    lanes: { value: options.lanes, enumerable: true },
    elementBound: { value: new Bound(...bound) },
  });
  return pool as unknown as BpmnPoolElementModel;
}

export function fakeNode(
  id: string,
  kind: BpmnNodeKind,
  bound: [number, number, number, number],
  text?: string
): BpmnNodeElementModel {
  const node = Object.create(BpmnNodeElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(node, {
    id: { value: id, enumerable: true },
    kind: { value: kind, enumerable: true },
    text: { value: text, enumerable: true },
    elementBound: { value: new Bound(...bound) },
  });
  return node as unknown as BpmnNodeElementModel;
}

export function fakeConnector(
  id: string,
  role: string | undefined,
  ends: { source?: string; target?: string } = {},
  options: { text?: string; path?: [number, number][] } = {}
): ConnectorElementModel {
  const connector = Object.create(ConnectorElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(connector, {
    id: { value: id, enumerable: true },
    role: { value: role, enumerable: true },
    text: { value: options.text, enumerable: true },
    absolutePath: { value: options.path ?? [], enumerable: true },
    source: {
      value: ends.source === undefined ? {} : { id: ends.source },
      enumerable: true,
    },
    target: {
      value: ends.target === undefined ? {} : { id: ends.target },
      enumerable: true,
    },
  });
  return connector as unknown as ConnectorElementModel;
}

export const board = (partial: Partial<BpmnExportBoard>): BpmnExportBoard => ({
  pools: [],
  nodes: [],
  connectors: [],
  ...partial,
});

/**
 * Two participants, one of them divided in two lanes, every artefact the pack
 * draws, and one arrow of each kind between them.
 *
 * Built fresh on each call and read by several specs, because it is the case
 * the export exists for: anything simpler would let a whole half of the format
 * go unexercised.
 */
export function collaborationBoard() {
  const front: BpmnLane = { id: 'lane-front', name: 'Front office', size: 1 };
  const back: BpmnLane = { id: 'lane-back', name: 'Back office', size: 1 };
  const sales = fakePool('pool-sales', [0, 0, POOL_W, POOL_H], {
    name: 'Sales',
    lanes: [front, back],
  });
  const supplier = fakePool('pool-supplier', [0, 300, POOL_W, POOL_H], {
    name: 'Supplier',
  });

  // One of each kind, alternating between the two lanes of the first pool so
  // that `flowNodeRef` has something to get wrong.
  const nodes = ALL_KINDS.map((kind, index) =>
    fakeNode(
      `n-${kind}`,
      kind,
      [BAND + 5 + index * 28, index % 2 === 0 ? 40 : 150, 12, 12],
      `Label ${kind}`
    )
  );
  // …and one task in the other pool, so the message flow has somewhere to land.
  const remote = fakeNode('n-remote', 'task', [BAND + 20, 340, 12, 12], 'Ship');
  nodes.push(remote);

  const connectors = [
    fakeConnector('c-seq', BPMN_ROLE.sequenceFlow, {
      source: 'n-startEvent',
      target: 'n-task',
    }),
    fakeConnector(
      'c-msg',
      BPMN_ROLE.messageFlow,
      { source: 'n-task', target: 'n-remote' },
      { text: 'Order' }
    ),
    fakeConnector('c-assoc', BPMN_ROLE.association, {
      source: 'n-textAnnotation',
      target: 'n-task',
    }),
  ];

  return {
    board: board({ pools: [sales, supplier], nodes, connectors }),
    lanes: { front, back },
  };
}
