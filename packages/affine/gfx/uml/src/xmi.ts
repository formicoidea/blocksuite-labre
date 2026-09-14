import type { UmlBox } from './component.js';
import type { UmlMultiplicity, UmlOperation, UmlProperty } from './grammar.js';
import {
  type UmlClassifier,
  type UmlModel,
  type UmlNodeBase,
  type UmlRelation,
  umlCentreInside,
} from './model.js';
import {
  type XmlAttrs,
  type XmlElement,
  el,
  serializeDocument,
} from './xml.js';

/**
 * The diagrams as an **XMI 2.5.1 document** — the interchange file every UML
 * tool reads.
 *
 * ## Which XMI, exactly
 *
 * The one a 2016 UML tool writes and reads, and the three strings that say so
 * (Annex E of UML 2.5.1 gives the namespaces; the XMI version is XMI 2.5.1's
 * own):
 *
 *  - `xmi:version="20131001"` with `xmlns:xmi="http://www.omg.org/spec/XMI/20131001"`;
 *  - `xmlns:uml="http://www.omg.org/spec/UML/20161101"` — the UML 2.5.1
 *    metamodel namespace;
 *  - `PrimitiveTypes.xmi` under the same base, which is where `String`,
 *    `Integer`, `Boolean`, `Real` and `UnlimitedNatural` live.
 *
 * Getting these wrong is the difference between a file Papyrus opens and a file
 * it refuses, which is why they are constants with a citation rather than
 * literals in a template.
 *
 * ## No diagram interchange
 *
 * Not one coordinate is written. UML's DI is a second metamodel with its own
 * namespace, and every tool lays a model out its own way on import anyway — so a
 * half-DI would be a promise the file cannot keep, and a full one is a chantier
 * of its own. What the file carries is the MODEL: the classifiers, their
 * features, and the relationships between them. The picture stays in Labre.
 *
 * The one thing geometry still decides is CONTAINMENT — which package a class is
 * drawn inside, which subject a use case sits in — because on a UML diagram that
 * is not layout, it is the statement (§12.2.4, §18.1.4).
 *
 * ## Deterministic ids
 *
 * `_1`, `_2`, … minted in document order, never a hash and never a random id:
 * the same model exports to the same bytes, so a golden test is a diff and a
 * re-export is not a spurious change in someone's version control.
 *
 * ## Pure
 *
 * A model in, a string out. No `std`, no DOM, no clock — `docs/adr/0012` P3.
 */

/* ── The namespaces (UML 2.5.1 Annex E) ───────────────────────────────── */

export const XMI_VERSION = '20131001';
export const XMI_NAMESPACE = 'http://www.omg.org/spec/XMI/20131001';
export const UML_NAMESPACE = 'http://www.omg.org/spec/UML/20161101';
export const UML_PRIMITIVE_TYPES = `${UML_NAMESPACE}/PrimitiveTypes.xmi`;

/** What Labre stamps on the XMI extensions it writes. */
const EXTENDER = 'labre';

/**
 * The five PrimitiveTypes UML itself ships, keyed by the spellings an author
 * types.
 *
 * Referenced by `href` into `PrimitiveTypes.xmi` rather than declared in the
 * file, because they are not ours to declare: every tool resolves that URI to
 * the same five DataTypes, and a locally minted `String` would be a sixth type
 * that merely looks like it.
 *
 * The lowercase spellings are here because they are what people write —
 * `boolean`, `int`, `string` — and folding them costs nothing while refusing
 * them would leave a perfectly ordinary attribute untyped. `int` and `float` are
 * the two aliases that are NOT mere case: they are named in the map rather than
 * inferred, so the reading is visible.
 */
const PRIMITIVE_TYPES: Readonly<Record<string, string>> = {
  string: 'String',
  integer: 'Integer',
  int: 'Integer',
  boolean: 'Boolean',
  bool: 'Boolean',
  real: 'Real',
  float: 'Real',
  double: 'Real',
  unlimitednatural: 'UnlimitedNatural',
};

/** The `xmi:type` each classifier kind is serialized as. */
const CLASSIFIER_TYPE: Record<UmlClassifier['kind'], string> = {
  class: 'uml:Class',
  interface: 'uml:Interface',
  enumeration: 'uml:Enumeration',
  object: 'uml:InstanceSpecification',
};

