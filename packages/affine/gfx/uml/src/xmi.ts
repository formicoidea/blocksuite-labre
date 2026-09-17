import type { UmlBox } from './component.js';
import {
  type UmlAssociationEnd,
  type UmlMultiplicity,
  type UmlOperation,
  type UmlProperty,
  parseTrigger,
} from './grammar.js';
import {
  type UmlActivity,
  type UmlActivityEdge,
  type UmlActivityNode,
  type UmlActivityNodeKind,
  type UmlArtifactNode,
  type UmlClassifier,
  type UmlComponentNode,
  type UmlDeploymentNode,
  type UmlInteraction,
  type UmlMessageKind,
  type UmlModel,
  type UmlNodeBase,
  type UmlPseudostateKind,
  type UmlRegion,
  type UmlRelation,
  type UmlStateMachine,
  type UmlTimelineEntry,
  umlCentreInside,
  umlInteractionTimeline,
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

/**
 * The `xmi:type` each deployment cube is serialized as (§19.4.2).
 *
 * Three metaclasses for one glyph: §19.4.4 draws a Device as "a Node graphic
 * with the keyword «device»" and an ExecutionEnvironment as a Node annotated
 * with its own, so the cube is the same drawing and the TYPE is the whole of the
 * difference. Total over the discriminant, so a fourth cube cannot land without
 * being given a metaclass.
 */
const DEPLOYMENT_TYPE: Record<UmlDeploymentNode['kind'], string> = {
  node: 'uml:Node',
  device: 'uml:Device',
  'execution-environment': 'uml:ExecutionEnvironment',
};

/**
 * The keywords the structural metaclasses already state.
 *
 * `«component»` on a component box, `«artifact»` on an artefact, `«device»` on a
 * device: each is the stencil's own seed (`keywords.ts`), each is what the
 * `xmi:type` beside it says, and carrying it into the extension as well would
 * file a tool-specific note whose only content is the element's own metaclass.
 * The same reading {@link METACLASS_KEYWORDS} makes for the classifiers.
 */
const STRUCTURAL_KEYWORDS = new Set([
  'component',
  'artifact',
  'node',
  'device',
  'executionenvironment',
  'execution environment',
]);

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
  /**
   * Interaction NAME → `xmi:id`, first declaration wins — what a §17.7.4
   * `ref` resolves against.
   *
   * By NAME and not by id, because that is what the notation gives: an
   * InteractionUse's box carries the name of the interaction it stands for, and
   * a canvas holds no link from one sheet to another. Two sheets called the
   * same thing are one name in one `uml:Model`, and document order is the
   * tie-break everything else in this framework breaks on.
   */
  interactionByName: Map<string, string>;
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
    interactionByName: new Map(),
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
    // Phase 2, appended AFTER the phase-1 claims and never interleaved with
    // them: the ids are minted in the order they are asked for, so a model with
    // no structural artefacts mints none here and exports to exactly the bytes
    // it exported to before these four lines existed. That is what makes a
    // golden document a regression test rather than a chore.
    for (const component of model.components) {
      claim(component);
      // A port is an `ownedAttribute` and therefore referenceable: §11.6.4's own
      // figure wires a Dependency between two of them.
      for (const port of component.ports) claim(port);
    }
    for (const artifact of model.artifacts) claim(artifact);
    for (const node of model.nodes) claim(node);
    // The behaviour sheets, appended after the structural claims and never
    // interleaved with them, for the reason the four lines above give: a model
    // with no flow on it mints nothing here and exports to exactly the bytes it
    // exported to before these lines existed.
    //
    // Everything a REFERENCE can reach is claimed. An activity edge names its
    // two ends, a partition lists its nodes, a transition names its source and
    // its target, and a composite state is pointed at by nothing but is a
    // `uml:State` all the same — so every drawn glyph gets an id and the
    // minted-on-the-spot ones (the edges, the triggers, the regions) are exactly
    // the elements nothing refers to.
    for (const activity of model.activities) {
      for (const node of activity.nodes) claim(node);
      for (const partition of activity.partitions) claim(partition);
    }
    for (const machine of model.stateMachines) {
      for (const region of machine.regions) claim(region);
      for (const state of machine.states) claim(state);
      for (const final of machine.finalStates) claim(final);
      for (const pseudo of machine.pseudostates) claim(pseudo);
    }
    // Phase 3, appended after the phase-2 claims for the reason those were
    // appended after phase 1's: a model with no conversation on it mints
    // nothing here and exports to exactly the bytes it exported to before these
    // lines existed.
    //
    // The Interaction takes the SHEET's own id, not one of its own: §17.2.4
    // draws the interaction as the frame, so the package and the Interaction are
    // two elements of one sheet and each needs an id — hence the mint here
    // beside, rather than reusing the package's.
    for (const interaction of model.interactions) {
      plan.idOf.set(`${interaction.id}#interaction`, ids.mint());
      if (
        interaction.name &&
        !plan.interactionByName.has(interaction.name.trim())
      ) {
        plan.interactionByName.set(
          interaction.name.trim(),
          plan.idOf.get(`${interaction.id}#interaction`)!
        );
      }
      for (const lifeline of interaction.lifelines) claim(lifeline);
      for (const execution of interaction.executions) claim(execution);
      for (const destruction of interaction.destructions) claim(destruction);
      for (const fragment of interaction.fragments) claim(fragment);
      // A message is claimed like an artefact: its two occurrences point back
      // at it, and an occurrence written before the message it names is the
      // ordinary case (§17.4 owns the Messages on the Interaction, the
      // occurrences in the ordered fragment list).
      for (const message of interaction.messages) {
        plan.idOf.set(message.id, ids.mint());
      }
    }
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
function keywordExtension(
  keywords: readonly string[],
  stated: ReadonlySet<string> = METACLASS_KEYWORDS
): XmlElement | undefined {
  const extra = keywords.filter(keyword => !stated.has(keyword.toLowerCase()));
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

/* ── Structural artefacts (§11.6, §19.3, §19.4) ───────────────────────── */

/**
 * One component as a `packagedElement`, with its ports and its two kinds of
 * interface.
 *
 * ## The interfaces are MINTED, and that is the whole difficulty
 *
 * A lollipop on this canvas is a circle with a name written beside it — §10.4.4
 * draws exactly that, and nothing else — so the model holds a STRING where XMI
 * needs an element. There is no honest alternative to minting one: an
 * `InterfaceRealization`'s `contract` is typed `Interface` in the metamodel, so
 * a realization pointing at nothing is a reference no importer can resolve, and
 * dropping the lollipop would throw away the only statement the author made
 * about what the component offers.
 *
 * The minted `uml:Interface` is a `packagedElement` of the COMPONENT rather than
 * of the diagram's package, which §11.6.4's "packaged elements" compartment is
 * the notation for: it is the component's own declaration of the contract it
 * realizes, and putting it at the sheet level would make two components that
 * both provide `IOrder` look like one shared interface the author never drew.
 * Two components providing the same name therefore produce two Interfaces, and
 * that is the honest reading of two lollipops — a drawing that means one
 * interface draws it once and wires both components to it, which is the
 * rectangle notation §11.6.4 offers for exactly this case.
 *
 * ## Provided is an `interfaceRealization`, required is a `uml:Usage`
 *
 * §10.4.4 in as many words: the ball notation IS an InterfaceRealization
 * dependency from the classifier to the interface, and the socket IS a Usage
 * dependency. So the two glyphs are not two decorations on one relationship,
 * they are two different metaclasses, and a writer that collapsed them would
 * lose the direction of every dependency on the sheet.
 */
function componentElement(
  component: UmlComponentNode,
  plan: XmiPlan
): XmlElement {
  const id = plan.idOf.get(component.id)!;
  const children: XmlElement[] = [];

  for (const port of component.ports) {
    const portId = plan.idOf.get(port.id);
    if (!portId) continue;
    children.push(
      el('ownedAttribute', {
        'xmi:type': 'uml:Port',
        'xmi:id': portId,
        // §11.3.4: "The name of a Port may be suppressed. Every depiction of an
        // unnamed Port denotes a different Port from any other Port." So an
        // unnamed square is a port with no `name` attribute, never a port called
        // the empty string.
        ...(port.name ? { name: port.name } : {}),
      })
    );
  }

  for (const name of component.provided) {
    const interfaceId = plan.ids.mint();
    children.push(
      el('packagedElement', {
        'xmi:type': 'uml:Interface',
        'xmi:id': interfaceId,
        name,
      }),
      el('interfaceRealization', {
        'xmi:type': 'uml:InterfaceRealization',
        'xmi:id': plan.ids.mint(),
        client: id,
        supplier: interfaceId,
        contract: interfaceId,
      })
    );
  }
  for (const name of component.required) {
    const interfaceId = plan.ids.mint();
    children.push(
      el('packagedElement', {
        'xmi:type': 'uml:Interface',
        'xmi:id': interfaceId,
        name,
      }),
      el('packagedElement', {
        'xmi:type': 'uml:Usage',
        'xmi:id': plan.ids.mint(),
        client: id,
        supplier: interfaceId,
      })
    );
  }

  const extension = keywordExtension(component.keywords, STRUCTURAL_KEYWORDS);
  if (extension) children.push(extension);

  return el(
    'packagedElement',
    {
      'xmi:type': 'uml:Component',
      'xmi:id': id,
      name: component.name,
      ...(component.isAbstract ? { isAbstract: 'true' } : {}),
    },
    children
  );
}

/**
 * One artefact, with the Manifestations it OWNS (§19.3.2).
 *
 * The manifestation is a child rather than a sibling because the metamodel says
 * so — `Artifact::manifestation` subsets `ownedElement` — and because it is
 * meaningless detached from the file that does the manifesting, exactly as a
 * Generalization is meaningless detached from the specific classifier.
 *
 * Three attributes for two facts: `utilizedElement` subsets `supplier` and both
 * have to be written, because `utilizedElement` is the name the Manifestation
 * metaclass gives the end and `supplier` is the one `Dependency` gives it, and
 * an importer reading only the general form would otherwise find the dependency
 * empty.
 */
function artifactElement(
  artifact: UmlArtifactNode,
  model: UmlModel,
  plan: XmiPlan
): XmlElement {
  const id = plan.idOf.get(artifact.id)!;
  const children: XmlElement[] = [];

  for (const relation of model.relations) {
    if (relation.kind !== 'manifest' || relation.sourceId !== artifact.id) {
      continue;
    }
    const utilized = plan.idOf.get(relation.targetId);
    if (!utilized) continue;
    children.push(
      el('manifestation', {
        'xmi:type': 'uml:Manifestation',
        'xmi:id': plan.ids.mint(),
        ...(relation.label ? { name: relation.label } : {}),
        client: id,
        supplier: utilized,
        utilizedElement: utilized,
      })
    );
  }

  const extension = keywordExtension(artifact.keywords, STRUCTURAL_KEYWORDS);
  if (extension) children.push(extension);

  return el(
    'packagedElement',
    {
      'xmi:type': 'uml:Artifact',
      'xmi:id': id,
      name: artifact.name,
    },
    children
  );
}

/**
 * One node, device or execution environment, with the Deployments it OWNS.
 *
 * `Deployment::location` subsets both `client` and `owner` — the target is where
 * the deployment LIVES in the metamodel — so the element is a child of the cube
 * and names it back, and `deployedArtifact` subsets `supplier` the way
 * `utilizedElement` does one metaclass over. Writing all four is the same
 * belt-and-braces {@link artifactElement} explains: the specific names are what
 * a UML importer reads, the general ones are what a generic XMI reader reads,
 * and they cannot disagree because they are minted from one id.
 *
 * §19.2.4 also allows the artefacts to be drawn INSIDE the cube instead of being
 * joined to it by an arrow. This writer reads the arrow alone: nesting is
 * geometry, and the two ways of saying it produce the same `deployment` element,
 * so the day the canvas learns to read a nested artefact nothing in this
 * function changes.
 */
function deploymentNodeElement(
  node: UmlDeploymentNode,
  model: UmlModel,
  plan: XmiPlan
): XmlElement {
  const id = plan.idOf.get(node.id)!;
  const children: XmlElement[] = [];

  for (const relation of model.relations) {
    if (relation.kind !== 'deploy' || relation.targetId !== node.id) continue;
    const artifact = plan.idOf.get(relation.sourceId);
    if (!artifact) continue;
    children.push(
      el('deployment', {
        'xmi:type': 'uml:Deployment',
        'xmi:id': plan.ids.mint(),
        ...(relation.label ? { name: relation.label } : {}),
        client: id,
        supplier: artifact,
        location: id,
        deployedArtifact: artifact,
      })
    );
  }

  const extension = keywordExtension(node.keywords, STRUCTURAL_KEYWORDS);
  if (extension) children.push(extension);

  return el(
    'packagedElement',
    {
      'xmi:type': DEPLOYMENT_TYPE[node.kind],
      'xmi:id': id,
      name: node.name,
    },
    children
  );
}

/* ── Behaviour artefacts (§15.2, §14.2) ───────────────────────────────── */

/**
 * The metaclass each activity glyph is written as — §15.7's own names.
 *
 * `uml:OpaqueAction` for the rounded rectangle, because that is the Action a
 * drawing states: §16.2 makes OpaqueAction the one whose behaviour is given as
 * a text nobody has to interpret, which is exactly what a box with a sentence in
 * it says. Every stronger reading — a CallBehaviorAction, a CallOperationAction
 * — would need a Behavior or an Operation to point at, and the drawing names
 * none.
 *
 * `uml:ForkNode` for the bar, and the join is NOT told apart here: §15.3.4
 * draws one bar for both and `roles.ts` gives it one role, so the file says what
 * the picture says. An importer counting the edges gets the same answer a reader
 * does.
 *
 * `Record<UmlActivityNodeKind, string>` and therefore compile-total: a glyph
 * appended to the union with no metaclass to write it as fails the build here
 * rather than vanishing from a file.
 */
const ACTIVITY_NODE_TYPE: Record<UmlActivityNodeKind, string> = {
  action: 'uml:OpaqueAction',
  initial: 'uml:InitialNode',
  'activity-final': 'uml:ActivityFinalNode',
  'flow-final': 'uml:FlowFinalNode',
  decision: 'uml:DecisionNode',
  fork: 'uml:ForkNode',
  'object-node': 'uml:ObjectNode',
  'send-signal': 'uml:SendSignalAction',
  'accept-event': 'uml:AcceptEventAction',
  // §16.10.4's hourglass IS an AcceptEventAction — the one whose trigger names a
  // TimeEvent. The metamodel has no `AcceptTimeEventAction`, and inventing one
  // would produce a file no importer can read.
  'time-event': 'uml:AcceptEventAction',
};

/** The `kind` attribute §14.5.7's PseudostateKind enumeration spells. */
const PSEUDOSTATE_KIND: Record<UmlPseudostateKind, string> = {
  initial: 'initial',
  choice: 'choice',
  junction: 'junction',
  'shallow-history': 'shallowHistory',
  'deep-history': 'deepHistory',
  'entry-point': 'entryPoint',
  'exit-point': 'exitPoint',
  terminate: 'terminate',
  // §14.2.4 draws the fork and the join as one bar, like §15.3.4 does. One role,
  // one PseudostateKind written, and the edges say which it is.
  fork: 'fork',
};

/** An `OpaqueExpression` carrying a body — §8.3's text-valued specification. */
function opaqueExpression(
  tag: string,
  body: string,
  plan: XmiPlan
): XmlElement {
  return el(tag, {
    'xmi:type': 'uml:OpaqueExpression',
    'xmi:id': plan.ids.mint(),
    body,
  });
}

/** An `OpaqueBehavior` carrying a body — a state's entry, do or exit. */
function opaqueBehavior(tag: string, body: string, plan: XmiPlan): XmlElement {
  return el(tag, {
    'xmi:type': 'uml:OpaqueBehavior',
    'xmi:id': plan.ids.mint(),
    name: body,
    body,
  });
}

/**
 * Everything an activity writes BESIDE itself, and the Signals it shares.
 *
 * A SendSignalAction's `signal` and a SignalEvent's `signal` are REFERENCES in
 * the metamodel, not containments, so the Signal has to exist somewhere a
 * reference can reach — and a Signal is a PackageableElement, so that somewhere
 * is the diagram's own package rather than the Activity. Hence the side list:
 * {@link activityElements} returns the Activity plus whatever it had to mint,
 * and the package writer splices them in.
 *
 * Minted once per NAME within one sheet, because two `Order placed` glyphs are
 * one signal: that is what the name means, and two elements would make an
 * importer show two unrelated events with the same label.
 */
interface BehaviourSideElements {
  /** `packagedElement`s the sheet has to carry for the references to resolve. */
  extras: XmlElement[];
  /** Signal name → its `xmi:id`, so one name mints one Signal. */
  signals: Map<string, string>;
}

function signalIdFor(
  name: string,
  side: BehaviourSideElements,
  plan: XmiPlan
): string {
  const known = side.signals.get(name);
  if (known) return known;
  const id = plan.ids.mint();
  side.signals.set(name, id);
  side.extras.push(
    el('packagedElement', {
      'xmi:type': 'uml:Signal',
      'xmi:id': id,
      name,
    })
  );
  return id;
}

/**
 * One activity node as an `<node>` of its Activity.
 *
 * The three event-shaped glyphs are the only ones that cost more than a line,
 * and each costs what the metamodel charges:
 *
 *  - a **send signal** names the Signal it sends (§16.3.3), which is a
 *    reference, so the Signal is minted beside the Activity;
 *  - an **accept event** carries a Trigger whose Event is a SignalEvent
 *    (§16.10.3) — a reference again, so both the event and its signal are
 *    minted beside;
 *  - a **time event** carries a Trigger whose Event is a TimeEvent, and its
 *    `when` IS a containment (`{subsets ownedElement}`), so the TimeExpression
 *    is written inside it. `isRelative` comes from the glyph's own words through
 *    {@link parseTrigger}: `after` is relative, `at` is absolute, and §13.3.4
 *    says so in exactly those terms.
 *
 * A control node writes NO `name` attribute. §15.3.4 gives the disc, the
 * bullseye, the crossed circle, the diamond and the bar no label at all, and the
 * creation site draws none, so an empty `name=""` would be this writer inventing
 * a nameless element where the notation has an unnamed one.
 */
function activityNodeElement(
  node: UmlActivityNode,
  side: BehaviourSideElements,
  plan: XmiPlan
): XmlElement {
  const id = plan.idOf.get(node.id)!;
  const name = node.name.trim();
  const children: XmlElement[] = [];
  const attrs: XmlAttrs = {
    'xmi:type': ACTIVITY_NODE_TYPE[node.kind],
    'xmi:id': id,
  };

  if (node.kind === 'send-signal') {
    attrs.signal = signalIdFor(name || 'Signal', side, plan);
  } else if (node.kind === 'accept-event') {
    const eventId = plan.ids.mint();
    side.extras.push(
      el('packagedElement', {
        'xmi:type': 'uml:SignalEvent',
        'xmi:id': eventId,
        ...(name ? { name } : {}),
        signal: signalIdFor(name || 'Signal', side, plan),
      })
    );
    children.push(
      el('trigger', {
        'xmi:type': 'uml:Trigger',
        'xmi:id': plan.ids.mint(),
        ...(name ? { name } : {}),
        event: eventId,
      })
    );
  } else if (node.kind === 'time-event') {
    const trigger = parseTrigger(name);
    const eventId = plan.ids.mint();
    side.extras.push(
      el(
        'packagedElement',
        {
          'xmi:type': 'uml:TimeEvent',
          'xmi:id': eventId,
          ...(name ? { name } : {}),
          // §13.3.3.4: `after` is a relative TimeEvent, `at` an absolute one.
          // Written only when TRUE, like every other boolean in this file.
          ...(trigger.kind === 'relative-time' ? { isRelative: 'true' } : {}),
        },
        [
          el(
            'when',
            { 'xmi:type': 'uml:TimeExpression', 'xmi:id': plan.ids.mint() },
            [
              el('expr', {
                'xmi:type': 'uml:LiteralString',
                'xmi:id': plan.ids.mint(),
                // The TimeExpression, without the keyword that classified it —
                // `after 5 s` is a relative event whose expression is `5 s`, and
                // writing the keyword into the value would make an importer
                // wait "after after 5 s".
                value: trigger.expression ?? name,
              }),
            ]
          ),
        ]
      )
    );
    children.push(
      el('trigger', {
        'xmi:type': 'uml:Trigger',
        'xmi:id': plan.ids.mint(),
        ...(name ? { name } : {}),
        event: eventId,
      })
    );
  }

  // The control nodes stay unnamed — see the header.
  const named =
    node.kind === 'initial' ||
    node.kind === 'activity-final' ||
    node.kind === 'flow-final' ||
    node.kind === 'decision' ||
    node.kind === 'fork'
      ? {}
      : name
        ? { name }
        : {};

  return el('node', { ...attrs, ...named }, children);
}

/**
 * One activity edge as an `<edge>` of its Activity.
 *
 * `guard` and `weight` are both `{subsets ownedElement}` on ActivityEdge, so
 * both are written as CHILDREN — a guard as the OpaqueExpression §15.2.4's
 * bracketed text is, a weight as a LiteralInteger when it is a plain number and
 * a LiteralUnlimitedNatural when the author wrote `*`. §15.2.4 admits any
 * ValueSpecification there; anything this writer cannot read as a number goes
 * through as an OpaqueExpression, which keeps the author's words and asks an
 * importer to interpret them.
 *
 * An end this sheet has no id for is an edge the file cannot carry, and it is
 * skipped rather than written with a dangling reference — the same call
 * {@link associationElement} makes. `umlModelFrom` has already warned the
 * author about it.
 */
function activityEdgeElement(
  edge: UmlActivityEdge,
  plan: XmiPlan
): XmlElement | undefined {
  const source = plan.idOf.get(edge.sourceId);
  const target = plan.idOf.get(edge.targetId);
  if (!source || !target) return undefined;

  const children: XmlElement[] = [];
  if (edge.guard) children.push(opaqueExpression('guard', edge.guard, plan));
  if (edge.weight) {
    const weight = edge.weight.trim();
    children.push(
      weight === '*'
        ? el('weight', {
            'xmi:type': 'uml:LiteralUnlimitedNatural',
            'xmi:id': plan.ids.mint(),
            value: '*',
          })
        : /^\d+$/.test(weight)
          ? el('weight', {
              'xmi:type': 'uml:LiteralInteger',
              'xmi:id': plan.ids.mint(),
              value: weight,
            })
          : opaqueExpression('weight', weight, plan)
    );
  }

  return el(
    'edge',
    {
      'xmi:type':
        edge.kind === 'object-flow' ? 'uml:ObjectFlow' : 'uml:ControlFlow',
      'xmi:id': plan.ids.mint(),
      ...(edge.name ? { name: edge.name } : {}),
      source,
      target,
    },
    children
  );
}

/**
 * One Activity as a `packagedElement`, and whatever it had to mint beside
 * itself.
 *
 * The partitions are `group`s — §15.6.2 makes ActivityPartition an
 * ActivityGroup, and `Activity::group` is where a group lives — each listing the
 * nodes it holds as a space-separated `node` idref list, which is how XMI writes
 * a multi-valued reference. The membership itself came from geometry
 * (`model.ts`), so a lane the author widened takes the actions it now covers and
 * the file follows the drawing.
 *
 * `isReadOnly`, `isSingleExecution` and the pre/post-conditions of §15.2.4 are
 * not written: the notation states none of them on this canvas, and a default
 * spelled out is a fact nobody stated.
 */
function activityElements(activity: UmlActivity, plan: XmiPlan): XmlElement[] {
  const side: BehaviourSideElements = { extras: [], signals: new Map() };
  const children: XmlElement[] = [];

  for (const node of activity.nodes) {
    children.push(activityNodeElement(node, side, plan));
  }
  for (const edge of activity.edges) {
    const element = activityEdgeElement(edge, plan);
    if (element) children.push(element);
  }
  for (const partition of activity.partitions) {
    const nodes = partition.nodeIds
      .map(nodeId => plan.idOf.get(nodeId))
      .filter((nodeId): nodeId is string => Boolean(nodeId));
    children.push(
      el('group', {
        'xmi:type': 'uml:ActivityPartition',
        'xmi:id': plan.idOf.get(partition.id)!,
        name: partition.name,
        ...(nodes.length > 0 ? { node: nodes.join(' ') } : {}),
      })
    );
  }

  return [
    ...side.extras,
    el(
      'packagedElement',
      {
        'xmi:type': 'uml:Activity',
        'xmi:id': plan.ids.mint(),
        name: activity.name,
      },
      children
    ),
  ];
}

/** One state's vertices, as the `<subvertex>`es of the region that holds them. */
function subvertexElements(
  machine: UmlStateMachine,
  regionId: string | undefined,
  plan: XmiPlan
): XmlElement[] {
  const children: XmlElement[] = [];

  for (const state of machine.states) {
    if (state.regionId !== regionId) continue;
    const inner: XmlElement[] = [];
    for (const body of state.entry) {
      inner.push(opaqueBehavior('entry', body, plan));
    }
    for (const body of state.doActivity) {
      inner.push(opaqueBehavior('doActivity', body, plan));
    }
    for (const body of state.exit) {
      inner.push(opaqueBehavior('exit', body, plan));
    }
    children.push(
      el(
        'subvertex',
        {
          'xmi:type': 'uml:State',
          'xmi:id': plan.idOf.get(state.id)!,
          name: state.name,
        },
        inner
      )
    );
  }

  for (const final of machine.finalStates) {
    if (final.regionId !== regionId) continue;
    children.push(
      el('subvertex', {
        'xmi:type': 'uml:FinalState',
        'xmi:id': plan.idOf.get(final.id)!,
        // §14.2.4.5 draws the bullseye with no name, and the creation site
        // writes none. A named one is an author who named it.
        ...(final.name.trim() ? { name: final.name } : {}),
      })
    );
  }

  for (const pseudo of machine.pseudostates) {
    if (pseudo.regionId !== regionId) continue;
    children.push(
      el('subvertex', {
        'xmi:type': 'uml:Pseudostate',
        'xmi:id': plan.idOf.get(pseudo.id)!,
        ...(pseudo.name.trim() ? { name: pseudo.name } : {}),
        kind: PSEUDOSTATE_KIND[pseudo.kind],
      })
    );
  }

  // The COMPOSITE states drawn inside this region. Each is a `uml:State` with a
  // Region of its own — §14.2.4's decomposition compartment, and the shape
  // `roles.ts` records the canvas draws as a frame.
  for (const region of machine.regions) {
    if (region.parentId !== regionId) continue;
    children.push(
      el(
        'subvertex',
        {
          'xmi:type': 'uml:State',
          'xmi:id': plan.idOf.get(region.id)!,
          name: region.name,
        },
        [regionElement(machine, region, plan)]
      )
    );
  }

  return children;
}

/** One `<region>` — its vertices, and the transitions that run between them. */
function regionElement(
  machine: UmlStateMachine,
  region: UmlRegion | undefined,
  plan: XmiPlan
): XmlElement {
  const regionId = region?.id;
  const children: XmlElement[] = subvertexElements(machine, regionId, plan);

  // A transition belongs to the region its SOURCE is in — §14.5.12 owns a
  // Transition on a Region, and the source is the vertex the arc leaves. A
  // transition crossing out of a composite state is therefore written inside it,
  // which is where §14.2.4 draws it from.
  const regionOfVertex = new Map<string, string | undefined>();
  for (const state of machine.states) {
    regionOfVertex.set(state.id, state.regionId);
  }
  for (const final of machine.finalStates) {
    regionOfVertex.set(final.id, final.regionId);
  }
  for (const pseudo of machine.pseudostates) {
    regionOfVertex.set(pseudo.id, pseudo.regionId);
  }
  for (const nested of machine.regions) {
    regionOfVertex.set(nested.id, nested.parentId);
  }

  for (const transition of machine.transitions) {
    if (regionOfVertex.get(transition.sourceId) !== regionId) continue;
    const source = plan.idOf.get(transition.sourceId);
    const target = plan.idOf.get(transition.targetId);
    if (!source || !target) continue;

    const inner: XmlElement[] = [];
    for (const trigger of transition.triggers) {
      // A Trigger's `event` is a reference and this drawing names no Event
      // declaration — §14.2.4.8 says as much, "SignalEvent triggers and
      // CallEvent triggers are not distinguishable by syntax and must be
      // discriminated by their declaration elsewhere". So the Trigger carries
      // the author's word as its NAME and points at nothing, which an importer
      // can bind and this writer cannot honestly guess.
      inner.push(
        el('trigger', {
          'xmi:type': 'uml:Trigger',
          'xmi:id': plan.ids.mint(),
          name: trigger,
        })
      );
    }
    if (transition.guard) {
      // `Transition::guard` is a CONSTRAINT (`{subsets ownedElement}`), not a
      // ValueSpecification — which is where it differs from an ActivityEdge's,
      // one clause over. The expression goes in its `specification`.
      inner.push(
        el(
          'guard',
          { 'xmi:type': 'uml:Constraint', 'xmi:id': plan.ids.mint() },
          [opaqueExpression('specification', transition.guard, plan)]
        )
      );
    }
    if (transition.effect) {
      inner.push(opaqueBehavior('effect', transition.effect, plan));
    }

    children.push(
      el(
        'transition',
        {
          'xmi:type': 'uml:Transition',
          'xmi:id': plan.ids.mint(),
          source,
          target,
        },
        inner
      )
    );
  }

  return el(
    'region',
    {
      'xmi:type': 'uml:Region',
      // A Region is minted rather than claimed: the canvas draws the COMPOSITE
      // STATE (which is claimed, above) and never the region inside it, and the
      // top region of a machine is one §14.2.4 makes implicit — the frame IS it.
      // Nothing refers to a Region by id, so nothing needs it planned.
      'xmi:id': plan.ids.mint(),
      name: region ? region.name : machine.name,
    },
    children
  );
}

/**
 * One StateMachine as a `packagedElement`.
 *
 * ONE top-level Region, always, and the sheet's vertices that sit inside no
 * drawn composite state are its subvertices. §14.2.4 makes the top region
 * implicit — the frame IS it — so there is nothing on the canvas to read it off,
 * and a machine with no region drawn would otherwise have nowhere to put a
 * single state.
 *
 * Orthogonal regions — two or more side by side inside one composite state,
 * separated by a dashed line — are a PHASE 3 refinement and this writer cannot
 * produce one: the canvas draws a composite state as a single `umlRegion` box
 * (`roles.ts` records the arbitration), so every composite state here has
 * exactly one region. What is written is always a legal StateMachine; it is
 * simply never an orthogonal one.
 */
function stateMachineElement(
  machine: UmlStateMachine,
  plan: XmiPlan
): XmlElement {
  return el(
    'packagedElement',
    {
      'xmi:type': 'uml:StateMachine',
      'xmi:id': plan.ids.mint(),
      name: machine.name,
    },
    [regionElement(machine, undefined, plan)]
  );
}

/* ── Interactions (§17) ───────────────────────────────────────────────── */

/**
 * §17.4.3's `messageSort`, which is the one attribute that says WHAT KIND of
 * message an arrow is.
 *
 * A total map over {@link UmlMessageKind}, so a sixth arrow added to the union
 * fails the build here rather than exporting as a synchronous call.
 */
const MESSAGE_SORT: Record<UmlMessageKind, string> = {
  'message-sync': 'synchCall',
  'message-async': 'asynchCall',
  'message-reply': 'reply',
  'message-create': 'createMessage',
  'message-delete': 'deleteMessage',
};

/**
 * One Interaction as a `packagedElement` — its lifelines, the ordered account of
 * what happens on it, and its messages.
 *
 * ## The shape, and why the fragments are a tree
 *
 * §17.4.4's arrow is TWO things in the metamodel: a `Message`, owned by the
 * Interaction, and a pair of `MessageOccurrenceSpecification`s, which are
 * InteractionFragments and therefore live in the ORDERED `fragment` list that IS
 * the sequence. So the `<fragment>`s are written in time order, each pointing
 * back at its message, and the `<message>`s follow — which is where §17.4 puts
 * them (`Interaction::message` is a containment of its own) and what lets an
 * occurrence refer to one that has not been written yet.
 *
 * A CombinedFragment is a fragment like any other, and its operands OWN the
 * fragments drawn in their bands (§17.6.4). That nesting is
 * {@link umlInteractionTimeline}'s, computed once for both writers, which is why
 * an `alt`'s two branches hold the same messages here as they do in the `.puml`.
 *
 * ## What is written for an ExecutionSpecification
 *
 * Three elements, because the metamodel needs three: an
 * `ExecutionOccurrenceSpecification` where the bar starts, a
 * `BehaviorExecutionSpecification` pointing at both ends, and a second
 * occurrence where it finishes. §17.2.4's `start` and `finish` are
 * OccurrenceSpecifications, not heights, and a bar written with neither would be
 * an activation attached to no moment in the conversation.
 */
function interactionElement(
  interaction: UmlInteraction,
  plan: XmiPlan
): XmlElement {
  const children: XmlElement[] = [];

  for (const lifeline of interaction.lifelines) {
    // §17.3.4's `: <Type>` half, and the one fact about a lifeline the
    // metamodel has nowhere to put: `Lifeline::represents` wants a
    // ConnectableElement — a Property of the enclosing Classifier — and a
    // whiteboard has drawn no such Property. The author wrote a type NAME in a
    // head. So it travels where XMI 2.5.1 §7.9 puts what a tool knows and the
    // metamodel does not model, exactly as an Annex C keyword does, and comes
    // back as the same half of the same compartment.
    const extension =
      keywordExtension(lifeline.keywords) ??
      (lifeline.type ? el('xmi:Extension', { extender: EXTENDER }) : undefined);
    if (extension && lifeline.type) {
      extension.children.push(el('represents', { name: lifeline.type }));
    }
    children.push(
      el(
        'lifeline',
        {
          'xmi:type': 'uml:Lifeline',
          'xmi:id': plan.idOf.get(lifeline.id)!,
          name: lifeline.name,
        },
        extension ? [extension] : []
      )
    );
  }

  /** The `xmi:id` of the LIFELINE an end of a message is drawn on. */
  const spineOf = new Map<string, string>();
  for (const lifeline of interaction.lifelines) {
    const id = plan.idOf.get(lifeline.id);
    if (id) spineOf.set(lifeline.id, id);
  }
  for (const execution of interaction.executions) {
    const id = execution.lifelineId
      ? plan.idOf.get(execution.lifelineId)
      : undefined;
    if (id) spineOf.set(execution.id, id);
  }
  for (const destruction of interaction.destructions) {
    const id = destruction.lifelineId
      ? plan.idOf.get(destruction.lifelineId)
      : undefined;
    if (id) spineOf.set(destruction.id, id);
  }

  // Minted before the walk, because a BehaviorExecutionSpecification names the
  // occurrence it FINISHES at and that occurrence is written further down the
  // list. Two passes rather than a patched string — the reason `planOf` exists.
  const startOf = new Map<string, string>();
  const finishOf = new Map<string, string>();
  for (const execution of interaction.executions) {
    startOf.set(execution.id, plan.ids.mint());
    finishOf.set(execution.id, plan.ids.mint());
  }

  const sendOf = new Map<string, string>();
  const receiveOf = new Map<string, string>();
  for (const message of interaction.messages) {
    sendOf.set(message.id, plan.ids.mint());
    receiveOf.set(message.id, plan.ids.mint());
  }

  const fragmentsOf = (entries: readonly UmlTimelineEntry[]): XmlElement[] => {
    const out: XmlElement[] = [];
    for (const entry of entries) {
      switch (entry.at) {
        case 'message': {
          const { message } = entry;
          const from = spineOf.get(message.sourceId);
          const to = spineOf.get(message.targetId);
          const owned = plan.idOf.get(message.id)!;
          // An occurrence covers exactly one lifeline (§17.2.4), so an end this
          // sheet has no lifeline for writes no occurrence — and the Message
          // below writes no `sendEvent` for it either.
          if (from) {
            out.push(
              el('fragment', {
                'xmi:type': 'uml:MessageOccurrenceSpecification',
                'xmi:id': sendOf.get(message.id)!,
                covered: from,
                message: owned,
              })
            );
          }
          if (to) {
            out.push(
              el('fragment', {
                'xmi:type': 'uml:MessageOccurrenceSpecification',
                'xmi:id': receiveOf.get(message.id)!,
                covered: to,
                message: owned,
              })
            );
          }
          break;
        }
        case 'execution-start': {
          const { execution } = entry;
          const covered = spineOf.get(execution.id);
          out.push(
            el('fragment', {
              'xmi:type': 'uml:ExecutionOccurrenceSpecification',
              'xmi:id': startOf.get(execution.id)!,
              ...(covered ? { covered } : {}),
            }),
            el('fragment', {
              'xmi:type': 'uml:BehaviorExecutionSpecification',
              'xmi:id': plan.idOf.get(execution.id)!,
              ...(covered ? { covered } : {}),
              start: startOf.get(execution.id)!,
              finish: finishOf.get(execution.id)!,
            })
          );
          break;
        }
        case 'execution-finish': {
          const covered = spineOf.get(entry.execution.id);
          out.push(
            el('fragment', {
              'xmi:type': 'uml:ExecutionOccurrenceSpecification',
              'xmi:id': finishOf.get(entry.execution.id)!,
              ...(covered ? { covered } : {}),
            })
          );
          break;
        }
        case 'destruction': {
          const covered = spineOf.get(entry.destruction.id);
          out.push(
            el('fragment', {
              'xmi:type': 'uml:DestructionOccurrenceSpecification',
              'xmi:id': plan.idOf.get(entry.destruction.id)!,
              ...(covered ? { covered } : {}),
            })
          );
          break;
        }
        case 'fragment': {
          const { fragment, operands } = entry;
          const covered = fragment.coveredLifelineIds
            .map(id => plan.idOf.get(id))
            .filter((id): id is string => Boolean(id));
          if (fragment.operator === 'ref') {
            // §17.7.4's InteractionUse. `refersTo` when another sheet of this
            // document declares an Interaction of that name — which is the
            // whole point of a `ref` — and the NAME alone when nothing here
            // answers for it, because the author still said which interaction
            // they meant.
            const refersTo = plan.interactionByName.get(fragment.name.trim());
            out.push(
              el('fragment', {
                'xmi:type': 'uml:InteractionUse',
                'xmi:id': plan.idOf.get(fragment.id)!,
                ...(fragment.name ? { name: fragment.name } : {}),
                ...(covered.length > 0 ? { covered: covered.join(' ') } : {}),
                ...(refersTo ? { refersTo } : {}),
              })
            );
            // An InteractionUse owns no fragments, so anything drawn over it is
            // written beside it rather than lost.
            for (const band of operands) out.push(...fragmentsOf(band.entries));
            break;
          }
          out.push(
            el(
              'fragment',
              {
                'xmi:type': 'uml:CombinedFragment',
                'xmi:id': plan.idOf.get(fragment.id)!,
                ...(covered.length > 0 ? { covered: covered.join(' ') } : {}),
                interactionOperator: fragment.operator,
              },
              operands.map(band => {
                const inner: XmlElement[] = [];
                const guard = (band.operand.guard ?? '').trim();
                if (guard) {
                  inner.push(
                    el(
                      'guard',
                      {
                        'xmi:type': 'uml:InteractionConstraint',
                        'xmi:id': plan.ids.mint(),
                      },
                      [
                        el('specification', {
                          'xmi:type': 'uml:LiteralString',
                          'xmi:id': plan.ids.mint(),
                          value: guard,
                        }),
                      ]
                    )
                  );
                }
                inner.push(...fragmentsOf(band.entries));
                return el(
                  'operand',
                  {
                    'xmi:type': 'uml:InteractionOperand',
                    'xmi:id': plan.ids.mint(),
                  },
                  inner
                );
              })
            )
          );
          break;
        }
      }
    }
    return out;
  };

  children.push(...fragmentsOf(umlInteractionTimeline(interaction)));

  for (const message of interaction.messages) {
    const from = spineOf.get(message.sourceId);
    const to = spineOf.get(message.targetId);
    children.push(
      el('message', {
        'xmi:type': 'uml:Message',
        'xmi:id': plan.idOf.get(message.id)!,
        ...(message.label ? { name: message.label } : {}),
        messageSort: MESSAGE_SORT[message.kind],
        ...(from ? { sendEvent: sendOf.get(message.id)! } : {}),
        ...(to ? { receiveEvent: receiveOf.get(message.id)! } : {}),
      })
    );
  }

  return el(
    'packagedElement',
    {
      'xmi:type': 'uml:Interaction',
      'xmi:id': plan.idOf.get(`${interaction.id}#interaction`)!,
      name: interaction.name,
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
 *
 * ## Which `ownedEnd` an end LABEL lands on
 *
 * The one drawn at the same end. §11.5.4 defines an Association end as "the
 * connection between the line depicting an Association and the icon … depicting
 * the connected Classifier", and everything written near it — the name string,
 * the multiplicity, the visibility glyph — adorns the memberEnd whose TYPE is
 * that classifier. So `relation.sourceEnd` becomes the `ownedEnd` carrying
 * `<type idref="{source}">`, and `targetEnd` the one typed by the target.
 *
 * The question is worth stating because the OTHER reading is the familiar one:
 * where a Classifier owns the end (§11.5.4's dot notation — "the dot shows that
 * the model includes a Property of the type represented by the Classifier
 * touched by the dot. This Property is owned by the Classifier at the other
 * end"), the end drawn at B is an attribute OF A, and a writer that put the
 * adornments on the owning classifier's side would swap every multiplicity on
 * the diagram. It does not arise here: this writer owns BOTH ends on the
 * association and types each one explicitly, so "the end at X" and "the end
 * typed by X" are the same end, and the mapping is direct. `xmi-import.ts` reads
 * it back through the same identity.
 *
 * The aggregation flag is not a counter-example: §11.5.4 has the diamond drawn
 * at the end OPPOSITE the flagged one ("a hollow diamond is added as a terminal
 * adornment at the end of the Association line opposite the end marked with
 * aggregation = AggregationKind::shared"), which is precisely why it is the one
 * adornment written across the line rather than beside its own end.
 */
function associationElement(
  relation: UmlRelation,
  plan: XmiPlan,
  // §19.4.3: "A CommunicationPath is an Association between two
  // DeploymentTargets". A specialization of Association, drawn as one and
  // structured as one, so it takes this writer whole and differs by its
  // metaclass alone — which is the entire content of this parameter.
  type = 'uml:Association'
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
      'xmi:type': type,
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
          ...endAttrs(relation.sourceEnd),
        },
        [
          el('type', { 'xmi:idref': source }),
          ...multiplicityElements(relation.sourceEnd?.multiplicity, plan.ids),
        ]
      ),
      el(
        'ownedEnd',
        {
          'xmi:type': 'uml:Property',
          'xmi:id': targetEnd,
          association: id,
          ...endAttrs(relation.targetEnd),
          ...(aggregation ? { aggregation } : {}),
        },
        [
          el('type', { 'xmi:idref': target }),
          ...multiplicityElements(relation.targetEnd?.multiplicity, plan.ids),
        ]
      ),
    ]
  );
}

/**
 * The `name` and `visibility` of one association end, when the label said them.
 *
 * Nothing when it did not, which is what keeps a connector with no end labels
 * byte-identical to what phase 1 wrote: the fields are absent from the IR, so
 * the attributes are absent from the file, so every golden of a plain
 * association still matches character for character.
 */
function endAttrs(end: UmlAssociationEnd | undefined): XmlAttrs {
  if (!end) return {};
  return {
    ...(end.role ? { name: end.role } : {}),
    ...visibilityAttrs(end.visibility),
  };
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
  // The structural artefacts, flat at the sheet's own package. Unlike a class,
  // none of them is attributed to a drawn PACKAGE: §12.2.4's containment is a
  // statement about namespaces made by drawing a box round a classifier, and a
  // component diagram drawn inside a package frame is a drawing this pack does
  // not read that way yet. What the cubes DO contain is written as deployments,
  // which is a reference rather than a nesting.
  for (const component of model.components) {
    children.push(componentElement(component, plan));
  }
  for (const artifact of model.artifacts) {
    children.push(artifactElement(artifact, model, plan));
  }
  for (const node of model.nodes) {
    children.push(deploymentNodeElement(node, model, plan));
  }
  // The two behaviours. Each is a `packagedElement` of the sheet's own package —
  // an Activity and a StateMachine are both Behaviors and both PackageableElements
  // — and the Activity brings with it the Signals and Events its action glyphs
  // had to reference (see {@link BehaviourSideElements}).
  for (const activity of model.activities) {
    children.push(...activityElements(activity, plan));
  }
  for (const machine of model.stateMachines) {
    children.push(stateMachineElement(machine, plan));
  }
  // §17.2 — the Interaction, a Behavior and a PackageableElement like the other
  // two, and written after them for the reason they were written after the
  // structural artefacts: appended, never interleaved.
  for (const interaction of model.interactions) {
    children.push(interactionElement(interaction, plan));
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
      case 'communication-path':
        // §19.4.3 — an Association between two DeploymentTargets, and an
        // Association is a packaged element in its own right.
        element = associationElement(relation, plan, 'uml:CommunicationPath');
        break;
      // Written by the element that OWNS them, above.
      case 'generalization':
      case 'include':
      case 'extend':
      // …and the two structural dependencies, owned by the artefact that
      // manifests and by the cube that hosts (§19.3.2, §19.2.2).
      case 'manifest':
      case 'deploy':
      // …and the three behaviour edges, owned by the Activity and the
      // StateMachine that hold them: `Activity::edge` and `Region::transition`
      // are both containments, so a control flow written here as well would be
      // the same arrow in the file twice.
      case 'control-flow':
      case 'object-flow':
      case 'transition':
      // …and the five MESSAGES, owned by the Interaction that holds them
      // (`Interaction::message`) and written there in the ORDER §17.4.4 draws
      // them in, which is a fact a list of relations does not carry.
      case 'message-sync':
      case 'message-async':
      case 'message-reply':
      case 'message-create':
      case 'message-delete':
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
