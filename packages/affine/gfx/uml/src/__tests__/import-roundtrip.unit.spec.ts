import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { exportUmlPlantuml, exportUmlXmi } from '../export';
import { parseOperation, parseProperty } from '../grammar';
import {
  umlElementsFromModel,
  umlSequenceColumn,
  umlSequenceDestruction,
  umlSequenceExecution,
  umlSequenceFragment,
  umlSequenceSlot,
} from '../import';
import { stereotypesOf } from '../keywords';
import type {
  UmlClassifier,
  UmlMessage,
  UmlMessageKind,
  UmlModel,
  UmlNodeBase,
  UmlSourceElement,
  UmlTimelineEntry,
} from '../model';
import { umlInteractionTimeline, umlModelFrom } from '../model';
import { importPlantuml } from '../plantuml-import';
import { importXmi } from '../xmi-import';

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
    interactions: [],
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

/* ── The OTHER round trip: through the board the reader draws ─────────── */

/**
 * A materialized board as the reader of a canvas takes it.
 *
 * `umlElementsFromModel` emits serialized PROPS — a `children` record on a
 * group, everything else already in the shape `umlModelFrom` reads — so the
 * adapter is one key: a group's members are `childIds` on the way back in. No
 * surface, no element models, no store; the same trick `model.unit.spec.ts`
 * plays with `artefact()`, driven off the materializer's own output rather than
 * off literals.
 */
function boardOf(models: readonly UmlModel[]): UmlSourceElement[] {
  const { elements } = umlElementsFromModel(models, { formatId: 'plantuml' });
  return elements.map(props => {
    const { children, ...rest } = props as Record<string, unknown>;
    return {
      ...(rest as unknown as UmlSourceElement),
      ...(children && typeof children === 'object'
        ? { childIds: Object.keys(children as Record<string, unknown>) }
        : {}),
    };
  });
}

/**
 * **Draw it, then read the drawing** — the third statement of the round trip,
 * and the one that catches what neither of the other two can.
 *
 * `export → import → export` never leaves the file: it proves the two PARSERS
 * agree with the two writers, and says nothing at all about the board in
 * between. `materialize → read` is the other half — the sheet a user actually
 * gets — and on a sequence diagram it is the half that matters, because §17.4.4
 * makes the ORDER of the conversation a fact about geometry: the materializer
 * translates every box onto the sheet, `umlModelFrom` measures each message's
 * height against the column it lands on, and if those two disagree about where
 * the drawing is, the arrows come back at the wrong heights and the
 * conversation is scrambled — a defect no file-to-file test can see.
 */
const materializeAndRead = (models: readonly UmlModel[]): UmlModel[] => {
  const board = boardOf(models);
  return board
    .filter(element => element.type === 'umlDiagram')
    .map(frame => umlModelFrom(frame, board));
};

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

/* ── §17 — a sequence sheet, out and back ─────────────────────────────── */

/**
 * The round trip a SEQUENCE diagram has to make, and why it is a different
 * promise from the one above.
 *
 * On a class sheet what has to survive is a set of statements; on a sequence
 * sheet it is an ORDER. §17.4.4 makes the vertical axis time, so a message that
 * came back one line higher is a different conversation — and neither file
 * format carries a height: a `.puml` is a list of lines and an XMI `fragment`
 * list is an ordered collection. The order is therefore turned into coordinates
 * on the way in ({@link umlSequenceSlot}: one slot per EVENT) and read back off
 * them on the way out, and these three tests are what pin that the two passes
 * agree — down to which branch of the `alt` each arrow is in, and to the
 * `activate` that sits between two of them.
 */
