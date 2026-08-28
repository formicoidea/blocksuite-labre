import type {
  InterchangeImportContext,
  InterchangeImportResult,
  InterchangeNote,
  SerializedElementProps,
} from '@labre/affine-block-surface';
import type { BpmnLane, BpmnNodeKind } from '@labre/affine-model';
import { ConnectorMode, PointStyle, StrokeStyle } from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { ForeignInterchange } from '@labre/std/gfx';

import {
  ASSOCIATION_STROKE,
  ASSOCIATION_WIDTH,
  MESSAGE_STROKE,
  MESSAGE_WIDTH,
  NODE_SIZE,
  POOL_BAND_WIDTH,
  POOL_REF_HEIGHT,
  POOL_REF_WIDTH,
  SEQUENCE_STROKE,
  SEQUENCE_WIDTH,
} from './consts.js';
import {
  BPMN_FORMAT_ID,
  BPMN_NS,
  BPMN_XML_OF_KIND,
  type BpmnXmlMapping,
  escapeAttr,
  escapeText,
} from './export.js';
import { bpmnNodeProps } from './presets.js';
import { BPMN_ROLE } from './roles.js';

/**
 * A BPMN 2.0 interchange document, read as a board — the inverse of `export.ts`
 * on the vocabulary Labre draws, and an honest accounting of everything else
 * (`docs/adr/0012`, D1–D6).
 *
 * ## Pure by construction, like its mirror
 *
 * A string in, element PROPS out. No `BlockStdScope`, no surface, no store, no
 * clock, no randomness — this function has no surface to add anything to, and
 * giving it one would cost exactly the property that lets one implementation
 * serve an editor command and a labre-mcp tool (ADR 0012, P3). The caller does
 * the writing.
 *
 * ## What the caller owes, and it is one thing
 *
 * `surface.addElement` mints its own nanoid and ignores any id it is handed —
 * surface identity is Labre's and never the file's (D3) — so a connector's
 * `source` / `target` below name the **source file's** ids rather than surface
 * ones. The caller creates the elements, folds the array into a map from each
 * element's `interchange.bpmn.id` to the id the surface minted for it, and
 * rewrites the two endpoints. Every element carries that id, so the map is a
 * fold over the very array this returned; nothing else is needed to finish it.
 *
 * ## Three states, and no fourth
 *
 * Every node of the file is **mapped** (there is a Labre artefact: drawn,
 * editable, re-emitted from the drawing), **carried** (no artefact: kept
 * verbatim in `interchange.bpmn` on the nearest mapped element, invisible on
 * the canvas) or **quarantined** (kept, and deliberately never written back,
 * because re-emitting it would produce a file that contradicts the drawing).
 * Nothing is dropped in silence, and the report says which happened to what.
 *
 * What Labre judges is what Labre can DRAW: a carried element is on no canvas,
 * so no validation rule sees it and no audit counts it. That is correct, and it
 * is the sentence the report has to be read with.
 *
 * ## Reading XML by hand, and why
 *
 * The tree is walked child by child rather than through
 * `getElementsByTagNameNS`, which happy-dom does not implement for a parsed XML
 * document: it answers an empty list for every namespaced query, so a unit
 * suite built on it would pass by asserting nothing. The same environment
 * decodes neither numeric character references nor `&apos;` in an attribute
 * value, which is why the escaped-label round trip is pinned in chromium
 * (`integration-test/src/__tests__/edgeless/bpmn.spec.ts`) and not in the unit
 * spec. Both traps are `export.unit.spec.ts`'s findings, inherited rather than
 * rediscovered.
 *
 * ## Failure is an exception, not a report
 *
 * A source that is not a readable BPMN document — malformed XML, a root that is
 * not `definitions`, or a `definitions` whose only root is a choreography or a
 * conversation (D1's one refusal) — makes this function THROW. The report's
 * five note kinds are a closed list and not one of them can say "this is not a
 * file I can read"; a result of three zeroes and no elements would claim an
 * empty process where there was none. The command layer catches it and tells
 * the user which of the three it was.
 *
 * ## The loss table
 *
 * Every semantic capability owes one (ADR 0012), and this is `.bpmn`'s. What is
 * INVISIBLE is not what is LOST, and the distinction is the deliverable: a
 * carried fragment is in the document and out of the picture, and only the
 * bottom rows are gone for good.
 *
 * | what                                                        | state       | after a round trip                                  |
 * | ----------------------------------------------------------- | ----------- | --------------------------------------------------- |
 * | the 17 kinds, pools, flat lanes, the 3 edge roles, the DI   | mapped      | drawn, and written back from the drawing            |
 * | element ids (participants, flow nodes, flows, lanes)        | mapped      | given back verbatim — the fixed point (D3)          |
 * | `documentation`, `ioSpecification`, `conditionExpression`, … | carried     | invisible on the canvas, kept verbatim              |
 * | `process/@isExecutable="true"`                              | carried     | the writer emits `false` until re-emission lands    |
 * | a flow onto a carried node (a boundary event's error path)  | carried     | kept beside the node it runs to, never drawn loose  |
 * | a `BPMNShape` drawing an element the file does not declare  | carried     | kept under the id it names; nothing is drawn for it |
 * | loop / multi-instance / compensation markers                | carried     | a plain task on the canvas, still marked in the file |
 * | Analytic elements (boundary, inclusive, event-based, …)     | carried     | not drawn, kept whole on the enclosing pool         |
 * | `camunda:` / `zeebe:` / `signavio:` extensions              | carried     | kept verbatim, declarations included                |
 * | a colour set in bpmn.io (`bioc:`, `color:`)                 | quarantined | imports grey; the colour is kept and not written back |
 * | the body of an expanded sub-process                         | quarantined | drawn collapsed; the body survives in the document  |
 * | lane nesting (`childLaneSet`)                               | quarantined | flat lanes with joined names; the nesting survives  |
 * | `definitions`-level `<import>`                              | quarantined | single-file import only                             |
 * | an edge's explicit `di:waypoint` routing                    | **lost**    | re-routed from the two ends, and it says so         |
 * | the file's `definitions/@id`, `@targetNamespace`, `@exporter` | **lost**  | Labre writes its own                                |
 * | the file's `process/@id`, where a participant names one      | **lost**   | re-minted from the participant's id, which IS kept  |
 * | `laneSet/@id`, `collaboration/@id` and `@name`, `BPMNDiagram/@id`, `BPMNPlane/@id`, every `BPMNShape/@id` and `BPMNEdge/@id`, the folded `dataObject/@id` | **lost** | re-derived from the id its element settled on, which is what makes the fixed point a fixed point (D3) |
 * | a gap or an overlap between two lane bands                   | **lost**   | lanes are weights: Labre lays its bands end to end  |
 * | the plane offset (§12.3)                                    | **lost**   | shape exact, origin at (0, 0) — the export's doing  |
 * | surface identity across a re-import                         | **lost**   | a new board beside the old one, never a merge       |
 *
 * One row is owed rather than done, and it is stated here because a reader of
 * this file is who needs to know: **the carried and quarantined payloads are
 * written to the document and are not yet re-emitted on export.** The reader
 * puts them there, whole, with the namespace declarations they need; the writer
 * that puts them back into a `.bpmn` is the other half of the chantier. Until
 * it lands, "kept verbatim" means kept in the Labre document, not kept in the
 * next file out of it.
 */

/* ── The inverse of the export's tables ───────────────────────────────── */

/** The key {@link BPMN_KIND_OF_XML} is read by: an element and its trigger. */
function xmlKindKey(element: string, eventDefinition?: string): string {
  return `${element}#${eventDefinition ?? ''}`;
}

/**
 * `startEvent` + `messageEventDefinition` → `startEventMessage`, and the
 * sixteen other answers.
 *
 * DERIVED from {@link BPMN_XML_OF_KIND} rather than typed out a second time,
 * which is the only arrangement in which the two directions cannot drift: a
 * kind added to the pack gains its reading the moment it gains its writing, and
 * an element name corrected in the table is corrected in both. The inverse of
 * that table is not a function in general — `startEvent` alone is four kinds —
 * so the key is the PAIR (element name, event definition), which is exactly
 * what the table tells them apart by.
 *
 * That the pair is injective — seventeen kinds, seventeen distinct keys — is a
 * property of the table rather than of this code, so the spec asserts it
 * instead of this line assuming it.
 */
