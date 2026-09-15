import type { SerializedElementProps } from '@labre/affine-block-surface';
import { snapshotFromAction } from '@labre/affine-gfx-template';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { createUmlClassifier, createUmlNode } from '../actions';
import { exportUmlXmi } from '../export';
import {
  UML_IMPORT_GUTTER,
  UML_IMPORT_SLOT,
  umlDrawnEdges,
  umlElementsFromModel,
} from '../import';
import { UML_XMI_IMPORT } from '../interchange';
import {
  UML_ATTACH_TOLERANCE,
  type UmlClassifier,
  type UmlModel,
  type UmlRelation,
  type UmlSourceElement,
  umlBoundsOf,
  umlBoxGap,
  umlCentreInside,
  umlModelFrom,
} from '../model';
import { UML_ROLE } from '../roles';

/**
 * The shared materializer — the ONE place a UML model becomes elements, and
 * therefore the one place all three importers can go wrong together.
 *
 * Two properties are worth a spec, and neither is "the props look plausible":
 *
 *  - **an imported artefact IS the artefact the toolbox draws.** The creation
 *    commands are re-run against the recording surface `templates-parity`
 *    already uses, and every prop but the four that cannot match (the id, the
 *    layer index, the box and the words) is compared. That is what stops the
 *    materializer from slowly becoming a second stencil;
 *  - **the invented layout is a function of the model.** Same model, same
 *    board, down to the coordinates and the minted names — which is what makes
 *    an import reviewable, a golden possible, and a re-import of the same file
 *    land where the last one did.
 */

/* ── Fixtures ─────────────────────────────────────────────────────────── */

function emptyModel(name: string): UmlModel {
  return {
    diagram: { id: 'd1', kind: 'class', name, heading: `class ${name}` },
    classifiers: [],
    packages: [],
    actors: [],
    useCases: [],
    subjects: [],
    notes: [],
    components: [],
    ports: [],
    artifacts: [],
    nodes: [],
    activities: [],
    stateMachines: [],
    relations: [],
    warnings: [],
  };
}

function classifier(
  id: string,
  name: string,
  attributes: string[] = [],
  operations: string[] = []
): UmlClassifier {
  return {
    id,
    name,
    keywords: [],
    isAbstract: false,
    kind: 'class',
    attributes: [],
    operations: [],
    slots: [],
    lines: { attributes, operations },
  };
}

const relation = (
  kind: UmlRelation['kind'],
  sourceId: string,
  targetId: string,
  label?: string
): UmlRelation => ({ kind, sourceId, targetId, ...(label ? { label } : {}) });

/** Three classes, one of them a subtype — the smallest interesting sheet. */
function threeClasses(): UmlModel {
  return {
    ...emptyModel('Orders'),
    classifiers: [
      classifier('Order', 'Order', ['+ id : OrderId'], ['+ total() : Money']),
      classifier('OnlineOrder', 'OnlineOrder'),
      classifier('Line', 'Line'),
    ],
    relations: [
      relation('generalization', 'OnlineOrder', 'Order'),
      relation('composition', 'Order', 'Line', 'holds'),
    ],
  };
}

const materialize = (model: UmlModel) =>
  umlElementsFromModel([model], { formatId: 'plantuml' });

type Element = Record<string, unknown>;

/** What a recording of a creation command holds, as far as this file reads it. */
type Snapshot = {
  blocks: { children: { props: { elements: Record<string, Element> } }[] };
};

const drawnBy = (run: (std: BlockStdScope) => void): Element[] =>
  Object.values(
    (snapshotFromAction(run, 'Recording') as unknown as Snapshot).blocks
      .children[0].props.elements
  );

/**
 * The props an imported element CANNOT match a drawn one on, and why each is
 * exempt rather than overlooked.
 *
 * `id` and `index` are minted (by the surface and by the layer), `xywh` is the
 * layout's answer and the whole point of D4, `text` and `children` are the
 * file's words and the file's grouping where a stencil writes a seed, and
 * `interchange` is the import's own receipt — a stencil has no source file to
 * carry an id from. Everything else — the kind, the role, the fill, the stroke,
 * the face, the weight, the alignment — is the pack's, and has to be identical.
 */
const strip = (element: Element): Element => {
  const rest = { ...element };
  for (const key of [
    'id',
    'index',
    'xywh',
    'text',
    'children',
    'interchange',
  ]) {
    delete rest[key];
  }
  return rest;
};

const byRole = (elements: readonly Element[], role: string) =>
  elements.find(element => element['role'] === role);

/* ── An imported artefact is the artefact the button draws ────────────── */

