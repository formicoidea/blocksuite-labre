import { snapshotFromAction } from '@labre/affine-gfx-template';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { createUmlClassifier, createUmlNode } from '../actions';
import {
  UML_IMPORT_GUTTER,
  UML_IMPORT_SLOT,
  umlElementsFromModel,
} from '../import';
import type { UmlClassifier, UmlModel, UmlRelation } from '../model';
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
