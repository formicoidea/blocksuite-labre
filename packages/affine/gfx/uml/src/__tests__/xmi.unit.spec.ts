/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';

import { parseOperation, parseProperty } from '../grammar';
import { stereotypesOf } from '../keywords';
import type {
  UmlClassifier,
  UmlModel,
  UmlNodeBase,
  UmlRelation,
  UmlRelationKind,
} from '../model';
import { UML_NAMESPACE, XMI_NAMESPACE, XMI_VERSION, exportXmi } from '../xmi';

/**
 * The XMI 2.5.1 writer.
 *
 * ## Two oracles, and only one of them is the golden
 *
 * The golden document is here for the reason `c4/export.unit.spec.ts` keeps
 * one — it is what a reviewer reads, and a diff against it is the change stated
 * in the units the format is written in. But an XML document is a tree, and
 * whether a tool can OPEN it is not a question about bytes. So the golden is
 * pinned beside the assertion that actually matters: the document is parsed back
 * with a real `DOMParser`, every `xmi:id` is unique, and every reference in it —
 * `xmi:idref`, `general`, `memberEnd`, `client`, `supplier`, `type`,
 * `annotatedElement`, `addition`, `extendedCase`, `contract`, `classifier` —
 * resolves to an id the file declares. A dangling reference is the one defect
 * every importer turns into a silent, partial model.
 *
 * ## The fixtures are literals
 *
 * A model, not a surface: the writer is a pure function of the IR, and building
 * a canvas to test it would be testing `model.ts` twice. The two small factories
 * below run the real grammar over real compartment text, so the properties and
 * operations under test are the ones a canvas produces.
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
  operations: string[] = [],
  bounds?: Box
): UmlClassifier {
  const base = node(id, name, bounds);
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
  name: string,
  bounds?: Box
): UmlModel {
  return {
    diagram: {
      id,
      kind,
      name,
      heading: `${kind} ${name}`,
      ...(bounds ? { bounds } : {}),
    },
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

/**
 * A class diagram with one of everything the writer has a rule for: three
 * classes (one abstract, one specialising another), an interface it realizes, an
 * enumeration it depends on, and four flavours of line between them.
 */
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

/** A use case diagram: two actors, three cases, include, extend, a subject. */
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
      relation('association', 'a2', 'u1'),
    ],
  };
}

/** The second actor, drawn OUTSIDE the subject — added after the fact. */
function withSecondActor(model: UmlModel): UmlModel {
  return {
    ...model,
    actors: [
      ...model.actors,
      node('a2', 'Stock system', { x: 0, y: 400, w: 80, h: 120 }),
    ],
  };
}

/* ── The golden ───────────────────────────────────────────────────────── */

