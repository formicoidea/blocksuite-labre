import type { BpmnNodeKind } from '@labre/affine-model';
import {
  FontFamily,
  SHAPE_TEXT_PADDING,
  SHAPE_TEXT_VERTICAL_PADDING,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
  TextFitMode,
  TextVerticalAlign,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';

import {
  CALL_ACTIVITY_WIDTH,
  END_WIDTH,
  EVENT_END,
  EVENT_START,
  GROUP_RADIUS,
  GROUP_STROKE,
  INNER_FONT_SIZE,
  LABEL_INSET_RATIO,
  LABEL_MIN_FONT_SIZE,
  NEUTRAL_STROKE,
  NODE_FILL,
  NODE_SIZE,
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

/* ── Fitting a label to a box the pack did not choose ─────────────────── */

/** The label typography a foreign box asks for. See {@link bpmnLabelFit}. */
export interface BpmnLabelFit {
  fontSize: number;
  /** `[vertical, horizontal]`, as `ShapeElementModel.padding` is written. */
  padding: [number, number];
  textFitMode: TextFitMode;
}

/**
 * `[w, h]` off a serialized box.
 *
 * A `Bound` and not a hand-rolled `split(',')`: the same deserializer the store
 * reads an element's geometry with, so a box this builder measures and a box
 * the canvas draws can never be two different rectangles.
 */
function boxExtent(xywh: string): [number, number] {
  const bound = Bound.deserialize(xywh);
  return [bound.w, bound.h];
}

/**
 * How big a box is against the pack's own — and `1`, meaning "the pack's own",
 * for an extent that says nothing.
 *
 * A `dc:Bounds` of zeros, of negatives or of `NaN` (which is what a
 * non-numeric attribute parses to) reaches an importer on its first afternoon
 * in the wild. The answer for a box that says nothing is the DRAWN artefact's
 * type, not a shrunken guess at a size nobody gave — and never `NaN`, which is
 * not a number the store can hold.
 */
const ratioOf = (extent: number, standard: number): number =>
  Number.isFinite(extent) && extent > 0 ? extent / standard : 1;

/** One side's margin: the ratio of the extent, never more than the native inset. */
const insetOf = (extent: number, native: number): number =>
  Number.isFinite(extent) && extent > 0
    ? Math.round(Math.min(native, extent * LABEL_INSET_RATIO))
    : native;

/**
 * The typography a label needs to sit INSIDE a box this pack did not choose —
 * which in practice means a box an interchange file chose (`import.ts`).
 *
 * ## Why an imported label misbehaves and a drawn one does not
 *
 * Every value the creation builder writes is calibrated against
 * {@link NODE_SIZE}: an 18-unit font and the shape's native 20-unit horizontal
 * inset are comfortable in a 120-unit task, which is what the palette draws.
 * A file draws to its author's scale, and bpmn.io's normative sizes — the ones
 * nearly every `.bpmn` in the wild carries — are a 100×80 task and a 36-unit
 * event. In a 100-unit task the native inset leaves 60 units of line, which is
 * less than the word "Étudier" is wide at 18 units, so the label breaks in the
 * middle of a word; in a 36-unit event it leaves NEGATIVE room, and the name
 * sprawls across the canvas. Both are issue #184, and neither is reachable from
 * the palette.
 *
 * So the three props that decide how a label sits are derived from the box:
 *
 *  - **`fontSize`** shrinks with the box, proportionally, and never grows past
 *    {@link INNER_FONT_SIZE} — a file that draws BIGGER than this pack gets the
 *    pack's own type, not inflated type — with {@link LABEL_MIN_FONT_SIZE} as
 *    the floor;
 *  - **`padding`** becomes {@link LABEL_INSET_RATIO} of the box, capped at the
 *    shape's native inset, so the margin follows the artefact down instead of
 *    eating it;
 *  - **`textFitMode`** becomes `Contained`, which is the honest statement of
 *    what an imported artefact IS: the file fixed the box — re-exporting a
 *    different one would rewrite the author's diagram — so the TEXT is what
 *    yields. The renderer then shrinks the font further, per frame, whenever a
 *    long name still does not fit.
 *
 * Pure arithmetic on two numbers: no measuring, no canvas, no renderer. The
 * fit does not have to be exact, because `Contained` finishes it at paint time
 * with the real font metrics; what this has to do is stop asking for type the
 * box was never going to hold.
 */
export function bpmnLabelFit(
  kind: BpmnNodeKind,
  w: number,
  h: number
): BpmnLabelFit {
  const size = NODE_SIZE[kind];
  const scale = Math.min(1, ratioOf(w, size.w), ratioOf(h, size.h));
  return {
    fontSize: Math.max(
      LABEL_MIN_FONT_SIZE,
      Math.round(INNER_FONT_SIZE * scale)
    ),
    padding: [
      insetOf(h, SHAPE_TEXT_VERTICAL_PADDING),
      insetOf(w, SHAPE_TEXT_PADDING),
    ],
    textFitMode: TextFitMode.Contained,
  };
}

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
 *
 * `fitLabel` says the box is NOT the pack's own — the caller took it from a
 * file it may not rewrite — so the label is fitted to it
 * ({@link bpmnLabelFit}). It is asked for explicitly rather than inferred from
 * the box's size for two reasons: an importer knows whether it read a
 * `dc:Bounds` and a guess never would, and {@link bpmnMorphProps} calls this
 * builder with a throwaway box whose numbers must not be allowed to mean
 * anything.
 */
export function bpmnNodeProps(
  kind: BpmnNodeKind,
  box: { xywh: string; text?: string; fitLabel?: boolean }
): Record<string, unknown> & { type: string } {
  const preset = NODE_PRESETS[kind];
  // Nothing to fit without a label: an artefact whose name the file left empty
  // stays byte-identical to a drawn one, which is what `presets.ts` is for.
  const fit =
    box.fitLabel && box.text
      ? bpmnLabelFit(kind, ...boxExtent(box.xywh))
      : undefined;
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
    fontSize: fit?.fontSize ?? INNER_FONT_SIZE,
    textAlign: preset.textAlign ?? TextAlign.Center,
    // Spread, never a defaulted key: the model's own default is already
    // `Center`, so writing it here would put a new key in the Y.Map of every
    // artefact that does not ask for one — the same avoidable payload change
    // review caught on `strokeStyle`.
    ...(preset.textVerticalAlign
      ? { textVerticalAlign: preset.textVerticalAlign }
      : {}),
    // BPMN symbols have normative sizes: a long label overflows rather
    // than deforming the node. An imported artefact is the one case where that
    // is not enough — its box is the FILE's and its label is the file's too, so
    // the text is fitted to the box instead of painted past it (#184).
    textFitMode: fit?.textFitMode ?? TextFitMode.Overflow,
    // Spread, never a defaulted key, for the reason `textVerticalAlign` is: a
    // drawn artefact keeps the shape's own inset and puts nothing of its own in
    // the Y.Map.
    ...(fit ? { padding: fit.padding } : {}),
    xywh: box.xywh,
  };
}

/**
 * The box {@link bpmnMorphProps} hands {@link bpmnNodeProps} and then throws
 * away. Never written to a document: a morph keeps the geometry the element
 * already has, and this exists only because the one builder takes a box.
 */
const DISCARDED_BOX = '[0,0,0,0]';

/** What a morph must never rewrite: identity, geometry, and the user's words. */
const NOT_A_MORPH = ['type', 'xywh', 'text'] as const;

/**
 * What a node's kind is worth to an element that ALREADY EXISTS — the same
 * description as {@link bpmnNodeProps}, minus the three things a morph has no
 * business touching.
 *
 * Derived from the creation builder rather than restated beside it, and that is
 * the whole point of the function.
 *
 * ## Why a `{kind, role}` patch is not enough
 *
 * Because the appearance of a BPMN artefact lives in props the CREATING kind's
 * preset wrote, and nothing else ever rewrites them. One shipped morph pair
 * shows it today: `subProcess` and `callActivity` are the same rounded
 * rectangle and differ only in `strokeWidth` — 2 against 4 — and that thick
 * border IS how a reader tells "this box stands for a process defined
 * elsewhere" from "this box stands for one defined inline". Morph between them
 * with two keys and the call activity arrives wearing the sub-process's thin
 * border, which is a drawing that says the wrong thing.
 *
 * Every other family declared in `./morph.ts` currently shares one preset
 * across its members, so for those the full patch changes nothing — and that is
 * the second reason to write it this way rather than to trim it. A family is
 * DATA (`BPMN_MORPH_FAMILIES`) and grows by declaration, with no code change to
 * prompt anyone to ask whether the presets still agree; deriving the patch from
 * the creation builder means the answer is right in advance. It is also what
 * guarantees that a morphed artefact and one drawn fresh from the palette are
 * the same element — two builders would agree the day they were written and
 * drift on the first restyle, which is the argument this file already makes for
 * having one creation builder at all.
 */
export function bpmnMorphProps(kind: BpmnNodeKind): Record<string, unknown> {
  // Widened to the plain record on the way in: `type` is required on what the
  // creation builder returns, and `delete` may only take an optional key.
  const props: Record<string, unknown> = {
    ...bpmnNodeProps(kind, { xywh: DISCARDED_BOX }),
  };
  for (const key of NOT_A_MORPH) delete props[key];
  return props;
}

/**
 * Every key ANY kind's props may carry — the union over the whole pack.
 *
 * Computed rather than listed, so a preset that starts spreading a second
 * conditional key is covered on the day it is added rather than on the day
 * somebody notices.
 */
const EVERY_MORPH_KEY = new Set(
  (Object.keys(NODE_PRESETS) as BpmnNodeKind[]).flatMap(kind =>
    Object.keys(bpmnMorphProps(kind))
  )
);

/**
 * The fields to DELETE from an element after morphing it to `kind` — the keys
 * some other kind writes and this one does not.
 *
 * A patch cannot express absence. `textVerticalAlign` is spread conditionally
 * (see {@link bpmnNodeProps}), so morphing away from the group would leave
 * `Top` sitting in the Y.Map and silently in force over a preset that means
 * "centred". `clearField` removes the key, which is the same call `writeLanes`
 * makes when a pool loses its last lane.
 */
export function bpmnMorphClears(kind: BpmnNodeKind): readonly string[] {
  const present = new Set(Object.keys(bpmnMorphProps(kind)));
  return [...EVERY_MORPH_KEY].filter(key => !present.has(key));
}