/**
 * The keywords a classifier's `xmi:type` already states.
 *
 * `«interface»` in a box header is not extra information once the element is
 * serialized as a `uml:Interface` — it IS that fact, written in notation. Only
 * the keywords that say something the metamodel has no slot for survive into the
 * extension below.
 */
const METACLASS_KEYWORDS = new Set([
  'interface',
  'enumeration',
  'datatype',
  'class',
  'object',
  'instance',
]);

/** Annex C keywords that make a Dependency a Usage (§7.8.4, Table C.1). */
const USAGE_KEYWORDS = new Set(['use', 'call', 'create', 'instantiate']);

export interface UmlXmiOptions {
  /** The `uml:Model`'s own name — the caller's document name. */
  name?: string;
}

/* ── Id minting ───────────────────────────────────────────────────────── */

/** `_1`, `_2`, … in the order they are asked for. */
class Ids {
  #next = 0;

  mint(): string {
    this.#next += 1;
    return `_${this.#next}`;
  }
}

/* ── Geometry helpers ─────────────────────────────────────────────────── */

/** The area of a box — what "the SMALLEST containing box" is measured on. */
function areaOf(box: UmlBox): number {
  return Math.max(0, box.w) * Math.max(0, box.h);
}

/**
 * The smallest container whose box holds this element's centre — `undefined`
 * for one drawn outside them all.
 *
 * The most-nested container wins, which is the only reading that lets a package
 * drawn inside a package mean what it draws.
 *
 * `strictlyLarger` is asked for when the element is ITSELF a container, and it
 * is what makes nesting a strict order: a candidate must be strictly bigger than
 * the thing it contains, so two packages drawn exactly on top of each other
 * cannot each claim the other and the recursive walk below cannot loop.
 */
function containerOf(
  element: UmlNodeBase,
  containers: readonly UmlNodeBase[],
  strictlyLarger = false
): UmlNodeBase | undefined {
  const bounds = element.bounds;
  if (!bounds) return undefined;
  const own = areaOf(bounds);
  let best: UmlNodeBase | undefined;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const candidate of containers) {
    if (candidate.id === element.id || !candidate.bounds) continue;
    if (!umlCentreInside(bounds, candidate.bounds)) continue;
    const area = areaOf(candidate.bounds);
    if (strictlyLarger && area <= own) continue;
    if (area < bestArea) {
      best = candidate;
      bestArea = area;
    }
  }
  return best;
}

/* ── The plan ─────────────────────────────────────────────────────────── */

/** Everything the writers need to resolve a reference before writing one. */
interface XmiPlan {
  ids: Ids;
  /** Surface element id → `xmi:id`. */
  idOf: Map<string, string>;
  /** Classifier NAME → `xmi:id`, first declaration wins. */
  classifierByName: Map<string, string>;
  /** Surface element id → the classifier kind, for the realization reading. */
  kindOf: Map<string, UmlClassifier['kind']>;
  /** A type name nothing on the canvas answers for → its minted DataType. */
  synthesized: Map<string, string>;
}

/** Every type name a model mentions, in the order the file will mention it. */
function typeNamesOf(model: UmlModel): string[] {
  const names: string[] = [];
  const add = (value: string | undefined) => {
    if (value) names.push(value);
  };
  for (const classifier of model.classifiers) {
    for (const attribute of classifier.attributes) add(attribute.type);
    for (const operation of classifier.operations) {
      for (const parameter of operation.parameters) add(parameter.type);
      add(operation.returnType);
    }
    add(classifier.instanceOf);
  }
  return names;
}

/**
 * Ids for everything a reference can point at, minted before anything is
 * written.
 *
 * Two passes rather than one because XMI is full of FORWARD references: an
 * attribute is typed by a class declared further down, an association names both
 * of its ends, a generalization points at a superclass in another package. A
 * single pass would have to patch strings after the fact, which is how an id
 * that does not resolve gets into a file.
 */
