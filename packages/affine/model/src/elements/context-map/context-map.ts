import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import { FrameworkBackgroundElementModel } from '../framework-background/index.js';
import type { FrameworkBackgroundProps } from '../framework-background/index.js';

export type ContextMapBoardProps = FrameworkBackgroundProps;

/**
 * The Context Map board: the white card a Context Map is drawn ON.
 *
 * Deliberately the emptiest background in the library — no axis, no zone, no
 * label. A Context Map has no frame of reference: nothing about where a bounded
 * context sits on the sheet means anything, and drawing graduations would invent
 * a semantic the framework does not have. What the board IS for is the FRAME:
 * it carries the `context-map:board` role, which is what lets a rule say "this
 * context is off the map" and what gives a per-map validation profile something
 * to be written on.
 *
 * Adds no field of its own beyond the primitive's `resizeEnabled`, so a board is
 * byte-identical to what {@link FrameworkBackgroundElementModel} already
 * persists. It is created 1400 × 900 and freely resizable in both directions —
 * a context map grows sideways as contexts are found, and locking its
 * proportion would fight the hand.
 */
export class ContextMapBoardElementModel extends FrameworkBackgroundElementModel<ContextMapBoardProps> {
  get type() {
    return 'contextMap';
  }

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,1400,900]';
}
