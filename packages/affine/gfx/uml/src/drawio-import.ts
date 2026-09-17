import type { InterchangeNote } from '@labre/affine-block-surface';
import type { UmlDiagramKind, UmlFragmentOperator } from '@labre/affine-model';
import { UML_DIAGRAM_KIND_TAG } from '@labre/affine-model';

import type { UmlBox } from './component.js';
import { UML_NODE_BOX } from './consts.js';
import {
  parseEndLabel,
  parseLifelineIdent,
  parseOperation,
  parseProperty,
} from './grammar.js';
import { umlSequenceSlot } from './import.js';
import { stereotypesOf } from './keywords.js';
import { ADORNED_RELATION_KINDS, umlLifelineAt } from './model.js';
import type {
  UmlClassifier,
  UmlCombinedFragment,
  UmlDestruction,
  UmlExecution,
  UmlInteraction,
  UmlLifeline,
  UmlMessage,
  UmlMessageKind,
  UmlModel,
  UmlNodeBase,
  UmlNote,
  UmlPackageNode,
  UmlRelation,
  UmlRelationKind,
} from './model.js';
import {
  decodeXmlText,
  readXml,
  type XmlNode,
  xmlDescendants,
} from './xml-reader.js';

/**
 * A draw.io drawing, read as a UML model — the **visual** tier of
 * `docs/adr/0012` (see `docs/adr/0019`).
 *
 * ## Why this reader is `visual` where the other two are `semantic`
 *
 * A `.drawio` file carries no UML metamodel. What it carries is a list of
 * boxes, each with a `style` string and a blob of HTML, so "this box is a
 * Class" is a GUESS made out of `<hr />` separators and `endArrow=block`. It is
 * a good guess — every UML shape library in draw.io writes the same handful of
 * style tokens, and the corpus this was written against is draw.io's own UML
 * class example — but it is a guess, and ADR 0012 P2 is explicit that the tier
 * is a promise made to the user BEFORE the file is read. So: no round-trip
 * promise, and anything this reader does not recognise becomes a `carried` note
 * naming the cell and the style that defeated it. Nothing here throws and
 * nothing is dropped in silence.
 *
 * ## Decoded XML in, and nothing else (ADR 0019, the compressed-payload split)
 *
 * A `.drawio` file's `<diagram>` usually holds base64 of a raw-deflate of
 * URI-encoded XML. Inflating it needs `DecompressionStream` — a platform API,
 * and asynchronous — so it is NOT done here. This function is pure and
 * synchronous per P3, which is what makes it callable from labre-mcp and
 * testable with neither an editor nor a browser; the COMMAND decodes first
 * (`drawio-decode.ts`, `actions.ts`). What arrives here is either a plain
 * `<mxGraphModel>` or an `<mxfile>` whose `<diagram>` already holds one, and a
 * payload that is still compressed comes back as an empty model carrying one
 * `warning` note rather than as an exception. {@link isCompressedDrawio} is the
 * same test, exported so the capability can say so before it reads.
 *
 * ## The XML comes off the shared reader
 *
 * `DOMParser` is a DOM API and a pure function has no DOM, so the tree comes
 * from `xml-reader.ts` — the same tolerant reader the XMI importer walks. One
 * reader for the two XML formats this framework reads means one set of
 * entity-decoding bugs rather than two.
 */

/* ── What a reading gives back ────────────────────────────────────────── */

/**
 * Where the source drew every cell, in MODEL units, relative to the drawing's
 * own top-left corner.
 *
 * One draw.io unit is one model unit — both are CSS-pixel-shaped, and both
 * frameworks draw a class box at a couple of hundred of them — so the only
 * transform is a TRANSLATION: the minimum corner of the drawing becomes
 * `(0, 0)` here, and the materializer adds the frame's plot origin and its own
 * margin. That way round keeps this function free of the one number it cannot
 * know (where the frame will land) and the materializer free of the one it
 * cannot know (how far from the origin somebody had dragged their diagram).
 *
 * Keyed by the SOURCE cell id, which is the id every element also carries under
 * `interchange.drawio.id` (`docs/adr/0012` D3) — so a box is resolved the same
 * way a connector end is.
 */
export interface UmlDrawioLayout {
  boxes: Record<string, UmlBox>;
}

/** What {@link importDrawio} read: the model, the remarks, and the geometry. */
export interface UmlDrawioImport {
  model: UmlModel;
  notes: InterchangeNote[];
  layout: UmlDrawioLayout;
}

/** The format id foreign draw.io matter rides under (`docs/adr/0012` D2). */
export const UML_DRAWIO_FORMAT_ID = 'drawio';

/* ── The compressed half a pure function cannot read ──────────────────── */

/**
 * Whether this text is an `<mxfile>` whose payload still needs inflating.
 *
 * The test is the honest one — "there is a `<diagram>` and no `<mxGraphModel>`
 * anywhere in it" — rather than a guess at what base64 looks like: draw.io
 * writes the uncompressed form under the very same element (File › Properties ›
 * Compressed: off), and a reader that refused those would refuse half the files
 * in the wild for the sake of a heuristic.
 */
export function isCompressedDrawio(text: string): boolean {
  return !text.includes('<mxGraphModel') && text.includes('<diagram');
}