function planOf(models: readonly UmlModel[], ids: Ids): XmiPlan {
  const plan: XmiPlan = {
    ids,
    idOf: new Map(),
    classifierByName: new Map(),
    kindOf: new Map(),
    synthesized: new Map(),
  };

  const claim = (element: UmlNodeBase) => {
    plan.idOf.set(element.id, ids.mint());
  };

  for (const model of models) {
    plan.idOf.set(model.diagram.id, ids.mint());
    for (const node of model.packages) claim(node);
    for (const classifier of model.classifiers) {
      claim(classifier);
      plan.kindOf.set(classifier.id, classifier.kind);
      // A named classifier is what a type name resolves to. The FIRST wins:
      // two classes called `Order` on two sheets of one export are one name in
      // one `uml:Model`, and document order is the tie-break everything else in
      // this framework breaks on.
      if (classifier.name && !plan.classifierByName.has(classifier.name)) {
        plan.classifierByName.set(
          classifier.name,
          plan.idOf.get(classifier.id)!
        );
      }
    }
    for (const node of model.actors) claim(node);
    for (const node of model.useCases) claim(node);
    for (const node of model.subjects) claim(node);
    for (const note of model.notes) claim(note);
  }

  // A type the author named that is neither a UML PrimitiveType nor a box on any
  // sheet — `Money`, `OrderId`. It gets a DataType of its own at the root rather
  // than being dropped: the author typed it, so the file says it, and an
  // importer shows `total : Money` instead of an untyped attribute.
  for (const model of models) {
    for (const name of typeNamesOf(model)) {
      if (PRIMITIVE_TYPES[name.toLowerCase()]) continue;
      if (plan.classifierByName.has(name)) continue;
      if (plan.synthesized.has(name)) continue;
      plan.synthesized.set(name, ids.mint());
    }
  }

  return plan;
}

/* ── Values ───────────────────────────────────────────────────────────── */

/**
 * A default value as the LiteralSpecification it looks like.
 *
 * `3` is a `LiteralInteger` and `true` a `LiteralBoolean` because that is what
 * every tool writes and what an importer can compute with; everything else is a
 * `LiteralString`, verbatim. Nothing is evaluated — §9.5.4's `<default>` is an
 * expression, and this writer is not an interpreter.
 */
function literalOf(value: string, ids: Ids): XmlElement {
  const attrs = (type: string): XmlAttrs => ({
    'xmi:type': type,
    'xmi:id': ids.mint(),
    value,
  });
  if (/^[+-]?\d+$/.test(value)) {
    return el('defaultValue', attrs('uml:LiteralInteger'));
  }
  if (value === 'true' || value === 'false') {
    return el('defaultValue', attrs('uml:LiteralBoolean'));
  }
  return el('defaultValue', attrs('uml:LiteralString'));
}

/**
 * `lowerValue` and `upperValue` — written only when the author STATED a
 * multiplicity.
 *
 * An omitted range means `1` (§9.5.4 says so in as many words), and that is also
 * the metamodel's default, so writing it out would add two elements that say
 * what the absence already says. The upper bound is an `UnlimitedNatural`, which
 * is what lets it be `*`.
 */
function multiplicityElements(
  multiplicity: UmlMultiplicity | undefined,
  ids: Ids
): XmlElement[] {
  if (!multiplicity) return [];
  return [
    el('lowerValue', {
      'xmi:type': 'uml:LiteralInteger',
      'xmi:id': ids.mint(),
      value: multiplicity.lower,
    }),
    el('upperValue', {
      'xmi:type': 'uml:LiteralUnlimitedNatural',
      'xmi:id': ids.mint(),
      value: String(multiplicity.upper),
    }),
  ];
}

/**
 * The `<type>` of a typed element — an in-file reference, a UML PrimitiveType,
 * or nothing.
 *
 * The nested `<type xmi:idref="…"/>` form rather than a `type="…"` attribute:
 * both are legal XMI, and the element form is the one that can carry an `href`
 * for a type that lives in ANOTHER document, which is exactly what a
 * PrimitiveType is. One shape for both cases means one thing for a reader to
 * understand and one thing for a spec to check.
 */
function typeElement(
  name: string | undefined,
  plan: XmiPlan
): XmlElement | undefined {
  if (!name) return undefined;
  const primitive = PRIMITIVE_TYPES[name.toLowerCase()];
  if (primitive) {
    return el('type', {
      'xmi:type': 'uml:PrimitiveType',
      href: `${UML_PRIMITIVE_TYPES}#${primitive}`,
    });
  }
  const local = plan.classifierByName.get(name) ?? plan.synthesized.get(name);
  return local ? el('type', { 'xmi:idref': local }) : undefined;
}

