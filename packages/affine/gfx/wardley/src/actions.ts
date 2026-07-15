import { DefaultTool } from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import { createGroupCommand } from '@labre/affine-gfx-group';
import {
  ConnectorMode,
  FontFamily,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  type WardleyBgVariant,
} from '@labre/affine-model';
import {
  EditPropsStore,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { GfxController } from '@labre/std/gfx';

import { REF_WIDTH } from './consts';
import {
  ECOSYSTEM_LABEL,
  ECOSYSTEM_SIZE,
  HANDLE_SIZE,
  INERTIA_COLOR,
  INERTIA_SIZE,
  LABEL_DEFAULT,
  LABEL_FONT_SIZE,
  LABEL_GAP,
  LINK_GREY,
  LINK_STROKE_WIDTH,
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
  WARDLEY_RED,
} from './node/consts';

/**
 * Standalone creation/activation actions for the Wardley toolbox. They are
 * invoked from both the toolbar menu ({@link EdgelessWardleyMenu}) and the
 * wardley keyboard shortcuts, so they only depend on the {@link GfxController}.
 */

/** Where the action was triggered from — feeds the telemetry payload. */
export interface WardleyActionSource {
  segment: string;
  module: string;
}

const TOOLBOX_SOURCE: WardleyActionSource = {
  segment: 'wardley toolbox',
  module: 'wardley menu',
};

export const WARDLEY_SHORTCUT_SOURCE: WardleyActionSource = {
  segment: 'wardley toolbox',
  module: 'keyboard shortcut',
};

/**
 * Per-variant default label overrides applied at creation (all remain editable
 * afterwards via the inline editor / toggles). The gradient itself is driven by
 * `variant` in the renderer.
 */
const BACKGROUND_VARIANT_DEFAULTS: Record<
  WardleyBgVariant,
  Record<string, unknown>
> = {
  classic: {},
  // The Y axis becomes "Opportunity"; phase labels keep the classic defaults.
  opportunity: {
    yAxisTitle: 'Opportunity',
    showVisibilityLabels: false,
    showCornerLabels: false,
  },
  // The Y axis splits into Benefit (top) / Investment (bottom) around a zero
  // line drawn by the renderer.
  benefit: {
    yAxisTitle: '',
    visibilityHigh: 'Benefit',
    visibilityLow: 'Investment',
    showCornerLabels: false,
  },
  // Keeps the classic labels (Value Chain / Uncharted / Industrialized…); only
  // the grey gradient differs.
  'evolution-gradient': {},
};

type Surface = NonNullable<GfxController['surface']>;

/** Height of the native free-text labels (Inter, size 18). */
const LABEL_H = LABEL_FONT_SIZE + 8;

/**
 * The single-circle node flavours: one connectable ellipse + a label to its
 * right, grouped. The glyph itself (anchor silhouette, ecosystem hatching,
 * method inner circle) is drawn by the node renderer from `kind`.
 */
const NODE_PRESETS = {
  component: { d: NODE_SIZE, fill: NODE_FILL, label: LABEL_DEFAULT.component },
  anchor: { d: NODE_SIZE, fill: NODE_FILL, label: LABEL_DEFAULT.anchor },
  // Ecosystem: glyph = double border + hatched donut; connectors attach to
  // this outer circle's center.
  ecosystem: { d: ECOSYSTEM_SIZE, fill: NODE_FILL, label: ECOSYSTEM_LABEL },
  // Method: the FILL color encodes the chosen method (editable).
  method: { d: METHOD_SIZE, fill: METHOD_FILL, label: METHOD_LABEL },
} as const;

export type WardleyNodeKind = keyof typeof NODE_PRESETS;

function track(
  gfx: GfxController,
  source: WardleyActionSource,
  event: 'FrameworkElementAdded' | 'FrameworkToolPicked',
  element: string
) {
  gfx.std.getOptional(TelemetryProvider)?.track(event, {
    framework: 'wardley',
    element,
    page: 'whiteboard editor',
    ...source,
  });
}

function finish(gfx: GfxController, id: string) {
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
  // The wardley palette stays open (native sub-menu behaviour) so several
  // Wardley objects can be added in a row; the canvas stays selectable.
}

/** Group elements; returns the group id (or the first id if grouping failed). */
function group(gfx: GfxController, ids: string[]) {
  const [, result] = gfx.std.command.exec(createGroupCommand, {
    elements: ids,
  });
  return result.groupId || ids[0];
}

/** Add a native ellipse wardley node centred on (cx, cy). */
function addEllipseNode(
  surface: Surface,
  kind: WardleyNodeKind | 'market',
  cx: number,
  cy: number,
  d: number,
  fillColor: string,
  strokeWidth = NODE_STROKE_WIDTH
) {
  return surface.addElement({
    type: 'wardleyNode',
    kind,
    shapeType: 'ellipse',
    filled: true,
    fillColor,
    strokeColor: NODE_STROKE,
    strokeWidth,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    xywh: new Bound(cx - d / 2, cy - d / 2, d, d).serialize(),
  });
}

/** Add a native free-text label (same Inter family as the axis labels). */
function addLabel(
  surface: Surface,
  text: string,
  x: number,
  y: number,
  textAlign: 'left' | 'center' = 'left'
) {
  return surface.addElement({
    type: 'text',
    text,
    fontFamily: FontFamily.Inter,
    fontSize: LABEL_FONT_SIZE,
    color: NODE_STROKE,
    textAlign,
    xywh: new Bound(x, y, 120, LABEL_H).serialize(),
  });
}

/** Create a wardley map background of the given variant, viewport-centered. */
export function createWardleyBackground(
  gfx: GfxController,
  variant: WardleyBgVariant = 'classic',
  source: WardleyActionSource = TOOLBOX_SOURCE
) {
  if (!gfx.surface) return;

  let width = REF_WIDTH;
  for (const el of gfx.surface.getElementsByType('wardley')) {
    const [, , ew, eh] = el.deserializedXYWH;
    width = Math.max(width, ew, (eh * 16) / 9);
  }
  const height = (width * 9) / 16;

  const { centerX, centerY } = gfx.viewport;
  const id = gfx.surface.addElement({
    type: 'wardley',
    variant,
    ...BACKGROUND_VARIANT_DEFAULTS[variant],
    xywh: new Bound(
      centerX - width / 2,
      centerY - height / 2,
      width,
      height
    ).serialize(),
  });
  track(gfx, source, 'FrameworkElementAdded', `background:${variant}`);
  finish(gfx, id);
}

/**
 * Create a single-circle node (component / anchor / ecosystem / method):
 * one connectable native ellipse + a label to its right, grouped so they
 * move together (enter the group to reposition / edit the label).
 */
export function createWardleyNode(
  gfx: GfxController,
  kind: WardleyNodeKind,
  source: WardleyActionSource = TOOLBOX_SOURCE
) {
  const surface = gfx.surface;
  if (!surface) return;

  const { d, fill, label } = NODE_PRESETS[kind];
  const { centerX: cx, centerY: cy } = gfx.viewport;

  const nodeId = addEllipseNode(surface, kind, cx, cy, d, fill);
  const labelId = addLabel(
    surface,
    label,
    cx + d / 2 + LABEL_GAP,
    cy - LABEL_H / 2
  );

  track(gfx, source, 'FrameworkElementAdded', `node:${kind}`);
  finish(gfx, group(gfx, [nodeId, labelId]));
}

/** Create an inertia bar (filled black rect). */
export function createWardleyInertia(
  gfx: GfxController,
  source: WardleyActionSource = TOOLBOX_SOURCE
) {
  if (!gfx.surface) return;

  const { w, h } = INERTIA_SIZE;
  const { centerX, centerY } = gfx.viewport;
  const id = gfx.surface.addElement({
    type: 'shape',
    shapeType: 'rect',
    filled: true,
    fillColor: INERTIA_COLOR,
    strokeColor: INERTIA_COLOR,
    strokeWidth: 0,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius: 0,
    xywh: new Bound(centerX - w / 2, centerY - h / 2, w, h).serialize(),
  });
  track(gfx, source, 'FrameworkElementAdded', 'node:inertia');
  finish(gfx, id);
}

/**
 * Create a pipeline: a wide thin native rect body (white semi-transparent,
 * NON-connectable) + a node-sized square handle straddling its top edge (the
 * only connection point, center anchor) + a native text label. The handle and
 * label are grouped, then grouped again with the body so the whole pipeline
 * moves as one. Pure composition of native elements — no custom type / view.
 */
export function createWardleyPipeline(
  gfx: GfxController,
  source: WardleyActionSource = TOOLBOX_SOURCE
) {
  if (!gfx.surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;
  const W = PIPELINE_WIDTH;
  const H = PIPELINE_HEIGHT;
  const d = HANDLE_SIZE;
  const top = cy - H / 2;

  // Body: a WardleyNode rect, made non-connectable by `kind: 'pipeline'`.
  const bodyId = gfx.surface.addElement({
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
    xywh: new Bound(cx - W / 2, top, W, H).serialize(),
  });

  // Handle: a node-sized WardleyNode square straddling the top edge. Inherits
  // `centerAnchorOnly` so connectors attach to its center only.
  const handleId = gfx.surface.addElement({
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
    xywh: new Bound(cx - d / 2, top - d / 2, d, d).serialize(),
  });

  // Label centered horizontally on the pipeline, sitting ABOVE the handle.
  const labelId = addLabel(
    gfx.surface,
    PIPELINE_LABEL,
    cx - 60,
    top - d / 2 - LABEL_H - LABEL_GAP,
    'center'
  );

  // Nested groups: (handle + label), then (body + that group).
  const innerId = group(gfx, [handleId, labelId]);
  track(gfx, source, 'FrameworkElementAdded', 'node:pipeline');
  finish(gfx, group(gfx, [bodyId, innerId]));
}

/**
 * Create a market: a large thin-bordered circle (the connectable market node)
 * containing 3 small thick-bordered component nodes wired into a triangle by
 * native attached connectors (thin, dark, no arrows — they auto-route between
 * the node centers and follow on move/resize). A label sits to the right and
 * everything is grouped into one object.
 */
export function createWardleyMarket(
  gfx: GfxController,
  source: WardleyActionSource = TOOLBOX_SOURCE
) {
  const surface = gfx.surface;
  if (!surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;
  const R = MARKET_SIZE / 2;
  const rho = MARKET_DOT_RING;
  const sin60 = Math.sqrt(3) / 2;

  // Outer circle = the market node (connectable, center-only).
  const circleId = addEllipseNode(surface, 'market', cx, cy, MARKET_SIZE, NODE_FILL);

  // 3 inner component nodes (thick border, no label) at the triangle vertices.
  const verts = [
    [0, -rho],
    [rho * sin60, rho / 2],
    [-rho * sin60, rho / 2],
  ];
  const dotIds = verts.map(([vx, vy]) =>
    addEllipseNode(
      surface,
      'component',
      cx + vx,
      cy + vy,
      MARKET_DOT_SIZE,
      NODE_FILL,
      MARKET_DOT_STROKE_WIDTH
    )
  );

  // Triangle: 3 attached connectors (auto-route center-to-center, clipped).
  const connIds = [
    [dotIds[0], dotIds[1]],
    [dotIds[1], dotIds[2]],
    [dotIds[2], dotIds[0]],
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

  const labelId = addLabel(surface, MARKET_LABEL, cx + R + LABEL_GAP, cy - LABEL_H / 2);

  track(gfx, source, 'FrameworkElementAdded', 'node:market');
  finish(gfx, group(gfx, [circleId, ...dotIds, ...connIds, labelId]));
}

/**
 * Activate the native connector tool, pre-styled for a Wardley link (grey,
 * solid, no arrow) or evolution arrow (red, dashed, FILLED triangle). The
 * user then draws from one node to another (endpoints attach to centers).
 */
export function activateWardleyConnector(
  gfx: GfxController,
  kind: 'link' | 'arrow',
  source: WardleyActionSource = TOOLBOX_SOURCE
) {
  const props =
    kind === 'arrow'
      ? {
          mode: ConnectorMode.Straight,
          stroke: WARDLEY_RED,
          strokeStyle: StrokeStyle.Dash,
          strokeWidth: LINK_STROKE_WIDTH,
          frontEndpointStyle: PointStyle.None,
          rearEndpointStyle: PointStyle.Triangle,
        }
      : {
          mode: ConnectorMode.Straight,
          stroke: LINK_GREY,
          strokeStyle: StrokeStyle.Solid,
          strokeWidth: LINK_STROKE_WIDTH,
          frontEndpointStyle: PointStyle.None,
          rearEndpointStyle: PointStyle.None,
        };
  gfx.std.get(EditPropsStore).recordLastProps('connector', props);
  track(gfx, source, 'FrameworkToolPicked', `connector:${kind}`);
  gfx.tool.setTool(ConnectorTool, { mode: ConnectorMode.Straight });
  // The wardley palette stays open (native sub-menu behaviour): it only
  // closes on re-click of the senior button, another senior tool, or Escape.
}
