import { DefaultTool } from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import { createGroupCommand } from '@labre/affine-gfx-group';
import { createTemplateJob } from '@labre/affine-gfx-template';
import {
  ConnectorMode,
  FontFamily,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
} from '@labre/affine-model';
import { EditPropsStore } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';

import { CROP_LABELED } from './consts';
import {
  ACTIVITY_VERTICES,
  INNER_FONT_SIZE,
  LABEL_FONT_SIZE,
  LABEL_GAP,
  NODE_FILL,
  NODE_LABEL,
  NODE_SIZE,
  NODE_STROKE,
  NODE_STROKE_WIDTH,
  OUTCOME_RADIUS,
} from './node/consts';
import { EDGY_ROLE } from './roles';
import { edgyDynamicTemplate } from './templates';

/** Stroke width the 24 template relations are drawn with. */
const RELATION_STROKE_WIDTH = 2;

/**
 * Standalone creation actions for the EDGY toolbox — the behaviour layer,
 * lifted out of `toolbar/edgy-menu.ts` by PF3 so the menu can become a pure
 * renderer over the command registry. They emit no telemetry: the single
 * emission point is `runCommand` (`docs/adr/0008`).
 */

type Surface = NonNullable<GfxController['surface']>;
export type EdgyBoxKind = 'outcome' | 'object' | 'activity';

/** Default facets-diagram size (REF aspect, scaled up so it reads on canvas). */
const FACETS_SCALE = 1.5;

/** Default blank-board size. */
const BOARD_W = 1600;
const BOARD_H = 1000;

/** Height of the native People free-text label. */
const LABEL_H = LABEL_FONT_SIZE + 8;

const gfxOf = (std: BlockStdScope) => std.get(GfxControllerIdentifier);

function finish(gfx: GfxController, id: string) {
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
  // Keep the palette open (native sub-menu behaviour).
}

/**
 * Shared props for an EDGY node shape.
 *
 * The `role` is the PERSISTED KIND and nothing more: somebody picking "Object"
 * in the palette has said "this is an object", not "this is a Channel". The
 * twelve official elements are named by the metamodel template, which knows
 * which of them it is drawing; a base element created here specialises
 * `edgy:element` through its kind and is judged by every rule written on the
 * root — the overlap rule — and by none written on a leaf.
 */
const baseShapeProps = (kind: EdgyBoxKind | 'people') => ({
  type: 'edgyNode' as const,
  kind,
  role: EDGY_ROLE[kind],
  filled: true,
  fillColor: NODE_FILL,
  strokeColor: NODE_STROKE,
  shapeStyle: ShapeStyle.General,
  roughness: 0,
});

/** Add a native free-text label (Inter), used for the People node. */
function addLabel(surface: Surface, text: string, x: number, y: number) {
  return surface.addElement({
    type: 'text',
    text,
    fontFamily: FontFamily.Inter,
    fontSize: LABEL_FONT_SIZE,
    color: NODE_STROKE,
    textAlign: 'center',
    xywh: new Bound(x, y, 120, LABEL_H).serialize(),
  });
}

/**
 * Create the Enterprise Design Facets diagram centred on the viewport —
 * cropped to the circles + facet labels (no dead margins around the Venn).
 */
export function createEdgyFacets(std: BlockStdScope) {
  const gfx = gfxOf(std);
  if (!gfx.surface) return;

  const width = CROP_LABELED.w * FACETS_SCALE;
  const height = CROP_LABELED.h * FACETS_SCALE;
  const { centerX, centerY } = gfx.viewport;
  const id = gfx.surface.addElement({
    type: 'edgy',
    cropToCircles: true,
    // The frame: what makes this an EDGY board rather than three circles, and
    // what a finding is attributed to.
    role: EDGY_ROLE.facets,
    xywh: new Bound(
      centerX - width / 2,
      centerY - height / 2,
      width,
      height
    ).serialize(),
  });
  finish(gfx, id);
}

/**
 * Insert the "EDGY dynamic" template (facets background + the 12 elements
 * linked by the 24 verbalised relations), then bring it into view.
 */
