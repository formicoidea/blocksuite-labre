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
    // Empty, and PRESENT: the exporter reads it on every element now (it is
    // where an import records what the file called this thing), and the real
    // accessor goes through a `Y.Map` a prototype-grafted stub does not have.
    interchange: { value: undefined, writable: true, enumerable: true },
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
    interchange: { value: undefined, writable: true, enumerable: true },
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
    interchange: { value: undefined, writable: true, enumerable: true },
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
 * What the CALLER of an importer does, in eighteen lines — the half of the
 * round trip that is nobody's pure function.
 *
 * The importer returns props, never models: it has no surface, and
 * `surface.addElement` mints its own nanoid and ignores any id handed to it
 * (`docs/adr/0012`, D3 — surface identity is Labre's and never the file's). So
 * a connector's endpoints come back naming the SOURCE FILE's ids, and the
 * caller is what turns them into surface ids, using the one map the array
 * already contains: `interchange.bpmn.id` → the id the surface just minted.
 *
 * Stubbed here rather than mocked: this is exactly what the editor command owes
 * (and what a labre-mcp tool owes), so a test that skipped it would be proving
 * the round trip of something nobody can call.
 */
export function boardFromProps(
  elements: readonly (Record<string, unknown> & { type: string })[]
): BpmnExportBoard {
  const surfaceIds = elements.map((_, index) => `imported-${index + 1}`);
  const sourceId = (props: Record<string, unknown>) => {
    const carried = props.interchange as
      | Record<string, { id?: string }>
      | undefined;
    return carried?.bpmn?.id;
  };

  const bySource = new Map<string, string>();
  elements.forEach((props, index) => {
    const source = sourceId(props);
    if (source !== undefined && !bySource.has(source)) {
      bySource.set(source, surfaceIds[index]);
    }
  });

  const built = board({});
  const pools: BpmnPoolElementModel[] = [];
  const nodes: BpmnNodeElementModel[] = [];
  const connectors: ConnectorElementModel[] = [];

  elements.forEach((props, index) => {
    const id = surfaceIds[index];
    const bound = props.xywh
      ? (Bound.deserialize(String(props.xywh)).toXYWH() as [
          number,
          number,
          number,
          number,
        ])
      : ([0, 0, 0, 0] as [number, number, number, number]);

    if (props.type === 'bpmnPool') {
      const pool = fakePool(id, bound, {
        name: props.name as string | undefined,
        lanes: props.lanes as BpmnLane[] | undefined,
      });
      carry(pool, props);
      pools.push(pool);
    } else if (props.type === 'bpmnNode') {
      const node = fakeNode(
        id,
        props.kind as BpmnNodeKind,
        bound,
        props.text as string | undefined
      );
      carry(node, props);
      nodes.push(node);
    } else if (props.type === 'connector') {
      const ends = (side: 'source' | 'target') => {
        const end = props[side] as { id?: string } | undefined;
        const named = end?.id;
        return named === undefined ? undefined : (bySource.get(named) ?? named);
      };
      const connector = fakeConnector(
        id,
        props.role as string | undefined,
        { source: ends('source'), target: ends('target') },
        { text: props.text as string | undefined }
      );
      carry(connector, props);
      connectors.push(connector);
    }
  });

  return { ...built, pools, nodes, connectors };
}

/** Puts the foreign payload on the stub, the way the Y.Map would. */
function carry(model: object, props: Record<string, unknown>) {
  (model as { interchange?: unknown }).interchange = props.interchange;
}

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
