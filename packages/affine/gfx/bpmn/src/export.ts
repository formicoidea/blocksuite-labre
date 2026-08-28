import {
  backgroundInstanceZones,
  backgroundPlot,
} from '@labre/affine-block-surface';
import type {
  BpmnLane,
  BpmnNodeElementModel,
  BpmnNodeKind,
  BpmnPoolElementModel,
  ConnectorElementModel,
} from '@labre/affine-model';
import type { Bound } from '@labre/global/gfx';
import type { ForeignInterchange } from '@labre/std/gfx';

import { BPMN_POOL_BACKGROUND } from './background.js';
import { bpmnLaneOf, bpmnPoolOf } from './facts.js';
import { BPMN_ROLE } from './roles.js';

/** The namespace the pool's instance zones report under. See `facts.ts`. */
const LANE_PREFIX = BPMN_POOL_BACKGROUND.instanceZones?.idPrefix ?? 'lane';

/**
 * The board, as a BPMN 2.0 interchange document (clause 15) — semantic model
 * plus BPMN DI, in one `definitions` element.
 *
 * ## Pure by construction
 *
 * Element models in, string out. No `BlockStdScope`, no surface, no DOM, no
 * clock and no randomness — the same discipline `facts.ts` holds itself to, and
 * for the same three reasons: a host can call it, a test can call it with plain
 * stubs, and the same board always serializes to the same bytes. The command
 * that downloads the file is the only thing that knows what a canvas is.
 *
 * ## What it says, and what it refuses to say
 *
 * The export speaks the author's STATEMENTS and nothing else. A connector
 * carrying no BPMN role relates nothing — `docs/adr/0010` is explicit that the
 * role is the statement — so it is not a sequence flow that happens to be
 * untyped, it is not a flow at all, and it is absent. A plain rectangle drawn
 * beside a pool is likewise not an unnamed task. The alternative — guessing —
 * would put words in an architect's mouth in a file they are about to hand to
 * an execution engine.
 *
 * ## Conformance target
 *
 * The **Descriptive** sub-class of BPMN 2.0 (spec Table 2.1), which is exactly
 * the vocabulary the pack draws: the seventeen artefacts map onto the
 * seventeen-odd element names that table lists, and nothing here needs the
 * executable half of the metamodel. Clause 15.1 explicitly licenses a partial
 * model — implementers "disregard missing attributes marked required" — which
 * is what lets a picture drawn for humans round-trip through bpmn.io without
 * inventing an `ioSpecification` nobody asked for.
 */

/* ── Namespaces ───────────────────────────────────────────────────────── */

/**
 * The four namespaces an interchange file is written in, with the prefixes the
 * spec's own schema uses (`bpmndi`, `di`, `dc`; §12.2.4 and Annex B).
 *
 * Prefixes are arbitrary and URIs are not — bpmn.io writes the same two DD
 * namespaces as `omgdi` / `omgdc` — so the URIs are what is pinned by the tests
 * and the prefixes merely have to be consistent with themselves. The MODEL
 * namespace is given the explicit `bpmn` prefix rather than made the default,
 * because a reader of the file should never have to work out which of two
 * unprefixed vocabularies an element belongs to.
 *
 * The stale `.../BPMNDI/1.0.0` that appears in the spec's own clause 15.3.1
 * example is a documented erratum and is NOT what the normative schema says.
 */
export const BPMN_NS = {
  model: 'http://www.omg.org/spec/BPMN/20100524/MODEL',
  bpmndi: 'http://www.omg.org/spec/BPMN/20100524/DI',
  di: 'http://www.omg.org/spec/DD/20100524/DI',
  dc: 'http://www.omg.org/spec/DD/20100524/DC',
} as const;

/**
 * The four declarations this library writes, as they appear on `definitions` —
 * the PAIR, prefix and URI together, and the pair is the point.
 *
 * A reader carries a file's namespace declarations because a carried fragment
 * is stored with the prefixes the file spelled it in, and a `camunda:property`
 * or a `bpmn2:boundaryEvent` means nothing under a declaration nobody wrote.
 * What it must NOT carry is a declaration this writer is going to make anyway,
 * or the payload gains four permanent entries, every Labre file reports four
 * things carried, and the "a file we wrote comes back with an empty middle
 * column" property — the no-slow-leak property — stops being true.
 *
 * Keyed by the attribute NAME rather than by the URI, because the prefix is
 * exactly what differs: bpmn.io writes the model namespace as `bpmn2:` and this
 * library writes it as `bpmn:`, and a fragment carrying `bpmn2:` is unreadable
 * unless `xmlns:bpmn2` comes back with it. Same URI, different prefix,
 * different fate — which a set of URIs cannot express.
 */
export const BPMN_OWN_DECLARATIONS: Readonly<Record<string, string>> = {
  'xmlns:bpmn': BPMN_NS.model,
  'xmlns:bpmndi': BPMN_NS.bpmndi,
  'xmlns:di': BPMN_NS.di,
  'xmlns:dc': BPMN_NS.dc,
};

/**
 * Where the ids this exporter mints live.
 *
 * `targetNamespace` is the ONE attribute `definitions` requires (spec §15.3.1),
 * and it has to be a URI nobody else claims: it is what a second document
 * IMPORTING this one would qualify its references with.
 *
 * It is deliberately NOT what the references inside this file resolve through.
 * Several of them are typed `xsd:QName` — `participant/@processRef`,
 * `group/@categoryValueRef`, `dataObjectReference/@dataObjectRef`, every DI
 * `bpmnElement`, and `messageFlow` / `association` `sourceRef` / `targetRef` —
 * and an unprefixed QName resolves against the DEFAULT namespace, which this
 * document declares none of (see the note on {@link BPMN_NS} for why the MODEL
 * namespace takes an explicit prefix instead). They are emitted as bare local
 * names, which is byte for byte what bpmn.io and Camunda Modeler write, and
 * every tool resolves them by id within the one file.
 */
const TARGET_NAMESPACE = 'https://labre.app/bpmn';

/**
 * The interchange format's id — the key under which foreign matter from a
 * `.bpmn` rides on an element (`interchange.bpmn`, ADR 0012 D2), and the middle
 * term of both capability ids.
 *
 * Declared here, in the module both directions already depend on, so that the
 * writer, the reader and the registry entry cannot disagree about which key
 * they are talking about.
 */
export const BPMN_FORMAT_ID = 'bpmn';

const EXPORTER = 'Labre';

/* ── Kind → XML element ───────────────────────────────────────────────── */

/**
 * Which slot of `process` an artefact serializes into.
 *
 * Not decoration: the spec's `tProcess` sequence is `laneSet* → flowElement* →
 * artifact*` in that order, and a `textAnnotation` written before a `task` is a
 * document a validating parser rejects. It also decides what a LANE may point
 * at — `flowNodeRef` is an IDREF to a flow NODE, and a data reference is a flow
 * element that is not one, so a data object sitting in a lane is simply not
 * referenced by it.
 */
type BpmnXmlSlot = 'flowNode' | 'data' | 'artifact';

export interface BpmnXmlMapping {
  /** The semantic element name, in the MODEL namespace. */
  element: string;
  slot: BpmnXmlSlot;
  /** The child that says what TRIGGERS the event, for the four variants. */
  eventDefinition?:
    | 'messageEventDefinition'
    | 'timerEventDefinition'
    | 'terminateEventDefinition';
}

/**
 * The whole notation, kind by kind — the table this module is really about.
 *
 * `Record<BpmnNodeKind, …>` and therefore COMPILE-TOTAL: a kind added to the
 * pack without a BPMN element name to serialize it as fails the build here,
 * which is the only place that failure is cheap. A kind that reached a
 * document and had no mapping would be an artefact the author drew, saved, and
 * then silently lost on export.
 *
 * Three of the seventeen do not map one-for-one and the reasons are the spec's:
 *
 * - the four TRIGGERED events are `startEvent` / `endEvent` carrying an event
 *   definition child, never elements of their own — "message start event" is a
 *   start event with a `messageEventDefinition` in it (§10.4.2);
 * - a data object serializes as `dataObjectReference`, because DI attaches to
 *   the REFERENCE and not to the `dataObject` it points at (§10.4.1, and the
 *   spec's own rule that "Data Object Reference cannot specify item
 *   definitions, and Data Objects cannot specify states"). The `dataObject`
 *   itself is emitted alongside it;
 * - a `group` carries no `name` at all. Its visible label is the `value` of the
 *   `categoryValue` it points at, which is a ROOT element of the document — the
 *   one place in this file where drawing a box round three tasks costs two
 *   extra elements somewhere else entirely (§10.4, Table 8.30).
 */
export const BPMN_XML_OF_KIND: Record<BpmnNodeKind, BpmnXmlMapping> = {
  startEvent: { element: 'startEvent', slot: 'flowNode' },
  startEventMessage: {
    element: 'startEvent',
    slot: 'flowNode',
    eventDefinition: 'messageEventDefinition',
  },
  startEventTimer: {
    element: 'startEvent',
    slot: 'flowNode',
    eventDefinition: 'timerEventDefinition',
  },
  endEvent: { element: 'endEvent', slot: 'flowNode' },
  endEventMessage: {
    element: 'endEvent',
    slot: 'flowNode',
    eventDefinition: 'messageEventDefinition',
  },
  endEventTerminate: {
    element: 'endEvent',
    slot: 'flowNode',
    eventDefinition: 'terminateEventDefinition',
  },
  task: { element: 'task', slot: 'flowNode' },
  taskUser: { element: 'userTask', slot: 'flowNode' },
  taskService: { element: 'serviceTask', slot: 'flowNode' },
  subProcess: { element: 'subProcess', slot: 'flowNode' },
  callActivity: { element: 'callActivity', slot: 'flowNode' },
  gatewayExclusive: { element: 'exclusiveGateway', slot: 'flowNode' },
  gatewayParallel: { element: 'parallelGateway', slot: 'flowNode' },
  dataObject: { element: 'dataObjectReference', slot: 'data' },
  dataStore: { element: 'dataStoreReference', slot: 'data' },
  textAnnotation: { element: 'textAnnotation', slot: 'artifact' },
  group: { element: 'group', slot: 'artifact' },
};

/** The three edge roles this exporter writes, and what each becomes. */
const EDGE_ELEMENT: Record<
  string,
  'sequenceFlow' | 'messageFlow' | 'association'
> = {
  [BPMN_ROLE.sequenceFlow]: 'sequenceFlow',
  [BPMN_ROLE.messageFlow]: 'messageFlow',
  [BPMN_ROLE.association]: 'association',
};

/* ── A minimal XML tree ───────────────────────────────────────────────── */

type Attrs = Record<string, string | number | boolean | undefined>;

interface XmlElement {
  name: string;
  attrs: Attrs;
  children: XmlNode[];
  /** Text content. Mutually exclusive with `children` in practice. */
  text?: string;
}