/* ── Styles ───────────────────────────────────────────────────────────── */

type MxStyle = Record<string, string>;

/**
 * A draw.io style string as a lookup.
 *
 * `shadow=0;fillColor=#FFF2CC;html=1;` is a map; `swimlane;childLayout=…` opens
 * with a bare shape NAME, which is stored as a key with an empty value so that
 * `'swimlane' in style` and `style.shape === 'umlactor'` are the same kind of
 * question. Keys AND values are lower-cased: draw.io is inconsistent about case
 * in hand-edited styles, every token this reader tests for is an identifier
 * rather than a label, and nobody should have to know which spelling a
 * particular shape library used.
 */
function parseStyle(raw: string | undefined): MxStyle {
  const style: MxStyle = {};
  for (const part of (raw ?? '').split(';')) {
    const token = part.trim();
    if (!token) continue;
    const eq = token.indexOf('=');
    if (eq < 0) style[token.toLowerCase()] = '';
    else {
      style[token.slice(0, eq).trim().toLowerCase()] = token
        .slice(eq + 1)
        .trim()
        .toLowerCase();
    }
  }
  return style;
}

/* ── The label HTML ───────────────────────────────────────────────────── */

const HR = /<hr\s*\/?>/i;
const LINE_BREAK = /<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/tr>/gi;
const TAGS = /<[^>]*>/g;
/**
 * Annex C's ASCII guillemets, rescued before the markup strip runs.
 *
 * `<<use>>` survives the XML attribute as those six characters, and the next
 * line would read `<use>` as a tag and throw the keyword away — which is how a
 * `«use»` dependency silently became an association. Rewriting the pair into
 * the real guillemets first is the fix and also the right normalisation:
 * `stereotypesOf` reads both spellings, and this leaves exactly one of them in
 * the string the tag strip then walks.
 */
const ASCII_GUILLEMETS = /<<([^<>]{0,64})>>/g;
/** The one entity `decodeXmlText` leaves standing that a LABEL routinely has. */
const NBSP = /&nbsp;/gi;

/**
 * A cell's `value` as COMPARTMENTS of lines — draw.io's UML class template,
 * read.
 *
 * The template is `<p>Name</p><hr />attributes<hr />operations`, each member
 * separated by `<br />`, and the whole of it HTML-escaped inside the `value`
 * attribute. So: split on the rules, turn every block boundary into a newline,
 * drop what is left of the markup, and decode what the markup was hiding.
 *
 * The second decode pass, after the tags come off, is deliberate rather than
 * belt-and-braces: draw.io escapes the HTML into an XML attribute, so a `<` the
 * author typed in a label is `&amp;lt;` in the file and one pass would leave
 * them looking at `&lt;`.
 *
 * Blank lines and §9.2.4's elision marker are dropped, exactly as
 * `parseCompartment` drops them for a compartment the author typed on the
 * canvas: a file that wrote `...` back as a property named `...` would turn
 * "there are more features, not shown" into "one of them is called dot dot
 * dot".
 */
export function drawioCompartments(value: string | undefined): string[][] {
  const raw = value ?? '';
  if (!raw.trim()) return [];
  return raw
    .split(HR)
    .map(part =>
      decodeXmlText(
        part
          .replaceAll(LINE_BREAK, '\n')
          .replaceAll(ASCII_GUILLEMETS, '«$1»')
          .replaceAll(TAGS, '')
          .replaceAll(NBSP, ' ')
      )
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && line !== '...' && line !== '…')
    )
    .filter(lines => lines.length > 0);
}

/* ── What a vertex IS ─────────────────────────────────────────────────── */

type UmlDrawioVertexKind =
  | 'classifier'
  | 'actor'
  | 'use-case'
  | 'note'
  | 'package'
  // §17's three, recognised off draw.io's own UML stencil (ADR 0019: this is
  // the visual tier, and a style string is all there is to read).
  | 'lifeline'
  | 'execution'
  | 'destruction'
  | 'fragment'
  | 'unknown';

/**
 * §17.6.4's operators, as draw.io writes them in a frame's label — `<<alt>>`,
 * `alt`, `alt [x > 0]`.
 *
 * What separates a combined fragment from a plain `shape=umlFrame`, which
 * draw.io also uses for a package and for a diagram frame: the first word of the
 * label is one of the operators, and nothing else in the style says so.
 */
const DRAWIO_FRAGMENT_OPERATORS = new Set<string>([
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
  'ref',
]);

/** The operator a frame's label opens with, and the guard after it. */
function drawioFragmentLabel(
  value: string
): { operator: UmlFragmentOperator; guard: string } | undefined {
  const text = drawioCompartments(value).flat().join(' ').trim();
  const opened = /^(?:«|<<)?\s*([A-Za-z]+)\s*(?:»|>>)?\s*(.*)$/.exec(text);
  if (!opened) return undefined;
  const word = opened[1].toLowerCase();
  if (!DRAWIO_FRAGMENT_OPERATORS.has(word)) return undefined;
  const tail = opened[2].trim();
  const bracketed = /^\[(.*)\]$/.exec(tail);
  return {
    operator: word as UmlFragmentOperator,
    guard: (bracketed ? bracketed[1] : tail).trim(),
  };
}