export const BPMN_KIND_OF_XML: ReadonlyMap<string, BpmnNodeKind> = new Map(
  (Object.entries(BPMN_XML_OF_KIND) as [BpmnNodeKind, BpmnXmlMapping][]).map(
    ([kind, mapping]) => [
      xmlKindKey(mapping.element, mapping.eventDefinition),
      kind,
    ]
  )
);

/**
 * `.bpmn`'s scope vocabulary — where a carried fragment came off (D2, as
 * amended in #157).
 *
 * One Labre element stands for several source elements: a pool is a
 * `participant` AND its `process`, plus a `laneSet`, every `lane`, the
 * `BPMNShape` that draws it, and — on the first pool of a document — the
 * `collaboration` and `definitions` themselves. Everything they carry lands in
 * ONE payload, so what came off which is recorded, or two lanes with the same
 * foreign attribute leave one value in a persisted field and a report that
 * says two.
 *
 * A scope is either a source element's **id, verbatim** — every carried flow
 * node, every lane, every carried root element — or one of the `@` keys below,
 * for the parts of the document that have no id worth naming or whose identity
 * is their relation to this element. `@` is not an XML NameStartChar, so no id
 * in a conformant file can ever collide with one.
 *
 * The rule for a fragment is always the same: **the scope is the element it was
 * a child of**, because that is where an exporter has to put it back. For an
 * attribute it is the element that carried the attribute; for a `di` fragment,
 * what that fragment draws.
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
 * The three edge elements, and the role each one IS.
 *
 * A role is a statement (`docs/adr/0010`), and an imported edge makes the same
 * statement a drawn one does: the file said `messageFlow`, so the arrow says
 * "sends a message to". Nothing here invents a role for an untyped edge —
 * there is no such thing in BPMN, where every connecting object is one of
 * these three.
 */
const EDGE_ROLE_OF_ELEMENT: Readonly<Record<string, string>> = {
  sequenceFlow: BPMN_ROLE.sequenceFlow,
  messageFlow: BPMN_ROLE.messageFlow,
  association: BPMN_ROLE.association,
};

/**
 * The colour extensions D5 quarantines (case 1), by namespace and by prefix.
 *
 * bpmn.io's own `bioc:` and the OMG's non-normative colour extension. They
 * collide with `strokeColor` / `fillColor`, which Labre owns and the user can
 * change from the shape toolbar — so writing a stale `bioc:fill` back beside a
 * recoloured shape would produce a file that disagrees with itself. Adopting
 * them as real colours would lift the case out of quarantine in both directions
 * at once, and is a chantier of its own (ADR 0012, non-goals).
 */
const COLOUR_NS = new Set([
  'http://bpmn.io/schema/bpmn/biocolor/1.0',
  'http://www.omg.org/spec/BPMN/non-normative/color/1.0',
]);
const COLOUR_PREFIX = new Set(['bioc', 'color']);

/** The four reasons a fragment is kept and not written back (D5). Closed. */
export const BPMN_QUARANTINE_REASON = {
  colour:
    'A vendor colour extension. Labre owns the stroke and the fill of the shape ' +
    'it was on, so writing it back beside a recoloured artefact would produce a ' +
    'file that disagrees with itself.',
  expanded:
    'The body of an expanded sub-process. Labre draws the collapsed form, and a ' +
    'body written under a shape flagged collapsed is a model and a diagram that ' +
    'contradict each other. It stays in the document.',
  nestedLanes:
    'A nested lane set. A Labre pool is one flat list of bands, so the leaves ' +
    'were imported carrying their whole path as a name; writing the nesting back ' +
    'alongside them would describe the pool twice.',
  imported:
    'A `definitions`-level <import>. Labre reads one file (§15.3.1 asks for a ' +
    'self-contained set), so writing this back would claim a resolution of ' +
    'another document that never happened.',
} as const;

/**
 * The children of an activity that are NOT its body.
 *
 * They describe the activity itself — its documentation, its extensions, its
 * loop marker, its data plumbing — so they are carried and written back like
 * any other unmodelled child. Everything else inside an activity the diagram
 * flags `isExpanded="true"` is the flow drawn INSIDE it, which is the thing
 * D5 case 2 is about.
 */
const NOT_A_BODY = new Set([
  'documentation',
  'extensionElements',
  'incoming',
  'outgoing',
  'ioSpecification',
  'property',
  'dataInputAssociation',
  'dataOutputAssociation',
  'multiInstanceLoopCharacteristics',
  'standardLoopCharacteristics',
]);

/* ── Reading the DOM by hand ──────────────────────────────────────────── */

/** The `Node.nodeType`s a fragment can be made of, spelled rather than numbered. */
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_NODE = 4;
const PI_NODE = 7;
const COMMENT_NODE = 8;

/** The element children of `node`, in document order. */
function childrenOf(node: Element): Element[] {
  return Array.from(node.children);
}

/** Is this element in the BPMN MODEL namespace, whatever prefix it wears? */
function isModel(element: Element): boolean {
  return element.namespaceURI === BPMN_NS.model;
}

/** MODEL-namespaced children with this local name, in document order. */
function modelChildren(parent: Element, local: string): Element[] {
  return childrenOf(parent).filter(
    child => isModel(child) && child.localName === local
  );
}

/** The first MODEL child with this local name, if any. */
function modelChild(parent: Element, local: string): Element | undefined {
  return modelChildren(parent, local)[0];
}

/** An attribute, or `undefined` — never `null`, which reads as a value. */
function attrOf(element: Element, name: string): string | undefined {
  const value = element.getAttribute(name);
  return value === null ? undefined : value;
}

/** The prefix of a qualified name, `''` when it has none. */
function prefixOf(qualified: string): string {
  const colon = qualified.indexOf(':');
  return colon < 0 ? '' : qualified.slice(0, colon);
}

/** Is this attribute one of the colour extensions D5 quarantines? */
function isColourAttr(attr: Attr): boolean {
  return (
    (attr.namespaceURI !== null && COLOUR_NS.has(attr.namespaceURI)) ||
    COLOUR_PREFIX.has(prefixOf(attr.name))
  );
}

/**
 * One element, back as XML text — the verbatim form D1 promises for anything
 * carried or quarantined.
 *
 * Serialized here rather than through `outerHTML`, for two halves of one
 * reason: `outerHTML` is an HTML serializer in several DOM implementations
 * (void elements, lower-cased names, attribute newlines left raw), and what is
 * stored here is a document VALUE that a later export has to be able to write
 * back character for character. Prefixes are kept exactly as the file spelled
 * them, because a `camunda:properties` fragment only means anything under the
 * declaration its `definitions` carried — which is why those declarations are
 * carried too (see the residue, below).
 *
 * Escaping is `export.ts`'s own, so a fragment stored by this reader and a name
 * written by that writer treat a newline in an attribute value the same way
 * (XML 1.0 §3.3.3 — only a character reference survives normalization).
 */
function fragmentOf(element: Element): string {
  const attrs = Array.from(element.attributes)
    .map(attr => ` ${attr.name}="${escapeAttr(attr.value)}"`)
    .join('');

  const parts: string[] = [];
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === ELEMENT_NODE) {
      parts.push(fragmentOf(child as Element));
    } else if (child.nodeType === TEXT_NODE || child.nodeType === CDATA_NODE) {
      parts.push(escapeText(child.nodeValue ?? ''));
    } else if (child.nodeType === COMMENT_NODE) {
      // A comment inside a vendor extension is documentation somebody wrote by
      // hand, and dropping it while promising the fragment back "character for
      // character" would make that promise false in the one place a human
      // would notice.
      parts.push(`<!--${child.nodeValue ?? ''}-->`);
    } else if (child.nodeType === PI_NODE) {
      const instruction = child as ProcessingInstruction;
      parts.push(`<?${instruction.target} ${instruction.data}?>`);
    }
  }

  const name = element.nodeName;
  if (parts.length === 0) return `<${name}${attrs} />`;
  return `<${name}${attrs}>${parts.join('')}</${name}>`;
}

