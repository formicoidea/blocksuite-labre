import {
  ConnectorElementModel,
  GroupElementModel,
  TextElementModel,
  UmlDiagramElementModel,
  type UmlDiagramKind,
  UmlNodeElementModel,
  type UmlNodeKind,
  UmlPartitionElementModel,
  type UmlPartitionOrientation,
  UmlRegionElementModel,
  UmlSubjectElementModel,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';

import { UML_ROLE, UML_ROLE_OF_KIND } from '../roles.js';

/**
 * The UML diagram fixtures, shared by every spec in the pack that needs a board
 * rather than a declaration.
 *
 * Extracted for the reason C4's and BPMN's `board-stub.ts` were: the exporter,
 * the declared interchange capability (`docs/adr/0012`) and the model builder
 * are all handed the SAME diagram, and a second copy of a two-hundred-line
 * fixture is a second diagram that drifts.
 *
 * Every fake is an `Object.create(<Model>.prototype)` carrying its own
 * properties, and that is load-bearing rather than decorative: the commands and
 * the capability pick their artefacts out of a FLAT element list with
 * `instanceof`, so a plain record would be invisible to them. Properties are
 * defined on the INSTANCE, so nothing here touches a `Y.Text`, nothing here runs
 * a model's field decorators and nothing here tests Yjs.
 */

/* ── Stubs ────────────────────────────────────────────────────────────── */

export type Box = [number, number, number, number];

/**
 * One detached model: the real prototype, and the properties a fixture states.
 *
 * The prototype is what makes these visible to the readers — the commands and
 * the interchange capability both pick their artefacts out of a flat element
 * list with `instanceof`, and a plain record is an artefact that vanishes on
 * the way in.
 */
function define<T>(prototype: object, props: Record<string, unknown>): T {
  const model = Object.create(prototype) as Record<string, unknown>;
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(model, key, { value, enumerable: true });
  }
  return model as unknown as T;
}

/** The sheet. `xywh` as well as `elementBound`: the legend reads the string. */
export function fakeDiagram(
  id: string,
  bound: Box,
  options: { name?: string; kind?: UmlDiagramKind } = {}
): UmlDiagramElementModel {
  const name = options.name ?? 'Diagram';
  const kind = options.kind ?? 'class';
  return define<UmlDiagramElementModel>(UmlDiagramElementModel.prototype, {
    id,
    role: UML_ROLE.diagram,
    name,
    kind,
    // The DERIVED heading, spelled the way the model derives it — a fixture
    // that stated its own would be a second implementation of the one thing
    // `UmlDiagramElementModel.heading` exists to own.
    heading: `${kind} ${name}`.trim(),
    xywh: `[${bound.join(',')}]`,
    deserializedXYWH: bound,
    rotate: 0,
    elementBound: new Bound(...bound),
  });
}

/** The use case subject: a rectangle drawn round part of the sheet. */
export function fakeSubject(
  id: string,
  bound: Box,
  options: { name?: string } = {}
): UmlSubjectElementModel {
  return define<UmlSubjectElementModel>(UmlSubjectElementModel.prototype, {
    id,
    role: UML_ROLE.subject,
    name: options.name ?? 'Subject',
    xywh: `[${bound.join(',')}]`,
    deserializedXYWH: bound,
    rotate: 0,
    elementBound: new Bound(...bound),
  });
}

/**
 * An activity PARTITION — a swimlane (§15.6.4), which holds its actions by
 * geometry and nothing else.
 *
 * `resizeEnabled` and `orientation` are stated rather than defaulted, because
 * they are the two fields the frame's own toolbar row writes: a fixture that
 * left them off would let a toggle pass its test by reading `undefined` on both
 * sides of the flip.
 */
export function fakePartition(
  id: string,
  bound: Box,
  options: {
    name?: string;
    orientation?: UmlPartitionOrientation;
    resizeEnabled?: boolean;
  } = {}
): UmlPartitionElementModel {
  return define<UmlPartitionElementModel>(UmlPartitionElementModel.prototype, {
    id,
    role: UML_ROLE.partition,
    name: options.name ?? 'Partition',
    orientation: options.orientation ?? 'vertical',
    resizeEnabled: options.resizeEnabled ?? true,
    xywh: `[${bound.join(',')}]`,
    deserializedXYWH: bound,
    rotate: 0,
    elementBound: new Bound(...bound),
  });
}