/* ── Features ─────────────────────────────────────────────────────────── */

/** `visibility="public"`, or nothing when the author wrote no marker. */
function visibilityAttrs(visibility: string | undefined): XmlAttrs {
  return visibility ? { visibility } : {};
}

/** One attribute compartment line as an `ownedAttribute` (§9.5.4). */
function attributeElement(property: UmlProperty, plan: XmiPlan): XmlElement {
  const children: XmlElement[] = [];
  const type = typeElement(property.type, plan);
  if (type) children.push(type);
  children.push(...multiplicityElements(property.multiplicity, plan.ids));
  if (property.defaultValue) {
    children.push(literalOf(property.defaultValue, plan.ids));
  }
  return el(
    'ownedAttribute',
    {
      'xmi:type': 'uml:Property',
      'xmi:id': plan.ids.mint(),
      name: property.name,
      ...visibilityAttrs(property.visibility),
      // Written only when TRUE: both default to false in the metamodel, and an
      // explicit `false` everywhere is noise in a file a human reads.
      ...(property.isDerived ? { isDerived: 'true' } : {}),
      ...(property.isStatic ? { isStatic: 'true' } : {}),
    },
    children
  );
}

/** One operation compartment line as an `ownedOperation` (§9.6.4). */
function operationElement(operation: UmlOperation, plan: XmiPlan): XmlElement {
  const children: XmlElement[] = operation.parameters.map(parameter => {
    const parts: XmlElement[] = [];
    const type = typeElement(parameter.type, plan);
    if (type) parts.push(type);
    parts.push(...multiplicityElements(parameter.multiplicity, plan.ids));
    if (parameter.defaultValue) {
      parts.push(literalOf(parameter.defaultValue, plan.ids));
    }
    return el(
      'ownedParameter',
      {
        'xmi:type': 'uml:Parameter',
        'xmi:id': plan.ids.mint(),
        name: parameter.name,
        // §9.4.4: an omitted direction defaults to `in`. The DEFAULT is applied
        // here, where a file needs a value, rather than in the parser, which
        // reports what the line said.
        direction: parameter.direction ?? 'in',
      },
      parts
    );
  });

  // The return type is a Parameter with `direction="return"` — UML has no
  // separate slot for it, and a writer that invented one would produce an
  // operation whose result no importer can find.
  if (operation.returnType || operation.returnMultiplicity) {
    const parts: XmlElement[] = [];
    const type = typeElement(operation.returnType, plan);
    if (type) parts.push(type);
    parts.push(...multiplicityElements(operation.returnMultiplicity, plan.ids));
    children.push(
      el(
        'ownedParameter',
        {
          'xmi:type': 'uml:Parameter',
          'xmi:id': plan.ids.mint(),
          direction: 'return',
        },
        parts
      )
    );
  }

  return el(
    'ownedOperation',
    {
      'xmi:type': 'uml:Operation',
      'xmi:id': plan.ids.mint(),
      name: operation.name,
      ...visibilityAttrs(operation.visibility),
      ...(operation.isAbstract ? { isAbstract: 'true' } : {}),
      ...(operation.isStatic ? { isStatic: 'true' } : {}),
      ...(operation.modifiers.some(m => m.toLowerCase() === 'query')
        ? { isQuery: 'true' }
        : {}),
    },
    children
  );
}

/**
 * The keywords the metamodel has nowhere to put, as an XMI extension.
 *
 * `«entity»` on a class is a STEREOTYPE application, and applying a stereotype
 * in UML requires a Profile the author never wrote — so there is no valid place
 * in the model for it. `xmi:Extension` is XMI's own answer to exactly this
 * question (XMI 2.5.1 §7.9): tool-specific content, in a container every reader
 * is required to skip if it does not recognise the extender. So the word travels
 * with the file and no importer trips over it.
 *
 * The keywords that merely restate the metaclass are not extended — see
 * {@link METACLASS_KEYWORDS}.
 */
function keywordExtension(keywords: readonly string[]): XmlElement | undefined {
  const extra = keywords.filter(
    keyword => !METACLASS_KEYWORDS.has(keyword.toLowerCase())
  );
  if (extra.length === 0) return undefined;
  return el(
    'xmi:Extension',
    { extender: EXTENDER },
    extra.map(keyword => el('keyword', { name: keyword }))
  );
}

