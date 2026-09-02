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
  /**
   * Where the anchor sits on the glyphs. `alphabetic` — the default, and what
   * every text meant before this existed — puts it on the BASELINE, so the
   * words hang above the anchor; `middle` centres them on it.
   *
   * Named consumer: the BPMN pool, whose participant name is centred ACROSS the
   * band it is written in. A baseline anchor there would push the name against
   * the frame instead of down the middle of the band — the one case where the
   * two conventions are visibly different, because the room the text is given
   * is the width of the glyphs and nothing more.
   */
  baseline?: 'alphabetic' | 'middle';
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
  /**
   * Only drawn when {@link FrameworkBackgroundDef.variantProp} reads one of
   * these — the same semantics a wash already has
   * ({@link BackgroundWashDef.variants}), and the reason a variant is a
   * DECLARATION and not a second background.
   *
   * Absent means every variant, which is what every text meant before this
   * existed. Distinct from {@link visibleProp}, and the two compose: a variant
   * says which chart this text belongs to, a visible prop says whether the user
   * has switched it off in the chart it does belong to.
   */
  variants?: readonly string[];
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
  /**
   * The variants this zone exists in, same semantics as
   * {@link BackgroundWashDef.variants}: only drawn when
   * {@link FrameworkBackgroundDef.variantProp} reads one of them, and absent
   * means all of them.
   *
   * Unlike {@link fillVisibleProp}, which gates the TINT alone, this gates the
   * zone as a whole — its {@link label} included, unless that label names its
   * own variants. A quadrant that is not part of this reading of the chart has
   * no name to be written on the canvas either, and the same precedent already
   * holds one layer up: an axis' title shares the axis' visibility.
   */
  variants?: readonly string[];
  /** Tint painted under everything but the card. */
  fill?: BackgroundColor;
  /** Model prop gating the tint (not the label). */
  fillVisibleProp?: string;
  /** The zone name. Anchored in plot ratios like any other text. */
  label?: BackgroundTextDef;
}

/**
 * One region of the plot an INSTANCE declares, read off a model prop.
 *
 * The counterpart of {@link BackgroundZoneDef}, which is part of the framework
 * and identical on every element of it. This one is the user's own partition of
 * their own frame: a BPMN pool's lanes (couloirs) are exactly this — how many
 * there are, what they are called and how the height is shared between them is
 * a property of THAT pool, not of BPMN.
 */
export interface BackgroundInstanceZoneItem {
  /** Stable id inside the instance; what a reported zone id is built from. */
  id: string;
  /** The zone name, drawn in the band. Absent means an unnamed band. */
  name?: string;
  /**
   * A relative WEIGHT, not a length: the zones share the plot in proportion to
   * their sizes. See {@link BackgroundInstanceZonesDef} for why.
   */
  size: number;
}

/**
 * A label STRIP at the leading edge of every instance zone.
 *
 * The placement BPMN 2.0 draws a lane title in, and the one bpmn.io, Camunda
 * and Visio all render: a fixed-width band along the lane's leading edge,
 * immediately inside the pool's own participant band, with the lane name turned
 * on its side. The first placement this file offered wrote the name across the
 * zone's top-left corner instead; the PO's visual recette (2026-08-26) settled
 * it against the corner, on notation rather than on taste — a reader who knows
 * BPMN reads the strip as a lane title and a floating corner word as a note.
 *
 * ## The strip is CHROME, not a smaller zone
 *
 * {@link backgroundInstanceZones} keeps reporting the FULL plot slice, and the
 * strip is painted inside it. That is the BPMN reading and not an
 * implementation shortcut: the title band belongs TO the lane, so an element
 * dropped on it is in that lane, and a lane's share of the pool does not shrink
 * because it was given a name. Membership, the audit and every rule therefore
 * see exactly what they saw before this existed.
 *
 * ## Which way the words run
 *
 * From the stack, not from a field: a `'y'` stack makes the strip tall and
 * narrow, so the name is rotated to read bottom-to-top, exactly as the
 * participant name is one level up ({@link BackgroundSideBandDef}); an `'x'`
 * stack makes it short and wide, so the name stays upright. A declaration that
 * could disagree with its own geometry would only ever be a way to get it
 * wrong.
 */
