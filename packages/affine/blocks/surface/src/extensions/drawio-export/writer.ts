import { PointStyle } from '@labre/affine-model';
import type {
  GfxBlockElementModel,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';

import type {
  InterchangeExportContext,
  InterchangeExportResult,
} from '../interchange.js';
import { type DrawioColor, drawioColor } from './colors.js';

/**
 * The canvas as a draw.io drawing — the GENERIC writer of `canvas:drawio:export`
 * (`docs/adr/0019`, amendment of 2026-10-14; `docs/adr/0012` P2's visual tier).
 *
 * ## What it writes, and what it promises
 *
 * One uncompressed `<mxfile>` holding one page: a `<mxGraphModel>` whose cells
 * are what the canvas PAINTS — a shape as a draw.io shape, a connector as an
 * edge, a text as a text, a group as a draw.io group, and the canvas blocks a
 * reader needs (a note, a frame, an edgeless text, an image as a placeholder
 * naming its blob). A framework artefact is written by its generic rendering —
 * the shape it extends and the words grouped with it — and carries its `role`
 * as a `labre-role` attribute, so a reader that knows the vocabulary can
 * recognise it (`importDrawio`, UML, does for the class and use case
 * families). That is a courtesy to a reader, not a model: this is the VISUAL
 * tier, and what a framework means is written by its own semantic exporter
 * (PlantUML, XMI, `.bpmn`, OWM), never here.
 *
 * ## Pure, and deterministic
 *
 * No `std`, no DOM, no clock: element records in, text out (`docs/adr/0012`
 * P3), so labre-mcp can call it and a unit suite can prove it with plain
 * objects. The same canvas writes the same bytes — cells in z-order (frames
 * first, then the fractional `index`, the id breaking ties), numbers rounded to
 * two decimals, no timestamp, no generated id: a cell's id IS the element's id
 * (`docs/adr/0012` D3), so a re-import can name what it read.
 *
 * ## What is never written
 *
 * No link, no URL, no script: a label is the element's plain text,
 * HTML-escaped (draw.io reads `html=1` labels as markup) and then XML-escaped,
 * so a `<script>` somebody typed arrives as the seven characters they typed.
 * An image is a placeholder carrying its blob id, never the bytes nor an
 * address. Nothing here reads `pivotDocId`, tags or `interchange` payloads.
 *
 * ## Where it is known to lose
 *
 * A freehand stroke, a highlighter and a polygon's outline have no draw.io
 * shape: the first two are left out, the third is drawn as its bounding box,
 * and each costs one warning per kind. A curved connector is drawn
 * `curved=1` through no waypoint (draw.io routes its own curve). A block other
 * than the four above (an embed, an attachment, a LaTeX block) is left out with
 * a warning naming its flavour. Colours are printed in their LIGHT variant.
 */

/* ── The format ───────────────────────────────────────────────────────── */

export const DRAWIO_EXTENSION = '.drawio';
export const DRAWIO_MIME = 'application/xml';

/** The name a canvas with no title is given, as a file and as a page. */
const FALLBACK_NAME = 'canvas';

/* ── Reading a record ─────────────────────────────────────────────────── */

type Rec = Record<string, unknown>;

/** What the writer reads of an element or a block, structurally. */
interface Entry {
  id: string;
  /** `shape`, `connector`, … for an element; the flavour for a block. */
  type: string;
  block: boolean;
  rec: Rec;
  bound: Box | null;
  index: string;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const str = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;
const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** A `Y.Text`, a `Text`, a string — whatever says `toString()` with its words. */
function textOf(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'toString' in value) {
    const out = String(value);
    return out === '[object Object]' ? '' : out;
  }
  return '';
}

/** The stored `xywh` string, or the `[x, y, w, h]` a live model derives. */
function boxOf(xywh: unknown): Box | null {
  try {
    const parsed: unknown = typeof xywh === 'string' ? JSON.parse(xywh) : xywh;
    if (!Array.isArray(parsed) || parsed.length < 4) return null;
    const [x = NaN, y = NaN, w = NaN, h = NaN] = parsed.map(Number);
    if (![x, y, w, h].every(Number.isFinite)) return null;
    return { x, y, w, h };
  } catch {
    return null;
  }
}

/** The ids a group-like element holds: `childIds`, else its `children` map. */
function childIdsOf(rec: Rec): string[] {
  if (Array.isArray(rec.childIds)) {
    return rec.childIds.filter((id): id is string => typeof id === 'string');
  }
  const children = rec.children as { keys?: () => Iterable<string> } | null;
  if (children && typeof children.keys === 'function') {
    return [...children.keys()];
  }
  return [];
}

/** A block's words: its own text, then every descendant's, one per line. */
function blockText(block: Rec): string {
  const lines: string[] = [];
  const walk = (node: Rec, depth: number) => {
    const props = (node.props as Rec | undefined) ?? {};
    const own = textOf(props.text ?? node.text).trim();
    if (own) lines.push(own);
    if (depth > 32) return;
    const children = node.children;
    if (Array.isArray(children)) {
      for (const child of children) walk(child as Rec, depth + 1);
    }
  };
  walk(block, 0);
  return lines.join('\n');
}

const propsOf = (entry: Entry): Rec =>
  (entry.block ? (entry.rec.props as Rec | undefined) : entry.rec) ?? {};

/* ── Escaping ─────────────────────────────────────────────────────────── */

/**
 * Characters XML 1.0 forbids outright. A label holding one would make the whole
 * file unreadable, so it is dropped rather than escaped (there is no escape
 * for them in XML 1.0).
 */
const XML_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** An attribute value: XML-escaped, line breaks kept as character references. */
function attr(value: string): string {
  return value
    .replaceAll(XML_FORBIDDEN, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\n', '&#10;')
    .replaceAll('\r', '&#13;')
    .replaceAll('\t', '&#9;');
}

/**
 * A label for an `html=1` cell: the plain text HTML-escaped first, so draw.io
 * renders what was typed and never interprets it, then line breaks as `<br>`.
 * {@link attr} escapes the result a second time for the attribute.
 */
function htmlLabel(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll(/\r\n|\r|\n/g, '<br>');
}

/** Two decimals, no `-0`: the same canvas writes the same bytes. */
function fmt(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded === 0 ? 0 : rounded);
}

/* ── Styles ───────────────────────────────────────────────────────────── */

type Style = [key: string, value: string | number][];

function styleString(lead: readonly string[], style: Style): string {
  return [
    ...lead,
    ...style.map(
      ([key, value]) =>
        // A value never carries the separators the style string is made of.
        `${key}=${String(value).replaceAll(/[;=]/g, '')}`
    ),
  ]
    .map(part => `${part};`)
    .join('');
}

function pushColor(
  style: Style,
  key: string,
  opacityKey: string | null,
  color: DrawioColor | undefined
) {
  if (!color) return;
  style.push([key, color.value]);
  if (opacityKey && color.opacity !== undefined) {
    style.push([opacityKey, color.opacity]);
  }
}

const FONT_PREFIX = 'blocksuite:surface:';

/** Font family, size, colour, weight, italics and decoration. */
function pushFont(style: Style, props: Rec) {
  const family = str(props.fontFamily);
  if (family) style.push(['fontFamily', family.replace(FONT_PREFIX, '')]);
  const size = num(props.fontSize);
  if (size !== undefined) style.push(['fontSize', fmt(size)]);
  pushColor(style, 'fontColor', null, drawioColor(props.color));

  // draw.io's `fontStyle` is a bit mask: 1 bold, 2 italic, 4 underline, 8
  // strike-through. The decoration is a CSS token list (ADR 0030), read token
  // by token.
  let mask = 0;
  const weight = Number(props.fontWeight);
  if (Number.isFinite(weight) && weight >= 600) mask |= 1;
  if (props.fontStyle === 'italic') mask |= 2;
  const decoration = str(props.textDecoration)?.split(/\s+/) ?? [];
  if (decoration.includes('underline')) mask |= 4;
  if (decoration.includes('line-through')) mask |= 8;
  if (mask) style.push(['fontStyle', mask]);
}

const ALIGN: Record<string, string> = Object.assign(Object.create(null), {
  left: 'left',
  center: 'center',
  right: 'right',
});
const VERTICAL_ALIGN: Record<string, string> = Object.assign(
  Object.create(null),
  { top: 'top', center: 'middle', bottom: 'bottom' }
);

function pushStroke(style: Style, props: Rec, colorKey: string) {
  const strokeStyle = str(props.strokeStyle);
  if (strokeStyle === 'none') {
    style.push(['strokeColor', 'none']);
    return;
  }
  pushColor(
    style,
    'strokeColor',
    'strokeOpacity',
    drawioColor(props[colorKey])
  );
  const width = num(props.strokeWidth);
  if (width !== undefined) style.push(['strokeWidth', fmt(width)]);
  if (strokeStyle === 'dash') style.push(['dashed', 1]);
}

/**
 * A Labre end marker as draw.io's `[arrow, fill]` pair (`PointStyle`, ADR
 * 0016). The enum is append-only, so the default answers for a marker
 * appended after this was written: draw.io's plain open arrow, never a
 * failure.
 */
function arrowOf(pointStyle: unknown): [string, 0 | 1] {
  switch (pointStyle) {
    case PointStyle.None:
      return ['none', 0];
    case PointStyle.Triangle:
      return ['block', 1];
    case PointStyle.TriangleHollow:
      return ['block', 0];
    case PointStyle.Diamond:
      return ['diamond', 1];
    case PointStyle.DiamondHollow:
      return ['diamond', 0];
    case PointStyle.Circle:
      return ['oval', 1];
    default:
      return ['open', 0];
  }
}

/* ── The writer ───────────────────────────────────────────────────────── */

const ROOT = '0';
const LAYER = '1';

/** The elements (and `context.blocks`) handed over, as one draw.io page. */
export function exportCanvasDrawio(
  elements: readonly GfxPrimitiveElementModel[],
  context: InterchangeExportContext = {}
): InterchangeExportResult {
  const entries = collect(elements, context.blocks ?? []);
  const byId = new Map(entries.map(entry => [entry.id, entry]));

  // The exported group holding each entry. A group lists its DIRECT children
  // (a nested group lists the inner group, not what it holds), so one claim
  // per child is the whole of the nesting.
  const parentOf = new Map<string, string>();
  for (const entry of entries) {
    if (entry.type !== 'group' && entry.type !== 'mindmap') continue;
    for (const childId of childIdsOf(entry.rec)) {
      if (childId === entry.id || !byId.has(childId)) continue;
      if (!parentOf.has(childId)) parentOf.set(childId, entry.id);
    }
  }
  // A group listed as its own ancestor is a broken record, not a drawing: the
  // chain is cut where it loops rather than walked forever.
  for (const [child] of parentOf) {
    const seen = new Set<string>([child]);
    let at = parentOf.get(child);
    while (at !== undefined) {
      if (seen.has(at)) {
        parentOf.delete(child);
        break;
      }
      seen.add(at);
      at = parentOf.get(at);
    }
  }

  const warnings = new Map<string, number>();
  const warn = (sentence: string) =>
    warnings.set(sentence, (warnings.get(sentence) ?? 0) + 1);

  const cells: string[] = [];
  const emitted = new Set<string>();
  const vertexIds = new Set<string>();

  const originOf = (id: string | undefined): [number, number] => {
    const parent = id === undefined ? undefined : byId.get(id);
    return parent?.bound ? [parent.bound.x, parent.bound.y] : [0, 0];
  };

  const emit = (entry: Entry) => {
    if (emitted.has(entry.id)) return;
    emitted.add(entry.id);
    const parentId = parentOf.get(entry.id);
    const parent = parentId === undefined ? undefined : byId.get(parentId);
    // A parent cell comes before its children: draw.io paints a group's
    // children at the group's own place in the stack.
    if (parent) emit(parent);
    const cell = cellOf(entry, parent?.id ?? LAYER, originOf(parent?.id), warn);
    if (!cell) return;
    cells.push(...cell.xml);
    if (cell.vertex) vertexIds.add(entry.id);
  };
  for (const entry of entries) {
    if (entry.type === 'connector') continue;
    emit(entry);
  }
  // Edges after every vertex, in their own z-order: an edge names its ends
  // by id, so they must be known by then, and above the shapes is where
  // draw.io itself puts a newly drawn edge.
  for (const entry of entries) {
    if (entry.type !== 'connector') continue;
    const parentId = parentOf.get(entry.id);
    const parent = parentId === undefined ? undefined : byId.get(parentId);
    if (parent) emit(parent);
    cells.push(
      ...edgeOf(entry, parent?.id ?? LAYER, originOf(parent?.id), vertexIds)
    );
    emitted.add(entry.id);
  }
  for (const entry of entries) {
    if (entry.type !== 'mindmap') continue;
    cells.push(...mindmapEdges(entry, vertexIds));
  }

  const rawName = (context.name ?? '').trim();
  const name = rawName || FALLBACK_NAME;
  const text = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<mxfile host="Labre">',
    `  <diagram id="labre-canvas" name="${attr(name)}">`,
    '    <mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" math="0" shadow="0">',
    '      <root>',
    `        <mxCell id="${ROOT}" />`,
    `        <mxCell id="${LAYER}" parent="${ROOT}" />`,
    ...cells.map(cell => `        ${cell}`),
    '      </root>',
    '    </mxGraphModel>',
    '  </diagram>',
    '</mxfile>',
    '',
  ].join('\n');

  const sentences = [...warnings].map(([sentence, count]) =>
    sentence.replace('{{count}}', String(count))
  );
  return {
    text,
    filename: `${safeName(rawName)}${DRAWIO_EXTENSION}`,
    mime: DRAWIO_MIME,
    ...(sentences.length > 0 ? { warnings: sentences } : {}),
  };
}

