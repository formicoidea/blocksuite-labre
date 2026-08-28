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
 * `<text>` an editable free-text element. Fill, stroke, stroke width, font size
 * and text anchor are carried across where the shape model has a direct
 * equivalent, with CSS inheritance down `<g>` honoured and colours passed
 * through verbatim. Coordinates are user units placed by the outermost
 * viewport: the `viewBox` origin is subtracted and the `viewBox`-to-`width`
 * scale is applied uniformly (`min(width / viewBox width, height / viewBox
 * height)`, which is what the default `preserveAspectRatio` means), then every
 * `translate(…)` on the way down. Everything it emits is an ADR 0007 **level 1**
 * element — a plain shape on the free surface, which the author then PROMOTES.
 * It recognises no role, no relation and no framework vocabulary, and it never
 * claims to: a Wardley component and a text box are both `<rect>` plus
 * `<text>`, and deciding which is which is the one question only the author can
 * answer.
 *
 * **Where it is known to be wrong, and the list is meant to be complete.** A
 * `scale`, `rotate`, `matrix` or `skew` transform is IGNORED rather than
 * applied, so anything under one lands at its untransformed position and size.
 * Curves (`C`, `S`, `Q`, `T`, `A`) are flattened to their endpoints, so a
 * rounded connector arrives as a polyline through its anchor points and an arc
 * that doubles back arrives as a straight line. A `<path>` that outlines a
 * filled region (an arrowhead, an icon glyph) arrives as an open stroke, not as
 * a filled shape. `<image>`, `<defs>`, `<marker>`, gradients, filters,
 * `<clipPath>` and `<mask>` are skipped by the reader, and `<use>` and
 * `<foreignObject>` never reach it at all — the SANITIZER removes them, because
 * they are two of the constructs an SVG can carry code in. A `<style>` sheet is
 * skipped, and that one is worth naming twice: mermaid paints almost entirely
 * through CSS classes, so a mermaid SVG arrives in the initial colours — mostly
 * black — with only the note to say why. `<title>`, `<desc>` and `<metadata>`
 * are dropped in silence, deliberately and as the only exception to the rule
 * below: they render nothing, so there is nothing to have lost.
 *
 * **What this reader alters without a note, because a note could not help.**
 * Text width and height are ESTIMATED from the font size and the character
 * count, because measuring text needs a font a pure function of a string is not
 * allowed to have, so a label box is approximately and not exactly the size it
 * was. Whitespace inside a label is collapsed to single spaces and trimmed
 * (`xml:space="preserve"` is not honoured). A `<tspan>`'s own `x`/`y`, its `dx`
 * / `dy` offsets and `dominant-baseline` are ignored, so a label laid out span
 * by span arrives as plain stacked lines in document order. `stroke-dasharray`
 * is not read, so a dashed line arrives solid. `em` font sizes are resolved
 * against the inherited size only, with no font-relative refinement.
 *
 * **Everything else is reported.** Every OTHER construct this reader ignores,
 * alters or cannot resolve produces exactly one `warning` note per KIND — never
 * one per instance — so a result that looks empty always says why.
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
const TEXT_NODE = 3;
const CDATA_NODE = 4;

