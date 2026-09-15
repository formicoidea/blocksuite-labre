import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { exportUmlPlantuml } from '../export';
import { UML_PLANTUML_IMPORT } from '../interchange';
import type { UmlModel, UmlRelationKind } from '../model';
import { importPlantuml } from '../plantuml-import';

/**
 * The PlantUML reader, form by form.
 *
 * The oracle is the MODEL rather than the elements: the materializer has its
 * own spec next door, and a reader tested through a board would be two things
 * tested at once with neither pinned. The one exception is the corpus case,
 * which asserts BYTES — see it for why that is the right assertion there and
 * nowhere else.
 *
 * The fixtures are the smallest source that states the form. A `.puml` is a
 * line language, so one line is genuinely the unit.
 */

const read = (source: string): UmlModel => {
  const { models } = importPlantuml(`@startuml\n${source}\n@enduml\n`);
  expect(models).toHaveLength(1);
  return models[0];
};

const relations = (source: string) =>
  read(source).relations.map(relation => [
    relation.kind,
    relation.sourceId,
    relation.targetId,
    relation.label,
  ]);

/* ── Classifiers ──────────────────────────────────────────────────────── */

describe('the classifiers', () => {
  it('reads a class, its alias and its two compartments', () => {
    const model = read(
      'class "Order" as o {\n  + id : OrderId\n  - paid : Boolean\n  + total() : Money\n}'
    );
    const [order] = model.classifiers;
    expect(order.id).toBe('o');
    expect(order.kind).toBe('class');
    expect(order.name).toBe('Order');
    // Verbatim, because PlantUML's member syntax IS §9.5.4's own and the writer
    // hands it straight back.
    expect(order.lines).toEqual({
      attributes: ['+ id : OrderId', '- paid : Boolean'],
      operations: ['+ total() : Money'],
    });
    // …and parsed, because XMI needs the structure.
    expect(order.attributes.map(property => property.name)).toEqual([
      'id',
      'paid',
    ]);
    expect(order.operations[0].name).toBe('total');
  });

  it('reads `abstract class` as §9.2.4 italics', () => {
    expect(read('abstract class Order').classifiers[0].isAbstract).toBe(true);
    expect(read('abstract Order').classifiers[0].isAbstract).toBe(true);
  });

  it('reads an interface and an enumeration as their own metaclass', () => {
    expect(read('interface Payable').classifiers[0].kind).toBe('interface');
    const status = read('enum Status {\n  DRAFT\n  PLACED\n}').classifiers[0];
    expect(status.kind).toBe('enumeration');
    // An enumeration's compartment holds LITERALS, and the writer wants bare
    // names: the parsed reading is what carries them.
    expect(status.attributes.map(literal => literal.name)).toEqual([
      'DRAFT',
      'PLACED',
    ]);
  });

  it('splits `object "o1 : Order"` into the instance and its classifier', () => {
    const object = read('object "o1 : Order" as o1 {\n  total = 12\n}')
      .classifiers[0];
    expect(object.kind).toBe('object');
    expect(object.name).toBe('o1');
    expect(object.instanceOf).toBe('Order');
    // §11.6.4: an instance has SLOTS, never attributes.
    expect(object.attributes).toEqual([]);
    expect(object.slots).toEqual([{ name: 'total', value: '12' }]);
  });

  it('lifts a stereotype out of a declaration, wherever it was written', () => {
    const model = read('class Order <<entity>>');
    expect(model.classifiers[0].keywords).toEqual(['entity']);
    expect(model.classifiers[0].name).toBe('Order');
  });

  it('takes a member written outside the block', () => {
    const model = read('class Order\nOrder : + id : OrderId\nOrder : ship()');
    expect(model.classifiers[0].lines).toEqual({
      attributes: ['+ id : OrderId'],
      operations: ['ship()'],
    });
  });
});

/* ── Containers ───────────────────────────────────────────────────────── */