export interface BackgroundInstanceZoneBandDef {
  /** Strip thickness in FIXED model units — across the stacking direction. */
  width: number;
  /** The line between the strip and the rest of the zone. Absent means none. */
  divider?: BackgroundStroke;
}

/**
 * A background whose plot its INSTANCES divide up.
 *
 * A framework declares here that its elements carry their own partition, which
 * prop holds it and how the pieces stack; the primitive paints the dividers and
 * the names, and the audit reports the pieces as zones like any other. Named
 * consumer: the BPMN pool, whose lanes arrive in the tranche after this one.
 *
 * ## Why weights and not model units
 *
 * Every position in this file is a ratio of the plot precisely so that a
 * background survives being stretched, and an instance partition has to survive
 * it too. Sizes are therefore NORMALISED over their sum: a pool with lanes of
 * `1, 2, 1` gives the middle one half the height at any size, and dragging the
 * pool taller redistributes the extra space proportionally instead of leaving a
 * gap under the last band or pushing it out of the frame. The numbers are also
 * free of a unit the user would have to think in — `2` reads as "twice the
 * other one", which is the only thing a lane's height ever means.
 */
export interface BackgroundInstanceZonesDef {
  /** Model prop holding the {@link BackgroundInstanceZoneItem}[]. */
  prop: string;
  /**
   * Which way the zones stack. `'y'` lays them out as horizontal bands, full
   * width, top to bottom in array order — the BPMN pool. `'x'` is the
   * symmetric case: full-height columns, left to right.
   */
  stack: 'x' | 'y';
  /** The line between two adjacent zones. Absent means none is drawn. */
  divider?: BackgroundStroke;
  /**
   * How a zone's {@link BackgroundInstanceZoneItem.name} is written.
   *
   * Not a {@link BackgroundTextDef}: there is one style for every zone of the
   * instance, and the anchor is the zone's own geometry rather than a declared
   * ratio — the whole point is that the declaration does not know how many
   * zones there are or where they sit.
   *
   * ## Two placements, selected by the PRESENCE of {@link band}
   *
   * - **corner** (no `band`) — horizontal, anchored at the top-left of the
   *   zone, inset by `dx` / `dy` in FIXED model units like every other offset
   *   here. The original placement, and still the default;
   * - **band** — a fixed-width label STRIP at the zone's leading edge, with the
   *   name written along it: rotated for a `'y'` stack, upright for an `'x'`
   *   one. See {@link BackgroundInstanceZoneBandDef}.
   *
   * Presence as the selector rather than a discriminated union, deliberately.
   * A union would need a tag on every declaration that already exists, which
   * makes an additive change a breaking one for no reader; and presence is
   * already how this file says "this feature is off" everywhere else — an
   * absent `instanceZones` is no partition, an absent `divider` is no line, an
   * absent `label` is no names at all. `dx` / `dy` belong to the corner
   * placement and are ignored under a band, which has no corner to inset from.
   */
  label?: {
    style: BackgroundTextStyle;
    /** Corner placement only. */
    dx?: number;
    /** Corner placement only. */
    dy?: number;
    /** Present = band placement. */
    band?: BackgroundInstanceZoneBandDef;
  };
  /**
   * Prefix of the reported zone ids: `'lane'` reports `lane:sales`.
   *
   * A namespace, not decoration. The instance zones are concatenated with the
   * declared ones ({@link FrameworkBackgroundDef.zones}) wherever zones are
   * consumed, and a user free to name a lane `early` must not be able to shadow
   * a framework zone by doing so.
   */
  idPrefix: string;
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
  /**
   * The frame round the card. `dash` is a pattern in model units, exactly as
   * {@link BackgroundStroke.dash} is; absent — which is what every declaration
   * written before it existed says — draws the solid line it always drew.
   *
   * Named consumer: the C4 boundary, which the notation draws as a DASHED
   * rectangle round a group of elements. A dash is what tells a boundary from a
   * board on that canvas, so it belongs where the rest of the frame is declared
   * rather than in a renderer wrapper only one framework would ever have.
   */
  border?: {
    color: BackgroundColor;
    width: number;
    radius?: number;
    dash?: readonly number[];
  };
}

