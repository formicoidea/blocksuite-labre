import {
  ShapeStyle,
  ShapeType,
  StrokeStyle,
  TextAlign,
} from '@labre/affine-model';
import DOMPurify from 'dompurify';

import type {
  InterchangeImportContext,
  InterchangeImportResult,
  InterchangeNote,
  SerializedElementProps,
} from './interchange.js';

/**
 * **SVG → a canvas sketch.** The platform's VISUAL-tier importer, shared by
 * every framework that declares it (`docs/adr/0012`, P2).
 *
 * ## The heuristics statement, and its known failure modes
 *
 * _This paragraph is ADR 0012's open question 2 — "each visual capability owes
 * a one-paragraph statement of its heuristics and its known failure modes" —
 * answered ONCE, here, because every framework that declares `…:svg:import`
 * wraps this one function and therefore owes the same statement. It is
 * referenced by `bpmn:svg:import` and by `wardley:svg:import`; a framework that
 * ever wants a narrower or wider guess writes its own parser and its own
 * paragraph beside it._
 *
 * **What it guesses.** An SVG carries a rendering, not a model, so this reader
 * recognises GEOMETRY and nothing else: `<rect>` becomes a rectangle,
 * `<circle>` and `<ellipse>` an ellipse, `<polygon>` a polygon, `<line>`,
 * `<polyline>` and `<path>` a brush stroke sampled at its vertices, and
 * `<text>` an editable free-text element. Fill, stroke, stroke width and font
 * size are carried across where the shape model has a direct equivalent, with
 * CSS inheritance down `<g>` honoured and colours passed through verbatim.
 * Coordinates are user units mapped 1:1 onto canvas units, offset by the
 * `viewBox` origin and by every `translate(…)` on the way down. Everything it
 * emits is an ADR 0007 **level 1** element — a plain shape on the free surface,
 * which the author then PROMOTES. It recognises no role, no relation and no
 * framework vocabulary, and it never claims to: a Wardley component and a text
 * box are both `<rect>` plus `<text>`, and deciding which is which is the one
 * question only the author can answer.
 *
 * **Where it is known to be wrong.** A `scale`, `rotate`, `matrix` or `skew`
 * transform is IGNORED rather than applied, so anything under one lands at its
 * untransformed position and size — one note per transform kind says so.
 * Curves (`C`, `S`, `Q`, `T`, `A`) are flattened to their endpoints, so a
 * rounded connector arrives as a polyline through its anchor points; an arc
 * that doubles back arrives as a straight line. A `<path>` that outlines a
 * filled region (an arrowhead, an icon glyph) arrives as an open stroke, not as
 * a filled shape. `<image>`, `<defs>`, `<marker>`, gradients, filters,
 * `<clipPath>` and `<mask>` are skipped by the reader, and `<use>` and
 * `<foreignObject>` never reach it at all — the SANITIZER removes them, because
 * they are two of the constructs an SVG can carry code in. So a drawing built
 * out of symbol instances arrives nearly empty; each construct kind gets
 * exactly one note, from whichever of the two dropped it, so an empty-looking
 * result always says why. A paint served by `url(#…)` falls back to a neutral.
 * Text width and height are ESTIMATED from the font size and the character
 * count, because measuring text needs a font this function is not allowed to
 * have, so a label box is approximately and not exactly the size it was.
 *
 * ## What it never does
 *
 * **It writes no `interchange` payload, on any element, ever** — P2's hard
 * rule, pinned by an anti-decay test in this package's own spec. There is
 * nothing to preserve that the elements do not already carry: an SVG round-trip
 * would be a re-render rather than a round-trip, and a payload would advertise
 * a promise this tier deliberately does not make. `carried` and `quarantined`
 * are therefore `0` in every report it returns, and the surface that offers the
 * import must say all of this BEFORE the file is read.
 *
 * ## Pure, and framework-agnostic
 *
 * Text in, serialized element props out (P3): no `std`, no surface, no DI, so
 * labre-mcp calls the very same function the editor commands call. It produces
 * only generic `shape` / `text` / `brush` props and knows the name of no
 * framework — which is exactly why several frameworks can declare it. ADR 0012
 * explicitly rejects inferring one framework from a `.svg`, so the capability
 * is declared per framework and this parser is what each of them wraps.
 */