describe('the containers', () => {
  it('draws a class inside the package that declares it', () => {
    const model = read('package "Sales" as sales {\n  class Order\n}');
    expect(model.packages[0].name).toBe('Sales');
    const pkg = model.packages[0].bounds!;
    const order = model.classifiers[0].bounds!;
    // Containment on this canvas IS geometry (`model.ts`, `plantuml.ts`), so
    // the layout has to put the class inside the box or the nesting is lost.
    expect(order.x).toBeGreaterThan(pkg.x);
    expect(order.x + order.w).toBeLessThan(pkg.x + pkg.w);
    expect(order.y).toBeGreaterThan(pkg.y);
    expect(order.y + order.h).toBeLessThan(pkg.y + pkg.h);
  });

  it('reads `rectangle` as §18.1.4 subject and nests its use cases', () => {
    const model = read(
      'rectangle "Shop" as shop {\n  usecase (Place an order) as uc1\n  (Pay) as uc2\n}'
    );
    expect(model.subjects.map(subject => subject.name)).toEqual(['Shop']);
    expect(model.useCases.map(useCase => useCase.name)).toEqual([
      'Place an order',
      'Pay',
    ]);
    const shop = model.subjects[0].bounds!;
    for (const useCase of model.useCases) {
      const box = useCase.bounds!;
      expect(box.x).toBeGreaterThan(shop.x);
      expect(box.y).toBeGreaterThan(shop.y);
    }
  });

  it('reads an actor', () => {
    expect(read('actor "A customer" as c').actors[0].name).toBe('A customer');
  });
});

/* ── Notes ────────────────────────────────────────────────────────────── */

describe('the notes', () => {
  it('reads the block form, which is what this pack writes', () => {
    const model = read('note as n1\n  A remark\n  on two lines\nend note');
    expect(model.notes[0].id).toBe('n1');
    expect(model.notes[0].body).toBe('A remark\non two lines');
    // A note is PROSE: no keyword is lifted out of it and it has no name.
    expect(model.notes[0].name).toBe('');
  });

  it('reads the one-line form', () => {
    expect(read('note "Just so" as n1').notes[0].body).toBe('Just so');
  });

  it('reads `note left of X` as a note AND the anchor attaching it', () => {
    const model = read('class Order\nnote left of Order : beside it');
    expect(model.notes[0].body).toBe('beside it');
    expect(model.relations).toEqual([
      {
        kind: 'anchor',
        sourceId: model.notes[0].id,
        targetId: 'Order',
      },
    ]);
  });
});

/* ── The relationships ────────────────────────────────────────────────── */

