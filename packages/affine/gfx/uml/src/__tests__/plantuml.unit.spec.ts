import { describe, expect, it } from 'vitest';

import { exportUmlPlantuml } from '../export';
import { parseOperation, parseProperty } from '../grammar';
import {
  umlSequenceColumn,
  umlSequenceExecution,
  umlSequenceFragment,
  umlSequenceSlot,
} from '../import';
import { stereotypesOf } from '../keywords';
import type {
  UmlClassifier,
  UmlComponentNode,
  UmlMessage,
  UmlMessageKind,
  UmlModel,
  UmlNodeBase,
  UmlPort,
  UmlRelation,
  UmlRelationKind,
} from '../model';
import { exportPlantuml, toPlantumlAlias, toPlantumlLabel } from '../plantuml';

/**
 * The PlantUML writer.
 *
 * EXACT BYTES, for the reason `c4/export.unit.spec.ts` asserts them of mermaid:
 * PlantUML is a LINE-oriented language where the indentation, the declaration
 * order and the position of every arrow are the format, and where the only
 * oracle that matters is whether plantuml.com draws the picture. A golden
 * document is therefore the honest assertion — it is what a reviewer pastes into
 * the renderer.
 *
 * The fixtures are model literals rather than a canvas: the writer is a pure
 * function of the IR, and building a surface to test it would be testing
 * `model.ts` twice. The small factories are this file's own, not shared with the
 * XMI spec, so that a change made for one format cannot quietly re-aim the
 * other's fixture.
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

/**
 * A component diagram: two components — one with a port and both kinds of
 * interface — and the artefact that manifests it (§11.6.4, §19.3.4).
 *
 * The two components provide the same interface NAME on purpose: a `.puml` is a
 * picture and the picture has one circle, so the writer declares one alias and
 * draws two realizations onto it. That is where it parts company with the XMI
 * writer, which mints an Interface per lollipop — and the divergence is the
 * formats', not a disagreement about the drawing.
 */
function componentDiagram(): UmlModel {
  const port: UmlPort = {
    ...node('p1', 'http', { x: 292, y: 140, w: 16, h: 16 }),
    ownerId: 'k1',
  };
  const cart: UmlComponentNode = {
    ...node('k1', '«component»\nCart', { x: 100, y: 100, w: 200, h: 120 }),
    ports: [port],
    provided: ['IOrder'],
    required: ['IPayment'],
  };
  const catalogue: UmlComponentNode = {
    ...node('k2', '«component»\nCatalogue', { x: 500, y: 100, w: 200, h: 120 }),
    ports: [],
    provided: ['IOrder'],
    required: [],
  };
  return {
    ...emptyModel('d3', 'cmp', 'Storefront components'),
    components: [cart, catalogue],
    ports: [port],
    artifacts: [
      node('f1', '«artifact»\ncart.jar', { x: 100, y: 320, w: 200, h: 120 }),
    ],
    relations: [
      relation('manifest', 'f1', 'k1'),
      relation('dependency', 'k1', 'k2'),
    ],
  };
}

/** A deployment diagram: the three cubes, a deployment and a network link. */
function deploymentDiagram(): UmlModel {
  return {
    ...emptyModel('d4', 'dep', 'Production'),
    artifacts: [
      node('f1', '«artifact»\ncart.jar', { x: 100, y: 400, w: 200, h: 120 }),
    ],
    nodes: [
      {
        ...node('n1', '«device»\nAppServer', {
          x: 100,
          y: 100,
          w: 220,
          h: 160,
        }),
        kind: 'device',
      },
      {
        ...node('n2', '«executionEnvironment»\nTomcat', {
          x: 140,
          y: 140,
          w: 140,
          h: 80,
        }),
        kind: 'execution-environment',
      },
      {
        ...node('n3', '«legacy»\nDBServer', { x: 600, y: 100, w: 220, h: 160 }),
        kind: 'node',
      },
    ],
    relations: [
      relation('deploy', 'f1', 'n1'),
      relation('communication-path', 'n1', 'n3', 'LAN'),
    ],
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
      relation('composition', 'c1', 'c2', '1..*'),
      relation('generalization', 'c2', 'c1'),
      relation('realization', 'c1', 'i1'),
      relation('dependency', 'c1', 'e1', '«use»'),
      relation('anchor', 'n1', 'c1'),
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
      relation('association', 'a1', 'u1'),
      relation('include', 'u1', 'u2'),
    ],
  };
}

