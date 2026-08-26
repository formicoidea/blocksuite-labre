import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import { FrameworkBackgroundElementModel } from '../framework-background/index.js';
import type { FrameworkBackgroundProps } from '../framework-background/index.js';

/**
 * Which READING of the chart this instance is turned to.
 *
 * `classic` is the DDD Crew chart everybody knows — Generic / Supporting / Core
 * over Complexity × Business differentiation. `migration` keeps the very same
 * frame and names its four quadrants after the migration conversation instead
 * (low-hanging fruit, risk-seeking, risk-averse, last toothpaste), which is why
 * it is a variant of one background and not a second element type.
 */
export type CoreDomainVariant = 'classic' | 'migration';

export type CoreDomainChartProps = FrameworkBackgroundProps & {
  /** When false the translucent Core / Supporting / Generic zone bands are hidden. */
  showZones?: boolean;
  /** When false the axis titles, Low/High ticks and zone names are hidden. */
  showLabels?: boolean;
  /** Which reading of the chart is drawn. */
  variant?: CoreDomainVariant;
};

/**
 * The Core Domain Chart background (DDD Crew): the two axes (Complexity ×
 * Business differentiation) with their Low/High ticks and the translucent
 * Generic / Supporting / Core zone bands. The user places sub-domain dots,
 * movement arrows and the Notation legend on top of it.
 *
 * An INSTANCE of the framework-background primitive
 * ({@link FrameworkBackgroundElementModel}): the geometry and the passive-canvas
 * behaviour come from the primitive — which declares the very same
 * `connectable` getter and the very same four geometry overrides this class
 * used to spell out — and what the chart LOOKS like comes from the
 * `CORE_DOMAIN_BACKGROUND` declaration in `@labre/affine-gfx-ddd-core-domain`.
 *
 * The fields below are the persisted document and are NOT the primitive's
 * business: the base swap adds no field, renames none and changes no default,
 * so a chart authored before it is byte-identical to one authored after.
 */
export class CoreDomainChartElementModel extends FrameworkBackgroundElementModel<CoreDomainChartProps> {
  get type() {
    return 'coreDomain';
  }

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(true)
  accessor showZones: boolean = true;

  @field(true)
  accessor showLabels: boolean = true;

  /**
   * A HARD default, on the Wardley `variant` pattern: `classic` is written into
   * the Y.Map at creation and is also what an older chart — which carries no
   * such key at all — reads back as. Both roads lead to the chart the user has
   * always seen, so the field ships with no migration and no backfill.
   */
  @field('classic' as CoreDomainVariant)
  accessor variant: CoreDomainVariant = 'classic';

  @field(0)
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,900,820]';
}