describe('the relationship operators', () => {
  /**
   * Every operator, and the SUBJECT of the sentence it states.
   *
   * The reversed spellings are the half that is easy to get backwards and
   * expensive to get wrong: `A <|-- B` and `B --|> A` both say "B is an A", so
   * the specific classifier — which `roles.ts` makes the source — is written on
   * a different side of each. A reader that swapped them would draw every
   * hierarchy upside down and export it that way.
   */
  const CASES: [string, UmlRelationKind, string, string][] = [
    ['A <|-- B', 'generalization', 'B', 'A'],
    ['B --|> A', 'generalization', 'B', 'A'],
    ['A <|.. B', 'realization', 'B', 'A'],
    ['B ..|> A', 'realization', 'B', 'A'],
    ['A o-- B', 'aggregation', 'A', 'B'],
    ['B --o A', 'aggregation', 'A', 'B'],
    ['A *-- B', 'composition', 'A', 'B'],
    ['B --* A', 'composition', 'A', 'B'],
    ['A --> B', 'association', 'A', 'B'],
    ['B <-- A', 'association', 'A', 'B'],
    ['A -- B', 'association', 'A', 'B'],
    ['A ..> B', 'dependency', 'A', 'B'],
    ['B <.. A', 'dependency', 'A', 'B'],
    ['A .. B', 'anchor', 'A', 'B'],
  ];

  for (const [line, kind, source, target] of CASES) {
    it(`reads \`${line}\` as ${kind} from ${source}`, () => {
      expect(relations(`class A\nclass B\n${line}`)).toEqual([
        [kind, source, target, undefined],
      ]);
    });
  }

  it('reads a long arrow and a direction hint as the plain one', () => {
    expect(relations('class A\nclass B\nA -down-> B')).toEqual([
      ['association', 'A', 'B', undefined],
    ]);
    expect(relations('class A\nclass B\nA <|--- B')).toEqual([
      ['generalization', 'B', 'A', undefined],
    ]);
  });

  it('reads the keyword on a dashed arrow as the role (§7.8.4, §18.1.4)', () => {
    expect(
      relations('usecase U1\nusecase U2\nU1 ..> U2 : <<include>>')
    ).toEqual([['include', 'U1', 'U2', undefined]]);
    expect(relations('usecase U1\nusecase U2\nU1 ..> U2 : «extend»')).toEqual([
      ['extend', 'U1', 'U2', undefined],
    ]);
    // `«use»` is the one that keeps its word: a Usage IS a plain Dependency
    // here, so nothing re-emits the keyword and dropping it would lose it.
    expect(relations('class A\ninterface I\nA ..> I : <<use>>')).toEqual([
      ['dependency', 'A', 'I', '<<use>>'],
    ]);
  });

  it('keeps an ordinary label as a label', () => {
    expect(relations('class A\nclass B\nA -- B : owns')).toEqual([
      ['association', 'A', 'B', 'owns'],
    ]);
  });

  it('declares an end an arrow names and nothing else did', () => {
    const model = read('class A\nA --> B');
    expect(model.classifiers.map(entry => entry.id)).toEqual(['A', 'B']);
  });

  it('adopts an artefact an arrow minted when its declaration catches up', () => {
    // Arrow-first is how half the `.puml` in the wild is written, and a reader
    // that made two boxes out of it would split every forward reference.
    const model = read('A --> B\nclass B {\n  + id : Id\n}');
    expect(model.classifiers.map(entry => entry.id)).toEqual(['A', 'B']);
    expect(model.classifiers[1].lines.attributes).toEqual(['+ id : Id']);
    expect(model.relations[0].targetId).toBe('B');
  });
});

describe('the end multiplicities', () => {
  it('land on the relation ends, parsed, with nothing carried', () => {
    const { models, notes } = importPlantuml(
      '@startuml\nclass A\nclass B\nA "1" *-- "0..* items" B\n@enduml'
    );
    expect(models[0].relations).toEqual([
      {
        kind: 'composition',
        sourceId: 'A',
        targetId: 'B',
        sourceEnd: { multiplicity: { lower: 1, upper: 1 }, raw: '1' },
        targetEnd: {
          multiplicity: { lower: 0, upper: '*' },
          role: 'items',
          raw: '0..* items',
        },
      },
    ]);
    // ADR 0020: the board draws both, so there is nothing left to carry.
    expect(notes.filter(note => note.kind === 'carried')).toHaveLength(0);
  });

  it('follow the ARTEFACT through an operator that reads backwards', () => {
    // `A <|-- B` makes B the source, so the string written at A — the left of
    // the line — is the TARGET end's.
    const { models, notes } = importPlantuml(
      '@startuml\nclass A\nclass B\nA "1" <|-- "2" B\n@enduml'
    );
    expect(models[0].relations[0]).toMatchObject({
      kind: 'generalization',
      sourceId: 'B',
      targetId: 'A',
      sourceEnd: { raw: '2' },
      targetEnd: { raw: '1' },
    });
    // A generalization's ends take no adornments in §11.5.4, so the text is
    // kept verbatim, drawn, and named as something no export will write.
    expect(models[0].relations[0].sourceEnd?.multiplicity).toBeUndefined();
    const said = notes.filter(note => note.kind === 'warning');
    expect(said).toHaveLength(2);
    expect(said[0].message).toContain('"2"');
  });

  it('never eat a quoted END NAME', () => {
    // `"Order" -- "Line"` is two named ends, not two cardinalities on an arrow
    // between nothing.
    expect(relations('class Order\nclass Line\n"Order" -- "Line"')).toEqual([
      ['association', 'Order', 'Line', undefined],
    ]);
  });
});