export async function createEdgyDynamic(std: BlockStdScope) {
  const gfx = gfxOf(std);
  if (!gfx.surface) return;

  const job = createTemplateJob(std, 'template');
  const bound = await job.insertTemplate(
    structuredClone(edgyDynamicTemplate.content)
  );
  if (bound) {
    const padding = 20 / gfx.viewport.zoom;
    gfx.viewport.setViewportByBound(
      bound,
      [padding, padding, padding, padding],
      true
    );
  }
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
}

/** Create a blank EDGY board (hover spotlight host) centred on the viewport. */
export function createEdgyBoard(std: BlockStdScope) {
  const gfx = gfxOf(std);
  if (!gfx.surface) return;

  const { centerX, centerY } = gfx.viewport;
  const id = gfx.surface.addElement({
    type: 'edgyBoard',
    // The blank board is a frame too: the same rules apply to what is drawn on
    // it, and the same map-wide arbitration has to have somewhere to live.
    role: EDGY_ROLE.board,
    xywh: new Bound(
      centerX - BOARD_W / 2,
      centerY - BOARD_H / 2,
      BOARD_W,
      BOARD_H
    ).serialize(),
  });
  finish(gfx, id);
}

/** Create a box base element (outcome / object / activity) with inner text. */
export function createEdgyBox(std: BlockStdScope, kind: EdgyBoxKind) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { w, h } = NODE_SIZE[kind];
  const { centerX: cx, centerY: cy } = gfx.viewport;
  const shapeType = kind === 'activity' ? 'polygon' : 'rect';

  const id = surface.addElement({
    ...baseShapeProps(kind),
    shapeType,
    strokeWidth: NODE_STROKE_WIDTH,
    radius: kind === 'outcome' ? OUTCOME_RADIUS : 0,
    vertices: kind === 'activity' ? ACTIVITY_VERTICES : null,
    text: NODE_LABEL[kind],
    color: NODE_STROKE,
    fontFamily: FontFamily.Inter,
    fontSize: INNER_FONT_SIZE,
    textAlign: 'center',
    xywh: new Bound(cx - w / 2, cy - h / 2, w, h).serialize(),
  });
  finish(gfx, id);
}

/**
 * Create the People base element: an (invisible) ellipse decorated with the
 * person glyph by the renderer, plus a native text label below, grouped.
 */
export function createEdgyPeople(std: BlockStdScope) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { w, h } = NODE_SIZE.people;
  const { centerX: cx, centerY: cy } = gfx.viewport;

  const nodeId = surface.addElement({
    ...baseShapeProps('people'),
    shapeType: 'ellipse',
    // No visible outline — People is just the glyph; the ellipse is the bound.
    strokeWidth: 0,
    xywh: new Bound(cx - w / 2, cy - h / 2, w, h).serialize(),
  });
  const labelId = addLabel(
    surface,
    NODE_LABEL.people,
    cx - 60,
    cy + h / 2 + LABEL_GAP
  );

  const [, result] = std.command.exec(createGroupCommand, {
    elements: [nodeId, labelId],
  });
  finish(gfx, result.groupId || nodeId);
}

/**
 * Activate the native connector tool for an EDGY RELATION: pre-styled like the
 * 24 links of the metamodel template, and stamped with the GENERIC role
 * `edgy:relation`.
 *
 * Generic on purpose, and this is the whole design (`./relation.ts`): the verb
 * of an EDGY relation is determined by the ordered pair of elements it runs
 * between — 24 rows, 24 distinct pairs — so there is nothing to ask the user
 * and nothing to pick from a list of twenty-two. The tool arms the parent role,
 * the user drags from the subject to the object, and `EdgyRelationResolver`
 * writes the verb the metamodel gives that pair, as a role and as the label.
 *
 * The style is the template's, to the pixel: straight, `NODE_STROKE`, two units
 * wide, and NO arrowhead at either end — EDGY's reference diagram draws its
 * relations as bare lines and lets the verb say which way the sentence runs.
 */
export function activateEdgyRelation(gfx: GfxController): void {
  gfx.std.get(EditPropsStore).recordLastProps('connector', {
    mode: ConnectorMode.Straight,
    stroke: NODE_STROKE,
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: RELATION_STROKE_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.None,
  });
  gfx.tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Straight,
    role: EDGY_ROLE.relation,
  });
  // Keep the palette open (native sub-menu behaviour): it only closes on
  // re-click of the senior button, another senior tool, or Escape.
}
