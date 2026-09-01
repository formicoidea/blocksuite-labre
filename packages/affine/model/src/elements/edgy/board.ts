import type { IVec } from '@labre/global/gfx';
import {
  Bound,
  getPointsFromBoundWithRotation,
  linePolygonIntersects,
  polygonNearestPoint,
} from '@labre/global/gfx';
import type { SerializedXYWH } from '@labre/global/gfx';
import type { BaseElementProps, PointTestOptions } from '@labre/std/gfx';
import { field, GfxPrimitiveElementModel } from '@labre/std/gfx';

import { backgroundIncludesPoint } from '../framework-background/index.js';

export type EdgyBoardProps = BaseElementProps & {
  /** When false the resize handles are hidden — toggled from the toolbar. */
  resizeEnabled?: boolean;
  /** When false the board stops granting the hover spotlight. */
  spotlightEnabled?: boolean;
};

/**
 * A blank white board for free-form EDGY modelling: the user places EDGY base
 * shapes and connectors on top of it and the board grants them the dependency
 * spotlight-on-hover behavior (see the surface `Spotlight` extension).
 *
 * Mirrors {@link EdgyFacetsElementModel}: a passive canvas that inherits
 * selection, move, copy/paste, duplicate, align and undo/redo for free.
 */
export class EdgyBoardElementModel extends GfxPrimitiveElementModel<EdgyBoardProps> {
  get type() {
    return 'edgyBoard';
  }

  /** Connectors must link elements, never the board itself. */
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
   * Picked by its BORDER band: a board is a passive canvas and the clicks over
   * its area belong to what the user laid on it. Same test every framework
   * background runs — see {@link backgroundIncludesPoint}.
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
  accessor spotlightEnabled: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,1600,1000]';
}
