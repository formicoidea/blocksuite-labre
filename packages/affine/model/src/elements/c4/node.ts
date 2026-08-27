import { field } from '@labre/std/gfx';

import { ShapeElementModel } from '../shape/index.js';

/**
 * The C4 artefacts the pack draws — the four levels of the model, plus the
 * container flavours the official stencil gives a silhouette of their own:
 *
 *  - people        — `person` and `person-ext`, a head over a rounded body;
 *  - systems       — `system` and `system-ext`, a plain rounded rectangle;
 *  - containers    — `container`, plus `database` (a cylinder), `mobile` (a
 *    phone bezel down the leading edge) and `browser` (a chrome band across the
 *    top). All four are CONTAINERS: what differs is the picture, never the
 *    level;
 *  - components    — `component`, the innermost level C4 draws.
 *
 * ## Why "external" is a KIND and not a flag
 *
 * `person-ext` and `system-ext` are separate values rather than an `external`
 * boolean, mirroring {@link BpmnNodeKind}'s message and timer starts: the C4
 * stencil greys an external element out entirely — fill, border and label — so
 * externality is a different picture, not a modifier on one. One discriminant
 * keeps the renderer's switch total and the size / palette tables keyed the same
 * way; a second, orthogonal flag would multiply both by two and let a
 * combination exist that the notation has no drawing for.
 *
 * ## Compatibility
 *
 * This union is only ever WIDENED, and it is widened with new VALUES of the
 * existing `kind` string field — no new field, no schema change, no migration
 * and no backfill. Same promise `wardley` and `bpmn` already make.
 */
export type C4NodeKind =
  // People.
  | 'person'
  | 'person-ext'
  // Software systems.
  | 'system'
  | 'system-ext'
  // Containers — the level, and its three drawn flavours.
  | 'container'
  | 'database'
  | 'mobile'
  | 'browser'
  // Components.
  | 'component';

/**
 * A C4 node. Extends {@link ShapeElementModel} (a native shape) so it inherits
 * ALL shape behaviour — editable stroke width / colours, inner text, native
 * resize, the shape context toolbar — for free. `kind` discriminates the
 * artefacts and drives the RENDERING alone; what a node MEANS is the `role`
 * stamped on it at creation (`gfx/c4/src/roles.ts`).
 *
 * Mirrors {@link BpmnNodeElementModel}.
 */
export class C4NodeElementModel extends ShapeElementModel {
  override get type() {
    return 'c4Node';
  }

  /**
   * Connector anchors are restricted to the centre, as they are for a BPMN flow
   * object: a C4 relationship attaches to the node centre and clips at the
   * perimeter, so an arrow between two boxes points at the boxes rather than at
   * whichever of their twelve anchors the hand was nearest.
   */
  get centerAnchorOnly() {
    return true;
  }

  @field('system' as C4NodeKind)
  accessor kind: C4NodeKind = 'system';
}