/**
 * A filled strip of FIXED width, painted over one margin of the card.
 *
 * The thickness of a band IS the margin it covers
 * ({@link BackgroundGeometry.margin}) — `margin.left` for a `'left'` band,
 * `margin.top` for a `'top'` one — never a second number: the margin is
 * already the room the plot gives up to the furniture, and letting a
 * declaration state a different thickness would be two numbers that must agree
 * and one day will not. An element smaller than its own margin clamps the band
 * to the element, which is the only case where the two can disagree.
 *
 * A band is part of the CARD, not a layer over it: it is painted over the
 * card's fill and under its border, so the frame keeps outlining the whole
 * element. Its {@link label} is a text like any other, drawn with the rest of
 * them, and anchored in plot ratios — the plot edge is the band's inner edge,
 * so `x: 0` with a negative `dx` walks back INTO the band.
 *
 * Named consumers: the BPMN pool, a lane whose participant name is written up a
 * filled band along its left edge, with a {@link divider} between that band and
 * the flow area; and the C4 board, whose diagram title is written across a
 * header strip along its top edge.
 *
 * `'left'` and `'top'` — the two a framework has actually asked for. The union
 * grows the day one asks for a right or a bottom band, not in anticipation of
 * one, which is the same philosophy the wash direction follows
 * ({@link BackgroundWashDef.stops}).
 */
