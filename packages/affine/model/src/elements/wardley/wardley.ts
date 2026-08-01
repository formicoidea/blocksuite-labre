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

  // ── Editable label texts ──────────────────────────────────────────────
  //
  // Deliberately DEFAULTED TO `undefined`, and therefore written nowhere: an
  // `undefined` default stays absent from the Y.Map until something assigns it
  // (see `field.ts`), which is what keeps an optional field shippable without a
  // migration.
  //
  // Absent means "the user has never renamed this one", and only then can the
  // `WARDLEY_BACKGROUND` declaration fall through to its i18n key — with a hard
  // default here, the key would be unreachable and the map would be English
  // forever. Any value the user types is written and wins from then on, and a
  // map authored before this change carries all ten and is untouched.
  @field()
  accessor xAxisTitle: string | undefined = undefined;

  @field()
  accessor yAxisTitle: string | undefined = undefined;

  @field()
  accessor evolutionStart: string | undefined = undefined;

  @field()
  accessor evolutionEnd: string | undefined = undefined;

  @field()
  accessor visibilityHigh: string | undefined = undefined;

  @field()
  accessor visibilityLow: string | undefined = undefined;

  @field()
  accessor phase0: string | undefined = undefined;

  @field()
  accessor phase1: string | undefined = undefined;

  @field()
  accessor phase2: string | undefined = undefined;

  @field()
  accessor phase3: string | undefined = undefined;

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
