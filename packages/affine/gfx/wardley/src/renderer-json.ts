import {
  FontFamily,
  FontWeight,
  ShapeStyle,
} from '@labre/affine-model/headless';

import { WARDLEY_BACKGROUND } from './background.js';
import { type OwmPlot, owmCoordsOf, owmPointOf } from './export.js';
import {
  LABEL_GAP,
  LINK_GREY,
  LINK_STROKE_WIDTH,
  NODE_STROKE,
} from './node/consts.js';
import {
  WARDLEY_LABEL_H,
  WARDLEY_LABEL_W,
  WARDLEY_NODE_SIZE,
} from './presets.js';

/**
 * The JSON language of `@formicoidea/wardley-map-renderer`: the vocabulary
 * its reader (`renderer-json-import.ts`) and its writer
 * (`renderer-json-export.ts`) share, a second Wardley exchange language
 * beside OWM (ADR 0012, amendment of 2026-10-28 under P1).
 *
 * Written against the renderer's Zod schemas (`src/schema.ts`) and the JSON
 * Schema it publishes (`schema/wardley-map.schema.json`), **version
 * 1.0.0-beta.5**. The package itself is NOT imported: its PNG path loads a
 * native binary (resvg), which the `./interchange` graph exists to keep out
 * (`interchange-headless.unit.spec.ts`).
 *
 * ## Only what the canvas shows crosses (PO decision, 2026-10-28)
 *
 * Every renderer field becomes something VISIBLE: a toolbox item with its
 * real parameters (kind, nature tag, colours, the name's position), or, where
 * Wardley's toolbox has nothing, a plain shape or a free text grouped with
 * the component. What nothing on the canvas can show is dropped, and the
 * import report says which. No foreign id and no foreign field is stored:
 * ids belong to Labre, and the writer reads back what it sees, recognised by
 * what each element IS (its group, its kind, its place), never by a payload.
 *
 * Every placement below is shared by both directions: the reader puts a
 * piece in its slot and the writer reads the slot.
 */

