import type { SerializedXYWH } from '@labre/global/gfx';
import { rotatePoint } from '@labre/global/gfx';
import type { PointTestOptions } from '@labre/std/gfx';
import { field } from '@labre/std/gfx';

import type { FrameworkBackgroundProps } from '../framework-background/index.js';
import { FrameworkBackgroundElementModel } from '../framework-background/index.js';

/**
 * Width of the participant band — the left margin strip the pool name is
 * written up, in model units.
 *
 * Declared HERE, in the model, and re-exported by `@labre/affine-gfx-bpmn`
 * rather than the other way round. The pool's own hit test needs it (a pool is
 * clickable by its title bands as well as its border, the bpmn.io convention),
 * and `affine-model` cannot reach into `affine-block-surface` where the
 * declaration is resolved. One number, owned by the layer that both the
 * declaration and the hit test can read.
 */
export const POOL_BAND_WIDTH = 28;

/**
 * Width of a lane's own title band — the strip immediately inside the
 * participant band, with the lane name turned on its side.
 *
 * Four units narrower than {@link POOL_BAND_WIDTH}, and for the same reason the
 * lane font is two points smaller: the two strips sit side by side, so the
 * subordinate one has to say so. Identical widths read as a single 56-unit
 * gutter rather than as a participant containing lanes, which is exactly the
 * relationship the picture has to carry.
 *
 * NO fill, divider only — what bpmn.io, Camunda and Visio all draw.
 */
export const POOL_LANE_BAND_WIDTH = 24;

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

  /**
   * A pool is picked by its BORDER — and by its TITLE BANDS, which is the one
   * carve-out the recette kept (issue #194).
   *
   * That is the bpmn.io convention, and it is the convention because the bands
   * are the only part of a pool that is the pool rather than the process drawn
   * on it: the participant strip on the left carries the participant's name,
   * the lane strip beside it carries the lane names, and nothing is ever
   * dropped on either. The flow area is where the work goes, so a click there
   * belongs to whatever is under the pointer.
   *
   * ## Where the geometry comes from
   *
   * The two strips run the FULL height of the pool: the participant band is the
   * whole left margin, and the lane bands partition that same height between
   * them with no gap — so their union is one vertical strip
   * `POOL_LANE_BAND_WIDTH` wide, whatever the lanes' individual weights are.
   * Which means this test needs no lane arithmetic at all, only the two widths
   * (declared above, and read from here by the framework declaration) and the
   * answer to "does this pool have a usable lane".
   *
   * The zoom-grown rename targets — the touch-sized boxes a double-click aims
   * at — are the VIEW's business and stay in `pool-hit.ts`; what is painted is
   * what is selectable, which is the promise this test has to keep.
   */
  override includesPoint(
    x: number,
    y: number,
    options?: PointTestOptions
  ): boolean {
    if (super.includesPoint(x, y, options)) return true;

    const [ex, ey, w, h] = this.deserializedXYWH;

    // Element-local coordinates, undoing the element rotation about its centre
    // — the bands are axis-aligned inside the pool, not on the canvas.
    let lx = x - ex;
    let ly = y - ey;
    const rotate = this.rotate ?? 0;
    if (rotate) {
      const [ux, uy] = rotatePoint([x, y], [ex + w / 2, ey + h / 2], -rotate);
      lx = ux - ex;
      ly = uy - ey;
    }

    if (ly < 0 || ly > h || lx < 0) return false;

    // Clamped to a pool narrower than its own margin — the degenerate case the
    // renderer clamps too.
    const band = Math.min(POOL_BAND_WIDTH, w);
    const lanes = this.hasUsableLane
      ? Math.min(POOL_LANE_BAND_WIDTH, w - band)
      : 0;
    return lx <= band + Math.max(lanes, 0);
  }

  /**
   * Whether at least one lane is drawn — the only thing the hit test needs to
   * know about the partition.
   *
   * Mirrors what `backgroundInstanceZones` keeps (a string id, a finite size
   * greater than zero): a malformed row is dropped there and paints no band, so
   * it must not make a band clickable here either.
   */
  private get hasUsableLane(): boolean {
    const lanes = this.lanes;
    if (!Array.isArray(lanes)) return false;
    return lanes.some(
      lane =>
        typeof lane?.id === 'string' &&
        lane.id !== '' &&
        typeof lane.size === 'number' &&
        Number.isFinite(lane.size) &&
        lane.size > 0
    );
  }
}
