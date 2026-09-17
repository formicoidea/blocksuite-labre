import { DefaultTool } from '@labre/affine-block-surface';
import { createGroupCommand } from '@labre/affine-gfx-group';
import {
  ConnectorMode,
  FontWeight,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  TextFitMode,
} from '@labre/affine-model';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';
import * as Y from 'yjs';

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

/**
 * Build one DDD artefact at the viewport centre and select it, leaving the
 * palette open so several can be added in a row. This is the old
 * `DddMenuBase.finish` — moved here when PF3 turned the three menus into pure
 * renderers over the command registry, since the placement is what the command
 * bodies need and the menu no longer has any.
 */
export function placeDddElement(
  std: BlockStdScope,
  build: (surface: Surface, cx: number, cy: number) => string
): void {
  const gfx = std.get(GfxControllerIdentifier);
  const surface = gfx.surface;
  if (!surface) return;
  const { centerX, centerY } = gfx.viewport;
  const id = build(surface, centerX, centerY);
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
}

/** Group several element ids; returns the group id (or the first id on failure). */
export function groupIds(std: BlockStdScope, ids: string[]): string {
  const [, result] = std.command.exec(createGroupCommand, { elements: ids });
  return result.groupId || ids[0];
}

export interface ShapeOpts {
  shapeType?: 'rect' | 'ellipse' | 'diamond';
  fill: string;
  /**
   * Semantic role (`<framework>:<role>`) stamped on the shape, so a validation
   * rule can recognise it. `undefined` writes NOTHING — no `role` key is
   * persisted and the artefact stays a neutral drawing, which is what every
   * caller that does not pass one keeps getting and what every DDD artefact
   * created before this parameter existed already is.
   */
  role?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  /**
   * Shape-owned centred label. The text belongs to the shape itself (edited
   * by double-click, moves/resizes with it) with the given text-fit mode —
   * `contained` mimics a physical post-it.
   */
  label?: {
    text: string;
    color: string;
    fontFamily: string;
    fontSize: number;
    fit: TextFitMode;
  };
}

/**
 * The props a DDD shape is CREATED with, as a record — the write of
 * {@link addShape}, minus the write.
 *
 * Split out for the Core Domain morph, and for the reason C4's `presets.ts`
 * gives: a kind's appearance is written by the preset of the kind it was created
 * as and nothing else ever rewrites it, so a morph that restated the table would
 * agree with the palette the day it was written and drift on the first restyle.
 * Derived, they cannot — a morphed dot and one freshly placed are the same
 * element.
 */
export function dddShapeProps(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: ShapeOpts
): Record<string, unknown> & { type: string } {
  const {
    shapeType = 'rect',
    fill,
    stroke = NO_STROKE,
    strokeWidth = 0,
    radius = 0,
    label,
    role,
  } = opts;
  return {
    type: 'shape',
    // `undefined` writes nothing: a neutral artefact keeps no `role` key.
    role,
    shapeType,
    filled: true,
    fillColor: fill,
    strokeColor: stroke,
    strokeWidth,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius,
    xywh: new Bound(x, y, w, h).serialize(),
    ...(label
      ? {
          text: new Y.Text(label.text),
          color: label.color,
          fontFamily: label.fontFamily,
          fontSize: label.fontSize,
          textAlign: 'center',
          textFitMode: label.fit,
        }
      : {}),
  };
}