/**
 * The shape vocabulary, read off the style — the whole of this reader's
 * heuristics, in one function, so ADR 0019's "what it guesses and how"
 * paragraph has exactly one place to be true about.
 *
 * The order is load-bearing. The explicit UML shapes win over the geometric
 * ones (`shape=umlActor` is drawn inside a rectangle; a note may also be an
 * ellipse in somebody's stencil), and the CLASSIFIER test is last because it is
 * the weakest: a box with compartments, a stack-laid swimlane with member rows,
 * or a box whose first line carries an Annex C keyword.
 */
function vertexKindOf(
  style: MxStyle,
  compartments: string[][],
  hasChildren: boolean,
  site: { value: string; onLifeline: boolean; width: number } = {
    value: '',
    onLifeline: false,
    width: 0,
  }
): UmlDrawioVertexKind {
  const shape = style.shape ?? '';
  // §17's stencil first, and `umlLifeline` before everything: draw.io draws a
  // lifeline as a container, so a reader that tested for a swimlane or for
  // compartments first would call the participant a class.
  if (shape === 'umllifeline' || 'umllifeline' in style) return 'lifeline';
  if (shape === 'umldestroy' || 'umldestroy' in style) return 'destruction';
  if (shape === 'umlactor' || 'umlactor' in style) return 'actor';
  if (shape === 'note' || 'note' in style) return 'note';
  if (shape === 'folder' || shape === 'package' || shape === 'umlframe') {
    // §17.6.4's rectangle and §12.2.4's folder are the same `umlFrame` in this
    // stencil; the operator written in the corner is the only thing that tells
    // them apart, which is exactly what §17.6.4 says the pentagon is for.
    return shape === 'umlframe' && drawioFragmentLabel(site.value)
      ? 'fragment'
      : 'package';
  }
  // §17.2.4's bar: a narrow rectangle drawn ON a lifeline. draw.io gives it no
  // shape of its own — it is a plain box parented to the participant — so the
  // reading is the one the notation gives: where it is, and how wide.
  if (site.onLifeline && site.width > 0 && site.width <= 24) return 'execution';
  if ('ellipse' in style || shape === 'ellipse') return 'use-case';
  if (
    'swimlane' in style &&
    style.childlayout === 'stacklayout' &&
    hasChildren
  ) {
    return 'classifier';
  }
  if (compartments.length > 1) return 'classifier';
  if (compartments.length === 1) {
    const { keywords } = stereotypesOf(compartments[0].join('\n'));
    if (keywords.length > 0) return 'classifier';
  }
  return 'unknown';
}

/** `«interface»` and `«enumeration»`, however the author spelled them. */
function classifierKindOf(keywords: string[]): UmlClassifier['kind'] {
  const labels = keywords.map(keyword => keyword.trim().toLowerCase());
  if (labels.includes('interface')) return 'interface';
  if (labels.includes('enumeration') || labels.includes('enum')) {
    return 'enumeration';
  }
  return 'class';
}

/* ── What an edge IS ──────────────────────────────────────────────────── */

/**
 * The relationship an edge's arrow ends state.
 *
 * Read in the order a UML reader's eye reads them, and the order matters twice:
 *
 *  - the DIAMOND first, because draw.io's own aggregation style carries
 *    `dashed=1` as well (the corpus's `request` edge does) and a dependency
 *    test that ran first would call it a dependency;
 *  - then the block arrowhead, whatever its fill.
 *
 * ## `block` is the UML stencil's head; the fill is a drawing mistake
 *
 * The two ends read their fill differently, and the asymmetry is a fact about
 * draw.io rather than an inconsistency (lead's ruling of 15/09/2026, recorded
 * for the PO):
 *
 *  - a DIAMOND means one of two UML relationships and the fill says which, so
 *    it is READ — `startFill=0` is §11.5.4's shared aggregation, and anything
 *    else, an absent fill included, is the composite one, because mxGraph
 *    resolves `startFill` / `endFill` with a default of 1 and paints it solid;
 *  - a BLOCK head means one UML relationship whatever its fill. Ordinary
 *    draw.io arrows are `classic` or `open`; `block` is what the UML stencil
 *    writes, and it writes `endFill=0` with it. A file that drew `block` and
 *    left the fill alone — draw.io's own UML class template does exactly that —
 *    is a generalization somebody drew slightly wrong, not an association.
 *    Reading the fill here would demote the one arrow the author most clearly
 *    meant.
 *
 * So a solid line with a block head is §9.2.4's generalization and a dashed one
 * is §10.4.4's realization, and when the head is not hollow
 * {@link isAmbiguousBlockHead} lets the caller say so in a remark — the kind is
 * right, the DRAWING is not, and the author is the one who can fix it.
 *
 * Everything else is an association unless it is dashed, which is §7.8.4's
 * dependency; the `«use»`, `«include»` and `«extend»` labels then choose
 * between the three kinds that share the dashed-open notation. `«use»` is the
 * plain dependency and needs no branch — it is what falls through.
 */