/* ── The frame heading ────────────────────────────────────────────────── */

describe('the title', () => {
  it('reads `<kind> <name>` as Annex A writes it', () => {
    const model = read('title uc Shop');
    expect(model.diagram.kind).toBe('uc');
    expect(model.diagram.name).toBe('Shop');
    expect(model.diagram.heading).toBe('uc Shop');
  });

  it('reads a title with no tag as the name of a class diagram', () => {
    const model = read('title Orders and lines');
    expect(model.diagram.kind).toBe('class');
    expect(model.diagram.name).toBe('Orders and lines');
  });

  it('infers the kind from the syntax when the title says nothing', () => {
    expect(read('usecase U1').diagram.kind).toBe('uc');
    expect(read('[*] --> Draft').diagram.kind).toBe('stm');
    expect(read('class A').diagram.kind).toBe('class');
  });
});

/* ── The state machine ────────────────────────────────────────────────── */

describe('the state-diagram syntax', () => {
  const machineOf = (source: string) => {
    const model = read(source);
    expect(model.stateMachines).toHaveLength(1);
    return model.stateMachines[0];
  };

  it('reads `[*]` as a beginning at one end and a stop at the other', () => {
    const machine = machineOf('[*] --> Draft\nDraft --> [*]');
    expect(machine.pseudostates.map(vertex => vertex.kind)).toEqual([
      'initial',
    ]);
    expect(machine.finalStates).toHaveLength(1);
    expect(machine.states.map(state => state.name)).toEqual(['Draft']);
  });

  it('parses a transition label with §14.2.4.8 grammar', () => {
    const machine = machineOf(
      'state A\nstate B\nA --> B : place, cancel [ok] / notify()'
    );
    expect(machine.transitions).toEqual([
      {
        sourceId: 'A',
        targetId: 'B',
        triggers: ['place', 'cancel'],
        guard: 'ok',
        effect: 'notify()',
      },
    ]);
  });

  it('reads the internal activities compartment (§14.2.4.4)', () => {
    const machine = machineOf(
      'state Draft\nDraft : entry / lock()\nDraft : do / poll()\nDraft : exit / unlock()\nDraft : a note to self'
    );
    expect(machine.states[0].entry).toEqual(['lock()']);
    expect(machine.states[0].doActivity).toEqual(['poll()']);
    expect(machine.states[0].exit).toEqual(['unlock()']);
    expect(machine.states[0].lines).toEqual(['a note to self']);
  });

  it('reads a composite state as a region, and nests what is in it', () => {
    const machine = machineOf('state Placed {\n  state Packing\n}');
    expect(machine.regions.map(region => region.name)).toEqual(['Placed']);
    expect(machine.states[0].regionId).toBe('Placed');
  });

  it('reads a stereotyped vertex as the glyph, not as a keyword', () => {
    const machine = machineOf('state c1 <<choice>>\nstate h1 <<history>>');
    expect(
      machine.pseudostates.map(vertex => [vertex.kind, vertex.keywords])
    ).toEqual([
      ['choice', []],
      ['shallow-history', []],
    ]);
  });
});

/* ── Everything else ──────────────────────────────────────────────────── */