describe('a materialized classifier is what createUmlClassifier writes', () => {
  const imported = materialize(threeClasses()).elements;
  const drawn = drawnBy(std => createUmlClassifier(std, 'class'));

  it('is a bodyless shape, three tiers and the group over them', () => {
    // The frame, then three classes of five elements each, then two connectors.
    expect(imported).toHaveLength(1 + 3 * 5 + 2);
    expect(imported[0]['type']).toBe('umlDiagram');
    expect(
      imported.filter(element => element['type'] === 'group')
    ).toHaveLength(3);
  });

  it('writes the same shape props, prop for prop', () => {
    const shape = imported.find(element => element['type'] === 'umlNode')!;
    const stencil = drawn.find(element => element['type'] === 'umlNode')!;
    expect(strip(shape)).toEqual(strip(stencil));
    // R16: nothing is written ON the shape — the name is the child below it.
    expect(shape['text']).toBeUndefined();
  });

  it('writes the same tier props for each of the three compartments', () => {
    const tiers = imported.filter(element => element['type'] === 'text');
    for (const role of [
      UML_ROLE.name,
      UML_ROLE.attributes,
      UML_ROLE.operations,
    ]) {
      expect(strip(byRole(tiers, role)!), role).toEqual(
        strip(byRole(drawn, role)!)
      );
    }
  });

  it('puts the words of the file in the tiers, verbatim', () => {
    const tiers = imported.filter(element => element['type'] === 'text');
    expect(byRole(tiers, UML_ROLE.name)!['text']).toBe('Order');
    expect(byRole(tiers, UML_ROLE.attributes)!['text']).toBe('+ id : OrderId');
    expect(byRole(tiers, UML_ROLE.operations)!['text']).toBe(
      '+ total() : Money'
    );
  });

  it('groups the shape with its tiers, by the names the reader minted', () => {
    const group = imported.find(element => element['type'] === 'group')!;
    const children = Object.keys(group['children'] as Record<string, unknown>);
    expect(children).toHaveLength(4);
    // Every child is written BEFORE the group, which is what lets the caller
    // resolve them without a second pass (`materializeInterchangeImport`).
    const order = imported.map(element => element['id']);
    for (const child of children) {
      expect(order.indexOf(child)).toBeGreaterThanOrEqual(0);
      expect(order.indexOf(child)).toBeLessThan(order.indexOf(group['id']));
    }
  });

  it('carries the source id, and only the source id (D3)', () => {
    const shape = imported.find(element => element['type'] === 'umlNode')!;
    expect(shape['interchange']).toEqual({ plantuml: { id: 'Order' } });
    // A tier and a group are Labre's, not the file's: nothing to carry.
    const tier = imported.find(element => element['type'] === 'text')!;
    expect(tier['interchange']).toBeUndefined();
  });
});

describe('a materialized glyph is what createUmlNode writes', () => {
  // The four kinds that settle the two questions this file could get wrong on
  // its own: which tier ROLE a picture's one word takes, and whether a mark
  // gets a tier at all.
  const KINDS = [
    ['package', UML_ROLE.name],
    ['note', UML_ROLE.name],
    ['actor', UML_ROLE.label],
    ['use-case', UML_ROLE.label],
  ] as const;

  for (const [kind, role] of KINDS) {
    it(`gives a ${kind} one ${role}`, () => {
      const model = emptyModel('Sheet');
      const record = {
        id: `n-${kind}`,
        name: 'Word',
        keywords: [],
        isAbstract: false,
      };
      if (kind === 'package') model.packages.push(record);
      else if (kind === 'note') model.notes.push({ ...record, body: 'Word' });
      else if (kind === 'actor') model.actors.push(record);
      else model.useCases.push(record);

      const imported = materialize(model).elements;
      const drawn = drawnBy(std => createUmlNode(std, kind));
      const shape = imported.find(element => element['type'] === 'umlNode')!;
      const tier = imported.find(element => element['type'] === 'text')!;
      expect(strip(shape)).toEqual(
        strip(drawn.find(element => element['type'] === 'umlNode')!)
      );
      expect(tier['role']).toBe(role);
      expect(strip(tier)).toEqual(
        strip(drawn.find(element => element['type'] === 'text')!)
      );
    });
  }

  it('drops an unlabelled mark as the shape alone, with no group', () => {
    const model = emptyModel('Flow');
    model.stateMachines.push({
      id: 'd1',
      name: 'Flow',
      regions: [],
      states: [],
      finalStates: [],
      pseudostates: [
        {
          id: 'p1',
          name: '',
          keywords: [],
          isAbstract: false,
          kind: 'initial',
        },
      ],
      transitions: [],
    });
    const imported = materialize(model).elements;
    expect(imported).toHaveLength(2);
    expect(imported[1]['type']).toBe('umlNode');
    expect(imported[1]['kind']).toBe('initial');
    expect(imported[1]['text']).toBeUndefined();
  });
});

/* ── The connectors ───────────────────────────────────────────────────── */