/* ── The goldens ──────────────────────────────────────────────────────── */

const CLASS_GOLDEN = `@startuml
title class Orders

package "Domain" as domain {
  abstract class "Order" as order {
    + id : String
    - lines : OrderLine [1..*]
    + place() : Boolean
  }
  class "OrderLine" as orderline {
    + quantity : Integer
  }
}
interface "Payable" as payable {
  + pay() : Boolean
}
enum "Status" as status {
  NEW
  PAID
}
object "order1 : Order" as order1 {
  quantity = 3
}
note as note1
  Totals are net of tax.
end note

order *-- orderline : 1..*
order <|-- orderline
payable <|.. order
order ..> status : «use»
note1 .. order
@enduml
`;

const USE_CASE_GOLDEN = `@startuml
title uc Storefront

actor "Customer" as customer
rectangle "Shop" as shop {
  usecase "Place order" as place_order
  usecase "Check stock" as check_stock
}

customer -- place_order
place_order ..> check_stock : <<include>>
@enduml
`;

const COMPONENT_GOLDEN = `@startuml
title cmp Storefront components

component "Cart" as cart
component "Catalogue" as catalogue
artifact "cart.jar" as cart_jar
interface "IOrder" as iorder
interface "IPayment" as ipayment

iorder <|.. cart
cart ..> ipayment : <<use>>
iorder <|.. catalogue
cart_jar ..> cart : <<manifest>>
cart ..> catalogue
@enduml
`;

const DEPLOYMENT_GOLDEN = `@startuml
title dep Production

artifact "cart.jar" as cart_jar
node "AppServer" as appserver <<device>>
node "Tomcat" as tomcat <<executionEnvironment>>
node "DBServer" as dbserver <<legacy>>

cart_jar ..> appserver : <<deploy>>
appserver -- dbserver : LAN
@enduml
`;

/* ── Tests ────────────────────────────────────────────────────────────── */

describe('an alias', () => {
  it('is derived from the name, so a relation line can be read', () => {
    expect(toPlantumlAlias('Order Line')).toBe('order_line');
    expect(toPlantumlAlias('Créance')).toBe('cr_ance');
  });

  it('never opens on a digit and is never empty', () => {
    // A bare identifier that starts with a digit is a lexer error; `e_` keeps
    // two names one digit apart one character apart.
    expect(toPlantumlAlias('1st pass')).toBe('e_1st_pass');
    expect(toPlantumlAlias('—')).toBe('e');
  });
});

describe('a label', () => {
  it('carries a two-line name as PlantUML’s own escape', () => {
    // A declaration is one line and a canvas label routinely is not.
    expect(toPlantumlLabel('Order\nRepository')).toBe('Order\\nRepository');
  });

  it('replaces a double quote, which the grammar cannot escape', () => {
    expect(toPlantumlLabel('the "big" one')).toBe("the 'big' one");
  });
});

