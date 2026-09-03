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
  AREA_FILL,
  AREA_STROKE,
  AREA_STROKE_WIDTH,
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
  | 'decelerator'
  | 'area';

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
  'area',
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
  area: 'Area (zone of the map)',
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

/**
 * Build a "Legend" group from real, editable elements (white rect frame +
 * "Legend" text + one row of [real component glyph + description text] per
 * Wardley component TYPE present inside the background's perimeter + a
 * gradient-meaning block when the background is a gradient variant). A snapshot
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
  const H = PAD * 2 + TITLE_H + rows.length * ROW_H + gradH;

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
      case 'area': {
        // A small translucent rect, and the rect even when the map's zones are
        // polygons: the row says what a ZONE is, and the number of corners is
        // the author's choice rather than part of the notation. Same wash and
        // same rim as the canvas draws, so the swatch is recognisable.
        const gw = 34;
        const gh = 20;
        return [
          surface.addElement({
            type: 'wardleyNode',
            kind: 'area',
            shapeType: 'rect',
            filled: true,
            fillColor: AREA_FILL,
            strokeColor: AREA_STROKE,
            strokeWidth: AREA_STROKE_WIDTH,
            shapeStyle: ShapeStyle.General,
            roughness: 0,
            radius: 0,
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

  // 4. Group everything and select it.
  const [, result] = std.command.exec(createGroupCommand, { elements: ids });
  gfx.selection.set({
    elements: [result.groupId || ids[0]],
    editing: false,
  });
}