/** A composite state's REGION (§14.2.4): a named rounded rectangle. */
export function fakeRegion(
  id: string,
  bound: Box,
  options: { name?: string; resizeEnabled?: boolean } = {}
): UmlRegionElementModel {
  return define<UmlRegionElementModel>(UmlRegionElementModel.prototype, {
    id,
    role: UML_ROLE.region,
    name: options.name ?? 'Region',
    resizeEnabled: options.resizeEnabled ?? true,
    xywh: `[${bound.join(',')}]`,
    deserializedXYWH: bound,
    rotate: 0,
    elementBound: new Bound(...bound),
  });
}

/**
 * One artefact's shape, stamped the way the creation site stamps one: the
 * `kind` the renderer reads, and the ROLE that kind means.
 *
 * An explicit `role` still wins, for the fixture that wants a box drawn with the
 * UML stencil and carrying no role at all — copied, pasted, restyled by hand.
 */
export function fakeNode(
  id: string,
  kind: UmlNodeKind,
  bound: Box,
  options: { text?: string; role?: string } = {}
): UmlNodeElementModel {
  return define<UmlNodeElementModel>(UmlNodeElementModel.prototype, {
    id,
    kind,
    role: 'role' in options ? options.role : UML_ROLE_OF_KIND[kind],
    text: options.text,
    deserializedXYWH: bound,
    rotate: 0,
    elementBound: new Bound(...bound),
  });
}

/** One written compartment, as the canvas `text` element it is. */
export function fakeTier(id: string, role: string, text: string) {
  return define<TextElementModel>(TextElementModel.prototype, {
    id,
    role,
    text,
  });
}

/** The group that makes a shape and its words one artefact. */
export function fakeGroup(id: string, childIds: readonly string[]) {
  return define<GroupElementModel>(GroupElementModel.prototype, {
    id,
    childIds,
  });
}

export function fakeConnector(
  id: string,
  role: string | undefined,
  ends: { source?: string; target?: string } = {},
  text?: string
) {
  return define<ConnectorElementModel>(ConnectorElementModel.prototype, {
    id,
    role,
    text,
    source: ends.source === undefined ? {} : { id: ends.source },
    target: ends.target === undefined ? {} : { id: ends.target },
  });
}

/**
 * A node and its words, grouped — what every creation site in the pack builds.
 *
 * `name` for the compartmented kinds and the two glyph-bodied boxes, `label`
 * for an actor and a use case: two roles, because the vocabulary means them
 * differently (`roles.ts`), and a fixture that merged them would let a bug in
 * the resolution pass unnoticed.
 */
export class Components {
  readonly texts: TextElementModel[] = [];
  readonly groups: GroupElementModel[] = [];

  with(
    node: UmlNodeElementModel,
    tiers: {
      name?: string;
      attributes?: string;
      operations?: string;
      label?: string;
    }
  ): UmlNodeElementModel {
    const childIds = [node.id];
    const add = (suffix: string, role: string, text: string) => {
      const id = `${node.id}-${suffix}`;
      this.texts.push(fakeTier(id, role, text));
      childIds.push(id);
    };

    if (tiers.name !== undefined) add('name', UML_ROLE.name, tiers.name);
    if (tiers.attributes !== undefined) {
      add('attrs', UML_ROLE.attributes, tiers.attributes);
    }
    if (tiers.operations !== undefined) {
      add('ops', UML_ROLE.operations, tiers.operations);
    }
    if (tiers.label !== undefined) add('label', UML_ROLE.label, tiers.label);

    this.groups.push(fakeGroup(`${node.id}-group`, childIds));
    return node;
  }
}

/* ── The composed diagram ─────────────────────────────────────────────── */

/** Everything one fixture holds, as the flat list the readers are handed. */
export interface ComposedDiagram {
  diagram: UmlDiagramElementModel;
  subjects: UmlSubjectElementModel[];
  nodes: UmlNodeElementModel[];
  texts: TextElementModel[];
  groups: GroupElementModel[];
  connectors: ConnectorElementModel[];
  /** Every element above, in document order — what a surface hands back. */
  elements: unknown[];
}

/**
 * A class diagram and a use case diagram on one sheet, with the four things
 * that must NOT come out of it: a connector with no role, a box drawn with the
 * stencil and stamped with none, an element off the sheet entirely, and a
 * relationship with a free end.
 *
 * Built once and read by several specs, because it is the case the export
 * exists for: anything simpler would leave a whole half of the notation
 * unexercised.
 *
 * Geometry, for whoever has to move a box: the sheet's plot runs x 24…1376 and
 * y 44…876 (`UML_DIAGRAM_MARGIN`, `UML_FRAME_BAND_HEIGHT`), and the subject's
 * runs x 712…1088, y 212…488 (`UML_SUBJECT_MARGIN`). Everything below is
 * attributed by its CENTRE against those, most-nested first.
 */