describe('a class diagram', () => {
  const source = exportPlantuml(classDiagram());

  it('is the golden document, byte for byte', () => {
    expect(source).toBe(CLASS_GOLDEN);
  });

  it('writes no skinparam', () => {
    // A skinparam is a THEME, and a theme baked into an exported file overrides
    // whatever the repository it lands in has decided about its diagrams.
    expect(source).not.toContain('skinparam');
  });

  it('nests a class drawn inside a package', () => {
    // §12.2.4: on a UML diagram this is not layout, it is the statement.
    expect(source).toContain('package "Domain" as domain {');
    expect(source).toContain('  abstract class "Order" as order {');
  });

  it('writes an inheritance arrow right to left', () => {
    // `A <|-- B` reads "B is an A", so the SPECIFIC classifier — which the role
    // table makes the source — goes on the right. Backwards here would render
    // every hierarchy upside down.
    expect(source).toContain('order <|-- orderline');
    expect(source).toContain('payable <|.. order');
  });

  it('draws the diamond at the whole, which is the source', () => {
    expect(source).toContain('order *-- orderline : 1..*');
  });

  it('keeps a member line exactly as it was typed', () => {
    // PlantUML's member syntax IS §9.5.4's notation, so re-spelling a parsed
    // property could only lose what the parser did not model.
    expect(source).toContain('    - lines : OrderLine [1..*]');
  });
});

describe('a use case diagram', () => {
  const source = exportPlantuml(useCaseDiagram());

  it('is the golden document, byte for byte', () => {
    expect(source).toBe(USE_CASE_GOLDEN);
  });

  it('puts the cases drawn inside the subject in its rectangle', () => {
    expect(source).toContain('rectangle "Shop" as shop {');
  });

  it('labels an include with its keyword', () => {
    expect(source).toContain('place_order ..> check_stock : <<include>>');
  });
});

describe('a component diagram', () => {
  const source = exportPlantuml(componentDiagram());

  it('is the golden document, byte for byte', () => {
    expect(source).toBe(COMPONENT_GOLDEN);
  });

  it('declares a lollipop as a realization and a socket as a usage', () => {
    // §10.4.4: the ball IS an InterfaceRealization and the socket IS a Usage,
    // and Figure 10.11 draws both with the rectangle notation this writer uses.
    // The `-(` / `)-` operators are newer and their spelling has moved; these
    // two arrows parse in every version of the renderer.
    expect(source).toContain('interface "IOrder" as iorder');
    expect(source).toContain('iorder <|.. cart');
    expect(source).toContain('cart ..> ipayment : <<use>>');
  });

  it('declares one interface per NAME, however many balls draw it', () => {
    // An alias is an identifier: declaring `iorder` twice is a duplicate, and
    // the picture has one circle whatever the model says.
    expect(source.match(/^interface "IOrder"/gm)).toHaveLength(1);
    expect(source).toContain('iorder <|.. catalogue');
  });

  it('writes the two structural arrows with their keywords', () => {
    expect(source).toContain('cart_jar ..> cart : <<manifest>>');
  });

  it('does not repeat the keyword the declaration word already states', () => {
    // `component "Cart"` needs no `<<component>>` after it: the word IS the
    // statement, and repeating it would draw the keyword twice on the picture.
    expect(source).toContain('component "Cart" as cart\n');
    expect(source).not.toContain('<<component>>');
    expect(source).not.toContain('<<artifact>>');
  });

  it('drops the port, and says so nowhere else', () => {
    // The known omission the writer's header records: `port` inside a
    // `component … { }` block is a recent addition to the language. What the
    // port CARRIES is not lost — its lollipops are attributed to the component.
    expect(source).not.toContain('port');
    expect(source).not.toContain('http');
  });
});

describe('a deployment diagram', () => {
  const source = exportPlantuml(deploymentDiagram());

  it('is the golden document, byte for byte', () => {
    expect(source).toBe(DEPLOYMENT_GOLDEN);
  });

  it('declares every cube as a node, with the keyword as a stereotype', () => {
    // PlantUML has `node` and has no `device`, and it does not need one:
    // §19.4.4 itself draws a Device as "a Node graphic with the keyword
    // «device»", which is exactly this line.
    expect(source).toContain('node "AppServer" as appserver <<device>>');
    expect(source).toContain(
      'node "Tomcat" as tomcat <<executionEnvironment>>'
    );
    expect(source).toContain('node "DBServer" as dbserver <<legacy>>');
  });

  it('writes a deployment as the dashed arrow §19.4.4 offers', () => {
    // The alternative to nesting the artefact inside the cube, and the one a
    // line-oriented format can carry without reading geometry.
    expect(source).toContain('cart_jar ..> appserver : <<deploy>>');
  });

  it('writes a communication path as a plain association link', () => {
    // §19.4.4: "depicted using the same as normal Association links" — no head
    // at either end, because an association is undirected.
    expect(source).toContain('appserver -- dbserver : LAN');
  });
});