/* ── Classifiers ──────────────────────────────────────────────────────── */

/**
 * One classifier as a `packagedElement`, with every relationship it OWNS.
 *
 * Three relationships are children of their source rather than siblings of it,
 * because that is where the metamodel puts them: a `Generalization` is owned by
 * the specific Classifier, an `InterfaceRealization` by the implementing one,
 * and both are meaningless detached from it.
 */
function classifierElement(
  classifier: UmlClassifier,
  model: UmlModel,
  plan: XmiPlan
): XmlElement {
  const id = plan.idOf.get(classifier.id)!;
  const children: XmlElement[] = [];

  if (classifier.kind === 'enumeration') {
    // An enumeration's compartment holds LITERALS, not properties: the line is
    // parsed for its name and nothing else, so `NEW` and `+ NEW` both name the
    // same literal.
    for (const literal of classifier.attributes) {
      children.push(
        el('ownedLiteral', {
          'xmi:type': 'uml:EnumerationLiteral',
          'xmi:id': plan.ids.mint(),
          name: literal.name,
        })
      );
    }
  } else if (classifier.kind === 'object') {
    // A `slot` with a `value` and NO `definingFeature`.
    //
    // The metamodel requires the feature, and it is the one reference this
    // writer cannot honestly mint: `Slot::definingFeature` points at a Property
    // of the instance's Classifier, and an object diagram almost never has that
    // class on it — §11.6.4's compartment names the feature in TEXT, which is
    // all the author gave us. The choice is between a slot a strict validator
    // flags and dropping what somebody typed into their diagram; the slot stays.
    //
    // A `Slot` is not a NamedElement, so the feature's NAME has nowhere to go in
    // the model either, and it rides in the extension XMI provides for exactly
    // this — where a reader that wants it can find it and a reader that does not
    // is required to skip it.
    for (const slot of classifier.slots) {
      children.push(
        el('slot', { 'xmi:type': 'uml:Slot', 'xmi:id': plan.ids.mint() }, [
          el('value', {
            'xmi:type': 'uml:LiteralString',
            'xmi:id': plan.ids.mint(),
            value: slot.value ?? '',
          }),
          el('xmi:Extension', { extender: EXTENDER }, [
            el('feature', { name: slot.name }),
          ]),
        ])
      );
    }
  } else {
    for (const attribute of classifier.attributes) {
      children.push(attributeElement(attribute, plan));
    }
    for (const operation of classifier.operations) {
      children.push(operationElement(operation, plan));
    }
  }

  for (const relation of model.relations) {
    if (relation.sourceId !== classifier.id) continue;
    const target = plan.idOf.get(relation.targetId);
    if (!target) continue;

    if (relation.kind === 'generalization') {
      children.push(
        el('generalization', {
          'xmi:type': 'uml:Generalization',
          'xmi:id': plan.ids.mint(),
          general: target,
        })
      );
    } else if (
      relation.kind === 'realization' &&
      plan.kindOf.get(relation.targetId) === 'interface'
    ) {
      // An InterfaceRealization only when the far end IS an Interface — its
      // `contract` is typed `Interface` in the metamodel, so pointing it at a
      // class would be a reference no conformant reader can resolve. A
      // realization of anything else is written as a `uml:Realization` beside
      // the classifiers instead.
      children.push(
        el('interfaceRealization', {
          'xmi:type': 'uml:InterfaceRealization',
          'xmi:id': plan.ids.mint(),
          client: id,
          supplier: target,
          contract: target,
        })
      );
    }
  }

  const extension = keywordExtension(classifier.keywords);
  if (extension) children.push(extension);

  // `object : Class` — the Classifier the instance is of. Resolved against the
  // boxes on the export first and against the DataTypes minted for the names
  // nothing answered for second, so `order1 : Order` is typed even on an object
  // diagram that does not draw `Order` (which is most of them).
  const instanceOf =
    classifier.kind === 'object' && classifier.instanceOf
      ? (plan.classifierByName.get(classifier.instanceOf) ??
        plan.synthesized.get(classifier.instanceOf))
      : undefined;

  return el(
    'packagedElement',
    {
      'xmi:type': CLASSIFIER_TYPE[classifier.kind],
      'xmi:id': id,
      name: classifier.name,
      ...(classifier.isAbstract ? { isAbstract: 'true' } : {}),
      ...(instanceOf ? { classifier: instanceOf } : {}),
    },
    children
  );
}

