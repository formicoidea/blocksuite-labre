import type { IVec } from '@labre/global/gfx';
import {
  Bound,
  getPointsFromBoundWithRotation,
  linePolygonIntersects,
  polygonNearestPoint,
} from '@labre/global/gfx';
import type { BaseElementProps, PointTestOptions } from '@labre/std/gfx';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';

import { backgroundIncludesPoint } from './hit-test.js';

/**
 * The props every framework background carries, whatever it draws.
 *
 * A concrete background adds its own on top — its labels, its per-part
 * visibility toggles, its variant — and those stay the framework's business:
 * they are what the document persists, and the primitive never renames them.
 */
export type FrameworkBackgroundProps = BaseElementProps & {
  /** When false the resize handles are hidden — toggled from the toolbar. */
  resizeEnabled?: boolean;
};

/**
 * The MODEL half of the framework-background primitive (PF2.1).
 *
 * A framework background is, geometrically, a rotated rectangle the user drops
 * other elements onto: it is selectable, movable, copy/pasteable and part of
 * undo/redo like any surface element, but it is a passive canvas — connectors
 * must not snap to it (an arrow connects nodes, never the map they sit on).
 *
 * That is the whole of it. Everything a framework's background LOOKS like is
 * declared, not coded — see `FrameworkBackgroundDef` in
 * `@labre/affine-block-surface`.
 *
 * Subclasses keep declaring their own `@field` props: this class adds no field
 * and renames none, so a document written before it existed is byte-identical
 * to one written after.
 */
export abstract class FrameworkBackgroundElementModel<
  Props extends BaseElementProps = FrameworkBackgroundProps,
> extends GfxPrimitiveElementModel<Props> {
  /**
   * The background is a passive canvas: connectors must not snap their
   * endpoints to it.
   */
  override get connectable() {
    return false;
  }

  override containsBound(bounds: Bound): boolean {
    const points = getPointsFromBoundWithRotation(this);
    return points.some(point => bounds.containsPoint(point));
  }

  /**
   * A marquee takes a board only when it takes the WHOLE board.
   *
   * Box selection keeps every element whose bound overlaps the rectangle the
   * pointer drew, which for a board means any rectangle drawn on its sheet —
   * the author lassoing three classes inside a frame got the frame too, and a
   * drag started on the empty sheet selected the sheet itself. That is the
   * interior answering a gesture R9 reserves for the border and the bands
   * (`includesPoint`), through a different door.
   *
   * The native `affine:frame` block already draws the line here: it joins a
   * box selection only when the box contains it. Same rule, same reason.
   * Consulted by the default `GfxElementModelView.onBoxSelected`; a view that
   * overrides that hook without calling it makes its own decision.
   */
  boxSelectable(box: Bound): boolean {
    return box.contains(this.elementBound);
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
   * Picked by its BORDER band, not by its whole area — see
   * {@link backgroundIncludesPoint} for the why and for what a caller asking
   * about the visible extent (`ignoreTransparent: false`) still gets.
   */
  override includesPoint(
    x: number,
    y: number,
    options?: PointTestOptions
  ): boolean {
    return backgroundIncludesPoint(this, x, y, options);
  }
}