/**
 * The document, or an exception naming what is wrong with it.
 *
 * `DOMParser` reports a malformed document as a `parsererror` element rather
 * than by throwing, which is a well-formedness answer nobody asked for in the
 * shape of a document — so it is turned into the exception the caller can
 * actually act on.
 */
function parseDefinitions(source: string): Element {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  const error = doc.querySelector('parsererror');
  if (error) {
    throw new Error(
      `This file is not well-formed XML, so no BPMN can be read out of it: ` +
        `${(error.textContent ?? '').trim().slice(0, 200)}`
    );
  }
  const root = doc.documentElement;
  if (!root || root.localName !== 'definitions') {
    throw new Error(
      `A BPMN file opens on <definitions>; this one opens on <${root?.localName ?? 'nothing'}>.`
    );
  }
  // The NAMESPACE, not the element name — `<definitions>` is also the root of a
  // DMN decision model, and of anything else built on the same OMG scaffolding.
  // Without this a `.dmn` imports as an empty board, which is exactly the
  // "three zeroes claiming an empty process" this reader refuses to return.
  if (root.namespaceURI !== BPMN_NS.model) {
    throw new Error(
      `This <definitions> is in "${root.namespaceURI ?? 'no namespace'}", not ` +
        `in BPMN 2.0's ("${BPMN_NS.model}"). A DMN decision model and a BPMN ` +
        `process open on the same element name and are not the same file.`
    );
  }
  return root;
}

/* ── The diagram ──────────────────────────────────────────────────────── */

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DiShape {
  bounds: Rect | null;
  /** Position in the plane, which is the order the drawing is stacked in. */
  index: number;
  element: Element;
}

interface DiEdge {
  waypoints: number;
  index: number;
  element: Element;
}

/** A `dc:Bounds` child, as four numbers — `null` when it has none, or junk. */
function boundsOf(shape: Element): Rect | null {
  const box = childrenOf(shape).find(
    child => child.namespaceURI === BPMN_NS.dc && child.localName === 'Bounds'
  );
  if (!box) return null;
  const numbers = ['x', 'y', 'width', 'height'].map(name =>
    Number(attrOf(box, name) ?? Number.NaN)
  );
  if (numbers.some(value => !Number.isFinite(value))) return null;
  return { x: numbers[0], y: numbers[1], w: numbers[2], h: numbers[3] };
}

/**
 * Every `BPMNShape` and `BPMNEdge` of the document, keyed by what it draws.
 *
 * All planes of all diagrams, flattened, first occurrence winning:
 * `bpmnElement` is an id and an id is document-unique, so two shapes for one
 * element is a contradiction in the source rather than a case to model. A file
 * carrying a second diagram for an expanded sub-process therefore contributes
 * its shapes here, and the sub-process body is quarantined all the same — the
 * DI follows whatever it describes.
 *
 * The INDEX is what makes the round trip a fixed point: the exporter writes
 * shapes in document order, so reading them back in plane order is what lets
 * the export after an import land on the bytes of the export before it.
 */
function diagramIndex(definitions: Element): {
  shapes: Map<string, DiShape>;
  edges: Map<string, DiEdge>;
} {
  const shapes = new Map<string, DiShape>();
  const edges = new Map<string, DiEdge>();
  let index = 0;

  for (const diagram of childrenOf(definitions)) {
    if (
      diagram.namespaceURI !== BPMN_NS.bpmndi ||
      diagram.localName !== 'BPMNDiagram'
    ) {
      continue;
    }
    for (const plane of childrenOf(diagram)) {
      if (
        plane.namespaceURI !== BPMN_NS.bpmndi ||
        plane.localName !== 'BPMNPlane'
      ) {
        continue;
      }
      for (const child of childrenOf(plane)) {
        if (child.namespaceURI !== BPMN_NS.bpmndi) continue;
        const target = attrOf(child, 'bpmnElement');
        if (target === undefined) continue;
        if (child.localName === 'BPMNShape' && !shapes.has(target)) {
          shapes.set(target, {
            bounds: boundsOf(child),
            index: index++,
            element: child,
          });
        } else if (child.localName === 'BPMNEdge' && !edges.has(target)) {
          edges.set(target, {
            waypoints: childrenOf(child).filter(
              point =>
                point.namespaceURI === BPMN_NS.di &&
                point.localName === 'waypoint'
            ).length,
            index: index++,
            element: child,
          });
        }
      }
    }
  }

  return { shapes, edges };
}

/* ── What the reader is building ──────────────────────────────────────── */

/** One element on its way to the surface, with what it is carrying. */
interface Draft {
  props: SerializedElementProps;
  payload: ForeignInterchange;
  /** Where it sits in the DRAWING; `Infinity` for anything undrawn. */
  order: number;
  kind: 'pool' | 'node' | 'edge';
  /** Set when the file gave this shape no bounds: D4's swept position. */
  needsLayout?: { w: number; h: number };
}

/** One resolved lane band, and what the file claimed was in it. */
interface Band {
  lane: BpmnLane;
  rect: Rect | null;
  refs: string[];
}

/**
 * The attributes the reader UNDERSTANDS, per element — and therefore the ones
 * it does not carry, because they are already in the drawing.
 *
 * The default row is the honest one: an `id` and a `name` are the model
 * everywhere in this format, and everything else on an element Labre draws is
 * something Labre does not model and must not lose.
 */
const READ_ATTRS: Readonly<Record<string, readonly string[]>> = {
  definitions: ['id', 'name', 'targetNamespace', 'exporter', 'exporterVersion'],
  participant: ['id', 'name', 'processRef'],
  process: ['id', 'name', 'isExecutable'],
  lane: ['id', 'name'],
  laneSet: ['id', 'name'],
  textAnnotation: ['id', 'textFormat'],
  group: ['id', 'categoryValueRef'],
  dataObjectReference: ['id', 'name', 'dataObjectRef'],
  sequenceFlow: ['id', 'name', 'sourceRef', 'targetRef'],
  messageFlow: ['id', 'name', 'sourceRef', 'targetRef'],
  // `associationDirection` is read only when it says what the exporter would
  // write anyway; see the edge reader for the other values.
  association: ['id', 'name', 'sourceRef', 'targetRef', 'associationDirection'],
  '': ['id', 'name'],
};

/** What a `BPMNShape` says that the drawing already carries. */
const READ_SHAPE_ATTRS = [
  'id',
  'bpmnElement',
  'isExpanded',
  'isMarkerVisible',
  'isHorizontal',
];

/**
 * The namespaces `export.ts` declares for itself, which are therefore not
 * foreign matter when they come back in.
 *
 * A file's OTHER declarations — `xmlns:camunda`, `xmlns:bioc` — are carried,
 * because a carried `camunda:` fragment means nothing without the declaration
 * it was written under, and whatever writes those fragments back has to write
 * this back with them.
 */
const OWN_NAMESPACES = new Set<string>([
  BPMN_NS.model,
  BPMN_NS.bpmndi,
  BPMN_NS.di,
  BPMN_NS.dc,
]);

/** How far off to the side an undrawn artefact is swept, and on what grid. */
const SWEEP_GAP = 160;
const SWEEP_STEP = 200;
const SWEEP_COLUMNS = 4;
/** The margin between a minted pool's plot and the work inside it. */
const MINTED_POOL_PADDING = 40;

/** The connector a role is drawn as — the styles the tools arm, one table. */
function connectorProps(role: string): SerializedElementProps {
  const base = { type: 'connector', role, mode: ConnectorMode.Orthogonal };
  if (role === BPMN_ROLE.messageFlow) {
    return {
      ...base,
      stroke: MESSAGE_STROKE,
      strokeWidth: MESSAGE_WIDTH,
      strokeStyle: StrokeStyle.Dash,
      frontEndpointStyle: PointStyle.Circle,
      rearEndpointStyle: PointStyle.Arrow,
    };
  }
  if (role === BPMN_ROLE.association) {
    return {
      ...base,
      stroke: ASSOCIATION_STROKE,
      strokeWidth: ASSOCIATION_WIDTH,
      strokeStyle: StrokeStyle.Dash,
      // No head at either end: an association claims no direction, and an
      // arrowhead would be the picture claiming one (`docs/adr/0010`).
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.None,
    };
  }
  return {
    ...base,
    stroke: SEQUENCE_STROKE,
    strokeWidth: SEQUENCE_WIDTH,
    strokeStyle: StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Triangle,
  };
}

