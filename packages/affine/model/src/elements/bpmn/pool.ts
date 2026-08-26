import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import type { FrameworkBackgroundProps } from '../framework-background/index.js';
import { FrameworkBackgroundElementModel } from '../framework-background/index.js';

/**
 * One LANE (couloir) of a pool: a horizontal band the participant's own work is
 * divided into — "Sales", "Back office", "Automated".
 *
 * The shape of a {@link BackgroundInstanceZoneItem} in
 * `@labre/affine-block-surface`, and deliberately the same three fields: the
 * primitive paints an instance partition from that structure, the audit reports
 * it from that structure, and a lane that had a shape of its own would be a
 * fourth place the two have to agree.
 *
 * `size` is a relative WEIGHT, not a height in model units: lanes share the
 * plot in proportion to their sizes, so a pool dragged taller redistributes the
 * extra space instead of leaving a gap under the last band. `2` reads as "twice
 * the other one", which is the only thing a lane's height ever means.
 */
export interface BpmnLane {
  /** Stable id, generated at creation. Never the name: a lane can be renamed. */
  id: string;
  /** The lane name, written horizontally in its top-left corner. */
  name?: string;
  /** Relative weight — see above. Must be a finite number greater than zero. */
  size: number;
}

export type BpmnPoolProps = FrameworkBackgroundProps & {
  /** The participant name shown in the left band — edited inline on dblclick. */
  name?: string;
  /** The pool's own partition into lanes. Absent until the first one is added. */
  lanes?: BpmnLane[];
};

/**
 * A BPMN "pool": a participant container drawn as a rounded-rect frame with a
 * vertical name band on the left. It is a framework background like every other
 * one in the library — the user drops flow-object nodes on top of it, and a
 * connector never snaps to it.
 *
 * The geometry of a passive canvas comes from
 * {@link FrameworkBackgroundElementModel}: this class used to restate all five
 * of those overrides verbatim, which is exactly the kind of copy that drifts.
 * The persisted type is still `bpmnPool`, and the first four fields below are
 * the four it has always written, in the same order, with the same defaults.
 *
 * What it LOOKS like is declared, not coded: see `BPMN_POOL_BACKGROUND` in
 * `@labre/affine-gfx-bpmn`.
 */
export class BpmnPoolElementModel extends FrameworkBackgroundElementModel<BpmnPoolProps> {
  get type() {
    return 'bpmnPool';
  }

  @field('Pool')
  accessor name: string = 'Pool';

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,560,200]';

  /**
   * The pool's own partition into lanes, in top-to-bottom order.
   *
   * The FIFTH field, and the only one that is optional. It mirrors
   * `validationExceptions` on the base element model exactly, for the same three
   * reasons:
   *
   * - **`undefined`, not `[]`.** `@field()`'s `init` writes nothing for an
   *   `undefined` default, so a pool that has no lane stays byte-identical to
   *   one created before this field existed: optional field, no schema version
   *   bump, no migration, and every document already on disk opens and paints
   *   exactly as it did (pinned by `pool-background.unit.spec.ts`, whose
   *   fixture carries no `lanes` key). Removing the last lane goes back through
   *   `clearField`, which deletes the KEY rather than leaving a phantom one.
   * - **Flat JSON on purpose.** Element serialization is one level deep, and a
   *   value a Yjs update can encode is the contract `_assignElementProp`
   *   enforces. A nested `Y.Map` is what `tags` needs and this does not (see
   *   `docs/adr/0007`): a lane list is one atomic choice about how a single
   *   participant's own band is cut, authored by whoever is drawing the
   *   process — not an accumulating multi-key set different people qualify
   *   concurrently. The trade is stated so it is reviewed, not discovered:
   *   two peers reordering the lanes at the same moment resolve
   *   last-write-wins, one whole list winning over the other.
   * - **Declared HERE and not on the base class.** A lane is a subdivision of a
   *   pool and of nothing else, and the accessor is what carries the value
   *   through a copy, a paste or a template insertion, so a duplicated pool
   *   arrives with its lanes.
   *
   * What it MEANS is declared, not coded: `BPMN_POOL_BACKGROUND.instanceZones`
   * in `@labre/affine-gfx-bpmn` names this prop, and the framework-background
   * primitive paints the dividers and the names from it.
   */
  @field()
  accessor lanes: BpmnLane[] | undefined = undefined;
}
