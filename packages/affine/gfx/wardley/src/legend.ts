import { createGroupCommand } from '@labre/affine-gfx-group';
import {
  ConnectorElementModel,
  ConnectorMode,
  FontFamily,
  PointStyle,
  ShapeElementModel,
  ShapeStyle,
  StrokeStyle,
  type WardleyBackgroundElementModel,
  WardleyNodeElementModel,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';

import { GRADIENT_GREEN, GRADIENT_RED } from './gradient';
import {
  ACCELERATOR_FILL,
  ACCELERATOR_STROKE_WIDTH,
  ACCELERATOR_VERTICES,
  DECELERATOR_VERTICES,
  INERTIA_COLOR,
  LINK_GREY,
  LINK_STROKE_WIDTH,
  MARKET_DOT_STROKE_WIDTH,
  MARKET_LINK_COLOR,
  MARKET_LINK_WIDTH,
  METHOD_FILL,
  NODE_FILL,
  NODE_STROKE,
  NODE_STROKE_WIDTH,
  PIPELINE_FILL,
  PORTER_DEFAULT_LETTER,
  WARDLEY_RED,
} from './node/consts';
import { wardleyPorterArrowProps, wardleyPorterArrows } from './presets';

/** Component kinds the legend can describe, in display order. */
type LegendType =
  | 'component'
  | 'anchor'
  | 'market'
  | 'ecosystem'
  | 'method'
  | 'pipeline'
  | 'link'
  | 'arrow'
  | 'inertia'
  | 'porter'
  | 'accelerator'
  | 'decelerator';

const LEGEND_ORDER: LegendType[] = [
  'component',
  'anchor',
  'market',
  'ecosystem',
  'method',
  'pipeline',
  'link',
  'arrow',
  'inertia',
  'porter',
  'accelerator',
  'decelerator',
];

/** Default (editable) descriptions for each legend row. */
const LEGEND_DESC: Record<LegendType, string> = {
  component: 'Need / capability (activity, practice, data…)',
  anchor: 'Stakeholder (customer, user…)',
  market: 'Market (set of actors)',
  ecosystem: 'Ecosystem',
  method: 'Component + method (color = phase)',
  pipeline: 'Pipeline (possible choices for a capability)',
  link: 'Need relation (parent → child)',
  arrow: 'Evolution / movement (red = future)',
  inertia: 'Inertia to change',
  porter:
    "Porter's forces (external competition: R relative, L survival, E establish)",
  accelerator: 'Accelerator (speeds evolution up)',
  decelerator: 'Decelerator (slows evolution down)',
};

type GradientVariant = Exclude<
  WardleyBackgroundElementModel['variant'],
  'classic'
>;

/** Gradient-meaning block, keyed by variant (caption + 2-colour swatch). */
const LEGEND_GRADIENT: Record<
  GradientVariant,
  { caption: string; swatch: [string, string] }
> = {
  opportunity: {
    caption:
      'Opportunity gradient: differential value (green) vs operational value (red).',
    swatch: [GRADIENT_GREEN, GRADIENT_RED],
  },
  benefit: {
    caption: 'Gradient: investment (red) then benefit (green).',
    swatch: [GRADIENT_RED, GRADIENT_GREEN],
  },
  'evolution-gradient': {
    caption:
      "Gradient representing the growth of Wardley's evolution function.",
    swatch: ['#9aa0a6', '#cfd2d6'],
  },
};

/* ── Porter's five forces: the panel under the rows ───────────────────── */

/** The panel's own numbers. Model units, like every other measure here. */
const PORTER_PANEL = {
  pad: 12,
  titleFs: 16,
  titleH: 22,
  /** Between the title and the diagram, and between the diagram and caption. */
  gapAfterTitle: 8,
  gapBeforeCaption: 10,
  /** The glyph's radius — half the map's, so the panel reads as a diagram. */
  radius: 15,
  /** Clearance between the arrow tips and the boxes they point at. */
  clearance: 4,
  /** The three letters, drawn on the glyph's centre as a free text. */
  letterFs: 9,
  boxFs: 12,
  sideW: 150,
  sideH: 34,
  endW: 170,
  endH: 24,
  captionFs: 13,
  captionH: 21,
  backing: '#e5e7eb',
  backingStroke: '#9aa0a6',
} as const;

/** The four forces the boxes name, north first and then clockwise. */
const PORTER_FORCES = [
  'Threat of new entrants',
  'Bargaining power of customers',
  'Threat of substitutes',
  'Bargaining power of suppliers',
] as const;

/** What the panel's own glyph reads: the notation, not one force. */
const PORTER_PANEL_LETTERS = 'R/L/E';

/** What the letters mean, spelled out under the diagram. */
const PORTER_CAPTION =
  'R/L/E = Relative competition, or struggLe for survival, or struggle to Establish';

/** A box in the panel, relative to the panel's top-left, plus its words. */
interface PorterPanelBox {
  xywh: [number, number, number, number];
  label: string;
}

interface PorterPanelLayout {
  w: number;
  h: number;
  title: [number, number, number, number];
  /** The glyph's centre. */
  center: [number, number];
  radius: number;
  boxes: PorterPanelBox[];
  caption: [number, number, number, number];
}

/**
 * How far a porter glyph of the given radius reaches, arrow tips included.
 *
 * DERIVED from the shared geometry rather than written down: the boxes must
 * stand clear of the arrows, and the day somebody lengthens `PORTER_ARROW` a
 * hard-coded 38 here would silently let a tip enter a box.
 */
function porterReach(radius: number): number {
  return Math.max(
    ...wardleyPorterArrows(0, 0, radius).flatMap(arrow => {
      const [x, y, w, h] = Bound.deserialize(arrow.xywh).toXYWH();
      return [Math.abs(x), Math.abs(y), Math.abs(x + w), Math.abs(y + h)];
    })
  );
}

/**
 * The panel's geometry for a given width — the PO's reference drawing, as
 * numbers.
 *
 * A pure function so the layout can be asserted without a surface, and so the
 * one thing that must hold — that none of the four boxes overlaps the glyph
 * they surround — is checkable rather than eyeballed.
 */
export function porterPanelLayout(w: number): PorterPanelLayout {
  const p = PORTER_PANEL;
  const inner = w - p.pad * 2;
  // Where a box's near edge sits: past the arrow tips, never on them.
  const clear = porterReach(p.radius) + p.clearance;

  const diagramH = (clear + p.endH) * 2;
  const cx = w / 2;
  const cy = p.pad + p.titleH + p.gapAfterTitle + diagramH / 2;
  const captionY = cy + diagramH / 2 + p.gapBeforeCaption;

  return {
    w,
    h: captionY + p.captionH + p.pad,
    title: [p.pad, p.pad, inner, p.titleH],
    center: [cx, cy],
    radius: p.radius,
    boxes: [
      {
        xywh: [cx - p.endW / 2, cy - clear - p.endH, p.endW, p.endH],
        label: PORTER_FORCES[0],
      },
      {
        xywh: [cx + clear, cy - p.sideH / 2, p.sideW, p.sideH],
        label: PORTER_FORCES[1],
      },
      {
        xywh: [cx - p.endW / 2, cy + clear, p.endW, p.endH],
        label: PORTER_FORCES[2],
      },
      {
        xywh: [cx - clear - p.sideW, cy - p.sideH / 2, p.sideW, p.sideH],
        label: PORTER_FORCES[3],
      },
    ],
    caption: [p.pad, captionY, inner, p.captionH],
  };
}

/**
 * Build a "Legend" group from real, editable elements (white rect frame +
 * "Legend" text + one row of [real component glyph + description text] per
 * Wardley component TYPE present inside the background's perimeter + a
 * gradient-meaning block when the background is a gradient variant + the
 * five-forces panel when a Porter's-forces glyph is on the map). A snapshot
 * is created on each call; everything is grouped so it can be moved / resized /
 * edited and is dropped bottom-left of the background.
 */
export function createWardleyLegend(
  std: BlockStdScope,
  bg: WardleyBackgroundElementModel
) {
  const gfx = std.get(GfxControllerIdentifier);
  const surface = gfx.surface;
  if (!surface) return;

  const [bx, by, , bh] = bg.deserializedXYWH;

  // 1. Detect which component types are present inside the perimeter.
  const present = new Set<LegendType>();
  for (const el of gfx.getElementsByBound(Bound.deserialize(bg.xywh), {
    type: 'canvas',
  })) {
    // Note: WardleyNodeElementModel extends ShapeElementModel, so the order of
    // these instanceof checks matters.
    if (el instanceof WardleyNodeElementModel) {
      if (el.kind !== 'handle') present.add(el.kind);
    } else if (el instanceof ConnectorElementModel) {
      if (el.strokeStyle === StrokeStyle.Dash || el.stroke === WARDLEY_RED) {
        present.add('arrow');
      } else if (el.stroke === LINK_GREY) {
        present.add('link');
      }
      // market triangle connectors (NODE_STROKE) are ignored.
    } else if (el instanceof ShapeElementModel) {
      // The inertia bar is the only plain shape this legend describes, and it
      // is recognised by its FILL. A Porter's-forces arrow is a plain shape too
      // — a filled red polygon, the glyph's own wiring — and it is `WARDLEY_RED`
      // rather than `INERTIA_COLOR`, so it falls through here and is described
      // by the porter circle it belongs to. Asserted in `porter.unit.spec.ts`:
      // an arrow that started answering this test would put an "Inertia to
      // change" row in the legend of a map with no inertia bar on it.
      if (el.fillColor === INERTIA_COLOR) present.add('inertia');
    }
  }
  const rows = LEGEND_ORDER.filter(t => present.has(t));

  // 2. Layout (model units). The text column is wide enough for one-line
  // descriptions; the gradient row is taller as its caption may wrap.
  const PAD = 16;
  const TITLE_H = 28;
  const ROW_H = 30;
  const GLYPH_W = 46;
  const GAP = 12;
  const TEXT_FS = 15;
  const TITLE_FS = 18;
  const TEXT_W = 360;
  const GRAD_ROW_H = 40;
  const W = PAD * 2 + GLYPH_W + GAP + TEXT_W;

  const variant = bg.variant;
  const grad = variant !== 'classic' ? LEGEND_GRADIENT[variant] : null;
  const gradH = grad ? 12 + GRAD_ROW_H : 0;
  // The five-forces panel, and ONLY when a force is actually on the map: a
  // legend of a map with no porter on it has to come out byte-identical to the
  // one it came out as before this panel existed. Pinned in
  // `porter.unit.spec.ts`.
  const panel = present.has('porter') ? porterPanelLayout(W - PAD * 2) : null;
  const panelH = panel ? 12 + panel.h : 0;
  const H = PAD * 2 + TITLE_H + rows.length * ROW_H + gradH + panelH;

  const x0 = bx + 50;
  const y0 = by + bh - 56 - H;

  const text = (
    t: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fontSize: number,
    align: 'left' | 'center' = 'left'
  ) =>
    surface.addElement({
      type: 'text',
      text: t,
      fontFamily: FontFamily.Inter,
      fontSize,
      color: NODE_STROKE,
      textAlign: align,
      xywh: new Bound(x, y, w, h).serialize(),
    });

  // ── glyph builders (real, editable elements), centred on (cx, cy) ─────
  //
  // DELIBERATELY ROLE-LESS. These are real `wardleyNode` elements, but a
  // legend documents the map — it is not part of it. Giving its glyphs
  // `wardley:component` & co. would make every legend entry count as an
  // artefact and skew any rule written against roles (a legend would add a
  // phantom component, anchor, market…). Neutral is the semantics we want;
  // `kind` still drives their rendering. Frozen by a test in
  // `__tests__/roles.unit.spec.ts`.
  const ellipse = (
    kind: 'component' | 'anchor' | 'ecosystem' | 'method',
    d: number,
    fill: string,
    sw: number,
    cx: number,
    cy: number
  ) =>
    surface.addElement({
      type: 'wardleyNode',
      kind,
      shapeType: 'ellipse',
      filled: true,
      fillColor: fill,
      strokeColor: NODE_STROKE,
      strokeWidth: sw,
      shapeStyle: ShapeStyle.General,
      roughness: 0,
      xywh: new Bound(cx - d / 2, cy - d / 2, d, d).serialize(),
    });

  const glyph = (type: LegendType, cx: number, cy: number): string[] => {
    switch (type) {
      case 'component':
        return [ellipse('component', 16, NODE_FILL, NODE_STROKE_WIDTH, cx, cy)];
      case 'anchor':
        return [ellipse('anchor', 16, NODE_FILL, NODE_STROKE_WIDTH, cx, cy)];
      case 'ecosystem':
        return [ellipse('ecosystem', 20, NODE_FILL, NODE_STROKE_WIDTH, cx, cy)];
      case 'method':
        return [ellipse('method', 18, METHOD_FILL, NODE_STROKE_WIDTH, cx, cy)];
      case 'inertia':
        return [
          surface.addElement({
            type: 'shape',
            shapeType: 'rect',
            filled: true,
            fillColor: INERTIA_COLOR,
            strokeColor: INERTIA_COLOR,
            strokeWidth: 0,
            shapeStyle: ShapeStyle.General,
            roughness: 0,
            radius: 0,
            xywh: new Bound(cx - 2.5, cy - 11, 5, 22).serialize(),
          }),
        ];
      case 'pipeline': {
        const bw2 = 34;
        const bh2 = 12;
        const hd = 10;
        const top = cy - bh2 / 2;
        return [
          surface.addElement({
            type: 'wardleyNode',
            kind: 'pipeline',
            shapeType: 'rect',
            filled: true,
            fillColor: PIPELINE_FILL,
            strokeColor: NODE_STROKE,
            strokeWidth: NODE_STROKE_WIDTH,
            shapeStyle: ShapeStyle.General,
            roughness: 0,
            radius: 0,
            xywh: new Bound(cx - bw2 / 2, top, bw2, bh2).serialize(),
          }),
          surface.addElement({
            type: 'wardleyNode',
            kind: 'handle',
            shapeType: 'rect',
            filled: true,
            fillColor: NODE_FILL,
            strokeColor: NODE_STROKE,
            strokeWidth: NODE_STROKE_WIDTH,
            shapeStyle: ShapeStyle.General,
            roughness: 0,
            radius: 0,
            xywh: new Bound(cx - hd / 2, top - hd / 2, hd, hd).serialize(),
          }),
        ];
      }
      case 'market': {
        const R = 11;
        const dr = 3;
        const rho = 6;
        const sin60 = Math.sqrt(3) / 2;
        const circle = surface.addElement({
          type: 'wardleyNode',
          kind: 'market',
          shapeType: 'ellipse',
          filled: true,
          fillColor: NODE_FILL,
          strokeColor: NODE_STROKE,
          strokeWidth: NODE_STROKE_WIDTH,
          shapeStyle: ShapeStyle.General,
          roughness: 0,
          xywh: new Bound(cx - R, cy - R, R * 2, R * 2).serialize(),
        });
        const verts = [
          [0, -rho],
          [rho * sin60, rho / 2],
          [-rho * sin60, rho / 2],
        ];
        const dots = verts.map(([vx, vy]) =>
          surface.addElement({
            type: 'wardleyNode',
            kind: 'component',
            shapeType: 'ellipse',
            filled: true,
            fillColor: NODE_FILL,
            strokeColor: NODE_STROKE,
            strokeWidth: MARKET_DOT_STROKE_WIDTH,
            shapeStyle: ShapeStyle.General,
            roughness: 0,
            xywh: new Bound(
              cx + vx - dr,
              cy + vy - dr,
              dr * 2,
              dr * 2
            ).serialize(),
          })
        );
        const conns = [
          [dots[0], dots[1]],
          [dots[1], dots[2]],
          [dots[2], dots[0]],
        ].map(([a, b]) =>
          surface.addElement({
            type: 'connector',
            mode: ConnectorMode.Straight,
            source: { id: a },
            target: { id: b },
            stroke: MARKET_LINK_COLOR,
            strokeStyle: StrokeStyle.Solid,
            strokeWidth: MARKET_LINK_WIDTH,
            frontEndpointStyle: PointStyle.None,
            rearEndpointStyle: PointStyle.None,
          })
        );
        return [circle, ...dots, ...conns];
      }
      case 'porter': {
        // The same drawing as the map's, at the row's scale: the helper scales
        // the gap, the shaft and the head with the radius, so what a reader
        // sees here is a small Porter and not a circle with four map-sized
        // spikes through it.
        //
        // 6 and not the 8 the other circles get, because this glyph is the only
        // one wider than its own circle: arrows included it spans
        // `2 * (R + (gap + length) * R / 30)`, which at 8 would overrun a row
        // 30 units tall. At 6 it comes to just over `ROW_H` and sits inside its
        // line — and it is a RATIO, so the PO's doubling of the map glyph left
        // this row exactly where it was.
        const R = 6;
        const FS = 8;
        const circle = surface.addElement({
          type: 'wardleyNode',
          kind: 'porter',
          shapeType: 'ellipse',
          filled: true,
          fillColor: NODE_FILL,
          strokeColor: NODE_STROKE,
          strokeWidth: NODE_STROKE_WIDTH,
          shapeStyle: ShapeStyle.General,
          roughness: 0,
          xywh: new Bound(cx - R, cy - R, R * 2, R * 2).serialize(),
        });
        const arrows = wardleyPorterArrows(cx, cy, R).map(arrow =>
          surface.addElement(wardleyPorterArrowProps(arrow))
        );
        // The letter is the notation, so a legend that dropped it would be
        // describing a circle rather than the glyph it stands for — but here it
        // is a SEPARATE text element rather than the circle's inner text, which
        // is what the map glyph uses. A shape lays its text out inside padding
        // (`SHAPE_TEXT_VERTICAL_PADDING`) larger than this 12-unit box, so at
        // font size 8 the character was pushed out under the circle (recette
        // v2). A free text has no padding to overflow, and its box is placed on
        // the circle's own centre. Role-less like every other legend glyph.
        const letter = text(
          PORTER_DEFAULT_LETTER,
          cx - R,
          cy - FS / 2 - 1,
          R * 2,
          FS + 2,
          FS,
          'center'
        );
        return [circle, ...arrows, letter];
      }
      case 'accelerator':
      case 'decelerator': {
        // The map's own outline, at the row's scale: `vertices` are normalized
        // to the box, so the SAME seven points draw a 30 × 18 legend arrow and
        // a 48 × 40 canvas one. Role-less like every glyph in this box — a
        // legend documents the map, it is not part of it.
        const gw = 30;
        const gh = 18;
        return [
          surface.addElement({
            type: 'wardleyNode',
            kind: type,
            shapeType: 'polygon',
            vertices: (type === 'accelerator'
              ? ACCELERATOR_VERTICES
              : DECELERATOR_VERTICES
            ).map(([vx, vy]) => [vx, vy]),
            isClosed: true,
            filled: true,
            fillColor: ACCELERATOR_FILL,
            strokeColor: NODE_STROKE,
            strokeWidth: ACCELERATOR_STROKE_WIDTH,
            shapeStyle: ShapeStyle.General,
            roughness: 0,
            xywh: new Bound(cx - gw / 2, cy - gh / 2, gw, gh).serialize(),
          }),
        ];
      }
      case 'link':
        return [
          surface.addElement({
            type: 'connector',
            mode: ConnectorMode.Straight,
            source: { position: [cx - 18, cy + 6] },
            target: { position: [cx + 18, cy - 6] },
            stroke: LINK_GREY,
            strokeStyle: StrokeStyle.Solid,
            strokeWidth: LINK_STROKE_WIDTH,
            frontEndpointStyle: PointStyle.None,
            rearEndpointStyle: PointStyle.None,
          }),
        ];
      case 'arrow':
        return [
          surface.addElement({
            type: 'connector',
            mode: ConnectorMode.Straight,
            source: { position: [cx - 18, cy] },
            target: { position: [cx + 16, cy] },
            stroke: WARDLEY_RED,
            strokeStyle: StrokeStyle.Dash,
            strokeWidth: LINK_STROKE_WIDTH,
            frontEndpointStyle: PointStyle.None,
            rearEndpointStyle: PointStyle.Triangle,
          }),
        ];
    }
  };

  // 3. Create the elements.
  std.store.captureSync();
  const ids: string[] = [];

  // White frame.
  ids.push(
    surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      filled: true,
      fillColor: '#ffffff',
      strokeColor: '#cfd2d6',
      strokeWidth: 1,
      shapeStyle: ShapeStyle.General,
      roughness: 0,
      radius: 6,
      xywh: new Bound(x0, y0, W, H).serialize(),
    })
  );

  // Title.
  ids.push(
    text('Legend', x0 + PAD, y0 + PAD, W - PAD * 2, TITLE_FS + 6, TITLE_FS)
  );

  // Rows.
  let ry = y0 + PAD + TITLE_H;
  for (const t of rows) {
    const cyRow = ry + ROW_H / 2;
    ids.push(...glyph(t, x0 + PAD + GLYPH_W / 2, cyRow));
    ids.push(
      text(
        LEGEND_DESC[t],
        x0 + PAD + GLYPH_W + GAP,
        cyRow - (TEXT_FS + 8) / 2,
        TEXT_W,
        TEXT_FS + 8,
        TEXT_FS
      )
    );
    ry += ROW_H;
  }

  // Gradient meaning block: a separator, then [2-colour swatch | caption].
  if (grad) {
    const sepY = ry + 4;
    ids.push(
      surface.addElement({
        type: 'shape',
        shapeType: 'rect',
        filled: true,
        fillColor: '#cfd2d6',
        strokeColor: '#cfd2d6',
        strokeWidth: 0,
        shapeStyle: ShapeStyle.General,
        roughness: 0,
        radius: 0,
        xywh: new Bound(x0 + PAD, sepY, W - PAD * 2, 1).serialize(),
      })
    );
    const cyRow = sepY + 8 + GRAD_ROW_H / 2;
    const sw = 14;
    const sgap = 2;
    const sx = x0 + PAD + GLYPH_W / 2 - (sw * 2 + sgap) / 2;
    grad.swatch.forEach((col, i) => {
      ids.push(
        surface.addElement({
          type: 'shape',
          shapeType: 'rect',
          filled: true,
          fillColor: col,
          strokeColor: '#cfd2d6',
          strokeWidth: 0.5,
          shapeStyle: ShapeStyle.General,
          roughness: 0,
          radius: 1,
          xywh: new Bound(
            sx + i * (sw + sgap),
            cyRow - sw / 2,
            sw,
            sw
          ).serialize(),
        })
      );
    });
    ids.push(
      text(
        grad.caption,
        x0 + PAD + GLYPH_W + GAP,
        cyRow - GRAD_ROW_H / 2,
        TEXT_W,
        GRAD_ROW_H,
        TEXT_FS
      )
    );
  }

  // Porter's five forces: the panel the PO's reference draws, under everything
  // else. It is not a row — a row says what a glyph IS, and this says what the
  // notation MEANS: four named pressures around one circle, and the three
  // letters spelled out. Only drawn when a force is on the map, so a legend
  // without one is the legend it always was.
  if (panel) {
    const px = x0 + PAD;
    const py = ry + gradH + 12;
    const p = PORTER_PANEL;

    // The backing: square-cornered and grey, so the panel reads as a figure
    // set into the legend rather than as one more entry in it.
    ids.push(
      surface.addElement({
        type: 'shape',
        shapeType: 'rect',
        filled: true,
        fillColor: p.backing,
        strokeColor: p.backingStroke,
        strokeWidth: 1,
        shapeStyle: ShapeStyle.General,
        roughness: 0,
        radius: 0,
        xywh: new Bound(px, py, panel.w, panel.h).serialize(),
      })
    );

    const [tx, ty, tw, th] = panel.title;
    ids.push(text("Porter's five forces", px + tx, py + ty, tw, th, p.titleFs));

    const [cx, cy] = panel.center;
    ids.push(
      surface.addElement({
        type: 'wardleyNode',
        kind: 'porter',
        shapeType: 'ellipse',
        filled: true,
        fillColor: NODE_FILL,
        strokeColor: NODE_STROKE,
        strokeWidth: NODE_STROKE_WIDTH,
        shapeStyle: ShapeStyle.General,
        roughness: 0,
        xywh: new Bound(
          px + cx - panel.radius,
          py + cy - panel.radius,
          panel.radius * 2,
          panel.radius * 2
        ).serialize(),
      })
    );
    for (const arrow of wardleyPorterArrows(px + cx, py + cy, panel.radius)) {
      ids.push(surface.addElement(wardleyPorterArrowProps(arrow)));
    }
    // All three letters at once: this circle stands for the NOTATION rather
    // than for one force, so picking one of them would make the panel say that
    // a Porter is an R.
    //
    // A SEPARATE text element, like the porter row above and for the same
    // reason (recette v2): a shape lays its text out inside a padding
    // (`SHAPE_TEXT_PADDING`) wider than this 30-unit circle, so the characters
    // would be pushed outside it. A free text has no padding to overflow, and
    // its box is placed on the circle's own centre.
    ids.push(
      text(
        PORTER_PANEL_LETTERS,
        px + cx - panel.radius,
        py + cy - p.letterFs / 2 - 1,
        panel.radius * 2,
        p.letterFs + 2,
        p.letterFs,
        'center'
      )
    );

    for (const box of panel.boxes) {
      const [bx, by, bw, bh] = box.xywh;
      ids.push(
        surface.addElement({
          type: 'shape',
          shapeType: 'rect',
          filled: true,
          fillColor: '#ffffff',
          strokeColor: NODE_STROKE,
          strokeWidth: 1,
          shapeStyle: ShapeStyle.General,
          roughness: 0,
          radius: 0,
          xywh: new Bound(px + bx, py + by, bw, bh).serialize(),
        })
      );
      ids.push(
        text(
          box.label,
          px + bx + 4,
          py + by + 3,
          bw - 8,
          bh - 6,
          p.boxFs,
          'center'
        )
      );
    }

    const [capX, capY, capW, capH] = panel.caption;
    ids.push(
      text(
        PORTER_CAPTION,
        px + capX,
        py + capY,
        capW,
        capH,
        p.captionFs,
        'center'
      )
    );
  }

  // 4. Group everything and select it.
  const [, result] = std.command.exec(createGroupCommand, { elements: ids });
  gfx.selection.set({
    elements: [result.groupId || ids[0]],
    editing: false,
  });
}