describe('a materialized relationship', () => {
  const imported = materialize(threeClasses()).elements;
  const connectors = imported.filter(
    element => element['type'] === 'connector'
  );

  it('states its role and wears the notation for it', () => {
    expect(connectors).toHaveLength(2);
    expect(connectors[0]['role']).toBe(UML_ROLE.generalization);
    expect(connectors[0]['rearEndpointStyle']).toBe('TriangleHollow');
    expect(connectors[1]['role']).toBe(UML_ROLE.composition);
    expect(connectors[1]['frontEndpointStyle']).toBe('Diamond');
    expect(connectors[1]['text']).toBe('holds');
  });

  it('names the shapes it runs between, not the file', () => {
    const shapes = imported.filter(element => element['type'] === 'umlNode');
    const idOf = (source: string) =>
      shapes.find(
        shape =>
          (shape['interchange'] as { plantuml: { id: string } }).plantuml.id ===
          source
      )!['id'];
    expect(connectors[0]['source']).toEqual({
      id: idOf('OnlineOrder'),
      position: [0.5, 0.5],
    });
    expect(connectors[0]['target']).toEqual({
      id: idOf('Order'),
      position: [0.5, 0.5],
    });
  });

  it('drops a relationship whose end this sheet holds nothing for', () => {
    const model = threeClasses();
    model.relations.push(relation('association', 'Order', 'Elsewhere'));
    expect(
      materialize(model).elements.filter(
        element => element['type'] === 'connector'
      )
    ).toHaveLength(2);
  });

  it('writes the two end labels, each with a box near its own endpoint', () => {
    // ADR 0020: the end labels are connector FIELDS, so the materializer writes
    // them like the centre one — a plain string that `propsToY` turns into a
    // `Y.Text`, and a box the renderer paints at.
    const model = threeClasses();
    model.relations = [
      {
        ...relation('association', 'Order', 'Line'),
        sourceEnd: { multiplicity: { lower: 1, upper: 1 }, raw: '1' },
        targetEnd: {
          multiplicity: { lower: 0, upper: '*' },
          role: 'lines',
          raw: '0..* lines',
        },
      },
    ];
    const imported = materialize(model).elements;
    const [connector] = imported.filter(
      element => element['type'] === 'connector'
    );
    expect(connector['sourceLabel']).toBe('1');
    expect(connector['targetLabel']).toBe('0..* lines');

    const source = connector['sourceLabelXYWH'] as number[];
    const target = connector['targetLabelXYWH'] as number[];
    expect(source).toHaveLength(4);
    expect(source.every(each => Number.isFinite(each))).toBe(true);
    // Each box sits by its OWN end: the source's is nearer the source shape.
    const boxOf = (sourceId: string) =>
      Bound.deserialize(
        imported.find(
          element =>
            (element['interchange'] as { plantuml: { id: string } } | undefined)
              ?.plantuml.id === sourceId && element['type'] === 'umlNode'
        )!['xywh'] as string
      );
    const order = boxOf('Order').center;
    const line = boxOf('Line').center;
    const near = (box: number[], point: number[]) =>
      Math.hypot(
        box[0] + box[2] / 2 - point[0],
        box[1] + box[3] / 2 - point[1]
      );
    expect(near(source, order)).toBeLessThan(near(source, line));
    expect(near(target, line)).toBeLessThan(near(target, order));
  });

  it('writes neither field on a connector with no end labels', () => {
    const [connector] = materialize(threeClasses()).elements.filter(
      element => element['type'] === 'connector'
    );
    expect(connector['sourceLabel']).toBeUndefined();
    expect(connector['sourceLabelXYWH']).toBeUndefined();
    expect(connector['targetLabel']).toBeUndefined();
    expect(connector['targetLabelXYWH']).toBeUndefined();
  });
});

/* ── The invented layout (D4) ─────────────────────────────────────────── */

describe('the layout Labre invents when the source carried none', () => {
  it('is a function of the model, and says so', () => {
    const first = materialize(threeClasses());
    const second = materialize(threeClasses());
    expect(first.elements).toEqual(second.elements);
    expect(first.notes).toHaveLength(1);
    expect(first.notes[0].kind).toBe('invented-layout');
    expect(first.notes[0].sourceId).toBe('d1');
  });

  it('puts a subtype one row below what it specializes (§9.2.4)', () => {
    const imported = materialize(threeClasses()).elements;
    const boxOf = (source: string) => {
      const shape = imported.find(
        element =>
          element['type'] === 'umlNode' &&
          (element['interchange'] as { plantuml: { id: string } }).plantuml
            .id === source
      )!;
      return Bound.deserialize(String(shape['xywh']));
    };
    const general = boxOf('Order');
    const specific = boxOf('OnlineOrder');
    expect(specific.y).toBeGreaterThan(general.y);
    // One slot and one gutter down, and nothing else invented in between.
    expect(specific.y - general.y).toBe(UML_IMPORT_SLOT.h + UML_IMPORT_GUTTER);
  });

  it('says nothing when the caller brought the geometry', () => {
    const model = threeClasses();
    const { notes, elements } = umlElementsFromModel([model], {
      formatId: 'drawio',
      layout: {
        boxes: {
          Order: { x: 0, y: 0, w: 200, h: 120 },
          OnlineOrder: { x: 0, y: 300, w: 200, h: 120 },
          Line: { x: 400, y: 0, w: 200, h: 120 },
        },
      },
    });
    expect(notes).toEqual([]);
    // Translated as a block onto the plot, never rewritten: the file's own
    // 300-unit drop between the two classes is still 300 units.
    const boxes = elements
      .filter(element => element['type'] === 'umlNode')
      .map(element => Bound.deserialize(String(element['xywh'])));
    expect(boxes[1].y - boxes[0].y).toBe(300);
  });
});

