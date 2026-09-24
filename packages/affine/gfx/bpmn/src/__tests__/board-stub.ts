import {
  type BpmnLane,
  BpmnNodeElementModel,
  type BpmnNodeKind,
  BpmnPoolElementModel,
  ConnectorElementModel,
  GroupElementModel,
  TextElementModel,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';

import { POOL_BAND_WIDTH } from '../consts';
import { BPMN_XML_OF_KIND, type BpmnExportBoard } from '../export';
import { bpmnBoardFrom } from '../interchange';
import { BPMN_ROLE, BPMN_ROLE_OF_KIND } from '../roles';

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

/**
 * `role` defaults to the one the creation builder stamps, because that is what
 * a drawn artefact carries and what the exporter now filters on
 * (`bpmnBoardFrom`). Overridable — with `undefined` — so a spec can build the
 * one thing that must NOT be exported: a neutral element, which is what a
 * legend swatch is and what a board drawn before 2026-08-26 is made of.
 */
export function fakePool(
  id: string,
  bound: [number, number, number, number],
  options: { name?: string; lanes?: BpmnLane[]; role?: string } = {}
): BpmnPoolElementModel {
  const pool = Object.create(BpmnPoolElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(pool, {
    id: { value: id, enumerable: true },
    role: {
      value: 'role' in options ? options.role : BPMN_ROLE.pool,
      enumerable: true,
    },
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

/** Same as {@link fakePool} on `role`, one artefact over. */
export function fakeNode(
  id: string,
  kind: BpmnNodeKind,
  bound: [number, number, number, number],
  text?: string,
  options: { role?: string } = {}
): BpmnNodeElementModel {
  const node = Object.create(BpmnNodeElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(node, {
    id: { value: id, enumerable: true },
    role: {
      value: 'role' in options ? options.role : BPMN_ROLE_OF_KIND[kind],
      enumerable: true,
    },
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

/** A free text, as a `bpmn:label` (or any role) — what the palette writes. */
export function fakeText(
  id: string,
  text: string,
  bound: [number, number, number, number],
  options: { role?: string } = {}
): TextElementModel {
  const element = Object.create(TextElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(element, {
    id: { value: id, enumerable: true },
    role: {
      value: 'role' in options ? options.role : BPMN_ROLE.label,
      enumerable: true,
    },
    // A string where the model holds a `Y.Text`: the reader calls
    // `toString()`, which both answer.
    text: { value: text, enumerable: true },
    elementBound: { value: new Bound(...bound) },
  });
  return element as unknown as TextElementModel;
}

/** A native group over `childIds`, the accessor the board picker reads. */
export function fakeGroup(
  id: string,
  childIds: string[],
  bound: [number, number, number, number] = [0, 0, 0, 0]
): GroupElementModel {
  const element = Object.create(GroupElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(element, {
    id: { value: id, enumerable: true },
    role: { value: undefined, enumerable: true },
    childIds: { value: childIds, enumerable: true },
    elementBound: { value: new Bound(...bound) },
  });
  return element as unknown as GroupElementModel;
}

/**
 * A named external node the way the palette draws it: the bare symbol, its
 * `bpmn:label` under it, and the group binding the two (R38). Returns the
 * three elements in creation order.
 */
export function fakeLabelledNode(
  id: string,
  kind: BpmnNodeKind,
  bound: [number, number, number, number],
  name: string
): [BpmnNodeElementModel, TextElementModel, GroupElementModel] {
  const node = fakeNode(id, kind, bound);
  const label = fakeText(`${id}-label`, name, [
    bound[0],
    bound[1] + bound[3] + 6,
    120,
    26,
  ]);
  return [node, label, fakeGroup(`${id}-group`, [node.id, label.id])];
}

export const board = (partial: Partial<BpmnExportBoard>): BpmnExportBoard => ({
  pools: [],
  nodes: [],
  connectors: [],
  ...partial,
});

/**
 * What the CALLER of an importer does — the half of the round trip that is
 * nobody's pure function — followed by the board picking the export does.
 *
 * The importer returns props, never models: it has no surface, and
 * `surface.addElement` mints its own nanoid and ignores any id handed to it
 * (`docs/adr/0012`, D3 — surface identity is Labre's and never the file's). So
 * a connector's endpoints come back naming the SOURCE FILE's ids, and a
 * group's children name the reader's PROVISIONAL ids (`bpmn-import-<n>`); the
 * caller turns both into surface ids, the way `materializeInterchangeImport`
 * does: source id first, provisional name second.
 *
 * The stubs are then handed to the real `bpmnBoardFrom`, so a gravitating
 * label is read back through its group exactly as the editor's export reads
 * it, rather than through a second copy of that rule kept here.
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
  const byLocal = new Map<string, string>();
  elements.forEach((props, index) => {
    const source = sourceId(props);
    if (source !== undefined && !bySource.has(source)) {
      bySource.set(source, surfaceIds[index]);
    }
    if (typeof props.id === 'string' && !byLocal.has(props.id)) {
      byLocal.set(props.id, surfaceIds[index]);
    }
  });
  const resolve = (name: string) =>
    bySource.get(name) ?? byLocal.get(name) ?? name;

  const models: GfxPrimitiveElementModel[] = [];

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
        // Whatever the importer stamped, verbatim: the round trip has to prove
        // that a file comes back as artefacts the exporter will speak about.
        role: props.role as string | undefined,
      });
      carry(pool, props);
      models.push(pool);
    } else if (props.type === 'bpmnNode') {
      const node = fakeNode(
        id,
        props.kind as BpmnNodeKind,
        bound,
        props.text as string | undefined,
        { role: props.role as string | undefined }
      );
      carry(node, props);
      models.push(node);
    } else if (props.type === 'connector') {
      const ends = (side: 'source' | 'target') => {
        const end = props[side] as { id?: string } | undefined;
        const named = end?.id;
        return named === undefined ? undefined : resolve(named);
      };
      const connector = fakeConnector(
        id,
        props.role as string | undefined,
        { source: ends('source'), target: ends('target') },
        { text: props.text as string | undefined }
      );
      carry(connector, props);
      models.push(connector);
    } else if (props.type === 'text') {
      models.push(
        fakeText(id, String(props.text ?? ''), bound, {
          role: props.role as string | undefined,
        })
      );
    } else if (props.type === 'group') {
      const children = Object.keys(
        (props.children as Record<string, unknown> | undefined) ?? {}
      );
      models.push(fakeGroup(id, children.map(resolve)));
    }
  });

  return bpmnBoardFrom(models);
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
