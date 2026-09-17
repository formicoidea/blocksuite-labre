import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import { FrameworkBackgroundElementModel } from '../framework-background/index.js';
import type { FrameworkBackgroundProps } from '../framework-background/index.js';

export type EstuarineProps = FrameworkBackgroundProps & {
  /** Per-curve visibility (the curve + its legend) — toggled from the toolbar. */
  showLiminal?: boolean;
  showVolatile?: boolean;
  showCounterfactual?: boolean;
  /** When false the axis labels (e / t) are hidden. */
  showAxisLabels?: boolean;

  // ── Editable curve legends (double-click on the canvas to edit) ───────
  liminalLabel?: string;
  volatileLabel?: string;
  counterfactualLabel?: string;
};

/**
 * A static "Estuarine framework" map: the 2D energy (e, vertical, double-headed)
 * / time (t, horizontal) space with the three reference curves — Liminal (green),
 * Volatile (red, dipping below zero) and Counter-factual (dark) — each with its
 * legend. The user drops hexagon constraint nodes (native shapes) into the space.
 *
 * An INSTANCE of the framework-background primitive
 * ({@link FrameworkBackgroundElementModel}), like the Wardley / EDGY
 * backgrounds: the passive-canvas geometry comes from the primitive, the
 * fields below are the persisted document.
 */
export class EstuarineElementModel extends FrameworkBackgroundElementModel<EstuarineProps> {
  get type() {
    return 'estuarine';
  }

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(true)
  accessor showLiminal: boolean = true;

  @field(true)
  accessor showVolatile: boolean = true;

  @field(true)
  accessor showCounterfactual: boolean = true;

  @field(true)
  accessor showAxisLabels: boolean = true;

  // ── Editable curve legends ────────────────────────────────────────────
  //
  // ADDITIVE and OPTIONAL, on the Wardley pattern: defaulted to `undefined`
  // they stay absent from the Y.Map until something assigns them, so a map
  // placed before this change carries none of them and is byte-identical to one
  // placed after. Absent is also what lets the drawing fall through to the
  // catalogue — a hard default here would put the three legends in English
  // forever.
  //
  // The LEGENDS only: the italic e / t axis letters are notation, not words.
  @field()
  accessor liminalLabel: string | undefined = undefined;

  @field()
  accessor volatileLabel: string | undefined = undefined;

  @field()
  accessor counterfactualLabel: string | undefined = undefined;

  @field(0)
  accessor rotate: number = 0;

  @field('[0,0,0,0]' as SerializedXYWH)
  accessor xywh: SerializedXYWH = '[0,0,690,801]';
}