/** Rounding of every scalar written, the renderer's own `round3`. */
export function round3(value: number): number {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/* ── The two axes ─────────────────────────────────────────────────────── */

/**
 * `(evolution, visibility)` → a surface point on `plot`.
 *
 * The renderer's visibility runs DOWN: `0` is the top of the value chain and
 * `1` the bottom (`visToY = plotTop + visibility × plotHeight`,
 * `src/geometry.ts`), the opposite of OWM's, where `1.0` is the top. The OWM
 * projection is reused on `1 − visibility` rather than restated.
 */
export function rendererPointOf(
  plot: OwmPlot,
  evolution: number,
  visibility: number
): [number, number] {
  return owmPointOf(plot, 1 - visibility, evolution);
}

/** A surface point → `(evolution, visibility)`, the exact inverse. */
export function rendererCoordsOf(
  plot: OwmPlot,
  x: number,
  y: number
): { evolution: number; visibility: number } {
  const { evolution, visibility } = owmCoordsOf(plot, x, y);
  return { evolution, visibility: 1 - visibility };
}

/**
 * The evolution of each phase line, read off the map's own zones: the same
 * 0.175 / 0.4 / 0.7 the renderer draws (`EVOLUTION_BOUNDARIES`).
 */
export const PHASE_LINES: readonly number[] = (WARDLEY_BACKGROUND.zones ?? [])
  .slice(1)
  .map(zone => zone.rect.x);

/* ── A component's own pieces ─────────────────────────────────────────── */

/** The kinds a renderer component is drawn as, pipeline aside. */
export type JsonComponentKind =
  | 'anchor'
  | 'component'
  | 'method'
  | 'market'
  | 'ecosystem';

/** A box, in surface units. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The renderer's default canvas plot, in its pixels (1600 × 800 less its
 * fixed 28 / 20 / 28 / 28 margins), and its default name offset
 * (`NODE_RADIUS + 4`, `4`): `label.position` is measured in these.
 */
const RENDERER_PLOT = { w: 1552, h: 744 };
const RENDERER_LABEL = { dx: 9, dy: 4 };

/** Renderer pixels → surface units, on `plot`. */
const scaleOf = (plot: OwmPlot) => ({
  sx: plot.width / RENDERER_PLOT.w,
  sy: plot.height / RENDERER_PLOT.h,
});

/**
 * Where a component's name goes for a renderer `label.position`.
 *
 * The renderer's DEFAULT offset is the toolbox's own slot (right of the
 * node, centred on it), so a file that says nothing gets the toolbar's
 * name; an offset moves the name by its difference from that default,
 * scaled to the plot. A negative `dx` puts it on the left, right-aligned,
 * and `0` centres it, as the renderer's text anchor does.
 */
export function jsonLabelBox(
  plot: OwmPlot,
  w: number,
  cx: number,
  cy: number,
  offset: { dx: number; dy: number }
): { x: number; y: number; textAlign: 'left' | 'right' | 'center' } {
  const { sx, sy } = scaleOf(plot);
  const y = cy + (offset.dy - RENDERER_LABEL.dy) * sy - WARDLEY_LABEL_H / 2;
  if (offset.dx > 0) {
    const x = cx + w / 2 + LABEL_GAP + (offset.dx - RENDERER_LABEL.dx) * sx;
    return { x, y, textAlign: 'left' };
  }
  if (offset.dx < 0) {
    const right = cx - w / 2 - LABEL_GAP + (offset.dx + RENDERER_LABEL.dx) * sx;
    return { x: right - WARDLEY_LABEL_W, y, textAlign: 'right' };
  }
  return { x: cx - WARDLEY_LABEL_W / 2, y, textAlign: 'center' };
}

/** The inverse of {@link jsonLabelBox}: a name's box → the renderer offset. */
export function jsonLabelOffset(
  plot: OwmPlot,
  w: number,
  cx: number,
  cy: number,
  label: Box,
  textAlign: unknown
): { dx: number; dy: number } {
  const { sx, sy } = scaleOf(plot);
  const dy = (label.y + label.h / 2 - cy) / sy + RENDERER_LABEL.dy;
  let dx: number;
  if (textAlign === 'right') {
    dx =
      (label.x + label.w - (cx - w / 2 - LABEL_GAP)) / sx - RENDERER_LABEL.dx;
  } else if (textAlign === 'center') {
    dx = (label.x + label.w / 2 - cx) / sx;
  } else {
    dx = (label.x - (cx + w / 2 + LABEL_GAP)) / sx + RENDERER_LABEL.dx;
  }
  return { dx: round2(dx), dy: round2(dy) };
}

/**
 * How far an offset moves a name from the toolbox's slot, in surface units:
 * a pipeline's name, centred above its handle, is moved this way.
 */
export function jsonLabelShift(
  plot: OwmPlot,
  offset: { dx: number; dy: number }
): { x: number; y: number } {
  const { sx, sy } = scaleOf(plot);
  return {
    x: (offset.dx - RENDERER_LABEL.dx) * sx,
    y: (offset.dy - RENDERER_LABEL.dy) * sy,
  };
}

/** The inverse of {@link jsonLabelShift}. */
export function jsonLabelUnshift(
  plot: OwmPlot,
  shift: { x: number; y: number }
): { dx: number; dy: number } {
  const { sx, sy } = scaleOf(plot);
  return {
    dx: round2(shift.x / sx + RENDERER_LABEL.dx),
    dy: round2(shift.y / sy + RENDERER_LABEL.dy),
  };
}

/** Whether an offset is the renderer's default, so nothing need be written. */
export const isDefaultLabelOffset = (offset: { dx: number; dy: number }) =>
  Math.abs(offset.dx - RENDERER_LABEL.dx) < 0.5 &&
  Math.abs(offset.dy - RENDERER_LABEL.dy) < 0.5;

const round2 = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
};

/**
 * The centre of the accelerator (decelerator) a component's `accelerator`
 * (`deaccelerator`) flag is drawn as: where the RENDERER puts it, beside the
 * node, the accelerator on the right and the decelerator on the left. Its
 * place matters more than the name's, which it may overlap (PO, 2026-10-28).
 */
export function jsonDecoratorCentre(
  kind: JsonComponentKind,
  which: 'accelerator' | 'decelerator',
  cx: number,
  cy: number
): { cx: number; cy: number } {
  const dx =
    WARDLEY_NODE_SIZE[kind].w / 2 +
    LABEL_GAP / 2 +
    WARDLEY_NODE_SIZE[which].w / 2;
  return { cx: which === 'accelerator' ? cx + dx : cx - dx, cy };
}