/* ── Use case artefacts ───────────────────────────────────────────────── */

/** One use case, with the `Include`s and `Extend`s it owns (§18.1.4). */
function useCaseElement(
  useCase: UmlNodeBase,
  model: UmlModel,
  plan: XmiPlan
): XmlElement {
  const children: XmlElement[] = [];
  for (const relation of model.relations) {
    if (relation.sourceId !== useCase.id) continue;
    const target = plan.idOf.get(relation.targetId);
    if (!target) continue;
    if (relation.kind === 'include') {
      // Owned by the INCLUDING use case, pointing at the addition — the
      // direction the role table states (source = the base case).
      children.push(
        el('include', {
          'xmi:type': 'uml:Include',
          'xmi:id': plan.ids.mint(),
          addition: target,
        })
      );
    } else if (relation.kind === 'extend') {
      // Owned by the EXTENDING use case, pointing at the case it extends —
      // `Extend::extension` is the owner in the metamodel, which is why the
      // role's source is the extending case and not the base one.
      children.push(
        el('extend', {
          'xmi:type': 'uml:Extend',
          'xmi:id': plan.ids.mint(),
          extendedCase: target,
        })
      );
    }
  }
  const extension = keywordExtension(useCase.keywords);
  if (extension) children.push(extension);

  return el(
    'packagedElement',
    {
      'xmi:type': 'uml:UseCase',
      'xmi:id': plan.idOf.get(useCase.id)!,
      name: useCase.name,
    },
    children
  );
}

/* ── Relationships that are packaged elements ─────────────────────────── */

/**
 * An association, with both ends owned by the association itself.
 *
 * ## Why both ends are `ownedEnd`s
 *
 * UML lets an end be owned either by the Association or by the Classifier at the
 * other end (where it shows up as an attribute). A canvas connector states
 * neither: the author drew a line, not a navigable attribute. Owning both ends
 * on the association is the reading that adds nothing the author did not say,
 * and it is what every tool produces for a line drawn with no role names.
 *
 * ## Which end carries the diamond
 *
 * The aggregation flag goes on the end whose TYPE is the PART — the property the
 * whole conceptually owns — because that is what `Property::isComposite` means
 * in the metamodel ("the object containing the attribute is a container for the
 * object contained in the attribute"). The diamond is then drawn at the whole's
 * end of the line, which is the source: the role table makes the source the
 * whole, so the flag lands on the end typed by the target. Putting it on the
 * other end would draw the diamond on the wrong classifier in every tool that
 * opens the file.
 */
function associationElement(
  relation: UmlRelation,
  plan: XmiPlan
): XmlElement | undefined {
  const source = plan.idOf.get(relation.sourceId);
  const target = plan.idOf.get(relation.targetId);
  if (!source || !target) return undefined;

  const id = plan.ids.mint();
  const sourceEnd = plan.ids.mint();
  const targetEnd = plan.ids.mint();
  const aggregation =
    relation.kind === 'composition'
      ? 'composite'
      : relation.kind === 'aggregation'
        ? 'shared'
        : undefined;

  return el(
    'packagedElement',
    {
      'xmi:type': 'uml:Association',
      'xmi:id': id,
      ...(relation.label ? { name: relation.label } : {}),
      memberEnd: `${sourceEnd} ${targetEnd}`,
    },
    [
      el(
        'ownedEnd',
        {
          'xmi:type': 'uml:Property',
          'xmi:id': sourceEnd,
          association: id,
        },
        [el('type', { 'xmi:idref': source })]
      ),
      el(
        'ownedEnd',
        {
          'xmi:type': 'uml:Property',
          'xmi:id': targetEnd,
          association: id,
          ...(aggregation ? { aggregation } : {}),
        },
        [el('type', { 'xmi:idref': target })]
      ),
    ]
  );
}

/**
 * A dependency — a `uml:Usage` when its label carries one of Annex C's usage
 * keywords, a plain `uml:Dependency` otherwise.
 *
 * `«use»`, `«call»` and `«create»` are not decoration on a dashed arrow: Table
 * C.1 gives all three the metamodel element `Usage`, so an arrow labelled `«use»`
 * IS a Usage and writing it as a bare Dependency would throw away the one thing
 * the author said about it.
 */