function sequenceDiagram(): UmlModel {
  const column = [0, 1, 2].map(index => umlSequenceColumn(index, 600));
  const at = (slot: number) => umlSequenceSlot(slot);

  return {
    ...emptyModel('sd1', 'sd', 'Checkout'),
    interactions: [
      {
        id: 'sd1',
        name: 'Checkout',
        lifelines: [
          {
            ...node('l1', 'Customer'),
            keywords: ['actor'],
            bounds: column[0],
          },
          { ...node('l2', 'web'), type: 'Storefront', bounds: column[1] },
          { ...node('l3', 'orders'), bounds: column[2] },
        ],
        messages: [
          message('m1', 'message-sync', 'l1', 'l2', 'browse()', at(0)),
          message('m2', 'message-async', 'l2', 'l3', 'openBasket()', at(2)),
          message('m3', 'message-reply', 'l3', 'l2', 'basket', at(3)),
          message('m4', 'message-sync', 'l1', 'l2', 'checkout()', at(5)),
          message('m5', 'message-reply', 'l2', 'l1', 'no basket', at(7)),
          message('m6', 'message-delete', 'l2', 'd1', 'close()', at(10)),
        ],
        fragments: [
          {
            ...node('f1', 'basket is not empty'),
            operator: 'alt',
            operands: [
              { guard: 'basket is not empty', y0: at(4), y1: at(6) },
              { guard: 'basket is empty', y0: at(6), y1: at(8) },
            ],
            coveredLifelineIds: ['l1', 'l2'],
            bounds: umlSequenceFragment([column[0], column[1]], at(4), at(8)),
          },
        ],
        executions: [
          {
            ...node('x1', ''),
            lifelineId: 'l2',
            y0: at(1),
            y1: at(9),
            bounds: umlSequenceExecution(column[1], at(1), at(9)),
          },
        ],
        destructions: [
          {
            ...node('d1', ''),
            lifelineId: 'l3',
            y: at(11),
            bounds: umlSequenceDestruction(column[2], at(11)),
          },
        ],
      },
    ],
  };
}

/** One message of the fixture — six fields, spelled once. */
function message(
  id: string,
  kind: UmlMessageKind,
  sourceId: string,
  targetId: string,
  label: string,
  y: number
): UmlMessage {
  return { id, kind, sourceId, targetId, label, y };
}

/** The conversation as the ORDER it states, with every id resolved to a name. */
function conversation(model: UmlModel): string[] {
  const interaction = model.interactions[0];
  if (!interaction) return [];
  const spine = new Map<string, string>();
  for (const lifeline of interaction.lifelines) {
    spine.set(lifeline.id, lifeline.name);
  }
  for (const execution of interaction.executions) {
    spine.set(execution.id, spine.get(execution.lifelineId ?? '') ?? '?');
  }
  for (const destruction of interaction.destructions) {
    spine.set(destruction.id, spine.get(destruction.lifelineId ?? '') ?? '?');
  }
  const lines: string[] = [];
  const walk = (entries: readonly UmlTimelineEntry[], depth: number) => {
    const indent = '  '.repeat(depth);
    for (const entry of entries) {
      switch (entry.at) {
        case 'message':
          lines.push(
            `${indent}${spine.get(entry.message.sourceId)} ${entry.message.kind} ${spine.get(entry.message.targetId)} : ${entry.message.label ?? ''}`
          );
          break;
        case 'execution-start':
          lines.push(`${indent}activate ${spine.get(entry.execution.id)}`);
          break;
        case 'execution-finish':
          lines.push(`${indent}deactivate ${spine.get(entry.execution.id)}`);
          break;
        case 'destruction':
          lines.push(`${indent}destroy ${spine.get(entry.destruction.id)}`);
          break;
        case 'fragment':
          lines.push(
            `${indent}${entry.fragment.operator} ${entry.fragment.name}`
          );
          for (const band of entry.operands) {
            lines.push(`${indent}[${band.operand.guard ?? ''}]`);
            walk(band.entries, depth + 1);
          }
          break;
      }
    }
  };
  walk(umlInteractionTimeline(interaction), 0);
  return lines;
}

