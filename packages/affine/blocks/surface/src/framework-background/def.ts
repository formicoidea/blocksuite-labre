import type { RoleId } from '@labre/std/gfx';

/**
 * The framework-background DECLARATION (PF2.1).
 *
 * A framework describes its background as DATA — geometry, axes, zones,
 * chrome — and the primitive paints it. Nothing here is a function, a class or
 * a closure: same philosophy as the validation rules (`../extensions/validation.ts`)
 * and the role defs (`@labre/std/gfx`), for the same reason — a declaration is
 * comparable, serialisable, reviewable by a non-developer and can one day be
 * shipped by a host without a release of this library.
 *
 * The default rendering of a declaration that says nothing but its size is a
 * plain white rectangle: no axis, no zone, no decoration.
 *
 * ## Two coordinate spaces
 *
 * - the **element box**, `[0,0,w,h]` in model units, which the card is drawn in;
 * - the **plot**, the element box minus {@link BackgroundGeometry.margin}.
 *   Every ratio in this file is a ratio OF THE PLOT: `x: 0` is its left edge,
 *   `y: 1` its bottom edge. Ratios scale with the element; the offsets beside
 *   them (`dx`, `dy`, margins, font sizes, stroke widths) are FIXED model
 *   units and do not, so labels stay legible however large the background is
 *   stretched.
 */

/** A position expressed as a fraction of a plot span, `0..1`. */
export type Ratio = number;

/**
 * A colour: either a literal (`'#ffffff'`) or `@name`, resolved against
 * {@link BackgroundChromeDef.palette} — the declarative colour code.
 */
export type BackgroundColor = string;

export interface BackgroundInset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BackgroundStroke {
  color: BackgroundColor;
  width: number;
  /** Dash pattern in model units; absent or empty means a solid line. */
  dash?: readonly number[];
}

export interface BackgroundTextStyle {
  /** Font size in FIXED model units — it does not scale with the element. */
  size: number;
  color: BackgroundColor;
  /** Defaults to {@link BackgroundChromeDef.fontFamily}. */
  family?: string;
  /** Omitted from the font string when absent, i.e. the browser default. */
  weight?: number;
  italic?: boolean;
}

/** Where a piece of text sits: a plot ratio plus a fixed model-unit offset. */
export interface BackgroundAnchor {
  x: Ratio;
  y: Ratio;
  dx?: number;
  dy?: number;
}

/**
 * Where the words come from. THREE sources, tried in order:
 *
 * 1. `prop` — a model prop holding the user's own text. A framework whose
 *    labels are editable on the canvas declares this, and the user's wording
 *    always wins.
 * 2. `labelKey` — an i18n key, resolved through the house seam
 *    (`TranslationProvider`, which the host injects). This is the source for a
 *    framework whose labels are fixed vocabulary: no hard-coded prose.
 * 3. `fallback` — the default wording, used until a host resolves the key. A
 *    declaration with only a `fallback` is hard-coded text and should be
 *    treated as a gap, not as a pattern. A key with no fallback shows the raw
 *    key, so a dangling entry is visible rather than invented.
 */
export interface BackgroundLabelSource {
  prop?: string;
  labelKey?: string;
  fallback?: string;
}

/** A drawn piece of text: what it says, where, how, and when. */
export interface BackgroundTextDef extends BackgroundLabelSource {
  /** Stable id inside the declaration; also what a hit test reports. */
  id: string;
  anchor: BackgroundAnchor;
  style: BackgroundTextStyle;
  /** Defaults to `left` for horizontal text and `center` for vertical. */
  align?: 'left' | 'center' | 'right';
  /** Drawn rotated -90°, reading bottom-to-top. */
  vertical?: boolean;
  /** Model prop gating this text. Absent means always drawn. */
  visibleProp?: string;
}

/** One graduation on an axis. */
export interface BackgroundTickDef extends BackgroundLabelSource {
  /** Position along the axis, as a ratio of the plot span it runs on. */
  at: Ratio;
}

/**
 * The graduations of an axis.
 *
 * Deliberately NOT gated by the owning axis: on a Wardley map the evolution
 * dividers are wanted with the axis line hidden and vice versa, so ticks carry
 * their own {@link visibleProp}. Drawing an axis and graduating it are two
 * decisions.
 */