/**
 * A fragment an import carried, written back character for character.
 *
 * The one node in this tree that is NOT escaped on the way out, and the
 * exception is the whole point: the string was produced by the reader's
 * `fragmentOf`, which serialized a parsed subtree with this module's own
 * {@link escapeAttr} and {@link escapeText}. It is therefore already XML, with
 * its prefixes exactly as the source file spelled them and its own namespace
 * declarations where the source file put them. Escaping it a second time would
 * turn a `camunda:properties` element into visible text, which is the failure
 * this whole chantier exists to prevent.
 *
 * The reader and the writer are a pair, and the pair is what makes this safe:
 * nothing else in this codebase may construct one of these from a string it did
 * not serialize itself.
 */
interface XmlFragment {
  fragment: string;
}

type XmlNode = XmlElement | XmlFragment;

const el = (
  name: string,
  attrs: Attrs = {},
  children: XmlNode[] = []
): XmlElement => ({ name, attrs, children });

const textEl = (name: string, text: string, attrs: Attrs = {}): XmlElement => ({
  name,
  attrs,
  children: [],
  text,
});

/**
 * Character DATA — the three characters that would otherwise start markup.
 *
 * A newline, a tab and a carriage return are left exactly as they are, which is
 * what makes `<bpmn:text>` carry a multi-line annotation faithfully: inside an
 * element, whitespace is content.
 */
export function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * An attribute VALUE, which needs strictly more than character data does.
 *
 * The quotes are the obvious half. The other half is the one that loses data
 * silently: XML 1.0 §3.3.3 makes every conformant parser replace a literal
 * `#xA`, `#xD` or `#x9` in an attribute value with a SPACE before anyone sees
 * it — attribute-value normalization, and it is not optional. Only a character
 * reference survives it.
 *
 * That matters here because a multi-line label is ordinary on this canvas (it
 * is how a task fits in its box) and `name` is where nearly all of them go:
 * every flow node, the participant, the lane, the flows, and
 * `categoryValue/@value`. Written raw, a two-line task name comes back as one
 * line, with no warning and no way for the author to tell. Written as `&#10;`
 * it comes back as it went in.
 */
export function escapeAttr(value: string): string {
  return escapeText(value)
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('\n', '&#10;')
    .replaceAll('\r', '&#13;')
    .replaceAll('\t', '&#9;');
}

/**
 * A coordinate, as few characters as it can honestly be.
 *
 * Two decimals: DI coordinates are `xsd:double`, a canvas produces fractions no
 * eye can see, and `123.45000000000002` in a file a human reads is noise. The
 * rounding is applied AFTER the plane translation, so it never accumulates.
 */
function num(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function serializeElement(node: XmlNode, indent: string): string {
  // Verbatim, and only indented: whitespace INSIDE the fragment is content and
  // is never reflowed. See {@link XmlFragment}.
  if ('fragment' in node) return `${indent}${node.fragment}`;

  const attrs = Object.entries(node.attrs)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` ${key}="${escapeAttr(String(value))}"`)
    .join('');

  if (node.text !== undefined) {
    return `${indent}<${node.name}${attrs}>${escapeText(node.text)}</${node.name}>`;
  }
  if (node.children.length === 0) {
    return `${indent}<${node.name}${attrs} />`;
  }
  const inner = node.children
    .map(child => serializeElement(child, `${indent}  `))
    .join('\n');
  return `${indent}<${node.name}${attrs}>\n${inner}\n${indent}</${node.name}>`;
}

/* ── Ids ──────────────────────────────────────────────────────────────── */

/**
 * Which characters an XML `Name` admits — a conservative but UNICODE-AWARE
 * reading of NameStartChar / NameChar.
 *
 * Letters rather than `[A-Za-z]`, because NCName has always allowed them and an
 * architect writing in French or Portuguese should not have `tâche-1` folded to
 * `t_che-1`: two accented ids one letter apart would then differ only by the
 * minter's `_2` suffix, in the properties panel where a human reads them. The
 * production's exotic tail (combining marks, extenders, `·`) is deliberately
 * not enumerated — nothing on this canvas mints one, and a character wrongly
 * replaced by `_` is safe where a character wrongly kept is not.
 */
const NAME_START = /[\p{L}_]/u;
const NAME_CHAR = /[\p{L}\p{N}_.\-]/u;

/**
 * A surface id, as an XML NCName.
 *
 * `id` is `xsd:ID` throughout BPMN, which means NCName and means
 * DOCUMENT-unique — a `BPMNShape` may not carry the id of the `task` it
 * describes. Surface ids are nanoid-shaped: they routinely open on a digit and
 * may carry a `-`, both of which a validating parser refuses on an `xsd:ID`.
 *
 * So: every disallowed character becomes `_`, and an id that does not open on a
 * letter or `_` is prefixed with one. The transformation is lossy on purpose —
 * two distinct surface ids can collapse onto the same NCName — which is what
 * {@link IdMinter} is for.
 */
export function toNcName(raw: string): string {
  let out = '';
  for (const char of raw) {
    out += NAME_CHAR.test(char) ? char : '_';
  }
  if (out.length === 0 || !NAME_START.test(out[0])) out = `_${out}`;
  return out;
}

/** Whether a string is already an NCName, and can therefore be given back. */
export function isNcName(value: string): boolean {
  if (value.length === 0 || !NAME_START.test(value[0])) return false;
  for (const char of value) {
    if (!NAME_CHAR.test(char)) return false;
  }
  return true;
}

/**
 * The id a `.bpmn` import recorded for this element, verbatim (ADR 0012, D3).
 *
 * The read half of the round trip, and the whole of what this module knows
 * about importing: `interchange.bpmn.id` is what the file called this thing,
 * and giving it back is what makes the id map a FIXED POINT after one cycle —
 * the first export renames (surface id → NCName), every export after an import
 * gives back what it was given. The export writes nothing here, ever.
 *
 * Keyed by the FORMAT and not the framework, because a `.bpmn` and an OWM file
 * make different promises about the same element. Read defensively: the value
 * came out of a Y.Map and is whatever a peer wrote.
 */
function carriedBpmnId(model: {
  interchange?: Record<string, ForeignInterchange> | undefined;
}): string | undefined {
  const given = model.interchange?.[BPMN_FORMAT_ID]?.id;
  return typeof given === 'string' && given.length > 0 ? given : undefined;
}

/** The source element name an import recorded, when the element was carried. */
function carriedBpmnElement(model: {
  interchange?: Record<string, ForeignInterchange> | undefined;
}): string | undefined {
  const name = model.interchange?.[BPMN_FORMAT_ID]?.element;
  return typeof name === 'string' && name.length > 0 ? name : undefined;
}

/* ── Foreign matter, and where it goes back ───────────────────────────── */

/**
 * `.bpmn`'s scope vocabulary — where a carried fragment came off, and therefore
 * where this writer has to put it back (ADR 0012, D2 as amended in #157).
 *
 * Declared HERE, in the module both directions already depend on, for the same
 * reason {@link BPMN_FORMAT_ID} is: the reader files a fragment under a scope
 * and the writer looks it up under one, and a table written twice is a table
 * that drifts. `import.ts` re-exports it.
 *
 * One Labre element stands for several source elements: a pool is a
 * `participant` AND its `process`, plus a `laneSet`, every `lane`, the
 * `BPMNShape` that draws it, and — on the first pool of a document — the
 * `collaboration` and `definitions` themselves. Everything they carry lands in
 * ONE payload, so what came off which is recorded, or two lanes with the same
 * foreign attribute leave one value in a persisted field and a report that says
 * two.
 *
 * A scope is either a source element's **id, verbatim** — every carried flow
 * node, every lane, every carried root element — or one of the `@` keys below,
 * for the parts of the document that have no id worth naming or whose identity
 * is their relation to this element. `@` is not an XML NameStartChar, so no id
 * in a conformant file can ever collide with one.
 *
 * The rule for a fragment is always the same: **the scope is the element it was
 * a child of**. For an attribute it is the element that carried the attribute;
 * for a `di` fragment, what that fragment draws.
 */
export const BPMN_SCOPE = {
  /** The element this payload rides on: the participant, the flow node, the flow. */
  self: '@self',
  /** Its `BPMNShape` or `BPMNEdge`. */
  shape: '@shape',
  /** The `process` behind a participant — the pool's other half. */
  process: '@process',
  /** The pool's `laneSet`. */
  laneSet: '@laneSet',
  /** The `collaboration`, whose residue rides on the first pool (D6). */
  collaboration: '@collaboration',
  /** `definitions` itself: its foreign attributes, its declarations, its roots. */
  definitions: '@definitions',
} as const;

/**
 * What a `.bpmn` import left on this element, read defensively.
 *
 * The value came out of a Y.Map and is whatever a peer wrote — an older build,
 * a hand-edited document, a paste from a board that met a different importer —
 * so every member below is checked before it is believed. A payload that is not
 * an object at all is simply not there.
 */
function carriedOf(model: {
  interchange?: Record<string, ForeignInterchange> | undefined;
}): ForeignInterchange | undefined {
  const payload = model.interchange?.[BPMN_FORMAT_ID];
  return payload !== null && typeof payload === 'object' ? payload : undefined;
}

/**
 * Whether a carried attribute NAME can be written back as one.
 *
 * The serializer escapes attribute VALUES and interpolates NAMES, which is the
 * only asymmetry in this file that matters for the shape of the document: a
 * value can say anything and stay inside its quotes, and a name cannot. A
 * "name" of `x="1"><task id="INJECTED" /><y z` closes the element it was on and
 * opens two more, so the damage is not confined to the element carrying the bad
 * payload — it unbalances the whole file.
 *
 * `interchange` is ordinary collaborative Y.Map data: any peer with write
 * access, any hand-edited document, any paste from a board that met a different
 * importer. So a name is written only if it IS a name — an NCName, or the
 * `prefix:local` pair of them that every foreign attribute in a `.bpmn` wears.
 * {@link isNcName} rejects `:` itself, so "one colon" needs no separate check.
 *
 * This also disposes of a degenerate payload shape for free: `attrs: []` puts
 * `Object.entries` on an array, whose keys are `"0"`, `"1"` — not NCNames,
 * because an XML name cannot open on a digit.
 */
function isAttrName(name: string): boolean {
  const colon = name.indexOf(':');
  if (colon < 0) return isNcName(name);
  return isNcName(name.slice(0, colon)) && isNcName(name.slice(colon + 1));
}

/**
 * The `xsd:ID` a carried fragment's ROOT element claims, if it claims one.
 *
 * Read off the opening tag by hand rather than by parsing, because this module
 * has no parser and is not going to grow one (it is a pure function of the
 * board — ADR 0012 P3). That is enough for what it is for: an id is what makes
 * two carried fragments the same fragment, and the root's is the one a second
 * copy would duplicate.
 *
 * The whole scan is quote-aware — `id=` is only recognised OUTSIDE a quoted
 * value, so an attribute whose value contains ` id='X'` (a condition string,
 * an XPath) cannot shadow the element's real id, and a value containing `>`
 * does not truncate the tag. `id` is required to be preceded by whitespace,
 * so `camunda:id` and `bpmnElement` are not mistaken for it.
 */