describe('a sequence diagram, written as PlantUML and read back', () => {
  const original = sequenceDiagram();
  const [returned] = reimport([original]);

  it('comes back as a sequence sheet with the same three participants', () => {
    expect(returned.diagram.kind).toBe('sd');
    expect(returned.interactions).toHaveLength(1);
    expect(returned.interactions[0].lifelines.map(each => each.name)).toEqual([
      'Customer',
      'web',
      'orders',
    ]);
    // §17.3.4's `: <Type>` half, and the `actor` keyword that draws the
    // stick figure — both are written into the head and read back off it.
    expect(returned.interactions[0].lifelines[1].type).toBe('Storefront');
    expect(returned.interactions[0].lifelines[0].keywords).toContain('actor');
  });

  it('says the same things in the same order, in the same branches', () => {
    expect(conversation(returned)).toEqual(conversation(original));
  });

  it('keeps the bar over the messages it spans', () => {
    const [interaction] = returned.interactions;
    const bar = interaction.executions[0];
    const inside = interaction.messages.filter(
      each => each.y > bar.y0 && each.y < bar.y1
    );
    expect(inside).toHaveLength(4);
  });

  it('is a fixed point on the second pass, byte for byte', () => {
    const once = exportUmlPlantuml([original]).text;
    expect(exportUmlPlantuml(reimport([original])).text).toBe(once);
  });
});

describe('a sequence diagram, written as XMI and read back', () => {
  const original = sequenceDiagram();
  const [returned] = importXmi(exportUmlXmi([original]).text).models;

  it('comes back as one Interaction with every metaclass §17 asks for', () => {
    const [interaction] = returned.interactions;
    expect(interaction.lifelines).toHaveLength(3);
    expect(interaction.messages.map(each => each.kind)).toEqual([
      'message-sync',
      'message-async',
      'message-reply',
      'message-sync',
      'message-reply',
      'message-delete',
    ]);
    expect(interaction.executions).toHaveLength(1);
    expect(interaction.destructions).toHaveLength(1);
    expect(interaction.fragments[0].operands.map(each => each.guard)).toEqual([
      'basket is not empty',
      'basket is empty',
    ]);
  });

  it('says the same things in the same order, in the same branches', () => {
    expect(conversation(returned)).toEqual(conversation(original));
  });

  it('is a fixed point on the second pass, byte for byte', () => {
    const once = exportUmlXmi([original]).text;
    expect(exportUmlXmi(importXmi(once).models).text).toBe(once);
  });
});

/* ── The corpus: a `.puml` written by hand, the way one is in the wild ── */

const corpus = (name: string) =>
  readFileSync(join(__dirname, 'corpus', name), 'utf8').replaceAll(
    '\r\n',
    '\n'
  );

describe('the sequence corpus — a login and order flow', () => {
  const { models, notes } = importPlantuml(corpus('sequence-order.puml'));
  const [interaction] = models[0].interactions;

  it('is read as one sequence sheet', () => {
    expect(models).toHaveLength(1);
    expect(models[0].diagram.kind).toBe('sd');
    expect(models[0].diagram.name).toBe('Checkout — placing an order');
  });

  it('declares five participants, two of them with a type', () => {
    expect(interaction.lifelines.map(each => each.name)).toEqual([
      'Customer',
      'web',
      'orders',
      'inventory',
      'receipt',
    ]);
    expect(interaction.lifelines.map(each => each.type ?? '')).toEqual([
      '',
      'Storefront',
      'OrderService',
      'StockDB',
      '',
    ]);
  });

  it('reads ten messages, in the order the file writes them', () => {
    expect(interaction.messages.map(each => each.label)).toEqual([
      'browse()',
      'openBasket()',
      'basket',
      'reserve(sku, qty)',
      'reservation',
      'checkout()',
      'new(total)',
      'confirmation',
      'nothing to check out',
      'close()',
    ]);
    expect(interaction.messages.map(each => each.kind)).toEqual([
      'message-sync',
      'message-async',
      'message-reply',
      'message-sync',
      'message-reply',
      'message-sync',
      // `create receipt` on the line above — §17.4.4's createMessage.
      'message-create',
      'message-reply',
      'message-reply',
      // …and `destroy receipt` on the line below: the arrow that ENDS the
      // participant is the deleteMessage, and PlantUML writes the pair.
      'message-delete',
    ]);
    const last = interaction.messages[interaction.messages.length - 1];
    expect(last.targetId).toBe(interaction.destructions[0].id);
  });

  it('reads three bars, one cross and four fragments', () => {
    expect(interaction.executions).toHaveLength(3);
    expect(interaction.destructions).toHaveLength(1);
    expect(interaction.fragments.map(each => each.operator)).toEqual([
      'loop',
      'alt',
      'ref',
      'opt',
    ]);
    expect(interaction.fragments[1].operands.map(each => each.guard)).toEqual([
      'basket is not empty',
      'basket is empty',
    ]);
    expect(interaction.fragments[2].name).toBe('Authorise payment');
  });

  it('says what it invented and what it could not apply', () => {
    expect(notes.map(entry => entry.kind)).toEqual([
      'carried',
      'invented-layout',
    ]);
    expect(notes[0].message).toContain('autonumber');
  });
});