describe('what the reader cannot read', () => {
  it('records a skinparam rather than applying it', () => {
    const { notes } = importPlantuml(
      '@startuml\nskinparam monochrome true\nclass A\n@enduml'
    );
    const carried = notes.filter(note => note.kind === 'carried');
    expect(carried).toHaveLength(1);
    expect(carried[0].element).toBe('skinparam');
  });

  it('records a line it does not understand, and never throws', () => {
    const { models, notes } = importPlantuml(
      '@startuml\n!include foo.puml\nhide empty members\nclass A\n@enduml'
    );
    expect(models[0].classifiers).toHaveLength(1);
    expect(notes.filter(note => note.kind === 'carried')).toHaveLength(2);
  });

  it('reads a snippet with no @startuml at all', () => {
    expect(
      importPlantuml('class A\nclass B\nA --> B').models[0].classifiers
    ).toHaveLength(2);
  });

  it('gives an empty file an empty model rather than an exception', () => {
    const { models, notes } = importPlantuml('');
    expect(models).toHaveLength(1);
    expect(models[0].classifiers).toEqual([]);
    expect(notes).toEqual([]);
  });

  it('reads one model per block', () => {
    const { models } = importPlantuml(
      '@startuml\ntitle class One\nclass A\n@enduml\n@startuml\ntitle uc Two\nusecase U\n@enduml\n'
    );
    expect(models.map(model => model.diagram.heading)).toEqual([
      'class One',
      'uc Two',
    ]);
    // Each block is a document of its own, and its ids are its own.
    expect(models[0].diagram.id).not.toBe(models[1].diagram.id);
  });
});

/* ── The corpus ───────────────────────────────────────────────────────── */

// The worktree may check the corpus out with CRLF; the writer emits LF.
const CORPUS = readFileSync(
  join(__dirname, 'corpus/labre-phase1-export.puml'),
  'utf8'
).replace(/\r\n/g, '\n');

describe('the corpus file an earlier build actually exported', () => {
  /**
   * BYTE equality, and here it IS reasonable — which is why it is asserted
   * here and nowhere else in this file.
   *
   * The corpus is a document `exportUmlPlantuml` produced, so every alias in it
   * is one the writer mints from a name, every line is in the order the writer
   * emits, and the nesting is the one the writer derives from geometry. There
   * is therefore exactly one document the writer can produce from a model that
   * reads back out of it — so if the two strings differ, something real was
   * lost, and the diff names it. Asserting the model instead would be asserting
   * this reader against itself.
   */
  it('re-exports byte for byte', () => {
    const { models } = importPlantuml(CORPUS);
    expect(exportUmlPlantuml(models).text).toBe(CORPUS);
  });

  it('holds the four artefacts of the phase-1 stencil', () => {
    const [model] = importPlantuml(CORPUS).models;
    expect(model.diagram).toMatchObject({
      kind: 'class',
      name: 'Diagram',
      heading: 'class Diagram',
    });
    expect(model.classifiers.map(entry => entry.name)).toEqual(['Class']);
    expect(model.actors.map(entry => entry.name)).toEqual(['Actor']);
    expect(model.subjects.map(entry => entry.name)).toEqual(['Subject']);
    expect(model.useCases.map(entry => entry.name)).toEqual(['Use case']);
    expect(model.warnings).toEqual([]);
  });
});

/* ── The capability ───────────────────────────────────────────────────── */

describe('uml:plantuml:import', () => {
  it('is the triple it claims to be', () => {
    expect(UML_PLANTUML_IMPORT.id).toBe('uml:plantuml:import');
    expect(UML_PLANTUML_IMPORT.direction).toBe('import');
    expect(UML_PLANTUML_IMPORT.format.tier).toBe('semantic');
  });

  it('returns element props and a report that counts what it did', () => {
    const result = UML_PLANTUML_IMPORT.run(CORPUS, {});
    expect(result.elements.length).toBeGreaterThan(0);
    expect(result.elements[0].type).toBe('umlDiagram');
    // Four artefacts and no relationship; the frame is Labre's and is not one
    // of the file's nodes.
    expect(result.report.mapped).toBe(4);
    expect(result.report.carried).toBe(0);
    expect(result.report.quarantined).toBe(0);
    expect(result.report.notes.map(note => note.kind)).toEqual([
      'invented-layout',
    ]);
  });

  it('reports what it could not read rather than throwing', () => {
    const result = UML_PLANTUML_IMPORT.run(
      '@startuml\nskinparam handwritten true\nclass A\nnonsense here\n@enduml',
      {}
    );
    expect(result.report.carried).toBe(2);
    expect(result.report.mapped).toBe(1);
  });
});
