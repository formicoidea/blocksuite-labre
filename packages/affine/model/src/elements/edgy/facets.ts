import type { IVec, SerializedXYWH } from '@labre/global/gfx';
import {
  Bound,
  getPointsFromBoundWithRotation,
  linePolygonIntersects,
  polygonNearestPoint,
} from '@labre/global/gfx';
import type { BaseElementProps, PointTestOptions } from '@labre/std/gfx';
import { field, GfxPrimitiveElementModel } from '@labre/std/gfx';

import { backgroundIncludesPoint } from '../framework-background/index.js';

export type EdgyFacetsProps = BaseElementProps & {
  /** When false the resize handles are hidden — toggled from the toolbar. */
  resizeEnabled?: boolean;
  /** When false the three facet name labels are hidden. */
  showLabels?: boolean;
  /** When false the six white zone pictograms are hidden. */
  showPictos?: boolean;
  /**
   * When true the rendering is cropped to the circles' bounding box (the REF
   * margins only exist for the facet name labels — pointless when hidden).
   */
  cropToCircles?: boolean;
  /** When false the diagram stops granting the hover spotlight. */
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
 * Mirrors {@link WardleyBackgroundElementModel}: extends
 * {@link GfxPrimitiveElementModel} so it inherits selection, move, copy/paste,
 * duplicate, align and undo/redo for free.
 */
export class EdgyFacetsElementModel extends GfxPrimitiveElementModel<EdgyFacetsProps> {
  get type() {
    return 'edgy';
  }

  /**
   * The diagram is a passive canvas: connectors must not snap their endpoints
   * to it (an EDGY link should connect elements, never the facets diagram).
   */
  override get connectable() {
    return false;
  }

  override containsBound(bounds: Bound): boolean {
    const points = getPointsFromBoundWithRotation(this);
    return points.some(point => bounds.containsPoint(point));
  }

  override getLineIntersections(start: IVec, end: IVec) {
    const points = getPointsFromBoundWithRotation(this);
    return linePolygonIntersects(start, end, points);
  }

  override getNearestPoint(point: IVec): IVec {
    return polygonNearestPoint(
      Bound.deserialize(this.xywh).points,
      point
    ) as IVec;
  }

  /**
   * Picked by its BORDER band — see {@link backgroundIncludesPoint}.
   *
   * The facet LABELS stay double-clickable all the same: their zones are added
   * by `EdgyView.includesPoint`, which is what the pointer router consults, so
   * the rename target lives with the code that draws it and the model layer
   * stays free of it.
   */
  override includesPoint(
    x: number,
    y: number,
    options?: PointTestOptions
  ): boolean {
    return backgroundIncludesPoint(this, x, y, options);
  }

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(true)
  accessor showLabels: boolean = true;

  @field(true)
  accessor showPictos: boolean = true;

  @field(false)
  accessor cropToCircles: boolean = false;

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

  @field()
  accessor xywh: SerializedXYWH = '[0,0,1020,600]';
}