/* ── The corpus: an XMI interaction in Papyrus's own spelling ─────────── */

describe('the Papyrus sequence fixture', () => {
  const { models, report } = importXmi(corpus('papyrus-sequence.xmi'));
  const [model] = models;

  it('reads both interactions off a model with no package in it', () => {
    expect(models).toHaveLength(1);
    expect(model.diagram.kind).toBe('sd');
    expect(model.interactions.map(each => each.name)).toEqual([
      'PlaceOrder',
      'Charge card',
    ]);
  });

  it('reads the three lifelines and the four messages of the first', () => {
    const [interaction] = model.interactions;
    expect(interaction.lifelines.map(each => each.name)).toEqual([
      'customer',
      'order',
      'stock',
    ]);
    expect(interaction.messages.map(each => each.label)).toEqual([
      'place(basket)',
      'reserve(sku)',
      'rejected',
      'close()',
    ]);
  });

  it('reads the alt, its two guards and the interaction use', () => {
    const [interaction] = model.interactions;
    const [alt, use] = interaction.fragments;
    expect(alt.operator).toBe('alt');
    expect(alt.operands.map(each => each.guard)).toEqual([
      'quantity > 0',
      'else',
    ]);
    expect(alt.coveredLifelineIds).toContain('_ll_stock');
    // §17.7.4: `refersTo` names an Interaction this document declares, and the
    // NAME is what the board can draw.
    expect(use.operator).toBe('ref');
    expect(use.name).toBe('Charge card');
  });

  it('reads the bar between its two occurrences and the cross under it', () => {
    const [interaction] = model.interactions;
    expect(interaction.executions).toHaveLength(1);
    expect(interaction.executions[0].y1).toBeGreaterThan(
      interaction.executions[0].y0
    );
    expect(interaction.destructions).toHaveLength(1);
    expect(interaction.destructions[0].lifelineId).toBe('_ll_order');
  });

  it('resolves every message end, and keeps what it cannot draw', () => {
    for (const message of model.interactions[0].messages) {
      expect(message.sourceId).not.toBe('');
      expect(message.targetId).not.toBe('');
    }
    // The two `ownedAttribute` Properties a Papyrus lifeline `represents`.
    // Neither is drawn — §17.3.4's head writes a type, not a property — so both
    // are kept verbatim rather than swallowed (D5), which is the whole of the
    // foreign-matter contract.
    expect(report.quarantined).toBe(2);
  });
});

/* ── The phase-3 pair: two files the playground actually wrote ────────── */

/**
 * The sequence sheet a build of THIS tranche exported, out of the playground,
 * in both formats — the phase-1 pair's counterpart and the reference for the
 * guard decision.
 *
 * Two lifelines `a : A` and `b : B`, a `loop` with the operands `[x > 0]` and
 * `[else]`, a synchronous `doIt(x)` and its reply. The pair is what makes the
 * bracket contract checkable against something other than our own fixtures: the
 * canvas held `[x > 0]`, the `.puml` says `loop [x > 0]` and the XMI says
 * `value="x > 0"`, and both files are on disk saying so.
 */
