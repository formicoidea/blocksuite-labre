import { describe, expect, it } from 'vitest';

import { exportUmlPlantuml } from '../export';
import { parseOperation, parseProperty } from '../grammar';
import { stereotypesOf } from '../keywords';
import type {
  UmlClassifier,
  UmlModel,
  UmlNodeBase,
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