function carriedRootId(fragment: string): string | undefined {
  let quote: string | undefined;
  let capturing = false;
  let valueStart = 0;
  for (let index = 0; index < fragment.length; index++) {
    const char = fragment[index];
    if (quote !== undefined) {
      if (char !== quote) continue;
      if (capturing) {
        const value = fragment.slice(valueStart, index);
        return value.length > 0 ? value : undefined;
      }
      quote = undefined;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') break;
    if (char === 'i' && /\s/.test(fragment[index - 1] ?? '')) {
      const match = /^id\s*=\s*("|')/.exec(fragment.slice(index));
      if (match) {
        quote = match[1];
        capturing = true;
        valueStart = index + match[0].length;
        index += match[0].length - 1;
      }
    }
  }
  return undefined;
}

/**
 * The carried half of one export: what has already been written back, and what
 * this writer refused to write.
 *
 * Stateful, and created per call, because both of the invariants it holds are
 * DOCUMENT-wide and neither is checkable from one element:
 *
 * - **an `xsd:ID` is unique across the file.** `interchange` is declared on the
 *   base element model precisely so a payload survives a paste (PR #73), so a
 *   pool imported from a `.bpmn` and then copy-pasted holds its carried
 *   boundary event, its lane's `documentation` and the document's residue
 *   TWICE. Written twice, they are duplicate ids, and a duplicate `xsd:ID` is
 *   the one thing no BPMN tool survives. First claim wins — it is the one
 *   already written and already referenced — and a SECOND, DIFFERENT fragment
 *   claiming the same id is a conflict the export reports rather than resolves;
 * - **an attribute name is a name.** See {@link isAttrName}.
 *
 * The order in which the caller asks decides who wins, so the caller is the
 * document's own emission order, which is deterministic in the board.
 */
class Carried {
  /** The fragment already written for each id a carried root claimed. */
  readonly #byId = new Map<string, string>();
  /** Id-less DOCUMENT-scope fragments, of which two pools carry ONE. */
  readonly #shared = new Set<string>();
  /** Ids claimed a second time by a DIFFERENT fragment. */
  readonly conflictingIds: string[] = [];
  /** Attribute names refused because they are not names. */
  readonly refusedNames: string[] = [];

  /**
   * The carried attributes of one or more scopes, merged left to right.
   *
   * Merged rather than concatenated because an attribute is a NAME on an
   * element and there is only one of each: a later scope wins, which is what
   * lets the caller order the scopes by how specific they are.
   *
   * NEITHER half of a carried attribute is trusted as markup. The value is
   * re-escaped by the serializer like any other; the name is checked against
   * {@link isAttrName}, because the serializer interpolates it and a name is
   * the half that can escape its own element.
   */
  attrs(
    payload: ForeignInterchange | undefined,
    ...scopes: readonly string[]
  ): Attrs {
    const out: Attrs = {};
    for (const scope of scopes) {
      const bag = payload?.attrs?.[scope];
      if (bag === null || typeof bag !== 'object') continue;
      for (const [name, value] of Object.entries(bag)) {
        if (typeof value !== 'string') continue;
        // `__proto__` is a valid NCName and still not a key this writer will
        // carry into an object it builds — the prototype-pollution exclusion
        // PR #73 draws round its own verbatim write, drawn here too.
        if (name === '__proto__') continue;
        if (!isAttrName(name)) {
          this.refusedNames.push(name);
          continue;
        }
        out[name] = value;
      }
    }
    return out;
  }

  /**
   * The fragments of this bag that have not been written back already.
   *
   * @param shared for matter that belongs to the DOCUMENT rather than to the
   * element carrying it — D6's `definitions` and `collaboration` residue, and
   * the plane's carried diagram elements. Two pools holding the same payload
   * hold ONE of those, so an id-less one is deduplicated on its text as well.
   * An id-less fragment at ELEMENT scope is never deduplicated: two tasks may
   * each carry their own `<documentation>`, and two pools each their own
   * `<BPMNLabel />`, and those are two fragments rather than one written twice.
   */
  keep(fragments: readonly XmlNode[], shared = false): XmlNode[] {
    const out: XmlNode[] = [];
    for (const node of fragments) {
      if (!('fragment' in node)) {
        out.push(node);
        continue;
      }
      const id = carriedRootId(node.fragment);
      if (id === undefined) {
        if (shared) {
          if (this.#shared.has(node.fragment)) continue;
          this.#shared.add(node.fragment);
        }
        out.push(node);
        continue;
      }
      const written = this.#byId.get(id);
      if (written !== undefined) {
        // The same characters twice is one thing carried twice — a paste — and
        // writing it once is the whole job. DIFFERENT characters under one id
        // are two things that cannot both be in a file, and that is a sentence
        // the person exporting is entitled to hear.
        if (written !== node.fragment) this.conflictingIds.push(id);
        continue;
      }
      this.#byId.set(id, node.fragment);
      out.push(node);
    }
    return out;
  }
}

/** Whether a stored fragment is a string this writer can put back. */
function isFragment(value: unknown): value is string {
  return typeof value === 'string' && value.trimStart().startsWith('<');
}

/** The carried child fragments of one or more scopes, in the stored order. */
function carriedFragments(
  bag: Record<string, string[]> | undefined,
  ...scopes: readonly string[]
): XmlNode[] {
  const out: XmlNode[] = [];
  for (const scope of scopes) {
    const list = bag?.[scope];
    if (!Array.isArray(list)) continue;
    for (const fragment of list) {
      if (isFragment(fragment)) out.push({ fragment });
    }
  }
  return out;
}

/**
 * Whole diagram elements the file drew for something this board does not: the
 * `BPMNShape` of a carried boundary event, the `BPMNEdge` of its error path, an
 * orphan shape naming an element the file never declared.
 *
 * They are the `di` entries whose scope is an ID rather than a role key —
 * `@shape` means "unmodelled parts of MY OWN diagram element" and is written by
 * the element itself. Keys are sorted so that two documents holding the same
 * payload write the same plane, whatever order a Y.Map happened to hand them
 * back in.
 */
function carriedPlaneDi(payload: ForeignInterchange | undefined): XmlNode[] {
  const bag = payload?.di;
  if (bag === null || typeof bag !== 'object') return [];
  const ids = Object.keys(bag)
    .filter(scope => !scope.startsWith('@'))
    .sort();
  return carriedFragments(bag, ...ids);
}

/* ── Where a carried fragment is XSD-legal ────────────────────────────── */

/**
 * The qualified name a fragment opens on, reduced to its local part.
 *
 * A fragment carries the FILE's prefix (`bpmn2:`, `semantic:`, none at all) and
 * this writer cannot resolve it — the declaration it was written under is on
 * `definitions`, not on the fragment. The local name is what the XSD's own
 * sequences are written in, so it is what the slot tables below read, and a
 * name none of them knows falls to the open slot rather than to a guess.
 */
function localNameOf(fragment: string): string {
  const opened = /^\s*<\s*([^\s/>]+)/.exec(fragment);
  if (!opened) return '';
  const qualified = opened[1];
  const colon = qualified.indexOf(':');
  return colon < 0 ? qualified : qualified.slice(colon + 1);
}

/**
 * `tProcess`, before its `flowElement*` slot.
 *
 * The XSD sequence in full is `documentation* → extensionElements? →
 * supportedInterfaceRef* → ioSpecification? → ioBinding* → auditing? →
 * monitoring? → processRole* → property* → laneSet* → flowElement* →
 * artifact* → resourceRole* → correlationSubscription* → supports*` — the
 * first five inherited from `tBaseElement` and `tCallableElement`, which in an
 * `xsd:extension` come FIRST. A carried `<auditing>` written after the laneSet
 * this exporter emits is a document a validating parser rejects, so the head is
 * a table and not a comment.
 */
const PROCESS_HEAD = new Set([
  'documentation',
  'extensionElements',
  'supportedInterfaceRef',
  'ioSpecification',
  'ioBinding',
  'auditing',
  'monitoring',
  'processRole',
  'property',
  'laneSet',
]);

/** `tProcess` and `tCollaboration` both end their drawable half on this slot. */
const ARTIFACT_LOCALS = new Set(['association', 'group', 'textAnnotation']);

/**
 * `tProcess`, after its `artifact*` slot.
 *
 * `resourceRole` is the abstract head of a substitution group, so the three
 * names a file actually writes are here beside it (Table 10.142).
 *
 * Both spellings of `correlationSub(s)cription` are here because the NORMATIVE
 * schema misspells it: `tProcess` really does declare
 * `correlationSubcription`, without the second `s` (Table 10.136, ISO p. 311).
 * A file written against the published XSD carries the typo and a file written
 * against the prose carries the correction, and both belong in this slot.
 */
const PROCESS_TAIL = new Set([
  'resourceRole',
  'performer',
  'humanPerformer',
  'potentialOwner',
  'correlationSubscription',
  'correlationSubcription',
  'supports',
]);

/** `tCollaboration`, before its `participant*` slot. */
const COLLABORATION_HEAD = new Set([
  'documentation',
  'extensionElements',
  'choreography',
]);

/**
 * Which slot of the element it was a child of a carried fragment goes back in.
 *
 * The scope records the PARENT and not the slot, so placement is derived from
 * the XSD instead — from the very sequences this exporter already writes its
 * own children in. The default is the open slot of the type in question:
 * `flowElement*` for a process, because that is where the whole Analytic
 * vocabulary an import carries lives and it is the only unbounded substitution
 * group `tProcess` has; the tail for a collaboration, which has no flow
 * elements at all and ends on five unbounded conversation slots.
 */
type ProcessSlot = 'head' | 'flowElement' | 'artifact' | 'tail';

function processSlotOf(fragment: string): ProcessSlot {
  const local = localNameOf(fragment);
  if (PROCESS_HEAD.has(local)) return 'head';
  if (ARTIFACT_LOCALS.has(local)) return 'artifact';
  if (PROCESS_TAIL.has(local)) return 'tail';
  return 'flowElement';
}

type CollaborationSlot = 'head' | 'messageFlow' | 'artifact' | 'tail';

function collaborationSlotOf(fragment: string): CollaborationSlot {
  const local = localNameOf(fragment);
  if (COLLABORATION_HEAD.has(local)) return 'head';
  if (local === 'messageFlow') return 'messageFlow';
  if (ARTIFACT_LOCALS.has(local)) return 'artifact';
  return 'tail';
}

/**
 * `tDefinitions` is `import* → extension* → rootElement* → BPMNDiagram* →
 * relationship*`, so a carried root has three possible homes and the diagram
 * sits between two of them. `<import>` never arrives here: D5 quarantines it.
 */
type DefinitionsSlot = 'extension' | 'root' | 'relationship';

function definitionsSlotOf(fragment: string): DefinitionsSlot {
  const local = localNameOf(fragment);
  if (local === 'extension') return 'extension';
  if (local === 'relationship') return 'relationship';
  return 'root';
}

/** Fragments sorted into their slots, keeping the stored order inside each. */
function bySlot<Slot extends string>(
  fragments: readonly XmlNode[],
  slotOf: (fragment: string) => Slot
): Record<Slot, XmlNode[]> {
  const out = {} as Record<Slot, XmlNode[]>;
  for (const node of fragments) {
    if (!('fragment' in node)) continue;
    const slot = slotOf(node.fragment);
    (out[slot] ??= []).push(node);
  }
  return out;
}

/** One slot of a sorted bag, which is empty far more often than not. */
function slot<Slot extends string>(
  bag: Record<Slot, XmlNode[]>,
  name: Slot
): XmlNode[] {
  return bag[name] ?? [];
}

/**
 * Mints document-unique NCNames, and remembers what it minted.
 *
 * Uniqueness is settled by a counting suffix rather than by a hash: `Task_x`
 * and `Task_x_2` are both readable in bpmn.io's properties panel, which is
 * where a human will actually meet them during the recette.
 */
class IdMinter {
  readonly #taken = new Set<string>();

  /** How many ids an import gave us that could not be given back (D3). */
  substituted = 0;

  /**
   * The id the FILE gave this element, when it can still be given back —
   * otherwise a freshly minted one, and the substitution is counted.
   *
   * Two things can make a recorded id unusable, and neither is recoverable by
   * guessing: it may not be an NCName (a hand-edited file, another format's
   * id), or the document being written may already have claimed it. The
   * alternative — inverting {@link toNcName} to reconstruct what we think we
   * sent — is exactly what D3 rejects: `_7abc` has two preimages.
   */
  given(given: string | undefined, prefix: string, raw: string): string {
    if (given !== undefined && isNcName(given) && !this.#taken.has(given)) {
      this.#taken.add(given);
      return given;
    }
    if (given !== undefined) this.substituted++;
    return this.mint(prefix, raw);
  }

  mint(prefix: string, raw: string): string {
    const base = toNcName(prefix ? `${prefix}_${raw}` : raw);
    if (!this.#taken.has(base)) {
      this.#taken.add(base);
      return base;
    }
    let n = 2;
    while (this.#taken.has(`${base}_${n}`)) n++;
    const unique = `${base}_${n}`;
    this.#taken.add(unique);
    return unique;
  }
}

/* ── Input ────────────────────────────────────────────────────────────── */

/**
 * The board to serialize — everything on the surface, split by what it is.
 *
 * The whole board and not a selection: a BPMN document is a process, and half a
 * process is not a smaller process. The pool whose toolbar launched the export
 * decides the FILENAME and nothing else.
 */
export interface BpmnExportBoard {
  /** In document order — which is the tie-break `bpmnPoolOf` breaks on. */
  pools: readonly BpmnPoolElementModel[];
  nodes: readonly BpmnNodeElementModel[];
  connectors: readonly ConnectorElementModel[];
}

export interface BpmnExportOptions {
  /** Names the `collaboration` / lone `process` and the `BPMNDiagram`. */
  name?: string;
}

/**
 * The document, plus what writing it could not say.
 *
 * Three things the board can hold have no honest place in a `.bpmn` file, and
 * until now each of them was documented in a code comment and silent to the
 * person who clicked Export. A warning is one line, in the user's words, and it
 * names the fix rather than the mechanism. Nothing here is an error: the file
 * is valid and the export succeeded — these are the sentences the format
 * refused to carry.
 */
export interface BpmnExportOutcome {
  text: string;
  /** Empty when the board came out whole, which is the usual case. */
  warnings: string[];
}

/* ── The plan ─────────────────────────────────────────────────────────── */

/**
 * Which element an artefact is written INSIDE.
 *
 * A number indexes `processes`; {@link COLLABORATION} is the collaboration
 * itself, which `tCollaboration` allows to carry artifacts directly
 * (`participant* → messageFlow* → artifact*`).
 *
 * The distinction is not cosmetic and the live recette is what found it. A
 * process with no participant cannot be DRAWN on a collaboration plane — there
 * is no shape for it — so bpmn-js imports its contents and then renders
 * nothing at all. An annotation dropped beside the pools used to disappear on
 * import; as a child of the collaboration it is drawn where it was put.
 */
const COLLABORATION = -1;

/** One node, resolved: its ids, its mapping, its box and where it sits. */
interface PlannedNode {
  model: BpmnNodeElementModel;
  mapping: BpmnXmlMapping;
  /** The id the DI shape and every reference point at. */
  id: string;
  /** The backing `dataObject`, for a data object only. */
  dataObjectId?: string;
  /** The `categoryValue` carrying the label, for a labelled group only. */
  categoryValueId?: string;
  categoryId?: string;
  name: string;
  bound: Bound;
  /** A `processes` index, or {@link COLLABORATION}. */
  scope: number;
  lane: BpmnLane | null;
  /** What a `.bpmn` import left on it, and this writer gives back. */
  payload?: ForeignInterchange;
}

interface PlannedEdge {
  model: ConnectorElementModel;
  element: 'sequenceFlow' | 'messageFlow' | 'association';
  id: string;
  name: string;
  source: PlannedNode;
  target: PlannedNode;
  /** A `processes` index, or {@link COLLABORATION}. */
  scope: number;
  waypoints: readonly (readonly [number, number])[];
  payload?: ForeignInterchange;
}

/** One lane, resolved: its minted id and the band it is actually painted as. */
interface PlannedLane {
  lane: BpmnLane;
  id: string;
  /** The band in ABSOLUTE surface coordinates — what DI has to describe. */
  bound: Rect;
}

interface PlannedProcess {
  /** The pool this process belongs to, or `null` for the participant-less one. */
  pool: BpmnPoolElementModel | null;
  id: string;
  participantId?: string;
  name: string;
  /** Absent when the pool carries no lane the primitive actually paints. */
  laneSetId?: string;
  /** Top-to-bottom, and EMPTY for a pool with no lanes. */
  lanes: PlannedLane[];
  payload?: ForeignInterchange;
  /**
   * Whether `@self` describes the PROCESS rather than a participant.
   *
   * True for the pool an import minted for a file that named no participant
   * (D6): that pool IS the process, which is exactly what
   * `interchange.bpmn.element = 'process'` records — so its own attributes and
   * its own children belong on the `process` tag, whether or not the author has
   * since drawn a second pool beside it and turned the board into a
   * collaboration.
   */
  selfIsProcess: boolean;
}

/** The four numbers DI needs. Structural, so a `Bound` satisfies it. */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Each lane of a pool as an ABSOLUTE rectangle, in the order they are painted.
 *
 * Read off `backgroundInstanceZones` rather than off `pool.lanes` directly, for
 * the reason {@link bpmnLaneOf} gives and one more:
 *
 * - the primitive is what NORMALISES the weights into rectangles and DROPS the
 *   rows a user's typo made unusable, so a second reading of the raw prop would
 *   place a `BPMNShape` on a band the pool does not paint;
 * - and it makes the `laneSet` and the DI agree by construction — the lanes
 *   this returns are the lanes written to both, so a dropped row is absent from
 *   the file rather than present as a lane with no shape and no members.
 *
 * ## Where the band starts, and the 30-unit convention
 *
 * The x origin is the PLOT's, which is the pool's frame plus its participant
 * name band (`POOL_BAND_WIDTH`, 28) — literally where the lane is drawn on the
 * canvas. bpmn-js lays its own lanes out 30 units right of the participant, so
 * the two conventions agree to within two units and a file written here reopens
 * looking like a file bpmn.io wrote. Deriving it from the declaration rather
 * than hard-coding the foreign 30 is deliberate: the DI must describe the
 * picture the author is looking at, and if the band width ever changes the
 * export follows it without anybody remembering to.
 */
function poolLaneBands(pool: BpmnPoolElementModel): PlannedLane[] {
  const rows = Array.isArray(pool.lanes) ? pool.lanes : [];
  if (rows.length === 0) return [];

  const frame = pool.elementBound;
  const plot = backgroundPlot(BPMN_POOL_BACKGROUND, frame.w, frame.h);
  if (!(plot.width > 0) || !(plot.height > 0)) return [];

  const zones = backgroundInstanceZones(
    BPMN_POOL_BACKGROUND,
    pool as unknown as Readonly<Record<string, unknown>>
  );

  const bands: PlannedLane[] = [];
  for (const zone of zones) {
    const row = rows.find(lane => zone.id === `${LANE_PREFIX}:${lane.id}`);
    if (!row) continue;
    bands.push({
      lane: row,
      // Minted by the caller, which owns the document-wide id space.
      id: '',
      bound: {
        x: frame.x + plot.x0 + zone.rect.x * plot.width,
        y: frame.y + plot.y0 + zone.rect.y * plot.height,
        w: zone.rect.w * plot.width,
        h: zone.rect.h * plot.height,
      },
    });
  }
  return bands;
}

/** The text an element carries, as a plain trimmed string. */
function labelOf(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Both ends of a connector, when both are attached to something.
 *
 * A dangling endpoint is the one case the spec cannot express at all:
 * `sourceRef` and `targetRef` are REQUIRED on every flow, so an arrow with a
 * free end has nothing to be written as. It is dropped, silently and on
 * purpose — the picture keeps it, the interchange file cannot carry it, and
 * inventing an anchor would be the export asserting a link the author never
 * drew.
 */
function endsOf(
  connector: ConnectorElementModel
): { source: string; target: string } | null {
  const source = connector.source?.id;
  const target = connector.target?.id;
  if (!source || !target) return null;
  return { source, target };
}

/**
 * Where an edge is drawn, in surface coordinates.
 *
 * `absolutePath` is `@local()` — it is computed by the connector manager while
 * the board is on screen — so a document that has been loaded but never
 * rendered has none. When it is there it is the truth (it is the polyline the
 * user is looking at, elbows and all); when it is not, the straight line
 * between the two centres is the honest fallback, and it is what every tool
 * draws for a flow it has no routing for. Two waypoints is also the minimum
 * `di:Edge` accepts.
 */
function waypointsOf(
  connector: ConnectorElementModel,
  source: PlannedNode,
  target: PlannedNode
): readonly (readonly [number, number])[] {
  const path = connector.absolutePath;
  if (Array.isArray(path) && path.length >= 2) {
    return path.map(point => [point[0], point[1]] as const);
  }
  return [
    [source.bound.x + source.bound.w / 2, source.bound.y + source.bound.h / 2],
    [target.bound.x + target.bound.w / 2, target.bound.y + target.bound.h / 2],
  ];
}

/**
 * Which element a flow is written INSIDE.
 *
 * Three rules, one per kind of edge, and the middle one is the whole of what
 * the live recette taught:
 *
 * - a **message flow** is the collaboration's by definition (`tCollaboration`),
 *   and there is no message flow without one — the caller drops it first;
 * - an **association** goes wherever BOTH its ends are, when they agree. When
 *   they do not — an annotation beside the pools tied to a task inside one —
 *   it belongs to neither scope, and the collaboration is the common ancestor
 *   that can legally hold it. Filing it with its source instead would put it in
 *   a process that cannot draw it, or in a pool the other end is not in;
 * - a **sequence flow** is a `flowElement` and can only ever be a process's, so
 *   it is filed with its SOURCE. A flow that crosses two pools is invalid BPMN
 *   and a picture the author nevertheless drew: the file says so, and the
 *   validation rules are what tell them about it. Should its source somehow be
 *   an artifact on the collaboration — an arrow drawn out of an annotation —
 *   it falls back to the participant-less process, because there is nowhere
 *   else in the format for it.
 */
function edgeScope(
  element: 'sequenceFlow' | 'messageFlow' | 'association',
  source: PlannedNode,
  target: PlannedNode,
  ctx: { hasCollaboration: boolean; orphanProcessIndex: () => number }
): number {
  if (element === 'messageFlow') return COLLABORATION;

  if (element === 'association') {
    if (source.scope === target.scope) return source.scope;
    return ctx.hasCollaboration ? COLLABORATION : source.scope;
  }

  return source.scope === COLLABORATION
    ? ctx.orphanProcessIndex()
    : source.scope;
}

/* ── The serializer ───────────────────────────────────────────────────── */

/**
 * Serialize a board as a BPMN 2.0 XML interchange document.
 *
 * ## The shape of the document, and what decides it
 *
 * One `definitions`, always. Then:
 *
 * - **at least one pool** — a `collaboration` holding one `participant` per
 *   pool, one `process` per pool, and the message flows (which are the
 *   collaboration's, never a process's). Things drawn OUTSIDE every pool split
 *   in two: ARTIFACTS (annotation, group, and the associations that tie them to
 *   anything) become children of the collaboration itself, where
 *   `tCollaboration` allows them and where bpmn-js draws them; FLOW OBJECTS get
 *   ONE extra participant-less process, and only if there are any. See
 *   {@link COLLABORATION} for what the live recette found out about the
 *   difference, and the note on the orphan process for what it still cannot fix;
 * - **no pool at all** — a single `process` and no collaboration, which is what
 *   a process drawn without swimlanes IS. The `BPMNPlane` then points at that
 *   process; with a collaboration it must point at the collaboration, or most
 *   tools draw the flow and none of the pools (spec §12.3.2).
 *
 * Attribution is {@link bpmnPoolOf} and {@link bpmnLaneOf} — the CENTRE against
 * the pool's PLOT, containment only, no nearest-pool fallback. Deliberately the
 * same arithmetic the audit and the validation rules read, so a task the audit
 * reports in "Back office" is in the `lane` named "Back office" here.
 */
export function exportBpmnXml(
  board: BpmnExportBoard,
  options: BpmnExportOptions = {}
): string {
  return exportBpmnXmlWithWarnings(board, options).text;
}

/**
 * The same serialization, with the loss channel attached — see
 * {@link BpmnExportOutcome}.
 *
 * {@link exportBpmnXml} is the thin wrapper over it, kept because a caller that
 * only wants the bytes should not have to reach past a report to get them, and
 * because #149's forty-six tests and the live integration spec pin that
 * signature. The interchange capability calls THIS one.
 */
export function exportBpmnXmlWithWarnings(
  board: BpmnExportBoard,
  options: BpmnExportOptions = {}
): BpmnExportOutcome {
  const minter = new IdMinter();
  const pools = board.pools;

  /* ── Processes and participants ──────────────────────────────────── */

  /**
   * Is this board still the poolless one an import minted a pool for?
   *
   * A pool that stands for a bare `process` (`interchange.bpmn.element =
   * 'process'`, ADR 0012 D6) is what tells this writer to give the poolless
   * form back rather than invent a collaboration the author never drew — but
   * ONLY while it is the whole board. Draw a second pool beside it and the
   * author has made a collaboration: from then on it is a participant like any
   * other, because the alternative is a pool they can see and drag that has no
   * shape in the file and is drawn by nothing that opens it.
   */
  const givesBackPoollessForm =
    pools.length === 1 && carriedBpmnElement(pools[0]) === 'process';

  const processes: PlannedProcess[] = pools.map(pool => {
    const wasBareProcess =
      givesBackPoollessForm && carriedBpmnElement(pool) === 'process';
    const given = carriedBpmnId(pool);
    // The pool's OWN element is the participant — it is what a `BPMNShape`
    // points at and what a message flow can reference — so that is the id the
    // file gets to keep. Everything the pool drags along is minted FROM it, so
    // that an export after an import lands on the same ids as the export
    // before it: the process is derived from the participant either way.
    const participantId = wasBareProcess
      ? undefined
      : minter.given(given, 'Participant', pool.id);
    const id = wasBareProcess
      ? minter.given(given, 'Process', pool.id)
      : minter.mint('Process', participantId!);
    // The bands the pool actually PAINTS, not the raw prop — see
    // `poolLaneBands`. A lane's stored id is what the file called it (an import
    // records it verbatim), so it goes in unprefixed: `id` is document-unique
    // across the WHOLE file and the minter is what keeps it so, but a lane that
    // arrived as `Lane_3` must leave as `Lane_3` and not as `Lane_Lane_3`.
    const lanes = poolLaneBands(pool).map(band => ({
      ...band,
      id: minter.mint('', band.lane.id),
    }));
    return {
      pool,
      id,
      participantId,
      name: labelOf(pool.name),
      laneSetId:
        lanes.length > 0
          ? minter.mint('LaneSet', participantId ?? id)
          : undefined,
      lanes,
      payload: carriedOf(pool),
      selfIsProcess: carriedBpmnElement(pool) === 'process',
    };
  });

  const hasCollaboration = processes.some(
    process => process.participantId !== undefined
  );

  /**
   * The participant-less process.
   *
   * Minted on first use where there ARE pools — an empty extra process in a
   * collaboration is a participant a reader will look for on the canvas and not
   * find. Minted eagerly where there are none, because then it is not an extra
   * anything: it is the process, and a `definitions` with no process at all is
   * a document about nothing (a process with zero flow elements is legal, spec
   * `tProcess`; a board that is genuinely empty exports as exactly that).
   *
   * ## What it cannot fix, stated rather than hidden
   *
   * Inside a collaboration this process has no `participant`, so the plane has
   * no shape to draw it in and bpmn-js imports its flow objects without
   * rendering them. That is a real limit and it is deliberate: the alternatives
   * are to invent a pool the author never drew, or to drop the elements
   * outright, and both of them are the export saying something the board does
   * not. The elements are in the file, correctly, for any tool that reads the
   * model; the fix on the canvas is to draw them in a pool.
   *
   * Artifacts do NOT come here when there is a collaboration — they have a
   * legal home on the collaboration itself, and they are drawn.
   */
  // …unless one is already there: a pool an import minted for a bare `process`
  // IS the participant-less process, and minting a second one beside it would
  // write a `definitions` with two processes where the file had one.
  let orphanProcess = processes.findIndex(
    process => process.pool !== null && process.participantId === undefined
  );
  const orphanProcessIndex = () => {
    if (orphanProcess < 0) {
      orphanProcess = processes.length;
      processes.push({
        pool: null,
        id: minter.mint('Process', hasCollaboration ? 'unassigned' : 'board'),
        name: '',
        lanes: [],
        selfIsProcess: false,
      });
    }
    return orphanProcess;
  };
  if (!hasCollaboration) orphanProcessIndex();

  /* ── Nodes ───────────────────────────────────────────────────────── */

  const planned: PlannedNode[] = [];
  const byModelId = new Map<string, PlannedNode>();

  for (const model of board.nodes) {
    const mapping = BPMN_XML_OF_KIND[model.kind];
    // A kind the pack does not know: impossible by the type, and a document
    // written by a newer build could still carry one. Silence beats a crash.
    if (!mapping) continue;

    const bound = model.elementBound;
    const pool = bpmnPoolOf(pools, bound);
    // In a pool: that pool's process. Outside every pool: an ARTIFACT goes on
    // the collaboration, where it is both legal and drawable; anything else
    // goes to the participant-less process, which on a poolless board is
    // simply THE process.
    const scope =
      pool !== null
        ? processes.findIndex(entry => entry.pool === pool)
        : hasCollaboration && mapping.slot === 'artifact'
          ? COLLABORATION
          : orphanProcessIndex();

    const name = labelOf(model.text);
    const node: PlannedNode = {
      model,
      mapping,
      id: minter.given(carriedBpmnId(model), '', model.id),
      name,
      bound,
      scope,
      lane: pool ? bpmnLaneOf(pool, bound) : null,
      payload: carriedOf(model),
    };

    // A data object needs the `dataObject` its reference points at, and a
    // labelled group needs somewhere for its label to live. Both are minted
    // from the id this artefact SETTLED on rather than from its surface id, so
    // that an artefact whose id came out of a file drags the same satellites
    // whichever export writes it — see {@link IdMinter.given}.
    if (model.kind === 'dataObject') {
      node.dataObjectId = minter.mint('DataObject', node.id);
    }
    if (model.kind === 'group' && name) {
      node.categoryId = minter.mint('Category', node.id);
      node.categoryValueId = minter.mint('CategoryValue', node.id);
    }

    planned.push(node);
    byModelId.set(model.id, node);
  }

  /* ── Edges ───────────────────────────────────────────────────────── */

  const edges: PlannedEdge[] = [];

  /** Typed arrows the format had no way to write down. See below for each. */
  let unwritableEdges = 0;
  /** Message flows dropped for want of a collaboration. */
  let droppedMessageFlows = 0;

  for (const connector of board.connectors) {
    const element = EDGE_ELEMENT[String(connector.role ?? '')];
    // A NEUTRAL connector states nothing (`docs/adr/0010`): not a flow. NOT
    // counted as a loss — there was nothing to lose, which is the whole point
    // of the neutral state.
    if (!element) continue;

    const ends = endsOf(connector);
    // A free end. `sourceRef` and `targetRef` are required on every flow, so
    // there is no such thing as half an arrow in this format.
    if (!ends) {
      unwritableEdges++;
      continue;
    }

    const source = byModelId.get(ends.source);
    const target = byModelId.get(ends.target);
    // An end attached to something that is not a BPMN artefact — a sticky note,
    // a plain rectangle — has no id in this document to point at.
    if (!source || !target) {
      unwritableEdges++;
      continue;
    }

    // A message flow belongs to the collaboration, and there is no
    // collaboration without a pool. On a poolless board it has nowhere in the
    // interchange format to go, so it is dropped rather than demoted to a
    // sequence flow, which would say something else entirely.
    if (element === 'messageFlow' && !hasCollaboration) {
      droppedMessageFlows++;
      continue;
    }

    edges.push({
      model: connector,
      element,
      id: minter.given(carriedBpmnId(connector), 'Flow', connector.id),
      name: labelOf(connector.text),
      source,
      target,
      scope: edgeScope(element, source, target, {
        hasCollaboration,
        orphanProcessIndex,
      }),
      waypoints: waypointsOf(connector, source, target),
      payload: carriedOf(connector),
    });
  }

  /* ── The plane origin ────────────────────────────────────────────── */

  // Spec §12.3: DI coordinates are relative to the plane's origin, and "the
  // union of all the nested elements' bounds is deemed to be located at the
  // plane's origin point" — which a canvas that lets a user drag left of zero
  // routinely violates. Everything is translated so the top-left of the whole
  // drawing sits at (0, 0); the shape of the picture is untouched, and a tool
  // that clamps at zero no longer folds half the process onto its own edge.
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  const observe = (x: number, y: number) => {
    if (Number.isFinite(x) && x < minX) minX = x;
    if (Number.isFinite(y) && y < minY) minY = y;
  };
  for (const process of processes) {
    if (!process.pool) continue;
    const bound = process.pool.elementBound;
    observe(bound.x, bound.y);
  }
  for (const node of planned) observe(node.bound.x, node.bound.y);
  for (const edge of edges) {
    for (const [x, y] of edge.waypoints) observe(x, y);
  }
  const dx = Number.isFinite(minX) ? -minX : 0;
  const dy = Number.isFinite(minY) ? -minY : 0;

  /* ── What the file gave us back ──────────────────────────────────── */

  /**
   * The carried half of this export: what has been written back already, and
   * what was refused. See {@link Carried} for the two invariants it holds.
   *
   * One per call, consulted by every re-emission site in the order the document
   * is built — which is why it is created here and threaded down rather than
   * applied at each site independently: a pool duplicated by a copy-paste puts
   * the SAME carried element in two different processes, and no site can see
   * that on its own.
   */
  const carried = new Carried();

  /**
   * The document's own residue, gathered from every pool rather than from one.
   *
   * D6 has an import file `definitions`- and `collaboration`-scope matter on
   * the FIRST pool, but "first" is the reader's document order and this writer
   * is handed the board's — and a pool can be copy-pasted, deleted, or drawn
   * before the imported one. So every pool is asked, and {@link Carried.keep}
   * is what keeps a duplicated payload from writing the file's roots twice.
   */
  const poolPayloads = processes
    .filter(process => process.pool !== null)
    .map(process => process.payload);

  /**
   * One document-scope bag of attributes, merged across the pools that carry
   * it, and the conflicts that merge resolved.
   *
   * Computed ONCE per scope rather than on each read, because the merge is
   * last-wins and a silent last-wins across two pools imported from two
   * different files is one of them being rebound with nobody told. Last-wins
   * stays — there is one attribute of each name on `definitions` and something
   * has to be written — and the disagreement goes in the report.
   */
  const documentAttrsOf = (scope: string) => {
    const value: Attrs = {};
    const disagreed: string[] = [];
    for (const payload of poolPayloads) {
      for (const [name, carriedValue] of Object.entries(
        carried.attrs(payload, scope)
      )) {
        const seen = value[name];
        if (seen !== undefined && seen !== carriedValue) disagreed.push(name);
        value[name] = carriedValue;
      }
    }
    return { value, disagreed };
  };

  const definitionsAttrs = documentAttrsOf(BPMN_SCOPE.definitions);
  const collaborationAttrs = documentAttrsOf(BPMN_SCOPE.collaboration);
  const disagreeingDeclarations = [
    ...new Set([
      ...definitionsAttrs.disagreed,
      ...collaborationAttrs.disagreed,
    ]),
  ];

  /**
   * A carried declaration that would contradict one this writer makes.
   *
   * The reader carries a namespace declaration whenever the (prefix, URI) pair
   * is not one `export.ts` writes for itself — which correctly keeps
   * `xmlns:bpmn2`, and which also keeps a file that binds one of THIS
   * library's four prefixes to something else (`xmlns:dc` as Dublin Core, say).
   * Writing that back would rebind the prefix every `dc:Bounds` in this
   * document is written under, so it is refused: the declaration stays in the
   * document, out of the file, and the person exporting is told — including
   * what it means for the fragments that were written under it.
   */
  const contradictingDeclarations = Object.keys(definitionsAttrs.value).filter(
    name => name in BPMN_OWN_DECLARATIONS
  );

  const documentChildren = (scope: string): XmlNode[] =>
    carried.keep(
      poolPayloads.flatMap(payload =>
        carriedFragments(payload?.children, scope)
      ),
      true
    );

  /* ── The semantic half ───────────────────────────────────────────── */

  const roots: XmlNode[] = [];

  // Categories first: a `group` points at a `categoryValue`, and a root element
  // declared after the thing that references it reads badly even though QName
  // resolution does not care.
  for (const node of planned) {
    if (!node.categoryId || !node.categoryValueId) continue;
    roots.push(
      el('bpmn:category', { id: node.categoryId }, [
        el('bpmn:categoryValue', {
          id: node.categoryValueId,
          value: node.name,
        }),
      ])
    );
  }

  const collaborationId = hasCollaboration
    ? minter.mint('Collaboration', 'board')
    : undefined;

  if (collaborationId) {
    const children: XmlNode[] = [];
    // What an import carried off the collaboration, sorted into the slots
    // `tCollaboration` allows each of them in: `documentation* →
    // extensionElements? → choreography* → participant* → messageFlow* →
    // artifact* → conversationNode* → …`. The scope says which ELEMENT a
    // fragment came out of; the XSD is what says where in it.
    const shared = bySlot(
      documentChildren(BPMN_SCOPE.collaboration),
      collaborationSlotOf
    );
    children.push(...slot(shared, 'head'));
    // `participant*` strictly before `messageFlow*` (tCollaboration's sequence).
    for (const process of processes) {
      if (!process.participantId) continue;
      children.push(
        el(
          'bpmn:participant',
          {
            id: process.participantId,
            name: process.name || undefined,
            processRef: process.id,
            // The participant's own foreign attributes — unless this pool
            // stands for a bare `process`, whose `@self` belongs on the process
            // tag and is applied there instead.
            ...(process.selfIsProcess
              ? {}
              : carried.attrs(process.payload, BPMN_SCOPE.self)),
          },
          process.selfIsProcess
            ? []
            : carried.keep(
                carriedFragments(process.payload?.children, BPMN_SCOPE.self)
              )
        )
      );
    }
    for (const edge of edges) {
      if (edge.element !== 'messageFlow') continue;
      children.push(semanticEdge(edge, carried));
    }
    children.push(...slot(shared, 'messageFlow'));
    // `artifact*` last, and only what fell outside every pool: an annotation
    // drawn ON a pool is that process's, and belongs with the work it is about.
    children.push(...artifacts(COLLABORATION, planned, edges, carried));
    children.push(...slot(shared, 'artifact'));
    children.push(...slot(shared, 'tail'));
    roots.push(
      el(
        'bpmn:collaboration',
        {
          id: collaborationId,
          name: options.name || undefined,
          ...collaborationAttrs.value,
        },
        children
      )
    );
  }

  for (const [index, process] of processes.entries()) {
    roots.push(
      el(
        'bpmn:process',
        {
          id: process.id,
          // The lone process of a poolless board is the whole document, so it
          // takes the board's name; a pooled one is named by its participant.
          name: collaborationId ? undefined : options.name || undefined,
          isExecutable: 'false',
          // The process's own foreign attributes, and — for the pool an import
          // minted for a bare `process` — its `@self` ones too, because that
          // pool IS the process. Applied LAST on purpose: `isExecutable` is
          // carried by the reader precisely when the file said something other
          // than the `false` written just above, and giving it back is the
          // model downgrade this half of the round trip repairs.
          ...(process.selfIsProcess
            ? carried.attrs(
                process.payload,
                BPMN_SCOPE.self,
                BPMN_SCOPE.process
              )
            : carried.attrs(process.payload, BPMN_SCOPE.process)),
        },
        processChildren(index, process, planned, edges, carried)
      )
    );
  }

  /* ── The DI half ─────────────────────────────────────────────────── */

  const planeElements: XmlNode[] = [];

  for (const process of processes) {
    if (!process.pool) continue;
    const bound = process.pool.elementBound;
    // A pool that stands for a bare `process` has no participant, and a
    // participant is the only thing a plane can draw a pool AS — so it gets no
    // shape of its own. Its lanes still do: they are `DiagramElement`s like any
    // other, and a laneSet nothing draws is the gap the recette found.
    if (process.participantId) {
      planeElements.push(
        el(
          'bpmndi:BPMNShape',
          {
            id: minter.mint('Shape', process.participantId),
            bpmnElement: process.participantId,
            // `isHorizontal` is meaningful on pools and lanes ONLY (§12.3.2), and
            // a pool here always runs left to right: the plot is cut into
            // horizontal bands, which is what a horizontal pool means.
            isHorizontal: 'true',
            ...carried.attrs(process.payload, BPMN_SCOPE.shape),
          },
          // `tBPMNShape` is `Bounds → BPMNLabel?`, so anything carried off this
          // shape — a label, a vendor's own DI child — goes after the bounds.
          [
            el('dc:Bounds', boundsAttrs(bound, dx, dy)),
            ...carried.keep(
              carriedFragments(process.payload?.di, BPMN_SCOPE.shape)
            ),
          ]
        )
      );
    }

    // …and one shape per LANE, immediately after its own pool.
    //
    // A `laneSet` with no DI is the gap the live recette found: bpmn.io read
    // the lanes, listed their members, and drew a pool with no subdivisions at
    // all, because a lane is a DiagramElement like any other and a tool draws
    // what the plane describes. `isHorizontal` says which way the band runs and
    // is meaningful on exactly two things — a pool and a lane (§12.3.2).
    for (const lane of process.lanes) {
      planeElements.push(
        el(
          'bpmndi:BPMNShape',
          {
            id: minter.mint('Shape', lane.id),
            bpmnElement: lane.id,
            isHorizontal: 'true',
          },
          [el('dc:Bounds', boundsAttrs(lane.bound, dx, dy))]
        )
      );
    }
  }

  for (const node of planned) {
    const attrs: Attrs = {
      id: minter.mint('Shape', node.id),
      bpmnElement: node.id,
    };
    // The pack draws the COLLAPSED sub-process only — a task-sized box with a
    // `+` — and `isExpanded="false"` is how DI says exactly that. Without it a
    // tool is free to draw an expanded container the author never made.
    if (
      node.model.kind === 'subProcess' ||
      node.model.kind === 'callActivity'
    ) {
      attrs.isExpanded = 'false';
    }
    // Meaningful on the exclusive gateway alone (§12.3.2): it is what makes the
    // X appear rather than an empty diamond.
    if (node.model.kind === 'gatewayExclusive') {
      attrs.isMarkerVisible = 'true';
    }
    Object.assign(attrs, carried.attrs(node.payload, BPMN_SCOPE.shape));
    planeElements.push(
      el('bpmndi:BPMNShape', attrs, [
        el('dc:Bounds', boundsAttrs(node.bound, dx, dy)),
        ...carried.keep(carriedFragments(node.payload?.di, BPMN_SCOPE.shape)),
      ])
    );
  }

  for (const edge of edges) {
    planeElements.push(
      el(
        'bpmndi:BPMNEdge',
        {
          id: minter.mint('Edge', edge.id),
          bpmnElement: edge.id,
          ...carried.attrs(edge.payload, BPMN_SCOPE.shape),
        },
        // `tBPMNEdge` is `waypoint+ → BPMNLabel?`: the routing first, whatever
        // was carried off the edge after it.
        [
          ...edge.waypoints.map(([x, y]) =>
            el('di:waypoint', { x: num(x + dx), y: num(y + dy) })
          ),
          ...carried.keep(carriedFragments(edge.payload?.di, BPMN_SCOPE.shape)),
        ]
      )
    );
  }

  /**
   * The diagram elements of everything this board does not draw.
   *
   * A carried boundary event has a `BPMNShape`, its error path has a
   * `BPMNEdge`, and an orphan shape naming an element the file never declared
   * has neither an element nor a home — all three were kept under the ID they
   * name (D2), and all three go back on the plane, whole, after everything
   * Labre drew. Last rather than interleaved because a `BPMNPlane` holds an
   * unordered `DiagramElement*` and because it keeps the shapes this exporter
   * mints in exactly the order the reader indexes them in: the fixed point
   * depends on that order and not on this one.
   *
   * ## They keep the FILE's coordinates, and the plane may have moved
   *
   * The one place where "verbatim" and "in the right place" are not the same
   * sentence. A carried fragment is given back character for character — that
   * is what makes the payload a fixed point, and rewriting the numbers inside
   * one would mean the second import stored something the first never saw — so
   * a carried shape keeps the `dc:Bounds` the source file wrote, while
   * everything Labre draws is translated to the plane origin (§12.3). Where the
   * two differ, the carried shape lands `(dx, dy)` away from where it belongs.
   * It is in the loss table and the warning below says so out loud; it is not
   * silent, and nothing is lost — only displaced.
   */
  const carriedPlane = carried.keep(
    [
      ...processes.flatMap(process => carriedPlaneDi(process.payload)),
      ...planned.flatMap(node => carriedPlaneDi(node.payload)),
      ...edges.flatMap(edge => carriedPlaneDi(edge.payload)),
    ],
    true
  );
  planeElements.push(...carriedPlane);

  const diagram = el(
    'bpmndi:BPMNDiagram',
    { id: minter.mint('Diagram', 'board'), name: options.name || undefined },
    [
      el(
        'bpmndi:BPMNPlane',
        {
          id: minter.mint('Plane', 'board'),
          // The collaboration when there is one — a plane pointing at a process
          // draws the flow and none of the pools.
          bpmnElement: collaborationId ?? processes[0]?.id,
        },
        planeElements
      ),
    ]
  );

  // `tDefinitions` is `import* → extension* → rootElement* → BPMNDiagram* →
  // relationship*`. An `<import>` never arrives here — D5 quarantines it — so
  // the carried residue splits three ways round the diagram.
  const document = bySlot(
    documentChildren(BPMN_SCOPE.definitions),
    definitionsSlotOf
  );

  const definitions = el(
    'bpmn:definitions',
    {
      'xmlns:bpmn': BPMN_NS.model,
      'xmlns:bpmndi': BPMN_NS.bpmndi,
      'xmlns:di': BPMN_NS.di,
      'xmlns:dc': BPMN_NS.dc,
      id: minter.mint('Definitions', 'board'),
      targetNamespace: TARGET_NAMESPACE,
      exporter: EXPORTER,
      // The file's OTHER namespace declarations, and its foreign attributes.
      // A carried `camunda:property` fragment is meaningless without the
      // `xmlns:camunda` it was written under, and a carried
      // `bpmn2:boundaryEvent` is just as meaningless without `xmlns:bpmn2` —
      // same namespace as the `xmlns:bpmn` above, different prefix, and a
      // fragment stored verbatim needs the prefix it was stored under.
      ...Object.fromEntries(
        Object.entries(definitionsAttrs.value).filter(
          ([name]) => !(name in BPMN_OWN_DECLARATIONS)
        )
      ),
    },
    // `rootElement*` strictly before `BPMNDiagram*` (tDefinitions' sequence),
    // and the carried roots before the ones minted here for the same reason
    // `category` comes first: a root that is referenced reads better declared
    // before the thing referencing it, and QName resolution does not care.
    [
      ...slot(document, 'extension'),
      ...slot(document, 'root'),
      ...roots,
      diagram,
      ...slot(document, 'relationship'),
    ]
  );

  /* ── What the format refused to carry ────────────────────────────── */

  const warnings: string[] = [];

  // Flow objects drawn beside the pools. They are in the file and correct for
  // any tool that reads the MODEL, and a collaboration plane has no shape to
  // draw a participant-less process in, so bpmn-js imports them and renders
  // nothing. Found by the live recette; silent to the user until now.
  //
  // `orphanProcess >= 0` is load-bearing and not defensive: unminted it is
  // `-1`, which is exactly {@link COLLABORATION}, and the artifacts filed there
  // are the ones that ARE drawn.
  const undrawn =
    hasCollaboration && orphanProcess >= 0
      ? planned.filter(node => node.scope === orphanProcess).length
      : 0;
  if (undrawn > 0) {
    warnings.push(
      `${undrawn} ${undrawn === 1 ? 'artefact is' : 'artefacts are'} drawn ` +
        `outside every pool. ${undrawn === 1 ? 'It is' : 'They are'} in the ` +
        `file, but most BPMN tools will not draw ${undrawn === 1 ? 'it' : 'them'}: ` +
        `only a pool has a shape to hold ${undrawn === 1 ? 'it' : 'them'}. ` +
        `Draw ${undrawn === 1 ? 'it' : 'them'} inside a pool to make ` +
        `${undrawn === 1 ? 'it' : 'them'} visible.`
    );
  }

  if (droppedMessageFlows > 0) {
    warnings.push(
      `${droppedMessageFlows} message ${droppedMessageFlows === 1 ? 'flow was' : 'flows were'} ` +
        `left out: a message flow runs between participants, and this board ` +
        `has no pool. Draw the pools it runs between, or say "is followed by" ` +
        `instead.`
    );
  }

  // An id a file gave us that we could not give back (ADR 0012 D3). It happens
  // when two elements carry the same recorded id — a merged document, an
  // import run twice — or when what was recorded is not a valid NCName. The
  // file is correct either way; what the author loses is the continuity of one
  // name between the document they imported and the one they are exporting.
  if (minter.substituted > 0) {
    warnings.push(
      `${minter.substituted} ${minter.substituted === 1 ? 'element' : 'elements'} ` +
        `imported from a BPMN file could not keep ` +
        `${minter.substituted === 1 ? 'its' : 'their'} original id: ` +
        `${minter.substituted === 1 ? 'it was' : 'they were'} already taken in ` +
        `this file. A new id was written instead; nothing else changed.`
    );
  }

  // A carried diagram element keeps the source file's own coordinates, and the
  // rest of the drawing has just been translated to the plane origin (§12.3).
  // The two agree only while the translation is a no-op — which it is for a
  // board exported straight back out of the import that made it, and is not
  // once anything has been dragged. Nothing is lost; something is displaced,
  // and the person who clicked Export is the one entitled to hear about it.
  if (carriedPlane.length > 0 && (dx !== 0 || dy !== 0)) {
    const count = carriedPlane.length;
    warnings.push(
      `${count} ${count === 1 ? 'shape' : 'shapes'} imported from a BPMN file ` +
        `${count === 1 ? 'is' : 'are'} kept exactly as the file drew ` +
        `${count === 1 ? 'it' : 'them'}, and the rest of this drawing has ` +
        `moved since. ${count === 1 ? 'It' : 'They'} will open beside the ` +
        `process rather than inside it. Nothing was lost: ` +
        `${count === 1 ? 'it is' : 'they are'} in the file, at the position ` +
        `the original gave ${count === 1 ? 'it' : 'them'}.`
    );
  }

  if (contradictingDeclarations.length > 0) {
    const one = contradictingDeclarations.length === 1;
    warnings.push(
      `This board came from a BPMN file that used ` +
        `${contradictingDeclarations.join(' and ')} for something other than ` +
        `what BPMN means by ${one ? 'it' : 'them'}. ` +
        `Labre writes its own, so the file's ` +
        `${one ? 'declaration was' : 'declarations were'} ` +
        `left out rather than allowed to redefine the diagram's own namespaces. ` +
        `${one ? 'It is' : 'They are'} still in the document. ` +
        // The half a reader would otherwise have to work out: the DECLARATION
        // is what was dropped, and the matter written under it was not — so it
        // is now read under Labre's binding of the same prefix, which means
        // something else. That is the larger of the two changes and it was the
        // silent one.
        `Anything the file wrote under ` +
        `${one ? 'that prefix' : 'those prefixes'} is still in the export and ` +
        `will now be read under Labre's meaning of ` +
        `${one ? 'it' : 'them'}, which is not the meaning the original had.`
    );
  }

  // Two pools, two source files, one prefix bound two ways. Last one wins —
  // there is one attribute of each name on `definitions` and something has to
  // be written — but a rebinding nobody was told about is how a fragment comes
  // to mean something else with no trace of when.
  if (disagreeingDeclarations.length > 0) {
    warnings.push(
      `Two pools on this board disagree about ` +
        `${disagreeingDeclarations.join(' and ')}: they came from BPMN files ` +
        `that gave the same name two different values. The last was written ` +
        `and the other left out, so matter carried from the first file is now ` +
        `read under the second's meaning. Both are still in the document.`
    );
  }

  // A carried element claiming an id another has already written back. The
  // duplicate-by-paste case is silent on purpose — one thing carried twice is
  // written once and nothing is lost — so this fires only for two DIFFERENT
  // fragments claiming one id, which is a file that cannot hold both.
  const conflicting = [...new Set(carried.conflictingIds)];
  if (conflicting.length > 0) {
    const one = conflicting.length === 1;
    warnings.push(
      `${conflicting.length} ${one ? 'element' : 'elements'} imported from a ` +
        `BPMN file could not be written back: ` +
        `${conflicting.map(id => `"${id}"`).join(', ')} ` +
        `${one ? 'names an id' : 'name ids'} another imported element had ` +
        `already claimed, and a BPMN id must be unique across a document. The ` +
        `first was kept. ${one ? 'The other is' : 'The others are'} still in ` +
        `the document; ${one ? 'it is' : 'they are'} not in this file.`
    );
  }

  // An attribute NAME that is not a name. It cannot be written without
  // unbalancing the document — the serializer interpolates a name and escapes
  // only a value — so it is dropped rather than allowed to corrupt the file.
  const refusedNames = [...new Set(carried.refusedNames)];
  if (refusedNames.length > 0) {
    const one = refusedNames.length === 1;
    warnings.push(
      `${refusedNames.length} carried ${one ? 'attribute' : 'attributes'} ` +
        `could not be written back, because ` +
        `${one ? 'its name is not' : 'their names are not'} a valid XML name. ` +
        `${one ? 'It is' : 'They are'} still in the document. This is a sign ` +
        `the payload was edited by something other than a BPMN import.`
    );
  }

  if (unwritableEdges > 0) {
    warnings.push(
      `${unwritableEdges} ${unwritableEdges === 1 ? 'arrow was' : 'arrows were'} ` +
        `left out: BPMN requires both ends of a flow to be named, and ` +
        `${unwritableEdges === 1 ? 'this one has' : 'these have'} an end that ` +
        `is loose or attached to something that is not a BPMN artefact.`
    );
  }

  return {
    text: `<?xml version="1.0" encoding="UTF-8"?>\n${serializeElement(definitions, '')}\n`,
    warnings,
  };
}

function boundsAttrs(bound: Rect, dx: number, dy: number): Attrs {
  return {
    x: num(bound.x + dx),
    y: num(bound.y + dy),
    width: num(bound.w),
    height: num(bound.h),
  };
}

/**
 * One process's children, in the order `tProcess` requires them:
 * `laneSet* → flowElement* → artifact*`.
 *
 * The two halves of "flow element" are kept apart in the loop below only
 * because a LANE may reference the first and not the second: `flowNodeRef` is
 * an IDREF to a flow NODE, and a `dataObjectReference` is a flow element that
 * is not a flow node. They serialize into the same slot all the same.
 */
function processChildren(
  index: number,
  process: PlannedProcess,
  planned: readonly PlannedNode[],
  edges: readonly PlannedEdge[],
  carried: Carried
): XmlNode[] {
  const mine = planned.filter(node => node.scope === index);
  const children: XmlNode[] = [];

  /**
   * What an import carried out of this process, back in its own slot.
   *
   * The scope records which ELEMENT a fragment was a child of and not which
   * slot of it, so placement is the writer's problem — see
   * {@link processSlotOf}, which derives it from the same `tProcess` sequence
   * the three blocks below are already written in. `@self` joins `@process`
   * for the pool an import minted for a bare `process`, because that pool is
   * the process (D6).
   */
  const mySlots = bySlot(
    carried.keep(
      process.selfIsProcess
        ? carriedFragments(
            process.payload?.children,
            BPMN_SCOPE.self,
            BPMN_SCOPE.process
          )
        : carriedFragments(process.payload?.children, BPMN_SCOPE.process)
    ),
    processSlotOf
  );

  // `documentation`, `extensionElements`, `auditing`, `property`… — everything
  // `tProcess` puts BEFORE its lane sets, which is where the sequence starts.
  children.push(...slot(mySlots, 'head'));

  /**
   * `laneSet` — FLAT, and only when the pool actually PAINTS lanes.
   *
   * The rows come from `poolLaneBands`, so the lanes written here are exactly
   * the lanes the plane draws a `BPMNShape` for: a row a typo made unusable is
   * absent from both rather than present in one as a lane with no shape and no
   * members.
   *
   * No `childLaneSet` is ever written, because the pack draws no nested lane:
   * a pool's `lanes` prop is one list of bands over one plot, and there is no
   * gesture that puts a lane inside a lane. The element exists in the format
   * and is deliberately unused; the day nested lanes ship, this is where they
   * land.
   */
  if (process.laneSetId && process.lanes.length > 0) {
    children.push(
      el(
        'bpmn:laneSet',
        {
          id: process.laneSetId,
          ...carried.attrs(process.payload, BPMN_SCOPE.laneSet),
        },
        [
          // `tLaneSet` is `documentation* → extensionElements? → lane*`.
          ...carried.keep(
            carriedFragments(process.payload?.children, BPMN_SCOPE.laneSet)
          ),
          ...process.lanes.map(band =>
            el(
              'bpmn:lane',
              {
                id: band.id,
                name: band.lane.name || undefined,
                // A lane's SCOPE is the id the file called it, which is what
                // the pool stores on the band — never the id minted just above,
                // which a collision could have moved.
                ...carried.attrs(process.payload, band.lane.id),
              },
              [
                // `tLane` is `documentation* → extensionElements? →
                // partitionElement? → flowNodeRef* → childLaneSet?`, so what
                // was carried off the lane goes before the references. The
                // `childLaneSet` never arrives: D5 case 3 quarantines it.
                ...carried.keep(
                  carriedFragments(process.payload?.children, band.lane.id)
                ),
                ...mine
                  .filter(
                    node =>
                      node.mapping.slot === 'flowNode' &&
                      node.lane?.id === band.lane.id
                  )
                  // `flowNodeRef` is an ELEMENT whose text is the IDREF, never
                  // an attribute — the one place in the format where a
                  // reference is spelled that way.
                  .map(node => textEl('bpmn:flowNodeRef', node.id)),
              ]
            )
          ),
        ]
      )
    );
  }

  /* flowElement* — the flow nodes, the data references, the sequence flows. */
  for (const node of mine) {
    if (node.mapping.slot === 'artifact') continue;
    children.push(semanticNode(node, carried));
    // The `dataObject` a `dataObjectReference` points at: a flow element of
    // this same process, written beside the reference. The spec splits the two
    // on purpose — the OBJECT carries the item definition, the REFERENCE
    // carries the state and is what DI draws — and a reference whose
    // `dataObjectRef` resolves to nothing is the one thing bpmn.io's linter
    // complains about on an otherwise clean file.
    if (node.dataObjectId) {
      children.push(
        el('bpmn:dataObject', {
          id: node.dataObjectId,
          name: node.name || undefined,
        })
      );
    }
  }
  for (const edge of edges) {
    if (edge.scope !== index || edge.element !== 'sequenceFlow') continue;
    children.push(semanticEdge(edge, carried));
  }
  // Carried flow elements — the Analytic vocabulary, the flows onto it — in the
  // same slot as the ones above, because that is the slot they came out of.
  children.push(...slot(mySlots, 'flowElement'));

  /* artifact* — annotations, groups, associations. Last, per the XSD. */
  children.push(...artifacts(index, planned, edges, carried));
  children.push(...slot(mySlots, 'artifact'));
  /* …and `resourceRole*` and its neighbours, which follow the artifacts. */
  children.push(...slot(mySlots, 'tail'));

  return children;
}

/**
 * The `artifact*` tail of one scope — a process, or the collaboration.
 *
 * Shared between the two because `tProcess` and `tCollaboration` both end on
 * the same `artifact*` slot with the same members, and the only thing that
 * differs is which scope is being asked about. Writing it twice is how the two
 * would come to disagree.
 */
function artifacts(
  scope: number,
  planned: readonly PlannedNode[],
  edges: readonly PlannedEdge[],
  carried: Carried
): XmlNode[] {
  const out: XmlNode[] = [];

  for (const node of planned) {
    if (node.scope !== scope || node.mapping.slot !== 'artifact') continue;
    out.push(semanticNode(node, carried));
  }
  for (const edge of edges) {
    if (edge.scope !== scope || edge.element !== 'association') continue;
    out.push(semanticEdge(edge, carried));
  }

  return out;
}

/**
 * One flow, as its semantic element, carrying whatever an import kept on it.
 *
 * The three kinds share a writer because they share a shape — an id, two ends,
 * and everything the format says about a flow that Labre does not model (a
 * `conditionExpression`, a `default`, a vendor's `extensionElements`). What
 * differs is one attribute each way, and writing them apart is how the three
 * would come to disagree about the carried half.
 *
 * The carried attributes go on LAST, which is what lets an
 * `associationDirection` the file actually stated win over the `None` this
 * exporter writes for a role that declares no direction (`docs/adr/0010`).
 */
function semanticEdge(edge: PlannedEdge, carried: Carried): XmlElement {
  const attrs: Attrs = {
    id: edge.id,
    // `association` has no `name` in this exporter and never had one.
    ...(edge.element === 'association' ? {} : { name: edge.name || undefined }),
    sourceRef: edge.source.id,
    targetRef: edge.target.id,
    // "This note is about that task" reads the same from either end, so the
    // association claims no direction.
    ...(edge.element === 'association' ? { associationDirection: 'None' } : {}),
    ...carried.attrs(edge.payload, BPMN_SCOPE.self),
  };
  return el(
    `bpmn:${edge.element}`,
    attrs,
    // A flow has no child this exporter writes, so there is nothing for the
    // carried ones to be ordered against.
    carried.keep(carriedFragments(edge.payload?.children, BPMN_SCOPE.self))
  );
}

/**
 * One artefact, as its semantic element (plus whatever it drags along).
 *
 * ## Where the carried half goes, and why it is one rule
 *
 * Everything an import kept off this element goes in FIRST, before the single
 * child this exporter ever writes — and that is XSD-correct for both of the
 * two cases rather than a convenience. `tTextAnnotation` is
 * `documentation* → extensionElements? → text?`, so the annotation's own text
 * is genuinely last. `tCatchEvent` / `tThrowEvent` reach `eventDefinition*`
 * only after `documentation*`, `extensionElements?`, `auditing?`,
 * `monitoring?`, `categoryValueRef*`, `incoming*`, `outgoing*`, `property*`,
 * `dataOutput*`, `dataOutputAssociation*` and `outputSet?` — which is to say,
 * after every child of an event an import can have carried. One rule covers
 * both, which is the only way it stays true.
 */
function semanticNode(node: PlannedNode, written: Carried): XmlElement {
  const { mapping, name } = node;
  const carried = written.keep(
    carriedFragments(node.payload?.children, BPMN_SCOPE.self)
  );
  const foreign = written.attrs(node.payload, BPMN_SCOPE.self);

  if (mapping.element === 'textAnnotation') {
    return el(
      'bpmn:textAnnotation',
      { id: node.id, textFormat: 'text/plain', ...foreign },
      [...carried, textEl('bpmn:text', name)]
    );
  }

  if (mapping.element === 'group') {
    // No `name` attribute exists on `group` — the label is the categoryValue's.
    return el(
      'bpmn:group',
      {
        id: node.id,
        categoryValueRef: node.categoryValueId,
        ...foreign,
      },
      carried
    );
  }

  if (mapping.element === 'dataObjectReference') {
    return el(
      'bpmn:dataObjectReference',
      {
        id: node.id,
        name: name || undefined,
        dataObjectRef: node.dataObjectId,
        ...foreign,
      },
      carried
    );
  }

  const attrs: Attrs = { id: node.id, name: name || undefined, ...foreign };
  const children: XmlNode[] = [...carried];
  if (mapping.eventDefinition) {
    // Last child of the event, which is where `tCatchEvent` / `tThrowEvent` put
    // it. No child of its own is required: a `timerEventDefinition` with no
    // `timeDate` is valid, and the pack does not ask the author for one.
    children.push(el(`bpmn:${mapping.eventDefinition}`, {}));
  }
  return el(`bpmn:${mapping.element}`, attrs, children);
}