describe('the phase-3 export, off disk', () => {
  const PUML = corpus('labre-phase3-export.puml');
  const XMI = corpus('labre-phase3-export.xmi');

  it('re-exports the PlantUML byte for byte', () => {
    expect(exportUmlPlantuml(importPlantuml(PUML).models).text).toBe(PUML);
  });

  it('re-exports the XMI byte for byte', () => {
    const { models } = importXmi(XMI);
    expect(exportUmlXmi(models, { name: 'BlockSuite Playground' }).text).toBe(
      XMI
    );
  });

  it('spells the guard without its brackets in both files', () => {
    // D2: the brackets are the NOTATION's, so the canvas keeps them and the
    // two writers take exactly one pair off. `[[x > 0]]` is the failure.
    expect(PUML).toContain('loop [x > 0]');
    expect(PUML).toContain('else [else]');
    expect(PUML).not.toContain('[[');
    expect(XMI).toContain('value="x &gt; 0"');
    expect(XMI).toContain('value="else"');
  });

  it('reads the same conversation out of either file', () => {
    const [fromPuml] = importPlantuml(PUML).models;
    const [fromXmi] = importXmi(XMI).models;

    for (const model of [fromPuml, fromXmi]) {
      expect(model.diagram.kind).toBe('sd');
      const [interaction] = model.interactions;
      expect(
        interaction.lifelines.map(each => [each.name, each.type ?? ''])
      ).toEqual([
        ['a', 'A'],
        ['b', 'B'],
      ]);
      expect(interaction.fragments.map(each => each.operator)).toEqual([
        'loop',
      ]);
      expect(interaction.fragments[0].operands.map(each => each.guard)).toEqual(
        ['x > 0', 'else']
      );
    }
    // …and the ORDER, which is the whole of what a sequence diagram says. Ids
    // are each file's own (D3), so the timeline is compared by name.
    expect(conversation(fromXmi)).toEqual(conversation(fromPuml));
  });

  it('is a fixed point through the board as well', () => {
    for (const [name, models] of [
      ['plantuml', importPlantuml(PUML).models],
      ['xmi', importXmi(XMI).models],
    ] as const) {
      expect(exportUmlPlantuml(materializeAndRead(models)).text, name).toBe(
        exportUmlPlantuml(models).text
      );
    }
  });
});

/* ── A destroy inside a branch ────────────────────────────────────────── */

/**
 * The `destroy` an `opt` performs, out and back.
 *
 * The one arrow whose far end is not a lifeline: §17.4.4's delete message lands
 * on a DestructionOccurrenceSpecification, and a fragment's coverage is a list
 * of LIFELINES. A writer that measured containment against the cross's own id
 * found no fragment covering it and wrote the pair after `end`, leaving the
 * branch empty — a `.puml` that says the participant is closed unconditionally
 * where the author said it is closed only under the guard.
 */
describe('a destroy drawn inside an opt', () => {
  const SOURCE = [
    '@startuml',
    'title sd Closing',
    '',
    'participant "a" as a',
    'participant "b" as b',
    '',
    'opt [g]',
    '  a -> b : close()',
    '  destroy b',
    'end',
    '@enduml',
    '',
  ].join('\n');

  it('writes both lines inside the block, indented', () => {
    const { models } = importPlantuml(SOURCE);
    expect(exportUmlPlantuml(models).text).toBe(SOURCE);
  });

  it('is a fixed point through the board as well', () => {
    const { models } = importPlantuml(SOURCE);
    expect(exportUmlPlantuml(materializeAndRead(models)).text).toBe(SOURCE);
    expect(exportUmlXmi(materializeAndRead(models)).text).toBe(
      exportUmlXmi(models).text
    );
  });
});

/* ── The sheet itself: materialize → read → the same file ─────────────── */