function relationKindOf(style: MxStyle, keywords: string[]): UmlRelationKind {
  const labels = keywords.map(keyword => keyword.trim().toLowerCase());
  const dashed = style.dashed === '1';
  const startArrow = style.startarrow ?? '';
  const endArrow = style.endarrow ?? '';

  if (startArrow === 'diamond' || startArrow === 'diamondthin') {
    // Hollow is the SHARED aggregation; filled — and unspecified, which
    // mxGraph draws filled — is the composite one.
    return style.startfill === '0' ? 'aggregation' : 'composition';
  }
  if (endArrow === 'diamond' || endArrow === 'diamondthin') {
    // The whole is at the TARGET end; {@link importDrawio} flips the ends, so
    // the relation still records the whole as its source.
    return style.endfill === '0' ? 'aggregation' : 'composition';
  }
  if (endArrow === 'block' || endArrow === 'blockthin') {
    // Whatever the fill: `block` is the UML stencil's head, and a filled one is
    // a triangle drawn wrong rather than a different relationship. See the
    // header, and {@link isAmbiguousBlockHead} for what is said about it.
    return dashed ? 'realization' : 'generalization';
  }
  if (labels.includes('include')) return 'include';
  if (labels.includes('extend')) return 'extend';
  if (dashed) return 'dependency';
  return 'association';
}

/**
 * A block arrowhead drawn SOLID — read as the generalization it is, and
 * remarked on because the file does not draw one.
 *
 * `endArrow=block` with no `endFill=0` renders as a filled triangle, and UML
 * draws the generalization triangle hollow (§9.2.4). {@link relationKindOf}
 * takes the head at its word regardless — `block` is the UML stencil's, and the
 * alternative is demoting the one arrow whose meaning is least in doubt — so
 * nothing about the BOARD is wrong here. What is wrong is the drawing the file
 * came from, which is a thing only the author can fix and only if somebody
 * tells them. Hence a remark rather than a different reading.
 *
 * The same question at the source end has the opposite answer, and the header
 * says why: a diamond's fill picks between two UML relationships, so it is read.
 */
function isAmbiguousBlockHead(style: MxStyle): boolean {
  const endArrow = style.endarrow ?? '';
  return (
    (endArrow === 'block' || endArrow === 'blockthin') && style.endfill !== '0'
  );
}

/** An aggregation read off the TARGET end has its whole at the wrong end. */
function wholeIsTarget(style: MxStyle): boolean {
  const startArrow = style.startarrow ?? '';
  const endArrow = style.endarrow ?? '';
  return (
    startArrow !== 'diamond' &&
    startArrow !== 'diamondthin' &&
    (endArrow === 'diamond' || endArrow === 'diamondthin')
  );
}

/* ── Edge labels ──────────────────────────────────────────────────────── */

/** Which end of the edge a child label cell was pinned to (`mxGeometry@x`). */
type EdgeLabelEnd = 'source' | 'target' | 'centre';

/**
 * `x` on a relative geometry is a position ALONG the edge, from `-1` at the
 * source to `+1` at the target. draw.io writes exactly `-1` and `1` for the two
 * multiplicity slots and leaves a free-floating label near zero.
 */
function labelEndOf(geometry: XmlNode | undefined): EdgeLabelEnd {
  const x = Number.parseFloat(geometry?.attrs.x ?? '0');
  if (!Number.isFinite(x) || x === 0) return 'centre';
  return x < 0 ? 'source' : 'target';
}

/* ── The cells ────────────────────────────────────────────────────────── */

interface DrawioCell {
  id: string;
  value: string;
  style: MxStyle;
  rawStyle: string;
  parent: string;
  vertex: boolean;
  edge: boolean;
  source: string;
  target: string;
  geometry?: XmlNode;
}

/**
 * The `<mxCell>`s of a document, flattened, `<object>` wrappers folded in.
 *
 * `<object label="…" id="…"><mxCell …/></object>` is draw.io's spelling for a
 * cell with custom properties, and it is the common one the moment anybody
 * types into the Edit Data dialog. The identity and the label are the
 * WRAPPER's, the style and the geometry the inner cell's — so a reader that
 * walked `mxCell` alone would find a shape with no id and no name and carry the
 * whole drawing.
 */
function cellsOf(graph: XmlNode): DrawioCell[] {
  const wrapped = new Map<XmlNode, XmlNode>();
  for (const node of xmlDescendants(graph)) {
    if (node.local !== 'object' && node.local !== 'UserObject') continue;
    const inner = node.children.find(child => child.local === 'mxCell');
    if (inner) wrapped.set(inner, node);
  }

  return xmlDescendants(graph)
    .filter(node => node.local === 'mxCell')
    .map(node => {
      const wrapper = wrapped.get(node);
      const rawStyle = node.attrs.style ?? '';
      return {
        id: wrapper?.attrs.id ?? node.attrs.id ?? '',
        value: wrapper?.attrs.label ?? node.attrs.value ?? '',
        style: parseStyle(rawStyle),
        rawStyle,
        parent: node.attrs.parent ?? '',
        vertex: node.attrs.vertex === '1',
        edge: node.attrs.edge === '1',
        source: node.attrs.source ?? '',
        target: node.attrs.target ?? '',
        geometry: node.children.find(child => child.local === 'mxGeometry'),
      };
    });
}

