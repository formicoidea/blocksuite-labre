import type {
  SerializedElementProps,
  ToolboxPoint,
} from '@labre/affine-block-surface/interchange';
import {
  ConnectorMode,
  FontWeight,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  TextFitMode,
} from '@labre/affine-model/headless';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/headless';
import { Bound } from '@labre/global/gfx';

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
} from './consts.js';

/**
 * The DDD artefacts as PURE builders (`docs/adr/0045`): the elements a
 * sticky, a bubble, a dot, a marker, a cloud or a relationship is made of, as
 * serialized props, with no editor behind them. The prefabs (`prefabs.ts`)
 * write these through `surface.addElement`, and each board's toolbox (its
 * `./interchange` entry) hands them to a host with no editor — one assembly
 * per artefact, shared by the three boards, which is what this package is for.
 *
 * The contract is a reader's (ADR 0012 D3): painting order, LOCAL ids, each
 * composite's members before the group that holds them, the group last. `at`
 * is the top-left of the artefact's own box (the sticky's face, the dot, the
 * marker's square); a caption written beside it lies outside that box.
 *
 * A builder writes the text it is given and never translates it: the seed in
 * the host's language is resolved by the editor's creation site (ADR 0023).
 * A shape's text is a plain string here; the shape model turns it into a
 * `Y.Text` on `addElement` (`ShapeElementModel.propsToY`), so the stored
 * element is the same whichever side built it.
 */

const NO_STROKE = '#00000000';

/** The ink every Core Domain artefact is outlined with: the shared scale's. */
const ARTEFACT_STROKE = NOTATION_NEUTRALS.ink;

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
 * The props a DDD shape is CREATED with, its label's text as a string. The
 * prefabs' `dddShapeProps` is this with the text as a `Y.Text`.
 */
export function dddShapeElement(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: ShapeOpts
): SerializedElementProps {
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
          text: label.text,
          color: label.color,
          fontFamily: label.fontFamily,
          fontSize: label.fontSize,
          textAlign: 'center',
          textFitMode: label.fit,
        }
      : {}),
  };
}

/** A canvas TEXT element: a caption beside an artefact, or a marker's letter. */
function textElement(
  id: string,
  x: number,
  y: number,
  w: number,
  text: string,
  color: string,
  fontFamily: string,
  fontSize: number,
  textAlign: 'left' | 'center' = 'center'
): SerializedElementProps {
  return {
    type: 'text',
    id,
    text,
    color,
    fontFamily,
    fontSize,
    textAlign,
    fontWeight: FontWeight.Regular,
    xywh: new Bound(x, y, w, fontSize + 10).serialize(),
  };
}

/** The group holding `members`, written after them. */
function groupOf(
  id: string,
  members: readonly SerializedElementProps[]
): SerializedElementProps {
  return {
    type: 'group',
    id,
    children: Object.fromEntries(members.map(m => [m.id, true])),
  };
}

/**
 * What a Core Domain DOT is, as shape options — read by the builder below and
 * by the morph, so the two can never disagree about what a platform
 * sub-domain looks like.
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

export interface StickyOpts {
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

/**
 * A post-it whose face is at `at`: the faux-shadow rect, the coloured face
 * whose label is its OWN shape text in `contained` fit mode, and their group.
 */
export function stickyElements(
  at: ToolboxPoint,
  opts: StickyOpts,
  local = 'sticky'
): SerializedElementProps[] {
  const {
    fill,
    text,
    label,
    shapeType = 'rect',
    size = STICKY_SIZE,
    role,
  } = opts;
  const radius = shapeType === 'rect' ? STICKY_RADIUS : 0;
  const members = [
    {
      ...dddShapeElement(
        at.x + SHADOW_OFFSET,
        at.y + SHADOW_OFFSET,
        size,
        size,
        { shapeType, fill: SHADOW_COLOR, radius }
      ),
      id: `${local}:shadow`,
    },
    {
      ...dddShapeElement(at.x, at.y, size, size, {
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
      }),
      id: `${local}:face`,
    },
  ];
  return [...members, groupOf(`${local}:group`, members)];
}

/**
 * A Context Map bounded-context bubble at `at`: a rounded pill whose label is
 * the pill's own shape text in `overflow` fit mode (fixed pill, fixed font — a
 * long context name may spill out rather than deform the map).
 */
export function bubbleElement(
  at: ToolboxPoint,
  label: string,
  role?: string,
  local = 'bubble'
): SerializedElementProps {
  const { w, h, radius, fill, stroke, text } = CM_BUBBLE;
  return {
    ...dddShapeElement(at.x, at.y, w, h, {
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
    }),
    id: local,
  };
}

