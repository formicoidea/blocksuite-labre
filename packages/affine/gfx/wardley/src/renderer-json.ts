import type { ForeignInterchange } from '@labre/std/gfx';

import { type OwmPlot, owmCoordsOf, owmPointOf } from './export.js';
import { INERTIA_SIZE, LABEL_GAP } from './node/consts.js';
import { WARDLEY_LABEL_W, WARDLEY_NODE_SIZE } from './presets.js';

/**
 * The JSON language of `@formicoidea/wardley-map-renderer`, the vocabulary
 * its reader (`renderer-json-import.ts`) and its writer
 * (`renderer-json-export.ts`) share — a second Wardley exchange language
 * beside OWM (ADR 0012, amendment of 2026-10-28 under P1).
 *
 * Written against the renderer's own Zod schemas (`src/schema.ts`,
 * `WardleyMapSchema`) and the JSON Schema it publishes
 * (`schema/wardley-map.schema.json`), **version 1.0.0-beta.5**: `title`,
 * `components[]` (`id`, `label.name`, `type` anchor | component | pipeline,
 * `subtype`, `position.evolution.scalar` / `range`,
 * `position.visibility.scalar`, `evolvesTo[]`, `pipelineGeometry`, `method`,
 * `inertia`, `accelerator`, `deaccelerator`, `color`, `step`, `nature`,
 * `description`), `relations[]` (`id`, `consumer`, `supplier`, `type`,
 * `flow`), `context`, `renderConfig`. The renderer package itself is NOT
 * imported: its PNG path pulls a native binary (resvg) into any graph that
 * loads it, which the `./interchange` entry exists to keep out
 * (`interchange-headless.unit.spec.ts`). The shape is checked by hand, small
 * and explicit, in the reader.
 */

/**
 * The format id, and therefore the key foreign matter rides under on an
 * element (ADR 0012, D2): `interchange.json`. One JSON per framework is all a
 * Wardley element can meet, so the bare word is unambiguous where it is read.
 */
export const WARDLEY_JSON_FORMAT_ID = 'json';

/**
 * The renderer's role keys (D2): `@document` on the map for the file's own
 * top-level fields, `@self` on an element for the fields of the component,
 * relation or evolution it was drawn from. `@components` and `@relations` on
 * the map hold whole entries this reader could not draw, kept verbatim.
 */
export const JSON_SCOPE = {
  document: '@document',
  self: '@self',
  components: '@components',
  relations: '@relations',
} as const;

/**
 * The attributes a payload holds under its scope. `rest` is a JSON object of
 * every field the board does not draw, merged back under what it does on the
 * next export; the others are fields the board draws only in part.
 */
export const JSON_ATTR = {
  title: 'title',
  rest: 'rest',
  subtype: 'subtype',
  method: 'method',
  color: 'color',
  /** Present when the file wrote `handleEvolution` itself. */
  handle: 'handle',
} as const;

/** The `interchange` value carrying `payload`, or nothing when it is empty. */
export function jsonPayload(
  payload: ForeignInterchange
): Record<string, ForeignInterchange> | undefined {
  return Object.keys(payload).length > 0
    ? { [WARDLEY_JSON_FORMAT_ID]: payload }
    : undefined;
}

/** What an element carried from a renderer JSON file, if anything. */
export function jsonCarriedOf(element: {
  interchange?: Record<string, ForeignInterchange> | undefined;
}): ForeignInterchange | undefined {
  return element.interchange?.[WARDLEY_JSON_FORMAT_ID];
}

/**
 * The renderer's own rounding (`round3` in its schema): a scalar is written
 * to three decimals, so `export(import(file))` gives back the number the file
 * held, and `-0` comes back as `0`.
 */
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
 * projection is reused on `1 − visibility` rather than restated, so the two
 * languages lay a map out on the one plot.
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

/* ── Where a decorator sits, beside the component it decorates ────────── */

/** The kinds a renderer component is drawn as. */
export type JsonComponentKind =
  | 'anchor'
  | 'component'
  | 'method'
  | 'market'
  | 'ecosystem';

/**
 * The centre of the accelerator (or decelerator) a renderer component's
 * `accelerator` (`deaccelerator`) flag is drawn as: the toolbar's own climate
 * arrow, just UNDER the node, the accelerator to the right of its axis and
 * the decelerator to the left, each pointing away from the other with its
 * name on its own side. The renderer draws the arrow beside the node; here
 * the component's own name already sits there, so the arrow goes below it.
 *
 * Both directions read this one function: the reader places a decorator
 * here, and the writer gives a climate arrow back to the component whose
 * slot it is in.
 */
export function jsonDecoratorCentre(
  kind: JsonComponentKind,
  which: 'accelerator' | 'decelerator',
  cx: number,
  cy: number
): { cx: number; cy: number } {
  const { h } = WARDLEY_NODE_SIZE[kind];
  const arrow = WARDLEY_NODE_SIZE[which];
  const dx = arrow.w / 2 + LABEL_GAP / 2;
  return {
    cx: which === 'accelerator' ? cx + dx : cx - dx,
    cy: cy + h / 2 + LABEL_GAP + arrow.h / 2,
  };
}

/**
 * The centre of the inertia bar a component's own `inertia` flag is drawn
 * as: the toolbar's bar, on the evolution side, past the name the toolbar
 * writes to the right of the node. The renderer draws nothing for this flag
 * (only an evolution's `inertia` paints a barrier), so the place is this
 * library's, and the writer reads it back from here.
 */
export function jsonInertiaCentre(
  kind: JsonComponentKind,
  cx: number,
  cy: number
): { cx: number; cy: number } {
  const { w } = WARDLEY_NODE_SIZE[kind];
  return {
    cx:
      cx + w / 2 + LABEL_GAP + WARDLEY_LABEL_W + LABEL_GAP + INERTIA_SIZE.w / 2,
    cy,
  };
}

/* ── Colours ──────────────────────────────────────────────────────────── */

/**
 * The renderer's colour names, as its `resolveColor` reads them
 * (`src/schema.ts`): six Tailwind names and any `#hex`. A name it does not
 * know paints black there; here it is not drawn, and is carried.
 */
const RENDERER_COLOURS: Record<string, string> = {
  'red-600': '#dc2626',
  'blue-600': '#2563eb',
  'green-600': '#16a34a',
  'yellow-600': '#ca8a04',
  'orange-600': '#ea580c',
  'purple-600': '#9333ea',
};

/** A renderer `color` as the stroke the board paints, or `undefined`. */
export function rendererColour(name: string): string | undefined {
  if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(name)) return name;
  return RENDERER_COLOURS[name];
}

/** Two CSS colours that are the same paint, whatever their spelling. */
export function sameColour(a: unknown, b: unknown): boolean {
  return (
    typeof a === 'string' &&
    typeof b === 'string' &&
    a.toLowerCase() === b.toLowerCase()
  );
}