function dependencyElement(
  relation: UmlRelation,
  plan: XmiPlan
): XmlElement | undefined {
  const client = plan.idOf.get(relation.sourceId);
  const supplier = plan.idOf.get(relation.targetId);
  if (!client || !supplier) return undefined;

  const label = relation.label ?? '';
  const isUsage = [...USAGE_KEYWORDS].some(keyword =>
    label.toLowerCase().includes(keyword)
  );

  return el('packagedElement', {
    'xmi:type': isUsage ? 'uml:Usage' : 'uml:Dependency',
    'xmi:id': plan.ids.mint(),
    ...(relation.label ? { name: relation.label } : {}),
    client,
    supplier,
  });
}

/** A realization whose far end is not an Interface — see {@link classifierElement}. */
function realizationElement(
  relation: UmlRelation,
  plan: XmiPlan
): XmlElement | undefined {
  const client = plan.idOf.get(relation.sourceId);
  const supplier = plan.idOf.get(relation.targetId);
  if (!client || !supplier) return undefined;
  return el('packagedElement', {
    'xmi:type': 'uml:Realization',
    'xmi:id': plan.ids.mint(),
    ...(relation.label ? { name: relation.label } : {}),
    client,
    supplier,
  });
}

/* ── One diagram ──────────────────────────────────────────────────────── */

/**
 * One diagram as a `uml:Package`.
 *
 * A package per diagram even when there is only one, because a `uml:Model` with
 * loose classifiers in it says the four sheets an architect drew are one
 * namespace, which is exactly the merge ADR 0017 refuses on the canvas.
 */
