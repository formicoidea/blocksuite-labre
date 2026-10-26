import { field } from '@labre/std/gfx';

import { ShapeElementModel } from '../shape/index.js';

/**
 * The BPMN artefacts the pack draws — the **descriptive conformance subclass**
 * of BPMN 2.0. Each maps onto a native shape, decorated by a glyph where the
 * notation asks for one:
 *
 *  - events (ellipse)   — `startEvent` / `endEvent` plain, plus the message and
 *    timer starts and the message and terminate ends;
 *  - activities (rect)  — `task` plain, plus the user and service tasks, the
 *    collapsed sub-process and the call activity;
 *  - gateways (diamond) — `gatewayExclusive` (X) and `gatewayParallel` (+);
 *  - data & artifacts   — `dataObject`, `dataStore` and `textAnnotation`, whose
 *    silhouettes (folded page, cylinder, open bracket) are drawn by the glyph
 *    over a native rect with its own stroke and fill turned off;
 *  - `group`            — a dashed rounded rectangle drawn AROUND things.
 *
 * `group` is the odd one and deliberately so. Every other kind is a node the
 * process is made of; a group is a lasso somebody drew round part of it. The
 * spec (BPMN 2.0.2 §10.4) exempts it from every connection and containment
 * constraint there is — it cannot be attached to a sequence or message flow, it
 * is not bounded by the pool or lane it overlaps, and it may straddle several
 * pools at once. Nothing here has to enforce that, because a group is unfilled:
 * it is hit near its border and on its label, so it never steals a click from
 * what it encloses, and what it encloses never becomes its content.
 *
 * ## Compatibility
 *
 * This union is only ever WIDENED, and it is widened with new VALUES of the
 * existing `kind` string field — no new field, no schema change, no migration
 * and no backfill. The precedent is `wardley`'s (`gfx/wardley/src/roles.ts`):
 * a process drawn before today carries one of the four original values, loads
 * unchanged and paints exactly as it always did.
 *
 * The expanded (drilled-in) sub-process is deliberately NOT here: `subProcess`
 * is the COLLAPSED representation only — a task-sized rectangle with the `+`
 * marker. An expanded sub-process is a container with its own flow inside it,
 * which is a containment model this pack does not have yet.
 */
export type BpmnNodeKind =
  // Events.
  | 'startEvent'
  | 'startEventMessage'
  | 'startEventTimer'
  | 'endEvent'
  | 'endEventMessage'
  | 'endEventTerminate'
  // Activities.
  | 'task'
  | 'taskUser'
  | 'taskService'
  | 'subProcess'
  | 'callActivity'
  // Gateways.
  | 'gatewayExclusive'
  | 'gatewayParallel'
  // Data and artifacts.
  | 'dataObject'
  | 'dataStore'
  | 'textAnnotation'
  | 'group';

/**
 * Which kinds a connector may attach to at the CENTRE only.
 *
 * Every BPMN node used to be centre-only, so a sequence flow could only aim at
 * the middle of a task and clip at its outline; the user could not choose the
 * side a flow leaves a gateway by, which is half of how a BPMN diagram is
 * read. A flow object now keeps the native anchors the connector manager casts
 * from the centre to its outline (`getAnchors`, `gfx/connector`): the four
 * corners of a gateway's diamond, the side midpoints of an activity's or a
 * data shape's rectangle, the four cardinal points of an event's circle. The
 * centre stays offered too, behind the user's `connectorCenterAnchor` setting.
 *
 * A `group` stays centre-only: no flow attaches to a group (BPMN 2.0.2 §10.4),
 * so it has no side worth offering, and a lasso drawn round a process must not
 * sprout anchor dots over the nodes it encloses.
 *
 * A getter over a table, not a stored prop: nothing is written, and an existing
 * connector keeps its `[0.5, 0.5]` endpoints and still stops at the outline.
 * Total over {@link BpmnNodeKind}, so a new kind is a compile error until it
 * says which it is.
 */
export const BPMN_CENTRE_ANCHORED = {
  startEvent: false,
  startEventMessage: false,
  startEventTimer: false,
  endEvent: false,
  endEventMessage: false,
  endEventTerminate: false,
  task: false,
  taskUser: false,
  taskService: false,
  subProcess: false,
  callActivity: false,
  gatewayExclusive: false,
  gatewayParallel: false,
  dataObject: false,
  dataStore: false,
  textAnnotation: false,
  group: true,
} as const satisfies Record<BpmnNodeKind, boolean>;

/**
 * A BPMN flow-object node. Extends {@link ShapeElementModel} (a native shape)
 * so it inherits ALL shape behaviour — editable stroke width / colors, inner
 * text, native resize, the shape context toolbar — for free. `kind`
 * discriminates the artefacts and drives the RENDERING alone; what a node
 * MEANS is the `role` stamped on it at creation (`gfx/bpmn/src/roles.ts`).
 * The plain start event, end event and task are undecorated native shapes;
 * every other kind is decorated with a glyph by the renderer.
 *
 * Mirrors {@link EdgyNodeElementModel}.
 */
export class BpmnNodeElementModel extends ShapeElementModel {
  override get type() {
    return 'bpmnNode';
  }

  /**
   * Whether connectors may attach to this node's centre only (read by the
   * connector manager / tool). Per kind, from {@link BPMN_CENTRE_ANCHORED}:
   * a flow object keeps the native anchors of its outline, a group does not.
   *
   * `true` for an unknown kind — a value a newer client wrote — which is what
   * every kind answered before the table existed.
   */
  get centerAnchorOnly() {
    return BPMN_CENTRE_ANCHORED[this.kind] ?? true;
  }

  @field('task' as BpmnNodeKind)
  accessor kind: BpmnNodeKind = 'task';
}