/* ── Several diagrams ─────────────────────────────────────────────────── */

describe('several models', () => {
  it('become several frames, stacked and never overlaid (ADR 0017)', () => {
    const one = {
      ...threeClasses(),
      diagram: { ...emptyModel('One').diagram },
    };
    const two = {
      ...emptyModel('Two'),
      diagram: {
        id: 'd2',
        kind: 'uc' as const,
        name: 'Two',
        heading: 'uc Two',
      },
    };
    const { elements } = umlElementsFromModel([one, two], {
      formatId: 'plantuml',
    });
    const frames = elements.filter(element => element['type'] === 'umlDiagram');
    expect(frames).toHaveLength(2);
    const first = Bound.deserialize(String(frames[0]['xywh']));
    const second = Bound.deserialize(String(frames[1]['xywh']));
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.h);
    expect(frames[1]['kind']).toBe('uc');
  });

  it('mints one name space across the whole import', () => {
    const { elements } = umlElementsFromModel(
      [threeClasses(), threeClasses()],
      { formatId: 'plantuml' }
    );
    const ids = elements.map(element => element['id']);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('uml-import-1');
  });
});

/* ── Reading the board back ───────────────────────────────────────────── */

/**
 * The elements, read as a diagram again — `umlModelFrom` over what the
 * materializer just wrote.
 *
 * The strongest assertion this file can make, and the one that catches the
 * defects a prop-by-prop check cannot: a port's owner, a component's contracts
 * and every containment on this canvas are GEOMETRY, resolved by measuring
 * boxes. A materializer that wrote every prop correctly and laid the boxes out
 * anywhere would still produce a board whose export says less than the file did.
 *
 * `childIds` is the one translation: a group arrives with a `children` record
 * (what `addElement` takes) and the reader asks for a list (what an element
 * model answers with).
 */
function readBack(elements: readonly SerializedElementProps[]): UmlModel {
  const source = elements.map(element => {
    const children = element.children as Record<string, unknown> | undefined;
    return {
      ...element,
      id: String(element.id),
      ...(children ? { childIds: Object.keys(children) } : {}),
    } as unknown as UmlSourceElement;
  });
  const frame = source.find(element => element.type === 'umlDiagram');
  if (!frame) throw new Error('the materializer wrote no diagram frame');
  return umlModelFrom(frame, source);
}

const boxOf = (
  elements: readonly SerializedElementProps[],
  predicate: (element: SerializedElementProps) => boolean
) => Bound.deserialize(String(elements.find(predicate)!['xywh']));

/* ── The behaviour edges ──────────────────────────────────────────────── */

/**
 * The defect an XMI activity import was: every arrow missing.
 *
 * `relations` is not the only place a line lives. `umlModelFrom` and the
 * PlantUML reader fill it AND the behaviour lists; the XMI reader cannot,
 * because an edge and a transition are children of the Activity and the
 * StateMachine in the file. A materializer that walked one list drew a flow
 * chart with no flow in it.
 */