function diagramPackage(model: UmlModel, plan: XmiPlan): XmlElement {
  const children: XmlElement[] = [];

  /** Where each classifier and sub-package is drawn — §12.2.4's containment. */
  const packageOf = new Map<string, string | undefined>();
  for (const pkg of model.packages) {
    packageOf.set(pkg.id, containerOf(pkg, model.packages, true)?.id);
  }
  for (const classifier of model.classifiers) {
    packageOf.set(classifier.id, containerOf(classifier, model.packages)?.id);
  }

  /** Which subject a use case sits in — §18.1.4's. */
  const subjectOf = new Map<string, string | undefined>();
  for (const useCase of model.useCases) {
    subjectOf.set(useCase.id, containerOf(useCase, model.subjects)?.id);
  }

  const packageElement = (pkg: UmlNodeBase): XmlElement => {
    const inner: XmlElement[] = [];
    for (const nested of model.packages) {
      if (packageOf.get(nested.id) === pkg.id)
        inner.push(packageElement(nested));
    }
    for (const classifier of model.classifiers) {
      if (packageOf.get(classifier.id) === pkg.id) {
        inner.push(classifierElement(classifier, model, plan));
      }
    }
    const extension = keywordExtension(pkg.keywords);
    if (extension) inner.push(extension);
    return el(
      'packagedElement',
      {
        'xmi:type': 'uml:Package',
        'xmi:id': plan.idOf.get(pkg.id)!,
        name: pkg.name,
      },
      inner
    );
  };

  for (const pkg of model.packages) {
    if (!packageOf.get(pkg.id)) children.push(packageElement(pkg));
  }
  for (const classifier of model.classifiers) {
    if (!packageOf.get(classifier.id)) {
      children.push(classifierElement(classifier, model, plan));
    }
  }
  for (const actor of model.actors) {
    const extension = keywordExtension(actor.keywords);
    children.push(
      el(
        'packagedElement',
        {
          'xmi:type': 'uml:Actor',
          'xmi:id': plan.idOf.get(actor.id)!,
          name: actor.name,
        },
        extension ? [extension] : []
      )
    );
  }
  for (const subject of model.subjects) {
    // The subject of a use case diagram is a Classifier, and the cases drawn
    // inside it are its `ownedUseCase`s (§18.1.4) — which is containment, not a
    // reference, so they are serialized here rather than beside it.
    const owned = model.useCases
      .filter(useCase => subjectOf.get(useCase.id) === subject.id)
      .map(useCase => {
        const element = useCaseElement(useCase, model, plan);
        return el('ownedUseCase', element.attrs, element.children);
      });
    children.push(
      el(
        'packagedElement',
        {
          'xmi:type': 'uml:Component',
          'xmi:id': plan.idOf.get(subject.id)!,
          name: subject.name,
        },
        owned
      )
    );
  }
  for (const useCase of model.useCases) {
    if (!subjectOf.get(useCase.id)) {
      children.push(useCaseElement(useCase, model, plan));
    }
  }

  // Relationships that are packaged elements in their own right, owned by the
  // diagram's package: the nearest common namespace of their two ends, which
  // for one sheet is the sheet.
  for (const relation of model.relations) {
    let element: XmlElement | undefined;
    switch (relation.kind) {
      case 'association':
      case 'aggregation':
      case 'composition':
        element = associationElement(relation, plan);
        break;
      case 'dependency':
        element = dependencyElement(relation, plan);
        break;
      case 'realization':
        element =
          plan.kindOf.get(relation.targetId) === 'interface'
            ? undefined
            : realizationElement(relation, plan);
        break;
      // Written by the element that OWNS them, above.
      case 'generalization':
      case 'include':
      case 'extend':
      // Not a model relationship at all: an anchor attaches a Comment, and it
      // is written as that Comment's `annotatedElement`.
      case 'anchor':
        element = undefined;
        break;
      default: {
        // Exhaustive: a relationship added to the union with nothing to write
        // it as fails the build here rather than vanishing from a file.
        const never: never = relation.kind;
        throw new Error(`unhandled UML relation: ${String(never)}`);
      }
    }
    if (element) children.push(element);
  }

  for (const note of model.notes) {
    const anchored = model.relations
      .filter(relation => relation.kind === 'anchor')
      .map(relation =>
        relation.sourceId === note.id
          ? relation.targetId
          : relation.targetId === note.id
            ? relation.sourceId
            : undefined
      )
      .map(id => (id ? plan.idOf.get(id) : undefined))
      .filter((id): id is string => Boolean(id));

    children.push(
      el('ownedComment', {
        'xmi:type': 'uml:Comment',
        'xmi:id': plan.idOf.get(note.id)!,
        ...(anchored.length > 0
          ? { annotatedElement: anchored.join(' ') }
          : {}),
        body: note.body,
      })
    );
  }

  // Which of Annex A's frame kinds this package was drawn as — the one fact the
  // UML metamodel has no slot for, kept where XMI puts tool data.
  children.push(
    el('xmi:Extension', { extender: EXTENDER }, [
      el('diagram', { kind: model.diagram.kind }),
    ])
  );

  return el(
    'packagedElement',
    {
      'xmi:type': 'uml:Package',
      'xmi:id': plan.idOf.get(model.diagram.id)!,
      name: model.diagram.name || model.diagram.heading,
    },
    children
  );
}

/* ── The document ─────────────────────────────────────────────────────── */

/**
 * Every diagram as one XMI document — one `uml:Model`, one package per diagram.
 *
 * A LIST rather than a single model, because that is what the format wants: XMI
 * carries a whole model, and four sheets of one architecture are four packages
 * of it, not four files. Exporting one diagram is `exportXmi([model])` and
 * produces the same shape, which is what keeps a one-diagram file and a
 * four-diagram file readable by the same importer.
 */
export function exportXmi(
  models: readonly UmlModel[],
  options: UmlXmiOptions = {}
): string {
  const ids = new Ids();
  // The root takes `_1` before anything else, so the model element of a file is
  // always the first id in it.
  const rootId = ids.mint();
  const plan = planOf(models, ids);

  const children = models.map(model => diagramPackage(model, plan));

  // The DataTypes nothing on the canvas answered for, declared once at the root
  // so every package that mentions one refers to the same element.
  for (const [name, id] of plan.synthesized) {
    children.push(
      el('packagedElement', {
        'xmi:type': 'uml:DataType',
        'xmi:id': id,
        name,
      })
    );
  }

  return serializeDocument(
    el(
      'uml:Model',
      {
        'xmi:version': XMI_VERSION,
        'xmlns:xmi': XMI_NAMESPACE,
        'xmlns:uml': UML_NAMESPACE,
        'xmi:id': rootId,
        name: options.name || 'Model',
      },
      children
    )
  );
}