/* ── The format, as far as it is shared ───────────────────────────────── */

/**
 * The format id. Never used as a payload key, unlike every semantic format's —
 * a visual import writes no payload at all — but it is what the report's
 * headline calls itself ("SVG imported"), and what the registry's triple is
 * built from.
 */
export const SVG_SKETCH_FORMAT_ID = 'svg';
export const SVG_SKETCH_EXTENSION = '.svg';
export const SVG_SKETCH_MIME = 'image/svg+xml';

/* ── Small readers ────────────────────────────────────────────────────── */

/**
 * happy-dom (the vitest environment two of the three packages that test this
 * run in) does not implement namespace-aware lookups, so this file walks
 * children by hand and compares `localName`, exactly as the BPMN reader does.
 * `children` is also skipped in favour of `childNodes`, because the former is
 * an `HTMLCollection` whose behaviour on a foreign-namespaced document is one
 * more thing that differs between the two environments.
 */
const ELEMENT_NODE = 1;

function childElements(parent: Element): Element[] {
  const found: Element[] = [];
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === ELEMENT_NODE) found.push(node as Element);
  }
  return found;
}

const nameOf = (element: Element) => element.localName?.toLowerCase() ?? '';

/** One attribute as a finite number, or the caller's default. */
function num(element: Element, name: string, fallback = 0): number {
  const raw = element.getAttribute(name);
  if (raw === null) return fallback;
  // `parseFloat` and not `Number`, because a length is allowed to carry a unit
  // (`12px`, `2em`). Only user units are honoured — anything else is read as
  // its number, which is right for `px` and an approximation for the rest. A
  // sketch is what this reader promises.
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

/** Every number in a string, in order — `points`, `viewBox`, a transform's args. */
function numbers(raw: string): number[] {
  const found = raw.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  return found ? found.map(Number).filter(Number.isFinite) : [];
}

/* ── Notes: one per KIND, never one per instance ──────────────────────── */

/**
 * The note channel, deduplicated on a key.
 *
 * D1's discipline, carried across to a tier that has no D1: nothing is dropped
 * silently. What changes is the GRANULARITY — a file with four hundred
 * `<use>` instances is one fact about the file, not four hundred, and a report
 * nobody reads to the end is a report that was not written.
 *
 * Every note is a `warning`. The other four kinds would be lies here:
 * `carried` and `quarantined` describe a payload this tier does not write, and
 * `substituted-id` and `invented-layout` describe promises it does not make.
 */
class Notebook {
  private readonly seen = new Set<string>();

  readonly notes: InterchangeNote[] = [];

  once(key: string, message: string, element?: string): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.notes.push({
      kind: 'warning',
      message,
      ...(element ? { element } : {}),
    });
  }
}

/* ── Presentation, inherited the way CSS inherits it ──────────────────── */

/** The presentation attributes this reader knows how to spend. */
interface Paint {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
}

/** `style="fill:#fff;stroke:none"`, as a map. Wins over the attribute. */
function styleMap(element: Element): Map<string, string> {
  const map = new Map<string, string>();
  const raw = element.getAttribute('style');
  if (!raw) return map;
  for (const declaration of raw.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (property && value) map.set(property, value);
  }
  return map;
}

/**
 * This element's paint, on top of what it inherited.
 *
 * Inheritance is not a nicety: real files — bpmn.io's, mermaid's, Illustrator's
 * — set `fill` and `stroke` once on a `<g>` and never again, so a reader that
 * only looked at the leaf would import every shape in the SVG's initial colours
 * and get the picture visibly wrong.
 */
