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

  // ── Editable labels (double-click on the canvas to edit) ──────────────
  complexityTitle?: string;
  migrationCostTitle?: string;
  differentiationTitle?: string;
  complexityLow?: string;
  complexityHigh?: string;
  differentiationLow?: string;
  differentiationHigh?: string;
  zoneGeneric?: string;
  zoneSupporting?: string;
  zoneCore?: string;
  zoneLastToothpaste?: string;
  zoneRiskSeeking?: string;
  zoneRiskAverse?: string;
  zoneLowHangingFruit?: string;
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

  // ── Editable label texts ──────────────────────────────────────────────
  //
  // ADDITIVE and OPTIONAL, on the Wardley pattern: defaulted to `undefined`,
  // they stay absent from the Y.Map until something assigns them (see
  // `field.ts`), so a chart authored before this change carries none of them
  // and is byte-identical to one authored after. No migration, no backfill.
  //
  // Absent means "the user has never renamed this one", and only then can the
  // `CORE_DOMAIN_BACKGROUND` declaration fall through to its i18n key — with a
  // hard default here, the key would be unreachable and the chart would be
  // English forever. Any value the user types wins from then on.
  //
  // One prop per DRAWN word, including the two alternative vertical titles: on
  // a migration chart the axis is "Cost of migration", a different word naming
  // a different thing, so renaming one must not rename the other.
  @field()
  accessor complexityTitle: string | undefined = undefined;

  @field()
  accessor migrationCostTitle: string | undefined = undefined;

  @field()
  accessor differentiationTitle: string | undefined = undefined;

  @field()
  accessor complexityLow: string | undefined = undefined;

  @field()
  accessor complexityHigh: string | undefined = undefined;

  @field()
  accessor differentiationLow: string | undefined = undefined;

  @field()
  accessor differentiationHigh: string | undefined = undefined;

  @field()
  accessor zoneGeneric: string | undefined = undefined;

  @field()
  accessor zoneSupporting: string | undefined = undefined;

  @field()
  accessor zoneCore: string | undefined = undefined;

  @field()
  accessor zoneLastToothpaste: string | undefined = undefined;

  @field()
  accessor zoneRiskSeeking: string | undefined = undefined;

  @field()
  accessor zoneRiskAverse: string | undefined = undefined;

  @field()
  accessor zoneLowHangingFruit: string | undefined = undefined;

  @field(0)
  accessor rotate: number = 0;

  @field('[0,0,0,0]' as SerializedXYWH)
  accessor xywh: SerializedXYWH = '[0,0,900,820]';
}
