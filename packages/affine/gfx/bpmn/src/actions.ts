import {
  DefaultTool,
  EdgelessCRUDIdentifier,
  generateElementId,
} from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import {
  type BpmnLane,
  BpmnPoolElementModel,
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

/* ── Lanes (couloirs) ─────────────────────────────────────────────────── */

/**
 * The lanes a pool carries, as an array that is safe to read.
 *
 * The value comes out of a Y.Map, so it is whatever a peer wrote: a client that
 * got it wrong must not break the gesture on this one. Same defensive read the
 * validation engine does on `validationExceptions`, for the same reason.
 */
export function bpmnLanesOf(model: BpmnPoolElementModel): readonly BpmnLane[] {
  const stored = model.lanes;
  return Array.isArray(stored) ? stored : [];
}

/**
 * The pools a lane gesture acts on: every pool of the current selection that is
 * not locked.
 *
 * EVERY one, not the single one — `some`, not `every`, in the same spirit as
 * the typed-edge inversion (`docs/adr/0010` M3): lassoing two pools used to be
 * a way to lose an affordance, and a gesture that says what it did on each of
 * them beats an entry that vanishes. With one pool selected — the ordinary
 * case, and the only one the toolbar offers — it is exactly "the selected pool".
 */
export function bpmnPoolsForLaneEdit(
  std: BlockStdScope
): BpmnPoolElementModel[] {
  if (std.store.readonly) return [];
  return gfxOf(std)
    .selection.selectedElements.filter(
      (model): model is BpmnPoolElementModel =>
        model instanceof BpmnPoolElementModel
    )
    .filter(model => !model.isLocked());
}

/**
 * Write a pool's lane list back, or REMOVE the prop when there is none left.
 *
 * The second half is what keeps the "nothing is written until the first lane"
 * promise reversible: assigning `undefined` through the accessor would leave
 * the key in the Y.Map holding an undefined value — invisible through the
 * getter, but synced to every peer and shipped in every snapshot. A pool whose
 * last lane is removed goes back to its pre-lane bytes.
 */
function writeLanes(
  std: BlockStdScope,
  model: BpmnPoolElementModel,
  lanes: readonly BpmnLane[]
): void {
  if (lanes.length === 0) {
    model.clearField('lanes');
    return;
  }
  std.get(EdgelessCRUDIdentifier).updateElement(model.id, {
    lanes: [...lanes],
  });
}

/**
 * Append a lane to every selected pool.
 *
 * ## One lane, not two
 *
 * Adding the FIRST lane creates ONE lane, covering the whole pool. Seeding two
 * would invent a subdivision the user did not ask for and then make them delete
 * half of it. One lane is the honest reading of "add a lane": the pool now has
 * a lane, it happens to be all of it, and the second click gives them the
 * second one.
 *
 * Since the lane title band (PO recette, 2026-08-26) that first click is also
 * VISIBLE: a named strip appears down the leading edge of a pool that had none.
 * Before it, a single lane was indistinguishable from no lane at all, and the
 * gesture looked broken until the second click.
 *
 * ## `Lane N` is DOCUMENT DATA, not vocabulary
 *
 * The default name is a plain persisted string, exactly like the pool's own
 * `'Pool'` default: it is written into the document by this action and is the
 * user's to rewrite from that moment on. It is deliberately NOT a `labelKey`
 * through the translation seam — a host that ships a French catalogue must not
 * silently retitle a lane an author named, and a name that changed language
 * when the reader's locale did would be a document that says different things
 * to different people. `N` is the count AFTER this lane, so the first is
 * `Lane 1`.
 */
export function addBpmnLane(std: BlockStdScope): void {
  const pools = bpmnPoolsForLaneEdit(std);
  if (pools.length === 0) return;

  // Before the writes: `Store.transact` is not an undo boundary, and one
  // capture for the whole gesture is what makes several pools take their lane
  // in a single undo step.
  std.store.captureSync();

  for (const model of pools) {
    const lanes = bpmnLanesOf(model);
    // The new lane takes an equal share: the average of what is already there
    // is the weight that leaves every existing lane the same size relative to
    // its neighbours, and gives the newcomer the room a typical one has. `1`
    // for the first, where there is no average and the unit is arbitrary.
    const size = lanes.length
      ? lanes.reduce((sum, lane) => sum + lane.size, 0) / lanes.length
      : 1;
    writeLanes(std, model, [
      ...lanes,
      { id: generateElementId(), name: `Lane ${lanes.length + 1}`, size },
    ]);
  }
}

/**
 * Remove the LAST lane of every selected pool.
 *
 * The last one and not the selected one, because a lane is not selectable: it
 * is a slice of the pool's plot, painted by the background primitive, with no
 * element of its own. Removing from the end is the gesture that undoes the one
 * that added it.
 *
 * ## Nothing moves
 *
 * Elements sitting in the removed lane do NOT move. Containment here is
 * geometric — a task is "in" a lane because its centre falls in that rectangle,
 * which is how the audit reports it — so the lane below simply grows over them
 * and they are in that one now. Nothing on the canvas jumps under the user's
 * hand, and the sequence flow they drew still lands where they drew it.
 */
export function removeBpmnLane(std: BlockStdScope): void {
  const pools = bpmnPoolsForLaneEdit(std);
  if (pools.length === 0) return;

  const withLanes = pools.filter(model => bpmnLanesOf(model).length > 0);
  if (withLanes.length === 0) return;

  std.store.captureSync();
  for (const model of withLanes) {
    writeLanes(std, model, bpmnLanesOf(model).slice(0, -1));
  }
}

/**
 * Rename one lane of one pool. Called by the in-place editor
 * (`element-view.ts`); exported so a unit test can assert the write without an
 * editor around it.
 *
 * An empty name REMOVES the key rather than storing `''`: the renderer already
 * treats both as "no name", and one of the two would be a second way to say the
 * same thing that only the bytes can tell apart.
 */
export function renameBpmnLane(
  std: BlockStdScope,
  model: BpmnPoolElementModel,
  index: number,
  name: string
): void {
  const lanes = bpmnLanesOf(model);
  const lane = lanes[index];
  if (!lane) return;

  const trimmed = name.trim();
  if ((lane.name ?? '') === trimmed) return;

  const next = lanes.map((entry, i) =>
    i === index
      ? {
          id: entry.id,
          ...(trimmed ? { name: trimmed } : {}),
          size: entry.size,
        }
      : entry
  );
  std.store.captureSync();
  writeLanes(std, model, next);
}
