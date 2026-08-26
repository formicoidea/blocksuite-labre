import { DefaultTool } from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import {
  ConnectorMode,
  FontFamily,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  TextFitMode,
} from '@labre/affine-model';
import { EditPropsStore } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';

import {
  END_WIDTH,
  EVENT_END,
  EVENT_START,
  INNER_FONT_SIZE,
  NEUTRAL_STROKE,
  NODE_FILL,
  NODE_LABEL,
  NODE_SIZE,
  NODE_STROKE_WIDTH,
  SEQUENCE_STROKE,
  SEQUENCE_WIDTH,
  START_WIDTH,
  TASK_RADIUS,
} from './consts';
import { BPMN_ROLE, BPMN_ROLE_OF_KIND } from './roles';

/**
 * Standalone creation/activation actions for the BPMN toolbox — lifted out of
 * `toolbar/bpmn-menu.ts` by PF3 so the menu becomes a pure renderer over the
 * command registry. Telemetry is emitted once, by `runCommand`.
 */

export type BpmnNodeKind =
  | 'startEvent'
  | 'endEvent'
  | 'task'
  | 'gatewayExclusive';

/** Per-kind native shape + accent presets (style C). */
const NODE_PRESETS: Record<
  BpmnNodeKind,
  { shapeType: 'ellipse' | 'rect' | 'diamond'; stroke: string; width: number }
> = {
  startEvent: { shapeType: 'ellipse', stroke: EVENT_START, width: START_WIDTH },
  endEvent: { shapeType: 'ellipse', stroke: EVENT_END, width: END_WIDTH },
  task: { shapeType: 'rect', stroke: NEUTRAL_STROKE, width: NODE_STROKE_WIDTH },
  gatewayExclusive: {
    shapeType: 'diamond',
    stroke: NEUTRAL_STROKE,
    width: NODE_STROKE_WIDTH,
  },
};

const gfxOf = (std: BlockStdScope) => std.get(GfxControllerIdentifier);

function finish(gfx: GfxController, id: string) {
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
  // Keep the palette open (native sub-menu behaviour).
}

/** Create a flow-object node (native shape) centred on the viewport. */
export function createBpmnNode(std: BlockStdScope, kind: BpmnNodeKind) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { w, h } = NODE_SIZE[kind];
  const { centerX: cx, centerY: cy } = gfx.viewport;
  const preset = NODE_PRESETS[kind];

  const id = surface.addElement({
    type: 'bpmnNode',
    kind,
    // Semantic identity (B1): posted next to `kind`, which stays untouched and
    // keeps driving the rendering. The role is the authority on what the node
    // MEANS — see the table in `./roles.ts`.
    role: BPMN_ROLE_OF_KIND[kind],
    shapeType: preset.shapeType,
    filled: true,
    fillColor: NODE_FILL,
    strokeColor: preset.stroke,
    strokeWidth: preset.width,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius: kind === 'task' ? TASK_RADIUS : 0,
    text: NODE_LABEL[kind] || undefined,
    color: NEUTRAL_STROKE,
    fontFamily: FontFamily.Inter,
    fontSize: INNER_FONT_SIZE,
    textAlign: 'center',
    // BPMN symbols have normative sizes: a long label overflows rather
    // than deforming the node
    textFitMode: TextFitMode.Overflow,
    xywh: new Bound(cx - w / 2, cy - h / 2, w, h).serialize(),
  });
  finish(gfx, id);
}

/** Create a pool (background container) centred on the viewport. */
export function createBpmnPool(std: BlockStdScope) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const w = 560;
  const h = 200;
  const { centerX: cx, centerY: cy } = gfx.viewport;
  const id = surface.addElement({
    type: 'bpmnPool',
    // The FRAME the flow objects are drawn in, and a role of its own: a rule
    // written on the artefacts must never fall on the lane that holds them.
    role: BPMN_ROLE.pool,
    xywh: new Bound(cx - w / 2, cy - h / 2, w, h).serialize(),
  });
  finish(gfx, id);
}

/**
 * Arm the native connector tool, pre-styled for a BPMN sequence flow:
 * orthogonal, solid, with a filled triangle head. The user then draws from
 * one node to another (endpoints attach to centers).
 */
export function activateBpmnSequenceFlow(std: BlockStdScope) {
  std.get(EditPropsStore).recordLastProps('connector', {
    mode: ConnectorMode.Orthogonal,
    stroke: SEQUENCE_STROKE,
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: SEQUENCE_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Triangle,
  });
  gfxOf(std).tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Orthogonal,
    // A TYPED edge (`docs/adr/0010`): the arrow the user is about to draw says
    // "is followed by", so its source is what happens first. The tool carries
    // the role so the connector is born with it rather than acquiring one
    // afterwards.
    role: BPMN_ROLE.sequenceFlow,
  });
  // Keep the palette open (native sub-menu behaviour).
}
