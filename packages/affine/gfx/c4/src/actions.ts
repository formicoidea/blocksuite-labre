import { DefaultTool } from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import { createAutoLegend } from '@labre/affine-gfx-ddd-shared';
import {
  C4BoardElementModel,
  type C4BoundaryVariant,
  type C4NodeKind,
  ConnectorMode,
  FontFamily,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
  TextFitMode,
} from '@labre/affine-model';
import { EditPropsStore } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';

import {
  BOARD_REF_HEIGHT,
  BOARD_REF_WIDTH,
  BOUNDARY_LABEL,
  BOUNDARY_REF_HEIGHT,
  BOUNDARY_REF_WIDTH,
  INNER_FONT_SIZE,
  NODE_LABEL,
  NODE_PALETTE,
  NODE_RADIUS,
  NODE_SIZE,
  NODE_STROKE_WIDTH,
  RELATIONSHIP_STROKE,
  RELATIONSHIP_WIDTH,
} from './consts';
import { C4_AUTO_LEGEND } from './legend';
import { C4_ROLE, C4_ROLE_OF_KIND } from './roles';

/**
 * Standalone creation/activation actions for the C4 toolbox — the same shape
 * BPMN's `actions.ts` has, and for the same reason: the menu is a pure renderer
 * over the command registry, so what a button DOES lives here and telemetry is
 * emitted once, by `runCommand`.
 */

/**
 * The kinds whose GLYPH draws the body, so the native shape underneath paints
 * nothing at all.
 *
 * Three of nine, and the renderer is the authority on which — a person is a head
 * over a rounded block and a database is a cylinder, neither of which a native
 * rect can be. `mobile` and `browser` are deliberately NOT here: their bezel and
 * their chrome band are painted OVER a native body, so the box under them is a
 * real filled rectangle. Same call BPMN makes for `dataObject` / `dataStore`.
 */
const GLYPH_BODY_KINDS: ReadonlySet<C4NodeKind> = new Set<C4NodeKind>([
  'person',
  'person-ext',
  'database',
]);

const gfxOf = (std: BlockStdScope) => std.get(GfxControllerIdentifier);

function finish(gfx: GfxController, id: string) {
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
  // Keep the palette open (native sub-menu behaviour).
}

/** Create a C4 element (native shape) centred on the viewport. */
export function createC4Node(std: BlockStdScope, kind: C4NodeKind) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { w, h } = NODE_SIZE[kind];
  const { centerX: cx, centerY: cy } = gfx.viewport;
  const paint = NODE_PALETTE[kind];
  const glyphBody = GLYPH_BODY_KINDS.has(kind);

  const id = surface.addElement({
    type: 'c4Node',
    kind,
    // Semantic identity, posted next to `kind` — which stays untouched and keeps
    // driving the rendering. The role is the authority on what the box MEANS,
    // and it is the only thing that can say so: three of the four levels are the
    // same rounded rectangle (see `./roles.ts`).
    role: C4_ROLE_OF_KIND[kind],
    shapeType: 'rect',
    // A glyph-bodied kind paints nothing natively: the head, the block and the
    // cylinder are drawn by the renderer, which reads `fillColor` /
    // `strokeColor` off this same model — so both stay editable from the shape
    // toolbar exactly like every other node's.
    filled: !glyphBody,
    fillColor: paint.fill,
    strokeColor: paint.border,
    strokeWidth: NODE_STROKE_WIDTH,
    strokeStyle: glyphBody ? StrokeStyle.None : StrokeStyle.Solid,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    // The rounded corner of the stencil's boxes. Harmless on a glyph-bodied
    // kind, whose native shape is invisible.
    radius: NODE_RADIUS,
    // Every kind carries words, unlike BPMN: the box is the same box at three of
    // the four levels, so a C4 element with nothing written in it says nothing.
    text: NODE_LABEL[kind],
    color: paint.text,
    fontFamily: FontFamily.Inter,
    fontSize: INNER_FONT_SIZE,
    textAlign: TextAlign.Center,
    // The stencil's sizes are normative: a long name overflows rather than
    // deforming the element out of its row.
    textFitMode: TextFitMode.Overflow,
    xywh: new Bound(cx - w / 2, cy - h / 2, w, h).serialize(),
  });
  finish(gfx, id);
}

