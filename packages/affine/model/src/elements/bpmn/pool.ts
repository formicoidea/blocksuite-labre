import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import type { FrameworkBackgroundProps } from '../framework-background/index.js';
import { FrameworkBackgroundElementModel } from '../framework-background/index.js';

export type BpmnPoolProps = FrameworkBackgroundProps & {
  /** The participant name shown in the left band — edited inline on dblclick. */
  name?: string;
};

/**
 * A BPMN "pool": a participant container drawn as a rounded-rect frame with a
 * vertical name band on the left. It is a framework background like every other
 * one in the library — the user drops flow-object nodes on top of it, and a
 * connector never snaps to it. Lanes are deliberately out of scope for v1.
 *
 * The geometry of a passive canvas comes from
 * {@link FrameworkBackgroundElementModel}: this class used to restate all five
 * of those overrides verbatim, which is exactly the kind of copy that drifts.
 * Nothing about the DOCUMENT changes — the persisted type is still `bpmnPool`
 * and the four fields below are the four it has always written, in the same
 * order, with the same defaults.
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
}