/**
 * The one remark this reader raises whose wording is FIXED, as a
 * `[key, English]` pair — the same table, the same shape and the same reasons
 * as `UML_PLANTUML_REMARKS` (`plantuml-import.ts`, where the contract is
 * written out): one entry per SHAPE of sentence, the `{{kind}}` hole filled at
 * the call site by `InterchangeNote.messageParams`, the English kept here as
 * the fallback.
 *
 * The reader's refusals ({@link importDrawio}'s `refused`) and its two
 * {@link carried} fragments are deliberately NOT here: a remark that names
 * something out of the file with no sentence shape worth sharing — a raw style
 * dump, a one-off diagnostic — carries no key and stays English, which is what
 * `InterchangeNote.messageKey`'s own contract asks for.
 */
export const UML_DRAWIO_REMARKS = {
  ambiguousBlockHead: [
    'com.labre.uml.import.drawio.ambiguous-block-head',
    'read as a {{kind}}, but the arrowhead is drawn filled; UML draws the generalization triangle hollow (endFill=0).',
  ],
} as const satisfies Record<string, readonly [key: string, english: string]>;

/* ── The reading ──────────────────────────────────────────────────────── */

const carried = (
  sourceId: string,
  element: string,
  message: string
): InterchangeNote => ({ kind: 'carried', sourceId, element, message });

/**
 * A draw.io drawing as a UML model.
 *
 * Never throws. A file that is not a draw.io document at all comes back as an
 * empty model with one `warning` note, which is the same answer as for a
 * payload that is still compressed: this is the visual tier, the tier's promise
 * is recognition, and "I recognised nothing" is an answer rather than a
 * failure.
 *
 * @param xml a decoded `<mxGraphModel>`, or an `<mxfile>` whose `<diagram>`
 *   already holds one. See the module docblock for why the compressed form is
 *   the command's problem and not this function's.
 * @param options.name what to call the sheet when the file names nothing — the
 *   importer's context name, which is the file's own name in practice.
 */
