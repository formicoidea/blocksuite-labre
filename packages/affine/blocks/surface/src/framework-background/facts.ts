import type { Bound } from '@labre/global/gfx';

import {
  backgroundPlot,
  type FrameworkBackgroundDef,
  type Ratio,
} from './def.js';

/**
 * The framework-background declaration read as EVALUATION FACTS (PF5.15/PF5.16).
 *
 * `def.ts` describes a background so it can be PAINTED. The same declaration
 * already says everything a rule needs to know about the frame of reference —
 * which axes exist, which way they run, where one zone ends and the next
 * begins — and this file is the semantic accessor onto that, so the validation
 * engine never re-derives geometry a framework already declared, and never
 * imports a renderer to find out.
 *
 * Pure data in, pure data out: no canvas, no element model, no DI. Everything
 * here is a function of the declaration (plus, for the model-space helpers, the
 * bounds of ONE instance of it).
 */

/**
 * An axis, as a rule sees it.
 *
 * {@link forward} is the unit vector of INCREASING value in MODEL space, where
 * `y` grows DOWNWARDS. So a horizontal axis runs `[1, 0]` and a vertical one
 * `[0, -1]` — "more" is up, which is the opposite of increasing screen `y` and
 * exactly what {@link BackgroundAxisDef} documents.
 *
 * Derived from `orientation` rather than from a new declared field: the
 * direction of progression is not a free choice a framework makes, it is the
 * convention every axis in `def.ts` is already written against ("`forward` is
 * the direction of increasing value"). A framework that one day needs a
 * reversed axis adds a field there and this reads it — until then, inventing
 * one would be a knob nobody turns.
 */
export interface BackgroundAxisFact {
  id: string;
  orientation: 'horizontal' | 'vertical';
  /** Unit vector of increasing value, in model space (`y` grows downwards). */
  forward: readonly [number, number];
}

const FORWARD = {
  horizontal: [1, 0],
  vertical: [0, -1],
} as const satisfies Record<string, readonly [number, number]>;

/** The declared axes, as facts. Empty for a background that declares none. */
export function backgroundAxisFacts(
  def: FrameworkBackgroundDef
): readonly BackgroundAxisFact[] {
  return (def.axes ?? []).map(axis => ({
    id: axis.id,
    orientation: axis.orientation,
    forward: FORWARD[axis.orientation],
  }));
}

/** The declared axis with this id, as a fact. */
export function backgroundAxisFact(
  def: FrameworkBackgroundDef,
  axisId: string
): BackgroundAxisFact | undefined {
  return backgroundAxisFacts(def).find(axis => axis.id === axisId);
}

/**
 * Where one zone ends and the next begins, as PLOT RATIOS, split by the plot
 * axis the transition runs across.
 *
 * `x` holds the ratios of the vertical lines separating zones left to right —
 * on a Wardley map, the three phase transitions (`0.175`, `0.4`, `0.7`). `y`
 * holds the horizontal ones.
 *
 * INTERIOR edges only: `0` and `1` are the borders of the plot, not transitions
 * between two zones, and a rule saying "sit on a transition" must not accept
 * the left edge of the map as one. Sorted and de-duplicated, so adjacent zones
 * sharing an edge contribute it once.
 */
export function backgroundZoneBoundaries(def: FrameworkBackgroundDef): {
  x: readonly Ratio[];
  y: readonly Ratio[];
} {
  const x = new Set<Ratio>();
  const y = new Set<Ratio>();
  for (const zone of def.zones ?? []) {
    const { rect } = zone;
    for (const [set, edge] of [
      [x, rect.x],
      [x, rect.x + rect.w],
      [y, rect.y],
      [y, rect.y + rect.h],
    ] as const) {
      if (edge > 0 && edge < 1) set.add(edge);
    }
  }
  const sorted = (set: Set<Ratio>) => Array.from(set).sort((a, b) => a - b);
  return { x: sorted(x), y: sorted(y) };
}

/**
 * The same transitions in MODEL coordinates, for ONE instance of the
 * background occupying `bound`.
 *
 * Ratios are of the PLOT, i.e. the element box minus the declared margin — so
 * this is the only place that knows a transition drawn at `0.175` does not sit
 * at 17.5% of the element's width. A rule asking "is this element on a phase
 * transition" compares against these numbers and nothing else.
 */
export function backgroundBoundaryCoords(
  def: FrameworkBackgroundDef,
  bound: Bound
): { x: number[]; y: number[] } {
  const plot = backgroundPlot(def, bound.w, bound.h);
  const ratios = backgroundZoneBoundaries(def);
  return {
    x: ratios.x.map(at => bound.x + plot.x0 + at * plot.width),
    y: ratios.y.map(at => bound.y + plot.y0 + at * plot.height),
  };
}