/** The numbered `step` dot: a plain ellipse at the node's upper left. */
export const STEP_SIZE = 20;
const STEP_FILL = '#cc0000';

export function jsonStepCentre(
  kind: JsonComponentKind,
  cx: number,
  cy: number
): { cx: number; cy: number } {
  const { w, h } = WARDLEY_NODE_SIZE[kind];
  const overlap = 4;
  return {
    cx: cx - w / 2 - STEP_SIZE / 2 + overlap,
    cy: cy - h / 2 - STEP_SIZE / 2 + overlap,
  };
}

export function jsonStepElement(
  centre: { cx: number; cy: number },
  number: number,
  colour: string | undefined,
  id: string
): Record<string, unknown> & { type: string } {
  const fill = colour ?? STEP_FILL;
  return {
    type: 'shape',
    id,
    shapeType: 'ellipse',
    filled: true,
    fillColor: fill,
    strokeColor: fill,
    strokeWidth: 0,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    text: String(number),
    color: '#ffffff',
    fontFamily: FontFamily.Inter,
    fontSize: 12,
    fontWeight: FontWeight.Bold,
    textAlign: 'center',
    xywh: boxString({
      x: centre.cx - STEP_SIZE / 2,
      y: centre.cy - STEP_SIZE / 2,
      w: STEP_SIZE,
      h: STEP_SIZE,
    }),
  };
}

/** The evolution `range` bar: a thin plain rect at the node's height. */
export const RANGE_HEIGHT = 6;
const RANGE_FILL = '#c6dbfc';

export function jsonRangeElement(
  left: number,
  right: number,
  cy: number,
  id: string
): Record<string, unknown> & { type: string } {
  return {
    type: 'shape',
    id,
    shapeType: 'rect',
    filled: true,
    fillColor: RANGE_FILL,
    strokeColor: RANGE_FILL,
    strokeWidth: 0,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius: 0,
    xywh: boxString({
      x: Math.min(left, right),
      y: cy - RANGE_HEIGHT / 2,
      w: Math.max(Math.abs(right - left), 1),
      h: RANGE_HEIGHT,
    }),
  };
}

/** Whether a plain shape is a range bar: a thin horizontal rect. */
export const isRangeShape = (shapeType: unknown, box: Box) =>
  shapeType === 'rect' && box.h <= RANGE_HEIGHT * 2 && box.w >= box.h * 2;

/** The `description` text: under the component's name, small and grey. */
const NOTE_WIDTH = 200;
const NOTE_FONT = 12;

export function jsonDescriptionElement(
  text: string,
  under: { x: number; y: number },
  id: string
): Record<string, unknown> & { type: string } {
  return freeText(text, under.x, under.y + 2, NOTE_WIDTH, NOTE_FONT, id, {
    color: LINK_GREY,
  });
}

/** Where a component's description is looked for: under its name's box. */
export const descriptionSlot = (label: Box) => ({
  x: label.x,
  y: label.y + label.h + 2,
});

/** The map's `title`, above its top-left corner. */
const TITLE_FONT = 28;

export function jsonTitleElement(
  text: string,
  map: Box,
  id: string
): Record<string, unknown> & { type: string } {
  return freeText(text, map.x, map.y - TITLE_FONT * 2, map.w, TITLE_FONT, id, {
    fontWeight: FontWeight.Bold,
  });
}

/** The map's `context`, under it, as wide as it. */
export function jsonContextElement(
  text: string,
  map: Box,
  id: string
): Record<string, unknown> & { type: string } {
  return freeText(text, map.x, map.y + map.h + 16, map.w, 14, id, {});
}

function freeText(
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  id: string,
  style: { color?: string; fontWeight?: FontWeight }
): Record<string, unknown> & { type: string } {
  // The height a wrapped text needs is the renderer's to measure; this is a
  // first estimate the editor corrects on the first edit.
  const perLine = Math.max(1, Math.floor(width / (fontSize * 0.55)));
  const lines = text
    .split('\n')
    .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / perLine)), 0);
  return {
    type: 'text',
    id,
    text,
    fontFamily: FontFamily.Inter,
    fontSize,
    fontWeight: style.fontWeight ?? FontWeight.Regular,
    color: style.color ?? NODE_STROKE,
    textAlign: 'left',
    hasMaxWidth: true,
    xywh: boxString({ x, y, w: width, h: lines * fontSize * 1.4 }),
  };
}

