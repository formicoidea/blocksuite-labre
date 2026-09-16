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

  // ── Editable domain headings (double-click on the canvas to edit) ─────
  complexTitle?: string;
  complicatedTitle?: string;
  chaoticTitle?: string;
  clearTitle?: string;
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

  // ── Editable domain headings ──────────────────────────────────────────
  //
  // ADDITIVE and OPTIONAL, on the Wardley pattern: defaulted to `undefined`
  // they stay absent from the Y.Map until something assigns them, so a diagram
  // placed before this change carries none of them and is byte-identical to one
  // placed after. Absent is also what lets the drawing fall through to the
  // catalogue — a hard default here would put the four domains in English
  // forever.
  //
  // The HEADINGS only: the decision sentences, the subheadings and the Aporia /
  // Confusion markers are the notation itself and carry no prop.
  @field()
  accessor complexTitle: string | undefined = undefined;

  @field()
  accessor complicatedTitle: string | undefined = undefined;

  @field()
  accessor chaoticTitle: string | undefined = undefined;

  @field()
  accessor clearTitle: string | undefined = undefined;

  @field(0)
  accessor rotate: number = 0;

  @field('[0,0,0,0]' as SerializedXYWH)
  accessor xywh: SerializedXYWH = '[0,0,1080,777]';
}
