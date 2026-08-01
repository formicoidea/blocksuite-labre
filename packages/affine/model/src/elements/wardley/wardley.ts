import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import { FrameworkBackgroundElementModel } from '../framework-background/index.js';
import type { FrameworkBackgroundProps } from '../framework-background/index.js';

/**
 * Background flavour. `classic` is the plain Wardley frame; the others overlay a
 * curve-driven colour gradient inscribed in the same frame (Slice C).
 */
export type WardleyBgVariant =
  | 'classic'
  | 'opportunity'
  | 'benefit'
  | 'evolution-gradient';

export type WardleyBackgroundProps = FrameworkBackgroundProps & {
  /** When true the four evolution zones get a light tint (style B). */
  banded?: boolean;
  /** Gradient variant inscribed in the frame. */
  variant?: WardleyBgVariant;
  /** When false, the variant gradient is hidden (plain white background). */
  showGradient?: boolean;

  // ── Editable labels (double-click on the canvas to edit) ──────────────
  xAxisTitle?: string;
  yAxisTitle?: string;
  evolutionStart?: string;
  evolutionEnd?: string;
  visibilityHigh?: string;
  visibilityLow?: string;
  phase0?: string;
  phase1?: string;
  phase2?: string;
  phase3?: string;

  // ── Per-part visibility (toggled from the toolbar) ────────────────────
  showXAxis?: boolean;
  showYAxis?: boolean;
  showColumnDividers?: boolean;
  showColumnLabels?: boolean;
  showCornerLabels?: boolean;
  showVisibilityLabels?: boolean;
};

/**
 * A static "Wardley map background": an L-shaped axes frame (Evolution X /
 * Value Chain Y) with the four evolution phase dividers and labels, drawn on
 * the surface canvas. The user places regular edgeless elements on top of it.
 *
 * An INSTANCE of the framework-background primitive
 * ({@link FrameworkBackgroundElementModel}): the geometry and the passive-canvas
 * behaviour come from the primitive, what the map looks like comes from the
 * `WARDLEY_BACKGROUND` declaration in `@labre/affine-gfx-wardley`, and the
 * fields below are the persisted document — unchanged, and not the primitive's
 * business.
 */
export class WardleyBackgroundElementModel extends FrameworkBackgroundElementModel<WardleyBackgroundProps> {
  get type() {
    return 'wardley';
  }

  @field(false)
  accessor banded: boolean = false;

  @field('classic' as WardleyBgVariant)
  accessor variant: WardleyBgVariant = 'classic';

  @field(true)
  accessor showGradient: boolean = true;

  @field(false)
  accessor resizeEnabled: boolean = false;

  // ── Editable label texts (defaults mirror the original hard-coded ones) ─
  @field('Evolution')
  accessor xAxisTitle: string = 'Evolution';

  @field('Value Chain')
  accessor yAxisTitle: string = 'Value Chain';

  @field('Uncharted')
  accessor evolutionStart: string = 'Uncharted';

  @field('Industrialized')
  accessor evolutionEnd: string = 'Industrialized';

  @field('Visible')
  accessor visibilityHigh: string = 'Visible';

  @field('Invisible')
  accessor visibilityLow: string = 'Invisible';

  @field('Genesis')
  accessor phase0: string = 'Genesis';

  @field('Custom-Built')
  accessor phase1: string = 'Custom-Built';

  @field('Product (+Rental)')
  accessor phase2: string = 'Product (+Rental)';

  @field('Commodity (+Utility)')
  accessor phase3: string = 'Commodity (+Utility)';

  // ── Per-part visibility toggles ───────────────────────────────────────
  @field(true)
  accessor showXAxis: boolean = true;

  @field(true)
  accessor showYAxis: boolean = true;

  @field(true)
  accessor showColumnDividers: boolean = true;

  @field(true)
  accessor showColumnLabels: boolean = true;

  @field(true)
  accessor showCornerLabels: boolean = true;

  @field(true)
  accessor showVisibilityLabels: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,1600,900]';
}