describe('several diagrams, and none', () => {
  it('writes one document per diagram', () => {
    // PlantUML renders ONE picture per `@startuml … @enduml`; two diagrams in
    // one file is two pictures, which is what every renderer expects.
    const { text } = exportUmlPlantuml([classDiagram(), useCaseDiagram()]);
    expect(text.match(/^@startuml$/gm)).toHaveLength(2);
    expect(text.match(/^@enduml$/gm)).toHaveLength(2);
  });

  it('writes the smallest document that still parses when nothing is selected', () => {
    expect(exportUmlPlantuml([]).text).toBe('@startuml\n@enduml\n');
  });
});

/* ── The behaviour sheets (§15.2.4, §14.2.4) ──────────────────────────── */

const behaviourNode = <K extends string>(id: string, kind: K, name = '') => ({
  id,
  name,
  keywords: [],
  isAbstract: false,
  kind,
});

/**
 * An activity with two swimlanes, a decision branching into a
 * named-guarded-weighted flow and an `else`, an object flow, the two signal
 * glyphs and both kinds of end.
 */
function activityDiagram(): UmlModel {
  const model = emptyModel('act-1', 'act', 'Fulfil an order');
  model.activities = [
    {
      id: 'act-1',
      name: 'Fulfil an order',
      nodes: [
        { ...behaviourNode('i', 'initial'), partitionId: 'lane-sales' },
        {
          ...behaviourNode('a', 'action', 'Take the order'),
          partitionId: 'lane-sales',
        },
        { ...behaviourNode('d', 'decision'), partitionId: 'lane-sales' },
        {
          ...behaviourNode('o', 'object-node', 'Order'),
          partitionId: 'lane-store',
        },
        {
          ...behaviourNode('b', 'action', 'Pick the goods'),
          partitionId: 'lane-store',
        },
        behaviourNode('s', 'send-signal', 'Order shipped'),
        behaviourNode('t', 'time-event', 'after 2 days'),
        behaviourNode('x', 'flow-final'),
        behaviourNode('z', 'activity-final'),
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
          orientation: 'horizontal',
          nodeIds: ['o', 'b'],
        },
      ],
    },
  ];
  return model;
}

/** A state machine with a composite state, a history inside it and a choice. */
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
          lines: ['submit [x > 0] / log()'],
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

/**
 * The golden ACTIVITY document.
 *
 * Written in PlantUML's STATE-DIAGRAM syntax, and the document says so in its
 * own comment lines rather than leaving a reader to work it out: the classic
 * activity syntax is deprecated upstream, and the new one is a structured BLOCK
 * language that cannot express an arbitrary graph — which is what a whiteboard
 * draws. What is lost is shape, never structure.
 */
const ACTIVITY_GOLDEN = `@startuml
title act Fulfil an order

' An activity (§15.2.4), written in PlantUML's state-diagram syntax:
' its structured activity syntax cannot express an arbitrary graph.
state "Sales" as sales <<partition>> {
  state "Take the order" as take_the_order
  state decision <<choice>>
}
state "Warehouse" as warehouse <<partition>> {
  state "Order" as order <<objectNode>>
  state "Pick the goods" as pick_the_goods
}
state "Order shipped" as order_shipped <<signal>>
state "after 2 days" as after_2_days <<time>>
state flow_final <<end>>

[*] --> take_the_order
take_the_order --> decision
decision --> pick_the_goods : ready [stock > 0] {weight = 2}
decision --> flow_final : [else]
take_the_order --> order
pick_the_goods --> order_shipped
after_2_days --> [*]
@enduml
`;