/** Create a C4 board (the sheet one diagram is drawn on) centred on the viewport. */
export function createC4Board(std: BlockStdScope) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;
  const id = surface.addElement({
    type: 'c4Board',
    // The FRAME the elements are drawn on, and a role of its own: a rule written
    // on the artefacts must never fall on the sheet holding them.
    role: C4_ROLE.board,
    xywh: new Bound(
      cx - BOARD_REF_WIDTH / 2,
      cy - BOARD_REF_HEIGHT / 2,
      BOARD_REF_WIDTH,
      BOARD_REF_HEIGHT
    ).serialize(),
  });
  finish(gfx, id);
}

/**
 * Create a C4 boundary centred on the viewport.
 *
 * The variant is WRITTEN on the element and it also decides the default name:
 * the two boundaries are the same dashed rectangle, and C4 tells them apart by
 * what is written under the corner ({@link BOUNDARY_LABEL}, and the note on
 * `variantProp` in `background.ts`). The name is document data from that moment
 * on — renaming a boundary never contradicts its variant.
 */
export function createC4Boundary(
  std: BlockStdScope,
  variant: C4BoundaryVariant
) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;
  const id = surface.addElement({
    type: 'c4Boundary',
    role: C4_ROLE.boundary,
    name: BOUNDARY_LABEL[variant],
    variant,
    xywh: new Bound(
      cx - BOUNDARY_REF_WIDTH / 2,
      cy - BOUNDARY_REF_HEIGHT / 2,
      BOUNDARY_REF_WIDTH,
      BOUNDARY_REF_HEIGHT
    ).serialize(),
  });
  finish(gfx, id);
}

/**
 * Arm the native connector tool, pre-styled for a C4 relationship: STRAIGHT,
 * DASHED, grey, with a filled triangle head.
 *
 * Three deliberate choices, and all three are the stencil's:
 *
 *  - **dashed**, where BPMN's sequence flow is solid. Every line on a C4 diagram
 *    is a relationship, so the dash is not a distinction between two kinds of
 *    line but the house style of the one kind there is;
 *  - **straight**, where BPMN routes orthogonally. A C4 diagram is a graph, not
 *    a process laid out in lanes: the elbows a router adds would read as a route
 *    through the diagram that nobody drew;
 *  - **a filled head**, because the relationship is directed and says so — the
 *    verb is "uses", the source is the element with the need.
 *
 * The role is carried by the TOOL, so the connector is born with it rather than
 * acquiring one afterwards (`docs/adr/0010`).
 */
export function activateC4Relationship(std: BlockStdScope) {
  std.get(EditPropsStore).recordLastProps('connector', {
    mode: ConnectorMode.Straight,
    stroke: RELATIONSHIP_STROKE,
    strokeStyle: StrokeStyle.Dash,
    strokeWidth: RELATIONSHIP_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Triangle,
  });
  gfxOf(std).tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Straight,
    role: C4_ROLE.relationship,
  });
  // Keep the palette open (native sub-menu behaviour).
}

/* ── The legend ────────────────────────────────────────────────────────── */

/**
 * The boards of the current selection.
 *
 * No read-only filter and no lock filter, the same call `bpmnPoolsSelected`
 * makes for the export: generating a legend WRITES, so unlike that one it is
 * offered only on an editable document — which is why the read-only test is
 * here rather than delegated to the caller.
 */
export function c4BoardsSelected(std: BlockStdScope): C4BoardElementModel[] {
  if (std.store.readonly) return [];
  return gfxOf(std).selection.selectedElements.filter(
    (model): model is C4BoardElementModel =>
      model instanceof C4BoardElementModel
  );
}

/**
 * Draw the legend of what is actually on the selected board, bottom-left of it.
 *
 * The FIRST selected board and no other: a legend is placed relative to one
 * background, and two of them would put two boxes on top of whatever sits in
 * that corner. Everything about the gesture — the scan, the placement, the box —
 * is `createAutoLegend`'s; C4 contributes {@link C4_AUTO_LEGEND}, a table.
 *
 * The one action in this file with no command behind it: the legend is reached
 * from the selected board's contextual toolbar and from nowhere else (PO
 * arbitration, 27/08/2026 — see `toolbar/config.ts`). Kept here beside its
 * siblings all the same, because it is the same kind of thing — a gesture that
 * writes elements — and because a unit test can drive it without a toolbar.
 */
export function createC4Legend(std: BlockStdScope): void {
  const board = c4BoardsSelected(std)[0];
  if (!board) return;
  createAutoLegend(std, board, C4_AUTO_LEGEND);
}