const GOLDEN = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmi:version="20131001" xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.omg.org/spec/UML/20161101" xmi:id="_1" name="Shop">
  <packagedElement xmi:type="uml:Package" xmi:id="_2" name="Orders">
    <packagedElement xmi:type="uml:Class" xmi:id="_3" name="Order" isAbstract="true">
      <ownedAttribute xmi:type="uml:Property" xmi:id="_17" name="id" visibility="public">
        <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20161101/PrimitiveTypes.xmi#String"/>
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="_20" name="lines" visibility="private">
        <type xmi:idref="_4"/>
        <lowerValue xmi:type="uml:LiteralInteger" xmi:id="_18" value="1"/>
        <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="_19" value="*"/>
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="_22" name="total" isDerived="true">
        <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20161101/PrimitiveTypes.xmi#Real"/>
        <defaultValue xmi:type="uml:LiteralInteger" xmi:id="_21" value="0"/>
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="_23" name="count" visibility="public" isStatic="true">
        <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20161101/PrimitiveTypes.xmi#Integer"/>
      </ownedAttribute>
      <ownedOperation xmi:type="uml:Operation" xmi:id="_26" name="place" visibility="public">
        <ownedParameter xmi:type="uml:Parameter" xmi:id="_24" name="when" direction="in">
          <type xmi:idref="_16"/>
        </ownedParameter>
        <ownedParameter xmi:type="uml:Parameter" xmi:id="_25" direction="return">
          <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20161101/PrimitiveTypes.xmi#Boolean"/>
        </ownedParameter>
      </ownedOperation>
      <ownedOperation xmi:type="uml:Operation" xmi:id="_27" name="audit" visibility="protected" isQuery="true"/>
      <interfaceRealization xmi:type="uml:InterfaceRealization" xmi:id="_28" client="_3" supplier="_6" contract="_6"/>
    </packagedElement>
    <packagedElement xmi:type="uml:Class" xmi:id="_4" name="OrderLine">
      <ownedAttribute xmi:type="uml:Property" xmi:id="_29" name="quantity" visibility="public">
        <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20161101/PrimitiveTypes.xmi#Integer"/>
      </ownedAttribute>
    </packagedElement>
    <packagedElement xmi:type="uml:Class" xmi:id="_5" name="PriorityOrder">
      <generalization xmi:type="uml:Generalization" xmi:id="_30" general="_3"/>
    </packagedElement>
    <packagedElement xmi:type="uml:Interface" xmi:id="_6" name="Payable">
      <ownedOperation xmi:type="uml:Operation" xmi:id="_32" name="pay" visibility="public">
        <ownedParameter xmi:type="uml:Parameter" xmi:id="_31" direction="return">
          <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20161101/PrimitiveTypes.xmi#Boolean"/>
        </ownedParameter>
      </ownedOperation>
    </packagedElement>
    <packagedElement xmi:type="uml:Enumeration" xmi:id="_7" name="Status">
      <ownedLiteral xmi:type="uml:EnumerationLiteral" xmi:id="_33" name="NEW"/>
      <ownedLiteral xmi:type="uml:EnumerationLiteral" xmi:id="_34" name="PAID"/>
    </packagedElement>
    <packagedElement xmi:type="uml:Association" xmi:id="_35" name="replaces" memberEnd="_36 _37">
      <ownedEnd xmi:type="uml:Property" xmi:id="_36" association="_35">
        <type xmi:idref="_5"/>
      </ownedEnd>
      <ownedEnd xmi:type="uml:Property" xmi:id="_37" association="_35">
        <type xmi:idref="_3"/>
      </ownedEnd>
    </packagedElement>
    <packagedElement xmi:type="uml:Association" xmi:id="_38" memberEnd="_39 _40">
      <ownedEnd xmi:type="uml:Property" xmi:id="_39" association="_38">
        <type xmi:idref="_3"/>
      </ownedEnd>
      <ownedEnd xmi:type="uml:Property" xmi:id="_40" association="_38" aggregation="composite">
        <type xmi:idref="_4"/>
      </ownedEnd>
    </packagedElement>
    <packagedElement xmi:type="uml:Association" xmi:id="_41" memberEnd="_42 _43">
      <ownedEnd xmi:type="uml:Property" xmi:id="_42" association="_41">
        <type xmi:idref="_5"/>
      </ownedEnd>
      <ownedEnd xmi:type="uml:Property" xmi:id="_43" association="_41" aggregation="shared">
        <type xmi:idref="_4"/>
      </ownedEnd>
    </packagedElement>
    <packagedElement xmi:type="uml:Usage" xmi:id="_44" name="«use»" client="_3" supplier="_7"/>
    <ownedComment xmi:type="uml:Comment" xmi:id="_8" annotatedElement="_3" body="Totals are net of tax."/>
    <xmi:Extension extender="labre">
      <diagram kind="class"/>
    </xmi:Extension>
  </packagedElement>
  <packagedElement xmi:type="uml:Package" xmi:id="_9" name="Storefront">
    <packagedElement xmi:type="uml:Actor" xmi:id="_10" name="Customer"/>
    <packagedElement xmi:type="uml:Actor" xmi:id="_11" name="Stock system"/>
    <packagedElement xmi:type="uml:Component" xmi:id="_15" name="Shop">
      <ownedUseCase xmi:type="uml:UseCase" xmi:id="_12" name="Place order">
        <include xmi:type="uml:Include" xmi:id="_45" addition="_13"/>
      </ownedUseCase>
      <ownedUseCase xmi:type="uml:UseCase" xmi:id="_13" name="Check stock"/>
      <ownedUseCase xmi:type="uml:UseCase" xmi:id="_14" name="Apply discount">
        <extend xmi:type="uml:Extend" xmi:id="_46" extendedCase="_12"/>
      </ownedUseCase>
    </packagedElement>
    <packagedElement xmi:type="uml:Association" xmi:id="_47" memberEnd="_48 _49">
      <ownedEnd xmi:type="uml:Property" xmi:id="_48" association="_47">
        <type xmi:idref="_10"/>
      </ownedEnd>
      <ownedEnd xmi:type="uml:Property" xmi:id="_49" association="_47">
        <type xmi:idref="_12"/>
      </ownedEnd>
    </packagedElement>
    <packagedElement xmi:type="uml:Association" xmi:id="_50" memberEnd="_51 _52">
      <ownedEnd xmi:type="uml:Property" xmi:id="_51" association="_50">
        <type xmi:idref="_11"/>
      </ownedEnd>
      <ownedEnd xmi:type="uml:Property" xmi:id="_52" association="_50">
        <type xmi:idref="_12"/>
      </ownedEnd>
    </packagedElement>
    <xmi:Extension extender="labre">
      <diagram kind="uc"/>
    </xmi:Extension>
  </packagedElement>
  <packagedElement xmi:type="uml:DataType" xmi:id="_16" name="Date"/>