export function importDrawio(
  xml: string,
  options: { name?: string } = {}
): UmlDrawioImport {
  const notes: InterchangeNote[] = [];
  const refused = (message: string): UmlDrawioImport => {
    notes.push({ kind: 'warning', message });
    return { model: emptyModel(options.name), notes, layout: { boxes: {} } };
  };

  if (isCompressedDrawio(xml)) {
    return refused(
      'compressed payload: decode first — this reader takes decoded mxGraphModel XML.'
    );
  }

  const document = readXml(xml);
  const root = document.root;
  if (!root) return refused('no XML in this file.');

  const graph =
    root.local === 'mxGraphModel'
      ? root
      : xmlDescendants(root).find(node => node.local === 'mxGraphModel');
  if (!graph) return refused('no <mxGraphModel> in this file.');

  const diagramName =
    root === graph
      ? ''
      : (xmlDescendants(root).find(node => node.local === 'diagram')?.attrs
          .name ?? '');

  const cells = cellsOf(graph);
  const edgeIds = new Set(
    cells.filter(cell => cell.edge && cell.id).map(cell => cell.id)
  );

  // The two indexes the passes below read the tree through, built in one walk:
  // a cell by its id, and the children of a cell by its parent's. A drawing is
  // routinely a few thousand cells and both are asked for once per cell, so
  // scanning the list for each would be the reader's only quadratic step.
  const byId = new Map<string, DrawioCell>();
  const childrenOf = new Map<string, DrawioCell[]>();
  for (const cell of cells) {
    if (cell.id && !byId.has(cell.id)) byId.set(cell.id, cell);
    if (!cell.parent) continue;
    const siblings = childrenOf.get(cell.parent);
    if (siblings) siblings.push(cell);
    else childrenOf.set(cell.parent, [cell]);
  }

  const classifiers: UmlClassifier[] = [];
  const actors: UmlNodeBase[] = [];
  const useCases: UmlNodeBase[] = [];
  const packages: UmlPackageNode[] = [];
  const umlNotes: UmlNote[] = [];
  const relations: UmlRelation[] = [];
  // No prototype: the key is the cell id the FILE chose. On a plain object a
  // cell whose id is `__proto__` rewrites the bag's own prototype, and a cell
  // whose id is `toString` has the materializer hand a FUNCTION back as that
  // shape's box — which is where the geometry becomes `NaN`.
  const boxes: Record<string, UmlBox> = Object.create(null);
  const lifelines: UmlLifeline[] = [];
  const executions: UmlExecution[] = [];
  const destructions: UmlDestruction[] = [];
  const fragments: UmlCombinedFragment[] = [];
  /** Every cell read as a participant — what a message's end must resolve to. */
  const spineOf = new Map<string, string>();

  /* ── Vertices ───────────────────────────────────────────────────────── */

  for (const cell of cells) {
    if (!cell.vertex || !cell.id) continue;
    // A cell parented to an EDGE is that edge's label, not a shape of its own.
    if (edgeIds.has(cell.parent)) continue;
    // draw.io's two invisible roots — the model and its default layer.
    if (cell.id === '0' || cell.id === '1') continue;
    // A member row of a stack-laid swimlane belongs to its lane, not the sheet.
    const host = byId.get(cell.parent);
    if (host?.vertex && 'swimlane' in host.style) continue;

    const children = (childrenOf.get(cell.id) ?? []).filter(
      child => child.vertex
    );
    const compartments = drawioCompartments(cell.value);
    // §17.2.4's bar is drawn INSIDE the participant's container, so its
    // geometry is relative to it — the one place in this format where a box is
    // not already in sheet coordinates.
    const onLifeline = Boolean(host?.vertex) && spineOf.has(cell.parent);
    const own = geometryOf(cell);
    // The PARENT's own `mxGeometry`, not the box this reader gave it: a
    // lifeline's box is rewritten below to the narrow column our element is,
    // and a child's coordinates are relative to the CELL draw.io drew.
    const parentBox = onLifeline
      ? host
        ? geometryOf(host)
        : undefined
      : undefined;
    const geometry =
      own && parentBox
        ? { ...own, x: own.x + parentBox.x, y: own.y + parentBox.y }
        : own;
    const kind = vertexKindOf(cell.style, compartments, children.length > 0, {
      value: cell.value,
      onLifeline,
      width: own?.w ?? 0,
    });
    if (geometry) boxes[cell.id] = geometry;

    if (kind === 'unknown') {
      notes.push(
        carried(
          cell.id,
          'mxCell',
          `a shape with no UML artefact to be — style ${cell.rawStyle || '(none)'}`
        )
      );
      continue;
    }

    const header = stereotypesOf((compartments[0] ?? []).join('\n'));
    const base: UmlNodeBase = {
      id: cell.id,
      name: header.name,
      keywords: header.keywords,
      isAbstract: header.isAbstract,
      ...(geometry ? { bounds: geometry } : {}),
    };

    switch (kind) {
      case 'lifeline': {
        // The ELEMENT is the spine, not the head draw.io drew: our lifeline is a
        // narrow column whose perimeter is where a message attaches, and the
        // head is painted across the top of it. So the column is centred on the
        // cell and keeps its full height.
        const ident = parseLifelineIdent(base.name);
        const column = geometry
          ? {
              x: geometry.x + geometry.w / 2 - UML_NODE_BOX.lifeline.w / 2,
              y: geometry.y,
              w: UML_NODE_BOX.lifeline.w,
              h: geometry.h,
            }
          : undefined;
        if (column) boxes[cell.id] = column;
        lifelines.push({
          ...base,
          name: ident.selector
            ? `${ident.name ?? ''}[${ident.selector}]`
            : (ident.name ?? ''),
          ...(ident.type ? { type: ident.type } : {}),
          ...(column ? { bounds: column } : {}),
        });
        spineOf.set(cell.id, cell.id);
        break;
      }
      case 'execution': {
        executions.push({
          ...base,
          ...(geometry ? { bounds: geometry } : {}),
          lifelineId: cell.parent,
          y0: geometry ? geometry.y : 0,
          y1: geometry ? geometry.y + geometry.h : 0,
        });
        spineOf.set(cell.id, cell.parent);
        break;
      }
      case 'destruction': {
        destructions.push({
          ...base,
          ...(geometry ? { bounds: geometry } : {}),
          y: geometry ? geometry.y + geometry.h / 2 : 0,
        });
        break;
      }
      case 'fragment': {
        const stated = drawioFragmentLabel(cell.value)!;
        fragments.push({
          ...base,
          name: stated.guard,
          operator: stated.operator,
          // draw.io draws an operand separator as a dashed line the author put
          // there by hand, with nothing in the file to say it is one. ONE band
          // is the honest reading, and it is the one every `opt`, `loop` and
          // `ref` has anyway.
          operands: geometry
            ? [
                {
                  ...(stated.guard ? { guard: stated.guard } : {}),
                  y0: geometry.y,
                  y1: geometry.y + geometry.h,
                },
              ]
            : [{ y0: 0, y1: 0 }],
          coveredLifelineIds: [],
          ...(geometry ? { bounds: geometry } : {}),
        });
        break;
      }
      case 'actor':
        actors.push(base);
        break;
      case 'use-case':
        useCases.push(base);
        break;
      case 'package':
        packages.push(base);
        break;
      case 'note':
        // A note is PROSE, not a name compartment: every line the box held,
        // kept whole and in order.
        umlNotes.push({
          ...base,
          name: '',
          keywords: [],
          body: compartments.flat().join('\n'),
        });
        break;
      case 'classifier': {
        // Two templates, one classifier. The HTML one separates the
        // compartments with `<hr />`; the stack-laid swimlane draws each member
        // as a child row and separates nothing, so the only distinction the
        // notation still carries is §9.5.4's own — a member with a parameter
        // list is an operation.
        const rows =
          children.length > 0
            ? children.flatMap(child => drawioCompartments(child.value).flat())
            : undefined;
        const attributes: string[] = [];
        const operations: string[] = [];
        for (const line of rows ?? compartments[1] ?? []) {
          if (rows && line.includes('(')) operations.push(line);
          else attributes.push(line);
        }
        if (!rows) operations.push(...(compartments[2] ?? []));

        classifiers.push({
          ...base,
          kind: classifierKindOf(header.keywords),
          attributes: attributes.map(line => parseProperty(line)),
          operations: operations.map(line => parseOperation(line)),
          slots: [],
          lines: { attributes, operations },
        });
        break;
      }
    }
  }

  /* ── Edges ──────────────────────────────────────────────────────────── */

  const drawn = new Set<string>([
    ...classifiers.map(entry => entry.id),
    ...actors.map(entry => entry.id),
    ...useCases.map(entry => entry.id),
    ...packages.map(entry => entry.id),
    ...umlNotes.map(entry => entry.id),
  ]);

  /** §17.4.4's arrows, in the order the file drew them down the sheet. */
  const messages: UmlMessage[] = [];
  let unplaced = 0;

  for (const cell of cells) {
    if (!cell.edge || !cell.id) continue;

    // §17.4 — a line between two participants is a MESSAGE, whatever else the
    // style says: on a sequence sheet there is no other kind of line.
    if (spineOf.has(cell.source) && spineOf.has(cell.target)) {
      const at = drawioEdgeHeight(cell);
      messages.push({
        id: cell.id,
        kind: drawioMessageKind(cell.style),
        sourceId: cell.source,
        targetId: cell.target,
        ...(drawioCompartments(cell.value).flat().join(' ').trim()
          ? { label: drawioCompartments(cell.value).flat().join(' ').trim() }
          : {}),
        // A file that drew no waypoints has still stated an ORDER — the order
        // its cells are written in — and that is what the slots stand in for.
        y: at ?? umlSequenceSlot(unplaced++),
      });
      continue;
    }

    if (!drawn.has(cell.source) || !drawn.has(cell.target)) {
      notes.push(
        carried(
          cell.id,
          'mxCell',
          `an edge whose ends this reader did not draw (${cell.source || '?'} → ${cell.target || '?'})`
        )
      );
      continue;
    }

    const label = stereotypesOf(
      drawioCompartments(cell.value).flat().join('\n')
    );
    const flip = wholeIsTarget(cell.style);
    const relation: UmlRelation = {
      kind: relationKindOf(cell.style, label.keywords),
      sourceId: flip ? cell.target : cell.source,
      targetId: flip ? cell.source : cell.target,
      ...(label.name ? { label: label.name } : {}),
    };
    relations.push(relation);

    // A SOLID block head: read as the relationship it is, and named because the
    // file draws it wrong — see {@link isAmbiguousBlockHead}.
    if (isAmbiguousBlockHead(cell.style)) {
      notes.push({
        kind: 'warning',
        sourceId: cell.id,
        element: 'mxCell',
        messageKey: UML_DRAWIO_REMARKS.ambiguousBlockHead[0],
        message: `read as a ${relation.kind}, but the arrowhead is drawn filled; UML draws the generalization triangle hollow (endFill=0).`,
        messageParams: { kind: relation.kind },
      });
    }

    // The per-end labels — the `1`s of a multiplicity. Each one is pinned to an
    // end by its relative geometry, and lands on the relation end DRAWN there
    // (§11.5.4). `flip` is why the two are not simply "source" and "target": an
    // aggregation read off the target end has already had its ends swapped, so
    // the label written at the mxCell's source belongs to the relation's target.
    for (const child of childrenOf.get(cell.id) ?? []) {
      const text = drawioCompartments(child.value).flat().join(' ');
      if (!text) continue;
      const at = labelEndOf(child.geometry);
      if (at === 'centre') {
        if (!relation.label) relation.label = text;
        continue;
      }
      const side =
        (at === 'source') !== flip
          ? ('sourceEnd' as const)
          : ('targetEnd' as const);
      // FIRST wins: draw.io lets an author stack two labels on one end, and the
      // board draws one label per end.
      if (relation[side]) continue;
      relation[side] = ADORNED_RELATION_KINDS.has(relation.kind)
        ? parseEndLabel(text)
        : { raw: text };
    }
  }

  /* ── The sheet ──────────────────────────────────────────────────────── */

  for (const note of document.notes) {
    notes.push({ kind: 'warning', element: 'mxfile', message: note });
  }

  // ── The interaction, once every box is known ────────────────────────
  //
  // Two attributions by GEOMETRY, and the same two `model.ts` makes off the
  // canvas: which spine a cross sits on, and which spines a fragment covers.
  // draw.io states neither — a cross is a shape dropped on a line and a frame is
  // a rectangle drawn round one — so the reading is the notation's own.
  for (const record of destructions) {
    const spine = umlLifelineAt(record.bounds, lifelines);
    if (spine) record.lifelineId = spine.id;
  }
  for (const record of fragments) {
    const box = record.bounds;
    if (!box) continue;
    record.coveredLifelineIds = lifelines
      .filter(lifeline => {
        const spine = lifeline.bounds
          ? lifeline.bounds.x + lifeline.bounds.w / 2
          : undefined;
        return spine !== undefined && spine >= box.x && spine <= box.x + box.w;
      })
      .map(lifeline => lifeline.id);
  }
  messages.sort((a, b) => a.y - b.y);

  const sheetName = diagramName || options.name;
  const interactions: UmlInteraction[] =
    lifelines.length > 0 ||
    messages.length > 0 ||
    fragments.length > 0 ||
    executions.length > 0 ||
    destructions.length > 0
      ? [
          {
            id: UML_DRAWIO_FORMAT_ID,
            name: sheetName?.trim() || 'Imported diagram',
            lifelines,
            messages,
            fragments,
            executions,
            destructions,
          },
        ]
      : [];

  const model: UmlModel = {
    ...emptyModel(sheetName, interactions.length > 0 ? 'sd' : undefined),
    classifiers,
    packages,
    actors,
    useCases,
    notes: umlNotes,
    interactions,
    relations,
  };

  return { model, notes, layout: { boxes: translate(boxes) } };
}

