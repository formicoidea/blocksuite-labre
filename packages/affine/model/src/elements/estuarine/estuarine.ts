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

export type EstuarineProps = BaseElementProps & {
  /** When false the resize handles are hidden — toggled from the toolbar. */
  resizeEnabled?: boolean;
  /** Per-curve visibility (the curve + its legend) — toggled from the toolbar. */
  showLiminal?: boolean;
  showVolatile?: boolean;
  showCounterfactual?: boolean;
  /** When false the axis labels (e / t) are hidden. */
  showAxisLabels?: boolean;
};

/**
 * A static "Estuarine framework" map: the 2D energy (e, vertical, double-headed)
 * / time (t, horizontal) space with the three reference curves — Liminal (green),
 * Volatile (red, dipping below zero) and Counter-factual (dark) — each with its
 * legend. The user drops hexagon constraint nodes (native shapes) into the space.
 *
 * Mirrors the Wardley / EDGY backgrounds.
 */
export class EstuarineElementModel extends GfxPrimitiveElementModel<EstuarineProps> {
  get type() {
    return 'estuarine';
  }

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
   * Picked by its BORDER band — see {@link backgroundIncludesPoint}. The map is
   * a space constraint nodes are dropped into, so the clicks inside it are
   * theirs.
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
  accessor showLiminal: boolean = true;

  @field(true)
  accessor showVolatile: boolean = true;

  @field(true)
  accessor showCounterfactual: boolean = true;

  @field(true)
  accessor showAxisLabels: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,690,801]';
}