function addShape(
  surface: Surface,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: ShapeOpts
): string {
  return surface.addElement(dddShapeProps(x, y, w, h, opts));
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

/**
 * A post-it: faux-shadow rect + coloured face whose label is the face's OWN
 * shape text in `contained` fit mode — like a real post-it, the box size is
 * fixed and the handwriting shrinks to fit. Grouped so shadow and face move
 * together. (Stickies created before the text-fit feature carry a separate
 * text element; they keep working untouched.)
 */
export function addSticky(
  surface: Surface,
  std: BlockStdScope,
  cx: number,
  cy: number,
  opts: {
    fill: string;
    text: string;
    label: string;
    shapeType?: 'rect' | 'diamond';
    size?: number;
    /**
     * Stamped on the FACE, never on the shadow: the face is the artefact — it
     * is what carries the words, what a connector attaches to and what the
     * grammar rules read. The shadow is ink.
     */
    role?: string;
  }
): string {
  const {
    fill,
    text,
    label,
    shapeType = 'rect',
    size = STICKY_SIZE,
    role,
  } = opts;
  const half = size / 2;
  const radius = shapeType === 'rect' ? STICKY_RADIUS : 0;
  const shadow = addShape(
    surface,
    cx - half + SHADOW_OFFSET,
    cy - half + SHADOW_OFFSET,
    size,
    size,
    {
      shapeType,
      fill: SHADOW_COLOR,
      radius,
    }
  );
  const face = addShape(surface, cx - half, cy - half, size, size, {
    shapeType,
    fill,
    radius,
    role,
    label: {
      text: label,
      color: text,
      fontFamily: STICKY_FONT,
      fontSize: STICKY_FONT_SIZE,
      fit: TextFitMode.Contained,
    },
  });
  return groupIds(std, [shadow, face]);
}

/**
 * A Context Map bounded-context bubble: a rounded pill whose label is the
 * pill's own shape text in `overflow` fit mode (fixed pill, fixed font — a
 * long context name may spill out rather than deform the map).
 */
export function addBubble(
  surface: Surface,
  cx: number,
  cy: number,
  label: string,
  role?: string
): string {
  const { w, h, radius, fill, stroke, text } = CM_BUBBLE;
  return addShape(surface, cx - w / 2, cy - h / 2, w, h, {
    fill,
    stroke,
    strokeWidth: 1.5,
    radius,
    role,
    label: {
      text: label,
      color: text,
      fontFamily: LABEL_FONT,
      fontSize: LABEL_FONT_SIZE,
      fit: TextFitMode.Overflow,
    },
  });
}

/** The ink every Core Domain artefact is outlined with: the shared scale's. */
const ARTEFACT_STROKE = NOTATION_NEUTRALS.ink;

/**
 * What a Core Domain DOT is, as shape options — read by the creation site below
 * and by the morph, so the two can never disagree about what a platform
 * sub-domain looks like. See {@link dddShapeProps}.
 */
export function dotShapeOpts(fill: string, role?: string): ShapeOpts {
  return {
    shapeType: 'ellipse',
    fill,
    stroke: ARTEFACT_STROKE,
    strokeWidth: 1.5,
    role,
  };
}

/** What a Team Topologies MARKER square is, the same way. */
export function markerShapeOpts(fill: string, role?: string): ShapeOpts {
  return {
    fill,
    stroke: ARTEFACT_STROKE,
    strokeWidth: 1.5,
    radius: 4,
    role,
  };
}

/** A Core Domain dot (sub-domain / bounded context); optional label to its right. */
export function addDot(
  surface: Surface,
  std: BlockStdScope,
  cx: number,
  cy: number,
  fill: string,
  label?: string,
  /** Stamped on the ELLIPSE, never on the group: the dot is the artefact. */
  role?: string
): string {
  const d = DOT_SIZE;
  const dot = addShape(
    surface,
    cx - d / 2,
    cy - d / 2,
    d,
    d,
    dotShapeOpts(fill, role)
  );
  if (!label) return dot;
  const lbl = addText(
    surface,
    cx + d / 2 + 6,
    cy - LABEL_FONT_SIZE / 2,
    170,
    label,
    LABEL_COLOR,
    LABEL_FONT,
    LABEL_FONT_SIZE,
    'left'
  );
  return groupIds(std, [dot, lbl]);
}

/** A relationship connector (the single connector unit reused for all patterns). */
export function addConnector(
  surface: Surface,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: {
    rearArrow?: boolean;
    dashed?: boolean;
    stroke?: string;
    strokeWidth?: number;
    /** Edge role; `undefined` leaves the connector a neutral line. */
    role?: string;
  } = {}
): string {
  const {
    rearArrow = false,
    dashed = false,
    stroke = LABEL_COLOR,
    strokeWidth = 2,
    role,
  } = opts;
  return surface.addElement({
    type: 'connector',
    role,
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

/**
 * A Team Topologies interaction-mode marker: a coloured square + centred letter.
 *
 * The role rides on the SQUARE, never on the group — the same call as
 * {@link addDot}: the square is the artefact, the letter is its glyph and the
 * word beside it is a caption. `undefined` writes nothing, so a caller that
 * passes none keeps producing the neutral drawing it always did.
 */
export function addMarker(
  surface: Surface,
  std: BlockStdScope,
  cx: number,
  cy: number,
  opts: { fill: string; letter: string; label?: string; role?: string }
): string {
  const { fill, letter, label, role } = opts;
  const s = MARKER_SIZE;
  const box = addShape(
    surface,
    cx - s / 2,
    cy - s / 2,
    s,
    s,
    markerShapeOpts(fill, role)
  );
  const glyph = addText(
    surface,
    cx - s / 2,
    cy - 9,
    s,
    letter,
    NOTATION_NEUTRALS.ink,
    LABEL_FONT,
    15
  );
  const ids = [box, glyph];
  if (label) {
    ids.push(
      addText(
        surface,
        cx + s / 2 + 6,
        cy - LABEL_FONT_SIZE / 2,
        150,
        label,
        LABEL_COLOR,
        LABEL_FONT,
        LABEL_FONT_SIZE,
        'left'
      )
    );
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
  const lbl = addText(
    surface,
    cx - w / 2 + 12,
    cy - LABEL_FONT_SIZE / 2,
    w - 24,
    label,
    NOTATION_NEUTRALS.ink,
    LABEL_FONT,
    LABEL_FONT_SIZE
  );
  return groupIds(std, [cloud, lbl]);
}

/**
 * The legend BOX moved to `@labre/affine-block-surface`
 * (`extensions/legend.ts`) with the engine that drives it, so a framework which
 * is not a DDD one — BPMN, Wardley — can document itself without depending on
 * this bundle. Re-exported unchanged so no caller had to be touched by the
 * move; it goes away with the rest of the table-shaped API.
 *
 * @deprecated Import from `@labre/affine-block-surface`.
 */
export {
  addLegend,
  measureLegend,
  type LegendLayout,
  type LegendRow,
  type LegendSection,
} from '@labre/affine-block-surface';