describe('a behaviour sheet whose edges live on the Activity', () => {
  const step = (id: string, name: string) => ({
    id,
    name,
    keywords: [],
    isAbstract: false,
    kind: 'action' as const,
  });

  const activityModel = (): UmlModel => ({
    ...emptyModel('Checkout'),
    diagram: {
      id: 'd1',
      kind: 'act',
      name: 'Checkout',
      heading: 'act Checkout',
    },
    activities: [
      {
        id: 'd1',
        name: 'Checkout',
        nodes: [step('a1', 'Take order'), step('a2', 'Ship it')],
        edges: [
          {
            kind: 'control-flow',
            sourceId: 'a1',
            targetId: 'a2',
            name: 'then',
            guard: 'paid',
            weight: '2',
          },
        ],
        partitions: [],
      },
    ],
  });

  it('draws them, and writes the annotations into the centre label', () => {
    const { elements } = materialize(activityModel());
    const connectors = elements.filter(
      element => element['type'] === 'connector'
    );
    expect(connectors).toHaveLength(1);
    expect(connectors[0]['role']).toBe(UML_ROLE['control-flow']);
    // The grammar's own printer, which is what the PlantUML writer uses — so a
    // guard imported from XMI and one exported to a `.puml` are spelled alike.
    expect(connectors[0]['text']).toBe('then [paid] {weight = 2}');
  });

  it('comes back off the board as the same activity edge', () => {
    const read = readBack(materialize(activityModel()).elements);
    expect(read.activities[0].edges).toEqual([
      {
        kind: 'control-flow',
        sourceId: expect.any(String),
        targetId: expect.any(String),
        name: 'then',
        guard: 'paid',
        weight: '2',
      },
    ]);
  });

  it('draws a transition and spells its label the BNF way round', () => {
    const state = (id: string, name: string) => ({
      id,
      name,
      keywords: [],
      isAbstract: false,
      entry: [],
      doActivity: [],
      exit: [],
      lines: [],
    });
    const model: UmlModel = {
      ...emptyModel('Life'),
      diagram: { id: 'd1', kind: 'stm', name: 'Life', heading: 'stm Life' },
      stateMachines: [
        {
          id: 'd1',
          name: 'Life',
          regions: [],
          states: [state('s1', 'Draft'), state('s2', 'Placed')],
          finalStates: [],
          pseudostates: [],
          transitions: [
            {
              sourceId: 's1',
              targetId: 's2',
              triggers: ['place', 'confirm'],
              guard: 'ok',
              effect: 'notify()',
            },
          ],
        },
      ],
    };
    const connectors = materialize(model).elements.filter(
      element => element['type'] === 'connector'
    );
    expect(connectors).toHaveLength(1);
    expect(connectors[0]['role']).toBe(UML_ROLE.transition);
    expect(connectors[0]['text']).toBe('place, confirm [ok] / notify()');
  });

  it('draws a line once when it is in BOTH lists', () => {
    // What `umlModelFrom` and the PlantUML reader produce: a relation and its
    // projection onto the machine. Two lists, one arrow.
    const model = activityModel();
    model.relations = [
      {
        kind: 'control-flow',
        sourceId: 'a1',
        targetId: 'a2',
        label: 'then [paid] {weight = 2}',
      },
    ];
    expect(umlDrawnEdges(model)).toHaveLength(1);
    expect(
      materialize(model).elements.filter(
        element => element['type'] === 'connector'
      )
    ).toHaveLength(1);
  });

  it('keeps two parallel edges two', () => {
    const model = activityModel();
    model.activities[0].edges.push({
      kind: 'control-flow',
      sourceId: 'a1',
      targetId: 'a2',
      name: 'or else',
    });
    model.relations = [
      { kind: 'control-flow', sourceId: 'a1', targetId: 'a2', label: 'then' },
    ];
    expect(umlDrawnEdges(model)).toHaveLength(2);
  });
});

/* ── The interface marks ──────────────────────────────────────────────── */

describe('a component and the contracts it names', () => {
  const componentModel = (): UmlModel => ({
    ...emptyModel('Shop'),
    diagram: { id: 'd1', kind: 'cmp', name: 'Shop', heading: 'cmp Shop' },
    components: [
      {
        id: 'k1',
        name: 'Cart',
        keywords: [],
        isAbstract: false,
        ports: [],
        provided: ['IOrder'],
        required: ['IPayment', 'IShipping'],
      },
    ],
  });

  const { elements } = materialize(componentModel());
  const marks = elements.filter(
    element =>
      element['kind'] === 'provided-interface' ||
      element['kind'] === 'required-interface'
  );

  it('draws one mark per contract, on the side its direction says', () => {
    expect(marks).toHaveLength(3);
    const component = boxOf(
      elements,
      element => element['kind'] === 'component'
    );
    for (const mark of marks) {
      const box = Bound.deserialize(String(mark['xywh']));
      if (mark['kind'] === 'provided-interface') {
        expect(box.x + box.w).toBeLessThanOrEqual(component.x);
      } else {
        expect(box.x).toBeGreaterThanOrEqual(component.x + component.w);
      }
      // Near enough that the export resolves it, which is the whole point: the
      // stub of the specification's own figures is a touch, not a neighbourhood.
      expect(
        umlBoxGap(
          { x: box.x, y: box.y, w: box.w, h: box.h },
          { x: component.x, y: component.y, w: component.w, h: component.h }
        )
      ).toBeLessThanOrEqual(UML_ATTACH_TOLERANCE);
    }
  });

  it('stacks two marks on one side rather than drawing them on each other', () => {
    const sockets = marks.filter(mark => mark['kind'] === 'required-interface');
    expect(sockets).toHaveLength(2);
    const first = Bound.deserialize(String(sockets[0]['xywh']));
    const second = Bound.deserialize(String(sockets[1]['xywh']));
    expect(second.y).toBe(first.y + first.h + 12);
  });

  it('gives the component its contracts back when the board is read', () => {
    const read = readBack(elements);
    expect(read.components).toHaveLength(1);
    expect(read.components[0].provided).toEqual(['IOrder']);
    expect(read.components[0].required).toEqual(['IPayment', 'IShipping']);
  });

  it('never lets a relationship resolve to a mark', () => {
    // A lollipop is the NOTATION for a realization, not an element: nothing in
    // a file points at one, and `model.ts` keeps it out of `artefactOf`.
    const model = componentModel();
    model.relations = [
      { kind: 'dependency', sourceId: 'k1', targetId: 'IOrder' },
    ];
    expect(
      materialize(model).elements.filter(
        element => element['type'] === 'connector'
      )
    ).toHaveLength(0);
  });
});