export interface BackgroundSideBandDef {
  side: 'left' | 'top';
  /** Tint over the whole strip. Absent means the card shows through. */
  fill?: BackgroundColor;
  /** The line between the band and the plot. Absent means none. */
  divider?: BackgroundStroke;
  /** The words written in the band — the band's own label. */
  label?: BackgroundTextDef;
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
  /**
   * Filled strips over the margins, painted WITH the card — over its fill, under
   * its border — in declaration order.
   */
  sideBands?: readonly BackgroundSideBandDef[];
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
   * The plot partition each INSTANCE carries, if this framework lets its
   * elements declare one. Absent — the case for every framework so far — means
   * a background whose zones are the same on every element of it.
   */
  instanceZones?: BackgroundInstanceZonesDef;
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

function warnOnce(reason: string): void {
  if (warned.has(reason)) return;
  warned.add(reason);
  console.warn(`[framework-background] ${reason}`);
}

export function warnBrokenBackgroundColor(reason: string): void {
  warnOnce(reason);
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

/** One zone of one instance, resolved: a name and a rectangle in plot ratios. */
export interface BackgroundInstanceZone {
  /** `${idPrefix}:${item.id}` — never collides with a declared zone id. */
  id: string;
  name?: string;
  rect: { x: Ratio; y: Ratio; w: Ratio; h: Ratio };
}

/** Nothing to report, shared so the common case allocates no array. */
const NO_INSTANCE_ZONES: readonly BackgroundInstanceZone[] = Object.freeze([]);

/**
 * The plot partition ONE instance carries, as rectangles in plot ratios.
 *
 * The semantic accessor onto {@link BackgroundInstanceZonesDef}: everything
 * that has to know where a user's own zones sit — the renderer that draws their
 * dividers and their names, the audit that reports them, the rules a later
 * tranche will judge inside them — reads them here, so a lane is one shape and
 * not four that must agree. Named consumer: the BPMN pool's lanes (couloirs).
 *
 * Pure: declaration plus the instance's bag of props in, plain data out. Ratios
 * and not model units, for the reason every position in this file is a ratio —
 * an instance stretched to twice its height keeps the same partition.
 *
 * ## What a malformed partition does
 *
 * A partition is data the user edits, so it gets typos and half-written rows,
 * and none of them may take the frame down or paint a picture that lies:
 *
 * - a missing, empty or non-array prop yields `[]` — a background that simply
 *   has no partition yet, which is what every instance looks like the moment it
 *   is created;
 * - an entry that is not an object, or carries no string id, is dropped;
 * - a size that is not a finite number, or is `0` or less, is dropped with a
 *   warning: a zero-height band is a band nothing can be in, and a negative one
 *   would eat into its neighbours. Dropped rather than clamped, for the reason
 *   {@link FrameworkBackgroundDef.transitionBandWidth} drops its own degenerate
 *   case — silently inventing a size is worse than showing one band fewer;
 * - once for each distinct problem, like every other diagnostic on the paint
 *   path (see {@link warnBrokenBackgroundColor}).
 *
 * The survivors keep their declaration ORDER, and their sizes are normalised
 * over the sum of the survivors — so dropping a broken row redistributes its
 * space rather than leaving a hole where it was.
 */
export function backgroundInstanceZones(
  def: FrameworkBackgroundDef,
  model: Readonly<Record<string, unknown>>
): readonly BackgroundInstanceZone[] {
  const spec = def.instanceZones;
  if (spec === undefined) return NO_INSTANCE_ZONES;

  const raw = model[spec.prop];
  if (!Array.isArray(raw) || raw.length === 0) return NO_INSTANCE_ZONES;

  const items: BackgroundInstanceZoneItem[] = [];
  let total = 0;
  for (const entry of raw as readonly unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const item = entry as Partial<BackgroundInstanceZoneItem>;
    if (typeof item.id !== 'string' || item.id === '') continue;

    const size = item.size;
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
      warnOnce(
        `"${def.type}" instance zone "${item.id}" declares a size of ${String(
          size
        )} — a zone with no extent is one nothing can be inside, so it is ` +
          `dropped and its neighbours share the space.`
      );
      continue;
    }
    items.push({
      id: item.id,
      ...(typeof item.name === 'string' ? { name: item.name } : {}),
      size,
    });
    total += size;
  }
  if (items.length === 0 || !(total > 0)) return NO_INSTANCE_ZONES;

  const zones: BackgroundInstanceZone[] = [];
  let at = 0;
  for (const item of items) {
    const share = item.size / total;
    zones.push({
      id: `${spec.idPrefix}:${item.id}`,
      ...(item.name !== undefined ? { name: item.name } : {}),
      rect:
        spec.stack === 'y'
          ? { x: 0, y: at, w: 1, h: share }
          : { x: at, y: 0, w: share, h: 1 },
    });
    at += share;
  }
  return zones;
}

/** A rectangle in ELEMENT-LOCAL model units, i.e. what the renderer paints in. */
export interface BackgroundRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The label STRIP of one instance zone, in element-local model units.
 *
 * `null` when the declaration asks for no band, or when there is no room for
 * one. THE one place that knows where a lane title sits: the renderer paints
 * from it and the framework's view hit-tests a double-click against it, so the
 * words a user aims at and the words they get are the same rectangle by
 * construction rather than by two constants that must agree.
 *
 * Clamped to the plot, the way a side band clamps to an element narrower than
 * its own margin ({@link BackgroundSideBandDef}) — the same degenerate case,
 * and the same answer.
 */
export function backgroundInstanceZoneBand(
  def: FrameworkBackgroundDef,
  zone: BackgroundInstanceZone,
  plot: ReturnType<typeof backgroundPlot>
): BackgroundRect | null {
  const spec = def.instanceZones;
  const band = spec?.label?.band;
  if (spec === undefined || band === undefined) return null;
  if (!(band.width > 0)) return null;

  if (spec.stack === 'y') {
    const width = Math.min(band.width, plot.width);
    if (!(width > 0)) return null;
    return {
      x: plot.x0,
      y: plot.y0 + zone.rect.y * plot.height,
      w: width,
      h: zone.rect.h * plot.height,
    };
  }
  const height = Math.min(band.width, plot.height);
  if (!(height > 0)) return null;
  return {
    x: plot.x0 + zone.rect.x * plot.width,
    y: plot.y0,
    w: zone.rect.w * plot.width,
    h: height,
  };
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