// `Node` and not `Element`, because only `childNodes` is ever read and one
// caller is DOMPurify's `RETURN_DOM` answer — which its own typed overload
// declares as a `Node`. Widening the parameter is more honest than casting the
// argument at that one call site.
function childElements(parent: Node): Element[] {
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

/**
 * A length that must be an absolute number of user units, or `0`.
 *
 * `width="100%"` is the case this exists for: `parseFloat` reads it as `100`,
 * and a viewport 100 units wide against a 1000-unit `viewBox` would scale the
 * whole drawing to a tenth of its size. A percentage is a length this reader
 * cannot resolve — it depends on a containing block there is none of — so it
 * answers "no length declared" and the caller falls back to 1:1.
 */
function absoluteLength(element: Element, name: string): number {
  const raw = element.getAttribute(name);
  if (raw === null || raw.includes('%')) return 0;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
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

/** The presentation properties this reader knows how to spend. */
interface Paint {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  /** Inherited, because `text-anchor` is an inherited CSS property. */
  textAnchor?: string;
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
 * `12`, `12px`, `12pt`, `1.5em` as a number of user units, or `undefined` for
 * "this reader cannot resolve it, and has said so".
 *
 * Three units and no more. `px` and a bare number are user units already, `pt`
 * is 4/3 of one by CSS's own definition, and `em` is the INHERITED size — which
 * this reader has, and which is the only font-relative context a pure function
 * of a string can honestly claim. Everything else (`%`, `ex`, `ch`, `rem`, the
 * viewport units) needs a containing block or a loaded font, so it is refused
 * with a note rather than silently read as its number: `font-size="200%"` read
 * as 200 would draw a label fourteen times too big.
 */
function fontSizeOf(raw: string, inherited: number, notes: Notebook) {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  // The tail after the number as WRITTEN, not after `String(value)` — `12.0px`
  // and `12px` are the same length and `String(12)` is two characters.
  const unit = raw
    .trim()
    .replace(/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/, '')
    .trim()
    .toLowerCase();
  if (unit === '' || unit === 'px') return value;
  if (unit === 'pt') return (value * 4) / 3;
  if (unit === 'em') return value * inherited;
  notes.once(
    `font-unit:${unit}`,
    `Font sizes in \`${unit}\` cannot be resolved without a page to measure against; those labels use the inherited size.`
  );
  return undefined;
}

/**
 * This element's paint, on top of what it inherited.
 *
 * Inheritance is not a nicety: real files — bpmn.io's, mermaid's, Illustrator's
 * — set `fill` and `stroke` once on a `<g>` and never again, so a reader that
 * only looked at the leaf would import every shape in the SVG's initial colours
 * and get the picture visibly wrong.
 */
function paintOf(element: Element, inherited: Paint, notes: Notebook): Paint {
  const style = styleMap(element);
  // `inherit` is resolved HERE, where the inherited value is in hand, rather
  // than downstream where the only honest answer would be a neutral: the
  // keyword means "whatever my parent had", and this function is the one place
  // that knows.
  const read = (property: string): string | undefined => {
    const raw = style.get(property) ?? element.getAttribute(property);
    return raw === null || raw === undefined || raw.trim() === 'inherit'
      ? undefined
      : raw;
  };

  const strokeWidth = read('stroke-width');
  const parsedWidth =
    strokeWidth === undefined ? undefined : Number.parseFloat(strokeWidth);
  const fontSize = read('font-size');

  return {
    fill: read('fill') ?? inherited.fill,
    stroke: read('stroke') ?? inherited.stroke,
    strokeWidth:
      parsedWidth !== undefined && Number.isFinite(parsedWidth)
        ? parsedWidth
        : inherited.strokeWidth,
    fontSize:
      (fontSize === undefined
        ? undefined
        : fontSizeOf(
            fontSize,
            inherited.fontSize ?? DEFAULT_FONT_SIZE,
            notes
          )) ?? inherited.fontSize,
    textAnchor: read('text-anchor') ?? inherited.textAnchor,
  };
}

/**
 * Whether this element renders at all, with a note for each reason it does not.
 *
 * `display:none` removes the element AND its subtree from the rendering;
 * `visibility:hidden` hides the element but not necessarily its children — this
 * reader treats both as "skip the subtree", which is the coarser of the two and
 * the one that keeps an invisible frame from arriving as a black rectangle over
 * the drawing. Both are common: bpmn.io hides its own measurement layers this
 * way, and an exporter's off-canvas scaffolding is the usual source of a
 * "why is there a huge black box on my board" report.
 */
function isHidden(element: Element, notes: Notebook): boolean {
  const style = styleMap(element);
  const display = style.get('display') ?? element.getAttribute('display');
  if (display?.trim() === 'none') {
    notes.once(
      'hidden:display',
      'Parts of the file marked `display:none` were not imported — they draw nothing where the file came from either.'
    );
    return true;
  }
  const visibility =
    style.get('visibility') ?? element.getAttribute('visibility');
  const hidden = visibility?.trim();
  if (hidden === 'hidden' || hidden === 'collapse') {
    notes.once(
      'hidden:visibility',
      'Parts of the file marked `visibility:hidden` were not imported — they draw nothing where the file came from either.'
    );
    return true;
  }
  return false;
}

/**
 * Opacity is not carried, and that is a note rather than a drop.
 *
 * The shape model has no opacity of its own — a colour is a colour — so a
 * half-transparent shade would have to be baked into the colour, which needs
 * the backdrop it sits on. It is imported at full strength, which is visible
 * and editable, and the note says the strength changed.
 */
function noteOpacity(element: Element, notes: Notebook): void {
  const style = styleMap(element);
  for (const property of ['opacity', 'fill-opacity', 'stroke-opacity']) {
    const raw = style.get(property) ?? element.getAttribute(property);
    if (raw === null || raw === undefined) continue;
    const value = Number.parseFloat(raw);
    if (Number.isFinite(value) && value < 1) {
      notes.once(
        'opacity',
        'Transparency is not carried: partly transparent shapes arrive at full strength.'
      );
      return;
    }
  }
}

/**
 * The SVG initial values, which is what an unpainted element actually is.
 *
 * `fill: black` is the SPEC's initial value, not a choice — an attribute-free
 * `<rect>` renders as a solid black box in every browser, and importing it
 * hollow would be this reader redrawing the file rather than reading it.
 */
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
 * Both fall back to a neutral, and both say so.
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
  if (value === 'currentColor') {
    notes.once(
      'current-color',
      '`currentColor` has no page to inherit from here; the shapes that used it are a flat neutral.'
    );
    return fallback;
  }
  return value;
}

/* ── Geometry: one frame, carried down the tree ───────────────────────── */

/**
 * How a user-space coordinate at this depth becomes a canvas coordinate:
 * `canvas = user * s + o`.
 *
 * Carrying the SCALE rather than only the offset is what makes a `viewBox`
 * honest. `width="200" viewBox="0 0 1000 1000"` is a drawing authored at 1000
 * units and displayed at 200; reading its coordinates 1:1 imports it five times
 * too big, and every stroke width and font size with it. The factor is uniform
 * — `min(width / viewBox width, height / viewBox height)` — because that is
 * what the default `preserveAspectRatio` (`xMidYMid meet`) means, and a
 * non-uniform read would need a shape model with independent axes.
 */
interface Frame {
  ox: number;
  oy: number;
  s: number;
}

const IDENTITY: Frame = { ox: 0, oy: 0, s: 1 };

const px = (frame: Frame, x: number) => x * frame.s + frame.ox;
const py = (frame: Frame, y: number) => y * frame.s + frame.oy;
/** A LENGTH is scaled and never offset — a width, a radius, a font size. */
const len = (frame: Frame, value: number) => value * frame.s;

const xywh = (x: number, y: number, w: number, h: number) =>
  `[${x},${y},${w},${h}]`;

/**
 * The frame a `<svg>` element establishes inside its parent's.
 *
 * The same arithmetic for the outermost one (whose parent frame is the
 * identity) and for a nested one, which is why there is one function: a nested
 * `<svg>` is a new viewport, its `x`/`y` place it in the parent's user space,
 * and its own `viewBox` re-origins and re-scales what is inside it.
 */
function viewportFrame(element: Element, parent: Frame): Frame {
  const placed: Frame = {
    ox: px(parent, num(element, 'x')),
    oy: py(parent, num(element, 'y')),
    s: parent.s,
  };

  const box = numbers(element.getAttribute('viewBox') ?? '');
  if (box.length < 4) return placed;
  const [minX, minY, boxW, boxH] = box;
  if (boxW <= 0 || boxH <= 0) return placed;

  const width = absoluteLength(element, 'width');
  const height = absoluteLength(element, 'height');
  // No declared size is not a broken file — it is the usual `<svg viewBox=…>`
  // that fills whatever it is put in. There is no containing block here, so the
  // viewBox IS the size and the scale stays the parent's.
  const scale =
    width > 0 && height > 0
      ? placed.s * Math.min(width / boxW, height / boxH)
      : placed.s;

  return {
    ox: placed.ox - minX * scale,
    oy: placed.oy - minY * scale,
    s: scale,
  };
}

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
function translated(element: Element, frame: Frame, notes: Notebook): Frame {
  const raw = element.getAttribute('transform');
  if (!raw) return frame;

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
  // A translate is expressed in the PARENT's user units, so it is scaled by the
  // frame it was written in and never by the one it creates.
  return {
    ox: frame.ox + tx * frame.s,
    oy: frame.oy + ty * frame.s,
    s: frame.s,
  };
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
 * A `d` attribute as one polyline per subpath, in the element's own user space.
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
    else if (current.length === 1) {
      notes.once(
        'lone-point',
        'A path that never moved anywhere draws nothing and was skipped.'
      );
    }
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
function shapeProps(
  paint: Paint,
  frame: Frame,
  sketch: Sketch
): SerializedElementProps {
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
    strokeWidth: len(frame, paint.strokeWidth ?? 1),
  };
}

const EMPTY_BOX_NOTE = 'Shapes with no width or height were skipped.';

function readRect(
  element: Element,
  frame: Frame,
  paint: Paint,
  sketch: Sketch
): void {
  const w = num(element, 'width');
  const h = num(element, 'height');
  if (w <= 0 || h <= 0) {
    sketch.notes.once('empty-box', EMPTY_BOX_NOTE);
    return;
  }

  // `rx` is an absolute corner radius in user units, and the shape model reads
  // a `radius` of 1 or more as absolute pixels (below 1 it is a RATIO of the
  // shorter side). Sub-pixel radii are visually zero, so they are dropped
  // rather than reinterpreted as a 40 % round-over — and a PERCENTAGE radius is
  // refused outright for the same reason it would otherwise be read as its
  // number: `rx="50%"` would round a box over by fifty pixels rather than into
  // a pill.
  const rawRadius = element.getAttribute('rx') ?? element.getAttribute('ry');
  let radius = 0;
  if (rawRadius?.includes('%')) {
    sketch.notes.once(
      'percent-radius',
      'Corner radii given as a percentage were not read; those corners arrive square.'
    );
  } else {
    const scaled = len(frame, num(element, 'rx', num(element, 'ry')));
    radius = scaled >= 1 ? scaled : 0;
  }

  sketch.elements.push({
    ...shapeProps(paint, frame, sketch),
    shapeType: ShapeType.Rect,
    radius,
    xywh: xywh(
      px(frame, num(element, 'x')),
      py(frame, num(element, 'y')),
      len(frame, w),
      len(frame, h)
    ),
  });
}

function readEllipse(
  element: Element,
  frame: Frame,
  paint: Paint,
  sketch: Sketch
): void {
  const circle = nameOf(element) === 'circle';
  const r = num(element, 'r');
  const rx = circle ? r : num(element, 'rx');
  const ry = circle ? r : num(element, 'ry');
  if (rx <= 0 || ry <= 0) {
    sketch.notes.once('empty-box', EMPTY_BOX_NOTE);
    return;
  }
  const cx = num(element, 'cx');
  const cy = num(element, 'cy');
  sketch.elements.push({
    ...shapeProps(paint, frame, sketch),
    shapeType: ShapeType.Ellipse,
    radius: 0,
    xywh: xywh(
      px(frame, cx - rx),
      py(frame, cy - ry),
      len(frame, rx * 2),
      len(frame, ry * 2)
    ),
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
  frame: Frame,
  paint: Paint,
  sketch: Sketch
): void {
  const flat = numbers(element.getAttribute('points') ?? '');
  const points: number[][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    points.push([px(frame, flat[i]), py(frame, flat[i + 1])]);
  }
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;

  if (points.length < 3 || w <= 0 || h <= 0) {
    if (points.length === 0 || w < 0 || h < 0) {
      sketch.notes.once('empty-box', EMPTY_BOX_NOTE);
      return;
    }
    sketch.notes.once(
      'flat-polygon',
      'A polygon with fewer than three corners, or flat on one axis, arrives as its bounding rectangle.'
    );
    sketch.elements.push({
      ...shapeProps(paint, frame, sketch),
      shapeType: ShapeType.Rect,
      radius: 0,
      xywh: xywh(minX, minY, Math.max(w, 1), Math.max(h, 1)),
    });
    return;
  }

  sketch.elements.push({
    ...shapeProps(paint, frame, sketch),
    shapeType: ShapeType.Polygon,
    radius: 0,
    vertices: points.map(([x, y]) => [(x - minX) / w, (y - minY) / h]),
    isClosed: true,
    xywh: xywh(minX, minY, w, h),
  });
}

/**
 * A stroke — `<line>`, `<polyline>`, `<path>` — as one brush element per
 * connected run of points, in CANVAS coordinates.
 *
 * ## Key order is load-bearing here, and it is not a style choice
 *
 * `BrushElementModel` declares `points` with a `@convert` that re-bases them
 * onto the bound it derives, INFLATED BY `lineWidth`, and a `@derive` that
 * writes `xywh` from the same arithmetic. `surface.addElement` copies props
 * onto the model in `Object.keys` order, so `lineWidth` must be assigned BEFORE
 * `points` or the conversion runs against the model's default width of 4 and
 * the stroke lands with a box that is up to three pixels off on every side.
 * **Do not reorder the literal below**; the integration spec
 * (`integration-test/…/svg-sketch.spec.ts`) pins the resulting `xywh` on a live
 * surface precisely because a unit test over plain props cannot see this.
 *
 * The points handed over are ABSOLUTE, which is what the brush tool itself
 * passes: the model derives the box, so an importer that pre-computed `xywh`
 * would be doing that arithmetic twice and disagreeing with the model about the
 * line-width inflation.
 */
function pushStroke(
  points: number[][],
  paint: Paint,
  frame: Frame,
  sketch: Sketch
): void {
  if (points.length < 2) return;
  const color =
    colorOf(paint.stroke, NEUTRAL_STROKE, sketch.notes) ??
    // A path with no stroke and a fill is an outlined REGION — an arrowhead, a
    // glyph. It is drawn as a stroke anyway (a brush is the only thing this
    // reader has for an open path), so it takes the fill's colour rather than
    // arriving invisible. And a shape with neither is still drawn, in the
    // initial black, because that is what the file renders as.
    colorOf(paint.fill, NEUTRAL_STROKE, sketch.notes) ??
    NEUTRAL_STROKE;
  sketch.elements.push({
    type: 'brush',
    color,
    // BEFORE `points` — see this function's own documentation.
    lineWidth: Math.max(len(frame, paint.strokeWidth ?? 1), 1),
    points,
  });
}

/**
 * `<text>` and its children as an EDITABLE free-text element.
 *
 * The PO-critical path, and the one thing this tier promises without
 * qualification: a label that arrives as a picture of a word is a label nobody
 * can correct. `text` is handed over as a plain string and
 * `TextElementModel.propsToY` turns it into the `Y.Text` the editor binds to,
 * so the first double-click puts a caret in it.
 *
 * ## Children in DOCUMENT ORDER, text nodes included
 *
 * `<text>Hello <tspan>World</tspan></text>` is one label reading "Hello World",
 * and a reader that collected only the `<tspan>`s would import "World" and
 * lose the rest without noticing — the worst kind of loss, because the result
 * still looks like a label. So the children are walked in order and every
 * non-empty run, span or bare text node alike, becomes a line.
 *
 * Two approximations are unavoidable and are stated in this module's own
 * failure-modes paragraph rather than in a note, because no note could help:
 * SVG's `y` is a BASELINE and the model's box is a top edge, so the box is
 * lifted by one font size; and the box's width is estimated from the character
 * count, because measuring text needs a loaded font — which is exactly the
 * thing a pure function of a string is not allowed to have. Whitespace inside
 * a run is collapsed to single spaces and trimmed, so `xml:space="preserve"`
 * is not honoured.
 */
const CHARACTER_WIDTH_RATIO = 0.55;
const LINE_HEIGHT_RATIO = 1.2;

function readText(
  element: Element,
  frame: Frame,
  paint: Paint,
  sketch: Sketch
): void {
  const lines: string[] = [];
  const collapse = (raw: string) => raw.replace(/\s+/g, ' ').trim();

  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === TEXT_NODE || node.nodeType === CDATA_NODE) {
      const line = collapse(node.nodeValue ?? '');
      if (line) lines.push(line);
    } else if (node.nodeType === ELEMENT_NODE) {
      const child = node as Element;
      if (nameOf(child) !== 'tspan') continue;
      if (isHidden(child, sketch.notes)) continue;
      const line = collapse(child.textContent ?? '');
      if (line) lines.push(line);
    }
  }

  if (lines.length === 0) {
    sketch.notes.once('empty-text', 'Empty text elements were skipped.');
    return;
  }

  const fontSize = len(frame, paint.fontSize ?? DEFAULT_FONT_SIZE);
  const widest = Math.max(...lines.map(line => line.length));
  const w = Math.max(widest * fontSize * CHARACTER_WIDTH_RATIO, fontSize);
  const h = lines.length * fontSize * LINE_HEIGHT_RATIO;

  // `text-anchor` says which end of the box `x` names, and it INHERITS — a
  // `<g text-anchor="middle">` around a whole diagram is how bpmn.io centres
  // every label it writes, so reading it off the leaf alone would offset every
  // one of them by half its width.
  const anchor = (paint.textAnchor ?? 'start').trim();
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
      px(frame, num(element, 'x')) - shift,
      py(frame, num(element, 'y')) - fontSize,
      w,
      h
    ),
  });
}

