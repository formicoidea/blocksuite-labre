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
   * Connector anchors are restricted to the center for BPMN nodes (read by the
   * connector manager / tool), so sequence flows attach to the node center and
   * clip at the perimeter.
   */
  get centerAnchorOnly() {
    return true;
  }

  @field('task' as BpmnNodeKind)
  accessor kind: BpmnNodeKind = 'task';
}