function paintOf(element: Element, inherited: Paint): Paint {
  const style = styleMap(element);
  const read = (property: string): string | undefined =>
    style.get(property) ?? element.getAttribute(property) ?? undefined;

  const strokeWidth = read('stroke-width');
  const fontSize = read('font-size');
  const parsedWidth =
    strokeWidth === undefined ? undefined : Number.parseFloat(strokeWidth);
  const parsedFont =
    fontSize === undefined ? undefined : Number.parseFloat(fontSize);

  return {
    fill: read('fill') ?? inherited.fill,
    stroke: read('stroke') ?? inherited.stroke,
    strokeWidth:
      parsedWidth !== undefined && Number.isFinite(parsedWidth)
        ? parsedWidth
        : inherited.strokeWidth,
    fontSize:
      parsedFont !== undefined && Number.isFinite(parsedFont)
        ? parsedFont
        : inherited.fontSize,
  };
}

/** The SVG initial values, which is what an unpainted element actually is. */
const INITIAL_PAINT: Paint = { fill: 'black', stroke: 'none', strokeWidth: 1 };

/** The font size a `<text>` with none declared is drawn at. */
const DEFAULT_FONT_SIZE = 16;

/** What a paint served by `url(#…)` or `currentColor` falls back to. */
const NEUTRAL_STROKE = '#000000';
const NEUTRAL_FILL = '#cccccc';

/**
 * A paint value as a colour the shape model will accept, or `undefined` for
 * "nothing is painted here".
 *
 * The model takes a raw CSS colour string (`Color` is `string | {normal} |
 * {dark, light}`), so a hex or an `rgb()` from the file is passed through
 * verbatim and the picture keeps its colours. Two values cannot be: a paint
 * server (`url(#gradient)`) needs a `<defs>` this reader skips, and
 * `currentColor` needs an inherited CSS colour there is nobody to ask for.
 * Both fall back to a neutral and are noted once.
 */
function colorOf(
  raw: string | undefined,
  fallback: string,
  notes: Notebook
): string | undefined {
  const value = raw?.trim();
  if (!value || value === 'none' || value === 'transparent') return undefined;
  if (value.startsWith('url(')) {
    notes.once(
      'paint-server',
      'Gradients and patterns are not read; the shapes that used one are a flat neutral.'
    );
    return fallback;
  }
  if (value === 'currentColor' || value === 'inherit') return fallback;
  return value;
}

/* ── Geometry ─────────────────────────────────────────────────────────── */

const xywh = (x: number, y: number, w: number, h: number) =>
  `[${x},${y},${w},${h}]`;

/**
 * The `translate(…)` this element contributes, and a note for every other kind
 * of transform on it.
 *
 * v1 accumulates translations and IGNORES the rest — a scaled or rotated
 * element is imported at its untransformed position rather than dropped,
 * because a sketch missing a shape is worse than a sketch with a shape in the
 * wrong place, and the author is about to move things anyway. What is not
 * acceptable is doing it quietly, so each ignored KIND is named once.
 */
function translateOf(element: Element, notes: Notebook): [number, number] {
  const raw = element.getAttribute('transform');
  if (!raw) return [0, 0];

  let tx = 0;
  let ty = 0;
  for (const [, kind, args] of raw.matchAll(
    /([a-zA-Z]+)\s*\(([^)]*)\)/g
  ) as Iterable<RegExpMatchArray>) {
    const values = numbers(args);
    if (kind === 'translate') {
      tx += values[0] ?? 0;
      ty += values[1] ?? 0;
      continue;
    }
    notes.once(
      `transform:${kind}`,
      `\`${kind}\` transforms are ignored (best effort): what carried one is placed as if it did not.`
    );
  }
  return [tx, ty];
}

/* ── Path data ────────────────────────────────────────────────────────── */

/** How many numbers each path command takes, and where its ENDPOINT sits. */
const PATH_ARITY: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
};

