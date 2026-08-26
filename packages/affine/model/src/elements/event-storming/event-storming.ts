import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import { FrameworkBackgroundElementModel } from '../framework-background/index.js';
import type { FrameworkBackgroundProps } from '../framework-background/index.js';

export type EventStormingBoardProps = FrameworkBackgroundProps;

/**
 * The Event Storming board: the paper roll a Big Picture is stormed on.
 *
 * One axis and nothing else — TIME, running left to right along the bottom.
 * That is the whole frame of reference Event Storming has: an event drawn to
 * the left of another happened before it, and how HIGH a sticky sits means
 * nothing at all (the vertical is where a workshop parks its unknowns, not a
 * scale). Declaring the one axis and no zones is therefore the honest
 * declaration, and it is what lets `es.against-timeline` say "this flow runs
 * backwards" without inventing a second dimension nobody drew against.
 *
 * **Swimlanes are cut from v1** (plan § Coupes v1). A lane is a horizontal
 * BAND with a name, which on this element would be a variant declaration
 * (`variantProp: 'lanes'`) and a rule family that measures membership per lane.
 * Neither exists yet, and shipping half of it — bands that paint but that no
 * rule can read — would put a semantic on the vertical the framework does not
 * have. The v2 note lives here so the day lanes land, the reason they were not
 * here is on the record.
 *
 * Adds no field of its own beyond the primitive's `resizeEnabled`, so a board
 * is byte-identical to what {@link FrameworkBackgroundElementModel} already
 * persists. It is created 3200 × 1400 — a Big Picture is WIDE, because the
 * timeline is the point — and freely resizable in both directions: the roll
 * grows sideways all morning as events are remembered, and locking its
 * proportion would fight the hand.
 */
export class EventStormingBoardElementModel extends FrameworkBackgroundElementModel<EventStormingBoardProps> {
  get type() {
    return 'eventStorming';
  }

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,3200,1400]';
}
