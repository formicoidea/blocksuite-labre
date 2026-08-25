import type { Bound } from '@labre/global/gfx';

import {
  type BackgroundAxisDef,
  backgroundPlot,
  type FrameworkBackgroundDef,
  type Ratio,
} from './def.js';
import type { BackgroundModelLike } from './labels.js';

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
 * bounds of ONE instance of it, and — for the transition bands — the bag of
 * props that instance carries, which is data too).
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
  /**
   * The model prop that SHOWS this axis' graduations — the dividers a reader
   * sees the zone transitions BY.
   *
   * `undefined` when the axis declares no graduations, or declares them
   * ungated, i.e. always drawn. Read straight off
   * {@link BackgroundTicksDef.visibleProp}: the line that paints the frontier
   * is the line that names its own toggle, so a rule judging against that
   * frontier and the renderer drawing it can never disagree about whether it
   * is there.
   */
  transitionsVisibleProp?: string;
}

const FORWARD = {
  horizontal: [1, 0],
  vertical: [0, -1],
} as const satisfies Record<string, readonly [number, number]>;

/**
 * Frozen at module load, and not as a formality.
 *
 * `as const` is a COMPILE-TIME claim: it stops `FORWARD.horizontal[0] = -1`
 * from type-checking and does nothing whatsoever at runtime. These vectors are
 * handed out by reference — {@link backgroundAxisFacts} returns the constant
 * itself, not a copy — and they are what
 * `evaluateOrientationAgainstAxis` multiplies a subject's direction against. A
 * single write into one of them flips the axis convention for the whole
 * process: correct arrows start reporting as violations, on every map, for the
 * rest of the session.
 *
 * `AuditProvider` made that reachable — the audit seam hands the facts to a
 * host-supplied assistant (PF14.1). `requestAudit` clones the whole request, so
 * that path is closed at the boundary; this closes the class at the SOURCE, for
 * every other caller of {@link collectAuditFacts} and of these accessors,
 * present and future. Two defences, and the cheap one is the one that cannot be
 * forgotten by a caller who has not read the boundary.
 *
 * Cost: three `Object.freeze` calls, once, at module load. Effect: a mutation
 * throws in strict mode (every ES module) instead of silently corrupting the
 * engine three frames later.
 */
Object.freeze(FORWARD.horizontal);
Object.freeze(FORWARD.vertical);
Object.freeze(FORWARD);