const boxString = (box: Box) => `[${box.x},${box.y},${box.w},${box.h}]`;

/* ── Relations ────────────────────────────────────────────────────────── */

/**
 * The look of each relation type on the toolbox's dependency link (PO,
 * 2026-10-28): `DependsOn` is the link as the toolbar draws it, `Flow` a BLUE
 * link thicker than it, `Constraint` a BLACK link as thick as a flow. The
 * writer reads the type back from the colour and the width.
 */
export const RELATION_WIDTH = LINK_STROKE_WIDTH * 2;
export const FLOW_COLOUR = '#2563eb';
export const CONSTRAINT_COLOUR = '#000000';

export type RelationType = 'DependsOn' | 'Flow' | 'Constraint';

export function relationLook(
  type: RelationType,
  style: unknown
): Record<string, unknown> {
  const base =
    type === 'Flow'
      ? { stroke: FLOW_COLOUR, strokeWidth: RELATION_WIDTH }
      : type === 'Constraint'
        ? { stroke: CONSTRAINT_COLOUR, strokeWidth: RELATION_WIDTH }
        : { stroke: LINK_GREY, strokeWidth: LINK_STROKE_WIDTH };
  return {
    ...base,
    ...(style === 'bold' ? { strokeWidth: base.strokeWidth * 2 } : {}),
    ...(style === 'dashed' ? { strokeStyle: 'dash' } : {}),
  };
}

/** A link's type and flow style, read off its colour, width and dash. */
export function relationOf(link: {
  stroke?: unknown;
  strokeWidth?: unknown;
  strokeStyle?: unknown;
}): { type: RelationType; style?: 'dashed' | 'bold' } {
  const width =
    typeof link.strokeWidth === 'number' ? link.strokeWidth : LINK_STROKE_WIDTH;
  const thick = width >= RELATION_WIDTH;
  const type: RelationType =
    thick && sameColour(link.stroke, FLOW_COLOUR)
      ? 'Flow'
      : thick && sameColour(link.stroke, CONSTRAINT_COLOUR)
        ? 'Constraint'
        : 'DependsOn';
  const base = type === 'DependsOn' ? LINK_STROKE_WIDTH : RELATION_WIDTH;
  const style =
    link.strokeStyle === 'dash'
      ? 'dashed'
      : width >= base * 2
        ? 'bold'
        : undefined;
  return style === undefined ? { type } : { type, style };
}

/** The four renderer evolution types, written as the arrow's label. */
export const EVOLVE_TYPES = ['natural', 'ecosystem', 'forced', 'late'] as const;

/* ── Natures ──────────────────────────────────────────────────────────── */

/**
 * The renderer natures this library's `wardley:nature` tag has (`natures.ts`).
 * Its five others (personae, generic, group, natural, anthropic) have no
 * value here and are dropped (PO, 2026-10-28).
 */
export const LABRE_NATURES = [
  'activity',
  'data',
  'practice',
  'knowledge',
] as const;

/* ── Methods ──────────────────────────────────────────────────────────── */

/**
 * The renderer's method look (its default `methods`, a map's own
 * `renderConfig.style.decorators.method`, and `renderMethodIndicator`): the
 * CATEGORY gives the colour, the RECOMMENDATION's rank in the category's
 * legend how strongly the ring is filled — faint for the first, 40 % for the
 * second, solid for the third.
 *
 * ponytail: the method rides on the node's two colours until the method node
 * gains real method and nature parameters (branch
 * `feat/wardley-method-nature`); then {@link methodLook} and {@link methodOf}
 * read and write those, and nothing else here moves. Until then a category
 * the map declares itself is drawn in its colour and comes back under the
 * default category of that colour, if there is one.
 */
export type MethodCategories = Record<
  string,
  { colour: string; steps: readonly string[] }
>;

const DEFAULT_STEPS = ['Uncharted', 'Transitional', 'Industrialized'] as const;
const METHOD_ALPHA = ['1a', '66', 'ff'] as const;