/**
 * §17.4.4's arrow, read off the two things draw.io states about a line.
 *
 * The specification tells its three drawn messages apart by the LINE and the
 * HEAD, and the stencil writes exactly those: a dashed line is a reply, an open
 * head is an asynchronous send, and the filled block head the stencil uses by
 * default is a synchronous call. `create` and `delete` share a drawing with two
 * of the three and are told apart by what the arrow REACHES, which is geometry
 * this tier does not read (ADR 0019) — so an arrow onto a head comes back as the
 * call it looks like, and the author retypes it.
 */
function drawioMessageKind(style: MxStyle): UmlMessageKind {
  if (style.dashed === '1') return 'message-reply';
  const endArrow = style.endarrow ?? '';
  if (
    endArrow === 'open' ||
    endArrow === 'openThin' ||
    endArrow === 'halfCircle'
  ) {
    return 'message-async';
  }
  return 'message-sync';
}

/**
 * The HEIGHT one message edge was drawn at — the midpoint of its two endpoints.
 *
 * `<mxPoint as="sourcePoint">` is where draw.io records an end that is pinned to
 * a coordinate rather than to a cell, and on a sequence diagram that is every
 * end: a message is attached to a lifeline at a HEIGHT, and the height is the
 * only thing about the arrow that carries meaning (§17.4.4).
 */