export function composedDiagram(): ComposedDiagram {
  const diagram = fakeDiagram('d-1', [0, 0, 1400, 900], {
    name: 'Orders',
    kind: 'class',
  });
  const subject = fakeSubject('s-1', [700, 200, 400, 300], {
    name: 'Order service',
  });
  const components = new Components();

  const nodes = [
    components.with(fakeNode('n-order', 'class', [100, 200, 200, 120]), {
      name: 'Order',
      attributes: '+ reference : String',
      operations: '+ total() : Money',
    }),
    components.with(fakeNode('n-line', 'class', [100, 400, 200, 120]), {
      name: 'OrderLine',
      attributes: '+ quantity : Integer',
      operations: '+ subtotal() : Money',
    }),
    components.with(fakeNode('n-payable', 'interface', [400, 200, 200, 120]), {
      name: '«interface»\nPayable',
      attributes: '',
      operations: '+ pay() : Receipt',
    }),
    components.with(fakeNode('n-status', 'enumeration', [400, 400, 200, 120]), {
      name: '«enumeration»\nStatus',
      attributes: 'DRAFT\nPLACED',
    }),
    // An INSTANCE: name over slots, and no operations compartment at all.
    components.with(fakeNode('n-o1', 'object', [100, 600, 200, 120]), {
      name: 'o1 : Order',
      attributes: 'reference = "A-1"',
    }),
    components.with(fakeNode('n-sales', 'package', [400, 600, 200, 130]), {
      name: 'Sales',
    }),
    components.with(fakeNode('n-note', 'note', [650, 600, 180, 100]), {
      name: 'Totals exclude tax.',
    }),
    // The use case half: an actor OUTSIDE the subject, a use case inside it.
    components.with(fakeNode('n-customer', 'actor', [600, 260, 80, 120]), {
      label: 'Customer',
    }),
    components.with(fakeNode('n-place', 'use-case', [780, 260, 200, 90]), {
      label: 'Place an order',
    }),
    components.with(fakeNode('n-pay', 'use-case', [780, 380, 200, 90]), {
      label: 'Pay',
    }),
    // A box drawn with the UML stencil and NO role — copied, pasted, restyled
    // by hand. It looks like a class and states nothing (`docs/adr/0010`).
    fakeNode('n-rogue', 'class', [1150, 600, 200, 120], {
      text: 'Looks like a class',
      role: undefined,
    }),
    // …and a properly stamped class drawn OFF the sheet: a second diagram's
    // element, or a box parked on bare canvas.
    fakeNode('n-offboard', 'class', [2000, 300, 200, 120], {
      text: 'Somewhere else',
    }),
  ];

  const connectors = [
    fakeConnector(
      'c-assoc',
      UML_ROLE.association,
      { source: 'n-order', target: 'n-payable' },
      '1..*'
    ),
    // The whole is the SOURCE: the diamond lands on the front end (`roles.ts`).
    fakeConnector('c-comp', UML_ROLE.composition, {
      source: 'n-order',
      target: 'n-line',
    }),
    fakeConnector('c-gen', UML_ROLE.generalization, {
      source: 'n-o1',
      target: 'n-order',
    }),
    fakeConnector('c-real', UML_ROLE.realization, {
      source: 'n-order',
      target: 'n-payable',
    }),
    fakeConnector('c-dep', UML_ROLE.dependency, {
      source: 'n-sales',
      target: 'n-order',
    }),
    fakeConnector('c-anchor', UML_ROLE.anchor, {
      source: 'n-note',
      target: 'n-order',
    }),
    fakeConnector('c-actor', UML_ROLE.association, {
      source: 'n-customer',
      target: 'n-place',
    }),
    fakeConnector('c-include', UML_ROLE.include, {
      source: 'n-place',
      target: 'n-pay',
    }),
    // A NEUTRAL connector: an arrow the author drew and never typed. It relates
    // nothing, so it is not a relationship at all.
    fakeConnector('c-plain', undefined, {
      source: 'n-order',
      target: 'n-status',
    }),
    // …and one with a free end, which no interchange format can express.
    fakeConnector('c-dangling', UML_ROLE.association, { source: 'n-order' }),
  ];

  return {
    diagram,
    subjects: [subject],
    nodes,
    texts: components.texts,
    groups: components.groups,
    connectors,
    elements: [
      diagram,
      subject,
      ...nodes,
      ...components.texts,
      ...components.groups,
      ...connectors,
    ],
  };
}
