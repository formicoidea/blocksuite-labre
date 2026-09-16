import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import { FrameworkBackgroundElementModel } from '../framework-background/index.js';
import type { FrameworkBackgroundProps } from '../framework-background/index.js';

export type EdgyFacetsProps = FrameworkBackgroundProps & {
  /** When false the three facet name labels are hidden. */
  showLabels?: boolean;
  /** When false the six white zone pictograms are hidden. */
  showPictos?: boolean;
  /**
   * When true the rendering is cropped to the circles' bounding box (the REF
   * margins only exist for the facet name labels — pointless when hidden).
   */
  cropToCircles?: boolean;
  /**
   * INERT since #195 — kept for backward compatibility only.
   *
   * The hover spotlight is board logic: it is granted by the EDGY board
   * (`edgyBoard`), never by this drawing, so nothing reads this field on a
   * facets Venn any more. It stays declared because documents written before
   * the change carry it, and an undeclared property would not survive a load
   * (see the schema red zone in `CLAUDE.md`). Do not read it, do not remove it.
   */
  spotlightEnabled?: boolean;

  // ── Editable labels (double-click on the canvas to edit) ──────────────
  identityLabel?: string;
  architectureLabel?: string;
  experienceLabel?: string;
};

/**
 * A static "EDGY Enterprise Design Facets" diagram: three overlapping circles
 * (Identity / Architecture / Experience) with their three pairwise
 * intersections (Organisation / Brand / Product), the white centre and the six
 * white pictograms, drawn on the surface canvas. The user places regular
 * edgeless elements (the EDGY base shapes) on top of it.
 *
 * An INSTANCE of the framework-background primitive
 * ({@link FrameworkBackgroundElementModel}), like the Wardley background: the
 * passive-canvas geometry comes from the primitive, the fields below are the
 * persisted document.
 *
 * The facet LABELS stay double-clickable all the same: their zones are added
 * by `EdgyView.includesPoint`, which is what the pointer router consults, so
 * the rename target lives with the code that draws it and the model layer
 * stays free of it.
 */
export class EdgyFacetsElementModel extends FrameworkBackgroundElementModel<EdgyFacetsProps> {
  get type() {
    return 'edgy';
  }

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(true)
  accessor showLabels: boolean = true;

  @field(true)
  accessor showPictos: boolean = true;

  @field(false)
  accessor cropToCircles: boolean = false;

  /** Inert — see {@link EdgyFacetsProps.spotlightEnabled} (#195). */
  @field(true)
  accessor spotlightEnabled: boolean = true;

  @field('Identity')
  accessor identityLabel: string = 'Identity';

  @field('Architecture')
  accessor architectureLabel: string = 'Architecture';

  @field('Experience')
  accessor experienceLabel: string = 'Experience';

  @field(0)
  accessor rotate: number = 0;

  @field('[0,0,0,0]' as SerializedXYWH)
  accessor xywh: SerializedXYWH = '[0,0,1020,600]';
}