/** The index, inside one command's arguments, of the x of its endpoint. */
const PATH_ENDPOINT: Record<string, number> = { c: 4, s: 2, q: 2, a: 5 };

/** The commands whose shape is thrown away when only the endpoint is kept. */
const CURVE_COMMANDS = new Set(['c', 's', 'q', 't', 'a']);

/**
 * A `d` attribute as one polyline per subpath.
 *
 * `M/L/H/V/Z` are exact. Curves are flattened to their ENDPOINTS — coarse, and
 * deliberately so: this is a sketch, the author is going to redraw whatever
 * matters, and a proper flattener is a de Casteljau subdivision plus an arc
 * parameterization for a fidelity nobody is promised. The first curve in the
 * file says so in a note.
 *
 * A subpath per stroke, rather than one stroke through the whole `d`: a brush
 * element is a single connected path, so joining two subpaths would draw a line
 * across the drawing that the file never had.
 */
function samplePath(d: string, notes: Notebook): number[][][] {
  const subpaths: number[][][] = [];
  let current: number[][] = [];
  let start: [number, number] | null = null;
  let x = 0;
  let y = 0;

  const push = () => {
    if (current.length >= 2) subpaths.push(current);
    current = [];
  };

  for (const [, letter, rawArgs] of d.matchAll(
    /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
  ) as Iterable<RegExpMatchArray>) {
    const kind = letter.toLowerCase();
    const relative = letter !== letter.toUpperCase();
    const arity = PATH_ARITY[kind];
    const args = numbers(rawArgs);

    if (kind === 'z') {
      if (start && current.length > 0) current.push([start[0], start[1]]);
      [x, y] = start ?? [x, y];
      push();
      continue;
    }
    if (CURVE_COMMANDS.has(kind)) {
      notes.once(
        'curve',
        'Curves are approximated by their endpoints (best effort), so a curved path arrives as straight segments.'
      );
    }

    // One command letter may carry SEVERAL argument groups (`L 1 2 3 4`), and
    // a repeated `M` group is an implicit lineto — the spec's own rule, and the
    // one every hand-written path generator relies on.
    let group = 0;
    for (let i = 0; i + arity <= args.length; i += arity, group += 1) {
      const chunk = args.slice(i, i + arity);
      if (kind === 'h') {
        x = relative ? x + chunk[0] : chunk[0];
      } else if (kind === 'v') {
        y = relative ? y + chunk[0] : chunk[0];
      } else {
        const at = PATH_ENDPOINT[kind] ?? 0;
        const [ex, ey] = [chunk[at], chunk[at + 1]];
        x = relative ? x + ex : ex;
        y = relative ? y + ey : ey;
      }

      if (kind === 'm' && group === 0) {
        push();
        start = [x, y];
      }
      current.push([x, y]);
    }
  }
  push();
  return subpaths;
}

/* ── The walk ─────────────────────────────────────────────────────────── */

/** Everything one walk accumulates. Never a surface, never an id. */
interface Sketch {
  elements: SerializedElementProps[];
  notes: Notebook;
}

/** The generic shape props every recognised outline lands with. */
function shapeProps(paint: Paint, sketch: Sketch): SerializedElementProps {
  const fill = colorOf(paint.fill, NEUTRAL_FILL, sketch.notes);
  const stroke = colorOf(paint.stroke, NEUTRAL_STROKE, sketch.notes);
  return {
    type: 'shape',
    // `General`, never `Scribbled`: the file is a rendering somebody produced
    // deliberately, and re-drawing it hand-sketched would be this reader
    // inventing a style the source never had.
    shapeStyle: ShapeStyle.General,
    filled: fill !== undefined,
    fillColor: fill ?? 'transparent',
    strokeColor: stroke ?? 'transparent',
    strokeStyle: stroke === undefined ? StrokeStyle.None : StrokeStyle.Solid,
    strokeWidth: paint.strokeWidth ?? 1,
  };
}