/** The names that are containers rather than drawings. */
const CONTAINERS = new Set(['g', 'a']);

/**
 * What renders nothing and is therefore dropped in SILENCE — the one exception
 * to "every ignored kind gets a note".
 *
 * A `<title>` is an accessible name, a `<desc>` a long description, a
 * `<metadata>` block a machine-readable annotation. None of them paints a
 * pixel, so there is no loss to report and a note about each would be three
 * lines of noise on the first import of every file a real tool ever wrote.
 * `<style>` is deliberately NOT here: it paints, and losing it is the single
 * most visible thing this reader does to a mermaid diagram.
 */
const NON_RENDERING = new Set(['title', 'desc', 'metadata']);

/** The sanitizer's own HTML wrapper, which no `.svg` on a disk ever contained. */
const PARSER_SCAFFOLDING = new Set(['html', 'head', 'body']);

function walk(
  parent: Element,
  frame: Frame,
  inherited: Paint,
  sketch: Sketch
): void {
  for (const element of childElements(parent)) {
    visit(element, frame, inherited, sketch);
  }
}

/** One element and whatever it contains, placed in its parent's frame. */
function visit(
  element: Element,
  frame: Frame,
  inherited: Paint,
  sketch: Sketch
): void {
  const name = nameOf(element);
  if (NON_RENDERING.has(name)) return;
  if (isHidden(element, sketch.notes)) return;

  const here = translated(element, frame, sketch.notes);
  const paint = paintOf(element, inherited, sketch.notes);
  noteOpacity(element, sketch.notes);

  if (CONTAINERS.has(name)) {
    walk(element, here, paint, sketch);
    return;
  }
  if (name === 'switch') {
    // §5.10: a `<switch>` renders the FIRST child whose requirement attributes
    // pass, and this reader evaluates none of them — so it takes the first,
    // which is what a viewer that supports everything does, and says the
    // alternatives went. Rendering all of them would stack every localisation
    // of a label on top of itself.
    const [first, ...rest] = childElements(element).filter(
      child => !NON_RENDERING.has(nameOf(child))
    );
    if (rest.length > 0) {
      sketch.notes.once(
        'switch',
        'A `<switch>` offers alternative renderings; the first was imported and the others were not.'
      );
    }
    if (first) visit(first, here, paint, sketch);
    return;
  }
  if (name === 'svg') {
    walk(element, viewportFrame(element, here), paint, sketch);
    return;
  }

  emit(element, name, here, paint, sketch);
}

