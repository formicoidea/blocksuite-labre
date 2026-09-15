import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseOperation, parseProperty } from '../grammar';
import { stereotypesOf } from '../keywords';
import type {
  UmlClassifier,
  UmlComponentNode,
  UmlModel,
  UmlNodeBase,
  UmlPort,
  UmlRelation,
  UmlRelationKind,
} from '../model';
import { exportXmi } from '../xmi';
import { importXmi, umlElementsWithForeign } from '../xmi-import';

/**
 * The XMI 2.5.1 reader.
 *
 * ## The oracle is the writer
 *
 * Every family below is exported with `exportXmi`, imported back, and exported
 * AGAIN — and the two documents have to be the same bytes. That is a far
 * stronger check than a hand-written expectation, and it is the promise an
 * architect actually relies on: a sheet that goes out to Papyrus and comes back
 * is the same sheet. Nothing in the file is left un-asserted, because every
 * byte of it is in the comparison.
 *
 * It is also the check that does not have to argue about ids. The writer mints
 * `_1`, `_2`, … in traversal order, so a re-export lands on the same ids
 * exactly when the reader put everything back in the same order — which is the
 * thing that would otherwise need a normalizer nobody trusts.
 *
 * The deep-equal on a normalized model is here as well, on one fixture, because
 * a byte comparison says "the file survives" and a reader also has to produce
 * the right RECORDS for the materializer. What the normalizer strips is stated
 * where it strips it, and every strip is something the FORMAT does not carry —
 * never something the reader failed to read.
 *
 * ## No DOM
 *
 * Unlike `xmi.unit.spec.ts`, there is no `@vitest-environment happy-dom` here
 * and no `DOMParser`: the reader has none either (`docs/adr/0012` P3), and a
 * spec that needed one would be testing something the product does not run.
 */