/** A file name a disk accepts: the shape `safeFilename` gives every export. */
function safeName(raw: string): string {
  const safe = raw
    .replaceAll(/[\\/:*?"<>|]/g, '-')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .replace(/[. ]+$/, '');
  return safe || FALLBACK_NAME;
}

/* ── Ordering ─────────────────────────────────────────────────────────── */

function collect(
  elements: readonly GfxPrimitiveElementModel[],
  blocks: readonly GfxBlockElementModel[]
): Entry[] {
  const entries: Entry[] = [];
  const seen = new Set<string>();
  const add = (rec: Rec, block: boolean) => {
    const id = str(rec.id);
    if (!id || seen.has(id)) return;
    // Mindmap collapse (`hidden`) is painted as absence; so is a note shown in
    // the page view only. The other two visibilities (ADR 0031) are the
    // caller's to apply, because only the caller knows this viewer.
    if (rec.hidden === true) return;
    const type = block ? str(rec.flavour) : str(rec.type);
    if (!type) return;
    if (
      block &&
      type === 'affine:note' &&
      (rec.props as Rec | undefined)?.displayMode === 'doc'
    ) {
      return;
    }
    seen.add(id);
    const props = block ? ((rec.props as Rec | undefined) ?? {}) : rec;
    entries.push({
      id,
      type,
      block,
      rec,
      bound: boxOf(rec.xywh ?? props.xywh ?? rec.deserializedXYWH),
      index: str(rec.index) ?? str(props.index) ?? '',
    });
  };
  for (const element of elements) add(element as unknown as Rec, false);
  for (const block of blocks) add(block as unknown as Rec, true);

  // Frames are the floor of the canvas (they are painted under everything),
  // then the fractional index, then the id: one order for one canvas.
  const floor = (entry: Entry) => (entry.type === 'affine:frame' ? 0 : 1);
  return entries.sort(
    (a, b) =>
      floor(a) - floor(b) ||
      (a.index < b.index ? -1 : a.index > b.index ? 1 : 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/* ── Cells ────────────────────────────────────────────────────────────── */

/** `<object>` attributes every cell carries: its id, its kind and its role. */
function objectAttrs(entry: Entry, label: string): string {
  const role = str(entry.rec.role);
  return [
    `id="${attr(entry.id)}"`,
    `label="${attr(label)}"`,
    `labre-type="${attr(entry.type)}"`,
    ...(role ? [`labre-role="${attr(role)}"`] : []),
  ].join(' ');
}

function vertexXml(
  entry: Entry,
  parent: string,
  origin: [number, number],
  label: string,
  style: string,
  extra: { object?: string; cell?: string } = {}
): string[] {
  const box = entry.bound ?? { x: 0, y: 0, w: 0, h: 0 };
  return [
    `<object ${objectAttrs(entry, label)}${extra.object ?? ''}>`,
    `  <mxCell style="${attr(style)}" vertex="1"${extra.cell ?? ''} parent="${attr(parent)}">`,
    `    <mxGeometry x="${fmt(box.x - origin[0])}" y="${fmt(box.y - origin[1])}" width="${fmt(box.w)}" height="${fmt(box.h)}" as="geometry" />`,
    '  </mxCell>',
    '</object>',
  ];
}

const SKIPPED = (kind: string) =>
  `Left out {{count}} × ${kind}: draw.io has no shape for it.`;

function cellOf(
  entry: Entry,
  parent: string,
  origin: [number, number],
  warn: (sentence: string) => void
): { xml: string[]; vertex: boolean } | null {
  const props = propsOf(entry);
  const rotate = num(props.rotate ?? entry.rec.rotate);
  const rotation: Style = rotate ? [['rotation', fmt(rotate)]] : [];

  if (entry.block) {
    switch (entry.type) {
      case 'affine:note': {
        const style: Style = [
          ['align', 'left'],
          ['verticalAlign', 'top'],
        ];
        pushColor(
          style,
          'fillColor',
          'fillOpacity',
          drawioColor(props.background)
        );
        style.push(['strokeColor', 'none'], ['spacing', 12]);
        return {
          xml: vertexXml(
            entry,
            parent,
            origin,
            htmlLabel(blockText(entry.rec)),
            styleString(['rounded=1', 'whiteSpace=wrap', 'html=1'], style)
          ),
          vertex: true,
        };
      }
      case 'affine:frame': {
        const style: Style = [
          ['align', 'left'],
          ['verticalAlign', 'top'],
          ['spacingLeft', 8],
          ['fontStyle', 1],
        ];
        const fill = drawioColor(props.background);
        pushColor(style, 'fillColor', 'fillOpacity', fill ?? { value: 'none' });
        return {
          xml: vertexXml(
            entry,
            parent,
            origin,
            htmlLabel(textOf(props.title).trim()),
            styleString(['rounded=0', 'whiteSpace=wrap', 'html=1'], style)
          ),
          vertex: true,
        };
      }
      case 'affine:edgeless-text': {
        const style: Style = [
          ['strokeColor', 'none'],
          ['fillColor', 'none'],
          ['align', ALIGN[str(props.textAlign) ?? ''] ?? 'left'],
          ['verticalAlign', 'top'],
          ...rotation,
        ];
        pushFont(style, props);
        return {
          xml: vertexXml(
            entry,
            parent,
            origin,
            htmlLabel(blockText(entry.rec)),
            styleString(['text', 'whiteSpace=wrap', 'html=1'], style)
          ),
          vertex: true,
        };
      }
      case 'affine:image': {
        // A REFERENCE, never the bytes and never an address: the cell names
        // the blob (`labre-image`) and shows its caption, so a reader that
        // can resolve the blob may, and draw.io shows a labelled box.
        const sourceId = str(props.sourceId) ?? '';
        return {
          xml: vertexXml(
            entry,
            parent,
            origin,
            htmlLabel(str(props.caption)?.trim() ?? ''),
            styleString(
              ['rounded=0', 'whiteSpace=wrap', 'html=1'],
              [['dashed', 1], ['fillColor', 'none'], ...rotation]
            ),
            sourceId ? { object: ` labre-image="${attr(sourceId)}"` } : {}
          ),
          vertex: true,
        };
      }
      default:
        warn(SKIPPED(entry.type));
        return null;
    }
  }

  switch (entry.type) {
    case 'group':
    case 'mindmap': {
      const title = textOf(props.title).trim();
      const style: Style = title
        ? [
            ['verticalLabelPosition', 'top'],
            ['verticalAlign', 'bottom'],
            ['align', 'left'],
          ]
        : [];
      return {
        xml: vertexXml(
          entry,
          parent,
          origin,
          htmlLabel(title),
          styleString(['group', 'html=1'], style),
          { cell: ' connectable="0"' }
        ),
        vertex: false,
      };
    }
    case 'text': {
      const style: Style = [
        ['strokeColor', 'none'],
        ['fillColor', 'none'],
        ['align', ALIGN[str(props.textAlign) ?? ''] ?? 'center'],
        ['verticalAlign', 'top'],
        ...rotation,
      ];
      pushFont(style, props);
      return {
        xml: vertexXml(
          entry,
          parent,
          origin,
          htmlLabel(textOf(props.text)),
          styleString(['text', 'whiteSpace=wrap', 'html=1'], style)
        ),
        vertex: true,
      };
    }
    case 'brush':
    case 'highlighter':
      warn(SKIPPED(entry.type));
      return null;
  }

  // Every other element is a box: a shape (and every framework node, which
  // extends one) by its `shapeType`, a framework board by its bound.
  const shapeType = str(props.shapeType);
  const lead = ['whiteSpace=wrap', 'html=1'];
  const style: Style = [];
  if (shapeType === 'ellipse') lead.unshift('ellipse');
  else if (shapeType === 'diamond') lead.unshift('rhombus');
  else if (shapeType === 'triangle') {
    lead.unshift('triangle');
    style.push(['direction', 'north']);
  } else {
    if (shapeType === 'polygon') {
      warn(
        'Drew {{count}} × polygon as its bounding box: draw.io has no free polygon.'
      );
    }
    const radius = num(props.radius) ?? 0;
    const box = entry.bound;
    if (radius > 0 && box) {
      const px = radius < 1 ? Math.min(box.w, box.h) * radius : radius;
      lead.unshift('rounded=1');
      style.push(['absoluteArcSize', 1], ['arcSize', fmt(px * 2)]);
    } else {
      lead.unshift('rounded=0');
    }
  }

  const isShape = shapeType !== undefined;
  if (isShape) {
    // `filled` is the shape's own switch; an unfilled shape paints no fill
    // whatever colour it remembers.
    if (props.filled === false) style.push(['fillColor', 'none']);
    else
      pushColor(
        style,
        'fillColor',
        'fillOpacity',
        drawioColor(props.fillColor)
      );
    pushStroke(style, props, 'strokeColor');
    style.push(
      ['align', ALIGN[str(props.textAlign) ?? ''] ?? 'center'],
      [
        'verticalAlign',
        VERTICAL_ALIGN[str(props.textVerticalAlign) ?? ''] ?? 'middle',
      ]
    );
    pushFont(style, props);
  } else {
    // A board: a floor with its name in the corner. Its fill, when it
    // declares one under a name this writer knows; never a guess.
    const fill = drawioColor(props.fillColor ?? props.background);
    pushColor(style, 'fillColor', 'fillOpacity', fill ?? { value: 'none' });
    pushStroke(
      style,
      props,
      props.strokeColor === undefined ? 'stroke' : 'strokeColor'
    );
    style.push(['align', 'left'], ['verticalAlign', 'top'], ['spacingLeft', 8]);
  }
  style.push(...rotation);

  const label =
    isShape && props.textDisplay === false
      ? ''
      : textOf(
          props.text ??
            props.title ??
            props.name ??
            props.heading ??
            props.label
        ).trim();
  return {
    xml: vertexXml(
      entry,
      parent,
      origin,
      htmlLabel(label),
      styleString(lead, style)
    ),
    vertex: true,
  };
}

/* ── Edges ────────────────────────────────────────────────────────────── */

type Point = [number, number];

function pointOf(value: unknown): Point | null {
  if (!value || typeof value !== 'object') return null;
  const x = Number((value as Rec)[0]);
  const y = Number((value as Rec)[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

/** The routed path, absolute: `absolutePath`, else `path` off the bound. */
function pathOf(entry: Entry): Point[] {
  const absolute = entry.rec.absolutePath;
  if (Array.isArray(absolute) && absolute.length >= 2) {
    return absolute.map(pointOf).filter((p): p is Point => p !== null);
  }
  const relative = entry.rec.path;
  const box = entry.bound;
  if (Array.isArray(relative) && relative.length >= 2) {
    const [dx, dy] = box ? [box.x, box.y] : [0, 0];
    return relative
      .map(pointOf)
      .filter((p): p is Point => p !== null)
      .map(([x, y]) => [x + dx, y + dy]);
  }
  return [];
}

function edgeLabelCell(
  id: string,
  parent: string,
  text: string,
  at: -1 | 1
): string {
  return [
    `<mxCell id="${attr(id)}" value="${attr(htmlLabel(text))}" style="edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];" vertex="1" connectable="0" parent="${attr(parent)}">`,
    `  <mxGeometry x="${at}" relative="1" as="geometry">`,
    '    <mxPoint as="offset" />',
    '  </mxGeometry>',
    '</mxCell>',
  ].join('\n        ');
}

function edgeOf(
  entry: Entry,
  parent: string,
  origin: [number, number],
  vertexIds: ReadonlySet<string>
): string[] {
  const rec = entry.rec;
  const path = pathOf(entry);
  const source = (rec.source as Rec | null | undefined) ?? {};
  const target = (rec.target as Rec | null | undefined) ?? {};
  const sourceId = str(source.id);
  const targetId = str(target.id);
  const sourceCell = sourceId && vertexIds.has(sourceId) ? sourceId : null;
  const targetCell = targetId && vertexIds.has(targetId) ? targetId : null;

  const mode = num(rec.mode);
  const lead = ['html=1'];
  const style: Style = [];
  if (mode === 1)
    style.push(['edgeStyle', 'orthogonalEdgeStyle'], ['rounded', 0]);
  else if (mode === 0) style.push(['edgeStyle', 'none']);
  else style.push(['curved', 1]);

  const [startArrow, startFill] = arrowOf(
    rec.frontEndpointStyle ?? PointStyle.None
  );
  const [endArrow, endFill] = arrowOf(
    rec.rearEndpointStyle ?? PointStyle.Arrow
  );
  style.push(
    ['startArrow', startArrow],
    ['startFill', startFill],
    ['endArrow', endArrow],
    ['endFill', endFill]
  );
  pushStroke(style, rec, 'stroke');

  // A `position` on a CONNECTED end is where on the shape it attaches, as a
  // fraction of the box — draw.io's own exit / entry constraint.
  const anchor = (end: Rec, prefix: 'exit' | 'entry') => {
    const at = pointOf(end.position);
    if (!at) return;
    style.push(
      [`${prefix}X`, fmt(at[0])],
      [`${prefix}Y`, fmt(at[1])],
      [`${prefix}Dx`, 0],
      [`${prefix}Dy`, 0]
    );
  };
  if (sourceCell) anchor(source, 'exit');
  if (targetCell) anchor(target, 'entry');

  const local = ([x, y]: Point): Point => [x - origin[0], y - origin[1]];
  const freeEnd = (end: Rec, fallback: Point | undefined): Point | null => {
    if (!str(end.id)) {
      const at = pointOf(end.position);
      if (at) return at;
    }
    return fallback ?? null;
  };
  const start = freeEnd(source, path[0]);
  const finish = freeEnd(target, path[path.length - 1]);

  const geometry: string[] = [];
  if (start) {
    const [x, y] = local(start);
    geometry.push(`<mxPoint x="${fmt(x)}" y="${fmt(y)}" as="sourcePoint" />`);
  }
  if (finish) {
    const [x, y] = local(finish);
    geometry.push(`<mxPoint x="${fmt(x)}" y="${fmt(y)}" as="targetPoint" />`);
  }
  // Waypoints only where draw.io would route the same way: the corners of an
  // elbowed line. A straight line has none, and a curve's control polygon is
  // not draw.io's (it curves through waypoints, Labre bends towards them).
  if (mode === 1 && path.length > 2) {
    geometry.push(
      '<Array as="points">',
      ...path.slice(1, -1).map(point => {
        const [x, y] = local(point);
        return `  <mxPoint x="${fmt(x)}" y="${fmt(y)}" />`;
      }),
      '</Array>'
    );
  }

  const label = textOf(rec.text).trim();
  const labelPosition = num((rec.labelOffset as Rec | undefined)?.distance);
  const geometryX =
    labelPosition !== undefined && labelPosition !== 0.5
      ? ` x="${fmt(labelPosition * 2 - 1)}"`
      : '';

  const ends = [
    ...(sourceCell ? [`source="${attr(sourceCell)}"`] : []),
    ...(targetCell ? [`target="${attr(targetCell)}"`] : []),
  ].join(' ');

  const xml = [
    `<object ${objectAttrs(entry, htmlLabel(label))}>`,
    `  <mxCell style="${attr(styleString(lead, style))}" edge="1" parent="${attr(parent)}"${ends ? ` ${ends}` : ''}>`,
    `    <mxGeometry${geometryX} relative="1" as="geometry">`,
    ...geometry.map(line => `      ${line}`),
    '    </mxGeometry>',
    '  </mxCell>',
    '</object>',
  ];

  // The per-end labels (ADR 0020) as draw.io's own end-label cells: children
  // of the edge, pinned at -1 (source) and 1 (target) along it.
  const sourceLabel = textOf(rec.sourceLabel).trim();
  const targetLabel = textOf(rec.targetLabel).trim();
  if (sourceLabel) {
    xml.push(
      edgeLabelCell(`${entry.id}-source-label`, entry.id, sourceLabel, -1)
    );
  }
  if (targetLabel) {
    xml.push(
      edgeLabelCell(`${entry.id}-target-label`, entry.id, targetLabel, 1)
    );
  }
  return xml;
}

/**
 * A mindmap's branches. They are painted by the mindmap from its `children`
 * map, never stored as connectors, so they are written here from the same
 * map: one plain line from each node to its parent node.
 */
function mindmapEdges(entry: Entry, vertexIds: ReadonlySet<string>): string[] {
  const children = entry.rec.children as
    | { toJSON?: () => unknown }
    | Rec
    | null
    | undefined;
  const tree = (
    children && typeof children.toJSON === 'function'
      ? children.toJSON()
      : children
  ) as Record<string, { parent?: unknown } | undefined> | null | undefined;
  if (!tree) return [];

  const xml: string[] = [];
  for (const id of Object.keys(tree).sort()) {
    const parentId = str(tree[id]?.parent);
    if (!parentId || !vertexIds.has(id) || !vertexIds.has(parentId)) continue;
    xml.push(
      [
        `<mxCell id="${attr(`${entry.id}-${id}`)}" style="html=1;curved=1;endArrow=none;startArrow=none;" edge="1" parent="${attr(entry.id)}" source="${attr(parentId)}" target="${attr(id)}">`,
        `  <mxGeometry relative="1" as="geometry" />`,
        '</mxCell>',
      ].join('\n        ')
    );
  }
  return xml;
}