</uml:Model>
`;

/* ── Well-formedness ──────────────────────────────────────────────────── */

/** Every attribute in the document that is a reference, and what it points at. */
const REFERENCE_ATTRS = [
  'xmi:idref',
  'general',
  'client',
  'supplier',
  'contract',
  'type',
  'association',
  'addition',
  'extendedCase',
  'classifier',
];

/** Attributes that hold a SPACE-SEPARATED list of ids. */
const REFERENCE_LISTS = ['memberEnd', 'annotatedElement'];

function parsed(xml: string): Document {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  expect(document.querySelector('parsererror')).toBeNull();
  return document;
}

function idsOf(document: Document): Set<string> {
  const ids = new Set<string>();
  for (const element of document.querySelectorAll('*')) {
    const id = element.getAttribute('xmi:id');
    if (id === null) continue;
    // Uniqueness is not a nicety: two elements under one id is a model an
    // importer resolves to whichever it saw last.
    expect(ids.has(id)).toBe(false);
    ids.add(id);
  }
  return ids;
}

function danglingReferences(document: Document): string[] {
  const ids = idsOf(document);
  const dangling: string[] = [];
  for (const element of document.querySelectorAll('*')) {
    for (const attribute of REFERENCE_ATTRS) {
      const value = element.getAttribute(attribute);
      if (value && !ids.has(value)) dangling.push(`${attribute}="${value}"`);
    }
    for (const attribute of REFERENCE_LISTS) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      for (const id of value.split(' ')) {
        if (!ids.has(id)) dangling.push(`${attribute}~"${id}"`);
      }
    }
  }
  return dangling;
}

/* ── Tests ────────────────────────────────────────────────────────────── */

describe('the document', () => {
  const xml = exportXmi([classDiagram(), withSecondActor(useCaseDiagram())], {
    name: 'Shop',
  });

  it('declares the XMI 2.5.1 and UML 2.5.1 namespaces', () => {
    // Getting these wrong is the difference between a file Papyrus opens and
    // one it refuses (UML 2.5.1 Annex E).
    const root = parsed(xml).documentElement;
    expect(root.tagName).toBe('uml:Model');
    expect(root.getAttribute('xmi:version')).toBe(XMI_VERSION);
    expect(root.getAttribute('xmlns:xmi')).toBe(XMI_NAMESPACE);
    expect(root.getAttribute('xmlns:uml')).toBe(UML_NAMESPACE);
    expect(root.getAttribute('name')).toBe('Shop');
  });

  it('parses, and every id in it is unique', () => {
    expect(idsOf(parsed(xml)).size).toBeGreaterThan(20);
  });

  it('has no dangling reference', () => {
    expect(danglingReferences(parsed(xml))).toEqual([]);
  });

  it('gives each diagram a package of its own', () => {
    // Four sheets of one architecture are four packages of one model, never one
    // namespace: merging them is the picture ADR 0017 refuses to draw.
    const packages = [...parsed(xml).documentElement.children].filter(
      child => child.getAttribute('xmi:type') === 'uml:Package'
    );
    expect(packages.map(node => node.getAttribute('name'))).toEqual([
      'Orders',
      'Storefront',
    ]);
  });

  it('carries no diagram interchange', () => {
    // Not one coordinate: UML's DI is a second metamodel, and a half-DI is a
    // promise the file cannot keep.
    expect(xml).not.toContain('ownedDiagram');
    expect(xml).not.toContain('<dc:');
    expect(xml).not.toContain('di:');
  });

  it('is the golden document, byte for byte', () => {
    expect(xml).toBe(GOLDEN);
  });
});

describe('a class diagram', () => {
  const xml = exportXmi([classDiagram()], { name: 'Orders' });
  const document = parsed(xml);
  const byName = (name: string) =>
    [...document.querySelectorAll('packagedElement')].find(
      element => element.getAttribute('name') === name
    )!;

  it('writes the metaclass the keyword states', () => {
    // `«interface»` in a box header is not a decoration on a class: it IS the
    // metaclass, and the writer says so in `xmi:type`.
    expect(byName('Payable').getAttribute('xmi:type')).toBe('uml:Interface');
    expect(byName('Status').getAttribute('xmi:type')).toBe('uml:Enumeration');
    expect(byName('Order').getAttribute('xmi:type')).toBe('uml:Class');
  });

  it('writes `{abstract}` as `isAbstract`', () => {
    expect(byName('Order').getAttribute('isAbstract')).toBe('true');
    expect(byName('OrderLine').getAttribute('isAbstract')).toBeNull();
  });

  it('types a property by href when it is a UML PrimitiveType', () => {
    const id = byName('Order').querySelector('ownedAttribute > type')!;
    expect(id.getAttribute('href')).toBe(
      'http://www.omg.org/spec/UML/20161101/PrimitiveTypes.xmi#String'
    );
  });

  it('types a property by idref when it names a classifier on the sheet', () => {
    const lines = [...byName('Order').querySelectorAll('ownedAttribute')].find(
      element => element.getAttribute('name') === 'lines'
    )!;
    expect(lines.querySelector('type')!.getAttribute('xmi:idref')).toBe(
      byName('OrderLine').getAttribute('xmi:id')
    );
  });

  it('writes a stated multiplicity and leaves an unstated one implicit', () => {
    const attributes = [...byName('Order').querySelectorAll('ownedAttribute')];
    const lines = attributes.find(a => a.getAttribute('name') === 'lines')!;
    expect(lines.querySelector('lowerValue')!.getAttribute('value')).toBe('1');
    expect(lines.querySelector('upperValue')!.getAttribute('value')).toBe('*');
    // `[1..1]` is what an omitted range MEANS (§9.5.4), so writing it would add
    // two elements that say what the absence already says.
    const id = attributes.find(a => a.getAttribute('name') === 'id')!;
    expect(id.querySelector('lowerValue')).toBeNull();
  });

  it('writes the derived slash and `{static}`', () => {
    const attributes = [...byName('Order').querySelectorAll('ownedAttribute')];
    expect(
      attributes
        .find(a => a.getAttribute('name') === 'total')!
        .getAttribute('isDerived')
    ).toBe('true');
    expect(
      attributes
        .find(a => a.getAttribute('name') === 'count')!
        .getAttribute('isStatic')
    ).toBe('true');
  });

  it('writes a return type as a parameter with `direction="return"`', () => {
    // UML has no separate slot for it, and a writer that invented one would
    // produce an operation whose result no importer can find.
    const place = [...byName('Order').querySelectorAll('ownedOperation')].find(
      element => element.getAttribute('name') === 'place'
    )!;
    const parameters = [...place.querySelectorAll('ownedParameter')];
    expect(parameters.map(p => p.getAttribute('direction'))).toEqual([
      'in',
      'return',
    ]);
    expect(parameters[0].getAttribute('name')).toBe('when');
  });

  it('writes `{query}` as `isQuery`', () => {
    const audit = [...byName('Order').querySelectorAll('ownedOperation')].find(
      element => element.getAttribute('name') === 'audit'
    )!;
    expect(audit.getAttribute('isQuery')).toBe('true');
  });

  it('writes an enumeration compartment as literals', () => {
    expect(
      [...byName('Status').querySelectorAll('ownedLiteral')].map(literal =>
        literal.getAttribute('name')
      )
    ).toEqual(['NEW', 'PAID']);
  });

  it('owns a generalization on the specific classifier', () => {
    const general = byName('PriorityOrder').querySelector('generalization')!;
    expect(general.getAttribute('general')).toBe(
      byName('Order').getAttribute('xmi:id')
    );
  });

  it('owns an interface realization on the implementing classifier', () => {
    const realization = byName('Order').querySelector('interfaceRealization')!;
    const payable = byName('Payable').getAttribute('xmi:id');
    expect(realization.getAttribute('supplier')).toBe(payable);
    expect(realization.getAttribute('contract')).toBe(payable);
  });

  it('puts the aggregation on the end typed by the PART', () => {
    // `Property::isComposite` says the object CONTAINING the attribute is the
    // container, so the flagged end is the one typed by the part — which is what
    // draws the diamond at the whole's end of the line in every tool.
    const associations = [
      ...document.querySelectorAll('packagedElement'),
    ].filter(node => node.getAttribute('xmi:type') === 'uml:Association');
    const composite = associations.find(node =>
      node.querySelector('ownedEnd[aggregation="composite"]')
    )!;
    const end = composite.querySelector('ownedEnd[aggregation="composite"]')!;
    expect(end.querySelector('type')!.getAttribute('xmi:idref')).toBe(
      byName('OrderLine').getAttribute('xmi:id')
    );
    const shared = associations.find(node =>
      node.querySelector('ownedEnd[aggregation="shared"]')
    )!;
    expect(
      shared
        .querySelector('ownedEnd[aggregation="shared"]')!
        .querySelector('type')!
        .getAttribute('xmi:idref')
    ).toBe(byName('OrderLine').getAttribute('xmi:id'));
  });

  it('names both ends of an association in `memberEnd`', () => {
    const association = [...document.querySelectorAll('packagedElement')].find(
      node => node.getAttribute('name') === 'replaces'
    )!;
    const ends = [...association.querySelectorAll('ownedEnd')].map(end =>
      end.getAttribute('xmi:id')
    );
    expect(association.getAttribute('memberEnd')).toBe(ends.join(' '));
  });

  it('writes a «use» dependency as a Usage', () => {
    // Table C.1 gives `use`, `call` and `create` the metamodel element Usage:
    // an arrow labelled «use» IS one, and a bare Dependency would throw away
    // the only thing the author said about it.
    const usage = [...document.querySelectorAll('packagedElement')].find(
      node => node.getAttribute('xmi:type') === 'uml:Usage'
    )!;
    expect(usage.getAttribute('client')).toBe(
      byName('Order').getAttribute('xmi:id')
    );
    expect(usage.getAttribute('supplier')).toBe(
      byName('Status').getAttribute('xmi:id')
    );
  });

  it('writes a note as a comment annotating what it is anchored to', () => {
    const comment = document.querySelector('ownedComment')!;
    expect(comment.getAttribute('body')).toBe('Totals are net of tax.');
    expect(comment.getAttribute('annotatedElement')).toBe(
      byName('Order').getAttribute('xmi:id')
    );
  });

  it('mints a DataType for a type name nothing on the sheet answers for', () => {
    // `Date` is named by an operation and drawn nowhere. Dropping it would hand
    // the importer an untyped parameter; the author typed a type, so the file
    // has one.
    const date = [...document.documentElement.children].find(
      node => node.getAttribute('name') === 'Date'
    )!;
    expect(date.getAttribute('xmi:type')).toBe('uml:DataType');
  });
});

describe('a use case diagram', () => {
  const xml = exportXmi([withSecondActor(useCaseDiagram())], {
    name: 'Storefront',
  });
  const document = parsed(xml);
  const byName = (name: string) =>
    [...document.querySelectorAll('*')].find(
      element => element.getAttribute('name') === name
    )!;

  it('nests the cases drawn inside the subject as its `ownedUseCase`s', () => {
    // §18.1.4: the subject is a Classifier and the cases in it are its own.
    const subject = byName('Shop');
    expect(subject.getAttribute('xmi:type')).toBe('uml:Component');
    expect(
      [...subject.querySelectorAll('ownedUseCase')].map(node =>
        node.getAttribute('name')
      )
    ).toEqual(['Place order', 'Check stock', 'Apply discount']);
  });

  it('owns an include on the including case and an extend on the extending one', () => {
    const include = byName('Place order').querySelector('include')!;
    expect(include.getAttribute('addition')).toBe(
      byName('Check stock').getAttribute('xmi:id')
    );
    const extend = byName('Apply discount').querySelector('extend')!;
    expect(extend.getAttribute('extendedCase')).toBe(
      byName('Place order').getAttribute('xmi:id')
    );
  });

  it('writes the actors as actors', () => {
    expect(byName('Customer').getAttribute('xmi:type')).toBe('uml:Actor');
    expect(byName('Stock system').getAttribute('xmi:type')).toBe('uml:Actor');
  });

  it('drops an association whose end this diagram cannot resolve', () => {
    // The fixture's fourth relation points at an actor that is not in the model
    // when it is left out. Nothing is invented and nothing dangles.
    const unresolved = exportXmi([useCaseDiagram()], {});
    expect(danglingReferences(parsed(unresolved))).toEqual([]);
  });
});

describe('an object diagram', () => {
  const model: UmlModel = {
    ...emptyModel('d3', 'obj', 'Sample'),
    classifiers: [
      (() => {
        const instance = classifier('o1', 'object', 'order1 : Order', [
          'quantity = 3',
        ]);
        return { ...instance, name: 'order1', instanceOf: 'Order' };
      })(),
    ],
  };
  const document = parsed(exportXmi([model], { name: 'Sample' }));

  it('writes an object as an InstanceSpecification of its classifier', () => {
    const instance = [...document.querySelectorAll('packagedElement')].find(
      node => node.getAttribute('xmi:type') === 'uml:InstanceSpecification'
    )!;
    expect(instance.getAttribute('name')).toBe('order1');
    // `Order` is drawn nowhere, so it is the minted DataType that answers — the
    // instance is typed either way.
    const order = [...document.documentElement.children].find(
      node => node.getAttribute('name') === 'Order'
    )!;
    expect(instance.getAttribute('classifier')).toBe(
      order.getAttribute('xmi:id')
    );
  });

  it('keeps the slot value, and the feature name in an XMI extension', () => {
    // `Slot::definingFeature` cannot be minted — the compartment names the
    // feature in TEXT — and a `Slot` is not a NamedElement, so the name rides
    // where XMI puts tool data rather than being dropped.
    const slot = document.querySelector('slot')!;
    expect(slot.querySelector('value')!.getAttribute('value')).toBe('3');
    expect(slot.querySelector('feature')!.getAttribute('name')).toBe(
      'quantity'
    );
  });
});

describe('nothing to say', () => {
  it('writes a model with no package rather than no document', () => {
    const document = parsed(exportXmi([], {}));
    expect(document.documentElement.tagName).toBe('uml:Model');
    expect(document.documentElement.children).toHaveLength(0);
  });
});
