import type { BpmnNodeKind } from '@labre/affine-model';
import {
  FontFamily,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
  TextFitMode,
  TextVerticalAlign,
} from '@labre/affine-model';

import {
  CALL_ACTIVITY_WIDTH,
  END_WIDTH,
  EVENT_END,
  EVENT_START,
  GROUP_RADIUS,
  GROUP_STROKE,
  INNER_FONT_SIZE,
  NEUTRAL_STROKE,
  NODE_FILL,
  NODE_STROKE_WIDTH,
  START_WIDTH,
  TASK_RADIUS,
} from './consts.js';
import { BPMN_ROLE_OF_KIND } from './roles.js';

/**
 * What a BPMN artefact is BORN as — the one description of a node's props, read
 * by every site that creates one.
 *
 * Lifted out of `actions.ts` when the importer arrived, and lifted rather than
 * copied for the reason the copy would have failed: a task read out of a
 * `.bpmn` file and a task drawn from the palette must be the same element in
 * the document, down to the stroke width and the text fit mode. Two builders
 * would agree on the day they were written and drift on the first restyle,
 * and the drift would show up as an imported board that looks subtly unlike a
 * drawn one — the kind of difference nobody reports and everybody notices.
 *
 * Pure data and one pure function: no `BlockStdScope`, no surface, no viewport.
 * The creation gesture supplies the box, the importer supplies the box the file
 * gave it, and neither knows anything the other does not.
 */

/**
 * The native shape and accent a kind is born with (style C).
 *
 * `glyphBody` is the one non-obvious field: the three data/artifact shapes have
 * a silhouette a native rect cannot make — a folded page, a cylinder, an open
 * bracket — so for those the renderer's glyph paints the BODY as well as the
 * decoration, and the native shape is created unfilled and unstroked. It still
 * earns its keep: it is what carries the inner text, the selection bounds, the
 * resize handles and the connector anchors.
 */
export interface BpmnNodePreset {
  shapeType: 'ellipse' | 'rect' | 'diamond';
  stroke: string;
  width: number;
  /** Corner radius, `rect` only. Absent means a square corner. */
  radius?: number;
  /** Border style. Absent means a solid line, which is what BPMN mostly draws. */
  strokeStyle?: StrokeStyle;
  /**
   * No fill — an OUTLINE, not a body. It also decides what the artefact does to
   * a click: an unfilled shape is hit near its border and on its label only, so
   * the group never steals a click from the work it encloses.
   */
  hollow?: true;
  /** The glyph draws the body; the native shape paints nothing. */
  glyphBody?: true;
  /**
   * Where the inner text sits. Absent means centred, which is what every
   * artefact whose label names the artefact itself wants. The group is the
   * exception: its label names a region, so it goes in the corner of it.
   */
  textAlign?: TextAlign;
  textVerticalAlign?: TextVerticalAlign;
}

