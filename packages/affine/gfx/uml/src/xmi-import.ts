import type {
  InterchangeImportContext,
  InterchangeNote,
  InterchangeReport,
  SerializedElementProps,
} from '@labre/affine-block-surface';
import type { UmlDiagramKind, UmlFragmentOperator } from '@labre/affine-model';
import type { ForeignInterchange } from '@labre/std/gfx';

import type { UmlBox } from './component.js';
import {
  UML_SD_EVENT_STEP,
  umlSequenceColumn,
  umlSequenceDestruction,
  umlSequenceExecution,
  umlSequenceFragment,
  umlSequenceSlot,
} from './import.js';
import {
  type UmlAssociationEnd,
  type UmlMultiplicity,
  type UmlOperation,
  type UmlParameter,
  type UmlParameterDirection,
  type UmlProperty,
  type UmlVisibility,
  formatEndLabel,
} from './grammar.js';
import type {
  UmlActivity,
  UmlActivityEdge,
  UmlActivityNode,
  UmlActivityNodeKind,
  UmlClassifier,
  UmlComponentNode,
  UmlDeploymentNode,
  UmlDestruction,
  UmlExecution,
  UmlInteraction,
  UmlInteractionOperand,
  UmlLifeline,
  UmlMessageKind,
  UmlModel,
  UmlNodeBase,
  UmlPartition,
  UmlPort,
  UmlPseudostate,
  UmlPseudostateKind,
  UmlRelation,
  UmlRelationKind,
  UmlSlot,
  UmlStateMachine,
} from './model.js';
import {
  type XmlNode,
  readXml,
  xmlAttr,
  xmlChild,
  xmlChildren,
  xmlDescendants,
  xmlFragmentOf,
} from './xml-reader.js';

/**
 * An **XMI 2.5.1 document, read back as models** — the inverse of `xmi.ts`.
 *
 * ## The promise, and its exact shape
 *
 * The file our writer produces imports back to the model it was written from.
 * That is the round-trip `__tests__/xmi-import.unit.spec.ts` pins golden by
 * golden, and it is the only promise worth making about an interchange pair:
 * an architect who exports a sheet, opens it in Papyrus and brings it back must
 * find the same diagram, not a plausible one.
 *
 * What does NOT come back is what the writer never wrote (`xmi.ts`'s header
 * says so in as many words): **not one coordinate**. A UML model file carries a
 * model; the picture stays in Labre. So an import of our own export has no
 * geometry, the materializer invents a layout, and the report says so (ADR 0012
 * D4 — "it never claims a position it invented came from the file"). A file
 * from a tool that DOES ship diagram interchange — Papyrus's `.notation`, a
 * `umldi` island — is read for its shapes' bounds, and those are used verbatim.
 *
 * ## Preservation is the whole point (ADR 0012 D1, D2, D5)
 *
 * Everything this reader does not map is **quarantined verbatim**: the file's
 * own bytes, sliced out of the source ({@link xmlFragmentOf}), filed under the
 * nearest mapped ancestor's source id, and carried in the document forever.
 *
 * Quarantined and not *carried*, and the difference is not a hedge. D1's
 * "carried" state promises re-emission in place, and this framework has no
 * writer that could keep that promise: `xmi.ts` builds a document out of the IR
 * alone and has no slot anywhere in it for a verbatim fragment. A state that
 * says "kept, and deliberately not written back" is exactly D5's, and saying so
 * is better than filing a fragment under a promise nothing can honour. The day
 * the writer learns to splice fragments, the classification moves — the DATA
 * does not, because it is all still there.
 *
 * Unknown ATTRIBUTES on an element that *was* mapped are carried rather than
 * quarantined, under {@link ForeignInterchange.attrs}, because an attribute has
 * somewhere to go back to and because tranche H reads association-end
 * multiplicities out of exactly that slot.
 *
 * ## What is knowingly lost, and it is one thing
 *
 * **Containment.** A `packagedElement` inside a `uml:Package`, an
 * `ownedUseCase` inside its subject: both are statements, and on this canvas
 * both are made by DRAWING one box inside another — `xmi.ts`'s `containerOf`
 * reads them off geometry and nothing stores them. A model file carries no
 * geometry, so a sheet imported from one is laid out side by side and a second
 * export writes the elements as siblings. Nothing is destroyed and nothing is
 * mis-stated; the nesting is simply not re-drawn, and the report says so in the
 * user's words so they can put the box back in one drag. A file that DOES carry
 * diagram interchange keeps its nesting, because then the geometry is there.
 *
 * The round trip is therefore a **fixed point after one cycle**, which is D3's
 * own phrase for identity and holds here for shape as well: export, import,
 * export — and every export after that is byte-identical.
 *
 * ## Tolerant everywhere, refusing nowhere
 *
 * No throw, in any input. A root nobody recognises produces an empty result and
 * a note; a half-written file produces what it said and a note; an association
 * with one end produces a note and no relation. The reason is BPMN's inverted:
 * that reader can refuse a `.dmn` because a `<definitions>` in the wrong
 * namespace is provably another format, whereas "UML-ish XML" has a dozen
 * dialects and refusing one of them over a spelling would refuse a real model.
 *
 * ## Pure
 *
 * A string in, records out. No `std`, no DOM (the tokenizer is `xml-reader.ts`,
 * written for this reason), no clock, no randomness — `docs/adr/0012` P3.
 */

/* ── What comes back ──────────────────────────────────────────────────── */

/** One diagram's worth of geometry, by SOURCE id — `{}` for a file with none. */
export type UmlXmiLayout = Record<string, UmlBox>;

export interface UmlXmiImport {
  /**
   * One model per top-level package, in document order.
   *
   * A package per diagram is what the writer produces (`diagramPackage`), and
   * the only reading that keeps four sheets four sheets: a `uml:Model` whose
   * classifiers hang loose is one namespace, and ADR 0017 refuses that merge on
   * the canvas. A file with no packages at all — which is what Papyrus writes
   * for a single-diagram model — is read as ONE model off the root.
   */
  models: UmlModel[];
  /** Where the file's own diagram interchange, if any, drew each source id. */
  layout: UmlXmiLayout;
  /**
   * What the file declares INSIDE what — child source id → container source id.
   *
   * An XMI model states containment structurally (`packagedElement`,
   * `ownedUseCase`) and, unless it carries a `umldi` diagram, says nothing at
   * all about where any of it is drawn. On this canvas containment IS geometry —
   * `xmi.ts`'s own `containerOf` reads it back off the boxes — so the statement
   * has to reach the materializer's invented layout or it is lost on the first
   * export: a package imported empty, and every class of it laid out beside it.
   *
   * Handed over rather than applied here for the reason {@link foreign} is: this
   * reader has no layout engine, and the one that has is shared with the other
   * two formats.
   */
  containment: Record<string, string>;
  /**
   * Foreign matter, by the source id of the element it rides on (D2).
   *
   * The materializer owns the id map — it is the only thing that knows which
   * serialized element props stand for which IR node — so it owns the
   * attachment too, and this is handed to it rather than applied here.
   */
  foreign: Record<string, ForeignInterchange>;
  report: InterchangeReport;
}

/* ── The vocabulary ───────────────────────────────────────────────────── */

/**
 * The prefixes a metaclass may be written under.
 *
 * `uml` is Annex E's own (`tag "org.omg.xmi.nsPrefix" set to "uml"`), and it is
 * what Papyrus, StarUML, MagicDraw and our own writer all use. The other two
 * are casings Enterprise Architect has shipped. A bare `type="Class"` with no
 * prefix at all is read too, further down, but only when the value NAMES a
 * metaclass this reader knows — because `type="_7"` on an `ownedAttribute` is
 * an id reference and means something else entirely.
 */
const META_PREFIXES = new Set(['uml', 'UML', 'Uml']);

/** The classifier metaclasses, and the {@link UmlClassifier.kind} each is. */
const CLASSIFIER_KIND: Readonly<Record<string, UmlClassifier['kind']>> = {
  Class: 'class',
  Interface: 'interface',
  Enumeration: 'enumeration',
  InstanceSpecification: 'object',
  // §10.2 makes a DataType a Classifier with attributes and operations, and the
  // canvas draws it as the box §9.2.4 draws — which is a class with a keyword
  // on it. The keyword is added rather than assumed, so the box says what the
  // file said.
  DataType: 'class',
  PrimitiveType: 'class',
};

/** The metaclasses {@link CLASSIFIER_KIND} maps that need their keyword said. */
const CLASSIFIER_KEYWORD: Readonly<Record<string, string>> = {
  DataType: 'datatype',
  PrimitiveType: 'primitive',
};

/** The three cubes of §19.4.2, and the one `kind` they differ by. */
const DEPLOYMENT_KIND: Readonly<Record<string, UmlDeploymentNode['kind']>> = {
  Node: 'node',
  Device: 'device',
  ExecutionEnvironment: 'execution-environment',
};

/** The inverse of `xmi.ts`'s `ACTIVITY_NODE_TYPE`. */
const ACTIVITY_NODE_KIND: Readonly<Record<string, UmlActivityNodeKind>> = {
  OpaqueAction: 'action',
  Action: 'action',
  CallBehaviorAction: 'action',
  CallOperationAction: 'action',
  InitialNode: 'initial',
  ActivityFinalNode: 'activity-final',
  FlowFinalNode: 'flow-final',
  DecisionNode: 'decision',
  MergeNode: 'decision',
  ForkNode: 'fork',
  JoinNode: 'fork',
  ObjectNode: 'object-node',
  CentralBufferNode: 'object-node',
  DataStoreNode: 'object-node',
  SendSignalAction: 'send-signal',
  // Ambiguous by design — §16.10.4 draws the hourglass as an AcceptEventAction
  // whose trigger names a TimeEvent, so the two are told apart by the EVENT and
  // not by the metaclass. See {@link readActivity}.
  AcceptEventAction: 'accept-event',
};

/** The inverse of `xmi.ts`'s `PSEUDOSTATE_KIND` (§14.5.7's enumeration). */
const PSEUDOSTATE_OF_KIND: Readonly<Record<string, UmlPseudostateKind>> = {
  initial: 'initial',
  choice: 'choice',
  junction: 'junction',
  shallowHistory: 'shallow-history',
  deepHistory: 'deep-history',
  entryPoint: 'entry-point',
  exitPoint: 'exit-point',
  terminate: 'terminate',
  fork: 'fork',
  join: 'fork',
};

/** The dependency metaclasses, and the relation each states. */
const DEPENDENCY_KIND: Readonly<Record<string, UmlRelationKind>> = {
  Dependency: 'dependency',
  Usage: 'dependency',
  Abstraction: 'dependency',
  Realization: 'realization',
  Deployment: 'deploy',
  Manifestation: 'manifest',
};

/** What Labre stamps on the XMI extensions it writes — `xmi.ts`'s `EXTENDER`. */
const LABRE_EXTENDER = 'labre';

/** The four VisibilityKinds, as §7.4 spells them in a file. */
const VISIBILITIES = new Set(['public', 'private', 'protected', 'package']);

/** The reasons a fragment is kept and not written back (ADR 0012 D5). */
export const UML_XMI_QUARANTINE_REASON = {
  unmapped:
    'This element has no Labre artefact, and the XMI writer builds its ' +
    'document out of the diagram alone — it has no slot to splice a fragment ' +
    'back into. It is kept in the document, verbatim, and not written back.',
  danglingEnd:
    'One of this relationship’s ends names an element the file does not ' +
    'declare, so there is nothing on the canvas to draw it between. It is kept ' +
    'in the document, verbatim, and not written back.',
} as const;

/**
 * The remarks this reader raises whose wording is FIXED, as `[key, English]`
 * pairs — the same table, the same shape and the same reasons as
 * `UML_PLANTUML_REMARKS` (`plantuml-import.ts`, where the contract is written
 * out) and BPMN's own `BPMN_IMPORT_REMARKS`: one entry per SHAPE of sentence,
 * `{{name}}` holes filled at the call site by `InterchangeNote.messageParams`,
 * the English kept here as the fallback so a playground with no catalogue
 * reads exactly what it read before.
 *
 * {@link UML_XMI_QUARANTINE_REASON} above is NOT part of it, and cannot be:
 * its plain string is also written verbatim into
 * `ForeignInterchange.quarantined[].reason` — data, never translated — so it
 * cannot become a `[key, english]` pair without breaking that contract. BPMN
 * carries the identical constraint on its own quarantine reasons.
 */
