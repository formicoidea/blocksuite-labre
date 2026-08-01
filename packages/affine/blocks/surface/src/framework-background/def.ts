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
  /**
   * Defaults to {@link BackgroundChromeDef.fontFamily}. Named consumer:
   * Estuarine draws its `e` / `t` axis letters in `Georgia, serif` while the
   * rest of the map is Inter.
   */
  family?: string;
  /**
   * Omitted from the font string when absent, i.e. the browser default. Named
   * consumers: the BPMN pool draws its participant name at `600`, Estuarine its
   * curve legends at `600`, Cynefin its domain headings at `700`.
   */
  weight?: number;
  /** Named consumer: Estuarine's `e` / `t` letters are `italic 700`. */
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
export interface BackgroundTickDef {
  /** Position along the axis, as a ratio of the plot span it runs on. */
  at: Ratio;
}

/**
 * The graduations of an axis: divider lines spanning the plot.
 *
 * Deliberately NOT gated by the owning axis: on a Wardley map the evolution
 * dividers are wanted with the axis line hidden and vice versa, so ticks carry
 * their own {@link visibleProp}. Drawing an axis and graduating it are two
 * decisions.
 *
 * A graduation is a line and nothing else. Short stubs on the axis line, and
 * per-tick labels, had no framework asking for them — a tick that wants a name
 * is a {@link BackgroundZoneDef} with a label, which is what Wardley's
 * evolution phases actually are.
 */
export interface BackgroundTicksDef {
  ticks: readonly BackgroundTickDef[];
  stroke: BackgroundStroke;
  visibleProp?: string;
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
  /**
   * Named consumer for `both`: Estuarine's energy axis is double-headed (its
   * `e` runs positive and negative around zero).
   */
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
  color: BackgroundColor;
  /**
   * `[offset 0..1, alpha 0..1]`, in ascending offset order, along the plot
   * WIDTH. A wash runs left to right because that is the only direction any
   * framework has asked for; a vertical one is a field to add the day one does.
   */
  stops: readonly (readonly [number, number])[];
}

export interface BackgroundSurfaceDef {
  fill?: BackgroundColor;
  border?: { color: BackgroundColor; width: number; radius?: number };
}

/** Everything that dresses the frame: the card, the fills, the colour code. */
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
  /** The colour code: names a palette entry `@name` can resolve to. */
  palette?: Readonly<Record<string, BackgroundColor>>;
}

export interface BackgroundGeometry {
  /** Reference size in model units — what a fresh background is created at. */
  width: number;
  height: number;
  /**
   * When true the reference proportion `height / width` is preserved as the
   * background is sized up to match its neighbours. `false` leaves the two
   * dimensions independent — named consumer: the BPMN pool, a 560 × 200 lane
   * that is stretched in one direction all the time.
   *
   * A starting proportion, not a constraint on the user's hand: once
   * {@link resizable} lets the handles out, dragging them is free either way.
   */
  lockAspectRatio: boolean;
  /**
   * Whether the background offers its resize handles. Seeded onto
   * `resizeEnabled` at creation and used as the fallback for an element that
   * carries no such prop — see `backgroundResizeAllowed`.
   */
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
  /**
   * Width of the TOLERANCE BAND around each zone transition, as a ratio of the
   * plot span the transition is measured across. Centred on the transition, so
   * a band of `0.1` reaches `0.05` of the plot either side of the line.
   *
   * A frontier between two zones is a line to the renderer and a REGION to the
   * reader: things do not change phase at a coordinate, they change phase
   * around one. A framework whose rules ask "is this artefact at a transition"
   * declares here how wide "at" is — in a ratio, so the answer survives the map
   * being resized, exactly like every other position in this file.
   *
   * Absent means the framework has not declared one, and a rule asking for the
   * band gets silence rather than a guessed width.
   */
  transitionBandWidth?: Ratio;
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

/**
 * The colour a broken declaration paints in.
 *
 * Loud magenta on purpose: a background is DATA, and the cost of getting it
 * wrong must be seen on the canvas in one glance rather than debugged from a
 * `rgba(NaN,NaN,NaN,0.4)` that silently paints nothing.
 */
export const BROKEN_BACKGROUND_COLOR = '#ff00ff';

/** Warn once per distinct problem: a renderer runs on every frame. */
const warned = new Set<string>();

export function warnBrokenBackgroundColor(reason: string): void {
  if (warned.has(reason)) return;
  warned.add(reason);
  console.warn(`[framework-background] ${reason}`);
}

/**
 * Resolve `@name` against the palette; anything else is a literal colour.
 *
 * A name the palette does not carry is a typo in the declaration, not a
 * request for transparency: it warns and returns {@link BROKEN_BACKGROUND_COLOR}.
 */
export function backgroundColor(
  color: BackgroundColor | undefined,
  palette: Readonly<Record<string, BackgroundColor>> | undefined
): string {
  if (!color) return 'transparent';
  if (!color.startsWith('@')) return color;

  const resolved = palette?.[color.slice(1)];
  if (resolved !== undefined) return resolved;
  warnBrokenBackgroundColor(`no palette entry for "${color}"`);
  return BROKEN_BACKGROUND_COLOR;
}

/**
 * Whether the resize handles are offered for this element.
 *
 * The element's own `resizeEnabled` decides — it is what the toolbar toggle
 * writes. The declaration's {@link BackgroundGeometry.resizable} is the
 * fallback for an element that carries no such prop, which is what makes it
 * live data rather than documentation.
 */
export function backgroundResizeAllowed(
  def: FrameworkBackgroundDef,
  model: { resizeEnabled?: boolean }
): boolean {
  return model.resizeEnabled ?? def.geometry.resizable;
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