/* ── The port on its border ───────────────────────────────────────────── */

describe('a port that names an owner', () => {
  const portModel = (ports: number): UmlModel => ({
    ...emptyModel('Shop'),
    diagram: { id: 'd1', kind: 'cmp', name: 'Shop', heading: 'cmp Shop' },
    components: [
      {
        id: 'k1',
        name: 'Cart',
        keywords: [],
        isAbstract: false,
        ports: [],
        provided: [],
        required: [],
      },
    ],
    ports: Array.from({ length: ports }, (_, index) => ({
      id: `p${index + 1}`,
      name: `port${index + 1}`,
      keywords: [],
      isAbstract: false,
      ownerId: 'k1',
    })),
  });

  it('straddles the border rather than sitting in the grid', () => {
    const { elements } = materialize(portModel(1));
    const component = boxOf(
      elements,
      element => element['kind'] === 'component'
    );
    const port = boxOf(elements, element => element['kind'] === 'port');
    expect(port.y + port.h / 2).toBe(component.y);
    expect(port.x + port.w / 2).toBe(component.x + component.w / 2);
  });

  it('spreads several ports along the edge', () => {
    const { elements } = materialize(portModel(3));
    const seats = elements
      .filter(element => element['kind'] === 'port')
      .map(element => Bound.deserialize(String(element['xywh'])).x);
    expect(new Set(seats).size).toBe(3);
    expect([...seats].sort((a, b) => a - b)).toEqual(seats);
  });

  it('gives the port back to its component when the board is read', () => {
    const read = readBack(materialize(portModel(2)).elements);
    const owner = read.components[0];
    expect(owner.ports.map(port => port.name)).toEqual(['port1', 'port2']);
    expect(read.ports.every(port => port.ownerId === owner.id)).toBe(true);
  });

  it('leaves a port the file gave no owner in the layout', () => {
    const model = portModel(1);
    delete model.ports[0].ownerId;
    const read = readBack(materialize(model).elements);
    expect(read.ports[0].ownerId).toBeUndefined();
  });
});

/* ── Containment ──────────────────────────────────────────────────────── */