export const UML_XMI_REMARKS = {
  mintedId: [
    'com.labre.uml.import.xmi.minted-id',
    '<{{tag}}> carries no xmi:id, so one was minted for it. Nothing in the file can refer to it, and nothing does.',
  ],
  unlistedOperator: [
    'com.labre.uml.import.xmi.unlisted-operator',
    'This combined fragment\'s operator is "{{operator}}", which UML 2.5.1 §17.6.4 does not list. It is drawn as an "alt" and the file\'s own word is kept beside it.',
  ],
  undrawnOccurrence: [
    'com.labre.uml.import.xmi.undrawn-occurrence',
    'A message in "{{name}}" names an occurrence this sheet has no lifeline for, so it is not drawn. The file still says it, and nothing was removed from the document.',
  ],
  wrongRoot: [
    'com.labre.uml.import.xmi.wrong-root',
    'A UML interchange file opens on <uml:Model> or <uml:Package>; this one opens on <{{tag}}>. Nothing was imported.',
  ],
  noXml: [
    'com.labre.uml.import.xmi.no-xml',
    'There is no XML element in this file, so there is no model in it.',
  ],
  offSheetRelation: [
    'com.labre.uml.import.xmi.off-sheet-relation',
    'A {{kind}} in "{{name}}" runs to an element that is not on this sheet, so it is not drawn. The file still says it, and nothing was removed from the document.',
  ],
  modelWithoutDiagram: [
    'com.labre.uml.import.xmi.model-without-diagram',
    'This file carries a model and no diagram, which is what the UML interchange format is for. Every position on the canvas was invented; none of them came from the file.',
  ],
  nestedWithoutDrawing: [
    'com.labre.uml.import.xmi.nested-without-drawing',
    '{{count}} element(s) are declared inside another in this file — a class in a package, a use case in its subject. Labre states that by DRAWING one box inside the other, and this file carries no drawing, so they were laid out side by side. Move them into the box to say it again.',
  ],
} as const satisfies Record<string, readonly [key: string, english: string]>;

/* ── Reading one node ─────────────────────────────────────────────────── */

/** The local half of a qualified name — `uml:Class` is `Class`. */
function localOf(qualified: string): string {
  const colon = qualified.indexOf(':');
  return colon < 0 ? qualified : qualified.slice(colon + 1);
}

/** The prefix half — `''` when there is none. */
function prefixOf(qualified: string): string {
  const colon = qualified.indexOf(':');
  return colon < 0 ? '' : qualified.slice(0, colon);
}

/**
 * The METACLASS an element states, in three spellings and a fallback.
 *
 * 1. `xmi:type="uml:Class"` — what our writer, Papyrus and MagicDraw write.
 * 2. `type="uml:Class"` — StarUML's, and the reason this function exists at
 *    all: a bare `type` is an id reference on half the elements in a file, so
 *    it counts as a metaclass ONLY when its value is prefixed with one of
 *    {@link META_PREFIXES}.
 * 3. `<uml:Class …/>` — the element itself named for its metaclass, which is
 *    what a UML2/Ecore file does at the root and inside a `xmi:XMI` wrapper.
 */
function metaOf(node: XmlNode): string | undefined {
  for (const [key, value] of Object.entries(node.attrs)) {
    if (localOf(key) !== 'type') continue;
    const prefix = prefixOf(key);
    if (prefix === '') {
      if (META_PREFIXES.has(prefixOf(value))) return localOf(value);
      continue;
    }
    // `xmi:type`, `XMI:type`, `xsi:type` — a prefixed `type` is always the
    // metaclass, whatever the file calls the XMI namespace.
    if (value) return localOf(value);
  }
  return META_PREFIXES.has(node.prefix) ? node.local : undefined;
}

/** `true` only for the string `true` — everything else is "not stated". */
function isTrue(value: string | undefined): boolean {
  return value === 'true';
}

/** A `visibility="…"` that names one of §7.4's four, or nothing. */
function visibilityAttr(node: XmlNode): UmlVisibility | undefined {
  const raw = xmlAttr(node, 'visibility');
  return raw && VISIBILITIES.has(raw) ? (raw as UmlVisibility) : undefined;
}

/**
 * The single id an element points at, whichever of the four spellings it uses.
 *
 * `xmi:idref` is XMI's own, a bare attribute value is what every reference our
 * writer emits looks like (`general="_4"`), a nested `<type xmi:idref="…"/>` is
 * the element form, and `href="…#Name"` points into another document — the last
 * resolves to the FRAGMENT, which for `PrimitiveTypes.xmi#String` is the name of
 * the type and is exactly what a type name is.
 */
function refOf(node: XmlNode): string | undefined {
  const idref = xmlAttr(node, 'idref');
  if (idref) return idref;
  const href = xmlAttr(node, 'href');
  if (href) {
    const hash = href.lastIndexOf('#');
    return hash < 0 ? href : href.slice(hash + 1);
  }
  return undefined;
}

/* ── The reader ───────────────────────────────────────────────────────── */

interface Context {
  source: string;
  notes: InterchangeNote[];
  foreign: Record<string, ForeignInterchange>;
  layout: UmlXmiLayout;
  /** Every element in the document that carries an id, by that id. */
  byId: Map<string, XmlNode>;
  /** Elements this reader has read — the sweep descends into these. */
  consumed: Set<XmlNode>;
  /** Elements that became an artefact, and the source id it rides under. */
  scopeOf: Map<XmlNode, string>;
  counts: { mapped: number; carried: number; quarantined: number };
  /** What the file declares inside what — see {@link UmlXmiImport.containment}. */
  containment: Record<string, string>;
  /** `_g1`, `_g2`, … for an element the file gave no id. */
  minted: number;
}

function note(ctx: Context, entry: InterchangeNote): void {
  ctx.notes.push(entry);
}

/**
 * The payload riding on one source id, created on first use.
 *
 * `ctx.foreign` has NO prototype (see {@link importXmi}), which is what makes
 * this lookup safe: on a plain object, a file whose `xmi:id` is `__proto__`
 * would have this return `Object.prototype` and the caller write its payload
 * onto it — every object in the process, poisoned by opening a document.
 */
function foreignOf(ctx: Context, scope: string): ForeignInterchange {
  const known = ctx.foreign[scope];
  if (known) return known;
  const payload: ForeignInterchange = { id: scope };
  ctx.foreign[scope] = payload;
  return payload;
}

/** One attribute, kept under the scope of the element that carried it. */
function carryAttr(
  ctx: Context,
  owner: string,
  scope: string,
  name: string,
  value: string
): void {
  const payload = foreignOf(ctx, owner);
  payload.attrs = {
    ...payload.attrs,
    [scope]: { ...payload.attrs?.[scope], [name]: value },
  };
  ctx.counts.carried += 1;
}

/** One fragment, kept and declared un-re-emittable (D5). */
function quarantine(
  ctx: Context,
  owner: string,
  fragment: string,
  reason: string,
  entry: Omit<InterchangeNote, 'kind' | 'message'>
): void {
  const payload = foreignOf(ctx, owner);
  payload.quarantined = [...(payload.quarantined ?? []), { fragment, reason }];
  ctx.counts.quarantined += 1;
  note(ctx, { kind: 'quarantined', ...entry, message: reason });
}

/** Read, and ride under the enclosing artefact's scope. */
function consume(ctx: Context, ...nodes: (XmlNode | undefined)[]): void {
  for (const node of nodes) if (node) ctx.consumed.add(node);
}

/** Read whole — the element and everything under it. */
function consumeSubtree(ctx: Context, node: XmlNode): void {
  ctx.consumed.add(node);
  for (const child of node.children) consumeSubtree(ctx, child);
}

/**
 * Read, and become an artefact of its own — the scope everything under it is
 * filed against.
 *
 * The id is the file's, verbatim (D3). An element the file left unidentified
 * gets a minted one and a note: the surface element's identity is Labre's
 * either way, but a relationship pointing at an id nobody declared is a
 * dangling reference, and this is where that becomes visible.
 */
function map(ctx: Context, node: XmlNode): string {
  ctx.consumed.add(node);
  let id = xmlAttr(node, 'id');
  if (!id) {
    ctx.minted += 1;
    id = `_g${ctx.minted}`;
    note(ctx, {
      kind: 'substituted-id',
      element: node.name,
      messageKey: UML_XMI_REMARKS.mintedId[0],
      message: `<${node.name}> carries no xmi:id, so one was minted for it. Nothing in the file can refer to it, and nothing does.`,
      messageParams: { tag: node.name },
    });
  }
  ctx.scopeOf.set(node, id);
  ctx.counts.mapped += 1;
  return id;
}

/**
 * The attributes each element states in the DRAWING, and therefore the ones
 * that are not carried.
 *
 * The default row is the honest one, and it is BPMN's: an id and a name are the
 * model everywhere in this format, and anything else on an element Labre draws
 * is something Labre does not model and must not lose.
 */
const READ_ATTRS: Readonly<Record<string, readonly string[]>> = {
  packagedElement: [
    'xmi:type',
    'type',
    'xmi:id',
    'id',
    'name',
    'isAbstract',
    'classifier',
    'client',
    'supplier',
    'memberEnd',
    'general',
    'contract',
    'source',
    'target',
    'kind',
  ],
  ownedAttribute: [
    'xmi:type',
    'type',
    'xmi:id',
    'id',
    'name',
    'visibility',
    'isDerived',
    'isStatic',
    // `aggregation` is deliberately NOT here: a Property's aggregation is a
    // fact this reader does not model on an attribute (it models it on an
    // association END, where the diamond is drawn), so a file that states one —
    // `aggregation="none"` included, which is a default spelled out — has it
    // carried rather than swallowed.
    'association',
  ],
  ownedOperation: [
    'xmi:type',
    'type',
    'xmi:id',
    'id',
    'name',
    'visibility',
    'isAbstract',
    'isStatic',
    'isQuery',
  ],
  '': ['xmi:type', 'type', 'xmi:id', 'id', 'name'],
};

/** Everything on this element the reader did not read, kept verbatim. */
function carryUnknownAttrs(
  ctx: Context,
  node: XmlNode,
  owner: string,
  scope = owner,
  understood: readonly string[] = READ_ATTRS[node.local] ?? READ_ATTRS['']
): void {
  for (const [name, value] of Object.entries(node.attrs)) {
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
    if (understood.includes(name)) continue;
    // A prefixed spelling of an attribute the row names unprefixed, and the
    // other way round: `xmi:id` and `id` are one attribute in three dialects.
    if (understood.some(known => localOf(known) === localOf(name))) continue;
    carryAttr(ctx, owner, scope, name, value);
  }
}

/* ── Labre's own extension ────────────────────────────────────────────── */

/** Is this the `xmi:Extension` our writer stamps? */
function isLabreExtension(node: XmlNode): boolean {
  return (
    node.local === 'Extension' && xmlAttr(node, 'extender') === LABRE_EXTENDER
  );
}

/**
 * The keywords an element states, out of the extension `xmi.ts` files them in.
 *
 * The metaclass keywords are NOT put back — `«interface»` on a `uml:Interface`
 * is the fact the type already states, and the writer drops it for that reason
 * (`METACLASS_KEYWORDS`). Only what the file actually wrote comes back, which
 * is what makes the round-trip an equality rather than an approximation.
 */
function readKeywords(ctx: Context, node: XmlNode): string[] {
  const keywords: string[] = [];
  for (const child of node.children) {
    if (!isLabreExtension(child)) continue;
    let read = false;
    for (const entry of xmlChildren(child, 'keyword')) {
      const name = xmlAttr(entry, 'name');
      if (name === undefined) continue;
      keywords.push(name);
      consume(ctx, entry);
      read = true;
    }
    // Consumed only when something in it was ours: a `xmi:Extension` stamped
    // `labre` that holds something this build has never heard of is a fragment
    // to keep, not one to swallow.
    if (read && child.children.every(entry => ctx.consumed.has(entry))) {
      consume(ctx, child);
    }
  }
  return keywords;
}

/** Everything `UmlNodeBase` says, read off one element. */
function readBase(ctx: Context, node: XmlNode, id: string): UmlNodeBase {
  const bounds = ctx.layout[id];
  return {
    id,
    name: xmlAttr(node, 'name') ?? '',
    keywords: readKeywords(ctx, node),
    isAbstract: isTrue(xmlAttr(node, 'isAbstract')),
    ...(bounds ? { bounds } : {}),
  };
}

/* ── Types, features, compartments ────────────────────────────────────── */

/** The NAME of the type a typed element points at, however it points. */
function typeNameOf(ctx: Context, node: XmlNode): string | undefined {
  const child = xmlChild(node, 'type');
  if (child) {
    consume(ctx, child);
    const ref = refOf(child);
    if (ref) return nameOfId(ctx, ref) ?? ref;
  }
  // `type="_7"` — an idref, which is the reading exactly when the value is NOT
  // a metaclass name (see {@link metaOf}).
  const attr = node.attrs['type'];
  if (attr && !META_PREFIXES.has(prefixOf(attr))) {
    return nameOfId(ctx, attr) ?? attr;
  }
  return undefined;
}

