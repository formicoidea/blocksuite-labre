import type { SerializedXYWH } from '@labre/global/gfx';
import type { PointTestOptions } from '@labre/std/gfx';
import { field } from '@labre/std/gfx';

import type { FrameworkBackgroundProps } from '../framework-background/index.js';
import { FrameworkBackgroundElementModel } from '../framework-background/index.js';
import { umlInNameBand } from './band.js';

/**
 * Height of a region's NAME BAND — the strip its name is written in, in model
 * units.
 *
 * Owned by the model for the reason {@link UML_PARTITION_BAND} is: the region's
 * own hit test reads it, and `affine-model` cannot reach into the package where
 * the declaration is resolved. The same 36 the partition uses, and deliberately
 * so — the two are the same piece of furniture, a name written in a strip along
 * the top of a transparent frame, and two numbers would drift.
 */
export const UML_REGION_BAND = 36;

export type UmlRegionProps = FrameworkBackgroundProps & {
  /** The state name, written in the band — edited inline on dblclick. */
  name?: string;
};

/**
 * A COMPOSITE STATE — the region of UML 2.5.1 §14.2.4: the rounded rectangle
 * drawn round the sub-states of a state that has its own state machine inside
 * it.
 *
 * A framework background, transparent like {@link UmlPartitionElementModel}: it
 * is drawn OVER states that are already there, and membership is geometry at
 * read time (R11).
 *
 * ## Why a composite state IS the region, rather than a state with regions in it
 *
 * The metamodel has two objects — a State that `isComposite`, and the Regions it
 * owns — and the notation draws ONE: a rounded rectangle with the state's name
 * at the top and the sub-machine inside (§14.2.4, Figure 14.6). A drawing tool
 * that made the author place a `state` node and then a `umlRegion` inside it
 * would be asking them to draw two things to get one picture, and would leave
 * every rule with two elements to decide which of them the composite state is.
 *
 * So this element IS the composite state: it carries the name, it draws the
 * rounded rectangle, and its sub-states sit inside it by geometry.
 *
 * ## The ceiling, stated out loud
 *
 * ORTHOGONAL regions — a composite state cut into concurrent regions by dashed
 * separators (§14.2.4, Figure 14.8) — are NOT drawn. One region per composite
 * state is what this element is; a second one is a phase-3 refinement, and it
 * will arrive the way the BPMN pool's lanes did (an instance partition on the
 * declaration) rather than as a field added here in a hurry.
 *
 * What it LOOKS like is declared, not coded: see `UML_REGION_FRAME` in
 * `@labre/affine-gfx-uml`.
 */
export class UmlRegionElementModel extends FrameworkBackgroundElementModel<UmlRegionProps> {
  get type() {
    return 'umlRegion';
  }

  /**
   * `State`, not `Region`: this element IS the composite state on the page, and
   * a fresh one that called itself a Region would be naming the metamodel
   * object rather than the thing the author drew (see the header).
   */
  @field('State')
  accessor name: string = 'State';

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  /** Room for a small sub-machine — an initial, two states and a final. */
  @field()
  accessor xywh: SerializedXYWH = '[0,0,520,320]';

  /**
   * Picked by its BORDER and by its NAME BAND — the carve-out the diagram frame
   * and the partition both make, and for the same reason: the band is the only
   * part of the composite state that is the STATE rather than the sub-machine
   * drawn inside it.
   *
   * Always the TOP edge: unlike a partition, a composite state has no
   * orientation to turn — §14.2.4 writes its name across the top and nowhere
   * else.
   */
  override includesPoint(
    x: number,
    y: number,
    options?: PointTestOptions
  ): boolean {
    if (super.includesPoint(x, y, options)) return true;
    return umlInNameBand(this, 'top', UML_REGION_BAND, x, y);
  }
}