export interface BackgroundTicksDef {
  ticks: readonly BackgroundTickDef[];
  /** `grid` spans the whole plot; `mark` is a short stub on the axis line. */
  style: 'grid' | 'mark';
  /** Length of a `mark`, in model units. Ignored by `grid`. */
  length?: number;
  stroke: BackgroundStroke;
  visibleProp?: string;
  /** Absent means unlabelled graduations. */
  labelStyle?: BackgroundTextStyle;
  labelOffset?: { dx?: number; dy?: number };
  labelAlign?: 'left' | 'center' | 'right';
  labelVisibleProp?: string;
}

/**
 * A named axis of the frame of reference.
 *
 * `forward` is the direction of INCREASING value: rightwards for a horizontal
 * axis, UPWARDS for a vertical one — which is where a reader expects "more" to
 * be, and the opposite of increasing screen `y`.
 */
export interface BackgroundAxisDef {
  id: string;
  orientation: 'horizontal' | 'vertical';
  /**
   * Which plot line the axis sits on, across its own orientation: a horizontal
   * axis at `1` runs along the bottom, a vertical axis at `0` up the left edge.
   */
  at: Ratio;
  arrow?: 'none' | 'forward' | 'backward' | 'both';
  /** Arrowhead length in model units. */
  arrowSize?: number;
  stroke: BackgroundStroke;
  /** Model prop gating the line, its arrowheads AND its title. */
  visibleProp?: string;
  /** The axis name. Shares the axis' own visibility. */
  title?: BackgroundTextDef;
  /**
   * Words naming the two ends ("Uncharted"/"Industrialized"). Gated by their
   * OWN `visibleProp` only — naming where an axis leads is a separate decision
   * from drawing it.
   */
  endLabels?: readonly BackgroundTextDef[];
  ticks?: BackgroundTicksDef;
}

/** A named region of the plot. */
export interface BackgroundZoneDef {
  id: string;
  /** The zone rectangle, in plot ratios. */
  rect: { x: Ratio; y: Ratio; w: Ratio; h: Ratio };
  /** Tint painted under everything but the card. */
  fill?: BackgroundColor;
  /** Model prop gating the tint (not the label). */
  fillVisibleProp?: string;
  /** The zone name. Anchored in plot ratios like any other text. */
  label?: BackgroundTextDef;
}

/**
 * A flat colour wash over the plot, given as gradient stops.
 *
 * Stops are DATA — `[offset, alpha]` pairs — never a curve evaluated at paint
 * time. A framework whose wash follows an analytic function tabulates it once,
 * at module load, and ships the table.
 */
export interface BackgroundWashDef {
  id: string;
  /** Only painted when {@link FrameworkBackgroundDef.variantProp} is one of these. */
  variants?: readonly string[];
  visibleProp?: string;
  direction: 'horizontal' | 'vertical';
  color: BackgroundColor;
  /** `[offset 0..1, alpha 0..1]`, in ascending offset order. */
  stops: readonly (readonly [number, number])[];
}

/** A regular grid over the plot. Steps are ratios, so the grid scales. */
export interface BackgroundGridDef {
  stepX?: Ratio;
  stepY?: Ratio;
  stroke: BackgroundStroke;
  visibleProp?: string;
}

export interface BackgroundSurfaceDef {
  fill?: BackgroundColor;
  border?: { color: BackgroundColor; width: number; radius?: number };
}

/** One row of a drawn legend: a swatch and what it means. */
export interface BackgroundLegendRow extends BackgroundLabelSource {
  id: string;
  swatch?: BackgroundColor;
}

/** A legend box drawn on the plot. */
export interface BackgroundLegendDef {
  anchor: BackgroundAnchor;
  width: number;
  rowHeight: number;
  padding: number;
  surface?: BackgroundSurfaceDef;
  title?: BackgroundLabelSource;
  titleStyle?: BackgroundTextStyle;
  rowStyle: BackgroundTextStyle;
  rows: readonly BackgroundLegendRow[];
  /** Swatch square side, in model units. */
  swatchSize?: number;
  visibleProp?: string;
}