/** The golden STATE MACHINE document — the syntax's own home ground. */
const STATE_MACHINE_GOLDEN = `@startuml
title stm Order lifecycle

state "Draft" as draft
draft : entry / reserve()
draft : do / poll()
draft : exit / release()
draft : submit [x > 0] / log()
state choice <<choice>>
state "Running" as running {
  state "Placed" as placed
  state shallow_history <<history>>
}

[*] --> draft
draft --> choice : submit, after 5 s [stock > 0] / reserve()
choice --> placed : [ok]
placed --> [*] : close
shallow_history --> placed
@enduml
`;

describe('an activity diagram', () => {
  const puml = exportPlantuml(activityDiagram());

  it('says in the document which syntax it is written in', () => {
    expect(puml).toContain(
      "' An activity (§15.2.4), written in PlantUML's state-diagram syntax:"
    );
  });

  it('writes the disc and the bullseye as PlantUML’s own terminal marker', () => {
    // `[*]` is CONTEXTUAL: the source of an arrow draws the filled disc, the
    // target draws the bullseye — which is exactly what §15.3.4 means by the two
    // glyphs, so neither is ever declared.
    expect(puml).toContain('[*] --> take_the_order');
    expect(puml).toContain('after_2_days --> [*]');
    expect(puml).not.toContain('as initial');
  });

  it('borrows the stereotype PlantUML draws, and keeps the word when it draws none', () => {
    expect(puml).toContain('state decision <<choice>>');
    expect(puml).toContain('state flow_final <<end>>');
    // An unknown stereotype renders as the word itself under the name, which is
    // strictly better than borrowing a shape that means something else.
    expect(puml).toContain('state "Order" as order <<objectNode>>');
    expect(puml).toContain('state "Order shipped" as order_shipped <<signal>>');
    expect(puml).toContain('state "after 2 days" as after_2_days <<time>>');
  });

  it('draws each swimlane as a box round the actions it holds', () => {
    // An approximation, and the nearest one PlantUML has: a state diagram has no
    // lane, and a box keeps the fact §15.6.4's band states — who is responsible.
    expect(puml).toContain('state "Sales" as sales <<partition>> {');
    expect(puml).toContain('  state "Take the order" as take_the_order');
    // …and the flows still cross freely, because every arrow is at the top
    // level.
    expect(puml).toContain('decision --> pick_the_goods');
  });

  it('writes §15.2.4’s three annotations back in the notation’s own syntax', () => {
    expect(puml).toContain(
      'decision --> pick_the_goods : ready [stock > 0] {weight = 2}'
    );
    expect(puml).toContain('decision --> flow_final : [else]');
  });

  it('is the golden activity document, byte for byte', () => {
    expect(puml).toBe(ACTIVITY_GOLDEN);
  });
});

describe('a state machine diagram', () => {
  const puml = exportPlantuml(stateMachineDiagram());

  it('needs no comment line: this IS the syntax for a state machine', () => {
    expect(puml).not.toContain("' An activity");
  });

  it('writes §14.2.4.4’s internal activities as PlantUML’s own state lines', () => {
    expect(puml).toContain('draft : entry / reserve()');
    expect(puml).toContain('draft : do / poll()');
    expect(puml).toContain('draft : exit / release()');
    // …and the internal TRANSITION the author wrote, kept verbatim rather than
    // dropped.
    expect(puml).toContain('draft : submit [x > 0] / log()');
  });

  it('writes the composite state as a block, with its vertices inside', () => {
    expect(puml).toContain('state "Running" as running {');
    expect(puml).toContain('  state "Placed" as placed');
    expect(puml).toContain('  state shallow_history <<history>>');
  });

  it('writes §14.2.4.8’s label back in the BNF’s own order', () => {
    expect(puml).toContain(
      'draft --> choice : submit, after 5 s [stock > 0] / reserve()'
    );
    expect(puml).toContain('choice --> placed : [ok]');
    expect(puml).toContain('placed --> [*] : close');
  });

  it('is the golden state machine document, byte for byte', () => {
    expect(puml).toBe(STATE_MACHINE_GOLDEN);
  });
});