function readRect(
  element: Element,
  dx: number,
  dy: number,
  paint: Paint,
  sketch: Sketch
): void {
  const w = num(element, 'width');
  const h = num(element, 'height');
  if (w <= 0 || h <= 0) {
    sketch.notes.once(
      'empty-box',
      'Shapes with no width or height were skipped.'
    );
    return;
  }
  // `rx` is an absolute corner radius in user units, and the shape model reads
  // a `radius` of 1 or more as absolute pixels (below 1 it is a RATIO of the
  // shorter side). Sub-pixel radii are visually zero, so they are dropped
  // rather than reinterpreted as a 40 % round-over.
  const rx = num(element, 'rx', num(element, 'ry'));
  sketch.elements.push({
    ...shapeProps(paint, sketch),
    shapeType: ShapeType.Rect,
    radius: rx >= 1 ? rx : 0,
    xywh: xywh(num(element, 'x') + dx, num(element, 'y') + dy, w, h),
  });
}

function readEllipse(
  element: Element,
  dx: number,
  dy: number,
  paint: Paint,
  sketch: Sketch
): void {
  const circle = nameOf(element) === 'circle';
  const r = num(element, 'r');
  const rx = circle ? r : num(element, 'rx');
  const ry = circle ? r : num(element, 'ry');
  if (rx <= 0 || ry <= 0) {
    sketch.notes.once(
      'empty-box',
      'Shapes with no width or height were skipped.'
    );
    return;
  }
  const cx = num(element, 'cx') + dx;
  const cy = num(element, 'cy') + dy;
  sketch.elements.push({
    ...shapeProps(paint, sketch),
    shapeType: ShapeType.Ellipse,
    radius: 0,
    xywh: xywh(cx - rx, cy - ry, rx * 2, ry * 2),
  });
}

/**
 * A `<polygon>` as a polygon shape, with its outline kept.
 *
 * The shape model stores polygon `vertices` NORMALIZED into its bounding box
 * (`[0, 1]` on each axis), which is what lets the shape be resized afterwards
 * and is how EDGY's activity chevron is already declared. Two cases cannot be
 * normalized and fall back to the bounding box as a plain rectangle, each with
 * a note: fewer than three points is not an outline, and a polygon flat on one
 * axis has a zero-width box to divide by.
 */
function readPolygon(
  element: Element,
  dx: number,
  dy: number,
  paint: Paint,
  sketch: Sketch
): void {
  const flat = numbers(element.getAttribute('points') ?? '');
  const points: number[][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    points.push([flat[i] + dx, flat[i + 1] + dy]);
  }
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;

  if (points.length < 3 || w <= 0 || h <= 0) {
    if (points.length === 0 || w < 0 || h < 0) {
      sketch.notes.once(
        'empty-box',
        'Shapes with no width or height were skipped.'
      );
      return;
    }
    sketch.notes.once(
      'flat-polygon',
      'A polygon with fewer than three corners, or flat on one axis, arrives as its bounding rectangle.'
    );
    sketch.elements.push({
      ...shapeProps(paint, sketch),
      shapeType: ShapeType.Rect,
      radius: 0,
      xywh: xywh(minX, minY, Math.max(w, 1), Math.max(h, 1)),
    });
    return;
  }

  sketch.elements.push({
    ...shapeProps(paint, sketch),
    shapeType: ShapeType.Polygon,
    radius: 0,
    vertices: points.map(([px, py]) => [(px - minX) / w, (py - minY) / h]),
    isClosed: true,
    xywh: xywh(minX, minY, w, h),
  });
}

/**
 * A stroke — `<line>`, `<polyline>`, `<path>` — as one brush element per
 * connected run of points.
 *
 * The points handed over are ABSOLUTE, which is what the brush tool itself
 * passes: the model's own `@convert` re-bases them onto the bound it derives,
 * so an importer that pre-computed `xywh` would be doing that arithmetic twice
 * and disagreeing with the model about the line-width inflation.
 */