/* ── Fixtures ─────────────────────────────────────────────────────────── */

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
  attributes: string[] = [],
  operations: string[] = []
): UmlClassifier {
  const base = node(id, name);
  const isObject = kind === 'object';
  return {
    ...base,
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

function relation(
  kind: UmlRelationKind,
  sourceId: string,
  targetId: string,
  label?: string
): UmlRelation {
  return { kind, sourceId, targetId, ...(label ? { label } : {}) };
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
    interactions: [],
    relations: [],
    warnings: [],
  };
}

const behaviourNode = <K extends string>(id: string, kind: K, name = '') => ({
  id,
  name,
  keywords: [],
  isAbstract: false,
  kind,
});

/** A class diagram with one of everything the writer has a rule for. */
function classDiagram(): UmlModel {
  return {
    ...emptyModel('d1', 'class', 'Orders'),
    classifiers: [
      classifier(
        'c1',
        'class',
        'Order {abstract}',
        [
          '+ id : String',
          '- lines : OrderLine [1..*]',
          '/ total : Real = 0',
          '+ count : Integer {static}',
        ],
        ['+ place(in when : Date) : Boolean', '# audit() {query}']
      ),
      classifier('c2', 'class', 'OrderLine', ['+ quantity : Integer']),
      classifier('c3', 'class', 'PriorityOrder'),
      classifier(
        'i1',
        'interface',
        '«interface»\nPayable',
        [],
        ['+ pay() : Boolean']
      ),
      classifier('e1', 'enumeration', '«enumeration»\nStatus', ['NEW', 'PAID']),
    ],
    notes: [{ ...node('n1', ''), body: 'Totals are net of tax.' }],
    relations: [
      relation('association', 'c3', 'c1', 'replaces'),
      relation('composition', 'c1', 'c2'),
      relation('aggregation', 'c3', 'c2'),
      relation('generalization', 'c3', 'c1'),
      relation('realization', 'c1', 'i1'),
      relation('dependency', 'c1', 'e1', '«use»'),
      relation('anchor', 'n1', 'c1'),
    ],
  };
}

/** A use case diagram: an actor, three cases in a subject, include and extend. */
function useCaseDiagram(): UmlModel {
  const subject = { x: 100, y: 100, w: 600, h: 400 };
  return {
    ...emptyModel('d2', 'uc', 'Storefront'),
    actors: [node('a1', 'Customer', { x: 0, y: 200, w: 80, h: 120 })],
    useCases: [
      node('u1', 'Place order', { x: 200, y: 150, w: 200, h: 90 }),
      node('u2', 'Check stock', { x: 200, y: 260, w: 200, h: 90 }),
      node('u3', 'Apply discount', { x: 200, y: 370, w: 200, h: 90 }),
    ],
    subjects: [node('s1', 'Shop', subject)],
    relations: [
      relation('association', 'a1', 'u1'),
      relation('include', 'u1', 'u2'),
      relation('extend', 'u3', 'u1'),
    ],
  };
}

/** A component diagram: ports, both kinds of interface, and a manifestation. */
function componentDiagram(): UmlModel {
  const port: UmlPort = { ...node('p1', 'http'), ownerId: 'k1' };
  const cart: UmlComponentNode = {
    ...node('k1', '«component»\nCart'),
    ports: [port],
    provided: ['IOrder'],
    required: ['IPayment'],
  };
  const catalogue: UmlComponentNode = {
    ...node('k2', '«component»\nCatalogue'),
    ports: [],
    provided: ['IOrder'],
    required: [],
  };
  return {
    ...emptyModel('d3', 'cmp', 'Storefront components'),
    components: [cart, catalogue],
    ports: [port],
    artifacts: [node('f1', '«artifact»\ncart.jar')],
    relations: [
      relation('manifest', 'f1', 'k1'),
      relation('dependency', 'k1', 'k2'),
    ],
  };
}

/** A deployment diagram: three cubes, a deployment and a communication path. */
function deploymentDiagram(): UmlModel {
  return {
    ...emptyModel('d4', 'dep', 'Production'),
    artifacts: [node('f1', '«artifact»\ncart.jar')],
    nodes: [
      { ...node('n1', '«device»\nAppServer'), kind: 'device' as const },
      {
        ...node('n2', '«executionEnvironment»\nTomcat'),
        kind: 'execution-environment' as const,
      },
      { ...node('n3', '«legacy»\nDBServer'), kind: 'node' as const },
    ],
    relations: [
      relation('deploy', 'f1', 'n1'),
      relation('communication-path', 'n1', 'n3', 'LAN'),
    ],
  };
}

/** An activity: control nodes, a guarded branch, an object flow, two lanes. */
function activityDiagram(): UmlModel {
  const model = emptyModel('act-1', 'act', 'Fulfil an order');
  model.activities = [
    {
      id: 'act-1',
      name: 'Fulfil an order',
      nodes: [
        {
          ...behaviourNode('i', 'initial' as const),
          partitionId: 'lane-sales',
        },
        {
          ...behaviourNode('a', 'action' as const, 'Take the order'),
          partitionId: 'lane-sales',
        },
        {
          ...behaviourNode('d', 'decision' as const),
          partitionId: 'lane-sales',
        },
        {
          ...behaviourNode('o', 'object-node' as const, 'Order'),
          partitionId: 'lane-store',
        },
        {
          ...behaviourNode('b', 'action' as const, 'Pick the goods'),
          partitionId: 'lane-store',
        },
        behaviourNode('s', 'send-signal' as const, 'Order shipped'),
        behaviourNode('t', 'time-event' as const, 'after 2 days'),
        behaviourNode('x', 'flow-final' as const),
        behaviourNode('z', 'activity-final' as const),
      ],
      edges: [
        { kind: 'control-flow', sourceId: 'i', targetId: 'a' },
        { kind: 'control-flow', sourceId: 'a', targetId: 'd' },
        {
          kind: 'control-flow',
          sourceId: 'd',
          targetId: 'b',
          name: 'ready',
          guard: 'stock > 0',
          weight: '2',
        },
        { kind: 'control-flow', sourceId: 'd', targetId: 'x', guard: 'else' },
        { kind: 'object-flow', sourceId: 'a', targetId: 'o' },
        { kind: 'control-flow', sourceId: 'b', targetId: 's' },
        { kind: 'control-flow', sourceId: 't', targetId: 'z' },
      ],
      partitions: [
        {
          id: 'lane-sales',
          name: 'Sales',
          keywords: [],
          isAbstract: false,
          orientation: 'vertical',
          nodeIds: ['i', 'a', 'd'],
        },
        {
          id: 'lane-store',
          name: 'Warehouse',
          keywords: [],
          isAbstract: false,
          orientation: 'vertical',
          nodeIds: ['o', 'b'],
        },
      ],
    },
  ];
  return model;
}

/** A state machine: internal behaviours, a composite state, a full transition. */
function stateMachineDiagram(): UmlModel {
  const model = emptyModel('stm-1', 'stm', 'Order lifecycle');
  model.stateMachines = [
    {
      id: 'stm-1',
      name: 'Order lifecycle',
      regions: [{ id: 'r', name: 'Running', keywords: [], isAbstract: false }],
      states: [
        {
          id: 's1',
          name: 'Draft',
          keywords: [],
          isAbstract: false,
          entry: ['reserve()'],
          doActivity: ['poll()'],
          exit: ['release()'],
          lines: [],
        },
        {
          id: 's2',
          name: 'Placed',
          keywords: [],
          isAbstract: false,
          entry: [],
          doActivity: [],
          exit: [],
          lines: [],
          regionId: 'r',
        },
      ],
      finalStates: [{ id: 'f', name: '', keywords: [], isAbstract: false }],
      pseudostates: [
        { id: 'i', name: '', keywords: [], isAbstract: false, kind: 'initial' },
        { id: 'c', name: '', keywords: [], isAbstract: false, kind: 'choice' },
        {
          id: 'h',
          name: '',
          keywords: [],
          isAbstract: false,
          kind: 'shallow-history',
          regionId: 'r',
        },
      ],
      transitions: [
        { sourceId: 'i', targetId: 's1', triggers: [] },
        {
          sourceId: 's1',
          targetId: 'c',
          triggers: ['submit', 'after 5 s'],
          guard: 'stock > 0',
          effect: 'reserve()',
        },
        { sourceId: 'c', targetId: 's2', triggers: [], guard: 'ok' },
        { sourceId: 's2', targetId: 'f', triggers: ['close'] },
        { sourceId: 'h', targetId: 's2', triggers: [] },
      ],
    },
  ];
  return model;
}

/* ── The round trip ───────────────────────────────────────────────────── */

describe('export → import → export is the same bytes', () => {
  const families: [string, UmlModel][] = [
    ['a class diagram', classDiagram()],
    ['a component diagram', componentDiagram()],
    ['a deployment diagram', deploymentDiagram()],
    ['an activity diagram', activityDiagram()],
    ['a state machine', stateMachineDiagram()],
  ];

  for (const [what, model] of families) {
    it(`round-trips ${what}`, () => {
      const first = exportXmi([model], { name: 'Shop' });
      const { models, report } = importXmi(first);
      expect(models).toHaveLength(1);
      expect(exportXmi(models, { name: 'Shop' })).toBe(first);
      // Our own file, read whole: nothing in it had to be quarantined.
      expect(report.quarantined).toBe(0);
      expect(report.sourceVersion).toBe('20131001');
    });
  }

  /**
   * The one family that does not come back byte-identical, and the reason is
   * named in the reader's header: a use case is drawn INSIDE its subject, so
   * `ownedUseCase` is a statement made by geometry, and a file with no diagram
   * in it has no geometry to make it with. The second export writes the cases
   * beside the subject — and every export after that is the same bytes, which
   * is the fixed point D3 promises for ids and this reader keeps for shape.
   */
  it('settles a use case diagram after one cycle, and says what it flattened', () => {
    const first = exportXmi([useCaseDiagram()], { name: 'Shop' });
    const once = importXmi(first);
    const second = exportXmi(once.models, { name: 'Shop' });
    const third = exportXmi(importXmi(second).models, { name: 'Shop' });

    expect(third).toBe(second);
    expect(once.report.quarantined).toBe(0);
    // Everything the file said is on the sheet; only the nesting is not.
    expect(once.models[0].actors.map(each => each.name)).toEqual(['Customer']);
    expect(once.models[0].subjects.map(each => each.name)).toEqual(['Shop']);
    expect(once.models[0].useCases.map(each => each.name)).toEqual([
      'Place order',
      'Check stock',
      'Apply discount',
    ]);
    expect(once.models[0].relations.map(each => each.kind).sort()).toEqual([
      'association',
      'extend',
      'include',
    ]);
    expect(
      once.report.notes.some(each => each.message.includes('side by side'))
    ).toBe(true);
  });

  it('round-trips four sheets in one document, as four models', () => {
    const sheets = [
      classDiagram(),
      useCaseDiagram(),
      componentDiagram(),
      deploymentDiagram(),
    ];
    const first = exportXmi(sheets, { name: 'Shop' });
    const { models } = importXmi(first);
    expect(models.map(model => model.diagram.kind)).toEqual([
      'class',
      'uc',
      'cmp',
      'dep',
    ]);
    expect(models.map(model => model.diagram.name)).toEqual([
      'Orders',
      'Storefront',
      'Storefront components',
      'Production',
    ]);
    const second = exportXmi(models, { name: 'Shop' });
    expect(exportXmi(importXmi(second).models, { name: 'Shop' })).toBe(second);
  });
});

/* ── The records, not just the bytes ──────────────────────────────────── */

/**
 * The model with everything the FORMAT does not carry taken off it.
 *
 * Three strips, and each is a fact about XMI rather than about this reader:
 *
 *  - **ids**, renumbered in traversal order. A surface id is Labre's and the
 *    file's id is the file's (D3); the reader keeps the file's, so the two
 *    sides of the comparison can only agree up to a renaming.
 *  - **`bounds`**, everywhere. `xmi.ts` writes not one coordinate — its own
 *    header says so — so geometry cannot come back from a file that has none.
 *  - **`lines`**, the compartments as the author TYPED them. The file carries
 *    the parsed structure; the reader re-spells a line from it, which is the
 *    same line for anything §9.5.4 can express and need not be for a
 *    constraint the parser did not model.
 */
function normalize(model: UmlModel): unknown {
  const ids = new Map<string, string>();
  let next = 0;
  const id = (raw: string): string => {
    const known = ids.get(raw);
    if (known) return known;
    const minted = `n${++next}`;
    ids.set(raw, minted);
    return minted;
  };

  // One traversal, in the order the writer emits: both sides number the same
  // artefacts in the same sequence exactly when the reader put them back in
  // the order the file had them.
  id(model.diagram.id);
  for (const item of [
    ...model.packages,
    ...model.classifiers,
    ...model.actors,
    ...model.subjects,
    ...model.useCases,
    ...model.components,
    ...model.ports,
    ...model.artifacts,
    ...model.nodes,
    ...model.notes,
  ]) {
    id(item.id);
  }

  const base = (item: UmlNodeBase) => {
    const { bounds: _bounds, ...rest } = item;
    return { ...rest, id: id(item.id) };
  };

  return {
    diagram: {
      kind: model.diagram.kind,
      name: model.diagram.name,
      heading: model.diagram.heading,
      id: id(model.diagram.id),
    },
    packages: model.packages.map(base),
    classifiers: model.classifiers.map(item => {
      const { lines: _lines, ...rest } = item;
      return { ...base(item), ...rest, id: id(item.id) };
    }),
    actors: model.actors.map(base),
    useCases: model.useCases.map(base),
    subjects: model.subjects.map(base),
    notes: model.notes.map(base),
    components: model.components.map(item => ({
      ...base(item),
      ports: item.ports.map(port => ({
        ...base(port),
        ...(port.ownerId ? { ownerId: id(port.ownerId) } : {}),
      })),
      provided: item.provided,
      required: item.required,
    })),
    ports: model.ports.map(port => ({
      ...base(port),
      ...(port.ownerId ? { ownerId: id(port.ownerId) } : {}),
    })),
    artifacts: model.artifacts.map(base),
    nodes: model.nodes.map(base),
    // Sorted, because a relationship's place in the list is not a statement the
    // file makes: the writer emits generalizations inside their classifier and
    // associations beside them, so the reader meets them in a different order
    // and draws exactly the same picture.
    relations: model.relations
      .map(item => ({
        ...item,
        sourceId: id(item.sourceId),
        targetId: id(item.targetId),
      }))
      .sort((a, b) =>
        `${a.kind}${a.sourceId}${a.targetId}`.localeCompare(
          `${b.kind}${b.sourceId}${b.targetId}`
        )
      ),
  };
}

describe('the records a model comes back as', () => {
  it('is deep-equal to the model that was written, up to ids', () => {
    // No metaclass keyword anywhere in this fixture, deliberately: `«interface»`
    // on a `uml:Interface` is the fact the type already states, and the writer
    // drops it for that reason — so a fixture carrying one would be asserting
    // the writer's lossiness rather than the reader's fidelity.
    const model: UmlModel = {
      ...emptyModel('d1', 'class', 'Orders'),
      classifiers: [
        classifier(
          'c1',
          'class',
          'Order {abstract}',
          ['+ id : String', '- lines : OrderLine [1..*]', '/ total : Real = 0'],
          ['+ place(in when : Date) : Boolean']
        ),
        classifier('c2', 'class', 'OrderLine', ['+ quantity : Integer']),
        classifier('c3', 'class', '«entity» PriorityOrder'),
      ],
      notes: [{ ...node('n1', ''), body: 'Totals are net of tax.' }],
      relations: [
        relation('composition', 'c1', 'c2'),
        relation('generalization', 'c3', 'c1'),
        relation('dependency', 'c1', 'c2', '«use»'),
        relation('anchor', 'n1', 'c1'),
      ],
    };

    const { models } = importXmi(exportXmi([model], { name: 'Shop' }));
    expect(normalize(models[0])).toEqual(normalize(model));
  });

  it('re-spells the compartments the way the author typed them', () => {
    const model = {
      ...emptyModel('d1', 'class', 'Orders'),
      classifiers: [
        classifier(
          'c1',
          'class',
          'Order',
          ['+ id : String', '- lines : OrderLine [1..*]', '/ total : Real = 0'],
          ['+ place(in when : Date) : Boolean', '# audit()']
        ),
      ],
    };
    const { models } = importXmi(exportXmi([model], { name: 'Shop' }));
    // Not a promise for every line §9.5.4 admits — see {@link normalize} — but
    // the ordinary ones come back as themselves, which is what keeps the
    // PlantUML writer (which prints these verbatim) honest after an import.
    expect(models[0].classifiers[0].lines).toEqual({
      attributes: [
        '+ id : String',
        '- lines : OrderLine [1..*]',
        '/ total : Real = 0',
      ],
      operations: ['+ place(in when : Date) : Boolean', '# audit()'],
    });
  });

  it('puts the diamond back on the classifier it was drawn on', () => {
    const model = {
      ...emptyModel('d1', 'class', 'Orders'),
      classifiers: [
        classifier('c1', 'class', 'Order'),
        classifier('c2', 'class', 'OrderLine'),
      ],
      relations: [
        relation('composition', 'c1', 'c2'),
        relation('aggregation', 'c2', 'c1'),
      ],
    };
    const { models } = importXmi(exportXmi([model], { name: 'Shop' }));
    expect(
      models[0].relations.map(each => [each.kind, each.sourceId, each.targetId])
    ).toHaveLength(2);
    const [composition, aggregation] = models[0].relations;
    expect(composition.kind).toBe('composition');
    expect(aggregation.kind).toBe('aggregation');
    // Source is the WHOLE on both, which is the role table's direction and the
    // one `Property::isComposite` states.
    const order = models[0].classifiers[0].id;
    const line = models[0].classifiers[1].id;
    expect([composition.sourceId, composition.targetId]).toEqual([order, line]);
    expect([aggregation.sourceId, aggregation.targetId]).toEqual([line, order]);
  });

  it('reads each end’s adornments onto the relation end drawn there', () => {
    // §11.5.4's identity, read back: what is written beside a classifier adorns
    // the memberEnd TYPED by that classifier. The writer put the source's label
    // on the end typed by the source, so that is where the reader finds it.
    const model = {
      ...emptyModel('d1', 'class', 'Orders'),
      classifiers: [
        classifier('c1', 'class', 'Order'),
        classifier('c2', 'class', 'OrderLine'),
      ],
      relations: [
        {
          ...relation('association', 'c1', 'c2'),
          sourceEnd: {
            multiplicity: { lower: 1, upper: 1 },
            role: 'order',
            visibility: 'private' as const,
            raw: '1 -order',
          },
          targetEnd: {
            multiplicity: { lower: 0, upper: '*' as const },
            role: 'lines',
            raw: '0..* lines',
          },
        },
      ],
    };
    const { models, foreign } = importXmi(exportXmi([model], { name: 'Shop' }));
    const read = models[0].relations[0];
    expect(read.sourceEnd).toEqual({
      multiplicity: { lower: 1, upper: 1 },
      role: 'order',
      visibility: 'private',
      // Composed from the three pieces of markup, in §11.5.4's own order.
      raw: '1 -order',
    });
    expect(read.targetEnd).toEqual({
      multiplicity: { lower: 0, upper: '*' },
      role: 'lines',
      raw: '0..* lines',
    });
    // They are on the BOARD now (ADR 0020), so nothing about them rides in the
    // payload any more: the only scope left on the association is `@ends`, the
    // pair of end ids the re-emitter needs and the drawing cannot show.
    const carried = Object.values(foreign).find(each => each.attrs?.['@ends']);
    expect(Object.keys(carried?.attrs ?? {})).toEqual(['@ends']);
  });

  it('re-exports an adorned association to the same bytes', () => {
    const model = {
      ...emptyModel('d1', 'class', 'Orders'),
      classifiers: [
        classifier('c1', 'class', 'Order'),
        classifier('c2', 'class', 'OrderLine'),
      ],
      relations: [
        {
          ...relation('aggregation', 'c1', 'c2'),
          sourceEnd: { multiplicity: { lower: 1, upper: 1 }, raw: '1' },
          targetEnd: {
            multiplicity: { lower: 0, upper: '*' as const },
            role: 'lines',
            raw: '0..* lines',
          },
        },
      ],
    };
    const first = exportXmi([model], { name: 'Shop' });
    const { models } = importXmi(first);
    expect(exportXmi(models, { name: 'Shop' })).toBe(first);
  });
});

/* ── The corpus ───────────────────────────────────────────────────────── */

const corpus = (name: string) =>
  // The worktree may check the corpus out with CRLF; the writers emit LF.
  readFileSync(join(__dirname, 'corpus', name), 'utf8').replace(/\r\n/g, '\n');

describe('the phase-1 export, off disk', () => {
  const { models, report } = importXmi(corpus('labre-phase1-export.xmi'));

  it('is one class diagram with one of each phase-1 artefact', () => {
    expect(models).toHaveLength(1);
    const model = models[0];
    expect(model.diagram.kind).toBe('class');
    expect(model.diagram.name).toBe('Diagram');
    expect(model.classifiers.map(each => each.name)).toEqual(['Class']);
    expect(model.actors.map(each => each.name)).toEqual(['Actor']);
    expect(model.subjects.map(each => each.name)).toEqual(['Subject']);
    expect(model.useCases.map(each => each.name)).toEqual(['Use case']);
  });

  it('resolves a type through the DataType the writer minted for it', () => {
    const [order] = models[0].classifiers;
    expect(order.attributes[0]).toMatchObject({
      name: 'attribute',
      type: 'Type',
      visibility: 'public',
    });
    expect(order.operations[0]).toMatchObject({
      name: 'operation',
      returnType: 'Type',
    });
  });

  it('loses nothing and quarantines nothing', () => {
    expect(report.quarantined).toBe(0);
    expect(report.mapped).toBeGreaterThan(0);
  });

  it('settles after one cycle', () => {
    // Not byte-identical to the file on disk, and for the one reason the
    // reader's header names: this corpus draws its use case inside a subject,
    // and the nesting is geometry the file does not carry. Everything else is
    // exact, and the second export is a fixed point.
    const second = exportXmi(models, { name: 'BlockSuite Playground' });
    expect(
      exportXmi(importXmi(second).models, { name: 'BlockSuite Playground' })
    ).toBe(second);
    expect(second).toContain(
      '<packagedElement xmi:type="uml:Class" xmi:id="_3" name="Class">'
    );
    expect(second).toContain(
      '<packagedElement xmi:type="uml:DataType" xmi:id="_7" name="Type"/>'
    );
  });
});

/* ── Other tools ──────────────────────────────────────────────────────── */

const PAPYRUS = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmi:version="20131001" xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" xmlns:uml="http://www.omg.org/spec/UML/20161101" xmi:id="_model" name="RootElement">
  <packagedElement xmi:type="uml:Package" xmi:id="_pkg" name="Domain">
    <packagedElement xmi:type="uml:Class" xmi:id="_order" name="Order">
      <eAnnotations xmi:type="ecore:EAnnotation" xmi:id="_ann" source="http://www.eclipse.org/uml2/2.0.0/UML">
        <details xmi:type="ecore:EStringToStringMapEntry" xmi:id="_det" key="origin" value="legacy"/>
      </eAnnotations>
      <ownedAttribute xmi:type="uml:Property" xmi:id="_total" name="total" visibility="public" aggregation="none">
        <type xmi:type="uml:PrimitiveType" href="pathmap://UML_LIBRARIES/UMLPrimitiveTypes.library.uml#String"/>
        <lowerValue xmi:type="uml:LiteralInteger" xmi:id="_low" value="0"/>
        <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="_up" value="*"/>
      </ownedAttribute>
    </packagedElement>
    <packagedElement xmi:type="uml:Signal" xmi:id="_signal" name="OrderPlaced"/>
  </packagedElement>
</uml:Model>
`;

describe('a Papyrus-style file', () => {
  const { models, report, foreign } = importXmi(PAPYRUS);

  it('reads the class, its type and its multiplicity', () => {
    expect(models).toHaveLength(1);
    const [order] = models[0].classifiers;
    expect(order.name).toBe('Order');
    expect(order.attributes[0]).toMatchObject({
      name: 'total',
      // `pathmap://…#String` is Eclipse's own URI for the same library Annex
      // E.3 specifies; the FRAGMENT is the type name either way.
      type: 'String',
      multiplicity: { lower: 0, upper: '*' },
    });
  });

  it('quarantines the eAnnotation verbatim, on the class it was on', () => {
    const kept = foreign['_order']?.quarantined ?? [];
    expect(kept).toHaveLength(1);
    // Byte for byte, its child included: the fragment is the file's own text.
    expect(kept[0].fragment).toContain(
      '<eAnnotations xmi:type="ecore:EAnnotation"'
    );
    expect(kept[0].fragment).toContain('key="origin" value="legacy"');
    expect(kept[0].fragment).toContain('</eAnnotations>');
  });

  it('quarantines the unmapped uml:Signal on the package it was in', () => {
    const kept = foreign['_pkg']?.quarantined ?? [];
    expect(kept).toHaveLength(1);
    expect(kept[0].fragment).toBe(
      '<packagedElement xmi:type="uml:Signal" xmi:id="_signal" name="OrderPlaced"/>'
    );
  });

  it('says so in the report, and loses nothing', () => {
    expect(report.quarantined).toBe(2);
    expect(
      report.notes.filter(each => each.kind === 'quarantined')
    ).toHaveLength(2);
    // `aggregation="none"` is a default spelled out; it is carried rather than
    // dropped, because the reader does not model it and the file wrote it.
    expect(foreign['_order']?.attrs?.['_total']).toMatchObject({
      aggregation: 'none',
    });
  });
});

