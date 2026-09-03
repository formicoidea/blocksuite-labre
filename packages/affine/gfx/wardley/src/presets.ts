import {
  ConnectorMode,
  DEFAULT_POLYGON_VERTICES,
  FontFamily,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  TextFitMode,
  type WardleyNodeKind,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';

import {
  ACCELERATOR_FILL,
  ACCELERATOR_LABEL,
  ACCELERATOR_SIZE,
  ACCELERATOR_STROKE_WIDTH,
  ACCELERATOR_VERTICES,
  AREA_FILL,
  AREA_POLYGON_SIZE,
  AREA_RECT_SIZE,
  AREA_STROKE,
  AREA_STROKE_WIDTH,
  DECELERATOR_LABEL,
  DECELERATOR_VERTICES,
  ECOSYSTEM_LABEL,
  ECOSYSTEM_SIZE,
  HANDLE_SIZE,
  LABEL_DEFAULT,
  LABEL_FONT_SIZE,
  MARKET_DOT_RING,
  MARKET_DOT_SIZE,
  MARKET_DOT_STROKE_WIDTH,
  MARKET_LABEL,
  MARKET_LINK_COLOR,
  MARKET_LINK_WIDTH,
  MARKET_SIZE,
  METHOD_FILL,
  METHOD_LABEL,
  METHOD_SIZE,
  NODE_FILL,
  NODE_SIZE,
  NODE_STROKE,
  NODE_STROKE_WIDTH,
  PIPELINE_FILL,
  PIPELINE_HEIGHT,
  PIPELINE_LABEL,
  PIPELINE_WIDTH,
  PORTER_ARROW,
  PORTER_LETTER_FONT_SIZE,
  PORTER_SIZE,
  WARDLEY_RED,
} from './node/consts';
import { WARDLEY_ROLE } from './roles';

/**
 * What a Wardley artefact IS, as props — the ONE description the creation sites
 * and the morph both read.
 *
 * Split out of `actions.ts` when the morph landed, for the reason C4's and
 * BPMN's `presets.ts` give: a kind's appearance is written by the preset of the
 * kind it was CREATED as and nothing else ever rewrites it, so a morph that
 * restated the table would agree with the palette the day it was written and
 * drift on the first restyle. Derived, they cannot — a component morphed into a
 * market and one drawn from the sub-menu are the same element.
 *
 * The three pieces that are not artefacts live here too, and for the same
 * reason: the pipeline's HANDLE, the market's three neutral DOTS and the
 * triangle that wires them are glyph parts, and the morph has to be able to
 * build and unbuild them exactly as `createWardleyMarket` /
 * `createWardleyPipeline` build them once.
 */

/**
 * Every kind a user can draw — {@link WardleyNodeKind} minus the `handle`.
 *
 * The handle is not an artefact: it is the square that straddles a pipeline's
 * top edge so connectors have somewhere to land (the body itself declares
 * `connectable === false`). Nobody picks one from the palette, nothing may morph
 * into one, and {@link wardleyHandleProps} is how the two composites that need
 * one ask for it.
 */
export type WardleyArtefactKind = Exclude<WardleyNodeKind, 'handle'>;

/**
 * The size a kind is BORN at, which for Wardley is the notation rather than a
 * default.
 *
 * A market is 30 across and a component is 18 because that is what tells a
 * reader which is which — the two are the same white circle otherwise. Same for
 * the ecosystem's 40 and the pipeline's 120×25 bar. This is the table the morph
 * re-centres an artefact on, and the one the palette draws from.
 */
export const WARDLEY_NODE_SIZE: Record<
  WardleyArtefactKind,
  { w: number; h: number }
> = {
  component: { w: NODE_SIZE, h: NODE_SIZE },
  anchor: { w: NODE_SIZE, h: NODE_SIZE },
  ecosystem: { w: ECOSYSTEM_SIZE, h: ECOSYSTEM_SIZE },
  method: { w: METHOD_SIZE, h: METHOD_SIZE },
  market: { w: MARKET_SIZE, h: MARKET_SIZE },
  pipeline: { w: PIPELINE_WIDTH, h: PIPELINE_HEIGHT },
  porter: { w: PORTER_SIZE, h: PORTER_SIZE },
  accelerator: ACCELERATOR_SIZE,
  decelerator: ACCELERATOR_SIZE,
  // The RECT's size, because a kind gets one entry and the rect is the common
  // area. The polygon's is {@link WARDLEY_AREA_SIZE} right below — the one
  // place where a kind's canonical box depends on the shape it is drawn as.
  area: AREA_RECT_SIZE,
};

/** The two shapes one area kind is drawn as: a plain zone, or one with corners. */
export type WardleyAreaShape = 'rect' | 'polygon';

/**
 * The size an area is born at, per shape.
 *
 * Beside {@link WARDLEY_NODE_SIZE} rather than in it, because the table above
 * is keyed by KIND and these two artefacts are one kind: a rectangle 240 × 160
 * covers a band of the map, and the polygon is born square so its default
 * pentagon is regular. `WARDLEY_NODE_SIZE.area` is the rect's, so anything that
 * asks a kind for its canonical box — the morph does — still gets an answer.
 */
export const WARDLEY_AREA_SIZE: Record<
  WardleyAreaShape,
  { w: number; h: number }
> = {
  rect: AREA_RECT_SIZE,
  polygon: AREA_POLYGON_SIZE,
};

/**
 * The kinds drawn as a native POLYGON, and the outline each one is.
 *
 * The table {@link wardleyNodeProps} reads to decide the shape type, so a kind's
 * membership here is the whole of what makes it an arrow rather than a circle.
 * A fresh array per call: `vertices` goes into a document, and a shared frozen
 * literal handed to two elements would be one array two elements point at.
 */
const NODE_VERTICES_OF: Partial<
  Record<WardleyArtefactKind, readonly (readonly [number, number])[]>
> = {
  accelerator: ACCELERATOR_VERTICES,
  decelerator: DECELERATOR_VERTICES,
};

/**
 * Every kind that is created NEXT TO a name — {@link WardleyArtefactKind} minus
 * the `porter` and the `area`.
 *
 * Those two are the artefacts with no label ELEMENT at all, and narrowing the
 * key type is how that is said rather than an empty string parked in the table
 * below. An empty string would be a name the author has not typed yet, which is
 * exactly what the placeholders ARE and exactly what the morph is allowed to
 * rewrite; a force's letter is the notation and belongs to nobody's vocabulary,
 * and a zone's name is written INSIDE the zone, so a placeholder there would be
 * a word the author has to delete before typing their own.
 */
export type WardleyLabelledKind = Exclude<
  WardleyArtefactKind,
  'porter' | 'area'
>;

/**
 * The words a kind is created NEXT TO — the prompt an artefact nobody has named
 * still carries, and the only string a morph is ever allowed to rewrite.
 */
export const WARDLEY_NODE_LABEL: Record<WardleyLabelledKind, string> = {
  component: LABEL_DEFAULT.component,
  anchor: LABEL_DEFAULT.anchor,
  ecosystem: ECOSYSTEM_LABEL,
  method: METHOD_LABEL,
  market: MARKET_LABEL,
  pipeline: PIPELINE_LABEL,
  accelerator: ACCELERATOR_LABEL,
  decelerator: DECELERATOR_LABEL,
};

/**
 * The fill a kind is born with. White for every circle that means "a thing on
 * the value chain"; the method's grey is the one that carries meaning — it
 * ENCODES the chosen method and stays editable from the toolbar.
 */
const NODE_FILL_OF: Record<WardleyArtefactKind, string> = {
  component: NODE_FILL,
  anchor: NODE_FILL,
  ecosystem: NODE_FILL,
  method: METHOD_FILL,
  market: NODE_FILL,
  // White at ~60% opacity: a pipeline is a bar you place components ON, so the
  // map has to stay visible through it. The 1px border stays opaque.
  pipeline: PIPELINE_FILL,
  // Opaque white, like every other circle: the RED is in the four arrows, and a
  // filled disk would fight the letter it is there to carry.
  porter: NODE_FILL,
  // Flat grey. The reference draws these arrows with a gradient; this canvas
  // has no gradient fill, so a solid mid-grey under a thick dark border is what
  // reads as the same solid arrow at the zoom an architect works at.
  accelerator: ACCELERATOR_FILL,
  decelerator: ACCELERATOR_FILL,
  // Peace light at ~25 % opacity, for the reason the pipeline's white wash
  // gives: a zone is drawn OVER the components it groups, so the map has to
  // stay readable through it. The 1px border stays opaque.
  area: AREA_FILL,
};

/**
 * The rim colour of the kinds that do not wear the house one.
 *
 * A table with a single entry, and it is the honest way to say what an area is:
 * every other artefact is a black-rimmed drawing of a thing in the value chain,
 * and a zone is a coloured wash that FRAMES those drawings. A border in the
 * same near-black would read as one more outline on a map already full of them.
 */
const NODE_STROKE_OF: Partial<Record<WardleyArtefactKind, string>> = {
  area: AREA_STROKE,
};

/** A box centred on a point — how every Wardley creation site places a node. */
export function wardleyCenteredBox(
  cx: number,
  cy: number,
  w: number,
  h: number
): string {
  return new Bound(cx - w / 2, cy - h / 2, w, h).serialize();
}

/** The canonical box of one kind, centred where the artefact already stands. */
export function wardleyCanonicalBox(
  kind: WardleyArtefactKind,
  cx: number,
  cy: number
): string {
  const { w, h } = WARDLEY_NODE_SIZE[kind];
  return wardleyCenteredBox(cx, cy, w, h);
}

/**
 * Every prop a Wardley node is created with, for one kind and one box.
 *
 * Most of the pack is a native ELLIPSE and differs only in fill and size: the
 * glyph — the anchor's silhouette, the ecosystem's hatched donut, the method's
 * inner circle — is drawn by the renderer from `kind`, off this same model, so
 * stroke and fill stay editable from the shape toolbar exactly like any other
 * shape's. Two families are the exception, and they are the reason `clearOf`
 * exists on this pack: the pipeline and the area are RECTS and the only kinds
 * that write `radius`, and the accelerator / decelerator are POLYGONS — the
 * only kinds that write `vertices` and `isClosed` from here.
 *
 * No `text`: a Wardley label is a separate free-text element grouped with the
 * node (see `addLabel` in `actions.ts`), never words stored on the shape. The
 * porter and the area are the two exceptions, and neither writes it HERE: their
 * inner text is content the author types, added at the creation site.
 */
export function wardleyNodeProps(
  kind: WardleyArtefactKind,
  box: { xywh: string }
): Record<string, unknown> & { type: string } {
  // An area is born a RECT, and {@link wardleyAreaProps} is what turns the
  // other half of the kind into a polygon: the two artefacts are one kind
  // because the `shapeType` is the whole of what differs between them, so the
  // common description lives here and the outline is spread over it.
  const rect = kind === 'pipeline' || kind === 'area';
  const outline = NODE_VERTICES_OF[kind];

  return {
    type: 'wardleyNode',
    kind,
    // Semantic identity (PF1): posted next to `kind`, which stays untouched and
    // keeps driving the rendering. The role is what every rule reads — no rule
    // will ever look at a shape type.
    role: WARDLEY_ROLE[kind],
    shapeType: outline ? 'polygon' : rect ? 'rect' : 'ellipse',
    filled: true,
    fillColor: NODE_FILL_OF[kind],
    strokeColor: NODE_STROKE_OF[kind] ?? NODE_STROKE,
    // A thick rim on the arrows, the house thin one everywhere else: an arrow
    // with a 1px border reads as an outline drawing rather than as the solid
    // arrow the reference draws.
    strokeWidth: outline ? ACCELERATOR_STROKE_WIDTH : NODE_STROKE_WIDTH,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    // Square corners, and ONLY on the kind that has corners at all. Spread
    // conditionally rather than written as 0 everywhere, because that is the
    // truth about the ellipses — and because a key some kinds write and others
    // do not is precisely what `wardleyMorphClears` is for.
    ...(rect ? { radius: 0 } : {}),
    // The outline, and the fact that it closes. A fresh array of fresh pairs:
    // this goes into a document, and two elements sharing one literal would be
    // two elements sharing one array.
    ...(outline
      ? { vertices: outline.map(([x, y]) => [x, y]), isClosed: true }
      : {}),
    xywh: box.xywh,
  };
}

/**
 * An AREA, as props — one kind, two shapes.
 *
 * The second discriminator this pack needed, and the reason it is a parameter
 * rather than a second `kind`: a rectangular zone and a polygonal one are the
 * same statement about the map ("all of this is one thing"), drawn with a
 * different number of corners. A second kind would have to be kept in step in
 * the role table, the legend, the export and the morph's key union, for a
 * difference the `shapeType` already carries.
 *
 * Everything but the outline comes from {@link wardleyNodeProps}, which is the
 * house rule: the fill, the rim and the role are the area's, wherever it is
 * built from. What is added here is the two shapes and the fact that an area's
 * NAME is its own inner text.
 *
 * ## The text is the name, and the zone never grows to fit it
 *
 * `TextFitMode.Overflow`, exactly as the porter's letter and the inertia bar:
 * an area is a boundary drawn around real components, so a long name must never
 * push that boundary out and swallow a component the author did not mean to
 * include. Top-left, because a zone's name belongs in its corner rather than
 * across the middle of the map it covers — and no `text` at all, so the editor
 * a double-click opens starts on an empty line.
 */
export function wardleyAreaProps(
  shape: WardleyAreaShape,
  box: { xywh: string }
): Record<string, unknown> & { type: string } {
  const props: Record<string, unknown> & { type: string } = {
    ...wardleyNodeProps('area', box),
    // A thin rim under its own name, so the zone frames the map rather than
    // adding one more black outline to it.
    strokeWidth: AREA_STROKE_WIDTH,
    // The name, as the shape's own text: left-aligned in the top corner, and a
    // fit mode that never resizes the zone.
    color: NODE_STROKE,
    fontFamily: FontFamily.Inter,
    fontSize: LABEL_FONT_SIZE,
    textAlign: 'left',
    textVerticalAlign: 'top',
    textFitMode: TextFitMode.Overflow,
  };
  if (shape !== 'polygon') return props;

  props.shapeType = 'polygon';
  // The editor's own default outline — a regular pentagon — copied FRESH,
  // because `vertices` goes into a document and two elements sharing one
  // literal would be two elements sharing one array. The author then moves the
  // corners from the shape toolbar's vertex editor.
  props.vertices = DEFAULT_POLYGON_VERTICES.map(([x, y]) => [x, y]);
  props.isClosed = true;
  // …and a polygon has no corner radius. Deleted rather than never written,
  // because the base description is the RECT's — same idiom, and same reason,
  // as `wardleyMorphProps`: a patch cannot express absence, so a key that means
  // nothing here must not be sitting in the Y.Map saying it does.
  delete props.radius;
  return props;
}

/** Where an area of the given shape is born, centred on a point. */
export function wardleyAreaBox(
  shape: WardleyAreaShape,
  cx: number,
  cy: number
): string {
  const { w, h } = WARDLEY_AREA_SIZE[shape];
  return wardleyCenteredBox(cx, cy, w, h);
}

/**
 * The pipeline's handle: a node-sized square straddling the body's top edge, and
 * the only place a connector may land on a pipeline.
 *
 * It inherits `centerAnchorOnly` from the model like every other Wardley node,
 * and it carries `wardley:handle` — a role of its own, so nothing that judges
 * components ever judges it.
 */
export function wardleyHandleProps(box: {
  xywh: string;
}): Record<string, unknown> & { type: string } {
  return {
    type: 'wardleyNode',
    kind: 'handle',
    role: WARDLEY_ROLE.handle,
    shapeType: 'rect',
    filled: true,
    fillColor: NODE_FILL,
    strokeColor: NODE_STROKE,
    strokeWidth: NODE_STROKE_WIDTH,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius: 0,
    xywh: box.xywh,
  };
}

/** Where a handle sits, given the body's centre: astride the top edge. */
export function wardleyHandleBox(cx: number, cy: number): string {
  const top = cy - WARDLEY_NODE_SIZE.pipeline.h / 2;
  return wardleyCenteredBox(cx, top, HANDLE_SIZE, HANDLE_SIZE);
}

/**
 * One of the market's three inner dots — thicker-bordered, and deliberately
 * ROLE-LESS.
 *
 * They are the GLYPH's own wiring rather than artefacts the user placed, the
 * same reason the triangle between them carries no role: they sit inside the
 * market circle by construction, so a role would make every market composite
 * report an overlap with itself (W3).
 */
export function wardleyMarketDotProps(box: {
  xywh: string;
}): Record<string, unknown> & { type: string } {
  return {
    type: 'wardleyNode',
    kind: 'component',
    role: undefined,
    shapeType: 'ellipse',
    filled: true,
    fillColor: NODE_FILL,
    strokeColor: NODE_STROKE,
    strokeWidth: MARKET_DOT_STROKE_WIDTH,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    xywh: box.xywh,
  };
}

/** The three dot boxes of a market centred on (cx, cy) — an upright triangle. */
export function wardleyMarketDotBoxes(cx: number, cy: number): string[] {
  const rho = MARKET_DOT_RING;
  const sin60 = Math.sqrt(3) / 2;
  return [
    [0, -rho],
    [rho * sin60, rho / 2],
    [-rho * sin60, rho / 2],
  ].map(([vx, vy]) =>
    wardleyCenteredBox(cx + vx, cy + vy, MARKET_DOT_SIZE, MARKET_DOT_SIZE)
  );
}

/**
 * One side of the market's triangle: an ATTACHED connector, so it auto-routes
 * centre to centre and follows the dots on move and resize.
 */
export function wardleyMarketLinkProps(
  sourceId: string,
  targetId: string
): Record<string, unknown> & { type: string } {
  return {
    type: 'connector',
    mode: ConnectorMode.Straight,
    source: { id: sourceId },
    target: { id: targetId },
    stroke: MARKET_LINK_COLOR,
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: MARKET_LINK_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.None,
  };
}

/** The pairs the triangle wires, given the three dots in creation order. */
export function wardleyMarketLinkPairs<T>(dots: readonly T[]): [T, T][] {
  return [
    [dots[0], dots[1]],
    [dots[1], dots[2]],
    [dots[2], dots[0]],
  ];
}

/* ── Porter's forces ──────────────────────────────────────────────────── */

/** One of the four arrows: its own axis-aligned box, and the outline in it. */
export interface WardleyPorterArrow {
  /** Serialized `xywh` of the box the polygon is drawn inside. */
  xywh: string;
  /** The outline as normalized [0-1] coordinates of that box, tip first. */
  vertices: number[][];
}

/**
 * The four arrow outlines, north first and then clockwise.
 *
 * Normalized, so they are the same seven points at every size — the BOX carries
 * the scale — and one list per direction rather than one list plus a `rotate`,
 * because a rotated element is one the selection, the resize handles and every
 * bounding-box reader then have to de-rotate. Each is: tip, the two head
 * corners, and the four corners of the shaft, with the head
 * `headLength / length` of the way down and the shaft `width / headWidth` wide.
 */
const PORTER_HEAD = PORTER_ARROW.headLength / PORTER_ARROW.length; // 0.4
const PORTER_SHAFT_LOW = (1 - PORTER_ARROW.width / PORTER_ARROW.headWidth) / 2;
const PORTER_SHAFT_HIGH = 1 - PORTER_SHAFT_LOW;

const PORTER_VERTICES: readonly number[][][] = [
  // North — the tip at the top edge, the shaft running back down to the rim.
  [
    [0.5, 0],
    [1, PORTER_HEAD],
    [PORTER_SHAFT_HIGH, PORTER_HEAD],
    [PORTER_SHAFT_HIGH, 1],
    [PORTER_SHAFT_LOW, 1],
    [PORTER_SHAFT_LOW, PORTER_HEAD],
    [0, PORTER_HEAD],
  ],
  // East — the same outline turned a quarter, written out rather than rotated.
  [
    [1, 0.5],
    [1 - PORTER_HEAD, 1],
    [1 - PORTER_HEAD, PORTER_SHAFT_HIGH],
    [0, PORTER_SHAFT_HIGH],
    [0, PORTER_SHAFT_LOW],
    [1 - PORTER_HEAD, PORTER_SHAFT_LOW],
    [1 - PORTER_HEAD, 0],
  ],
  // South.
  [
    [0.5, 1],
    [0, 1 - PORTER_HEAD],
    [PORTER_SHAFT_LOW, 1 - PORTER_HEAD],
    [PORTER_SHAFT_LOW, 0],
    [PORTER_SHAFT_HIGH, 0],
    [PORTER_SHAFT_HIGH, 1 - PORTER_HEAD],
    [1, 1 - PORTER_HEAD],
  ],
  // West.
  [
    [0, 0.5],
    [PORTER_HEAD, 0],
    [PORTER_HEAD, PORTER_SHAFT_LOW],
    [1, PORTER_SHAFT_LOW],
    [1, PORTER_SHAFT_HIGH],
    [PORTER_HEAD, PORTER_SHAFT_HIGH],
    [PORTER_HEAD, 1],
  ],
];

/** Whether a direction runs along X — the axis its box is long on. */
const PORTER_HORIZONTAL = [false, true, false, true];
/** Unit vector per direction, north first and then clockwise. */
const PORTER_DIRECTIONS: readonly [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * The four arrows of a Porter's-forces glyph, for a circle of the given radius
 * centred on (cx, cy) — a box and an outline each.
 *
 * The ONE description of the geometry, so the creation site, the map legend and
 * the tests read the same numbers rather than three sets that agreed the day
 * they were written. Each arrow starts `PORTER_ARROW.gap` clear of the rim —
 * the arrows push against the circle, they do not touch it — and runs
 * `PORTER_ARROW.length` further out, tip at the far end.
 *
 * Every distance scales WITH the radius, and that is what makes a legend row the
 * same drawing at another size: a 12-unit glyph carrying four map-sized arrows
 * would not be a small Porter, it would be a circle somebody stabbed.
 */
export function wardleyPorterArrows(
  cx: number,
  cy: number,
  radius: number = PORTER_SIZE / 2
): WardleyPorterArrow[] {
  const scale = radius / (PORTER_SIZE / 2);
  const near = radius + PORTER_ARROW.gap * scale;
  const long = PORTER_ARROW.length * scale;
  const across = PORTER_ARROW.headWidth * scale;

  return PORTER_DIRECTIONS.map(([dx, dy], index) => {
    const horizontal = PORTER_HORIZONTAL[index];
    const w = horizontal ? long : across;
    const h = horizontal ? across : long;
    // The near edge of the box sits `near` from the centre along the direction;
    // the box then extends outward, and is centred on the other axis.
    const x = horizontal ? (dx > 0 ? cx + near : cx - near - long) : cx - w / 2;
    const y = horizontal ? cy - h / 2 : dy > 0 ? cy + near : cy - near - long;
    return {
      xywh: new Bound(x, y, w, h).serialize(),
      vertices: PORTER_VERTICES[index].map(([vx, vy]) => [vx, vy]),
    };
  });
}

/**
 * One of those arrows as props: a filled POLYGON on a `wardleyNode`, and
 * deliberately ROLE-LESS.
 *
 * A polygon and not a connector, which is the first fix the recette of #210
 * asked for: a connector's triangle head is sized off its stroke width, so the
 * heads arrived longer than the arrows and covered the circle, the letter and
 * the double-click target. A polygon's outline is exactly the seven points
 * above.
 *
 * A `wardleyNode` and not a plain `shape`, which is the second: recette v2
 * found that `ShapeElementView` gives EVERY plain shape a double-click that
 * mounts the inner-text editor, and mounting it grew an arrow from 24 units
 * high to 44 — a deformation that survived Escape. An arrow is not a thing you
 * write in. Posting it as a `wardleyNode` moves it onto `WardleyNodeView`,
 * which opens an editor only on the artefact that HAS a letter; the renderer is
 * unaffected, because a Wardley node draws itself through the native shape
 * renderer and that renderer already dispatches on `shapeType`.
 *
 * Role-less, and `kind: 'porter'` with it, for the reason the market's three
 * inner dots already give — they are `kind: 'component'` and carry no role: this
 * is the glyph's own wiring rather than anything the author drew, so a role
 * would make every composite report an overlap with itself (W3), would offer
 * four arrows to the OWM writer, and would let a stray label bind to one.
 * `undefined` writes no key at all, exactly as it does for those dots.
 *
 * Filled rather than stroked, so nothing about them is sized off a line width
 * ever again.
 */
export function wardleyPorterArrowProps(
  arrow: WardleyPorterArrow
): Record<string, unknown> & { type: string } {
  return {
    type: 'wardleyNode',
    kind: 'porter',
    role: undefined,
    shapeType: 'polygon',
    vertices: arrow.vertices,
    isClosed: true,
    filled: true,
    fillColor: WARDLEY_RED,
    // The same red, so the arrow has no rim of another colour around it.
    strokeColor: WARDLEY_RED,
    strokeWidth: 0,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    xywh: arrow.xywh,
  };
}

/**
 * The letter inside the circle, as shape-text props.
 *
 * A plain STRING and not a `Y.Text`: `ShapeElementModel.propsToY` builds the
 * Y type on the way into the document, and this package depends on yjs only in
 * its tests. `TextFitMode.Overflow` is the load-bearing line — the glyph has a
 * canonical size that says "external force" at a glance, so the circle must
 * never grow to fit whatever the author types into it, exactly as the inertia
 * bar never deforms around its own text.
 */
export function wardleyPorterLetterProps(
  letter: string,
  fontSize: number = PORTER_LETTER_FONT_SIZE
): Record<string, unknown> {
  return {
    text: letter,
    color: NODE_STROKE,
    fontFamily: FontFamily.Inter,
    fontSize,
    textAlign: 'center',
    textHorizontalAlign: 'center',
    textVerticalAlign: 'center',
    textFitMode: TextFitMode.Overflow,
  };
}

/**
 * The box {@link wardleyMorphProps} hands {@link wardleyNodeProps} and then
 * throws away. Never written to a document: the morph places the element
 * itself, from {@link wardleyCanonicalBox}, in `afterMorph`.
 */
const DISCARDED_BOX = '[0,0,0,0]';

/** What a morph must never rewrite: identity, geometry, and the user's words. */
const NOT_A_MORPH = ['type', 'xywh', 'text'] as const;

/**
 * What a kind is worth to a node that ALREADY EXISTS — {@link wardleyNodeProps}
 * minus the three things a morph has no business touching.
 *
 * The whole preset and not `{kind, role}`, and on this pack it is visibly not a
 * formality: a pipeline is a rect with square corners and a semi-transparent
 * fill, and the other three members of the family are opaque white ellipses. A
 * two-key patch would turn a component into a "pipeline" still drawn as a
 * circle.
 */
export function wardleyMorphProps(
  kind: WardleyArtefactKind
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    ...wardleyNodeProps(kind, { xywh: DISCARDED_BOX }),
  };
  for (const key of NOT_A_MORPH) delete props[key];
  return props;
}

/**
 * The kinds that can actually MORPH — the one family `morph.ts` declares.
 *
 * Restated here rather than imported, and that is a circular-import dodge with
 * a real reason behind it: `morph.ts` reads this module for the presets, so
 * this module cannot read it back. `morph.unit.spec.ts` asserts the two lists
 * are the same set, so the restatement cannot drift.
 *
 * It exists because {@link wardleyMorphClears} needs a UNION, and a union over
 * the whole pack is the wrong one. Since the accelerator and the decelerator
 * joined it, "every key any kind writes" includes `vertices` and `isClosed` —
 * keys of two POLYGONS that are in no family and that nothing may ever morph
 * into. Left unrestricted, morphing a market back to a component would emit a
 * delete for `vertices` on an ellipse that never had one: harmless today, and a
 * patch that says something untrue about the pack the day a morphable kind
 * gains an outline.
 */
export const WARDLEY_MORPHABLE_KINDS: readonly WardleyArtefactKind[] = [
  'component',
  'market',
  'ecosystem',
  'pipeline',
];

/**
 * Every key a MORPHABLE kind's props may carry — the union over that family.
 *
 * Computed rather than listed, so a preset that starts spreading a key
 * conditionally is covered on the day it is added rather than on the day
 * somebody notices.
 */
const EVERY_MORPH_KEY = new Set(
  WARDLEY_MORPHABLE_KINDS.flatMap(kind => Object.keys(wardleyMorphProps(kind)))
);

/**
 * The fields to DELETE after morphing to `kind` — the keys some other kind
 * writes and this one does not.
 *
 * `radius` for every kind but the pipeline, and that is not a formality either:
 * a patch cannot express absence, so a pipeline morphed back to a component
 * would keep `radius: 0` sitting in the Y.Map, silently in force on an ellipse.
 * Derived rather than listed, so the day a preset gains a conditional key it is
 * covered without anybody remembering to come here.
 */
export function wardleyMorphClears(
  kind: WardleyArtefactKind
): readonly string[] {
  const present = new Set(Object.keys(wardleyMorphProps(kind)));
  return [...EVERY_MORPH_KEY].filter(key => !present.has(key));
}
