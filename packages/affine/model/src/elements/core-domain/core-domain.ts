import type { IVec, SerializedXYWH } from '@labre/global/gfx';
import {
  Bound,
  getPointsFromBoundWithRotation,
  linePolygonIntersects,
  pointInPolygon,
  polygonNearestPoint,
} from '@labre/global/gfx';
import type { BaseElementProps } from '@labre/std/gfx';
import { field, GfxPrimitiveElementModel } from '@labre/std/gfx';

export type CoreDomainChartProps = BaseElementProps & {
  /** When false the resize handles are hidden — toggled from the toolbar. */
  resizeEnabled?: boolean;
  /** When false the translucent Core / Supporting / Generic zone bands are hidden. */
  showZones?: boolean;
  /** When false the axis titles, Low/High ticks and zone names are hidden. */
  showLabels?: boolean;
};

/**
 * The Core Domain Chart background (DDD Crew): the two axes (Complexity ×
 * Business differentiation) with their Low/High ticks and the translucent
 * Generic / Supporting / Core zone bands. The user places sub-domain dots,
 * movement arrows and the Notation legend on top of it.
 *
 * Mirrors the Wardley / EDGY / Cynefin backgrounds: extends
 * {@link GfxPrimitiveElementModel} so it inherits selection, move, copy/paste,
 * duplicate, align and undo/redo. Authored in a fixed reference space and scaled
 * uniformly to the element bounds by the renderer.
 */
export class CoreDomainChartElementModel extends GfxPrimitiveElementModel<CoreDomainChartProps> {
  get type() {
    return 'coreDomain';
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
    return polygonNearestPoint(Bound.deserialize(this.xywh).points, point) as IVec;
  }

  override includesPoint(x: number, y: number): boolean {
    const points = getPointsFromBoundWithRotation(this);
    return pointInPolygon([x, y], points);
  }

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(true)
  accessor showZones: boolean = true;

  @field(true)
  accessor showLabels: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,900,820]';
}