const STARUML = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmlns:uml="http://www.omg.org/spec/UML/20161101" xmi:id="m" name="StarUML">
  <packagedElement type="uml:Package" xmi:id="p" name="Main">
    <packagedElement type="uml:Class" xmi:id="c1" name="Vehicle"/>
    <packagedElement type="uml:Class" xmi:id="c2" name="Car">
      <generalization type="uml:Generalization" xmi:id="g1" general="c1"/>
    </packagedElement>
  </packagedElement>
</uml:Model>
`;

describe('a StarUML-style file, whose metaclass is an unprefixed `type`', () => {
  const { models } = importXmi(STARUML);

  it('reads the classes and the generalization between them', () => {
    expect(models).toHaveLength(1);
    expect(models[0].classifiers.map(each => each.name)).toEqual([
      'Vehicle',
      'Car',
    ]);
    expect(models[0].relations).toEqual([
      { kind: 'generalization', sourceId: 'c2', targetId: 'c1' },
    ]);
  });

  it('still reads a bare `type` as an id reference where it is one', () => {
    // The whole reason the unprefixed spelling is conditional: on an
    // `ownedAttribute`, `type="c1"` is the Property's type and not a metaclass.
    const { models: typed } = importXmi(
      `<uml:Model xmi:id="m"><packagedElement type="uml:Package" xmi:id="p" name="Main">` +
        `<packagedElement type="uml:Class" xmi:id="c1" name="Money"/>` +
        `<packagedElement type="uml:Class" xmi:id="c2" name="Order">` +
        `<ownedAttribute type="c1" xmi:id="a1" name="total"/>` +
        `</packagedElement></packagedElement></uml:Model>`
    );
    expect(typed[0].classifiers[1].attributes[0]).toMatchObject({
      name: 'total',
      type: 'Money',
    });
  });
});

describe('the kind of a file that never says', () => {
  const sheet = (body: string) =>
    importXmi(
      `<uml:Model xmi:id="m" name="M"><packagedElement xmi:type="uml:Package" ` +
        `xmi:id="p" name="P">${body}</packagedElement></uml:Model>`
    ).models[0].diagram.kind;

  it('is inferred from what the package declares', () => {
    expect(
      sheet('<packagedElement xmi:type="uml:Actor" xmi:id="a" name="A"/>')
    ).toBe('uc');
    expect(
      sheet('<packagedElement xmi:type="uml:UseCase" xmi:id="u" name="U"/>')
    ).toBe('uc');
    expect(
      sheet('<packagedElement xmi:type="uml:Activity" xmi:id="v" name="V"/>')
    ).toBe('act');
    expect(
      sheet(
        '<packagedElement xmi:type="uml:StateMachine" xmi:id="s" name="S"/>'
      )
    ).toBe('stm');
    expect(
      sheet('<packagedElement xmi:type="uml:Node" xmi:id="n" name="N"/>')
    ).toBe('dep');
    expect(
      sheet('<packagedElement xmi:type="uml:Artifact" xmi:id="f" name="F"/>')
    ).toBe('dep');
    expect(
      sheet('<packagedElement xmi:type="uml:Component" xmi:id="k" name="K"/>')
    ).toBe('cmp');
    expect(
      sheet('<packagedElement xmi:type="uml:Class" xmi:id="c" name="C"/>')
    ).toBe('class');
    // The default a frame with nothing on it gets, which is the model's own.
    expect(sheet('')).toBe('class');
  });
});

/* ── Diagram interchange ──────────────────────────────────────────────── */

describe('a file that does carry a diagram', () => {
  it('reads UMLDI bounds as the layout, by source id', () => {
    const { layout, report } = importXmi(
      `<uml:Model xmi:id="m" name="M">
         <packagedElement xmi:type="uml:Package" xmi:id="p" name="P">
           <packagedElement xmi:type="uml:Class" xmi:id="c1" name="Order"/>
         </packagedElement>
         <umldi:UMLDiagram xmi:id="d1" name="P">
           <umldi:UMLShape xmi:id="sh1" modelElement="c1">
             <bounds x="120" y="40" width="200" height="90"/>
           </umldi:UMLShape>
         </umldi:UMLDiagram>
       </uml:Model>`
    );
    expect(layout['c1']).toEqual({ x: 120, y: 40, w: 200, h: 90 });
    // D4 forbids claiming an invented position came from the file — so the
    // note is written exactly when nothing came from it.
    expect(report.notes.some(each => each.kind === 'invented-layout')).toBe(
      false
    );
  });

  it('reads a Papyrus `.notation` shape the same way', () => {
    const { layout } = importXmi(
      `<uml:Model xmi:id="m" name="M">
         <packagedElement xmi:type="uml:Package" xmi:id="p" name="P">
           <packagedElement xmi:type="uml:Class" xmi:id="c1" name="Order"/>
         </packagedElement>
       </uml:Model>
       <notation:Diagram xmi:id="d" type="PapyrusUMLClassDiagram">
         <children xmi:type="notation:Shape" xmi:id="sh" element="c1">
           <layoutConstraint xmi:type="notation:Bounds" x="10" y="20" width="160" height="80"/>
         </children>
       </notation:Diagram>`
    );
    expect(layout['c1']).toEqual({ x: 10, y: 20, w: 160, h: 80 });
  });

  it('says the layout is ours when the file carries none', () => {
    const { report } = importXmi(exportXmi([classDiagram()], { name: 'S' }));
    expect(report.notes.some(each => each.kind === 'invented-layout')).toBe(
      true
    );
  });
});

/* ── Nothing throws ───────────────────────────────────────────────────── */

describe('a file that is not what it claims', () => {
  it('reads an unknown root as no models and one note', () => {
    const { models, report } = importXmi(
      `<mxfile host="app.diagrams.net"><diagram id="x">…</diagram></mxfile>`
    );
    expect(models).toEqual([]);
    expect(report).toMatchObject({ mapped: 0, carried: 0, quarantined: 0 });
    expect(report.notes[0].message).toContain('<mxfile>');
  });

  it('reads nothing at all as no models and one note', () => {
    for (const source of ['', 'not xml', '{"a":1}']) {
      const { models, report } = importXmi(source);
      expect(models).toEqual([]);
      expect(report.notes.length).toBeGreaterThan(0);
    }
  });

  it('reads a truncated file as far as it goes', () => {
    const whole = exportXmi([classDiagram()], { name: 'Shop' });
    const { models, report } = importXmi(whole.slice(0, whole.length / 2));
    expect(models).toHaveLength(1);
    expect(models[0].classifiers.length).toBeGreaterThan(0);
    expect(report.notes.some(each => each.kind === 'warning')).toBe(true);
  });

  it('keeps a relationship whose end the file never declared out of the picture', () => {
    const { models, report, foreign } = importXmi(
      `<uml:Model xmi:id="m" name="M">
         <packagedElement xmi:type="uml:Package" xmi:id="p" name="P">
           <packagedElement xmi:type="uml:Class" xmi:id="c1" name="Order"/>
           <packagedElement xmi:type="uml:Association" xmi:id="as1" memberEnd="e1 e2">
             <ownedEnd xmi:type="uml:Property" xmi:id="e1" association="as1">
               <type xmi:idref="c1"/>
             </ownedEnd>
           </packagedElement>
         </packagedElement>
       </uml:Model>`
    );
    expect(models[0].relations).toEqual([]);
    expect(report.quarantined).toBe(1);
    expect(foreign['p']?.quarantined?.[0].fragment).toContain(
      'uml:Association'
    );
  });

  /**
   * §17.6.4 lists thirteen interaction operators and a file may hold a
   * fourteenth — a tool's own word, or a typo. It is DRAWN as an `alt`, because
   * a pentagon has to say something, and the word itself is carried: the
   * warning promises the file's own spelling is kept beside it, and this is
   * where the promise is kept (ADR 0012 D1).
   */
  it('draws an unknown interaction operator as alt and carries the word', () => {
    const { models, report, foreign } = importXmi(
      `<uml:Model xmi:id="m" name="M">
         <packagedElement xmi:type="uml:Package" xmi:id="p" name="P">
           <packagedElement xmi:type="uml:Interaction" xmi:id="i1" name="Flow">
             <lifeline xmi:type="uml:Lifeline" xmi:id="l1" name="a"/>
             <fragment xmi:type="uml:CombinedFragment" xmi:id="f1" covered="l1" interactionOperator="coregion">
               <operand xmi:type="uml:InteractionOperand" xmi:id="o1"/>
             </fragment>
           </packagedElement>
         </packagedElement>
       </uml:Model>`
    );
    expect(models[0].interactions[0].fragments[0].operator).toBe('alt');
    expect(
      report.notes.find(each => each.kind === 'warning')?.message
    ).toContain('"coregion"');
    expect(foreign['f1']?.attrs?.['f1']).toEqual({
      interactionOperator: 'coregion',
    });
    expect(report.carried).toBeGreaterThan(0);
  });

  it('accepts a bare uml:Package as the one sheet it is', () => {
    const { models } = importXmi(
      `<uml:Package xmi:id="p" name="Domain">
         <packagedElement xmi:type="uml:Class" xmi:id="c1" name="Order"/>
       </uml:Package>`
    );
    expect(models).toHaveLength(1);
    expect(models[0].diagram.name).toBe('Domain');
    expect(models[0].classifiers).toHaveLength(1);
  });

  it('accepts a uml:Model wrapped in xmi:XMI', () => {
    const { models } = importXmi(
      `<xmi:XMI xmi:version="2.1"><uml:Model xmi:id="m" name="M">
         <packagedElement xmi:type="uml:Package" xmi:id="p" name="P">
           <packagedElement xmi:type="uml:Class" xmi:id="c1" name="Order"/>
         </packagedElement>
       </uml:Model></xmi:XMI>`
    );
    expect(models[0].classifiers).toHaveLength(1);
  });
});

/* ── Putting the foreign matter back ──────────────────────────────────── */

describe('umlElementsWithForeign', () => {
  it('merges each payload onto the element that carries its source id', () => {
    const elements = [
      { type: 'umlDiagram', interchange: { xmi: { id: 'p' } } },
      { type: 'umlNode', interchange: { xmi: { id: '_order' } } },
    ];
    const merged = umlElementsWithForeign(
      elements,
      {
        _order: {
          id: '_order',
          quarantined: [{ fragment: '<eAnnotations/>', reason: 'because' }],
        },
      },
      'xmi'
    );
    expect(merged[0]).toEqual(elements[0]);
    expect(merged[1].interchange).toEqual({
      xmi: {
        id: '_order',
        quarantined: [{ fragment: '<eAnnotations/>', reason: 'because' }],
      },
    });
  });

  it('parks what matched no element on the first one (D6)', () => {
    const merged = umlElementsWithForeign(
      [{ type: 'umlDiagram', interchange: { xmi: { id: 'p' } } }],
      {
        gone: {
          id: 'gone',
          quarantined: [{ fragment: '<uml:Signal/>', reason: 'because' }],
        },
      },
      'xmi'
    );
    const payload = (
      merged[0].interchange as Record<string, { quarantined?: unknown[] }>
    ).xmi;
    expect(payload.quarantined).toEqual([
      { fragment: '<uml:Signal/>', reason: 'because' },
    ]);
  });

  it('writes no key at all on an element that carried nothing', () => {
    const elements = [{ type: 'umlNode' }];
    expect(umlElementsWithForeign(elements, {}, 'xmi')).toEqual(elements);
  });
});
