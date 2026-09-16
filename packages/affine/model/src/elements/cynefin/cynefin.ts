import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import { FrameworkBackgroundElementModel } from '../framework-background/index.js';
import type { FrameworkBackgroundProps } from '../framework-background/index.js';

export type CynefinProps = FrameworkBackgroundProps & {
  /** When false the domain titles + the A/C marker letters and names are hidden. */
  showTitles?: boolean;
  /** When false the explanatory text (subheadings, decisions, annotations, notes) is hidden. */
  showDescriptions?: boolean;
  /** When false the teal "iterate" liminal curve is hidden. */
  showLiminalLine?: boolean;
};

/**
 * A static "Liminal Cynefin" framework diagram: the hand-drawn five-domain
 * boundary (Complex / Complicated / Chaotic / Clear + central Confusion), the
 * hatched cliff between Chaotic and Clear, and the dashed Complicated↔Clear
 * boundary — reproduced from the official SVG paths. The user places regular
 * edgeless elements on top of it.
 *
 * An INSTANCE of the framework-background primitive
 * ({@link FrameworkBackgroundElementModel}), like the Wardley / EDGY
 * backgrounds: the passive-canvas geometry comes from the primitive, the
 * fields below are the persisted document.
 */
export class CynefinElementModel extends FrameworkBackgroundElementModel<CynefinProps> {
  get type() {
    return 'cynefin';
  }

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(true)
  accessor showTitles: boolean = true;

  @field(true)
  accessor showDescriptions: boolean = true;

  @field(true)
  accessor showLiminalLine: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field('[0,0,0,0]' as SerializedXYWH)
  accessor xywh: SerializedXYWH = '[0,0,1080,777]';
}
