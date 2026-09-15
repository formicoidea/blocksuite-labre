import { describe, expect, it } from 'vitest';

import { exportUmlPlantuml } from '../export';
import { parseOperation, parseProperty } from '../grammar';
import { stereotypesOf } from '../keywords';
import type { UmlClassifier, UmlModel, UmlNodeBase } from '../model';
import { importPlantuml } from '../plantuml-import';

/**
 * The round trip: **write a diagram, read it back, and get the diagram.**
 *
 * The property ADR 0012 asks a `semantic` capability for, on the two phase-1
 * families, stated twice because the two statements catch different failures:
 *
 *  - **the model survives.** Every classifier, every member line, every
 *    relationship and every nesting comes back, matched by NAME rather than by
 *    id — the id is the file's alias going out and the file's alias coming in,
 *    and D3 is explicit that surface identity is never the file's;
 *  - **the bytes settle.** `export → import → export` is the identity on the
 *    second pass. That is the stronger half and the one a reviewer can check by
 *    eye: if anything at all were lost or added, the two documents would differ
 *    and the diff would name it.
 *
 * The fixtures are `plantuml.unit.spec.ts`'s own class and use case diagrams,
 * rebuilt here rather than exported from there: that spec's job is to pin what
 * the WRITER emits, and a shared fixture would let a change made for one of the
 * two quietly re-aim the other.
 */

/* ── Fixtures — the phase-1 pair, as `plantuml.unit.spec.ts` builds them ── */

type Box = { x: number; y: number; w: number; h: number };

function node(id: string, name: string, bounds?: Box): UmlNodeBase {
  const stated = stereotypesOf(name);
  return {
    id,
    name: stated.name,
    keywords: stated.keywords,
    isAbstract: stated.isAbstract,
    ...(bounds ? { bounds } : {}),
  };
}

function classifier(
  id: string,
  kind: UmlClassifier['kind'],
  name: string,
  bounds: Box,
  attributes: string[] = [],
  operations: string[] = []
): UmlClassifier {
  const isObject = kind === 'object';
  return {
    ...node(id, name, bounds),
    kind,
    attributes: isObject ? [] : attributes.map(parseProperty),
    operations: operations.map(parseOperation),
    slots: isObject
      ? attributes.map(line => {
          const property = parseProperty(line);
          return {
            name: property.name,
            ...(property.defaultValue ? { value: property.defaultValue } : {}),
          };
        })
      : [],
    lines: { attributes, operations },
  };
}