/**
 * The version of the format this file declares (ADR 0012, P2 as amended).
 *
 * Always `2.0` and never the namespace URI itself: `parseDefinitions` has
 * already refused anything that is not in BPMN 2.0's MODEL namespace, so there
 * is no case in which a foreign URI could leak out of here into a UI that would
 * render it as a version.
 */
function sourceVersionOf(definitions: Element): string | undefined {
  const version = '2.0';
  const exporter = attrOf(definitions, 'exporter');
  if (exporter === undefined) return version;
  const exporterVersion = attrOf(definitions, 'exporterVersion');
  return `${version} (${[exporter, exporterVersion].filter(Boolean).join(' ')})`;
}

/** `[x,y,w,h]` back off a draft that already has one. */
function boundOf(draft: Draft): Bound {
  return Bound.deserialize(String(draft.props.xywh));
}

/**
 * Where the file placed nothing (D4).
 *
 * A shape with no `dc:Bounds` is still imported — it is in the model, and a
 * model element the reader can draw is not a thing to drop — but its position
 * is Labre's and the report says so. Swept onto a grid to the RIGHT of
 * everything the file did place, in document order, so the same file always
 * lands the same board and nothing an author drew is covered by something they
 * did not.
 */
function layOutTheUndrawn(drafts: readonly Draft[], minted: Draft | undefined) {
  const placed = drafts.filter(
    draft =>
      draft.needsLayout === undefined &&
      draft !== minted &&
      draft.kind !== 'edge'
  );
  const boxes = placed.map(boundOf);
  const maxX =
    boxes.length > 0 ? Math.max(...boxes.map(box => box.x + box.w)) : 0;
  const minY = boxes.length > 0 ? Math.min(...boxes.map(box => box.y)) : 0;

  let seat = 0;
  for (const draft of drafts) {
    if (!draft.needsLayout) continue;
    const column = seat % SWEEP_COLUMNS;
    const row = Math.floor(seat / SWEEP_COLUMNS);
    seat++;
    draft.props.xywh = new Bound(
      maxX + SWEEP_GAP + column * SWEEP_STEP,
      minY + row * SWEEP_STEP,
      draft.needsLayout.w,
      draft.needsLayout.h
    ).serialize();
  }

  // The pool minted for a file that had no participant (D6) is sized LAST, to
  // hold everything: a pool's plot is what decides which artefacts are in it,
  // and an artefact drawn outside every plot would be exported back into a
  // process of its own.
  if (!minted) return;
  const inside = drafts
    .filter(draft => draft !== minted && draft.kind === 'node')
    .map(boundOf);
  if (inside.length === 0) return;
  const left = Math.min(...inside.map(box => box.x)) - MINTED_POOL_PADDING;
  const top = Math.min(...inside.map(box => box.y)) - MINTED_POOL_PADDING;
  const right =
    Math.max(...inside.map(box => box.x + box.w)) + MINTED_POOL_PADDING;
  const bottom =
    Math.max(...inside.map(box => box.y + box.h)) + MINTED_POOL_PADDING;
  minted.props.xywh = new Bound(
    // The name band is drawn INSIDE the frame and is not part of the plot, so
    // the frame starts a band's width further left than the work does.
    left - POOL_BAND_WIDTH,
    top,
    right - left + POOL_BAND_WIDTH,
    bottom - top
  ).serialize();
}

/* ── The reader ───────────────────────────────────────────────────────── */

/**
 * Read a BPMN 2.0 interchange document as element props plus a report.
 *
 * See the module comment for the contract, and `docs/adr/0012` D1–D6 for why it
 * is this contract and not a shorter one.
 */
