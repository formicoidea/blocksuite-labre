import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import type { FrameworkBackgroundProps } from '../framework-background/index.js';
import { FrameworkBackgroundElementModel } from '../framework-background/index.js';

export type C4BoardProps = FrameworkBackgroundProps & {
  /** The diagram title, written top-left — edited inline on dblclick. */
  name?: string;
};

/**
 * The C4 board: the sheet one diagram of the model is drawn on — a context
 * diagram, a container diagram, a component diagram. A framework background like
 * every other one in the library: the user drops nodes on top of it, and a
 * connector never snaps to it.
 *
 * It carries a NAME and nothing else. A C4 diagram has no frame of reference —
 * a system drawn top left says nothing more than one drawn bottom right — so
 * there are no axes, no zones and no partition to declare. What names the level
 * being drawn is the title the author writes on it.
 *
 * What it LOOKS like is declared, not coded: see `C4_BOARD_BACKGROUND` in
 * `@labre/affine-gfx-c4`.
 */
export class C4BoardElementModel extends FrameworkBackgroundElementModel<C4BoardProps> {
  get type() {
    return 'c4Board';
  }

  @field('C4 diagram')
  accessor name: string = 'C4 diagram';

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,1400,900]';
}