/** The renderer's three default categories. */
export const DEFAULT_METHOD_CATEGORIES: MethodCategories = {
  'buying-policy': { colour: '#2563eb', steps: DEFAULT_STEPS },
  'project-management': { colour: '#16a34a', steps: DEFAULT_STEPS },
  attitudes: { colour: '#f59e0b', steps: DEFAULT_STEPS },
};

/** The defaults, plus the categories a map's `renderConfig` declares. */
export function methodCategoriesOf(renderConfig: unknown): MethodCategories {
  const out: MethodCategories = { ...DEFAULT_METHOD_CATEGORIES };
  const declared = (
    renderConfig as { style?: { decorators?: { method?: unknown } } }
  )?.style?.decorators?.method;
  if (typeof declared !== 'object' || declared === null) return out;
  for (const [category, style] of Object.entries(declared)) {
    const facets = style as { default?: unknown; override?: unknown };
    const merged = {
      ...(typeof facets?.default === 'object' ? facets.default : {}),
      ...(typeof facets?.override === 'object' ? facets.override : {}),
    } as { color?: unknown; legend?: unknown };
    const colour =
      typeof merged.color === 'string' ? merged.color : out[category]?.colour;
    if (colour === undefined) continue;
    const steps =
      typeof merged.legend === 'object' && merged.legend !== null
        ? Object.keys(merged.legend)
        : (out[category]?.steps ?? DEFAULT_STEPS);
    out[category] = { colour, steps };
  }
  return out;
}

/** A renderer `method` as the method node's colours, or `undefined`. */
export function methodLook(
  method: unknown,
  categories: MethodCategories = DEFAULT_METHOD_CATEGORIES
): { fillColor: string; strokeColor: string } | undefined {
  if (typeof method !== 'object' || method === null) return undefined;
  const { category, recommendation } = method as Record<string, unknown>;
  const found = typeof category === 'string' ? categories[category] : undefined;
  if (!found || !/^#[0-9a-f]{6}$/i.test(found.colour)) return undefined;
  const step = found.steps.indexOf(recommendation as string);
  const alpha = METHOD_ALPHA[step];
  if (alpha === undefined) return undefined;
  return { fillColor: `${found.colour}${alpha}`, strokeColor: found.colour };
}

/** The method a method node's colours say, or `undefined` when they say none. */
export function methodOf(node: {
  fillColor?: unknown;
  strokeColor?: unknown;
}): { category: string; recommendation: string } | undefined {
  const category = Object.keys(DEFAULT_METHOD_CATEGORIES).find(key =>
    sameColour(node.strokeColor, DEFAULT_METHOD_CATEGORIES[key].colour)
  );
  if (category === undefined || typeof node.fillColor !== 'string') {
    return undefined;
  }
  const { colour, steps } = DEFAULT_METHOD_CATEGORIES[category];
  const fill = node.fillColor.toLowerCase();
  const step = METHOD_ALPHA.indexOf(
    (fill.length === 9 ? fill.slice(7) : 'ff') as never
  );
  const recommendation = steps[step];
  if (!fill.startsWith(colour.toLowerCase()) || recommendation === undefined) {
    return undefined;
  }
  return { category, recommendation };
}

/* ── Colours ──────────────────────────────────────────────────────────── */

/**
 * The renderer's colour names, as its `resolveColor` reads them
 * (`src/schema.ts`): six Tailwind names and any `#hex`. Any other name is
 * painted black there, and so it is here.
 */
const RENDERER_COLOURS: Record<string, string> = {
  'red-600': '#dc2626',
  'blue-600': '#2563eb',
  'green-600': '#16a34a',
  'yellow-600': '#ca8a04',
  'orange-600': '#ea580c',
  'purple-600': '#9333ea',
};

/** A renderer `color` as the stroke it paints. */
export function rendererColour(name: string): string {
  if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(name)) return name;
  return RENDERER_COLOURS[name] ?? '#000000';
}

/** A stroke as the renderer's word for it: its name if it has one. */
export function rendererColourName(stroke: string): string {
  const name = Object.keys(RENDERER_COLOURS).find(key =>
    sameColour(RENDERER_COLOURS[key], stroke)
  );
  return name ?? stroke;
}

/** Two CSS colours that are the same paint, whatever their spelling. */
export function sameColour(a: unknown, b: unknown): boolean {
  return (
    typeof a === 'string' &&
    typeof b === 'string' &&
    a.toLowerCase() === b.toLowerCase()
  );
}