describe('a sequence sheet, drawn on a board and read back off it', () => {
  const synthetic = sequenceDiagram();
  const fromCorpus = importPlantuml(corpus('sequence-order.puml')).models;

  it.each([
    ['the synthetic fixture', [synthetic]],
    ['the corpus file', fromCorpus],
  ] as const)('writes the same PlantUML from %s', (_name, models) => {
    expect(exportUmlPlantuml(materializeAndRead(models)).text).toBe(
      exportUmlPlantuml(models).text
    );
  });

  it.each([
    ['the synthetic fixture', [synthetic]],
    ['the corpus file', fromCorpus],
  ] as const)('writes the same XMI from %s', (_name, models) => {
    expect(exportUmlXmi(materializeAndRead(models)).text).toBe(
      exportUmlXmi(models).text
    );
  });

  /**
   * The specific arithmetic the byte comparison above is a proxy for.
   *
   * The materializer moves the whole drawing down by the heading band plus the
   * plot inset before it places a box; a message's height has to move with it,
   * because the height is divided against the PLACED column to give the
   * endpoint's relative position. Left untranslated it lands `dy` too high —
   * above the head on the first few messages, which clamps them all to the same
   * fraction and ties the conversation.
   */
  it('moves every message down by the very offset the boxes moved by', () => {
    const [read] = materializeAndRead([synthetic]);
    const drawn = read.interactions[0];
    const original = synthetic.interactions[0];

    // What the materializer translated the drawing by, measured off a column
    // rather than restated: the heading band plus the plot inset.
    const dy = drawn.lifelines[0].bounds!.y - original.lifelines[0].bounds!.y;
    expect(dy).toBeGreaterThan(0);

    const heightOf = (messages: readonly UmlMessage[], label: string) =>
      messages.find(each => each.label === label)!.y;
    // The five arrows that run column to column. The sixth ends on the 24-unit
    // cross rather than on a 600-unit spine, so its height is the midpoint of
    // two very differently sized boxes and is not this arithmetic.
    for (const label of [
      'browse()',
      'openBasket()',
      'basket',
      'checkout()',
      'no basket',
    ]) {
      expect(
        heightOf(drawn.messages, label) - heightOf(original.messages, label),
        label
      ).toBeCloseTo(dy);
    }
  });

  /**
   * §17.6.4's guard, on the canvas and in the file.
   *
   * The author types the brackets — the renderer prints what is typed, and
   * §17.6.4.4 prints a condition in brackets — so the board holds `[x > 0]`,
   * the writers strip exactly one pair, and the file says `alt [x > 0]`. The
   * failure this pins is the one an extra pair makes: `alt [[x > 0]]`.
   */
  it('writes the guards in brackets and exports them in one pair', () => {
    const board = boardOf([synthetic]);
    const [fragment] = board.filter(
      element => element.type === 'umlFragment'
    ) as (UmlSourceElement & { operands?: { name?: string }[] })[];

    expect(fragment.operands?.map(operand => operand.name)).toEqual([
      '[basket is not empty]',
      '[basket is empty]',
    ]);
    // …and the declared guard is EMPTY on a split fragment: its bands hold the
    // conditions, and the two labels share one corner (`background.ts`).
    expect(fragment.name).toBe('');

    const text = exportUmlPlantuml(materializeAndRead([synthetic])).text;
    expect(text).toContain('alt [basket is not empty]');
    expect(text).toContain('else [basket is empty]');
    expect(text).not.toContain('[[');
  });

  /**
   * An UNSPLIT fragment keeps its one guard in `name`, in brackets — and a
   * guard typed without them exports identically, because the strip is tolerant
   * in both directions.
   */
  it('brackets an unsplit guard, and tolerates one typed without', () => {
    const opt = (guard: string): UmlModel => ({
      ...emptyModel('sd2', 'sd', 'Checkout'),
      interactions: [
        {
          id: 'sd2',
          name: 'Checkout',
          lifelines: [
            { ...node('l1', 'Customer'), bounds: umlSequenceColumn(0, 400) },
            { ...node('l2', 'web'), bounds: umlSequenceColumn(1, 400) },
          ],
          messages: [
            message(
              'm1',
              'message-sync',
              'l1',
              'l2',
              'pay()',
              umlSequenceSlot(1)
            ),
          ],
          fragments: [
            {
              ...node('f1', guard),
              operator: 'opt',
              operands: [
                { guard, y0: umlSequenceSlot(0), y1: umlSequenceSlot(2) },
              ],
              coveredLifelineIds: ['l1', 'l2'],
              bounds: umlSequenceFragment(
                [umlSequenceColumn(0, 400), umlSequenceColumn(1, 400)],
                umlSequenceSlot(0),
                umlSequenceSlot(2)
              ),
            },
          ],
          executions: [],
          destructions: [],
        },
      ],
    });

    const [drawn] = boardOf([opt('basket is not empty')]).filter(
      element => element.type === 'umlFragment'
    );
    expect(drawn.name).toBe('[basket is not empty]');
    expect(drawn.operands).toBeUndefined();

    for (const typed of ['basket is not empty', '[basket is not empty]']) {
      const text = exportUmlPlantuml(materializeAndRead([opt(typed)])).text;
      expect(text, typed).toContain('opt [basket is not empty]');
      expect(text, typed).not.toContain('[[');
    }
  });
});
