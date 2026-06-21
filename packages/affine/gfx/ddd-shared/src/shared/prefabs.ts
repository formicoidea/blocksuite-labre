import { createGroupCommand } from '@labre/affine-gfx-group';
import {
  ConnectorMode,
  FontWeight,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import type { GfxController } from '@labre/std/gfx';

import {
  CLOUD,
  CLOUD_VERTICES,
  CM_BUBBLE,
  DOT_SIZE,
  LABEL_COLOR,
  LABEL_FONT,
  LABEL_FONT_SIZE,
  MARKER_SIZE,
  SHADOW_COLOR,
  SHADOW_OFFSET,
  STICKY_FONT,
  STICKY_FONT_SIZE,
  STICKY_RADIUS,
  STICKY_SIZE,
} from './consts';

/**
 * Irreducible reusable units composed by all three DDD sub-menus. Each helper
 * wraps native `surface.addElement` (shape / text / connector / group); nothing
 * here defines a new element type, so the same builders back Event Storming
 * stickies, Context Map bubbles + relationships and Core Domain dots + arrows.
 */

type Surface = NonNullable<GfxController['surface']>;

const NO_STROKE = '#00000000';

/** Group several element ids; returns the group id (or the first id on failure). */
export function groupIds(std: BlockStdScope, ids: string[]): string {
  const [, result] = std.command.exec(createGroupCommand, { elements: ids });
  return result.groupId || ids[0];
}

interface ShapeOpts {
  shapeType?: 'rect' | 'ellipse' | 'diamond';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
}

function addShape(
  surface: Surface,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: ShapeOpts
): string {
  const { shapeType = 'rect', fill, stroke = NO_STROKE, strokeWidth = 0, radius = 0 } = opts;
  return surface.addElement({
    type: 'shape',
    shapeType,
    filled: true,
    fillColor: fill,
    strokeColor: stroke,
    strokeWidth,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius,
    xywh: new Bound(x, y, w, h).serialize(),
  });
}

function addText(
  surface: Surface,
  x: number,
  y: number,
  w: number,
  text: string,
  color: string,
  fontFamily: string,
  fontSize: number,
  textAlign: 'left' | 'center' = 'center',
  bold = false
): string {
  return surface.addElement({
    type: 'text',
    text,
    color,
    fontFamily,
    fontSize,
    textAlign,
    fontWeight: bold ? FontWeight.SemiBold : FontWeight.Regular,
    xywh: new Bound(x, y, w, fontSize + 10).serialize(),
  });
}

/** A post-it: faux-shadow rect + coloured face + centred handwriting label, grouped. */
export function addSticky(
  surface: Surface,
  std: BlockStdScope,
  cx: number,
  cy: number,
  opts: { fill: string; text: string; label: string; shapeType?: 'rect' | 'diamond'; size?: number }
): string {
  const { fill, text, label, shapeType = 'rect', size = STICKY_SIZE } = opts;
  const half = size / 2;
  const radius = shapeType === 'rect' ? STICKY_RADIUS : 0;
  const shadow = addShape(surface, cx - half + SHADOW_OFFSET, cy - half + SHADOW_OFFSET, size, size, {
    shapeType,
    fill: SHADOW_COLOR,
    radius,
  });
  const face = addShape(surface, cx - half, cy - half, size, size, { shapeType, fill, radius });
  const lbl = addText(
    surface,
    cx - half + 10,
    cy - STICKY_FONT_SIZE / 2,
    size - 20,
    label,
    text,
    STICKY_FONT,
    STICKY_FONT_SIZE
  );
  return groupIds(std, [shadow, face, lbl]);
}

/** A Context Map bounded-context bubble (rounded pill + centred label). */
export function addBubble(
  surface: Surface,
  std: BlockStdScope,
  cx: number,
  cy: number,
  label: string
): string {
  const { w, h, radius, fill, stroke, text } = CM_BUBBLE;
  const box = addShape(surface, cx - w / 2, cy - h / 2, w, h, {
    fill,
    stroke,
    strokeWidth: 1.5,
    radius,
  });
  const lbl = addText(surface, cx - w / 2 + 8, cy - LABEL_FONT_SIZE / 2, w - 16, label, text, LABEL_FONT, LABEL_FONT_SIZE);
  return groupIds(std, [box, lbl]);
}

/** A Core Domain dot (sub-domain / bounded context); optional label to its right. */
export function addDot(
  surface: Surface,
  std: BlockStdScope,
  cx: number,
  cy: number,
  fill: string,
  label?: string
): string {
  const d = DOT_SIZE;
  const dot = addShape(surface, cx - d / 2, cy - d / 2, d, d, {
    shapeType: 'ellipse',
    fill,
    stroke: '#1f2328',
    strokeWidth: 1.5,
  });
  if (!label) return dot;
  const lbl = addText(surface, cx + d / 2 + 6, cy - LABEL_FONT_SIZE / 2, 170, label, LABEL_COLOR, LABEL_FONT, LABEL_FONT_SIZE, 'left');
  return groupIds(std, [dot, lbl]);
}

/** A free-floating label. */
export function addLabel(
  surface: Surface,
  cx: number,
  cy: number,
  label: string,
  align: 'left' | 'center' = 'center',
  color = LABEL_COLOR
): string {
  return addText(surface, cx, cy, 200, label, color, LABEL_FONT, LABEL_FONT_SIZE, align);
}

/** A relationship connector (the single connector unit reused for all patterns). */
export function addConnector(
  surface: Surface,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: { rearArrow?: boolean; dashed?: boolean; stroke?: string; strokeWidth?: number } = {}
): string {
  const { rearArrow = false, dashed = false, stroke = LABEL_COLOR, strokeWidth = 2 } = opts;
  return surface.addElement({
    type: 'connector',
    mode: ConnectorMode.Straight,
    stroke,
    strokeWidth,
    strokeStyle: dashed ? StrokeStyle.Dash : StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: rearArrow ? PointStyle.Arrow : PointStyle.None,
    source: { position: [x1, y1] },
    target: { position: [x2, y2] },
  });
}

/** A Team Topologies interaction-mode marker: a coloured square + centred letter. */
export function addMarker(
  surface: Surface,
  std: BlockStdScope,
  cx: number,
  cy: number,
  opts: { fill: string; letter: string; label?: string }
): string {
  const { fill, letter, label } = opts;
  const s = MARKER_SIZE;
  const box = addShape(surface, cx - s / 2, cy - s / 2, s, s, {
    fill,
    stroke: '#1f2328',
    strokeWidth: 1.5,
    radius: 4,
  });
  const glyph = addText(surface, cx - s / 2, cy - 9, s, letter, '#1f2328', LABEL_FONT, 15);
  const ids = [box, glyph];
  if (label) {
    ids.push(addText(surface, cx + s / 2 + 6, cy - LABEL_FONT_SIZE / 2, 150, label, LABEL_COLOR, LABEL_FONT, LABEL_FONT_SIZE, 'left'));
  }
  return groupIds(std, ids);
}

/** A cloud (Big Ball of Mud / general-purpose boundary): a smoothed closed bezier polygon. */
export function addCloud(
  surface: Surface,
  std: BlockStdScope,
  cx: number,
  cy: number,
  label?: string
): string {
  const { w, h, fill, stroke } = CLOUD;
  const cloud = surface.addElement({
    type: 'shape',
    shapeType: 'polygon',
    vertices: CLOUD_VERTICES,
    isClosed: true,
    filled: true,
    fillColor: fill,
    strokeColor: stroke,
    strokeWidth: 1.5,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    xywh: new Bound(cx - w / 2, cy - h / 2, w, h).serialize(),
  });
  if (!label) return cloud;
  const lbl = addText(surface, cx - w / 2 + 12, cy - LABEL_FONT_SIZE / 2, w - 24, label, '#3d3d3d', LABEL_FONT, LABEL_FONT_SIZE);
  return groupIds(std, [cloud, lbl]);
}

/**
 * A Context Map relationship in DDD Crew notation: the connector, the pattern
 * abbreviation in a small tag, and (for upstream/downstream patterns) the U / D
 * markers — grouped so the whole pattern reads as one unit.
 */
export function addRelationship(
  surface: Surface,
  std: BlockStdScope,
  cx: number,
  cy: number,
  preset: { abbrev: string; upDown: boolean; dashed: boolean }
): string {
  const conn = addConnector(surface, cx - 130, cy, cx + 130, cy, {
    rearArrow: preset.upDown,
    dashed: preset.dashed,
  });
  const tag = addShape(surface, cx - 26, cy - 42, 52, 24, {
    fill: '#ffffff',
    stroke: '#6d6e71',
    strokeWidth: 1,
    radius: 4,
  });
  const tagText = addText(surface, cx - 26, cy - 36, 52, preset.abbrev, LABEL_COLOR, LABEL_FONT, 13);
  const ids = [conn, tag, tagText];
  if (preset.upDown) {
    ids.push(addText(surface, cx - 150, cy - 30, 24, 'U', LABEL_COLOR, LABEL_FONT, 13));
    ids.push(addText(surface, cx + 126, cy - 30, 24, 'D', LABEL_COLOR, LABEL_FONT, 13));
  }
  return groupIds(std, ids);
}

export interface LegendRow {
  swatch: 'dot' | 'square' | 'line';
  color: string;
  letter?: string;
  label: string;
}
export interface LegendSection {
  title?: string;
  rows: LegendRow[];
}

/**
 * A boxed legend: a bordered container with a bold "Légende" title and bold
 * section sub-titles, each row a swatch (dot / square+letter / line) + label.
 * Shared by the Core Domain and Context Map tools. Returns the grouped id.
 */
export function addLegend(
  surface: Surface,
  std: BlockStdScope,
  x: number,
  y: number,
  opts: { title: string; sections: LegendSection[]; width?: number }
): string {
  const W = opts.width ?? 260;
  const PAD = 16;
  const TITLE_H = 32;
  const SUB_H = 26;
  const ROW_H = 28;
  const SW = 16;
  let subs = 0;
  let rows = 0;
  for (const s of opts.sections) {
    if (s.title) subs++;
    rows += s.rows.length;
  }
  const H = PAD * 2 + TITLE_H + subs * SUB_H + rows * ROW_H;

  const ids: string[] = [
    addShape(surface, x, y, W, H, {
      fill: '#ffffff',
      stroke: '#6d6e71',
      strokeWidth: 1.5,
      radius: 8,
    }),
  ];
  let cy = y + PAD;
  ids.push(addText(surface, x + PAD, cy, W - PAD * 2, opts.title, LABEL_COLOR, LABEL_FONT, 18, 'left', true));
  cy += TITLE_H;
  for (const sec of opts.sections) {
    if (sec.title) {
      ids.push(addText(surface, x + PAD, cy, W - PAD * 2, sec.title, LABEL_COLOR, LABEL_FONT, 14, 'left', true));
      cy += SUB_H;
    }
    for (const row of sec.rows) {
      const sx = x + PAD;
      const midY = cy + ROW_H / 2;
      if (row.swatch === 'dot') {
        ids.push(addShape(surface, sx, midY - SW / 2, SW, SW, { shapeType: 'ellipse', fill: row.color, stroke: '#1f2328', strokeWidth: 1 }));
      } else if (row.swatch === 'square') {
        ids.push(addShape(surface, sx, midY - SW / 2, SW, SW, { fill: row.color, stroke: '#1f2328', strokeWidth: 1, radius: 3 }));
        if (row.letter) ids.push(addText(surface, sx, midY - 8, SW, row.letter, '#1f2328', LABEL_FONT, 11));
      } else {
        ids.push(addShape(surface, sx, midY - 2, SW, 4, { fill: row.color, radius: 1 }));
      }
      ids.push(addText(surface, sx + SW + 10, midY - LABEL_FONT_SIZE / 2, W - PAD * 2 - SW - 10, row.label, LABEL_COLOR, LABEL_FONT, 13, 'left'));
      cy += ROW_H;
    }
  }
  return groupIds(std, ids);
}