/** Everything that dresses the frame: fills, grid, legend, colour code. */
export interface BackgroundChromeDef {
  /** Font family every text inherits unless it names its own. */
  fontFamily?: string;
  /**
   * The card — the element rectangle itself. Absent means the default:
   * a plain white rectangle with no border.
   */
  surface?: BackgroundSurfaceDef;
  /** Washes over the plot, painted in declaration order, under the zones. */
  washes?: readonly BackgroundWashDef[];
  grid?: BackgroundGridDef;
  legend?: BackgroundLegendDef;
  /** The colour code: names a palette entry `@name` can resolve to. */
  palette?: Readonly<Record<string, BackgroundColor>>;
  /** Free-standing texts, tied to neither an axis nor a zone. */
  annotations?: readonly BackgroundTextDef[];
}

export interface BackgroundGeometry {
  /** Reference size in model units — what a fresh background is created at. */
  width: number;
  height: number;
  /**
   * When true the reference proportion `height / width` is preserved as the
   * background is sized up to match its neighbours. `false` leaves the two
   * dimensions independent.
   *
   * A starting proportion, not a constraint on the user's hand: once
   * {@link resizable} lets the handles out, dragging them is free either way.
   */
  lockAspectRatio: boolean;
  /** Whether a fresh background offers its resize handles (`resizeEnabled`). */
  resizable: boolean;
  /** Fixed inset, in model units, between the element box and the plot. */
  margin: BackgroundInset;
}

/**
 * One framework's background, in full. The primitive needs nothing else to
 * paint it, to hit-test its editable labels or to size a new one.
 */
export interface FrameworkBackgroundDef {
  /** The PERSISTED element type this declaration implements (`wardley`). */
  type: string;
  /** The role stamped on the element at creation, so rules can frame against it. */
  role?: RoleId;
  geometry: BackgroundGeometry;
  /** Model prop selecting a variant; washes name the variants they belong to. */
  variantProp?: string;
  axes?: readonly BackgroundAxisDef[];
  zones?: readonly BackgroundZoneDef[];
  chrome?: BackgroundChromeDef;
}

/** The default card: a plain white rectangle, no border, no radius. */
export const DEFAULT_BACKGROUND_SURFACE: BackgroundSurfaceDef = {
  fill: '#ffffff',
};

/** The plot rectangle of a background of size `w × h`, in element-local units. */
export function backgroundPlot(
  def: FrameworkBackgroundDef,
  w: number,
  h: number
) {
  const { margin } = def.geometry;
  const x0 = margin.left;
  const y0 = margin.top;
  const x1 = w - margin.right;
  const y1 = h - margin.bottom;
  return { x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 };
}

/** Element-local point of an anchor, given the plot it is expressed against. */
export function backgroundPoint(
  anchor: BackgroundAnchor,
  plot: ReturnType<typeof backgroundPlot>
): [number, number] {
  return [
    plot.x0 + anchor.x * plot.width + (anchor.dx ?? 0),
    plot.y0 + anchor.y * plot.height + (anchor.dy ?? 0),
  ];
}

/** Resolve `@name` against the palette; anything else is a literal colour. */
export function backgroundColor(
  color: BackgroundColor | undefined,
  palette: Readonly<Record<string, BackgroundColor>> | undefined
): string {
  if (!color) return 'transparent';
  if (color.startsWith('@')) return palette?.[color.slice(1)] ?? 'transparent';
  return color;
}

/**
 * The size a fresh background of this framework is created at, never smaller
 * than the bounds it is asked to cover — so a second map dropped on a board
 * matches the biggest one already there instead of shrinking beside it.
 */
export function backgroundSize(
  def: FrameworkBackgroundDef,
  atLeastWidth = 0,
  atLeastHeight = 0
): { width: number; height: number } {
  const { width: refWidth, height: refHeight, lockAspectRatio } = def.geometry;
  if (!lockAspectRatio) {
    return {
      width: Math.max(refWidth, atLeastWidth),
      height: Math.max(refHeight, atLeastHeight),
    };
  }
  const ratio = refHeight / refWidth;
  const width = Math.max(refWidth, atLeastWidth, atLeastHeight / ratio);
  return { width, height: width * ratio };
}
