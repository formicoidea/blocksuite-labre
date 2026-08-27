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
  children: XmlElement[];
  /** Text content. Mutually exclusive with `children` in practice. */
  text?: string;
}

const el = (
  name: string,
  attrs: Attrs = {},
  children: XmlElement[] = []
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
function escapeText(value: string): string {
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
function escapeAttr(value: string): string {
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

function serializeElement(node: XmlElement, indent: string): string {
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

/**
 * Mints document-unique NCNames, and remembers what it minted.
 *
 * Uniqueness is settled by a counting suffix rather than by a hash: `Task_x`
 * and `Task_x_2` are both readable in bpmn.io's properties panel, which is
 * where a human will actually meet them during the recette.
 */
class IdMinter {
  readonly #taken = new Set<string>();

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
  const minter = new IdMinter();
  const pools = board.pools;

  /* ── Processes and participants ──────────────────────────────────── */

  const processes: PlannedProcess[] = pools.map(pool => {
    const participantId = minter.mint('Participant', pool.id);
    const id = minter.mint('Process', pool.id);
    // The bands the pool actually PAINTS, not the raw prop — see
    // `poolLaneBands`. Ids go through the same minter as everything else: `id`
    // is document-unique across the WHOLE file, so a lane cannot quietly take
    // the NCName a task already has.
    const lanes = poolLaneBands(pool).map(band => ({
      ...band,
      id: minter.mint('Lane', band.lane.id),
    }));
    return {
      pool,
      id,
      participantId,
      name: labelOf(pool.name),
      laneSetId: lanes.length > 0 ? minter.mint('LaneSet', pool.id) : undefined,
      lanes,
    };
  });

  const hasCollaboration = pools.length > 0;

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
  let orphanProcess = -1;
  const orphanProcessIndex = () => {
    if (orphanProcess < 0) {
      orphanProcess = processes.length;
      processes.push({
        pool: null,
        id: minter.mint('Process', hasCollaboration ? 'unassigned' : 'board'),
        name: '',
        lanes: [],
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
      id: minter.mint('', model.id),
      name,
      bound,
      scope,
      lane: pool ? bpmnLaneOf(pool, bound) : null,
    };

    // A data object needs the `dataObject` its reference points at, and a
    // labelled group needs somewhere for its label to live.
    if (model.kind === 'dataObject') {
      node.dataObjectId = minter.mint('DataObject', model.id);
    }
    if (model.kind === 'group' && name) {
      node.categoryId = minter.mint('Category', model.id);
      node.categoryValueId = minter.mint('CategoryValue', model.id);
    }

    planned.push(node);
    byModelId.set(model.id, node);
  }

  /* ── Edges ───────────────────────────────────────────────────────── */

  const edges: PlannedEdge[] = [];

  for (const connector of board.connectors) {
    const element = EDGE_ELEMENT[String(connector.role ?? '')];
    // A NEUTRAL connector states nothing (`docs/adr/0010`): not a flow.
    if (!element) continue;

    const ends = endsOf(connector);
    if (!ends) continue;

    const source = byModelId.get(ends.source);
    const target = byModelId.get(ends.target);
    // An end attached to something that is not a BPMN artefact — a sticky note,
    // a plain rectangle — has no id in this document to point at.
    if (!source || !target) continue;

    // A message flow belongs to the collaboration, and there is no
    // collaboration without a pool. On a poolless board it has nowhere in the
    // interchange format to go, so it is dropped rather than demoted to a
    // sequence flow, which would say something else entirely.
    if (element === 'messageFlow' && !hasCollaboration) continue;

    edges.push({
      model: connector,
      element,
      id: minter.mint('Flow', connector.id),
      name: labelOf(connector.text),
      source,
      target,
      scope: edgeScope(element, source, target, {
        hasCollaboration,
        orphanProcessIndex,
      }),
      waypoints: waypointsOf(connector, source, target),
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

  /* ── The semantic half ───────────────────────────────────────────── */

  const roots: XmlElement[] = [];

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
    const children: XmlElement[] = [];
    // `participant*` strictly before `messageFlow*` (tCollaboration's sequence).
    for (const process of processes) {
      if (!process.participantId) continue;
      children.push(
        el('bpmn:participant', {
          id: process.participantId,
          name: process.name || undefined,
          processRef: process.id,
        })
      );
    }
    for (const edge of edges) {
      if (edge.element !== 'messageFlow') continue;
      children.push(
        el('bpmn:messageFlow', {
          id: edge.id,
          name: edge.name || undefined,
          sourceRef: edge.source.id,
          targetRef: edge.target.id,
        })
      );
    }
    // `artifact*` last, and only what fell outside every pool: an annotation
    // drawn ON a pool is that process's, and belongs with the work it is about.
    children.push(...artifacts(COLLABORATION, planned, edges));
    roots.push(
      el(
        'bpmn:collaboration',
        { id: collaborationId, name: options.name || undefined },
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
        },
        processChildren(index, process, planned, edges)
      )
    );
  }

  /* ── The DI half ─────────────────────────────────────────────────── */

  const planeElements: XmlElement[] = [];

  for (const process of processes) {
    if (!process.pool || !process.participantId) continue;
    const bound = process.pool.elementBound;
    planeElements.push(
      el(
        'bpmndi:BPMNShape',
        {
          id: minter.mint('Shape', process.pool.id),
          bpmnElement: process.participantId,
          // `isHorizontal` is meaningful on pools and lanes ONLY (§12.3.2), and
          // a pool here always runs left to right: the plot is cut into
          // horizontal bands, which is what a horizontal pool means.
          isHorizontal: 'true',
        },
        [el('dc:Bounds', boundsAttrs(bound, dx, dy))]
      )
    );

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
            id: minter.mint('Shape', `lane-${lane.lane.id}`),
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
      id: minter.mint('Shape', node.model.id),
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
    planeElements.push(
      el('bpmndi:BPMNShape', attrs, [
        el('dc:Bounds', boundsAttrs(node.bound, dx, dy)),
      ])
    );
  }

  for (const edge of edges) {
    planeElements.push(
      el(
        'bpmndi:BPMNEdge',
        { id: minter.mint('Edge', edge.model.id), bpmnElement: edge.id },
        edge.waypoints.map(([x, y]) =>
          el('di:waypoint', { x: num(x + dx), y: num(y + dy) })
        )
      )
    );
  }

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
    },
    // `rootElement*` strictly before `BPMNDiagram*` (tDefinitions' sequence).
    [...roots, diagram]
  );

  return `<?xml version="1.0" encoding="UTF-8"?>\n${serializeElement(definitions, '')}\n`;
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
  edges: readonly PlannedEdge[]
): XmlElement[] {
  const mine = planned.filter(node => node.scope === index);
  const children: XmlElement[] = [];

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
        { id: process.laneSetId },
        process.lanes.map(band =>
          el(
            'bpmn:lane',
            { id: band.id, name: band.lane.name || undefined },
            mine
              .filter(
                node =>
                  node.mapping.slot === 'flowNode' &&
                  node.lane?.id === band.lane.id
              )
              // `flowNodeRef` is an ELEMENT whose text is the IDREF, never an
              // attribute — the one place in the format where a reference is
              // spelled that way.
              .map(node => textEl('bpmn:flowNodeRef', node.id))
          )
        )
      )
    );
  }

  /* flowElement* — the flow nodes, the data references, the sequence flows. */
  for (const node of mine) {
    if (node.mapping.slot === 'artifact') continue;
    children.push(semanticNode(node));
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
    children.push(
      el('bpmn:sequenceFlow', {
        id: edge.id,
        name: edge.name || undefined,
        sourceRef: edge.source.id,
        targetRef: edge.target.id,
      })
    );
  }

  /* artifact* — annotations, groups, associations. Last, per the XSD. */
  children.push(...artifacts(index, planned, edges));

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
  edges: readonly PlannedEdge[]
): XmlElement[] {
  const out: XmlElement[] = [];

  for (const node of planned) {
    if (node.scope !== scope || node.mapping.slot !== 'artifact') continue;
    out.push(semanticNode(node));
  }
  for (const edge of edges) {
    if (edge.scope !== scope || edge.element !== 'association') continue;
    out.push(
      el('bpmn:association', {
        id: edge.id,
        sourceRef: edge.source.id,
        targetRef: edge.target.id,
        // The role is declared WITHOUT a direction and this is where that shows
        // up in the file: "this note is about that task" reads the same from
        // either end, so the association claims none.
        associationDirection: 'None',
      })
    );
  }

  return out;
}

/** One artefact, as its semantic element (plus whatever it drags along). */
function semanticNode(node: PlannedNode): XmlElement {
  const { mapping, name } = node;

  if (mapping.element === 'textAnnotation') {
    return el(
      'bpmn:textAnnotation',
      { id: node.id, textFormat: 'text/plain' },
      [textEl('bpmn:text', name)]
    );
  }

  if (mapping.element === 'group') {
    // No `name` attribute exists on `group` — the label is the categoryValue's.
    return el('bpmn:group', {
      id: node.id,
      categoryValueRef: node.categoryValueId,
    });
  }

  if (mapping.element === 'dataObjectReference') {
    return el('bpmn:dataObjectReference', {
      id: node.id,
      name: name || undefined,
      dataObjectRef: node.dataObjectId,
    });
  }

  const attrs: Attrs = { id: node.id, name: name || undefined };
  const children: XmlElement[] = [];
  if (mapping.eventDefinition) {
    // Last child of the event, which is where `tCatchEvent` / `tThrowEvent` put
    // it. No child of its own is required: a `timerEventDefinition` with no
    // `timeDate` is valid, and the pack does not ask the author for one.
    children.push(el(`bpmn:${mapping.eventDefinition}`, {}));
  }
  return el(`bpmn:${mapping.element}`, attrs, children);
}
