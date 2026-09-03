import {
  ConnectorMode,
  FontFamily,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  TextFitMode,
  type WardleyNodeKind,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';

import {
  ECOSYSTEM_LABEL,
  ECOSYSTEM_SIZE,
  HANDLE_SIZE,
  LABEL_DEFAULT,
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
};

/**
 * Every kind that is created NEXT TO a name — {@link WardleyArtefactKind} minus
 * the `porter`.
 *
 * The porter is the one artefact with no label at all, and narrowing the key
 * type is how that is said rather than an empty string parked in the table
 * below. An empty string would be a name the author has not typed yet, which is
 * exactly what the placeholders ARE and exactly what the morph is allowed to
 * rewrite; a force's letter is the notation and belongs to nobody's vocabulary.
 */
export type WardleyLabelledKind = Exclude<WardleyArtefactKind, 'porter'>;

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
 * Five of the six are a native ELLIPSE and differ only in fill and size: the
 * glyph — the anchor's silhouette, the ecosystem's hatched donut, the method's
 * inner circle — is drawn by the renderer from `kind`, off this same model, so
 * stroke and fill stay editable from the shape toolbar exactly like any other
 * shape's. The pipeline is the exception and the reason `clearOf` exists on this
 * pack: it is a RECT, and it is the only kind that writes `radius`.
 *
 * No `text`: a Wardley label is a separate free-text element grouped with the
 * node (see `addLabel` in `actions.ts`), never words stored on the shape.
 */
export function wardleyNodeProps(
  kind: WardleyArtefactKind,
  box: { xywh: string }
): Record<string, unknown> & { type: string } {
  const rect = kind === 'pipeline';

  return {
    type: 'wardleyNode',
    kind,
    // Semantic identity (PF1): posted next to `kind`, which stays untouched and
    // keeps driving the rendering. The role is what every rule reads — no rule
    // will ever look at a shape type.
    role: WARDLEY_ROLE[kind],
    shapeType: rect ? 'rect' : 'ellipse',
    filled: true,
    fillColor: NODE_FILL_OF[kind],
    strokeColor: NODE_STROKE,
    strokeWidth: NODE_STROKE_WIDTH,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    // Square corners, and ONLY on the kind that has corners at all. Spread
    // conditionally rather than written as 0 everywhere, because that is the
    // truth about the ellipses — and because a key some kinds write and others
    // do not is precisely what `wardleyMorphClears` is for.
    ...(rect ? { radius: 0 } : {}),
    xywh: box.xywh,
  };
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

/** One of the four arrows: where it starts and where its head lands. */
export interface WardleyPorterArrow {
  source: [number, number];
  target: [number, number];
}

/**
 * The four cardinal directions, north first and then clockwise — the order the
 * arrows are created in, and the order a test may read them back.
 */
const PORTER_DIRECTIONS: readonly [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * Where the four arrows of a Porter's-forces glyph run, for a circle of the
 * given radius centred on (cx, cy).
 *
 * The ONE description of the geometry, so the creation site, the map legend and
 * the tests read the same numbers rather than three sets that agreed the day
 * they were written. Each arrow starts `PORTER_ARROW.gap` clear of the rim —
 * the arrows push against the circle, they do not touch it — and runs
 * `PORTER_ARROW.length` further out, head at the far end.
 *
 * Both distances scale WITH the radius, and that is what makes a legend row the
 * same drawing at another size: a 16-unit glyph carrying two 20-unit arrows
 * would not be a small Porter, it would be a circle somebody stabbed.
 */
export function wardleyPorterArrowSegments(
  cx: number,
  cy: number,
  radius: number = PORTER_SIZE / 2
): WardleyPorterArrow[] {
  const scale = radius / (PORTER_SIZE / 2);
  const from = radius + PORTER_ARROW.gap * scale;
  const to = from + PORTER_ARROW.length * scale;
  return PORTER_DIRECTIONS.map(([dx, dy]) => ({
    source: [cx + dx * from, cy + dy * from],
    target: [cx + dx * to, cy + dy * to],
  }));
}

/**
 * One of those arrows as props: a FREE connector, deliberately ROLE-LESS.
 *
 * Free rather than attached, and role-less, for the reason the market's
 * triangle already gives: these are the glyph's own wiring rather than
 * relations the author drew. Attaching them to the circle would let it drag
 * them out of square, and a role would make every composite report an overlap
 * with itself (W3) — and, worse here, would put four `wardley:change-arrow`
 * lookalikes on a map where an arrow means "this is evolving". Solid, never
 * dashed, for the same reason.
 */
export function wardleyPorterArrowProps(
  arrow: WardleyPorterArrow,
  strokeWidth: number = PORTER_ARROW.width
): Record<string, unknown> & { type: string } {
  return {
    type: 'connector',
    mode: ConnectorMode.Straight,
    source: { position: arrow.source },
    target: { position: arrow.target },
    stroke: WARDLEY_RED,
    strokeStyle: StrokeStyle.Solid,
    strokeWidth,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Triangle,
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
 * Every key ANY kind's props may carry — the union over the whole pack.
 *
 * Computed rather than listed, so a preset that starts spreading a key
 * conditionally is covered on the day it is added rather than on the day
 * somebody notices.
 */
const EVERY_MORPH_KEY = new Set(
  (Object.keys(WARDLEY_NODE_SIZE) as WardleyArtefactKind[]).flatMap(kind =>
    Object.keys(wardleyMorphProps(kind))
  )
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