function pushStroke(points: number[][], paint: Paint, sketch: Sketch): void {
  if (points.length < 2) return;
  const color =
    colorOf(paint.stroke, NEUTRAL_STROKE, sketch.notes) ??
    // A path with no stroke and a fill is an outlined REGION — an arrowhead, a
    // glyph. It is drawn as a stroke anyway (a brush is the only thing this
    // reader has for an open path), so it takes the fill's colour rather than
    // arriving invisible.
    colorOf(paint.fill, NEUTRAL_STROKE, sketch.notes) ??
    NEUTRAL_STROKE;
  sketch.elements.push({
    type: 'brush',
    color,
    lineWidth: Math.max(paint.strokeWidth ?? 1, 1),
    points,
  });
}

/**
 * `<text>` and its `<tspan>`s as an EDITABLE free-text element.
 *
 * The PO-critical path, and the one thing this tier promises without
 * qualification: a label that arrives as a picture of a word is a label nobody
 * can correct. `text` is handed over as a plain string and
 * `TextElementModel.propsToY` turns it into the `Y.Text` the editor binds to,
 * so the first double-click puts a caret in it.
 *
 * Two approximations are unavoidable and are stated rather than hidden. SVG's
 * `y` is a BASELINE and the model's box is a top edge, so the box is lifted by
 * one font size. And the box's width is estimated from the character count,
 * because measuring text needs a loaded font — which is exactly the thing a
 * pure function of a string is not allowed to have.
 */
const CHARACTER_WIDTH_RATIO = 0.55;
const LINE_HEIGHT_RATIO = 1.2;

function readText(
  element: Element,
  dx: number,
  dy: number,
  paint: Paint,
  sketch: Sketch
): void {
  const spans = childElements(element).filter(
    child => nameOf(child) === 'tspan'
  );
  const lines = (
    spans.length > 0
      ? spans.map(span => span.textContent ?? '')
      : [element.textContent ?? '']
  )
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    sketch.notes.once('empty-text', 'Empty text elements were skipped.');
    return;
  }

  const fontSize = paint.fontSize ?? DEFAULT_FONT_SIZE;
  const widest = Math.max(...lines.map(line => line.length));
  const w = Math.max(widest * fontSize * CHARACTER_WIDTH_RATIO, fontSize);
  const h = lines.length * fontSize * LINE_HEIGHT_RATIO;

  // `text-anchor` says which end of the box `x` names. Honouring it is what
  // keeps a centred bpmn.io label centred on the task it labels.
  const anchor = (
    styleMap(element).get('text-anchor') ??
    element.getAttribute('text-anchor') ??
    'start'
  ).trim();
  const align =
    anchor === 'middle'
      ? TextAlign.Center
      : anchor === 'end'
        ? TextAlign.Right
        : TextAlign.Left;
  const shift = anchor === 'middle' ? w / 2 : anchor === 'end' ? w : 0;

  sketch.elements.push({
    type: 'text',
    text: lines.join('\n'),
    fontSize,
    textAlign: align,
    color: colorOf(paint.fill, NEUTRAL_STROKE, sketch.notes) ?? NEUTRAL_STROKE,
    xywh: xywh(
      num(element, 'x') + dx - shift,
      num(element, 'y') + dy - fontSize,
      w,
      h
    ),
  });
}

/** The names that are containers rather than drawings. */
const CONTAINERS = new Set(['g', 'a', 'switch']);

/** The sanitizer's own HTML wrapper, which no `.svg` on a disk ever contained. */
const PARSER_SCAFFOLDING = new Set(['html', 'head', 'body']);