function drawioEdgeHeight(cell: DrawioCell): number | undefined {
  const geometry = cell.geometry;
  if (!geometry) return undefined;
  const heights: number[] = [];
  for (const point of geometry.children) {
    if (point.local !== 'mxPoint') continue;
    const at = point.attrs.as;
    if (at !== 'sourcePoint' && at !== 'targetPoint') continue;
    const y = Number.parseFloat(point.attrs.y ?? '');
    if (Number.isFinite(y)) heights.push(y);
  }
  if (heights.length === 0) return undefined;
  return heights.reduce((sum, y) => sum + y, 0) / heights.length;
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

/** `<mxGeometry x y width height>`, when the cell carries a drawable one. */
function geometryOf(cell: DrawioCell): UmlBox | undefined {
  const geometry = cell.geometry;
  if (!geometry) return undefined;
  const w = Number.parseFloat(geometry.attrs.width ?? '');
  const h = Number.parseFloat(geometry.attrs.height ?? '');
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return undefined;
  }
  const x = Number.parseFloat(geometry.attrs.x ?? '0');
  const y = Number.parseFloat(geometry.attrs.y ?? '0');
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0, w, h };
}

/** The drawing's own top-left corner to `(0, 0)` — see {@link UmlDrawioLayout}. */
function translate(boxes: Record<string, UmlBox>): Record<string, UmlBox> {
  const entries = Object.entries(boxes);
  if (entries.length === 0) return boxes;
  const minX = Math.min(...entries.map(([, box]) => box.x));
  const minY = Math.min(...entries.map(([, box]) => box.y));
  // `Object.fromEntries` would give the moved bag a prototype back, and the ids
  // in it are still the file's — so it is filled by hand instead.
  const moved: Record<string, UmlBox> = Object.create(null);
  for (const [id, box] of entries) {
    moved[id] = { ...box, x: box.x - minX, y: box.y - minY };
  }
  return moved;
}

const DIAGRAM_KIND: UmlDiagramKind = 'class';

/**
 * A sheet with nothing on it.
 *
 * `class` for the frame, and it is a statement rather than a default: draw.io
 * has no frame kind to read, and every UML shape this reader recognises — a
 * compartmented box, a hollow triangle, a diamond — belongs to §9's class
 * family. A use-case-only drawing lands on a class sheet and the author retags
 * the frame, which is one click and honest; guessing the kind from a majority
 * of shapes would be a second heuristic stacked on the first.
 */
function emptyModel(
  name: string | undefined,
  // The one kind this reader can name off the STENCIL rather than off a
  // majority of shapes: `shape=umlLifeline` is drawn on a sequence diagram and
  // nowhere else, so a drawing that holds one is an `sd` sheet and saying so
  // costs the author a retag they would otherwise have to make.
  kind: UmlDiagramKind = DIAGRAM_KIND
): UmlModel {
  const label = name?.trim() || 'Imported diagram';
  return {
    diagram: {
      id: UML_DRAWIO_FORMAT_ID,
      kind,
      name: label,
      heading: `${UML_DIAGRAM_KIND_TAG[kind] ?? kind} ${label}`,
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
    interactions: [],
    relations: [],
    warnings: [],
  };
}