/* ── §11.5.4's per-end adornments (ADR 0020) ──────────────────────────── */

describe('the labels beside an arrow’s two ends', () => {
  const two = (
    ends: Partial<UmlRelation>,
    kind: UmlRelationKind = 'association'
  ) =>
    exportPlantuml({
      ...emptyModel('d1', 'class', 'Orders'),
      classifiers: [
        classifier('c1', 'class', 'Order', { x: 0, y: 0, w: 200, h: 120 }),
        classifier('c2', 'class', 'OrderLine', {
          x: 400,
          y: 0,
          w: 200,
          h: 120,
        }),
      ],
      relations: [{ ...relation(kind, 'c1', 'c2'), ...ends }],
    });

  it('writes each one quoted, on its own side of the arrow', () => {
    expect(
      two({
        sourceEnd: { multiplicity: { lower: 1, upper: 1 }, raw: '1' },
        targetEnd: {
          multiplicity: { lower: 0, upper: '*' },
          role: 'items',
          raw: '0..* items',
        },
      })
    ).toContain('order "1" -- "0..* items" orderline');
  });

  it('writes one side alone when only one end is adorned', () => {
    expect(
      two({
        targetEnd: { multiplicity: { lower: 0, upper: '*' }, raw: '0..*' },
      })
    ).toContain('order -- "0..*" orderline');
    expect(
      two({ sourceEnd: { multiplicity: { lower: 1, upper: 1 }, raw: '1' } })
    ).toContain('order "1" -- orderline');
  });

  it('writes them on both aggregation flavours and a communication path', () => {
    const ends: Partial<UmlRelation> = {
      sourceEnd: { multiplicity: { lower: 1, upper: 1 }, raw: '1' },
      targetEnd: { multiplicity: { lower: 0, upper: '*' }, raw: '0..*' },
    };
    expect(two(ends, 'aggregation')).toContain(
      'order "1" o-- "0..*" orderline'
    );
    expect(two(ends, 'composition')).toContain(
      'order "1" *-- "0..*" orderline'
    );
    expect(two(ends, 'communication-path')).toContain(
      'order "1" -- "0..*" orderline'
    );
  });

  it('keeps the centre label after the arrow, where it always was', () => {
    expect(
      two({
        label: 'places',
        sourceEnd: { multiplicity: { lower: 1, upper: 1 }, raw: '1' },
      })
    ).toContain('order "1" -- orderline : places');
  });

  it('writes the bare alias for a relationship §11.5.4 does not adorn', () => {
    // A generalization's ends take no multiplicity, so the writer is handed
    // none — the raw text stays on the board and out of the file.
    expect(two({ sourceEnd: { raw: '1' } }, 'generalization')).toContain(
      'orderline <|-- order'
    );
  });

  it('cannot be closed early by a quote the author typed', () => {
    // The quote is PlantUML's own delimiter; `toPlantumlLabel` turns one in the
    // text into an apostrophe, so a label can never unbalance the line.
    expect(two({ sourceEnd: { role: 'a "b"', raw: 'a "b"' } })).toContain(
      `order "a 'b'" -- orderline`
    );
  });
});

/* ── §17 — the sequence sheet ─────────────────────────────────────────── */

/**
 * One conversation with one of everything §17 draws: three participants (one of
 * them an actor and one carrying a type), all five arrows, a bar, a cross, an
 * `alt` with two guarded operands and a `ref` inside the first of them.
 *
 * The heights are the invented layout's own slots, one per EVENT — which is
 * what the two sequence importers write and what makes the order the writer
 * emits reproducible: see `umlSequenceSlot`.
 */