/** The declared axes, as facts. Empty for a background that declares none. */
export function backgroundAxisFacts(
  def: FrameworkBackgroundDef
): readonly BackgroundAxisFact[] {
  return (def.axes ?? []).map(axis => ({
    id: axis.id,
    orientation: axis.orientation,
    forward: FORWARD[axis.orientation],
    ...(axis.ticks?.visibleProp !== undefined
      ? { transitionsVisibleProp: axis.ticks.visibleProp }
      : {}),
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

/** The plot axis a transition drawn by this axis' graduations runs across. */
function plotAxisOf(orientation: BackgroundAxisDef['orientation']): 'x' | 'y' {
  // A HORIZONTAL axis is graduated by VERTICAL lines, which sit at `x` ratios.
  return orientation === 'horizontal' ? 'x' : 'y';
}

/**
 * Whether a visibility gate is open, asked ON BEHALF OF A RULE.
 *
 * Deliberately not `backgroundVisible`, which the renderer uses. Painting asks
 * "do I draw this", and a prop the model does not carry means there is nothing
 * to draw. A rule asks the opposite question — "has the user HIDDEN the line I
 * am about to judge against" — and a prop the model does not carry is not the
 * user hiding anything. So the gate closes only on a value the instance
 * actually carries and that reads false; an instance that has never heard of
 * the prop keeps the rule it has always had.
 *
 * In a real document the two never diverge: a visibility toggle is declared
 * `@field(true)`, so every element carries it from the moment it is created.
 */
function gateOpen(
  prop: string,
  model: BackgroundModelLike | undefined
): boolean {
  if (model === undefined) return true;
  const value = model[prop];
  return value === undefined ? true : Boolean(value);
}

/**
 * Whether the part of ONE instance that DRAWS the transitions across a plot
 * axis is currently shown.
 *
 * The frontier a rule measures against is only a frontier the user can see
 * while the graduations that draw it are on the canvas. A framework says which
 * prop shows them — `axes[].ticks.visibleProp`, the very line the renderer
 * reads — and this resolves it against the instance's own props.
 *
 * `true` when nothing gates them: an axis with ungated graduations, an axis
 * with none at all, a framework declaring no axis. A background that never
 * offered the toggle is a background whose frontiers are always there, which is
 * exactly the behaviour every framework had before this existed.
 */
export function backgroundTransitionsShown(
  def: FrameworkBackgroundDef,
  plotAxis: 'x' | 'y',
  model: BackgroundModelLike | undefined
): boolean {
  let gated = false;
  for (const axis of def.axes ?? []) {
    const prop = axis.ticks?.visibleProp;
    if (prop === undefined) continue;
    if (plotAxisOf(axis.orientation) !== plotAxis) continue;
    gated = true;
    // Several axes may graduate the same plot axis; one of them being drawn is
    // enough for the frontier to be on the canvas.
    if (gateOpen(prop, model)) return true;
  }
  return !gated;
}

/**
 * Every model prop that can make a transition appear or disappear on this
 * background.
 *
 * The reactive half of {@link backgroundTransitionsShown}: whoever recomputes
 * verdicts has to know which props change one. Data, so the engine learns the
 * list from the declarations it was handed and names no framework.
 */
export function backgroundTransitionVisibleProps(
  def: FrameworkBackgroundDef
): readonly string[] {
  const props: string[] = [];
  for (const axis of def.axes ?? []) {
    const prop = axis.ticks?.visibleProp;
    if (prop !== undefined && !props.includes(prop)) props.push(prop);
  }
  return props;
}

/**
 * Complain once per distinct problem. These accessors run on every evaluation,
 * so a bare `console.warn` about a malformed declaration would fill the console
 * at 8 Hz while somebody drags.
 */
const warned = new Set<string>();

function warnOnce(reason: string): void {
  if (warned.has(reason)) return;
  warned.add(reason);
  console.warn(`[framework-background] ${reason}`);
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
 *
 * ## Two shapes a band may not silently take
 *
 * A declaration is data, and data gets typos. Both are caught here rather than
 * downstream, because the failure modes are invisible on the canvas:
 *
 * - a width of `0` or less would make an INVERTED band (`min > max`) that
 *   nothing can be inside — a rule requiring one would indict every subject on
 *   the board, over a number nobody meant. The requirement is dropped instead;
 * - a width wider than the gap between two transitions would make OVERLAPPING
 *   bands, so a point could be "at" two frontiers at once and the middle of a
 *   phase would qualify as a boundary. The width is narrowed to that gap.
 *
 * Both warn once in the console: a declaration that quietly means something
 * other than what it says is worse than one that fails loudly.
 *
 * ## A hidden frontier is not a frontier
 *
 * `model` is the bag of props of the instance being measured. Given one, an
 * axis whose graduations the user has switched off contributes NO band along
 * its plot axis (see {@link backgroundTransitionsShown}) — a caller asking "is
 * this at a transition" gets the same silence as on a frame that declares no
 * transition at all. Nothing is judged against a line nobody can see.
 *
 * Omitting `model` asks the question of the DECLARATION alone: every declared
 * transition, whatever any instance shows. That is what a caller describing the
 * map's meaning rather than judging its drawing wants, and it is what every
 * caller got before this argument existed.
 */
export function backgroundTransitionBands(
  def: FrameworkBackgroundDef,
  bound: Bound,
  model?: BackgroundModelLike
): { x: BackgroundTransitionBand[]; y: BackgroundTransitionBand[] } {
  const declared = def.transitionBandWidth;
  if (declared === undefined) return { x: [], y: [] };
  if (!(declared > 0)) {
    warnOnce(
      `"${def.type}" declares a transitionBandWidth of ${declared} — a band ` +
        `with no width is a band nothing can be inside, so the requirement is ` +
        `dropped rather than refusing every subject on the board.`
    );
    return { x: [], y: [] };
  }

  const plot = backgroundPlot(def, bound.w, bound.h);
  const ratios = backgroundZoneBoundaries(def);
  const bands = (
    axis: 'x' | 'y',
    along: readonly Ratio[],
    origin: number,
    span: number
  ): BackgroundTransitionBand[] => {
    const width = fittedWidth(def, declared, along);
    return along.map(at => {
      const centre = origin + at * span;
      const half = (width * span) / 2;
      return {
        id: zonesMeetingAt(def, axis, at),
        at: centre,
        min: centre - half,
        max: centre + half,
      };
    });
  };
  const shown = (plotAxis: 'x' | 'y') =>
    model === undefined || backgroundTransitionsShown(def, plotAxis, model);
  return {
    x: shown('x') ? bands('x', ratios.x, bound.x + plot.x0, plot.width) : [],
    y: shown('y') ? bands('y', ratios.y, bound.y + plot.y0, plot.height) : [],
  };
}

/**
 * The declared width, narrowed so that two adjacent bands cannot overlap.
 *
 * Clamped to the smallest gap between two transitions, which is the widest a
 * band can be while every point still belongs to at most one frontier (the two
 * neighbours then meet at a single point). Nothing to clamp when the axis
 * carries fewer than two transitions.
 */
function fittedWidth(
  def: FrameworkBackgroundDef,
  declared: number,
  along: readonly Ratio[]
): number {
  let gap = Infinity;
  for (let i = 1; i < along.length; i++) {
    gap = Math.min(gap, along[i] - along[i - 1]);
  }
  if (declared <= gap) return declared;

  warnOnce(
    `"${def.type}" declares a transitionBandWidth of ${declared}, wider than ` +
      `the ${gap} between two of its transitions — the bands would overlap and ` +
      `a point would sit at two frontiers at once. Narrowed to ${gap}.`
  );
  return gap;
}