/** What the file calls the element with this id. */
function nameOfId(ctx: Context, id: string): string | undefined {
  const node = ctx.byId.get(id);
  if (!node) return undefined;
  const name = xmlAttr(node, 'name');
  if (name) return name;
  const href = xmlAttr(node, 'href');
  return href ? localOf(href.slice(href.lastIndexOf('#') + 1)) : undefined;
}

/** `lowerValue` / `upperValue`, when the author stated a range (§9.5.4). */
function readMultiplicity(
  ctx: Context,
  node: XmlNode
): UmlMultiplicity | undefined {
  const lower = xmlChild(node, 'lowerValue');
  const upper = xmlChild(node, 'upperValue');
  consume(ctx, lower, upper);
  if (!lower && !upper) return undefined;
  const lowerRaw = lower ? (xmlAttr(lower, 'value') ?? '0') : '1';
  const upperRaw = upper ? (xmlAttr(upper, 'value') ?? '1') : '1';
  const lowerNumber = Number.parseInt(lowerRaw, 10);
  const upperNumber = Number.parseInt(upperRaw, 10);
  return {
    lower: Number.isFinite(lowerNumber) ? lowerNumber : 0,
    // `*` is the unlimited value of UnlimitedNatural (Annex E.3 requires it to
    // be serialized as exactly that); `-1` is the sentinel Eclipse UML2 writes
    // for it, and reading it as the number would be an upper bound below the
    // lower one.
    upper:
      upperRaw === '*' || upperRaw === '-1'
        ? '*'
        : Number.isFinite(upperNumber)
          ? upperNumber
          : 1,
  };
}

/** A `<defaultValue value="…"/>`, whichever LiteralSpecification it is. */
function readDefault(ctx: Context, node: XmlNode): string | undefined {
  const value = xmlChild(node, 'defaultValue');
  if (!value) return undefined;
  consume(ctx, value);
  return xmlAttr(value, 'value') ?? value.text?.trim();
}

/** One `ownedAttribute` as the compartment line it was read off. */
function readProperty(ctx: Context, node: XmlNode): UmlProperty {
  const multiplicity = readMultiplicity(ctx, node);
  const defaultValue = readDefault(ctx, node);
  const type = typeNameOf(ctx, node);
  const visibility = visibilityAttr(node);
  return {
    ...(visibility ? { visibility } : {}),
    isDerived: isTrue(xmlAttr(node, 'isDerived')),
    name: xmlAttr(node, 'name') ?? '',
    ...(type ? { type } : {}),
    ...(multiplicity ? { multiplicity } : {}),
    ...(defaultValue ? { defaultValue } : {}),
    modifiers: [],
    ...(isTrue(xmlAttr(node, 'isStatic')) ? { isStatic: true } : {}),
  };
}

/**
 * One `ownedParameter`, minus the one that carries the return type.
 *
 * The direction is kept whenever the file STATES one, `in` included — and the
 * file states one on every parameter, because §9.4.4's default is applied by
 * the writer that needs a value (`xmi.ts`, `direction: parameter.direction ??
 * 'in'`). So "the author wrote no direction" is a fact the format does not
 * carry, and this reader reports what the file says rather than guessing which
 * `in` was typed and which was supplied.
 */
function readParameter(ctx: Context, node: XmlNode): UmlParameter {
  const multiplicity = readMultiplicity(ctx, node);
  const defaultValue = readDefault(ctx, node);
  const type = typeNameOf(ctx, node);
  const direction = xmlAttr(node, 'direction');
  return {
    ...(direction ? { direction: direction as UmlParameterDirection } : {}),
    name: xmlAttr(node, 'name') ?? '',
    ...(type ? { type } : {}),
    ...(multiplicity ? { multiplicity } : {}),
    ...(defaultValue ? { defaultValue } : {}),
  };
}

/**
 * One `ownedOperation`, with §9.4.4's return parameter folded back into it.
 *
 * `direction="return"` is where UML puts a result — there is no separate slot —
 * so reading it back into {@link UmlOperation.returnType} is not a convenience,
 * it is the inverse of what the writer had to do to say it at all.
 */
function readOperation(ctx: Context, node: XmlNode): UmlOperation {
  const parameters: UmlParameter[] = [];
  let returnType: string | undefined;
  let returnMultiplicity: UmlMultiplicity | undefined;

  for (const child of xmlChildren(node, 'ownedParameter')) {
    consume(ctx, child);
    if (xmlAttr(child, 'direction') === 'return') {
      returnMultiplicity = readMultiplicity(ctx, child);
      returnType = typeNameOf(ctx, child);
      readDefault(ctx, child);
      continue;
    }
    parameters.push(readParameter(ctx, child));
  }

  const visibility = visibilityAttr(node);
  return {
    ...(visibility ? { visibility } : {}),
    name: xmlAttr(node, 'name') ?? '',
    parameters,
    ...(returnType ? { returnType } : {}),
    ...(returnMultiplicity ? { returnMultiplicity } : {}),
    modifiers: isTrue(xmlAttr(node, 'isQuery')) ? ['query'] : [],
    ...(isTrue(xmlAttr(node, 'isStatic')) ? { isStatic: true } : {}),
    ...(isTrue(xmlAttr(node, 'isAbstract')) ? { isAbstract: true } : {}),
  };
}

/* ── Compartments, re-spelled ─────────────────────────────────────────── */

/** The four visibility markers of §7.4, by the VisibilityKind each is. */
const VISIBILITY_MARKER: Readonly<Record<UmlVisibility, string>> = {
  public: '+',
  private: '-',
  protected: '#',
  package: '~',
};

/** `[1..*]`, `[0..1]`, `[3]` — §7.5.4's own notation. */
function multiplicityText(multiplicity: UmlMultiplicity): string {
  const { lower, upper } = multiplicity;
  return lower === upper ? `[${lower}]` : `[${lower}..${upper}]`;
}

/**
 * A parsed property back as the compartment line it would have been typed as.
 *
 * `UmlClassifier.lines` is the compartment AS THE AUTHOR TYPED IT, and an
 * import has no author to ask: the file carries the structure, not the text.
 * So the line is re-spelled in §9.5.4's own notation, which is the one form
 * both writers already agree on — PlantUML prints these lines verbatim, and
 * feeding it a line it could not have produced is the one way this reader could
 * poison the other export.
 *
 * It is re-spelled and not invented: every part of it came out of the file.
 */
function propertyLine(property: UmlProperty): string {
  const parts: string[] = [];
  if (property.visibility) parts.push(VISIBILITY_MARKER[property.visibility]);
  if (property.isDerived) parts.push('/');
  parts.push(property.name);
  if (property.type) parts.push(`: ${property.type}`);
  if (property.multiplicity)
    parts.push(multiplicityText(property.multiplicity));
  if (property.defaultValue) parts.push(`= ${property.defaultValue}`);
  if (property.isStatic) parts.push('{static}');
  return parts.join(' ').trim();
}

/** A parsed operation back as its compartment line — §9.6.4's notation. */
function operationLine(operation: UmlOperation): string {
  const parameters = operation.parameters
    .map(parameter => {
      const head = parameter.direction
        ? `${parameter.direction} ${parameter.name}`
        : parameter.name;
      const typed = parameter.type ? `${head} : ${parameter.type}` : head;
      const bounded = parameter.multiplicity
        ? `${typed} ${multiplicityText(parameter.multiplicity)}`
        : typed;
      return parameter.defaultValue
        ? `${bounded} = ${parameter.defaultValue}`
        : bounded;
    })
    .join(', ');

  const parts: string[] = [];
  if (operation.visibility) parts.push(VISIBILITY_MARKER[operation.visibility]);
  parts.push(`${operation.name}(${parameters})`);
  if (operation.returnType) parts.push(`: ${operation.returnType}`);
  if (operation.returnMultiplicity) {
    parts.push(multiplicityText(operation.returnMultiplicity));
  }
  if (operation.isAbstract) parts.push('{abstract}');
  if (operation.isStatic) parts.push('{static}');
  for (const modifier of operation.modifiers) parts.push(`{${modifier}}`);
  return parts.join(' ').trim();
}

/* ── Diagram interchange (Annex E.5's `umldi`, and Papyrus's `notation`) ─ */