describe('what the file says is drawn inside what', () => {
  const inside = (
    elements: readonly SerializedElementProps[],
    child: (element: SerializedElementProps) => boolean,
    container: (element: SerializedElementProps) => boolean
  ) => {
    const box = boxOf(elements, child);
    const outer = boxOf(elements, container);
    return umlCentreInside(
      { x: box.x, y: box.y, w: box.w, h: box.h },
      { x: outer.x, y: outer.y, w: outer.w, h: outer.h }
    );
  };

  it('draws a use case inside its subject, from a structural hint', () => {
    // XMI's `ownedUseCase`: containment stated as a tree, and this canvas
    // states it as a box inside a box.
    const model: UmlModel = {
      ...emptyModel('Shop'),
      diagram: { id: 'd1', kind: 'uc', name: 'Shop', heading: 'uc Shop' },
      subjects: [{ id: 's1', name: 'Shop', keywords: [], isAbstract: false }],
      useCases: [
        { id: 'u1', name: 'Place order', keywords: [], isAbstract: false },
      ],
    };
    const { elements } = umlElementsFromModel([model], {
      formatId: 'xmi',
      layout: { containment: { u1: 's1' } },
    });
    expect(
      inside(
        elements,
        element => element['kind'] === 'use-case',
        element => element['type'] === 'umlSubject'
      )
    ).toBe(true);
  });

  it('draws a class inside its package, from a structural hint', () => {
    const model: UmlModel = {
      ...emptyModel('Domain'),
      packages: [{ id: 'p1', name: 'Sales', keywords: [], isAbstract: false }],
      classifiers: [classifier('c1', 'Order')],
    };
    const { elements } = umlElementsFromModel([model], {
      formatId: 'xmi',
      layout: { containment: { c1: 'p1' } },
    });
    expect(
      inside(
        elements,
        // `type` as well as `kind`, because the FRAME is a class diagram and
        // carries `kind: 'class'` too.
        element => element['type'] === 'umlNode' && element['kind'] === 'class',
        element => element['kind'] === 'package'
      )
    ).toBe(true);
  });

  it('draws an action inside the lane the Activity lists it in', () => {
    // Read off the IR itself — a partition carries `nodeIds`, so no hint is
    // needed and none is given.
    const model: UmlModel = {
      ...emptyModel('Checkout'),
      diagram: {
        id: 'd1',
        kind: 'act',
        name: 'Checkout',
        heading: 'act Checkout',
      },
      activities: [
        {
          id: 'd1',
          name: 'Checkout',
          nodes: [
            {
              id: 'a1',
              name: 'Take order',
              keywords: [],
              isAbstract: false,
              kind: 'action',
              partitionId: 'l1',
            },
          ],
          edges: [],
          partitions: [
            {
              id: 'l1',
              name: 'Sales',
              keywords: [],
              isAbstract: false,
              orientation: 'vertical',
              nodeIds: ['a1'],
            },
          ],
        },
      ],
    };
    const read = readBack(materialize(model).elements);
    expect(read.activities[0].partitions[0].nodeIds).toHaveLength(1);
    expect(read.activities[0].nodes[0].partitionId).toBe(
      read.activities[0].partitions[0].id
    );
  });

  it('draws a state inside the composite state it names', () => {
    const model: UmlModel = {
      ...emptyModel('Life'),
      diagram: { id: 'd1', kind: 'stm', name: 'Life', heading: 'stm Life' },
      stateMachines: [
        {
          id: 'd1',
          name: 'Life',
          regions: [
            { id: 'r1', name: 'Running', keywords: [], isAbstract: false },
          ],
          states: [
            {
              id: 's1',
              name: 'Packing',
              keywords: [],
              isAbstract: false,
              entry: [],
              doActivity: [],
              exit: [],
              lines: [],
              regionId: 'r1',
            },
          ],
          finalStates: [],
          pseudostates: [],
          transitions: [],
        },
      ],
    };
    const read = readBack(materialize(model).elements);
    expect(read.stateMachines[0].states[0].regionId).toBe(
      read.stateMachines[0].regions[0].id
    );
  });

  it('sizes a container to what it holds', () => {
    const model: UmlModel = {
      ...emptyModel('Domain'),
      packages: [{ id: 'p1', name: 'Sales', keywords: [], isAbstract: false }],
      classifiers: [
        classifier('c1', 'Order'),
        classifier('c2', 'Line'),
        classifier('c3', 'Payment'),
      ],
    };
    const { elements } = umlElementsFromModel([model], {
      formatId: 'xmi',
      layout: { containment: { c1: 'p1', c2: 'p1', c3: 'p1' } },
    });
    const pkg = boxOf(elements, element => element['kind'] === 'package');
    for (const element of elements.filter(
      each => each['type'] === 'umlNode' && each['kind'] === 'class'
    )) {
      const box = Bound.deserialize(String(element['xywh']));
      expect(box.x).toBeGreaterThanOrEqual(pkg.x);
      expect(box.x + box.w).toBeLessThanOrEqual(pkg.x + pkg.w);
      expect(box.y + box.h).toBeLessThanOrEqual(pkg.y + pkg.h);
    }
  });
});

/* ── Beside what is already there ─────────────────────────────────────── */

describe('a second import', () => {
  it('lands where the caller says, not on top of the first', () => {
    const first = materialize(threeClasses());
    const firstFrame = boxOf(
      first.elements,
      element => element['type'] === 'umlDiagram'
    );
    const second = umlElementsFromModel([threeClasses()], {
      formatId: 'plantuml',
      origin: { x: firstFrame.x + firstFrame.w + 200, y: firstFrame.y },
    });
    const secondFrame = boxOf(
      second.elements,
      element => element['type'] === 'umlDiagram'
    );
    expect(secondFrame.x).toBe(firstFrame.x + firstFrame.w + 200);
    expect(secondFrame.y).toBe(firstFrame.y);

    // Nothing of the second board is over anything of the first.
    const boxes = second.elements
      .map(element => umlBoundsOf(element as unknown as UmlSourceElement))
      .filter((box): box is NonNullable<typeof box> => box !== undefined);
    expect(Math.min(...boxes.map(box => box.x))).toBeGreaterThanOrEqual(
      firstFrame.x + firstFrame.w
    );
  });

  it('starts at the origin when the caller says nothing', () => {
    const frame = boxOf(
      materialize(threeClasses()).elements,
      element => element['type'] === 'umlDiagram'
    );
    expect([frame.x, frame.y]).toEqual([0, 0]);
  });
});

/* ── The whole way round, through the XMI capability ──────────────────── */

/**
 * The defects above, end to end: write an XMI file, read it back through the
 * declared capability, and look at the board.
 *
 * The fixtures go out through `exportUmlXmi` rather than being typed as XML by
 * hand, which is what makes this a round trip rather than a second opinion about
 * what an `<edge>` looks like — and it is the file a user of this library will
 * actually re-import, because it is the one this library writes.
 */