function sequenceDiagram(): UmlModel {
  const column = [0, 1, 2].map(index => umlSequenceColumn(index, 600));
  const at = (slot: number) => umlSequenceSlot(slot);
  const say = (
    id: string,
    kind: UmlMessageKind,
    sourceId: string,
    targetId: string,
    label: string,
    slot: number
  ): UmlMessage => ({ id, kind, sourceId, targetId, label, y: at(slot) });

  return {
    ...emptyModel('sd1', 'sd', 'Checkout'),
    interactions: [
      {
        id: 'sd1',
        name: 'Checkout',
        lifelines: [
          { ...node('l1', 'Customer'), keywords: ['actor'], bounds: column[0] },
          { ...node('l2', 'web'), type: 'Storefront', bounds: column[1] },
          { ...node('l3', 'orders'), bounds: column[2] },
        ],
        messages: [
          say('m1', 'message-sync', 'l1', 'l2', 'browse()', 0),
          say('m2', 'message-async', 'l2', 'l3', 'openBasket()', 2),
          say('m3', 'message-reply', 'l3', 'l2', 'basket', 3),
          say('m4', 'message-create', 'l2', 'l3', 'new()', 6),
          say('m5', 'message-delete', 'l2', 'd1', 'close()', 9),
        ],
        fragments: [
          {
            ...node('f1', 'signed in'),
            operator: 'alt',
            operands: [
              { guard: 'signed in', y0: at(4), y1: at(7) },
              { guard: 'else', y0: at(7), y1: at(8) },
            ],
            coveredLifelineIds: ['l2', 'l3'],
            bounds: umlSequenceFragment([column[1], column[2]], at(4), at(8)),
          },
          {
            ...node('f2', 'Authorise payment'),
            operator: 'ref',
            operands: [{ y0: at(5), y1: at(6) }],
            coveredLifelineIds: ['l2', 'l3'],
            bounds: umlSequenceFragment([column[1], column[2]], at(5), at(6)),
          },
        ],
        executions: [
          {
            ...node('x1', ''),
            lifelineId: 'l2',
            y0: at(1),
            y1: at(10),
            bounds: umlSequenceExecution(column[1], at(1), at(10)),
          },
        ],
        destructions: [{ ...node('d1', ''), lifelineId: 'l3', y: at(11) }],
      },
    ],
  };
}

describe('a sequence diagram, as PlantUML', () => {
  const text = exportUmlPlantuml([sequenceDiagram()]).text;

  it('declares the participants before the conversation, in column order', () => {
    expect(text).toContain('actor "Customer" as customer');
    expect(text).toContain('participant "web : Storefront" as web');
    expect(text).toContain('participant "orders" as orders');
    expect(text.indexOf('participant "orders" as orders')).toBeLessThan(
      text.indexOf('customer -> web')
    );
  });

  it('spells §17.4.4 five arrows with the five PlantUML forms', () => {
    expect(text).toContain('customer -> web : browse()');
    expect(text).toContain('web ->> orders : openBasket()');
    expect(text).toContain('orders --> web : basket');
    expect(text).toContain('create orders');
    expect(text).toContain('destroy orders');
  });

  it('opens a block per fragment and closes it, with the guards bracketed', () => {
    expect(text).toContain('alt [signed in]');
    expect(text).toContain('else [else]');
    expect(text).toContain('ref over web, orders : Authorise payment');
    expect(text.match(/^end$/gm)).toHaveLength(1);
  });

  it('writes the bar as PlantUML own activation pair', () => {
    expect(text).toContain('activate web');
    expect(text).toContain('deactivate web');
    expect(text.indexOf('activate web')).toBeLessThan(
      text.indexOf('deactivate web')
    );
  });
});
