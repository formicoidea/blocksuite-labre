import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import { FrameworkBackgroundElementModel } from '../framework-background/index.js';
import type { FrameworkBackgroundProps } from '../framework-background/index.js';

export type EdgyBoardProps = FrameworkBackgroundProps & {
  /** When false the board stops granting the hover spotlight. */
  spotlightEnabled?: boolean;
};

/**
 * A blank white board for free-form EDGY modelling: the user places EDGY base
 * shapes and connectors on top of it and the board grants them the dependency
 * spotlight-on-hover behavior (see the surface `Spotlight` extension).
 *
 * An INSTANCE of the framework-background primitive
 * ({@link FrameworkBackgroundElementModel}): the passive-canvas geometry —
 * non-connectable, picked by its border band, lassoed and intersected as a
 * rotated rectangle — comes from the primitive, and the fields below are the
 * persisted document, unchanged.
 */
export class EdgyBoardElementModel extends FrameworkBackgroundElementModel<EdgyBoardProps> {
  get type() {
    return 'edgyBoard';
  }

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(true)
  accessor spotlightEnabled: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field('[0,0,0,0]' as SerializedXYWH)
  accessor xywh: SerializedXYWH = '[0,0,1600,1000]';
}