function emptyModel(
  id: string,
  kind: UmlModel['diagram']['kind'],
  name: string
): UmlModel {
  return {
    diagram: { id, kind, name, heading: `${kind} ${name}` },
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

/** A class diagram: a package, five classifiers, one of every arrow. */
function classDiagram(): UmlModel {
  return {
    ...emptyModel('d1', 'class', 'Orders'),
    packages: [node('p1', 'Domain', { x: 0, y: 0, w: 600, h: 400 })],
    classifiers: [
      classifier(
        'c1',
        'class',
        'Order {abstract}',
        { x: 40, y: 60, w: 200, h: 120 },
        ['+ id : String', '- lines : OrderLine [1..*]'],
        ['+ place() : Boolean']
      ),
      classifier(
        'c2',
        'class',
        'OrderLine',
        { x: 320, y: 60, w: 200, h: 120 },
        ['+ quantity : Integer']
      ),
      classifier(
        'i1',
        'interface',
        '«interface»\nPayable',
        { x: 700, y: 60, w: 200, h: 120 },
        [],
        ['+ pay() : Boolean']
      ),
      classifier(
        'e1',
        'enumeration',
        '«enumeration»\nStatus',
        { x: 700, y: 220, w: 200, h: 120 },
        ['NEW', 'PAID']
      ),
      {
        ...classifier(
          'o1',
          'object',
          'order1',
          { x: 700, y: 380, w: 200, h: 120 },
          ['quantity = 3']
        ),
        instanceOf: 'Order',
      },
    ],
    notes: [{ ...node('n1', ''), body: 'Totals are net of tax.' }],
    relations: [
      { kind: 'composition', sourceId: 'c1', targetId: 'c2', label: '1..*' },
      { kind: 'generalization', sourceId: 'c2', targetId: 'c1' },
      { kind: 'realization', sourceId: 'c1', targetId: 'i1' },
      { kind: 'dependency', sourceId: 'c1', targetId: 'e1', label: '«use»' },
      { kind: 'anchor', sourceId: 'n1', targetId: 'c1' },
    ],
  };
}

/** A use case diagram: an actor, a subject, two cases, an include. */
function useCaseDiagram(): UmlModel {
  return {
    ...emptyModel('d2', 'uc', 'Storefront'),
    actors: [node('a1', 'Customer', { x: 0, y: 200, w: 80, h: 120 })],
    subjects: [node('s1', 'Shop', { x: 100, y: 100, w: 600, h: 400 })],
    useCases: [
      node('u1', 'Place order', { x: 200, y: 150, w: 200, h: 90 }),
      node('u2', 'Check stock', { x: 200, y: 280, w: 200, h: 90 }),
    ],
    relations: [
      { kind: 'association', sourceId: 'a1', targetId: 'u1' },
      { kind: 'include', sourceId: 'u1', targetId: 'u2' },
    ],
  };
}

/* ── What "the same diagram" means ────────────────────────────────────── */

/**
 * The keywords a PlantUML DECLARATION already states, and which therefore
 * cannot survive the trip as keywords.
 *
 * `interface Payable` needs no `<<interface>>` after it — the word IS the
 * statement, and `plantuml.ts` drops it on the way out precisely so the
 * rendered picture does not draw the keyword twice. So it comes back as the
 * metaclass rather than as a label, which is the same fact in the place the
 * format keeps it. Everything else in `keywords` is compared.
 */
const DECLARED = new Set(['interface', 'enumeration', 'enum', 'class']);

const keywordsOf = (record: UmlNodeBase) =>
  record.keywords.filter(keyword => !DECLARED.has(keyword.toLowerCase()));

/**
 * One model as the STATEMENTS it makes, with every id resolved to a name.
 *
 * Ids are deliberately not compared: going out they are surface ids, coming
 * back they are the aliases the writer minted from names, and D3 says surface
 * identity is Labre's and never the file's. Geometry is not compared either —
 * PlantUML carries none, so the layout coming back is Labre's own invention and
 * saying so is D4's whole point. What is left is the diagram.
 */
function statements(model: UmlModel) {
  const named = new Map<string, string>();
  const remember = (record: UmlNodeBase, display = record.name) =>
    named.set(record.id, display);

  for (const record of model.packages) remember(record);
  for (const record of model.classifiers) remember(record);
  for (const record of model.subjects) remember(record);
  for (const record of model.actors) remember(record);
  for (const record of model.useCases) remember(record);
  for (const record of model.notes) remember(record, record.body);

  /** Which package a classifier is drawn in — the writer's own reading. */
  const inside = (record: UmlNodeBase, containers: readonly UmlNodeBase[]) => {
    const box = record.bounds;
    if (!box) return undefined;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    let best: UmlNodeBase | undefined;
    let area = Number.POSITIVE_INFINITY;
    for (const container of containers) {
      const outer = container.bounds;
      if (!outer || container.id === record.id) continue;
      if (cx < outer.x || cx > outer.x + outer.w) continue;
      if (cy < outer.y || cy > outer.y + outer.h) continue;
      const size = outer.w * outer.h;
      if (size < area) {
        best = container;
        area = size;
      }
    }
    return best?.name;
  };

  return {
    heading: model.diagram.heading,
    kind: model.diagram.kind,
    name: model.diagram.name,
    packages: model.packages.map(record => record.name),
    classifiers: model.classifiers.map(record => ({
      kind: record.kind,
      name: record.name,
      isAbstract: record.isAbstract,
      keywords: keywordsOf(record),
      lines: record.lines,
      slots: record.slots,
      instanceOf: record.instanceOf,
      inPackage: inside(record, model.packages),
    })),
    actors: model.actors.map(record => record.name),
    subjects: model.subjects.map(record => record.name),
    useCases: model.useCases.map(record => ({
      name: record.name,
      inSubject: inside(record, model.subjects),
    })),
    notes: model.notes.map(record => record.body),
    relations: model.relations.map(relation => [
      relation.kind,
      named.get(relation.sourceId) ?? relation.sourceId,
      named.get(relation.targetId) ?? relation.targetId,
      relation.label,
    ]),
  };
}

const reimport = (models: readonly UmlModel[]) =>
  importPlantuml(exportUmlPlantuml(models).text).models;

/* ── The trip ─────────────────────────────────────────────────────────── */

describe('a class diagram, written and read back', () => {
  const original = classDiagram();
  const [returned] = reimport([original]);

  it('states the same things about the same artefacts', () => {
    expect(statements(returned)).toEqual(statements(original));
  });

  it('keeps the members of every compartment, line for line', () => {
    const order = returned.classifiers.find(entry => entry.name === 'Order')!;
    expect(order.isAbstract).toBe(true);
    expect(order.lines).toEqual({
      attributes: ['+ id : String', '- lines : OrderLine [1..*]'],
      operations: ['+ place() : Boolean'],
    });
  });

  it('is a fixed point on the second pass, byte for byte', () => {
    const once = exportUmlPlantuml([original]).text;
    expect(exportUmlPlantuml(reimport([original])).text).toBe(once);
  });
});

describe('a use case diagram, written and read back', () => {
  const original = useCaseDiagram();
  const [returned] = reimport([original]);

  it('states the same things about the same artefacts', () => {
    expect(statements(returned)).toEqual(statements(original));
  });

  it('keeps the two cases inside the subject that offers them', () => {
    expect(returned.subjects.map(entry => entry.name)).toEqual(['Shop']);
    for (const useCase of returned.useCases) {
      const box = useCase.bounds!;
      const shop = returned.subjects[0].bounds!;
      expect(box.x + box.w / 2).toBeGreaterThan(shop.x);
      expect(box.x + box.w / 2).toBeLessThan(shop.x + shop.w);
    }
  });

  it('is a fixed point on the second pass, byte for byte', () => {
    const once = exportUmlPlantuml([original]).text;
    expect(exportUmlPlantuml(reimport([original])).text).toBe(once);
  });
});

describe('both diagrams in one document', () => {
  const originals = [classDiagram(), useCaseDiagram()];

  it('comes back as two models, in the order they were written', () => {
    const returned = reimport(originals);
    expect(returned).toHaveLength(2);
    expect(returned.map(model => model.diagram.heading)).toEqual([
      'class Orders',
      'uc Storefront',
    ]);
  });

  it('is a fixed point on the second pass, byte for byte', () => {
    const once = exportUmlPlantuml(originals).text;
    expect(exportUmlPlantuml(reimport(originals)).text).toBe(once);
  });
});

/* ── §11.5.4's per-end adornments (ADR 0020) ──────────────────────────── */

/**
 * The two end labels, out and back.
 *
 * The strongest statement the pair can make about them: the ends are written
 * beside the arrow, read back off the quoted strings, and the SECOND export is
 * the first byte for byte. A multiplicity that came back on the wrong end, or
 * lost its role name, or gained a bracket would show up as a diff here.
 */
describe('an association whose ends are adorned', () => {
  const adorned = (): UmlModel => ({
    ...emptyModel('d1', 'class', 'Orders'),
    classifiers: [
      classifier('c1', 'class', 'Order', { x: 0, y: 0, w: 200, h: 120 }),
      classifier('c2', 'class', 'OrderLine', { x: 400, y: 0, w: 200, h: 120 }),
    ],
    relations: [
      {
        kind: 'aggregation',
        sourceId: 'c1',
        targetId: 'c2',
        sourceEnd: { multiplicity: { lower: 1, upper: 1 }, raw: '1' },
        targetEnd: {
          multiplicity: { lower: 0, upper: '*' },
          role: 'lines',
          raw: '0..* lines',
        },
      },
    ],
  });

  it('writes both ends, quoted, on their own sides of the arrow', () => {
    expect(exportUmlPlantuml([adorned()]).text).toContain(
      'order "1" o-- "0..* lines" orderline'
    );
  });

  it('brings each end back on the end it was written at', () => {
    const [returned] = reimport([adorned()]);
    expect(returned.relations[0].sourceEnd).toEqual({
      multiplicity: { lower: 1, upper: 1 },
      raw: '1',
    });
    expect(returned.relations[0].targetEnd).toEqual({
      multiplicity: { lower: 0, upper: '*' },
      role: 'lines',
      raw: '0..* lines',
    });
  });

  it('is a fixed point on the second pass, byte for byte', () => {
    const once = exportUmlPlantuml([adorned()]).text;
    expect(exportUmlPlantuml(reimport([adorned()])).text).toBe(once);
  });
});