/** One recognised element, as props. Split out so `<switch>` can reuse it. */
function emit(
  element: Element,
  name: string,
  frame: Frame,
  paint: Paint,
  sketch: Sketch
): void {
  switch (name) {
    case 'rect':
      readRect(element, frame, paint, sketch);
      break;
    case 'circle':
    case 'ellipse':
      readEllipse(element, frame, paint, sketch);
      break;
    case 'polygon':
      readPolygon(element, frame, paint, sketch);
      break;
    case 'line':
      pushStroke(
        [
          [px(frame, num(element, 'x1')), py(frame, num(element, 'y1'))],
          [px(frame, num(element, 'x2')), py(frame, num(element, 'y2'))],
        ],
        paint,
        frame,
        sketch
      );
      break;
    case 'polyline': {
      const flat = numbers(element.getAttribute('points') ?? '');
      const points: number[][] = [];
      for (let i = 0; i + 1 < flat.length; i += 2) {
        points.push([px(frame, flat[i]), py(frame, flat[i + 1])]);
      }
      pushStroke(points, paint, frame, sketch);
      break;
    }
    case 'path':
      for (const subpath of samplePath(
        element.getAttribute('d') ?? '',
        sketch.notes
      )) {
        pushStroke(
          subpath.map(([x, y]) => [px(frame, x), py(frame, y)]),
          paint,
          frame,
          sketch
        );
      }
      break;
    case 'text':
      readText(element, frame, paint, sketch);
      break;
    default:
      // Everything this reader has no artefact for, named ONCE per kind:
      // `<image>`, `<defs>`, `<marker>`, the gradients, the filters, `<style>`,
      // and whatever SVG grows next. A drawing built out of symbol instances
      // arrives nearly empty, and this is the line that tells its author why
      // instead of leaving them to guess.
      sketch.notes.once(
        `skipped:${name}`,
        `\`<${name}>\` is not recognised and was skipped.`,
        name
      );
  }
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
    // The FIRST line only. Chromium's `parsererror` is a whole rendered
    // document — a heading, the message, then the offending source line with a
    // caret under it — and pouring that into a toast makes the one sentence
    // that matters unreadable.
    const [summary = ''] = (error.textContent ?? '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    throw new Error(
      `This file is not well-formed XML, so no drawing can be read out of it: ${summary.slice(0, 200)}`
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
  });

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
      // Worded for what this actually is, which is broader than "unsafe": the
      // sanitizer's allow-list drops an event handler AND a `requiredFeatures`,
      // and calling the second one dangerous would be this reader accusing a
      // perfectly ordinary file of something.
      notes.once(
        'removed-attribute',
        'Attributes outside the safe SVG drawing vocabulary — event handlers, script URLs, and anything else the sanitizer does not know — were removed before the file was read.'
      );
    }
  }

  // No cast: `RETURN_DOM: true` in the literal selects DOMPurify's typed
  // overload, which answers an `HTMLElement` — the sanitized body wrapper.
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
  // The root `<svg>` paints like any other element — a `fill` on it is what
  // every shape under it inherits — and it establishes the outermost viewport.
  walk(
    root,
    viewportFrame(root, IDENTITY),
    paintOf(root, INITIAL_PAINT, sketch.notes),
    sketch
  );

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
