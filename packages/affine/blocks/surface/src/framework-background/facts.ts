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
 *
 * ponytail: a ROTATED instance is not accounted for. `forward` is a function of
 * the declaration alone, so it describes an upright background — turn a map
 * 180° on the canvas and W1 reads a correct change arrow as pointing backwards
 * (and a correct one as fine), because the axis it is compared against never
 * turned with it. Distinct from the reversed-axis case above: that one is a
 * framework declaring a different convention, this one is a user rotating one
 * instance of the same convention. Left as is because nothing rotates a
 * framework background today and no user has asked to. Upgrade: fold the
 * instance's `rotate` into the vector — a rotation of `forward` by the
 * instance's angle at the one call site that has the element in hand, not a new
 * declared field.
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

/**
 * One transition, taken as the BAND it really is, in model coordinates.
 *
 * The line a renderer draws is where two zones meet; the band is the region in
 * which a reader would say something is "at" that frontier. Wardley calls it
 * the zone of PUNCTUATED EQUILIBRIUM — inertia lives at the transition, not on
 * a coordinate — and it is the shape any rule asking "is this on the boundary"
 * has to measure against.
 */
export interface BackgroundTransitionBand {
  /**
   * The two zones the transition separates, `custom-built|product`. A name, not
   * an index: it comes from the declaration, so it survives a zone being added
   * between two others and says which frontier a finding is about.
   */
  id: string;
  /** The transition line itself. The band's centre. */
  at: number;
  /** The band, in model coordinates: `at` ± half the declared width. */
  min: number;
  max: number;
}

/** The ids of the zones meeting at `edge`, along one plot axis. */
function zonesMeetingAt(
  def: FrameworkBackgroundDef,
  axis: 'x' | 'y',
  edge: Ratio
): string {
  let before = '';
  let after = '';
  for (const { id, rect } of def.zones ?? []) {
    const start = axis === 'x' ? rect.x : rect.y;
    const span = axis === 'x' ? rect.w : rect.h;
    if (start + span === edge) before = id;
    if (start === edge) after = id;
  }
  return `${before}|${after}`;
}

/**
 * Every transition of ONE instance of the background, as named BANDS in model
 * coordinates.
 *
 * The width comes from {@link FrameworkBackgroundDef.transitionBandWidth},
 * which is a ratio of the plot — so a map stretched to twice its size keeps a
 * band twice as wide in model units and exactly as wide to the eye. That is the
 * whole point of declaring it there rather than as a number of units in a rule:
 * an absolute slack is four times as strict on a map four times as big, and a
 * user who drops a symbol on the drawn line has no way of knowing which.
 *
 * Empty on a background that declares no width: silence, not a guessed one.
 */
export function backgroundTransitionBands(
  def: FrameworkBackgroundDef,
  bound: Bound
): { x: BackgroundTransitionBand[]; y: BackgroundTransitionBand[] } {
  const width = def.transitionBandWidth;
  if (width === undefined) return { x: [], y: [] };

  const plot = backgroundPlot(def, bound.w, bound.h);
  const ratios = backgroundZoneBoundaries(def);
  const band = (
    axis: 'x' | 'y',
    at: Ratio,
    origin: number,
    span: number
  ): BackgroundTransitionBand => {
    const centre = origin + at * span;
    const half = (width * span) / 2;
    return {
      id: zonesMeetingAt(def, axis, at),
      at: centre,
      min: centre - half,
      max: centre + half,
    };
  };
  return {
    x: ratios.x.map(at => band('x', at, bound.x + plot.x0, plot.width)),
    y: ratios.y.map(at => band('y', at, bound.y + plot.y0, plot.height)),
  };
}