function walk(
  parent: Element,
  dx: number,
  dy: number,
  inherited: Paint,
  sketch: Sketch
): void {
  for (const element of childElements(parent)) {
    const name = nameOf(element);
    const [tx, ty] = translateOf(element, sketch.notes);
    const x = dx + tx;
    const y = dy + ty;
    const paint = paintOf(element, inherited);

    if (CONTAINERS.has(name)) {
      walk(element, x, y, paint, sketch);
      continue;
    }
    if (name === 'svg') {
      // A nested `<svg>` is a new viewport: its own `x`/`y` offset it, and its
      // `viewBox` re-origins it exactly as the outermost one does.
      const [vx, vy] = viewBoxOffset(element);
      walk(
        element,
        x + num(element, 'x') + vx,
        y + num(element, 'y') + vy,
        paint,
        sketch
      );
      continue;
    }

    switch (name) {
      case 'rect':
        readRect(element, x, y, paint, sketch);
        break;
      case 'circle':
      case 'ellipse':
        readEllipse(element, x, y, paint, sketch);
        break;
      case 'polygon':
        readPolygon(element, x, y, paint, sketch);
        break;
      case 'line':
        pushStroke(
          [
            [num(element, 'x1') + x, num(element, 'y1') + y],
            [num(element, 'x2') + x, num(element, 'y2') + y],
          ],
          paint,
          sketch
        );
        break;
      case 'polyline': {
        const flat = numbers(element.getAttribute('points') ?? '');
        const points: number[][] = [];
        for (let i = 0; i + 1 < flat.length; i += 2) {
          points.push([flat[i] + x, flat[i + 1] + y]);
        }
        pushStroke(points, paint, sketch);
        break;
      }
      case 'path':
        for (const subpath of samplePath(
          element.getAttribute('d') ?? '',
          sketch.notes
        )) {
          pushStroke(
            subpath.map(([px, py]) => [px + x, py + y]),
            paint,
            sketch
          );
        }
        break;
      case 'text':
        readText(element, x, y, paint, sketch);
        break;
      default:
        // Everything this reader has no artefact for, named ONCE per kind:
        // `<use>`, `<image>`, `<defs>`, `<marker>`, the gradients, the filters,
        // `<foreignObject>`, and whatever SVG grows next. A drawing built out
        // of symbol instances arrives nearly empty, and this is the line that
        // tells its author why instead of leaving them to guess.
        sketch.notes.once(
          `skipped:${name}`,
          `\`<${name}>\` is not recognised and was skipped.`,
          name
        );
    }
  }
}

/** `viewBox="minX minY w h"` as the offset that puts its origin at (0, 0). */
function viewBoxOffset(root: Element): [number, number] {
  const raw = root.getAttribute('viewBox');
  if (!raw) return [0, 0];
  const values = numbers(raw);
  if (values.length < 4) return [0, 0];
  return [-values[0], -values[1]];
}

/* ── The capability's function ────────────────────────────────────────── */

/**
 * The document, sanitized, or an exception naming what is wrong with it.
 *
 * Well-formedness FIRST, because `DOMParser` reports a malformed document as a
 * `parsererror` element rather than by throwing — a verdict in the shape of a
 * document — and because DOMPurify's parser is the forgiving HTML one, which
 * would quietly repair the very thing the caller needs to be told about. So:
 * parse for the verdict, reading nothing out of the result but that; sanitize
 * the SOURCE; and walk only what came back from the sanitizer.
 *
 * The sanitizer is not optional and it is not defensive programming. An `.svg`
 * is an executable document — `<script>`, `<foreignObject>` with markup, event
 * handler attributes — handed over by whoever sent the file. The same
 * `USE_PROFILES: { svg: true }` guard is what the edgeless clipboard already
 * puts in front of a pasted SVG.
 */