describe('an XMI document, imported through the capability', () => {
  const runXmi = (model: UmlModel) =>
    UML_XMI_IMPORT.run(exportUmlXmi([model]).text, {});

  it('draws every edge of an activity, and counts them as mapped', () => {
    const step = (id: string, name: string, kind: 'action' | 'initial') => ({
      id,
      name,
      keywords: [],
      isAbstract: false,
      kind,
    });
    const model: UmlModel = {
      ...emptyModel('Checkout'),
      diagram: {
        id: 'd1',
        kind: 'act',
        name: 'Checkout',
        heading: 'act Checkout',
      },
      activities: [
        {
          id: 'd1',
          name: 'Checkout',
          nodes: [
            step('n0', '', 'initial'),
            step('n1', 'Take order', 'action'),
            step('n2', 'Ship it', 'action'),
          ],
          edges: [
            { kind: 'control-flow', sourceId: 'n0', targetId: 'n1' },
            {
              kind: 'control-flow',
              sourceId: 'n1',
              targetId: 'n2',
              guard: 'paid',
            },
          ],
          partitions: [],
        },
      ],
    };

    const result = runXmi(model);
    const connectors = result.elements.filter(
      element => element.type === 'connector'
    );
    expect(connectors).toHaveLength(2);
    expect(connectors.map(edge => edge['role'])).toEqual([
      UML_ROLE['control-flow'],
      UML_ROLE['control-flow'],
    ]);
    expect(connectors[1]['text']).toBe('[paid]');
    // Three glyphs and two arrows: an arrow is something the file said and the
    // board now draws, so the report has to count it.
    expect(result.report.mapped).toBeGreaterThanOrEqual(5);
  });

  it('draws a state machine transition with its label', () => {
    const state = (id: string, name: string) => ({
      id,
      name,
      keywords: [],
      isAbstract: false,
      entry: [],
      doActivity: [],
      exit: [],
      lines: [],
    });
    const model: UmlModel = {
      ...emptyModel('Life'),
      diagram: { id: 'd1', kind: 'stm', name: 'Life', heading: 'stm Life' },
      stateMachines: [
        {
          id: 'd1',
          name: 'Life',
          regions: [],
          states: [state('s1', 'Draft'), state('s2', 'Placed')],
          finalStates: [],
          pseudostates: [],
          transitions: [
            {
              sourceId: 's1',
              targetId: 's2',
              triggers: ['place'],
              guard: 'ok',
              effect: 'notify()',
            },
          ],
        },
      ],
    };
    const connectors = runXmi(model).elements.filter(
      element => element.type === 'connector'
    );
    expect(connectors).toHaveLength(1);
    expect(connectors[0]['role']).toBe(UML_ROLE.transition);
    expect(connectors[0]['text']).toBe('place [ok] / notify()');
  });

  it('draws a class inside the package the file declares it in', () => {
    const model: UmlModel = {
      ...emptyModel('Domain'),
      packages: [
        {
          id: 'p1',
          name: 'Sales',
          keywords: [],
          isAbstract: false,
          bounds: { x: 0, y: 0, w: 600, h: 400 },
        },
      ],
      classifiers: [
        {
          ...classifier('c1', 'Order'),
          bounds: { x: 40, y: 60, w: 200, h: 120 },
        },
      ],
    };
    // The file carries the nesting and no geometry: an XMI `packagedElement` is
    // a tree, and this canvas states containment as a box inside a box.
    const { elements } = runXmi(model);
    const pkg = boxOf(
      elements as SerializedElementProps[],
      element => element['kind'] === 'package'
    );
    const order = boxOf(
      elements as SerializedElementProps[],
      element => element['type'] === 'umlNode' && element['kind'] === 'class'
    );
    expect(
      umlCentreInside(
        { x: order.x, y: order.y, w: order.w, h: order.h },
        { x: pkg.x, y: pkg.y, w: pkg.w, h: pkg.h }
      )
    ).toBe(true);
  });

  it('draws a use case inside the subject that owns it', () => {
    const model: UmlModel = {
      ...emptyModel('Shop'),
      diagram: { id: 'd1', kind: 'uc', name: 'Shop', heading: 'uc Shop' },
      subjects: [
        {
          id: 's1',
          name: 'Shop',
          keywords: [],
          isAbstract: false,
          bounds: { x: 0, y: 0, w: 600, h: 400 },
        },
      ],
      useCases: [
        {
          id: 'u1',
          name: 'Place order',
          keywords: [],
          isAbstract: false,
          bounds: { x: 40, y: 60, w: 200, h: 90 },
        },
      ],
    };
    const { elements } = runXmi(model);
    const subject = boxOf(
      elements as SerializedElementProps[],
      element => element['type'] === 'umlSubject'
    );
    const useCase = boxOf(
      elements as SerializedElementProps[],
      element => element['kind'] === 'use-case'
    );
    expect(
      umlCentreInside(
        { x: useCase.x, y: useCase.y, w: useCase.w, h: useCase.h },
        { x: subject.x, y: subject.y, w: subject.w, h: subject.h }
      )
    ).toBe(true);
  });
});