export function importBpmnXml(
  source: string,
  context: InterchangeImportContext = {}
): InterchangeImportResult {
  // The caller's name has no landing place in an array of elements: what a
  // board is CALLED is the document's, not any element's. A caller that wants
  // to name the doc after the file reads `collaboration/@name` itself.
  void context;

  const definitions = parseDefinitions(source);
  const { shapes, edges: diEdges } = diagramIndex(definitions);

  const notes: InterchangeNote[] = [];
  const note = (entry: InterchangeNote) => notes.push(entry);
  let carried = 0;
  let quarantined = 0;
  let explicitRoutes = 0;

  const drafts: Draft[] = [];
  const seenSourceIds = new Set<string>();
  /** Source ids that became an artefact a flow may attach to: pools and nodes. */
  const mappedSourceIds = new Set<string>();
  /** Source ids kept verbatim on some element instead: never a connector end. */
  const carriedSourceIds = new Set<string>();
  /** Every source id whose diagram element this reader consumed or kept. */
  const drawnSourceIds = new Set<string>();

  /* ── Roots ─────────────────────────────────────────────────────────── */

  const roots = childrenOf(definitions).filter(isModel);
  const collaborations = roots.filter(
    root => root.localName === 'collaboration'
  );
  const processes = roots.filter(root => root.localName === 'process');

  // D1's one refusal, and it is at the document level: half a choreography is
  // not a smaller choreography, and a conversation is a different picture of a
  // different thing. Declined by name, with no partial import.
  if (processes.length === 0 && collaborations.length === 0) {
    const declined = roots.find(root =>
      ['choreography', 'globalChoreographyTask', 'conversation'].includes(
        root.localName
      )
    );
    if (declined) {
      throw new Error(
        `This file is a BPMN ${declined.localName}, which Labre does not draw. ` +
          `Only a process or a collaboration can be imported.`
      );
    }
  }

  /** `categoryValue` id → the label a `group` pointing at it wears. */
  const categoryValues = new Map<string, string>();
  for (const root of roots) {
    if (root.localName !== 'category') continue;
    for (const value of modelChildren(root, 'categoryValue')) {
      const id = attrOf(value, 'id');
      if (id !== undefined)
        categoryValues.set(id, attrOf(value, 'value') ?? '');
    }
  }

  /* ── The four ways something is kept ───────────────────────────────── */

  /** Records a source id, and names the SECOND element to claim it (D3). */
  const claim = (sourceId: string | undefined, element: string) => {
    if (sourceId === undefined) return;
    if (seenSourceIds.has(sourceId)) {
      note({
        kind: 'substituted-id',
        sourceId,
        element,
        message:
          `Two elements in this file share the id "${sourceId}", which BPMN ` +
          `requires to be unique across a document. Both were imported; the ` +
          `second will be written back under an id Labre mints.`,
      });
    }
    seenSourceIds.add(sourceId);
  };

  /** One attribute, kept under the scope of the element that carried it. */
  const carryAttr = (
    payload: ForeignInterchange,
    scope: string,
    name: string,
    value: string
  ) => {
    payload.attrs = {
      ...payload.attrs,
      [scope]: { ...payload.attrs?.[scope], [name]: value },
    };
    carried++;
  };

  /**
   * One fragment, kept under the scope of the element it was a CHILD of.
   *
   * `announce: false` for a fragment whose own note is written at the call site
   * — a flow onto a carried node is carried for a REASON, and two notes about
   * one flow, one of them generic, is a worse report than one that is precise.
   */
  const carryChild = (
    payload: ForeignInterchange,
    scope: string,
    child: Element,
    sourceId: string | undefined,
    announce = true
  ) => {
    payload.children = {
      ...payload.children,
      [scope]: [...(payload.children?.[scope] ?? []), fragmentOf(child)],
    };
    carried++;
    if (!announce) return;
    note({
      kind: 'carried',
      element: child.nodeName,
      sourceId,
      message:
        `<${child.nodeName}> has no Labre artefact, so it is kept verbatim on ` +
        `the nearest element that has one. It is not drawn, and no validation ` +
        `rule sees it.`,
    });
  };

  /** One diagram fragment, kept under the scope of what it DRAWS. */
  const carryDi = (
    payload: ForeignInterchange,
    scope: string,
    fragment: string
  ) => {
    payload.di = {
      ...payload.di,
      [scope]: [...(payload.di?.[scope] ?? []), fragment],
    };
    carried++;
  };

  const quarantine = (
    payload: ForeignInterchange,
    fragment: string,
    reason: string,
    entry: Omit<InterchangeNote, 'kind' | 'message'>
  ) => {
    payload.quarantined = [
      ...(payload.quarantined ?? []),
      { fragment, reason },
    ];
    quarantined++;
    note({ kind: 'quarantined', ...entry, message: reason });
  };

  /** Every attribute the reader does not model — colours quarantined (D5). */
  const sortAttributes = (
    element: Element,
    payload: ForeignInterchange,
    scope: string,
    sourceId: string | undefined,
    understood: readonly string[] = READ_ATTRS[element.localName] ??
      READ_ATTRS['']
  ) => {
    for (const attr of Array.from(element.attributes)) {
      if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) continue;
      if (understood.includes(attr.name)) continue;
      if (isColourAttr(attr)) {
        quarantine(
          payload,
          `${attr.name}="${escapeAttr(attr.value)}"`,
          BPMN_QUARANTINE_REASON.colour,
          { sourceId, element: attr.name }
        );
        continue;
      }
      carryAttr(payload, scope, attr.name, attr.value);
    }
  };

  /** The DI element's own extras: colours quarantined, the rest kept as `di`. */
  const sortShapeExtras = (
    shape: Element | undefined,
    payload: ForeignInterchange,
    sourceId: string | undefined
  ) => {
    if (!shape) return;
    sortAttributes(
      shape,
      payload,
      BPMN_SCOPE.shape,
      sourceId,
      READ_SHAPE_ATTRS
    );
    for (const child of childrenOf(shape)) {
      // The bounds and the waypoints ARE the drawing, and the drawing is what
      // was mapped. A `BPMNLabel` and anything else is kept as diagram matter.
      if (child.namespaceURI === BPMN_NS.dc && child.localName === 'Bounds') {
        continue;
      }
      if (child.namespaceURI === BPMN_NS.di && child.localName === 'waypoint') {
        continue;
      }
      carryDi(payload, BPMN_SCOPE.shape, fragmentOf(child));
    }
  };

  /* ── Pools, from participants ──────────────────────────────────────── */

  const processById = new Map<string, Element>();
  for (const process of processes) {
    const id = attrOf(process, 'id');
    if (id !== undefined) processById.set(id, process);
  }

  /** The process a participant named → the pool that draws the pair. */
  const poolOfProcess = new Map<Element, Draft>();

  const participants = collaborations.flatMap(collaboration =>
    modelChildren(collaboration, 'participant')
  );

  for (const participant of participants) {
    const sourceId = attrOf(participant, 'id');
    claim(sourceId, 'participant');
    if (sourceId !== undefined) {
      // A pool is an end a message flow may legally attach to (§10.6).
      mappedSourceIds.add(sourceId);
      drawnSourceIds.add(sourceId);
    }
    const shape = sourceId === undefined ? undefined : shapes.get(sourceId);
    const payload: ForeignInterchange = {};
    // The PARTICIPANT's id, because the participant is what the pool draws and
    // what a `BPMNShape` points at (D3). The process behind it is re-minted
    // from this one on export — that is the one id of the pair the round trip
    // does not keep, and it is in the loss table.
    if (sourceId !== undefined) payload.id = sourceId;

    const ref = attrOf(participant, 'processRef');
    const process = ref === undefined ? undefined : processById.get(ref);

    sortAttributes(participant, payload, BPMN_SCOPE.self, sourceId);
    sortShapeExtras(shape?.element, payload, sourceId);
    // Labre draws ONE thing where the format writes two, so the process's own
    // foreign matter rides on the pool that stands for it — under its own
    // scope, because it is a different source element with its own attributes.
    if (process) {
      sortAttributes(
        process,
        payload,
        BPMN_SCOPE.process,
        attrOf(process, 'id')
      );
      // A model downgrade if it were dropped: the writer emits
      // `isExecutable="false"` for every process it writes, so a file that says
      // `true` is saying something Labre does not model and must not lose.
      const executable = attrOf(process, 'isExecutable');
      if (executable !== undefined && executable !== 'false') {
        carryAttr(payload, BPMN_SCOPE.process, 'isExecutable', executable);
      }
    }

    const bounds = shape?.bounds ?? null;
    const draft: Draft = {
      props: {
        type: 'bpmnPool',
        // The FRAME the flow objects are drawn in, and a role of its own: a
        // rule written on the artefacts must never fall on the pool.
        role: BPMN_ROLE.pool,
        // `''` and not `undefined`: the model's own default is "Pool", and a
        // participant the file left unnamed must not acquire a name here.
        name: attrOf(participant, 'name') ?? '',
        xywh: (bounds
          ? new Bound(bounds.x, bounds.y, bounds.w, bounds.h)
          : new Bound(0, 0, POOL_REF_WIDTH, POOL_REF_HEIGHT)
        ).serialize(),
      },
      payload,
      order: shape?.index ?? Number.POSITIVE_INFINITY,
      kind: 'pool',
      ...(bounds
        ? {}
        : { needsLayout: { w: POOL_REF_WIDTH, h: POOL_REF_HEIGHT } }),
    };
    drafts.push(draft);
    if (process) poolOfProcess.set(process, draft);
    if (!bounds) {
      note({
        kind: 'invented-layout',
        sourceId,
        element: 'participant',
        message:
          `The participant "${draft.props.name || 'unnamed'}" arrived with no ` +
          `diagram, so Labre placed its pool beside the drawing.`,
      });
    }
  }

  /**
   * A pool for a file that named no participant (D6).
   *
   * A bare `process` is exactly what a poolless Labre board exports as, and it
   * is what a good half of the single-participant files in the wild are. It
   * gets a pool minted for it — the framework's background element, and the
   * only thing there is for the document's residue to ride on — and that pool
   * SAYS it stands for a process, which is what tells the exporter to give the
   * poolless form back rather than invent a collaboration nobody drew.
   */
  const bareProcess = participants.length === 0 ? processes[0] : undefined;
  let mintedPool: Draft | undefined;
  if (bareProcess) {
    const sourceId = attrOf(bareProcess, 'id');
    claim(sourceId, 'process');
    if (sourceId !== undefined) {
      mappedSourceIds.add(sourceId);
      drawnSourceIds.add(sourceId);
    }
    const payload: ForeignInterchange = { element: 'process' };
    if (sourceId !== undefined) payload.id = sourceId;
    // `@self` and not `@process`: this pool IS the process, which is exactly
    // what `element: 'process'` says.
    sortAttributes(bareProcess, payload, BPMN_SCOPE.self, sourceId);
    const bareExecutable = attrOf(bareProcess, 'isExecutable');
    if (bareExecutable !== undefined && bareExecutable !== 'false') {
      carryAttr(payload, BPMN_SCOPE.self, 'isExecutable', bareExecutable);
    }
    mintedPool = {
      props: {
        type: 'bpmnPool',
        role: BPMN_ROLE.pool,
        name: attrOf(bareProcess, 'name') ?? '',
        xywh: new Bound(0, 0, POOL_REF_WIDTH, POOL_REF_HEIGHT).serialize(),
      },
      payload,
      // Behind everything: it is a frame the file never drew.
      order: -1,
      kind: 'pool',
    };
    drafts.push(mintedPool);
    poolOfProcess.set(bareProcess, mintedPool);
    note({
      kind: 'invented-layout',
      sourceId,
      element: 'process',
      message:
        `This file names no participant, so its process was drawn in a pool of ` +
        `Labre's own. The pool is not the file's: exporting writes the process ` +
        `back without one.`,
    });
  }

  /**
   * Where the document's own residue rides (D6): the first pool there is.
   *
   * A stated asymmetry rather than an oversight — delete that pool and the
   * file's document-scope residue goes with it. Accepted: it is one value that
   * copy-pastes, undoes and syncs with something the user can see, and an
   * architect who has deleted the only pool of an imported process has deleted
   * the process.
   */
  const residence = () => drafts.find(draft => draft.kind === 'pool');

  /* ── Lanes ─────────────────────────────────────────────────────────── */

  const laneBands = new Map<Draft, Band[]>();

  for (const [process, pool] of poolOfProcess) {
    const laneSet = modelChild(process, 'laneSet');
    if (!laneSet) continue;
    sortAttributes(
      laneSet,
      pool.payload,
      BPMN_SCOPE.laneSet,
      attrOf(laneSet, 'id')
    );

    const bands: Band[] = [];

    /**
     * Walks a lane set, flattening a nested one onto its leaves (D5 case 3).
     *
     * `pool.lanes` is ONE flat list of bands over one plot: there is no gesture
     * that puts a lane inside a lane, and inventing a containment model is a
     * bigger decision than an importer gets to take. So the leaves are what
     * land, named by their whole path ("Sales / Back office") so nothing about
     * the original is unreadable, and the `childLaneSet` is quarantined —
     * written back beside the flat set, it would describe the pool twice.
     */
    const walkLanes = (set: Element, path: readonly string[]) => {
      for (const lane of modelChildren(set, 'lane')) {
        const sourceId = attrOf(lane, 'id');
        claim(sourceId, 'lane');
        const name = attrOf(lane, 'name') ?? '';
        const nested = modelChild(lane, 'childLaneSet');
        if (nested) {
          quarantine(
            pool.payload,
            fragmentOf(nested),
            BPMN_QUARANTINE_REASON.nestedLanes,
            { sourceId, element: 'childLaneSet' }
          );
          walkLanes(nested, [...path, name]);
          continue;
        }
        const rect =
          sourceId === undefined
            ? null
            : (shapes.get(sourceId)?.bounds ?? null);
        // The file's id, verbatim: a lane has no interchange payload of its
        // own, and this prop IS where its identity is kept (D3). The exporter
        // writes it back unprefixed for exactly that reason. It is also this
        // lane's SCOPE, so two lanes carrying one foreign attribute keep two
        // values.
        const laneId = sourceId ?? `lane-${bands.length + 1}`;
        // A lane is drawn — its band is the pool's own subdivision — so its
        // shape is consumed rather than orphaned, but it is not something a
        // flow may attach to.
        if (sourceId !== undefined) drawnSourceIds.add(sourceId);
        bands.push({
          lane: {
            id: laneId,
            name: [...path, name].filter(Boolean).join(' / '),
            // A relative WEIGHT, and the band's drawn height is the truest one
            // there is: the plot is shared in proportion, so two bands that
            // were 120 and 240 units tall come back as a third and two thirds,
            // whatever the pool is resized to afterwards. Filled in below,
            // because a set in which only SOME bands were drawn cannot mix the
            // two kinds of number.
            size: rect && rect.h > 0 ? rect.h : 1,
          },
          rect,
          refs: modelChildren(lane, 'flowNodeRef')
            .map(ref => (ref.textContent ?? '').trim())
            .filter(Boolean),
        });
        // Everything else about the lane rides on the pool, which is the
        // nearest thing that HAS a payload — under the lane's own scope.
        sortAttributes(lane, pool.payload, laneId, sourceId);
        for (const child of childrenOf(lane)) {
          if (isModel(child) && child.localName === 'flowNodeRef') continue;
          carryChild(pool.payload, laneId, child, sourceId);
        }
      }
    };
    walkLanes(laneSet, []);

    if (bands.length === 0) continue;

    // Top to bottom, which is the order a pool paints its bands in. Sorted by
    // the DRAWING when the drawing says (D4: the file's diagram wins at
    // import), and left in document order when it does not.
    const allDrawn = bands.every(band => band.rect !== null);
    if (allDrawn) {
      bands.sort((a, b) => (a.rect as Rect).y - (b.rect as Rect).y);
    } else {
      // A drawn height and the fallback `1` are not the same KIND of number: a
      // band of 200 beside a band of 1 paints a hairline nobody drew. So a set
      // that is not wholly drawn is split equally, and — like every other
      // position this reader invents (D4) — it says so.
      for (const band of bands) band.lane.size = 1;
      note({
        kind: 'invented-layout',
        sourceId: attrOf(laneSet, 'id'),
        element: 'laneSet',
        message:
          `${bands.length === 1 ? 'This lane' : `Some of these ${bands.length} lanes`} ` +
          `arrived with no diagram, so Labre split the pool into equal bands. ` +
          `The proportions are Labre's and not the file's.`,
      });
    }

    // Bands that do not tile the pool are still only WEIGHTS here — Labre lays
    // them end to end — so a file that drew a gap or an overlap between two
    // lanes comes back with the gap closed. That changes the picture, so it is
    // said once rather than discovered.
    if (allDrawn && bands.length > 1) {
      const gap = bands.slice(1).some((band, index) => {
        const above = bands[index].rect as Rect;
        return Math.abs((band.rect as Rect).y - (above.y + above.h)) > 0.5;
      });
      if (gap) {
        note({
          kind: 'invented-layout',
          sourceId: attrOf(laneSet, 'id'),
          element: 'laneSet',
          message:
            `The lanes of this pool are drawn with a gap or an overlap between ` +
            `them. Labre lays its bands end to end, so their heights were kept ` +
            `in proportion and the space between them was closed.`,
        });
      }
    }

    pool.props.lanes = bands.map(band => band.lane);
    laneBands.set(pool, bands);
  }

  /* ── Flow nodes, data references, artifacts ────────────────────────── */

  /** Source id → the box it was drawn in, for the lane membership check. */
  const nodeBounds = new Map<string, Rect>();

  /** The `dataObject`s a `dataObjectReference` folds in (§10.4.1). */
  const foldedDataObjects = new Set<string>();
  for (const process of processes) {
    for (const reference of modelChildren(process, 'dataObjectReference')) {
      const ref = attrOf(reference, 'dataObjectRef');
      if (ref !== undefined) foldedDataObjects.add(ref);
    }
  }

  /**
   * One semantic element of a scope: mapped, or carried on `host` under
   * `hostScope` — which is the element it was a child of, because that is where
   * an exporter has to put it back.
   */
  const readNode = (
    element: Element,
    host: Draft | undefined,
    hostScope: string
  ) => {
    const sourceId = attrOf(element, 'id');
    const local = element.localName;

    // The `dataObject` behind a reference is folded INTO the reference — DI
    // attaches to the reference, and the exporter writes the object back out
    // of the drawing — so it is neither mapped nor carried.
    if (
      local === 'dataObject' &&
      sourceId !== undefined &&
      foldedDataObjects.has(sourceId)
    ) {
      return;
    }

    // What TRIGGERS an event, in either of the two forms §10.5.2 allows: the
    // definition written inside the event, or a reference to one declared at
    // root scope (Table 10.82). Both are read, because both say the same thing
    // — and an event whose trigger is named by reference must never come back
    // as the None event the spec says an event with no definition is.
    const trigger = childrenOf(element).find(
      child => isModel(child) && child.localName.endsWith('EventDefinition')
    );
    const triggerRef = modelChild(element, 'eventDefinitionRef');
    const referenced = (() => {
      const ref = triggerRef?.textContent?.trim();
      if (!ref) return undefined;
      // A QName, resolved by id within this one file — which is what every tool
      // does with the unprefixed form this format writes everywhere else.
      return roots.find(
        root =>
          attrOf(root, 'id') === ref.split(':').pop() &&
          root.localName.endsWith('EventDefinition')
      );
    })();
    const kind = BPMN_KIND_OF_XML.get(
      xmlKindKey(local, (trigger ?? referenced)?.localName)
    );

    // A trigger we could not read is not a trigger we may drop: the event goes
    // whole into the carried branch below rather than onto the canvas claiming
    // something the file did not say.
    if (kind === undefined && triggerRef !== undefined) {
      note({
        kind: 'warning',
        sourceId,
        element: local,
        message:
          `<${local}> names its trigger by reference to ` +
          `"${triggerRef.textContent?.trim() ?? ''}", which Labre does not ` +
          `draw. The event was kept whole rather than drawn as a plain one.`,
      });
    }

    if (kind === undefined) {
      // CARRIED, and standing on its own: an Analytic or executable flow node —
      // a boundary event, an inclusive gateway, a transaction — that Labre has
      // no artefact for. It rides on the pool of the process it was written
      // in, which is the nearest mapped element there is, and its DI rides with
      // it so that whatever writes it back can draw it where it was.
      if (!host) return;
      carryChild(host.payload, hostScope, element, sourceId);
      if (sourceId !== undefined) carriedSourceIds.add(sourceId);
      const shape = sourceId === undefined ? undefined : shapes.get(sourceId);
      if (shape) {
        // Keyed by what it DRAWS, which is the carried element itself — the
        // only way a writer can pair the two back up.
        carryDi(host.payload, sourceId ?? hostScope, fragmentOf(shape.element));
      }
      return;
    }

    claim(sourceId, local);
    if (sourceId !== undefined) {
      mappedSourceIds.add(sourceId);
      drawnSourceIds.add(sourceId);
    }
    const payload: ForeignInterchange = {};
    if (sourceId !== undefined) payload.id = sourceId;
    const shape = sourceId === undefined ? undefined : shapes.get(sourceId);
    const bounds = shape?.bounds ?? null;

    sortAttributes(element, payload, BPMN_SCOPE.self, sourceId);
    sortShapeExtras(shape?.element, payload, sourceId);

    // The label, from wherever this kind keeps it: an annotation's is a child
    // element, a group's is the value of the category it points at, everything
    // else's is its own `name`.
    let text = attrOf(element, 'name') ?? '';
    if (local === 'textAnnotation') {
      text = modelChild(element, 'text')?.textContent?.trim() ?? '';
    } else if (local === 'group') {
      const ref = attrOf(element, 'categoryValueRef');
      text = (ref !== undefined ? categoryValues.get(ref) : undefined) ?? '';
    }

    // D5 case 2: an activity the DIAGRAM says is expanded holds a flow drawn
    // inside it, and the pack draws the collapsed form only.
    const expanded =
      shape !== undefined && attrOf(shape.element, 'isExpanded') === 'true';

    for (const child of childrenOf(element)) {
      // The trigger IS the kind — in either of its two forms — and the
      // annotation's text IS the label: children that were read, not carried.
      if (child === trigger || child === triggerRef) continue;
      if (
        isModel(child) &&
        local === 'textAnnotation' &&
        child.localName === 'text'
      ) {
        continue;
      }
      if (expanded && isModel(child) && !NOT_A_BODY.has(child.localName)) {
        quarantine(
          payload,
          fragmentOf(child),
          BPMN_QUARANTINE_REASON.expanded,
          { sourceId, element: child.nodeName }
        );
        const inner = attrOf(child, 'id');
        const innerShape = inner === undefined ? undefined : shapes.get(inner);
        if (innerShape) {
          payload.quarantined = [
            ...(payload.quarantined ?? []),
            {
              fragment: fragmentOf(innerShape.element),
              reason: BPMN_QUARANTINE_REASON.expanded,
            },
          ];
        }
        continue;
      }
      carryChild(payload, BPMN_SCOPE.self, child, sourceId);
    }

    const size = NODE_SIZE[kind];
    drafts.push({
      props: bpmnNodeProps(kind, {
        xywh: (bounds
          ? new Bound(bounds.x, bounds.y, bounds.w, bounds.h)
          : new Bound(0, 0, size.w, size.h)
        ).serialize(),
        text: text || undefined,
      }),
      payload,
      order: shape?.index ?? Number.POSITIVE_INFINITY,
      kind: 'node',
      ...(bounds ? {} : { needsLayout: size }),
    });

    if (sourceId !== undefined && bounds) nodeBounds.set(sourceId, bounds);
    if (!bounds) {
      note({
        kind: 'invented-layout',
        sourceId,
        element: local,
        message:
          `<${local}> arrived with no diagram, so Labre placed it beside the ` +
          `drawing. Its position is Labre's and not the file's.`,
      });
    }
  };

  /**
   * The edges, held back until every node of the document has been read.
   *
   * A flow may name an end declared further down the file, so whether both of
   * its ends were MAPPED is not knowable while the walk is still going. It has
   * to be knowable: a flow onto a carried node — a boundary event's error path,
   * which is the commonest Analytic construct there is — must not become a
   * connector with a dead end, drawn on the canvas, attached to nothing and
   * dropped by the next export. See {@link readEdges}.
   */
  const pendingEdges: {
    element: Element;
    host: Draft | undefined;
    hostScope: string;
  }[] = [];

  /** `true` when this element WAS an edge, whatever became of it. */
  const collectEdge = (
    element: Element,
    host: Draft | undefined,
    hostScope: string
  ): boolean => {
    if (EDGE_ROLE_OF_ELEMENT[element.localName] === undefined) return false;
    pendingEdges.push({ element, host, hostScope });
    return true;
  };

  /** Every flow, once the whole document is known. */
  const readEdges = () => {
    for (const { element, host, hostScope } of pendingEdges) {
      const local = element.localName;
      const role = EDGE_ROLE_OF_ELEMENT[local];
      const sourceId = attrOf(element, 'id');
      const from = attrOf(element, 'sourceRef');
      const to = attrOf(element, 'targetRef');

      if (!from || !to) {
        note({
          kind: 'warning',
          sourceId,
          element: local,
          message:
            `<${local}> names only one of its two ends, so there is no arrow ` +
            `to draw between them. It was left out.`,
        });
        continue;
      }

      // An end on something Labre did not draw. Carried whole, beside the node
      // it points at and under the same scope, so the pair travels together and
      // re-emits together — never a live connector with a dead end, which would
      // be the fourth state D1 says does not exist.
      const dangling = [from, to].filter(end => !mappedSourceIds.has(end));
      if (dangling.length > 0) {
        if (!host) continue;
        carryChild(host.payload, hostScope, element, sourceId, false);
        if (sourceId !== undefined) carriedSourceIds.add(sourceId);
        const edgeDi =
          sourceId === undefined ? undefined : diEdges.get(sourceId);
        if (edgeDi) {
          carryDi(
            host.payload,
            sourceId ?? hostScope,
            fragmentOf(edgeDi.element)
          );
        }
        note({
          kind: 'warning',
          sourceId,
          element: local,
          message:
            `<${local}> runs to ${dangling.map(end => `"${end}"`).join(' and ')}, ` +
            `which ${dangling.length === 1 ? 'is' : 'are'} not drawn on this ` +
            `canvas. The flow is kept whole beside ` +
            `${dangling.length === 1 ? 'it' : 'them'} rather than drawn with a ` +
            `loose end.`,
        });
        continue;
      }

      claim(sourceId, local);
      if (sourceId !== undefined) drawnSourceIds.add(sourceId);
      const payload: ForeignInterchange = {};
      if (sourceId !== undefined) payload.id = sourceId;
      sortAttributes(element, payload, BPMN_SCOPE.self, sourceId);
      // The exporter writes `associationDirection="None"` on every association
      // — the role is declared without a direction — so only another value is
      // something the model does not hold.
      const direction = attrOf(element, 'associationDirection');
      if (
        local === 'association' &&
        direction !== undefined &&
        direction !== 'None'
      ) {
        carryAttr(payload, BPMN_SCOPE.self, 'associationDirection', direction);
      }
      for (const child of childrenOf(element)) {
        carryChild(payload, BPMN_SCOPE.self, child, sourceId);
      }
      const di = sourceId === undefined ? undefined : diEdges.get(sourceId);
      sortShapeExtras(di?.element, payload, sourceId);
      if (di && di.waypoints > 2) explicitRoutes++;

      const name = attrOf(element, 'name');
      drafts.push({
        props: {
          ...connectorProps(role),
          // The SOURCE FILE's ids — the caller remaps them onto the ones the
          // surface minted. See the module comment.
          source: { id: from, position: [0.5, 0.5] },
          target: { id: to, position: [0.5, 0.5] },
          ...(name ? { text: name } : {}),
        },
        payload,
        order: di?.index ?? Number.POSITIVE_INFINITY,
        kind: 'edge',
      });
    }
  };

  /* ── Walking the document ──────────────────────────────────────────── */

  for (const collaboration of collaborations) {
    const host = residence();
    const scope = BPMN_SCOPE.collaboration;
    if (host) {
      sortAttributes(
        collaboration,
        host.payload,
        scope,
        attrOf(collaboration, 'id')
      );
    }
    for (const child of childrenOf(collaboration)) {
      if (child.localName === 'participant' && isModel(child)) continue;
      if (isModel(child) && collectEdge(child, host, scope)) continue;
      if (isModel(child)) {
        readNode(child, host, scope);
        continue;
      }
      if (host) {
        carryChild(host.payload, scope, child, attrOf(collaboration, 'id'));
      }
    }
  }

  for (const process of processes) {
    const pool = poolOfProcess.get(process);
    const host = pool ?? residence();
    // `@self` when the pool IS this process (a file with no participant),
    // `@process` when the pool is a participant standing in front of it.
    const scope =
      pool && pool === mintedPool ? BPMN_SCOPE.self : BPMN_SCOPE.process;
    for (const child of childrenOf(process)) {
      if (child.localName === 'laneSet' && isModel(child)) continue;
      if (isModel(child) && collectEdge(child, host, scope)) continue;
      if (isModel(child)) {
        readNode(child, host, scope);
        continue;
      }
      if (host) carryChild(host.payload, scope, child, attrOf(process, 'id'));
    }
  }

  readEdges();

  /* ── The document's own residue (D6) ───────────────────────────────── */

  const host = residence();
  const residue: Element[] = [];
  for (const root of childrenOf(definitions)) {
    if (root.namespaceURI === BPMN_NS.bpmndi) continue;
    if (
      isModel(root) &&
      ['collaboration', 'process', 'category'].includes(root.localName)
    ) {
      continue;
    }
    residue.push(root);
  }

  if (host) {
    // `definitions`' own foreign attributes, and every namespace declaration
    // that is not one of the four this library writes: a carried `camunda:`
    // fragment means nothing without the declaration it was written under.
    for (const attr of Array.from(definitions.attributes)) {
      if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) {
        if (!OWN_NAMESPACES.has(attr.value)) {
          carryAttr(
            host.payload,
            BPMN_SCOPE.definitions,
            attr.name,
            attr.value
          );
        }
        continue;
      }
      if (READ_ATTRS.definitions.includes(attr.name)) continue;
      carryAttr(host.payload, BPMN_SCOPE.definitions, attr.name, attr.value);
    }

    for (const root of residue) {
      // D5 case 4: §15.3.1 wants the file set self-contained and v1 reads one
      // file, so writing an `<import>` back would claim a resolution we never
      // made.
      if (isModel(root) && root.localName === 'import') {
        quarantine(
          host.payload,
          fragmentOf(root),
          BPMN_QUARANTINE_REASON.imported,
          { element: 'import' }
        );
        continue;
      }
      // Not quarantine: the file telling us our reading of it may be wrong,
      // which is a thing to say out loud and not a thing to withhold.
      if (
        isModel(root) &&
        root.localName === 'extension' &&
        attrOf(root, 'mustUnderstand') === 'true'
      ) {
        note({
          kind: 'warning',
          element: 'extension',
          message:
            `The file declares an extension that it says MUST be understood to ` +
            `read the model correctly. Labre does not understand it: the import ` +
            `went ahead, and this reading of the process may be wrong.`,
        });
      }
      carryChild(
        host.payload,
        BPMN_SCOPE.definitions,
        root,
        attrOf(definitions, 'id')
      );
    }

    // A `BPMNShape` or `BPMNEdge` that draws an element the file never
    // declares. It is broken in the source — nothing can resolve it — but it is
    // still a node of the file, and D1 has no state for "quietly forgotten":
    // kept under the id it names, and named in the report so a reader can go
    // and look.
    for (const [target, shape] of [
      ...[...shapes].map(([id, entry]) => [id, entry.element] as const),
      ...[...diEdges].map(([id, entry]) => [id, entry.element] as const),
    ]) {
      if (drawnSourceIds.has(target) || carriedSourceIds.has(target)) continue;
      carryDi(host.payload, target, fragmentOf(shape));
      note({
        kind: 'warning',
        sourceId: target,
        element: shape.localName,
        message:
          `The diagram draws "${target}", which the file does not declare. ` +
          `The shape is kept, and nothing is drawn for it.`,
      });
    }
  } else if (residue.length > 0) {
    // Nothing was drawn, so there is nothing for the residue to ride on. Said
    // rather than swallowed: D2's carrier is an element, and a file with no
    // process and no participant has none.
    note({
      kind: 'warning',
      message:
        `This file declares ${residue.length} root ` +
        `${residue.length === 1 ? 'element' : 'elements'} and no process to ` +
        `draw, so there was no artefact for ` +
        `${residue.length === 1 ? 'it' : 'them'} to be kept on. Nothing was ` +
        `imported.`,
    });
  }

  /* ── Lane membership: checked against the drawing, never stored (D3) ─ */

  for (const bands of laneBands.values()) {
    if (!bands.every(band => band.rect !== null)) continue;
    for (const band of bands) {
      for (const ref of band.refs) {
        const box = nodeBounds.get(ref);
        if (!box) continue;
        const centre = box.y + box.h / 2;
        const drawnIn = bands.find(
          candidate =>
            candidate.rect !== null &&
            centre >= candidate.rect.y &&
            centre <= candidate.rect.y + candidate.rect.h
        );
        if (!drawnIn || drawnIn === band) continue;
        note({
          kind: 'warning',
          sourceId: ref,
          element: 'flowNodeRef',
          message:
            `The file lists this artefact in the lane "${band.lane.name}" and ` +
            `draws it in "${drawnIn.lane.name}". Labre reads the drawing: a ` +
            `lane holds what is drawn inside it.`,
        });
      }
    }
  }

  /* ── What the file did not place (D4) ──────────────────────────────── */

  layOutTheUndrawn(drafts, mintedPool);

  if (explicitRoutes > 0) {
    note({
      kind: 'invented-layout',
      message:
        `${explicitRoutes} ${explicitRoutes === 1 ? 'flow carries' : 'flows carry'} ` +
        `an explicit routing in the file. Labre routes a flow between its two ` +
        `ends and re-routes it whenever they move, so ` +
        `${explicitRoutes === 1 ? 'its bend points are' : 'their bend points are'} ` +
        `not kept.`,
    });
  }

  /* ── Out ───────────────────────────────────────────────────────────── */

  // The DRAWING's order is the board's order: the exporter writes its shapes in
  // document order, so reading them back in plane order is what lets an export
  // after an import land on the bytes of the export before it. Anything undrawn
  // keeps its document order, after everything drawn.
  const ordered = drafts
    .map((draft, index) => ({ draft, index }))
    .sort((a, b) =>
      a.draft.order === b.draft.order
        ? a.index - b.index
        : a.draft.order - b.draft.order
    )
    .map(entry => entry.draft);

  const elements = ordered.map(draft => {
    const payload = draft.payload;
    const empty =
      payload.id === undefined &&
      payload.element === undefined &&
      payload.attrs === undefined &&
      payload.children === undefined &&
      payload.di === undefined &&
      payload.quarantined === undefined;
    // Written as ONE whole blob, or not written at all: the Y.Map entry is the
    // entire record, so a partial update is a last-write-wins overwrite of
    // everything, and an element that carried nothing must keep no key (D2).
    return empty
      ? draft.props
      : { ...draft.props, interchange: { [BPMN_FORMAT_ID]: payload } };
  });

  const lanes = ordered.reduce(
    (total, draft) =>
      total + (Array.isArray(draft.props.lanes) ? draft.props.lanes.length : 0),
    0
  );

  const sourceVersion = sourceVersionOf(definitions);
  return {
    elements,
    report: {
      // Everything that became a drawn, editable artefact: the pools, the flow
      // objects, the arrows — and the LANES, which are drawn and editable and
      // are not elements of their own.
      mapped: ordered.length + lanes,
      carried,
      quarantined,
      notes,
      ...(sourceVersion !== undefined ? { sourceVersion } : {}),
    },
  };
}