function parseSvgRoot(source: string, notes: Notebook): Element {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const error = doc.querySelector('parsererror');
  if (error) {
    throw new Error(
      `This file is not well-formed XML, so no drawing can be read out of it: ` +
        `${(error.textContent ?? '').trim().slice(0, 200)}`
    );
  }
  if (nameOf(doc.documentElement) !== 'svg') {
    throw new Error(
      `An SVG opens on <svg>; this one opens on <${doc.documentElement?.localName ?? 'nothing'}>.`
    );
  }

  const clean = DOMPurify.sanitize(source, {
    USE_PROFILES: { svg: true },
    RETURN_DOM: true,
  }) as unknown as Element;

  // …and then say what the sanitizer took, which is NOT the same list as what
  // the walk below skips. `<use>` and `<foreignObject>` never reach the walk at
  // all — they are two of the SVG format's genuine attack surfaces and DOMPurify
  // removes them outright — so a drawing built out of symbol instances arrives
  // empty. Without this the only remark would be "nothing was recognised",
  // which is true and useless. `DOMPurify.removed` is repopulated by each call
  // and is read here immediately, before anything else can sanitize.
  for (const entry of DOMPurify.removed) {
    const removed = entry as { element?: Node; attribute?: { name?: string } };
    if (removed.element) {
      // The node's OWN spelling, because `foreignObject` is camel-cased in the
      // format and a remark that called it `foreignobject` would send its
      // reader looking for something the spec does not have. The dedup key is
      // folded; the sentence is not.
      const name = removed.element.nodeName ?? '';
      // The sanitizer parses into an HTML document and reports unwinding its
      // own wrapper as a removal. Nobody wrote a `<body>` into an `.svg`, and a
      // remark about one would be this reader telling the user about its own
      // plumbing.
      if (PARSER_SCAFFOLDING.has(name.toLowerCase())) continue;
      notes.once(
        `removed:${name.toLowerCase()}`,
        `\`<${name}>\` was removed while sanitizing the file — it is one of the constructs an SVG can carry code in — so nothing it drew was imported.`,
        name
      );
    } else if (removed.attribute) {
      notes.once(
        'removed-attribute',
        'Unsafe attributes (event handlers, script URLs) were removed while sanitizing the file.'
      );
    }
  }

  const root = childElements(clean).find(child => nameOf(child) === 'svg');
  if (!root) {
    throw new Error(
      'Nothing survived sanitizing this SVG, so there is no drawing to read.'
    );
  }
  return root;
}

/**
 * An SVG file as a canvas sketch — the shared VISUAL-tier importer.
 *
 * See this module's own documentation for the heuristics statement and the
 * known failure modes (ADR 0012, open question 2). The contract in one
 * sentence: the picture arrives as editable elements, and nothing else is
 * promised.
 *
 * A blank or unrecognisable drawing is `0` elements and a note, NOT an
 * exception: the file was read, it simply held nothing this reader draws, and a
 * throw would show the user an error toast where the truth is a remark.
 * Malformed XML is the exception, because then the file was not read at all.
 */
export function parseSvgSketch(
  source: string,
  context: InterchangeImportContext = {}
): InterchangeImportResult {
  // A sketch has no document-level name to take: what a board is CALLED is the
  // document's business, not any element's. Same answer the BPMN reader gives.
  void context;

  const sketch: Sketch = { elements: [], notes: new Notebook() };
  const root = parseSvgRoot(source, sketch.notes);
  const [vx, vy] = viewBoxOffset(root);
  walk(root, vx, vy, INITIAL_PAINT, sketch);

  if (sketch.elements.length === 0) {
    sketch.notes.once(
      'empty',
      'No shape or text was recognised in this SVG, so nothing was drawn.'
    );
  }

  return {
    elements: sketch.elements,
    report: {
      mapped: sketch.elements.length,
      // Always zero, and it is the tier's whole contract rather than an
      // accident of this file: a visual import carries nothing and quarantines
      // nothing, because it writes no `interchange` payload to carry anything
      // IN (ADR 0012, P2). Pinned by an anti-decay test.
      carried: 0,
      quarantined: 0,
      notes: sketch.notes.notes,
      // …and no `sourceVersion`. An SVG declares a version of the SVG spec, not
      // a version of a vocabulary this reader translates, so claiming one would
      // be a fact about the file dressed up as a fact about the import.
    },
  };
}