/** A number an attribute states, or nothing. */
function numberAttr(node: XmlNode, name: string): number | undefined {
  const raw = xmlAttr(node, name);
  if (raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Every shape the file draws, by the id of the element it draws.
 *
 * Two dialects, and the same four numbers in both:
 *
 *  - **UMLDI** (Annex E.5, `umldi` prefix): a `UMLShape` with a `modelElement`
 *    and a `<bounds x= y= width= height=/>`;
 *  - **Papyrus `.notation`** (GMF): a `<children xmi:type="notation:Shape"
 *    element="…">` with a `<layoutConstraint xmi:type="notation:Bounds">`.
 *
 * Read by SHAPE rather than by walking the diagram tree, because the diagram
 * tree is where the two dialects differ and the shape is where they agree.
 * Edges are not read at all: a connector on this canvas routes itself between
 * its two ends and re-routes whenever either moves, so a frozen waypoint list
 * would be a path that stops following the drawing (D4's own reasoning about
 * two-point edges, applied to all of them until phase 3 says otherwise).
 */
function readLayout(root: XmlNode): UmlXmiLayout {
  // No prototype, for the reason `importXmi` gives: the key is the file's.
  const layout: UmlXmiLayout = Object.create(null);
  for (const node of [root, ...xmlDescendants(root)]) {
    const meta = xmlAttr(node, 'type') ?? '';
    const isShape =
      node.local === 'UMLShape' ||
      localOf(meta) === 'UMLShape' ||
      localOf(meta) === 'Shape';
    if (!isShape) continue;

    const target =
      xmlAttr(node, 'modelElement') ??
      xmlAttr(node, 'element') ??
      refOf(xmlChild(node, 'modelElement') ?? node);
    if (!target) continue;

    const box = xmlChild(node, 'bounds') ?? xmlChild(node, 'layoutConstraint');
    const holder = box ?? node;
    const x = numberAttr(holder, 'x');
    const y = numberAttr(holder, 'y');
    const w = numberAttr(holder, 'width');
    const h = numberAttr(holder, 'height');
    if (x === undefined || y === undefined) continue;
    layout[target] = { x, y, w: w ?? 0, h: h ?? 0 };
  }
  return layout;
}

/* ── One model ────────────────────────────────────────────────────────── */

/** Everything one package is building, before it is a {@link UmlModel}. */
interface Draft {
  model: UmlModel;
  /** Every artefact id this sheet owns — what a relation's ends must be in. */
  ids: Set<string>;
  /** Association ends, by their own id: what they are typed by. */
  ends: Map<
    string,
    { typeId?: string; aggregation?: string; label?: UmlAssociationEnd }
  >;
  /** Signal ids a glyph on this sheet actually referenced. */
  usedSignals: Set<string>;
  /**
   * How many artefacts the file drew INSIDE another one.
   *
   * Counted because it is the one statement this reader can read and cannot
   * put back: on this canvas a package holds what its box holds and a subject
   * holds the cases drawn in it (`xmi.ts`’s `containerOf`), so containment is
   * geometry — and a file with no diagram in it has no geometry to give.
   */
  nested: number;
  /**
   * The frame kind the file DECLARED, before anything under it was read.
   *
   * Read first because it disambiguates a metaclass: §18.1.4 makes the subject
   * of a use case diagram a Classifier, `xmi.ts` writes it as a
   * `uml:Component`, and a subject with no case drawn inside it is then
   * indistinguishable from
   * an ordinary component (§11.6.4) — except that the sheet says which diagram
   * it is, which is exactly what this extension is for.
   */
  declaredKind?: UmlDiagramKind;
  /**
   * Is a `uml:Component` on this sheet the SUBJECT of a use case diagram?
   *
   * §18.1.4 makes the subject a Classifier and `xmi.ts` writes it as a
   * Component, so the metaclass cannot tell the two apart. Three things can,
   * in order of strength: the cases drawn INSIDE it (an `ownedUseCase`, which
   * is containment and settles it), the frame kind the file declared, and —
   * for a sheet that carries a use case but no nesting, which is what a second
   * export of an imported file looks like — the presence of any UseCase at all.
   *
   * The third is a heuristic and it is stated as one: a component diagram that
   * also draws a use case would read its component as a subject. That costs a
   * stencil; the alternative costs the round trip, because a subject that comes
   * back as a component comes back as a different box every cycle.
   */
  subjectLikely: boolean;
}

function emptyModel(id: string, name: string): UmlModel {
  return {
    diagram: { id, kind: 'class', name, heading: '' },
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

/** Record an artefact of this sheet, so a relation can resolve against it. */
function own(draft: Draft, id: string): string {
  draft.ids.add(id);
  return id;
}

/** The label a relationship wears — its `name`, when the file wrote one. */
function labelOf(node: XmlNode): { label?: string } {
  const name = xmlAttr(node, 'name');
  return name ? { label: name } : {};
}

/** One relation, once both of its ends are ids this sheet owns. */
function relate(
  draft: Draft,
  kind: UmlRelationKind,
  sourceId: string | undefined,
  targetId: string | undefined,
  // The centre label AND, for an association, §11.5.4's two end labels — every
  // part of a relation that is not its kind or its two ends.
  label?: Partial<Pick<UmlRelation, 'label' | 'sourceEnd' | 'targetEnd'>>
): boolean {
  if (!sourceId || !targetId) return false;
  const relation: UmlRelation = { kind, sourceId, targetId, ...label };
  draft.model.relations.push(relation);
  return true;
}

/* ── The element readers ──────────────────────────────────────────────── */

/**
 * One classifier, with the features and the two relationships it owns.
 *
 * An `ownedAttribute` that names an `association` is NOT a feature: it is an
 * association END the classifier happens to own (§11.5.4 lets either side own
 * one), and reading it as an attribute would put `order : Customer` in the
 * compartment of a class whose author drew a line.
 */
function readClassifier(
  ctx: Context,
  draft: Draft,
  node: XmlNode,
  meta: string,
  id: string
): void {
  const kind = CLASSIFIER_KIND[meta]!;
  const base = readBase(ctx, node, id);
  const keyword = CLASSIFIER_KEYWORD[meta];
  const attributes: UmlProperty[] = [];
  const operations: UmlOperation[] = [];
  const slots: UmlSlot[] = [];

  for (const child of node.children) {
    if (child.local === 'ownedAttribute') {
      const association = xmlAttr(child, 'association');
      const endId = xmlAttr(child, 'id');
      if (association && endId) {
        consume(ctx, child);
        draft.ends.set(endId, {
          typeId: endTypeId(ctx, child),
          ...(xmlAttr(child, 'aggregation') &&
          xmlAttr(child, 'aggregation') !== 'none'
            ? { aggregation: xmlAttr(child, 'aggregation') }
            : {}),
        });
        continue;
      }
      consume(ctx, child);
      carryUnknownAttrs(ctx, child, id, endId ?? id);
      attributes.push(readProperty(ctx, child));
    } else if (child.local === 'ownedLiteral') {
      // An enumeration's compartment holds LITERALS: a name and nothing else,
      // which is what the writer reads out of the line and all it writes back.
      consume(ctx, child);
      attributes.push({
        isDerived: false,
        name: xmlAttr(child, 'name') ?? '',
        modifiers: [],
      });
    } else if (child.local === 'ownedOperation') {
      consume(ctx, child);
      carryUnknownAttrs(ctx, child, id, xmlAttr(child, 'id') ?? id);
      operations.push(readOperation(ctx, child));
    } else if (child.local === 'slot') {
      consume(ctx, child);
      const value = xmlChild(child, 'value');
      const extension = child.children.find(isLabreExtension);
      const feature = extension ? xmlChild(extension, 'feature') : undefined;
      consume(ctx, value, extension, feature);
      const slotValue = value ? xmlAttr(value, 'value') : undefined;
      slots.push({
        name: feature ? (xmlAttr(feature, 'name') ?? '') : '',
        ...(slotValue ? { value: slotValue } : {}),
      });
    } else if (child.local === 'generalization') {
      consume(ctx, child);
      relate(draft, 'generalization', id, xmlAttr(child, 'general'));
    } else if (child.local === 'interfaceRealization') {
      consume(ctx, child);
      relate(
        draft,
        'realization',
        id,
        xmlAttr(child, 'contract') ?? xmlAttr(child, 'supplier'),
        labelOf(child)
      );
    }
  }

  const classifier: UmlClassifier = {
    ...base,
    keywords: keyword ? [keyword, ...base.keywords] : base.keywords,
    kind,
    attributes: kind === 'object' ? [] : attributes,
    operations: kind === 'object' ? [] : operations,
    slots: kind === 'object' ? slots : [],
    lines: {
      attributes: kind === 'object' ? [] : attributes.map(propertyLine),
      operations: kind === 'object' ? [] : operations.map(operationLine),
    },
  };

  const instanceOf = xmlAttr(node, 'classifier');
  if (kind === 'object' && instanceOf) {
    const named = nameOfId(ctx, instanceOf);
    if (named) classifier.instanceOf = named;
  }

  draft.model.classifiers.push(classifier);
  own(draft, id);
}

/** What an association end is typed by — an id, not a name. */
function endTypeId(ctx: Context, node: XmlNode): string | undefined {
  const child = xmlChild(node, 'type');
  if (child) {
    consume(ctx, child);
    const ref = refOf(child);
    if (ref) return ref;
  }
  const attr = node.attrs['type'];
  return attr && !META_PREFIXES.has(prefixOf(attr)) ? attr : undefined;
}

/**
 * One association, with the diamond on the end the metamodel puts it on.
 *
 * `Property::isComposite` is a statement about the end whose TYPE is the part —
 * "the object containing the attribute is a container for the object contained
 * in the attribute" — so the flagged end is the PART and the whole is the other
 * one. That is the reading `xmi.ts` writes with, and reading it back the same
 * way is what keeps a diamond on the same classifier after a round trip.
 *
 * ## Where an end's adornments land
 *
 * On the end DRAWN at the classifier that types it — the identity §11.5.4 states
 * and `xmi.ts` writes with, read back the same way round. So the `lowerValue` /
 * `upperValue`, the `name` and the `visibility` of the end typed by the WHOLE
 * become {@link UmlRelation.sourceEnd}, and the part's end becomes `targetEnd`.
 * They used to ride in `interchange.xmi.attrs` because the canvas had nowhere to
 * draw them (ADR 0018); ADR 0020 gave the connector two end labels, so they are
 * now on the board and are no longer carried — carrying a fact the drawing shows
 * would put it in the document twice and re-emit it beside the one the writer
 * produces. Everything else an end says is still carried verbatim.
 */
function readAssociation(
  ctx: Context,
  draft: Draft,
  node: XmlNode,
  id: string,
  kind: UmlRelationKind
): void {
  // Both spellings of `memberEnd`: an idref list, and one element per end.
  const listed = (xmlAttr(node, 'memberEnd') ?? '')
    .split(/\s+/)
    .filter(Boolean);
  for (const child of xmlChildren(node, 'memberEnd')) {
    consume(ctx, child);
    const ref = refOf(child);
    if (ref) listed.push(ref);
  }

  for (const child of xmlChildren(node, 'ownedEnd')) {
    consume(ctx, child);
    const endId = xmlAttr(child, 'id');
    if (!endId) continue;
    const aggregation = xmlAttr(child, 'aggregation');
    draft.ends.set(endId, {
      typeId: endTypeId(ctx, child),
      ...(aggregation && aggregation !== 'none' ? { aggregation } : {}),
      ...adornmentsOf(ctx, child),
    });
    if (!listed.includes(endId)) listed.push(endId);
    if (aggregation && aggregation !== 'none') {
      carryAttr(ctx, id, endId, 'aggregation', aggregation);
    }
  }

  // Ends the association only NAMES — owned by a classifier, which is where
  // Papyrus and StarUML put a navigable one.
  for (const endId of listed) {
    if (draft.ends.has(endId)) continue;
    const owned = ctx.byId.get(endId);
    if (!owned) continue;
    const aggregation = xmlAttr(owned, 'aggregation');
    draft.ends.set(endId, {
      typeId: endTypeId(ctx, owned),
      ...(aggregation && aggregation !== 'none' ? { aggregation } : {}),
      ...adornmentsOf(ctx, owned),
    });
  }

  const [first, second] = listed.map(endId => ({
    id: endId,
    ...(draft.ends.get(endId) ?? {}),
  }));

  if (!first || !second || !first.typeId || !second.typeId) {
    quarantine(
      ctx,
      draft.model.diagram.id,
      xmlFragmentOf(ctx.source, node),
      UML_XMI_QUARANTINE_REASON.danglingEnd,
      { sourceId: id, element: node.name }
    );
    return;
  }

  // The flagged end is the PART; the whole is the other one. With no flag the
  // file's own order is the direction, which is what the writer wrote.
  const flagged = second.aggregation
    ? second
    : first.aggregation
      ? first
      : undefined;
  const part = flagged ?? second;
  const whole = flagged === first ? second : first;
  const aggregation = flagged?.aggregation;
  const relationKind: UmlRelationKind =
    kind === 'communication-path'
      ? 'communication-path'
      : aggregation === 'composite'
        ? 'composition'
        : aggregation === 'shared'
          ? 'aggregation'
          : 'association';

  carryAttr(ctx, id, '@ends', 'source', whole.id);
  carryAttr(ctx, id, '@ends', 'target', part.id);
  relate(draft, relationKind, whole.typeId, part.typeId, {
    ...labelOf(node),
    ...(whole.label ? { sourceEnd: whole.label } : {}),
    ...(part.label ? { targetEnd: part.label } : {}),
  });
}

/**
 * The §11.5.4 adornments one association end states — or nothing.
 *
 * `raw` is composed rather than read off the file, because the file has no such
 * string: XMI states the range, the name and the visibility as three separate
 * pieces of markup, and what goes BESIDE the end on the board is their one-line
 * spelling. {@link formatEndLabel} is the same printer the PlantUML writer uses,
 * so an end imported from XMI and one exported to a `.puml` read identically.
 */
function adornmentsOf(
  ctx: Context,
  node: XmlNode
): { label?: UmlAssociationEnd } {
  const multiplicity = readMultiplicity(ctx, node);
  const role = xmlAttr(node, 'name');
  const visibility = visibilityAttr(node);
  if (!multiplicity && !role && !visibility) return {};
  const parts = {
    ...(multiplicity ? { multiplicity } : {}),
    ...(role ? { role } : {}),
    ...(visibility ? { visibility } : {}),
  };
  return { label: { ...parts, raw: formatEndLabel({ ...parts, raw: '' }) } };
}

/** One component, with its ports and the two kinds of interface it wires. */
function readComponent(
  ctx: Context,
  draft: Draft,
  node: XmlNode,
  id: string
): UmlComponentNode {
  const base = readBase(ctx, node, id);
  const ports: UmlPort[] = [];
  const provided: string[] = [];
  const required: string[] = [];
  /** The interfaces this component declares, so a wire can name one. */
  const declared = new Map<string, string>();

  for (const child of node.children) {
    const meta = metaOf(child) ?? '';
    if (child.local === 'ownedAttribute' && meta === 'Port') {
      consume(ctx, child);
      const portId = map(ctx, child);
      ports.push({ ...readBase(ctx, child, portId), ownerId: id });
      continue;
    }
    if (child.local === 'packagedElement' && meta === 'Interface') {
      consume(ctx, child);
      const interfaceId = xmlAttr(child, 'id');
      if (interfaceId) declared.set(interfaceId, xmlAttr(child, 'name') ?? '');
      continue;
    }
    if (child.local === 'interfaceRealization') {
      consume(ctx, child);
      const contract = xmlAttr(child, 'contract') ?? xmlAttr(child, 'supplier');
      const name = contract
        ? (declared.get(contract) ?? nameOfId(ctx, contract))
        : undefined;
      if (name !== undefined) provided.push(name);
      else if (contract) relate(draft, 'realization', id, contract);
      continue;
    }
    if (child.local === 'packagedElement' && meta === 'Usage') {
      consume(ctx, child);
      const supplier = xmlAttr(child, 'supplier');
      const name = supplier
        ? (declared.get(supplier) ?? nameOfId(ctx, supplier))
        : undefined;
      if (name !== undefined && supplier && declared.has(supplier)) {
        required.push(name);
      } else if (supplier) {
        relate(draft, 'dependency', id, supplier, labelOf(child));
      }
      continue;
    }
  }

  // An interface the component declared and nothing wired to is still one the
  // file said it provides — the lollipop with no line is §10.4.4's own drawing.
  const wired = new Set([...provided, ...required]);
  for (const name of declared.values()) {
    if (!wired.has(name)) provided.push(name);
  }

  for (const port of ports) own(draft, port.id);
  draft.model.ports.push(...ports);
  return { ...base, ports, provided, required };
}

/** One use case, with the two relationships §18.1.4 makes it own. */
function readUseCase(
  ctx: Context,
  draft: Draft,
  node: XmlNode,
  id: string
): UmlNodeBase {
  for (const child of xmlChildren(node, 'include')) {
    consume(ctx, child);
    relate(draft, 'include', id, xmlAttr(child, 'addition'));
  }
  for (const child of xmlChildren(node, 'extend')) {
    consume(ctx, child);
    relate(draft, 'extend', id, xmlAttr(child, 'extendedCase'));
  }
  return readBase(ctx, node, id);
}

/** One activity — its glyphs, its arrows and its lanes (§15.2.4, §15.6.4). */
function readActivity(
  ctx: Context,
  draft: Draft,
  node: XmlNode,
  id: string
): UmlActivity {
  const nodes: UmlActivityNode[] = [];
  const edges: UmlActivityEdge[] = [];
  const partitions: UmlPartition[] = [];
  const byId = new Map<string, UmlActivityNode>();

  for (const child of xmlChildren(node, 'node')) {
    const meta = metaOf(child) ?? '';
    const kind = ACTIVITY_NODE_KIND[meta];
    if (!kind) continue;
    consume(ctx, child);
    const nodeId = map(ctx, child);
    carryUnknownAttrs(ctx, child, nodeId, nodeId, [
      'xmi:type',
      'type',
      'xmi:id',
      'id',
      'name',
      'signal',
    ]);

    // §16.10.4's hourglass IS an AcceptEventAction — the one whose trigger
    // names a TimeEvent. The metaclass cannot tell the two apart, so the EVENT
    // is asked, exactly as the writer had to say it through one.
    let resolved: UmlActivityNodeKind = kind;
    for (const trigger of xmlChildren(child, 'trigger')) {
      consume(ctx, trigger);
      const event = xmlAttr(trigger, 'event');
      const declaration = event ? ctx.byId.get(event) : undefined;
      if (declaration && (metaOf(declaration) ?? '') === 'TimeEvent') {
        resolved = 'time-event';
      }
    }

    const activityNode: UmlActivityNode = {
      ...readBase(ctx, child, nodeId),
      kind: resolved,
    };
    nodes.push(activityNode);
    byId.set(nodeId, activityNode);
    own(draft, nodeId);

    const signal = xmlAttr(child, 'signal');
    if (signal) draft.usedSignals.add(signal);
  }

  for (const child of xmlChildren(node, 'edge')) {
    consume(ctx, child);
    const source = xmlAttr(child, 'source');
    const target = xmlAttr(child, 'target');
    if (!source || !target) continue;
    const guard = xmlChild(child, 'guard');
    const weight = xmlChild(child, 'weight');
    consume(ctx, guard, weight);
    const name = xmlAttr(child, 'name');
    const guardText = guard
      ? (xmlAttr(guard, 'body') ?? guard.text?.trim())
      : undefined;
    const weightText = weight
      ? (xmlAttr(weight, 'value') ?? xmlAttr(weight, 'body'))
      : undefined;
    edges.push({
      kind:
        (metaOf(child) ?? '') === 'ObjectFlow' ? 'object-flow' : 'control-flow',
      sourceId: source,
      targetId: target,
      ...(name ? { name } : {}),
      ...(guardText ? { guard: guardText } : {}),
      ...(weightText ? { weight: weightText } : {}),
    });
  }

  for (const child of xmlChildren(node, 'group')) {
    if ((metaOf(child) ?? '') !== 'ActivityPartition') continue;
    consume(ctx, child);
    const partitionId = map(ctx, child);
    const nodeIds = (xmlAttr(child, 'node') ?? '')
      .split(/\s+/)
      .filter(nodeId => byId.has(nodeId));
    for (const nodeId of nodeIds) byId.get(nodeId)!.partitionId = partitionId;
    partitions.push({
      ...readBase(ctx, child, partitionId),
      // §15.6.4's band runs down the sheet unless the author turned it, and the
      // metamodel has no slot for which way it was drawn: `ActivityPartition`
      // says what it holds, never how it is oriented. A column is what the
      // creation site draws and what an invented layout can honour.
      orientation: 'vertical',
      nodeIds,
    });
    own(draft, partitionId);
  }

  return { id, name: xmlAttr(node, 'name') ?? '', nodes, edges, partitions };
}

/** One state machine — its regions, its vertices and its transitions. */
function readStateMachine(
  ctx: Context,
  draft: Draft,
  node: XmlNode,
  id: string
): UmlStateMachine {
  const machine: UmlStateMachine = {
    id,
    name: xmlAttr(node, 'name') ?? '',
    regions: [],
    states: [],
    finalStates: [],
    pseudostates: [],
    transitions: [],
  };

  /**
   * One `<region>`, and everything drawn in it.
   *
   * `regionId` is the COMPOSITE STATE the region belongs to, not the region
   * element: the canvas draws the composite state as a box and never draws the
   * region inside it, so that box's id is the one every vertex is filed under
   * — which is exactly what `xmi.ts`'s `subvertexElements` selects on.
   */
  const readRegion = (region: XmlNode, regionId: string | undefined): void => {
    consume(ctx, region);
    for (const child of xmlChildren(region, 'subvertex')) {
      const meta = metaOf(child) ?? '';
      consume(ctx, child);
      const vertexId = map(ctx, child);
      const base = readBase(ctx, child, vertexId);
      own(draft, vertexId);

      if (meta === 'FinalState') {
        machine.finalStates.push({
          ...base,
          ...(regionId ? { regionId } : {}),
        });
        continue;
      }
      if (meta === 'Pseudostate') {
        const kind = PSEUDOSTATE_OF_KIND[xmlAttr(child, 'kind') ?? 'initial'];
        const pseudostate: UmlPseudostate = {
          ...base,
          kind: kind ?? 'junction',
          ...(regionId ? { regionId } : {}),
        };
        machine.pseudostates.push(pseudostate);
        continue;
      }

      const nested = xmlChild(child, 'region');
      if (nested) {
        // A `uml:State` with a Region of its own is §14.2.4's COMPOSITE state,
        // and on this canvas that is a `umlRegion` box rather than a state.
        machine.regions.push({
          ...base,
          ...(regionId ? { parentId: regionId } : {}),
        });
        readRegion(nested, vertexId);
        continue;
      }

      const entry: string[] = [];
      const doActivity: string[] = [];
      const exit: string[] = [];
      for (const behaviour of child.children) {
        const body =
          xmlAttr(behaviour, 'body') ??
          xmlAttr(behaviour, 'name') ??
          behaviour.text?.trim();
        if (body === undefined) continue;
        if (behaviour.local === 'entry') entry.push(body);
        else if (behaviour.local === 'doActivity') doActivity.push(body);
        else if (behaviour.local === 'exit') exit.push(body);
        else continue;
        consume(ctx, behaviour);
      }
      machine.states.push({
        ...base,
        entry,
        doActivity,
        exit,
        lines: [],
        ...(regionId ? { regionId } : {}),
      });
    }

    for (const child of xmlChildren(region, 'transition')) {
      consume(ctx, child);
      const source = xmlAttr(child, 'source');
      const target = xmlAttr(child, 'target');
      if (!source || !target) continue;
      const triggers: string[] = [];
      for (const trigger of xmlChildren(child, 'trigger')) {
        consume(ctx, trigger);
        const name = xmlAttr(trigger, 'name');
        if (name) triggers.push(name);
      }
      const guard = xmlChild(child, 'guard');
      const effect = xmlChild(child, 'effect');
      consume(ctx, guard, effect);
      const specification = guard
        ? xmlChild(guard, 'specification')
        : undefined;
      consume(ctx, specification);
      const guardText = specification
        ? (xmlAttr(specification, 'body') ?? specification.text?.trim())
        : guard
          ? xmlAttr(guard, 'body')
          : undefined;
      const effectText = effect
        ? (xmlAttr(effect, 'body') ?? xmlAttr(effect, 'name'))
        : undefined;
      machine.transitions.push({
        sourceId: source,
        targetId: target,
        triggers,
        ...(guardText ? { guard: guardText } : {}),
        ...(effectText ? { effect: effectText } : {}),
      });
    }
  };

  for (const region of xmlChildren(node, 'region'))
    readRegion(region, undefined);
  return machine;
}

/* ── Interactions (§17) ───────────────────────────────────────────────── */

/** §17.4.3's `messageSort`, read back to the arrow §17.4.4 draws for it. */
const MESSAGE_KIND_OF_SORT: Readonly<Record<string, UmlMessageKind>> = {
  synchCall: 'message-sync',
  asynchCall: 'message-async',
  asynchSignal: 'message-async',
  reply: 'message-reply',
  createMessage: 'message-create',
  deleteMessage: 'message-delete',
};

/** The metaclasses §17.2.4 draws as the bar on a spine, whatever the tool. */
const EXECUTION_TYPES = new Set([
  'BehaviorExecutionSpecification',
  'ActionExecutionSpecification',
  'ExecutionSpecification',
]);

/** §17.6.4's operators, as a set — what an `interactionOperator` is checked against. */
const FRAGMENT_OPERATORS = new Set<string>([
  'alt',
  'opt',
  'loop',
  'par',
  'break',
  'critical',
  'seq',
  'strict',
  'neg',
  'assert',
  'ignore',
  'consider',
]);

/** One `<fragment>` list, while it is being read: what covers what, and when. */
interface InteractionPass {
  /** Occurrence id → the lifeline it covers and the height it sits at. */
  occurrence: Map<string, { covered?: string; y: number }>;
  /** The slot cursor — one per event, top to bottom. See `UML_SD_EVENT_STEP`. */
  slot: number;
}

/**
 * One `uml:Interaction`, read — §17's whole vocabulary in one pass.
 *
 * ## Why the ORDER of the fragment list is the whole of it
 *
 * §17.2.4 makes an Interaction's `fragment` an ORDERED collection and says the
 * order is time. A file therefore states the sequence and no heights, and a
 * canvas states heights and no sequence, so this reader turns one into the
 * other: every event in the list takes the next slot,
 * {@link UML_SD_EVENT_STEP} below the last, and `model.ts` reads the order back
 * off those heights. A slot per EVENT — not per message — is what keeps an
 * `activate` written between two arrows between them on the way back.
 *
 * ## What each metaclass becomes
 *
 * A pair of `MessageOccurrenceSpecification`s is ONE arrow and takes ONE slot:
 * they are the two ends of the same horizontal line (§17.4.4). An
 * `ExecutionOccurrenceSpecification` is the top or the bottom of a bar, and the
 * `BehaviorExecutionSpecification` between them carries no slot of its own — it
 * is the bar, and the bar is the space between its two occurrences. A
 * `DestructionOccurrenceSpecification` is the cross. A `CombinedFragment` is the
 * rectangle: it takes a slot for its top, one for each `else` after the first
 * operand, and one for its bottom.
 */
function readInteraction(
  ctx: Context,
  draft: Draft,
  node: XmlNode,
  id: string
): UmlInteraction {
  const interaction: UmlInteraction = {
    id,
    name: xmlAttr(node, 'name') ?? '',
    lifelines: [],
    messages: [],
    fragments: [],
    executions: [],
    destructions: [],
  };
  const pass: InteractionPass = { occurrence: new Map(), slot: 0 };
  const take = () => umlSequenceSlot(pass.slot++);

  const columnOf = new Map<string, number>();
  for (const child of xmlChildren(node, 'lifeline')) {
    consume(ctx, child);
    const lifelineId = map(ctx, child);
    carryUnknownAttrs(ctx, child, lifelineId, lifelineId, [
      'xmi:type',
      'type',
      'xmi:id',
      'id',
      'name',
      'represents',
      'coveredBy',
    ]);
    const record: UmlLifeline = {
      ...readBase(ctx, child, lifelineId),
      ...lifelineTypeOf(ctx, child),
    };
    columnOf.set(lifelineId, interaction.lifelines.length);
    interaction.lifelines.push(record);
    own(draft, lifelineId);
  }

  /** The bars, with their two occurrences still unresolved. */
  const bars: { record: UmlExecution; start?: string; finish?: string }[] = [];
  /** Message id → the slot its FIRST occurrence took — see the docblock. */
  const seen = new Map<string, number>();

  const readFragments = (parent: XmlNode): { covered: Set<string> } => {
    const touched = new Set<string>();
    for (const child of xmlChildren(parent, 'fragment')) {
      const meta = metaOf(child) ?? '';
      consume(ctx, child);

      if (meta === 'MessageOccurrenceSpecification') {
        const fragmentId = map(ctx, child);
        carryUnknownAttrs(ctx, child, fragmentId, fragmentId, [
          'xmi:type',
          'type',
          'xmi:id',
          'id',
          'name',
          'covered',
          'message',
        ]);
        const covered = xmlAttr(child, 'covered')?.split(/\s+/)[0];
        const message = xmlAttr(child, 'message');
        // The SECOND occurrence of a message is the other end of the same
        // horizontal line (§17.4.4), so it shares the slot rather than taking
        // one — otherwise every arrow would come back twice as far apart as the
        // file drew it.
        const y = message && seen.has(message) ? seen.get(message)! : take();
        if (message) seen.set(message, y);
        pass.occurrence.set(fragmentId, { ...(covered ? { covered } : {}), y });
        if (covered) touched.add(covered);
        continue;
      }

      if (meta === 'ExecutionOccurrenceSpecification') {
        const fragmentId = map(ctx, child);
        carryUnknownAttrs(ctx, child, fragmentId, fragmentId, [
          'xmi:type',
          'type',
          'xmi:id',
          'id',
          'name',
          'covered',
          'execution',
        ]);
        const covered = xmlAttr(child, 'covered')?.split(/\s+/)[0];
        pass.occurrence.set(fragmentId, {
          ...(covered ? { covered } : {}),
          y: take(),
        });
        if (covered) touched.add(covered);
        continue;
      }

      if (EXECUTION_TYPES.has(meta)) {
        const fragmentId = map(ctx, child);
        carryUnknownAttrs(ctx, child, fragmentId, fragmentId, [
          'xmi:type',
          'type',
          'xmi:id',
          'id',
          'name',
          'covered',
          'start',
          'finish',
        ]);
        const covered = xmlAttr(child, 'covered')?.split(/\s+/)[0];
        const record: UmlExecution = {
          ...readBase(ctx, child, fragmentId),
          ...(covered ? { lifelineId: covered } : {}),
          y0: 0,
          y1: 0,
        };
        interaction.executions.push(record);
        own(draft, fragmentId);
        bars.push({
          record,
          ...(xmlAttr(child, 'start')
            ? { start: xmlAttr(child, 'start')! }
            : {}),
          ...(xmlAttr(child, 'finish')
            ? { finish: xmlAttr(child, 'finish')! }
            : {}),
        });
        if (covered) touched.add(covered);
        continue;
      }

      if (meta === 'DestructionOccurrenceSpecification') {
        const fragmentId = map(ctx, child);
        carryUnknownAttrs(ctx, child, fragmentId, fragmentId, [
          'xmi:type',
          'type',
          'xmi:id',
          'id',
          'name',
          'covered',
        ]);
        const covered = xmlAttr(child, 'covered')?.split(/\s+/)[0];
        const record: UmlDestruction = {
          ...readBase(ctx, child, fragmentId),
          ...(covered ? { lifelineId: covered } : {}),
          y: take(),
        };
        interaction.destructions.push(record);
        pass.occurrence.set(fragmentId, {
          ...(covered ? { covered } : {}),
          y: record.y,
        });
        own(draft, fragmentId);
        if (covered) touched.add(covered);
        continue;
      }

      if (meta === 'InteractionUse') {
        const fragmentId = map(ctx, child);
        carryUnknownAttrs(ctx, child, fragmentId, fragmentId, [
          'xmi:type',
          'type',
          'xmi:id',
          'id',
          'name',
          'covered',
          'refersTo',
        ]);
        const covered = (xmlAttr(child, 'covered') ?? '')
          .split(/\s+/)
          .filter(Boolean);
        const y0 = take();
        const y1 = take();
        // §17.7.4's `refersTo` points at an Interaction that may be on another
        // sheet of this document; the NAME is what a board can draw, so the
        // reference is resolved to one when the file declares it and the
        // element's own name is kept otherwise.
        const refersTo = xmlAttr(child, 'refersTo');
        const named =
          xmlAttr(child, 'name') ??
          (refersTo ? nameOfId(ctx, refersTo) : undefined) ??
          '';
        interaction.fragments.push({
          ...readBase(ctx, child, fragmentId),
          name: named,
          operator: 'ref',
          operands: [{ y0, y1 }],
          coveredLifelineIds: covered,
          bounds: { x: 0, y: y0, w: 0, h: Math.max(1, y1 - y0) },
        });
        own(draft, fragmentId);
        for (const each of covered) touched.add(each);
        continue;
      }

      if (meta === 'CombinedFragment') {
        const fragmentId = map(ctx, child);
        carryUnknownAttrs(ctx, child, fragmentId, fragmentId, [
          'xmi:type',
          'type',
          'xmi:id',
          'id',
          'name',
          'covered',
          'interactionOperator',
        ]);
        const stated = xmlAttr(child, 'interactionOperator') ?? 'seq';
        const operator = (
          FRAGMENT_OPERATORS.has(stated) ? stated : 'alt'
        ) as UmlFragmentOperator;
        if (!FRAGMENT_OPERATORS.has(stated)) {
          // CARRIED, and not merely mentioned (ADR 0012 D1): the word is the
          // one thing this fragment said that the drawing cannot, so it rides
          // along on the element's foreign payload. `interactionOperator` is in
          // the understood list above — a word the pentagon DOES draw is not
          // foreign matter — so the carry is written here, where it is.
          carryAttr(ctx, fragmentId, fragmentId, 'interactionOperator', stated);
          note(ctx, {
            kind: 'warning',
            element: child.name,
            sourceId: fragmentId,
            messageKey: UML_XMI_REMARKS.unlistedOperator[0],
            message: `This combined fragment's operator is "${stated}", which UML 2.5.1 §17.6.4 does not list. It is drawn as an "alt" and the file's own word is kept beside it.`,
            messageParams: { operator: stated },
          });
        }
        const declared = (xmlAttr(child, 'covered') ?? '')
          .split(/\s+/)
          .filter(Boolean);
        const y0 = take();
        const bands: UmlInteractionOperand[] = [];
        const inside = new Set<string>(declared);
        const operands = xmlChildren(child, 'operand');
        for (const [index, operand] of operands.entries()) {
          consume(ctx, operand);
          map(ctx, operand);
          const opened = index === 0 ? y0 : take();
          const guardNode = xmlChild(operand, 'guard');
          consume(ctx, guardNode);
          const specification = guardNode
            ? xmlChild(guardNode, 'specification')
            : undefined;
          consume(ctx, specification);
          const guard = (
            (specification
              ? (xmlAttr(specification, 'value') ??
                xmlAttr(specification, 'body') ??
                specification.text)
              : undefined) ??
            (guardNode
              ? (xmlAttr(guardNode, 'name') ?? guardNode.text)
              : undefined) ??
            ''
          ).trim();
          const held = readFragments(operand);
          for (const each of held.covered) inside.add(each);
          bands.push({ ...(guard ? { guard } : {}), y0: opened, y1: 0 });
        }
        if (bands.length === 0) bands.push({ y0, y1: 0 });
        const y1 = take();
        for (const [index, band] of bands.entries()) {
          band.y1 = index + 1 < bands.length ? bands[index + 1].y0 : y1;
        }
        interaction.fragments.push({
          ...readBase(ctx, child, fragmentId),
          name: bands[0]?.guard ?? '',
          operator,
          operands: bands,
          coveredLifelineIds: [...inside],
          bounds: { x: 0, y: y0, w: 0, h: Math.max(1, y1 - y0) },
        });
        own(draft, fragmentId);
        for (const each of inside) touched.add(each);
        continue;
      }

      // Anything else in the ordered list — a StateInvariant, a
      // ContinuationSpecification, a coregion — is out of scope (ADR 0022) and
      // is left for the sweep to quarantine verbatim.
      ctx.consumed.delete(child);
    }
    return { covered: touched };
  };

  readFragments(node);

  for (const bar of bars) {
    const start = bar.start ? pass.occurrence.get(bar.start) : undefined;
    const finish = bar.finish ? pass.occurrence.get(bar.finish) : undefined;
    bar.record.y0 = start?.y ?? 0;
    bar.record.y1 = finish?.y ?? bar.record.y0 + UML_SD_EVENT_STEP;
    if (!bar.record.lifelineId) {
      const covered = start?.covered ?? finish?.covered;
      if (covered) bar.record.lifelineId = covered;
    }
  }

  for (const child of xmlChildren(node, 'message')) {
    consume(ctx, child);
    const messageId = map(ctx, child);
    carryUnknownAttrs(ctx, child, messageId, messageId, [
      'xmi:type',
      'type',
      'xmi:id',
      'id',
      'name',
      'messageSort',
      'sendEvent',
      'receiveEvent',
      'connector',
    ]);
    const send = xmlAttr(child, 'sendEvent');
    const receive = xmlAttr(child, 'receiveEvent');
    const from = send ? pass.occurrence.get(send) : undefined;
    const to = receive ? pass.occurrence.get(receive) : undefined;
    if (!from?.covered || !to?.covered) {
      note(ctx, {
        kind: 'warning',
        element: child.name,
        sourceId: messageId,
        messageKey: UML_XMI_REMARKS.undrawnOccurrence[0],
        message: `A message in "${interaction.name}" names an occurrence this sheet has no lifeline for, so it is not drawn. The file still says it, and nothing was removed from the document.`,
        messageParams: { name: interaction.name },
      });
      continue;
    }
    const sort = xmlAttr(child, 'messageSort') ?? 'synchCall';
    const label = xmlAttr(child, 'name');
    // §17.4.4 draws a deleteMessage ENDING on the cross, and that is what the
    // board draws too: the arrow's target is the destruction, not the spine.
    const cross = interaction.destructions.find(
      record => record.lifelineId === to.covered && record.y >= from.y
    );
    const kind = MESSAGE_KIND_OF_SORT[sort] ?? 'message-sync';
    interaction.messages.push({
      id: messageId,
      kind,
      sourceId: from.covered,
      targetId: kind === 'message-delete' && cross ? cross.id : to.covered,
      ...(label ? { label } : {}),
      y: from.y,
    });
  }
  // §17.4.4: top to bottom is time. The `<message>` list is not ordered by the
  // metamodel — the `fragment` list is — so the order comes off the occurrences.
  interaction.messages.sort((a, b) => a.y - b.y);

  /* ── The geometry the file does not carry ──────────────────────────── */

  const height = umlSequenceSlot(pass.slot) + UML_SD_EVENT_STEP;
  const columns = new Map<string, UmlBox>();
  for (const lifeline of interaction.lifelines) {
    const box = umlSequenceColumn(columnOf.get(lifeline.id) ?? 0, height);
    lifeline.bounds = box;
    columns.set(lifeline.id, box);
  }
  for (const record of interaction.executions) {
    const column = record.lifelineId
      ? columns.get(record.lifelineId)
      : undefined;
    if (column) {
      record.bounds = umlSequenceExecution(column, record.y0, record.y1);
    }
  }
  for (const record of interaction.destructions) {
    const column = record.lifelineId
      ? columns.get(record.lifelineId)
      : undefined;
    if (column) record.bounds = umlSequenceDestruction(column, record.y);
  }
  for (const record of interaction.fragments) {
    const covered = record.coveredLifelineIds
      .map(each => columns.get(each))
      .filter((box): box is UmlBox => box !== undefined);
    const y0 = record.bounds?.y ?? 0;
    const y1 = y0 + (record.bounds?.h ?? UML_SD_EVENT_STEP);
    record.bounds = umlSequenceFragment(
      covered.length > 0 ? covered : [...columns.values()],
      y0,
      y1
    );
    if (record.coveredLifelineIds.length === 0) {
      record.coveredLifelineIds = interaction.lifelines.map(each => each.id);
    }
  }
  return interaction;
}

/**
 * §17.3.4's `: <Type>` half of a lifeline head, wherever the file put it.
 *
 * `Lifeline::represents` is a ConnectableElement, so a tool that has one writes
 * an idref and this reader resolves it to a NAME — which is what a head can
 * draw. Our own writer has no Property to point at and files the type under
 * `xmi:Extension` instead (XMI 2.5.1 §7.9), so that is read too, and the head
 * comes back exactly as it went out.
 */
function lifelineTypeOf(ctx: Context, node: XmlNode): { type?: string } {
  for (const child of node.children) {
    if (!isLabreExtension(child)) continue;
    const represents = xmlChild(child, 'represents');
    const named = represents ? xmlAttr(represents, 'name') : undefined;
    if (named) {
      consume(ctx, represents);
      if (child.children.every(entry => ctx.consumed.has(entry))) {
        consume(ctx, child);
      }
      return { type: named };
    }
  }
  // A tool that HAS a ConnectableElement to point at: §17.3.4's `: <Type>` is
  // then the type of that Property, not its name — `anOrder : Order` is a
  // property called `anOrder` typed by `Order`, and the head writes the second.
  // A Property with no type says nothing a head can draw, so nothing is
  // invented.
  const represents = xmlAttr(node, 'represents');
  const property = represents ? ctx.byId.get(represents) : undefined;
  const typed =
    property &&
    (xmlAttr(property, 'type') ??
      (xmlChild(property, 'type')
        ? refOf(xmlChild(property, 'type')!)
        : undefined));
  const named = typed ? nameOfId(ctx, typed) : undefined;
  return named ? { type: named } : {};
}
/* ── One package ──────────────────────────────────────────────────────── */

/**
 * Everything one package declares, read into one model.
 *
 * Recursive over nested packages, and FLAT in the model: `UmlModel.packages` is
 * a list of boxes whose nesting the drawing states (`xmi.ts`'s `containerOf`
 * reads it off geometry), and a file that carries no geometry has not said
 * where anything is drawn. The nesting is therefore a fact this import cannot
 * place on the canvas, and it says so once rather than silently drawing a flat
 * sheet that looks like the author's.
 */
function readPackage(
  ctx: Context,
  draft: Draft,
  node: XmlNode,
  containerId?: string
): void {
  const contained = (childId: string) => {
    if (!containerId) return;
    draft.nested += 1;
    // Recorded as well as counted: the count is what the report says, and the
    // pair is what the invented layout needs to DRAW the nesting rather than
    // apologise for it (`import.ts`, `UmlLayoutHints.containment`).
    ctx.containment[childId] = containerId;
  };
  for (const child of node.children) {
    if (isLabreExtension(child)) continue;
    const meta = metaOf(child) ?? '';

    if (child.local === 'ownedComment' || meta === 'Comment') {
      consume(ctx, child);
      const commentId = map(ctx, child);
      const bodyChild = xmlChild(child, 'body');
      consume(ctx, bodyChild);
      const body =
        xmlAttr(child, 'body') ?? bodyChild?.text ?? child.text ?? '';
      draft.model.notes.push({
        id: commentId,
        name: '',
        keywords: [],
        isAbstract: false,
        ...(ctx.layout[commentId] ? { bounds: ctx.layout[commentId] } : {}),
        body,
      });
      own(draft, commentId);
      for (const annotated of (xmlAttr(child, 'annotatedElement') ?? '')
        .split(/\s+/)
        .filter(Boolean)) {
        relate(draft, 'anchor', commentId, annotated);
      }
      continue;
    }

    if (child.local !== 'packagedElement' && child.local !== 'ownedUseCase') {
      continue;
    }

    // A use case owned by its subject (§18.1.4) — containment, not a reference,
    // so the case is read here and the subject is what it is drawn inside.
    if (child.local === 'ownedUseCase' || meta === 'UseCase') {
      consume(ctx, child);
      const useCaseId = map(ctx, child);
      carryUnknownAttrs(ctx, child, useCaseId);
      draft.model.useCases.push(readUseCase(ctx, draft, child, useCaseId));
      own(draft, useCaseId);
      contained(useCaseId);
      continue;
    }

    if (meta === 'Package') {
      consume(ctx, child);
      const packageId = map(ctx, child);
      carryUnknownAttrs(ctx, child, packageId);
      draft.model.packages.push(readBase(ctx, child, packageId));
      own(draft, packageId);
      contained(packageId);
      readPackage(ctx, draft, child, packageId);
      continue;
    }

    if (CLASSIFIER_KIND[meta]) {
      consume(ctx, child);
      const classifierId = map(ctx, child);
      carryUnknownAttrs(ctx, child, classifierId);
      readClassifier(ctx, draft, child, meta, classifierId);
      contained(classifierId);
      continue;
    }

    if (meta === 'Actor') {
      consume(ctx, child);
      const actorId = map(ctx, child);
      carryUnknownAttrs(ctx, child, actorId);
      draft.model.actors.push(readBase(ctx, child, actorId));
      own(draft, actorId);
      continue;
    }

    if (meta === 'Component') {
      consume(ctx, child);
      const componentId = map(ctx, child);
      carryUnknownAttrs(ctx, child, componentId);
      // The SUBJECT of a use case diagram is a Component with cases in it —
      // which is what §18.1.4 makes it and what `xmi.ts` writes. A component
      // with no `ownedUseCase` is a component (§11.6.4), and the drawing is the
      // only thing that differs.
      if (xmlChild(child, 'ownedUseCase') || draft.subjectLikely) {
        draft.model.subjects.push(readBase(ctx, child, componentId));
        own(draft, componentId);
        readPackage(ctx, draft, child, componentId);
      } else {
        draft.model.components.push(
          readComponent(ctx, draft, child, componentId)
        );
        own(draft, componentId);
      }
      continue;
    }

    if (meta === 'Artifact') {
      consume(ctx, child);
      const artifactId = map(ctx, child);
      carryUnknownAttrs(ctx, child, artifactId);
      draft.model.artifacts.push(readBase(ctx, child, artifactId));
      own(draft, artifactId);
      for (const manifestation of xmlChildren(child, 'manifestation')) {
        consume(ctx, manifestation);
        relate(
          draft,
          'manifest',
          artifactId,
          xmlAttr(manifestation, 'utilizedElement') ??
            xmlAttr(manifestation, 'supplier'),
          labelOf(manifestation)
        );
      }
      continue;
    }

    if (DEPLOYMENT_KIND[meta]) {
      consume(ctx, child);
      const cubeId = map(ctx, child);
      carryUnknownAttrs(ctx, child, cubeId);
      draft.model.nodes.push({
        ...readBase(ctx, child, cubeId),
        kind: DEPLOYMENT_KIND[meta]!,
      });
      own(draft, cubeId);
      for (const deployment of xmlChildren(child, 'deployment')) {
        consume(ctx, deployment);
        relate(
          draft,
          'deploy',
          xmlAttr(deployment, 'deployedArtifact') ??
            xmlAttr(deployment, 'supplier'),
          cubeId,
          labelOf(deployment)
        );
      }
      continue;
    }

    if (meta === 'Association' || meta === 'CommunicationPath') {
      consume(ctx, child);
      const associationId = map(ctx, child);
      carryUnknownAttrs(ctx, child, associationId);
      readAssociation(
        ctx,
        draft,
        child,
        associationId,
        meta === 'CommunicationPath' ? 'communication-path' : 'association'
      );
      continue;
    }

    if (DEPENDENCY_KIND[meta]) {
      consume(ctx, child);
      const dependencyId = map(ctx, child);
      carryUnknownAttrs(ctx, child, dependencyId);
      const clientChild = xmlChild(child, 'client');
      const supplierChild = xmlChild(child, 'supplier');
      consume(ctx, clientChild, supplierChild);
      const client =
        xmlAttr(child, 'client') ??
        (clientChild ? refOf(clientChild) : undefined);
      const supplier =
        xmlAttr(child, 'supplier') ??
        (supplierChild ? refOf(supplierChild) : undefined);
      relate(draft, DEPENDENCY_KIND[meta]!, client, supplier, labelOf(child));
      continue;
    }

    if (meta === 'Activity') {
      consume(ctx, child);
      const activityId = map(ctx, child);
      carryUnknownAttrs(ctx, child, activityId);
      draft.model.activities.push(readActivity(ctx, draft, child, activityId));
      continue;
    }

    if (meta === 'StateMachine') {
      consume(ctx, child);
      const machineId = map(ctx, child);
      carryUnknownAttrs(ctx, child, machineId);
      draft.model.stateMachines.push(
        readStateMachine(ctx, draft, child, machineId)
      );
      continue;
    }

    if (meta === 'Interaction') {
      consume(ctx, child);
      const interactionId = map(ctx, child);
      carryUnknownAttrs(ctx, child, interactionId);
      draft.model.interactions.push(
        readInteraction(ctx, draft, child, interactionId)
      );
      continue;
    }
  }
}

/**
 * The Signals and Events an activity glyph REFERENCED, folded into the sheet.
 *
 * `xmi.ts` mints a `uml:Signal` beside an Activity because a SendSignalAction's
 * `signal` is a reference and a reference needs something to point at. Reading
 * it back means recognising exactly those: a Signal a glyph names is the glyph's
 * own name written twice, and re-drawing it would put a box on the canvas the
 * author never drew. A Signal NOTHING names is a declaration the file makes on
 * its own account, and it is quarantined like anything else this reader cannot
 * draw.
 */
function consumeReferencedEvents(
  ctx: Context,
  draft: Draft,
  node: XmlNode
): void {
  for (const child of xmlChildren(node, 'packagedElement')) {
    const meta = metaOf(child) ?? '';
    if (meta !== 'Signal' && meta !== 'SignalEvent' && meta !== 'TimeEvent') {
      continue;
    }
    const id = xmlAttr(child, 'id');
    if (!id) continue;
    if (meta === 'Signal' && !draft.usedSignals.has(id)) continue;
    if (meta !== 'Signal' && !referencedByATrigger(node, id)) continue;
    // Whole: a TimeEvent owns its `<when>` TimeExpression, and the expression
    // is the glyph's own words read back through `parseTrigger` at export.
    consumeSubtree(ctx, child);
    // A signal referenced by an event that is itself referenced.
    const signal = xmlAttr(child, 'signal');
    if (signal) draft.usedSignals.add(signal);
  }
  // A second pass, because a SignalEvent names its Signal and the two are
  // written in either order.
  for (const child of xmlChildren(node, 'packagedElement')) {
    const id = xmlAttr(child, 'id');
    if ((metaOf(child) ?? '') !== 'Signal' || !id) continue;
    if (draft.usedSignals.has(id)) consume(ctx, child);
  }
}

/** Does any `<trigger event="…">` under this package name that id? */
function referencedByATrigger(node: XmlNode, id: string): boolean {
  return xmlDescendants(node).some(
    descendant =>
      descendant.local === 'trigger' && xmlAttr(descendant, 'event') === id
  );
}

/* ── The diagram kind ─────────────────────────────────────────────────── */

/**
 * Which Annex A frame this package was drawn as.
 *
 * Our own extension when the file carries one — it is the one fact the UML
 * metamodel has no slot for, which is why `xmi.ts` files it under
 * `xmi:Extension` in the first place. Otherwise INFERRED from what the package
 * declares, in the order a diagram is recognised by eye: actors and use cases
 * make a use case sheet whatever else is on it, a flow makes an activity, a
 * machine makes a state machine, cubes and artefacts make a deployment,
 * components make a component diagram, and everything else is a class diagram
 * — which is also what `UmlDiagramElementModel` defaults to.
 */
function declaredDiagramKind(
  ctx: Context,
  node: XmlNode
): UmlDiagramKind | undefined {
  for (const child of node.children) {
    if (!isLabreExtension(child)) continue;
    const diagram = xmlChild(child, 'diagram');
    const kind = diagram ? xmlAttr(diagram, 'kind') : undefined;
    if (!kind) continue;
    consume(ctx, diagram);
    if (child.children.every(entry => ctx.consumed.has(entry))) {
      consume(ctx, child);
    }
    return kind as UmlDiagramKind;
  }
  return undefined;
}

/** What the package DECLARES, when nothing said which frame it was drawn as. */
function inferDiagramKind(model: UmlModel): UmlDiagramKind {
  // An Interaction first: §17.2.4's sheet is the one that draws its
  // participants as lifelines, and a `uml:Actor` referenced by one would
  // otherwise make it look like a use case diagram.
  if (model.interactions.length > 0) return 'sd';
  if (model.useCases.length > 0 || model.actors.length > 0) return 'uc';
  if (model.activities.length > 0) return 'act';
  if (model.stateMachines.length > 0) return 'stm';
  if (model.nodes.length > 0 || model.artifacts.length > 0) return 'dep';
  if (model.components.length > 0) return 'cmp';
  return 'class';
}

/* ── The sweep ────────────────────────────────────────────────────────── */

/**
 * Everything the reader did not read, kept verbatim under the nearest artefact.
 *
 * One pass, after the whole document has been read, because "nearest mapped
 * ancestor" is a question only the finished tree can answer. It descends into
 * what was consumed and stops at what was not: an `<eAnnotations>` is
 * quarantined whole, with its children inside it, rather than once per node —
 * the fragment is the file's own bytes and the file nested them.
 */
function sweep(ctx: Context, node: XmlNode, scope: string): void {
  for (const child of node.children) {
    const nearer = ctx.scopeOf.get(child);
    if (nearer !== undefined) {
      sweep(ctx, child, nearer);
      continue;
    }
    if (ctx.consumed.has(child)) {
      sweep(ctx, child, scope);
      continue;
    }
    quarantine(
      ctx,
      scope,
      xmlFragmentOf(ctx.source, child),
      UML_XMI_QUARANTINE_REASON.unmapped,
      {
        element: child.name,
        ...(xmlAttr(child, 'id') ? { sourceId: xmlAttr(child, 'id')! } : {}),
      }
    );
  }
}

/* ── The document ─────────────────────────────────────────────────────── */

/** The `uml:Model` / `uml:Package` a file opens on, through any wrapper. */
function rootOf(document: { roots: XmlNode[] }): XmlNode | undefined {
  for (const root of document.roots) {
    if (root.local === 'Model' || root.local === 'Package') return root;
    // `<xmi:XMI>` is XMI's own multi-root wrapper, and Enterprise Architect
    // writes one round everything.
    if (root.local === 'XMI') {
      const inner = root.children.find(
        child => child.local === 'Model' || child.local === 'Package'
      );
      if (inner) return inner;
    }
  }
  return undefined;
}

/**
 * Read an XMI 2.5.1 document as models plus a report.
 *
 * See the module comment for the contract, and `docs/adr/0012` D1–D6 for why it
 * is this contract and not a shorter one.
 */
export function importXmi(
  source: string,
  context: InterchangeImportContext = {}
): UmlXmiImport {
  const document = readXml(source);
  // The three bags keyed by an id the FILE chose have no prototype: `__proto__`
  // and `constructor` are ids a document is free to use, and on a plain object
  // the first writes through to `Object.prototype` and the second reads a
  // function back as a box. Nothing downstream asks these bags for an inherited
  // method — spread, `Object.keys` and `Object.entries` all still work.
  const ctx: Context = {
    source,
    notes: [],
    foreign: Object.create(null),
    layout: Object.create(null),
    byId: new Map(),
    consumed: new Set(),
    scopeOf: new Map(),
    counts: { mapped: 0, carried: 0, quarantined: 0 },
    containment: Object.create(null),
    minted: 0,
  };

  for (const complaint of document.notes) {
    note(ctx, { kind: 'warning', message: complaint });
  }

  const root = rootOf(document);
  if (!root) {
    const opened = document.roots[0]?.name;
    note(ctx, {
      kind: 'warning',
      ...(opened ? { element: opened } : {}),
      // Two SHAPES of sentence, so two keys — never one key whose wording
      // depends on a branch the host cannot see.
      ...(opened
        ? {
            messageKey: UML_XMI_REMARKS.wrongRoot[0],
            message: `A UML interchange file opens on <uml:Model> or <uml:Package>; this one opens on <${opened}>. Nothing was imported.`,
            messageParams: { tag: opened },
          }
        : {
            messageKey: UML_XMI_REMARKS.noXml[0],
            message: UML_XMI_REMARKS.noXml[1],
          }),
    });
    return {
      models: [],
      layout: {},
      containment: {},
      foreign: {},
      report: { mapped: 0, carried: 0, quarantined: 0, notes: ctx.notes },
    };
  }

  for (const node of [root, ...xmlDescendants(root)]) {
    const id = xmlAttr(node, 'id');
    if (id && !ctx.byId.has(id)) ctx.byId.set(id, node);
  }
  // The DI lives beside the model, not under it — a `.notation` island, a
  // `umldi` root — so it is read off the whole document rather than off `root`.
  for (const island of document.roots) {
    Object.assign(ctx.layout, readLayout(island));
  }

  /* ── The packages that are the sheets ──────────────────────────────── */

  const packages =
    root.local === 'Package'
      ? [root]
      : root.children.filter(
          child =>
            child.local === 'packagedElement' &&
            (metaOf(child) ?? '') === 'Package'
        );

  const models: UmlModel[] = [];
  const drafts: Draft[] = [];

  /** A `uml:Model` whose classifiers hang loose — Papyrus's own shape. */
  const sheets = packages.length > 0 ? packages : [root];

  for (const sheet of sheets) {
    const sheetId = map(ctx, sheet);
    carryUnknownAttrs(ctx, sheet, sheetId);
    const name = xmlAttr(sheet, 'name') ?? context.name ?? '';
    const declaredKind = declaredDiagramKind(ctx, sheet);
    const draft: Draft = {
      model: emptyModel(sheetId, name),
      ids: new Set(),
      ends: new Map(),
      usedSignals: new Set(),
      nested: 0,
      ...(declaredKind ? { declaredKind } : {}),
      subjectLikely:
        declaredKind === 'uc' ||
        xmlDescendants(sheet).some(
          each =>
            each.local === 'ownedUseCase' || (metaOf(each) ?? '') === 'UseCase'
        ),
    };
    readPackage(ctx, draft, sheet);
    consumeReferencedEvents(ctx, draft, sheet);
    drafts.push(draft);
    models.push(draft.model);
  }

  /* ── The root's own declarations ───────────────────────────────────── */

  // A `uml:DataType` at the root is what `xmi.ts` mints for a type name nothing
  // on the canvas answered for. It is READ — every `total : Money` in the file
  // resolves through it — and it is not drawn, because the author never drew
  // it. Consumed rather than quarantined for exactly that reason.
  if (root.local !== 'Package') {
    for (const child of root.children) {
      const meta = metaOf(child) ?? '';
      if (child.local !== 'packagedElement') continue;
      if (meta === 'DataType' || meta === 'PrimitiveType') consume(ctx, child);
    }
  }

  /* ── What each sheet can actually draw ─────────────────────────────── */

  for (const draft of drafts) {
    const { model } = draft;
    const kept: UmlRelation[] = [];
    for (const relation of model.relations) {
      if (
        draft.ids.has(relation.sourceId) &&
        draft.ids.has(relation.targetId)
      ) {
        kept.push(relation);
        continue;
      }
      note(ctx, {
        kind: 'warning',
        messageKey: UML_XMI_REMARKS.offSheetRelation[0],
        message: `A ${relation.kind} in "${model.diagram.name}" runs to an element that is not on this sheet, so it is not drawn. The file still says it, and nothing was removed from the document.`,
        messageParams: { kind: relation.kind, name: model.diagram.name },
      });
    }
    model.relations = kept;

    // A partition or a lane whose nodes are elsewhere is still a lane.
    for (const activity of model.activities) {
      activity.edges = activity.edges.filter(
        edge => draft.ids.has(edge.sourceId) && draft.ids.has(edge.targetId)
      );
    }
    for (const machine of model.stateMachines) {
      machine.transitions = machine.transitions.filter(
        transition =>
          draft.ids.has(transition.sourceId) &&
          draft.ids.has(transition.targetId)
      );
    }
  }

  /* ── The frame each sheet is ───────────────────────────────────────── */

  for (const draft of drafts) {
    const kind = draft.declaredKind ?? inferDiagramKind(draft.model);
    draft.model.diagram.kind = kind;
    draft.model.diagram.heading = `${kind} ${draft.model.diagram.name}`.trim();
    const bounds = ctx.layout[draft.model.diagram.id];
    if (bounds) draft.model.diagram.bounds = bounds;
  }

  /* ── Nothing is lost (D1, D5) ──────────────────────────────────────── */

  // D6's residue, and its one accepted asymmetry: what has no artefact of its
  // own rides on the FIRST sheet's frame. Delete that frame and what it carried
  // goes with it — which is the whole argument of D2, made once more.
  const residue = drafts[0]?.model.diagram.id;
  if (residue) {
    for (const island of document.roots) sweep(ctx, island, residue);
  }

  if (Object.keys(ctx.layout).length === 0 && ctx.counts.mapped > 0) {
    note(ctx, {
      kind: 'invented-layout',
      messageKey: UML_XMI_REMARKS.modelWithoutDiagram[0],
      message: UML_XMI_REMARKS.modelWithoutDiagram[1],
    });

    // The one statement a file can make that this reader can read and cannot
    // draw. Said once per document, in the user's words, and said because a
    // silent flattening is the kind of loss they would only find months later:
    // on this canvas a package holds what its box holds (§12.2.4 is drawn, not
    // stored), so containment needs geometry, and a model file carries none.
    const nested = drafts.reduce((total, draft) => total + draft.nested, 0);
    if (nested > 0) {
      note(ctx, {
        kind: 'warning',
        // The one wording this lot changed: the count's own singular/plural
        // is the HOST's (ADR 0023), so the English fallback stays neutral —
        // `{{count}} element(s) are` — exactly as BPMN's `{{count}} lane(s)`
        // does, rather than picking English's agreement in the library.
        messageKey: UML_XMI_REMARKS.nestedWithoutDrawing[0],
        message: `${nested} element(s) are declared inside another in this file — a class in a package, a use case in its subject. Labre states that by DRAWING one box inside the other, and this file carries no drawing, so they were laid out side by side. Move them into the box to say it again.`,
        messageParams: { count: nested },
      });
    }
  }

  // The behaviour edges, counted once they are known to be DRAWN.
  //
  // An `<edge>` and a `<transition>` are children of the Activity and the
  // StateMachine rather than elements with an id of their own, so `map()` — the
  // one place `mapped` is incremented — never sees them. Counted here, after the
  // pass that drops the ones running off the sheet, so the report says how many
  // arrows the board has rather than how many the file wrote.
  for (const model of models) {
    for (const activity of model.activities) {
      ctx.counts.mapped += activity.edges.length;
    }
    for (const machine of model.stateMachines) {
      ctx.counts.mapped += machine.transitions.length;
    }
  }

  const version = xmlAttr(root, 'version');
  return {
    models,
    layout: ctx.layout,
    containment: ctx.containment,
    foreign: ctx.foreign,
    report: {
      mapped: ctx.counts.mapped,
      carried: ctx.counts.carried,
      quarantined: ctx.counts.quarantined,
      notes: ctx.notes,
      ...(version ? { sourceVersion: version } : {}),
    },
  };
}

/* ── Putting the foreign matter back on the elements ──────────────────── */

/**
 * The materializer's elements, each carrying what the file said about it.
 *
 * ## Why this is a second pass and not an argument
 *
 * `umlElementsFromModel` already writes `interchange[formatId] = { id }` on
 * every element it mints — the source id, verbatim, which is D3's fixed point —
 * so the id map this needs is not a thing the parser has to be told: it is
 * written on the elements. Merging here keeps the materializer one function of
 * one IR, shared by three importers, none of which has to know what the others
 * carry.
 *
 * The payload is written as ONE whole blob per format, never patched field by
 * field: the `Y.Map` entry is the entire record, so a partial update is a
 * last-write-wins overwrite of everything (D2).
 *
 * ## The residue (D6)
 *
 * A payload whose source id matched no element — the document-scope matter, a
 * quarantined fragment off an element that was never drawn — rides on the FIRST
 * element, which for this materializer is the first sheet's frame. Its accepted
 * asymmetry is D6's own: delete that frame and what it carried goes with it.
 */
export function umlElementsWithForeign(
  elements: readonly SerializedElementProps[],
  foreign: Readonly<Record<string, ForeignInterchange>>,
  formatId: string
): SerializedElementProps[] {
  const placed = new Set<string>();
  const merged = elements.map(props => {
    const carried = props.interchange as
      | Record<string, ForeignInterchange>
      | undefined;
    const sourceId = carried?.[formatId]?.id;
    const payload = sourceId ? foreign[sourceId] : undefined;
    if (!sourceId || !payload) return props;
    placed.add(sourceId);
    return {
      ...props,
      interchange: { ...carried, [formatId]: payload },
    };
  });

  const residue = Object.entries(foreign).filter(
    ([sourceId]) => !placed.has(sourceId)
  );
  const first = merged[0];
  if (residue.length === 0 || !first) return merged;

  const carried = first.interchange as
    | Record<string, ForeignInterchange>
    | undefined;
  const own = carried?.[formatId] ?? {};
  // Flattened onto the frame's own payload rather than nested under a second
  // key, because `ForeignInterchange` is one record per format and the SCOPES
  // inside it are what keep two source elements apart.
  const attrs = residue.reduce<Record<string, Record<string, string>>>(
    (all, [, payload]) => ({ ...all, ...payload.attrs }),
    { ...own.attrs }
  );
  const quarantined = [
    ...(own.quarantined ?? []),
    ...residue.flatMap(([, payload]) => payload.quarantined ?? []),
  ];
  merged[0] = {
    ...first,
    interchange: {
      ...carried,
      [formatId]: {
        ...own,
        // Absent rather than empty: `{}` costs a `Y.Map` entry and makes "this
        // element carried nothing" untestable (D2).
        ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
        ...(quarantined.length > 0 ? { quarantined } : {}),
      },
    },
  };
  return merged;
}