/**
 * A Core Domain dot at `at`; with a label, the caption to its right and the
 * group of the two. The role rides on the ELLIPSE, never on the group.
 */
export function dotElements(
  at: ToolboxPoint,
  fill: string,
  label?: string,
  role?: string,
  local = 'dot'
): SerializedElementProps[] {
  const d = DOT_SIZE;
  const dot = {
    ...dddShapeElement(at.x, at.y, d, d, dotShapeOpts(fill, role)),
    id: `${local}:dot`,
  };
  if (!label) return [dot];
  const caption = textElement(
    `${local}:caption`,
    at.x + d + 6,
    at.y + d / 2 - LABEL_FONT_SIZE / 2,
    170,
    label,
    LABEL_COLOR,
    LABEL_FONT,
    LABEL_FONT_SIZE,
    'left'
  );
  return [dot, caption, groupOf(`${local}:group`, [dot, caption])];
}

export interface MarkerOpts {
  fill: string;
  letter: string;
  label?: string;
  role?: string;
}

/**
 * A Team Topologies interaction-mode marker whose square is at `at`: the
 * square, its centred letter, the caption beside it when given, and the group.
 * The role rides on the SQUARE: the letter is its glyph and the word beside it
 * is a caption.
 */
export function markerElements(
  at: ToolboxPoint,
  opts: MarkerOpts,
  local = 'marker'
): SerializedElementProps[] {
  const { fill, letter, label, role } = opts;
  const s = MARKER_SIZE;
  const members = [
    {
      ...dddShapeElement(at.x, at.y, s, s, markerShapeOpts(fill, role)),
      id: `${local}:square`,
    },
    textElement(
      `${local}:letter`,
      at.x,
      at.y + s / 2 - 9,
      s,
      letter,
      NOTATION_NEUTRALS.ink,
      LABEL_FONT,
      15
    ),
  ];
  if (label) {
    members.push(
      textElement(
        `${local}:caption`,
        at.x + s + 6,
        at.y + s / 2 - LABEL_FONT_SIZE / 2,
        150,
        label,
        LABEL_COLOR,
        LABEL_FONT,
        LABEL_FONT_SIZE,
        'left'
      )
    );
  }
  return [...members, groupOf(`${local}:group`, members)];
}

/**
 * A cloud (Big Ball of Mud / general-purpose boundary) at `at`: a dense
 * closed polygon; with a label, the text across it and the group of the two.
 * The role rides on the POLYGON, never on the group: the polygon is what a
 * relationship binds to and what the legend scan meets.
 */
export function cloudElements(
  at: ToolboxPoint,
  label?: string,
  role?: string,
  local = 'cloud'
): SerializedElementProps[] {
  const { w, h, fill, stroke } = CLOUD;
  const cloud: SerializedElementProps = {
    type: 'shape',
    id: `${local}:cloud`,
    shapeType: 'polygon',
    vertices: CLOUD_VERTICES,
    isClosed: true,
    filled: true,
    fillColor: fill,
    strokeColor: stroke,
    strokeWidth: 1.5,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    xywh: new Bound(at.x, at.y, w, h).serialize(),
    ...(role ? { role } : {}),
  };
  if (!label) return [cloud];
  const caption = textElement(
    `${local}:caption`,
    at.x + 12,
    at.y + h / 2 - LABEL_FONT_SIZE / 2,
    w - 24,
    label,
    NOTATION_NEUTRALS.ink,
    LABEL_FONT,
    LABEL_FONT_SIZE
  );
  return [cloud, caption, groupOf(`${local}:group`, [cloud, caption])];
}

/** A connector end: an element (or local) id, or a free point. */
export type DddConnectorEnd = { id: string } | { position: [number, number] };

export interface DddConnectorOpts {
  rearArrow?: boolean;
  dashed?: boolean;
  stroke?: string;
  strokeWidth?: number;
  /** Edge role; `undefined` leaves the connector a neutral line. */
  role?: string;
  /** The words riding on the line; none when absent or blank. */
  label?: string;
}

/** A relationship connector (the single connector unit reused for all patterns). */
export function dddConnectorElement(
  source: DddConnectorEnd,
  target: DddConnectorEnd,
  opts: DddConnectorOpts = {}
): SerializedElementProps {
  const {
    rearArrow = false,
    dashed = false,
    stroke = LABEL_COLOR,
    strokeWidth = 2,
    role,
    label,
  } = opts;
  return {
    type: 'connector',
    role,
    mode: ConnectorMode.Straight,
    stroke,
    strokeWidth,
    strokeStyle: dashed ? StrokeStyle.Dash : StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: rearArrow ? PointStyle.Arrow : PointStyle.None,
    source,
    target,
    ...(label?.trim() ? { text: label.trim() } : {}),
  };
}
