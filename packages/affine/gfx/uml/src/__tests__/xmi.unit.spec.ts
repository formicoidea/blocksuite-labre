/** @vitest-environment happy-dom */
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

/**
 * A component diagram: two components, one with a port and both kinds of
 * interface, and the artefact that manifests one of them (§11.6.4, §19.3.4).
 */
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
    // The SAME name as `cart` provides, deliberately: two lollipops are two
    // Interfaces, each declared by the component that draws it.
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

/**
 * A deployment diagram: a device holding an execution environment, a second
 * device, an artefact deployed on the first, and the path between them.
 */
function deploymentDiagram(): UmlModel {
  return {
    ...emptyModel('d4', 'dep', 'Production'),
    artifacts: [node('f1', '«artifact»\ncart.jar')],
    nodes: [
      { ...node('n1', '«device»\nAppServer'), kind: 'device' },
      {
        ...node('n2', '«executionEnvironment»\nTomcat'),
        kind: 'execution-environment',
      },
      // A keyword the metamodel has NO slot for, unlike the three above: it
      // rides in the tool extension rather than being dropped.
      { ...node('n3', '«legacy»\nDBServer'), kind: 'node' },
    ],
    relations: [
      relation('deploy', 'f1', 'n1'),
      relation('communication-path', 'n1', 'n3', 'LAN'),
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
  // The structural references (§19.2.2, §19.3.2). `utilizedElement` subsets
  // `supplier` and `deployedArtifact` does too, `location` subsets `client`:
  // each is the specific name its metaclass gives an end the general Dependency
  // already names, and a dangling one is the same silent, partial import.
  'utilizedElement',
  'deployedArtifact',
  'location',
  // The behaviour references (§15.2, §14.2). An activity edge and a transition
  // each name both of their ends, an AcceptEventAction names the Event its
  // trigger waits for, and a SendSignalAction names the Signal it sends — the
  // last two because both are REFERENCES in the metamodel rather than
  // containments, so both point out of the Activity at a packaged element.
  'source',
  'target',
  'event',
  'signal',
];

/** Attributes that hold a SPACE-SEPARATED list of ids. */
const REFERENCE_LISTS = ['memberEnd', 'annotatedElement', 'node'];

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

/**
 * The golden ACTIVITY document (§15.2.4) — the two swimlanes, the guarded and
 * weighted flow, the minted Signal and TimeEvent, and both kinds of end.
 */
const ACTIVITY_GOLDEN = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmi:version="20131001" xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.omg.org/spec/UML/20161101" xmi:id="_1" name="Shop">
  <packagedElement xmi:type="uml:Package" xmi:id="_2" name="Fulfil an order">
    <packagedElement xmi:type="uml:Signal" xmi:id="_14" name="Order shipped"/>
    <packagedElement xmi:type="uml:TimeEvent" xmi:id="_15" name="after 2 days" isRelative="true">
      <when xmi:type="uml:TimeExpression" xmi:id="_16">
        <expr xmi:type="uml:LiteralString" xmi:id="_17" value="2 days"/>
      </when>
    </packagedElement>
    <packagedElement xmi:type="uml:Activity" xmi:id="_29" name="Fulfil an order">
      <node xmi:type="uml:InitialNode" xmi:id="_3"/>
      <node xmi:type="uml:OpaqueAction" xmi:id="_4" name="Take the order"/>
      <node xmi:type="uml:DecisionNode" xmi:id="_5"/>
      <node xmi:type="uml:ObjectNode" xmi:id="_6" name="Order"/>
      <node xmi:type="uml:OpaqueAction" xmi:id="_7" name="Pick the goods"/>
      <node xmi:type="uml:SendSignalAction" xmi:id="_8" signal="_14" name="Order shipped"/>
      <node xmi:type="uml:AcceptEventAction" xmi:id="_9" name="after 2 days">
        <trigger xmi:type="uml:Trigger" xmi:id="_18" name="after 2 days" event="_15"/>
      </node>
      <node xmi:type="uml:FlowFinalNode" xmi:id="_10"/>
      <node xmi:type="uml:ActivityFinalNode" xmi:id="_11"/>
      <edge xmi:type="uml:ControlFlow" xmi:id="_19" source="_3" target="_4"/>
      <edge xmi:type="uml:ControlFlow" xmi:id="_20" source="_4" target="_5"/>
      <edge xmi:type="uml:ControlFlow" xmi:id="_23" name="ready" source="_5" target="_7">
        <guard xmi:type="uml:OpaqueExpression" xmi:id="_21" body="stock &gt; 0"/>
        <weight xmi:type="uml:LiteralInteger" xmi:id="_22" value="2"/>
      </edge>
      <edge xmi:type="uml:ControlFlow" xmi:id="_25" source="_5" target="_10">
        <guard xmi:type="uml:OpaqueExpression" xmi:id="_24" body="else"/>
      </edge>
      <edge xmi:type="uml:ObjectFlow" xmi:id="_26" source="_4" target="_6"/>
      <edge xmi:type="uml:ControlFlow" xmi:id="_27" source="_7" target="_8"/>
      <edge xmi:type="uml:ControlFlow" xmi:id="_28" source="_9" target="_11"/>
      <group xmi:type="uml:ActivityPartition" xmi:id="_12" name="Sales" node="_3 _4 _5"/>
      <group xmi:type="uml:ActivityPartition" xmi:id="_13" name="Warehouse" node="_6 _7"/>
    </packagedElement>
    <xmi:Extension extender="labre">
      <diagram kind="act"/>
    </xmi:Extension>
  </packagedElement>
</uml:Model>
`;

/**
 * The golden STATE MACHINE document (§14.2.4) — one implicit top region, a
 * state with all three internal behaviours, a composite state owning its own
 * region and history, and a transition carrying two triggers, a guard and an
 * effect.
 */
const STATE_MACHINE_GOLDEN = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmi:version="20131001" xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.omg.org/spec/UML/20161101" xmi:id="_1" name="Shop">
  <packagedElement xmi:type="uml:Package" xmi:id="_2" name="Order lifecycle">
    <packagedElement xmi:type="uml:StateMachine" xmi:id="_10" name="Order lifecycle">
      <region xmi:type="uml:Region" xmi:id="_28" name="Order lifecycle">
        <subvertex xmi:type="uml:State" xmi:id="_4" name="Draft">
          <entry xmi:type="uml:OpaqueBehavior" xmi:id="_11" name="reserve()" body="reserve()"/>
          <doActivity xmi:type="uml:OpaqueBehavior" xmi:id="_12" name="poll()" body="poll()"/>
          <exit xmi:type="uml:OpaqueBehavior" xmi:id="_13" name="release()" body="release()"/>
        </subvertex>
        <subvertex xmi:type="uml:FinalState" xmi:id="_6"/>
        <subvertex xmi:type="uml:Pseudostate" xmi:id="_7" kind="initial"/>
        <subvertex xmi:type="uml:Pseudostate" xmi:id="_8" kind="choice"/>
        <subvertex xmi:type="uml:State" xmi:id="_3" name="Running">
          <region xmi:type="uml:Region" xmi:id="_17" name="Running">
            <subvertex xmi:type="uml:State" xmi:id="_5" name="Placed"/>
            <subvertex xmi:type="uml:Pseudostate" xmi:id="_9" kind="shallowHistory"/>
            <transition xmi:type="uml:Transition" xmi:id="_15" source="_5" target="_6">
              <trigger xmi:type="uml:Trigger" xmi:id="_14" name="close"/>
            </transition>
            <transition xmi:type="uml:Transition" xmi:id="_16" source="_9" target="_5"/>
          </region>
        </subvertex>
        <transition xmi:type="uml:Transition" xmi:id="_18" source="_7" target="_4"/>
        <transition xmi:type="uml:Transition" xmi:id="_24" source="_4" target="_8">
          <trigger xmi:type="uml:Trigger" xmi:id="_19" name="submit"/>
          <trigger xmi:type="uml:Trigger" xmi:id="_20" name="after 5 s"/>
          <guard xmi:type="uml:Constraint" xmi:id="_21">
            <specification xmi:type="uml:OpaqueExpression" xmi:id="_22" body="stock &gt; 0"/>
          </guard>
          <effect xmi:type="uml:OpaqueBehavior" xmi:id="_23" name="reserve()" body="reserve()"/>
        </transition>
        <transition xmi:type="uml:Transition" xmi:id="_27" source="_8" target="_5">
          <guard xmi:type="uml:Constraint" xmi:id="_25">
            <specification xmi:type="uml:OpaqueExpression" xmi:id="_26" body="ok"/>
          </guard>
        </transition>
      </region>
    </packagedElement>
    <xmi:Extension extender="labre">
      <diagram kind="stm"/>
    </xmi:Extension>
  </packagedElement>
</uml:Model>
`;

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

/* ── The structural sheets (§11.6, §19.3, §19.4) ──────────────────────── */

/**
 * The second golden, and the one that pins the three decisions a reviewer would
 * otherwise have to reconstruct from the writer: a lollipop is MINTED as an
 * interface owned by the component that draws it, a ball is an
 * `interfaceRealization` and a socket a `uml:Usage`, and a port is an
 * `ownedAttribute` rather than anything of its own.
 */
const COMPONENT_GOLDEN = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmi:version="20131001" xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.omg.org/spec/UML/20161101" xmi:id="_1" name="Storefront">
  <packagedElement xmi:type="uml:Package" xmi:id="_2" name="Storefront components">
    <packagedElement xmi:type="uml:Component" xmi:id="_3" name="Cart">
      <ownedAttribute xmi:type="uml:Port" xmi:id="_4" name="http"/>
      <packagedElement xmi:type="uml:Interface" xmi:id="_7" name="IOrder"/>
      <interfaceRealization xmi:type="uml:InterfaceRealization" xmi:id="_8" client="_3" supplier="_7" contract="_7"/>
      <packagedElement xmi:type="uml:Interface" xmi:id="_9" name="IPayment"/>
      <packagedElement xmi:type="uml:Usage" xmi:id="_10" client="_3" supplier="_9"/>
    </packagedElement>
    <packagedElement xmi:type="uml:Component" xmi:id="_5" name="Catalogue">
      <packagedElement xmi:type="uml:Interface" xmi:id="_11" name="IOrder"/>
      <interfaceRealization xmi:type="uml:InterfaceRealization" xmi:id="_12" client="_5" supplier="_11" contract="_11"/>
    </packagedElement>
    <packagedElement xmi:type="uml:Artifact" xmi:id="_6" name="cart.jar">
      <manifestation xmi:type="uml:Manifestation" xmi:id="_13" client="_6" supplier="_3" utilizedElement="_3"/>
    </packagedElement>
    <packagedElement xmi:type="uml:Dependency" xmi:id="_14" client="_3" supplier="_5"/>
    <xmi:Extension extender="labre">
      <diagram kind="cmp"/>
    </xmi:Extension>
  </packagedElement>
</uml:Model>
`;

/** The third: the three cubes, a deployment, and §19.4.3's association. */
const DEPLOYMENT_GOLDEN = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmi:version="20131001" xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.omg.org/spec/UML/20161101" xmi:id="_1" name="Production">
  <packagedElement xmi:type="uml:Package" xmi:id="_2" name="Production">
    <packagedElement xmi:type="uml:Artifact" xmi:id="_3" name="cart.jar"/>
    <packagedElement xmi:type="uml:Device" xmi:id="_4" name="AppServer">
      <deployment xmi:type="uml:Deployment" xmi:id="_7" client="_4" supplier="_3" location="_4" deployedArtifact="_3"/>
    </packagedElement>
    <packagedElement xmi:type="uml:ExecutionEnvironment" xmi:id="_5" name="Tomcat"/>
    <packagedElement xmi:type="uml:Node" xmi:id="_6" name="DBServer">
      <xmi:Extension extender="labre">
        <keyword name="legacy"/>
      </xmi:Extension>
    </packagedElement>
    <packagedElement xmi:type="uml:CommunicationPath" xmi:id="_8" name="LAN" memberEnd="_9 _10">
      <ownedEnd xmi:type="uml:Property" xmi:id="_9" association="_8">
        <type xmi:idref="_4"/>
      </ownedEnd>
      <ownedEnd xmi:type="uml:Property" xmi:id="_10" association="_8">
        <type xmi:idref="_6"/>
      </ownedEnd>
    </packagedElement>
    <xmi:Extension extender="labre">
      <diagram kind="dep"/>
    </xmi:Extension>
  </packagedElement>
</uml:Model>
`;

describe('a component diagram', () => {
  const xml = exportXmi([componentDiagram()], { name: 'Storefront' });
  const document = parsed(xml);

  it('is the golden document, byte for byte', () => {
    expect(xml).toBe(COMPONENT_GOLDEN);
  });

  it('parses, and has no dangling reference', () => {
    expect(danglingReferences(document)).toEqual([]);
  });

  it('writes a port as an ownedAttribute of its component', () => {
    // §11.3.2 makes a Port a Property of the EncapsulatedClassifier, so it has
    // nowhere else to live — and a writer that made it a packagedElement would
    // produce a port every importer shows loose in the namespace.
    const port = document.querySelector('ownedAttribute[name="http"]')!;
    expect(port.getAttribute('xmi:type')).toBe('uml:Port');
    expect(port.parentElement!.getAttribute('name')).toBe('Cart');
  });

  it('writes a lollipop as a realization and a socket as a Usage', () => {
    // §10.4.4 in as many words: the ball IS an InterfaceRealization dependency
    // and the socket IS a Usage. Two metaclasses, not one relationship drawn two
    // ways — collapsing them would lose the direction of every dependency.
    const cart = [...document.querySelectorAll('packagedElement')].find(
      node => node.getAttribute('name') === 'Cart'
    )!;
    const realization = cart.querySelector('interfaceRealization')!;
    const provided = [...cart.children].find(
      node => node.getAttribute('name') === 'IOrder'
    )!;
    expect(provided.getAttribute('xmi:type')).toBe('uml:Interface');
    expect(realization.getAttribute('contract')).toBe(
      provided.getAttribute('xmi:id')
    );
    expect(realization.getAttribute('client')).toBe(
      cart.getAttribute('xmi:id')
    );

    const usage = [...cart.children].find(
      node => node.getAttribute('xmi:type') === 'uml:Usage'
    )!;
    const required = [...cart.children].find(
      node => node.getAttribute('name') === 'IPayment'
    )!;
    expect(usage.getAttribute('supplier')).toBe(
      required.getAttribute('xmi:id')
    );
  });

  it('mints one Interface per lollipop, not one per NAME', () => {
    // Two components drawing a ball called `IOrder` is two contracts each
    // declares for itself: a shared interface is drawn ONCE, as a rectangle both
    // are wired to (§11.6.4's other notation), and merging them here would put a
    // statement in the file that nobody drew.
    const interfaces = [...document.querySelectorAll('packagedElement')].filter(
      node =>
        node.getAttribute('xmi:type') === 'uml:Interface' &&
        node.getAttribute('name') === 'IOrder'
    );
    expect(interfaces).toHaveLength(2);
    expect(interfaces[0].parentElement!.getAttribute('name')).toBe('Cart');
    expect(interfaces[1].parentElement!.getAttribute('name')).toBe('Catalogue');
  });

  it('owns the manifestation on the artefact that does the manifesting', () => {
    // §19.3.2: `Artifact::manifestation` subsets `ownedElement`.
    const artifact = [...document.querySelectorAll('packagedElement')].find(
      node => node.getAttribute('xmi:type') === 'uml:Artifact'
    )!;
    expect(artifact.getAttribute('name')).toBe('cart.jar');
    const manifestation = artifact.querySelector('manifestation')!;
    const cart = [...document.querySelectorAll('packagedElement')].find(
      node => node.getAttribute('name') === 'Cart'
    )!;
    expect(manifestation.getAttribute('utilizedElement')).toBe(
      cart.getAttribute('xmi:id')
    );
    // …and `supplier` says the same thing in the general Dependency's own
    // vocabulary, so a reader of either finds the far end.
    expect(manifestation.getAttribute('supplier')).toBe(
      cart.getAttribute('xmi:id')
    );
  });

  it('does not restate the metaclass as a keyword extension', () => {
    // `«component»` on the box IS the `uml:Component` beside it, so carrying it
    // into the tool extension would file a note whose only content is the
    // element's own type.
    expect(xml).not.toContain('<keyword name="component"/>');
    expect(xml).not.toContain('<keyword name="artifact"/>');
  });
});

describe('a deployment diagram', () => {
  const xml = exportXmi([deploymentDiagram()], { name: 'Production' });
  const document = parsed(xml);

  it('is the golden document, byte for byte', () => {
    expect(xml).toBe(DEPLOYMENT_GOLDEN);
  });

  it('parses, and has no dangling reference', () => {
    expect(danglingReferences(document)).toEqual([]);
  });

  it('gives each cube the metaclass its keyword states', () => {
    // §19.4.4 draws all three as the same cube: the keyword is the whole of the
    // difference, and in the file the difference is the `xmi:type`.
    const typeOf = (name: string) =>
      [...document.querySelectorAll('packagedElement')]
        .find(node => node.getAttribute('name') === name)!
        .getAttribute('xmi:type');
    expect(typeOf('AppServer')).toBe('uml:Device');
    expect(typeOf('Tomcat')).toBe('uml:ExecutionEnvironment');
    expect(typeOf('DBServer')).toBe('uml:Node');
  });

  it('owns the deployment on the cube the artefact lands on', () => {
    // §19.2.2: `Deployment::location` subsets `client` AND `owner`, so the
    // element is a child of the target and names it back.
    const server = [...document.querySelectorAll('packagedElement')].find(
      node => node.getAttribute('name') === 'AppServer'
    )!;
    const artifact = [...document.querySelectorAll('packagedElement')].find(
      node => node.getAttribute('xmi:type') === 'uml:Artifact'
    )!;
    const deployment = server.querySelector('deployment')!;
    expect(deployment.getAttribute('deployedArtifact')).toBe(
      artifact.getAttribute('xmi:id')
    );
    expect(deployment.getAttribute('location')).toBe(
      server.getAttribute('xmi:id')
    );
  });

  it('writes a communication path as the association §19.4.3 says it is', () => {
    const path = [...document.querySelectorAll('packagedElement')].find(
      node => node.getAttribute('xmi:type') === 'uml:CommunicationPath'
    )!;
    expect(path.getAttribute('name')).toBe('LAN');
    // Both ends owned by the path itself, exactly as a plain association's are:
    // a canvas connector states no navigable attribute on either classifier.
    const ends = [...path.querySelectorAll('ownedEnd')];
    expect(ends).toHaveLength(2);
    expect(path.getAttribute('memberEnd')).toBe(
      ends.map(end => end.getAttribute('xmi:id')).join(' ')
    );
  });

  it('keeps a keyword the metamodel has no slot for', () => {
    // `«device»` is the `uml:Device` beside it and is not restated; `«legacy»`
    // is an Annex C label the author wrote and the metamodel has nowhere to put,
    // so it rides in the extension XMI provides for exactly that.
    const server = [...document.querySelectorAll('packagedElement')].find(
      node => node.getAttribute('xmi:type') === 'uml:Node'
    )!;
    expect(server.getAttribute('name')).toBe('DBServer');
    expect(server.querySelector('keyword')!.getAttribute('name')).toBe(
      'legacy'
    );
    expect(xml).not.toContain('<keyword name="device"/>');
  });
});

describe('nothing to say', () => {
  it('writes a model with no package rather than no document', () => {
    const document = parsed(exportXmi([], {}));
    expect(document.documentElement.tagName).toBe('uml:Model');
    expect(document.documentElement.children).toHaveLength(0);
  });
});

/* ── The behaviour sheets (§15.2, §14.2) ──────────────────────────────── */

/**
 * Every element of a tag whose `xmi:type` is the one asked for.
 *
 * Written out rather than left to a `[*|type=…]` attribute selector: happy-dom
 * does not honour the namespace wildcard, and a selector that silently matches
 * the first element of the tag would make these assertions pass against the
 * wrong node.
 */
const ofType = (document: Document, tag: string, type: string) =>
  [...document.querySelectorAll(tag)].filter(
    element => element.getAttribute('xmi:type') === type
  );

const behaviourNode = <K extends string>(id: string, kind: K, name = '') => ({
  id,
  name,
  keywords: [],
  isAbstract: false,
  kind,
});

/**
 * An activity with one of everything the writer has a rule for: a beginning, a
 * decision branching into a named-and-guarded-and-weighted flow and an `else`,
 * an object flow onto a data node, the two signal glyphs, the hourglass, and
 * both kinds of end — laid out in two swimlanes (§15.6.4).
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

/**
 * A state machine with the three shapes that cost the writer something: a state
 * carrying all three internal behaviours, a COMPOSITE state with its own region
 * and a history inside it, and a transition carrying two triggers, a guard and
 * an effect (§14.2.4.8).
 */
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

describe('an activity diagram', () => {
  const xml = exportXmi([activityDiagram()], { name: 'Shop' });
  const document = parsed(xml);

  it('parses, and resolves every reference in it', () => {
    // `source`, `target`, `node`, `event` and `signal` are the five the
    // behaviour sheets add, and a dangling one is the same silent, partial
    // import every other reference in this file is checked against.
    expect(danglingReferences(document)).toEqual([]);
  });

  it('writes §15.7’s own metaclass for each glyph', () => {
    const nodes = [...document.querySelectorAll('node')];
    expect(nodes.map(each => each.getAttribute('xmi:type'))).toEqual([
      'uml:InitialNode',
      'uml:OpaqueAction',
      'uml:DecisionNode',
      'uml:ObjectNode',
      'uml:OpaqueAction',
      'uml:SendSignalAction',
      // §16.10.4's hourglass IS an AcceptEventAction: the metamodel has no
      // `AcceptTimeEventAction`, and inventing one produces a file no importer
      // can read.
      'uml:AcceptEventAction',
      'uml:FlowFinalNode',
      'uml:ActivityFinalNode',
    ]);
  });

  it('leaves the control nodes unnamed, because the notation draws them so', () => {
    const unnamed = [...document.querySelectorAll('node')].filter(each =>
      [
        'uml:InitialNode',
        'uml:DecisionNode',
        'uml:FlowFinalNode',
        'uml:ActivityFinalNode',
      ].includes(each.getAttribute('xmi:type') ?? '')
    );
    expect(unnamed).toHaveLength(4);
    for (const node of unnamed) {
      // Never `name=""`: an unnamed element and an element named nothing are
      // different statements.
      expect(node.getAttribute('name')).toBeNull();
    }
  });

  it('writes the guard as an OpaqueExpression and the weight as a literal', () => {
    const guarded = [...document.querySelectorAll('edge')].find(
      each => each.getAttribute('name') === 'ready'
    )!;
    expect(guarded.getAttribute('xmi:type')).toBe('uml:ControlFlow');
    const guard = guarded.querySelector('guard')!;
    expect(guard.getAttribute('xmi:type')).toBe('uml:OpaqueExpression');
    expect(guard.getAttribute('body')).toBe('stock > 0');
    const weight = guarded.querySelector('weight')!;
    expect(weight.getAttribute('xmi:type')).toBe('uml:LiteralInteger');
    expect(weight.getAttribute('value')).toBe('2');
  });

  it('tells the two kinds of flow apart', () => {
    const kinds = [...document.querySelectorAll('edge')].map(each =>
      each.getAttribute('xmi:type')
    );
    expect(kinds.filter(kind => kind === 'uml:ObjectFlow')).toHaveLength(1);
    expect(kinds.filter(kind => kind === 'uml:ControlFlow')).toHaveLength(6);
  });

  it('writes each swimlane as a group naming the nodes it holds', () => {
    const groups = [...document.querySelectorAll('group')];
    expect(groups.map(each => each.getAttribute('xmi:type'))).toEqual([
      'uml:ActivityPartition',
      'uml:ActivityPartition',
    ]);
    expect(groups.map(each => each.getAttribute('name'))).toEqual([
      'Sales',
      'Warehouse',
    ]);
    // Three nodes in the first lane, two in the second — the idrefs, which the
    // dangling check above has already resolved.
    expect(groups[0].getAttribute('node')!.split(' ')).toHaveLength(3);
    expect(groups[1].getAttribute('node')!.split(' ')).toHaveLength(2);
  });

  it('mints the Signal and the TimeEvent the actions REFER to', () => {
    // Both are references in the metamodel, not containments, so both live in
    // the sheet's package where a reference can reach them.
    const signal = ofType(document, 'packagedElement', 'uml:Signal')[0];
    expect(signal.getAttribute('name')).toBe('Order shipped');
    const event = ofType(document, 'packagedElement', 'uml:TimeEvent')[0];
    // §13.3.3.4: `after` is a RELATIVE time event, and the expression is what
    // follows the keyword — writing the keyword into the value would make an
    // importer wait "after after 2 days".
    expect(event.getAttribute('isRelative')).toBe('true');
    expect(event.querySelector('expr')!.getAttribute('value')).toBe('2 days');
  });

  it('is the golden activity document, byte for byte', () => {
    expect(xml).toBe(ACTIVITY_GOLDEN);
  });
});

describe('a state machine diagram', () => {
  const xml = exportXmi([stateMachineDiagram()], { name: 'Shop' });
  const document = parsed(xml);

  it('parses, and resolves every reference in it', () => {
    expect(danglingReferences(document)).toEqual([]);
  });

  it('wraps the sheet in one implicit region', () => {
    // §14.2.4 makes the top region implicit — the frame IS it — so there is
    // nothing on the canvas to read it off and a flat machine would otherwise
    // have nowhere to put a single state.
    const [machine] = ofType(document, 'packagedElement', 'uml:StateMachine');
    expect(machine.getAttribute('name')).toBe('Order lifecycle');
    expect([...machine.children].map(child => child.tagName)).toEqual([
      'region',
    ]);
  });

  it('writes a state’s three internal behaviours as OpaqueBehaviors', () => {
    const draft = [...document.querySelectorAll('subvertex')].find(
      each => each.getAttribute('name') === 'Draft'
    )!;
    expect(draft.getAttribute('xmi:type')).toBe('uml:State');
    expect([...draft.children].map(child => child.tagName)).toEqual([
      'entry',
      'doActivity',
      'exit',
    ]);
    expect(draft.querySelector('entry')!.getAttribute('body')).toBe(
      'reserve()'
    );
    for (const child of draft.children) {
      expect(child.getAttribute('xmi:type')).toBe('uml:OpaqueBehavior');
    }
  });

  it('writes the composite state as a State with a Region of its own', () => {
    const composite = [...document.querySelectorAll('subvertex')].find(
      each => each.getAttribute('name') === 'Running'
    )!;
    expect(composite.getAttribute('xmi:type')).toBe('uml:State');
    const region = composite.querySelector('region')!;
    expect(region.getAttribute('xmi:type')).toBe('uml:Region');
    // …and the vertices drawn inside it are ITS subvertices, not the machine's.
    expect(
      [...region.children]
        .filter(child => child.tagName === 'subvertex')
        .map(child => child.getAttribute('name') ?? child.getAttribute('kind'))
    ).toEqual(['Placed', 'shallowHistory']);
  });

  it('spells §14.5.7’s PseudostateKind for each glyph', () => {
    const kinds = [...document.querySelectorAll('subvertex')]
      .filter(each => each.getAttribute('xmi:type') === 'uml:Pseudostate')
      .map(each => each.getAttribute('kind'));
    expect(kinds).toEqual(['initial', 'choice', 'shallowHistory']);
  });

  it('writes a transition’s triggers, its guard and its effect', () => {
    const labelled = [...document.querySelectorAll('transition')].find(
      each => each.querySelectorAll('trigger').length === 2
    )!;
    expect(
      [...labelled.querySelectorAll('trigger')].map(each =>
        each.getAttribute('name')
      )
    ).toEqual(['submit', 'after 5 s']);
    // `Transition::guard` is a CONSTRAINT, where an ActivityEdge's is a
    // ValueSpecification — the expression goes in its `specification`.
    const guard = labelled.querySelector('guard')!;
    expect(guard.getAttribute('xmi:type')).toBe('uml:Constraint');
    expect(guard.querySelector('specification')!.getAttribute('body')).toBe(
      'stock > 0'
    );
    expect(labelled.querySelector('effect')!.getAttribute('body')).toBe(
      'reserve()'
    );
  });

  it('owns each transition in the region its SOURCE sits in', () => {
    // §14.5.12 owns a Transition on a Region, and the source is the vertex the
    // arc leaves — so the two drawn inside the composite state are written
    // inside it, which is where §14.2.4 draws them from.
    const composite = [...document.querySelectorAll('subvertex')].find(
      each => each.getAttribute('name') === 'Running'
    )!;
    expect(
      composite.querySelector('region')!.querySelectorAll('transition')
    ).toHaveLength(2);
  });

  it('is the golden state machine document, byte for byte', () => {
    expect(xml).toBe(STATE_MACHINE_GOLDEN);
  });
});