/** Per-kind native shape + accent presets (style C). */
export const NODE_PRESETS: Record<BpmnNodeKind, BpmnNodePreset> = {
  // Events: one ellipse, and the ring weight says start or end. The message and
  // timer variants keep their family's ring exactly — a message START is a thin
  // green ring with an envelope in it, and a message END the thick red one.
  startEvent: { shapeType: 'ellipse', stroke: EVENT_START, width: START_WIDTH },
  startEventMessage: {
    shapeType: 'ellipse',
    stroke: EVENT_START,
    width: START_WIDTH,
  },
  startEventTimer: {
    shapeType: 'ellipse',
    stroke: EVENT_START,
    width: START_WIDTH,
  },
  endEvent: { shapeType: 'ellipse', stroke: EVENT_END, width: END_WIDTH },
  endEventMessage: {
    shapeType: 'ellipse',
    stroke: EVENT_END,
    width: END_WIDTH,
  },
  endEventTerminate: {
    shapeType: 'ellipse',
    stroke: EVENT_END,
    width: END_WIDTH,
  },
  // Activities: the same rounded rectangle, and a marker tells them apart —
  // except the call activity, whose thick border IS the distinction (it carries
  // the same `+` as the sub-process).
  task: {
    shapeType: 'rect',
    stroke: NEUTRAL_STROKE,
    width: NODE_STROKE_WIDTH,
    radius: TASK_RADIUS,
  },
  taskUser: {
    shapeType: 'rect',
    stroke: NEUTRAL_STROKE,
    width: NODE_STROKE_WIDTH,
    radius: TASK_RADIUS,
  },
  taskService: {
    shapeType: 'rect',
    stroke: NEUTRAL_STROKE,
    width: NODE_STROKE_WIDTH,
    radius: TASK_RADIUS,
  },
  subProcess: {
    shapeType: 'rect',
    stroke: NEUTRAL_STROKE,
    width: NODE_STROKE_WIDTH,
    radius: TASK_RADIUS,
  },
  callActivity: {
    shapeType: 'rect',
    stroke: NEUTRAL_STROKE,
    width: CALL_ACTIVITY_WIDTH,
    radius: TASK_RADIUS,
  },
  // Gateways: one diamond, one marker each.
  gatewayExclusive: {
    shapeType: 'diamond',
    stroke: NEUTRAL_STROKE,
    width: NODE_STROKE_WIDTH,
  },
  gatewayParallel: {
    shapeType: 'diamond',
    stroke: NEUTRAL_STROKE,
    width: NODE_STROKE_WIDTH,
  },
  // Data and artifacts: body drawn by the glyph (see {@link BpmnNodePreset}).
  dataObject: {
    shapeType: 'rect',
    stroke: NEUTRAL_STROKE,
    width: NODE_STROKE_WIDTH,
    glyphBody: true,
  },
  dataStore: {
    shapeType: 'rect',
    stroke: NEUTRAL_STROKE,
    width: NODE_STROKE_WIDTH,
    glyphBody: true,
  },
  textAnnotation: {
    shapeType: 'rect',
    stroke: NEUTRAL_STROKE,
    width: NODE_STROKE_WIDTH,
    glyphBody: true,
  },
  // The group: a dashed grey outline round part of the picture. Entirely a
  // native shape — no glyph, nothing for the renderer to do — because the
  // notation asks for exactly what `strokeStyle: dash` already draws.
  group: {
    shapeType: 'rect',
    stroke: GROUP_STROKE,
    width: NODE_STROKE_WIDTH,
    radius: GROUP_RADIUS,
    strokeStyle: StrokeStyle.Dash,
    hollow: true,
    textAlign: TextAlign.Left,
    textVerticalAlign: TextVerticalAlign.Top,
  },
};

/**
 * One BPMN node, as the props `surface.addElement` takes.
 *
 * The single description of what a `bpmnNode` IS in a document: the palette
 * hands it a box centred on the viewport, the importer hands it the box the
 * file's `dc:Bounds` gave, and the element that lands is the same either way.
 *
 * `text` is passed through unchanged, `undefined` included — an artefact whose
 * label the source left empty gets no `text` key at all rather than an empty
 * one, which is what keeps an imported node byte-comparable with a drawn one
 * that was never typed into.
 */
export function bpmnNodeProps(
  kind: BpmnNodeKind,
  box: { xywh: string; text?: string }
): Record<string, unknown> & { type: string } {
  const preset = NODE_PRESETS[kind];
  return {
    type: 'bpmnNode',
    kind,
    // Semantic identity (B1): posted next to `kind`, which stays untouched and
    // keeps driving the rendering. The role is the authority on what the node
    // MEANS — see the table in `./roles.ts`.
    role: BPMN_ROLE_OF_KIND[kind],
    shapeType: preset.shapeType,
    // A glyph-bodied artefact paints nothing natively: the folded page, the
    // cylinder and the bracket are drawn by the renderer, which reads
    // `fillColor` / `strokeColor` off this same model — so both stay editable
    // from the shape toolbar exactly like every other node's. A `hollow` one
    // paints natively and simply has no body: the group is an outline.
    filled: !preset.glyphBody && !preset.hollow,
    fillColor: NODE_FILL,
    strokeColor: preset.stroke,
    strokeWidth: preset.width,
    strokeStyle: preset.glyphBody
      ? StrokeStyle.None
      : (preset.strokeStyle ?? StrokeStyle.Solid),
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius: preset.radius ?? 0,
    text: box.text,
    color: NEUTRAL_STROKE,
    fontFamily: FontFamily.Inter,
    fontSize: INNER_FONT_SIZE,
    textAlign: preset.textAlign ?? TextAlign.Center,
    // Spread, never a defaulted key: the model's own default is already
    // `Center`, so writing it here would put a new key in the Y.Map of every
    // artefact that does not ask for one — the same avoidable payload change
    // review caught on `strokeStyle`.
    ...(preset.textVerticalAlign
      ? { textVerticalAlign: preset.textVerticalAlign }
      : {}),
    // BPMN symbols have normative sizes: a long label overflows rather
    // than deforming the node
    textFitMode: TextFitMode.Overflow,
    xywh: box.xywh,
  };
}
