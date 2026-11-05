import { Bound, clamp, type IPoint, type IVec, Vec } from '@labre/global/gfx';
import { signal } from '@preact/signals-core';
import debounce from 'lodash-es/debounce';
import { BehaviorSubject, debounceTime, Subject } from 'rxjs';

import type { GfxViewportElement } from '.';

function cutoff(value: number, ref: number, sign: number) {
  if (sign > 0 && value > ref) return ref;
  if (sign < 0 && value < ref) return ref;
  return value;
}

export const ZOOM_MAX = 6.0;
export const ZOOM_MIN = 0.1;
export const ZOOM_STEP = 0.25;
export const ZOOM_INITIAL = 1.0;

export const FIT_TO_SCREEN_PADDING = 100;

/**
 * The part of the viewport container something floats over, in screen pixels
 * per side: a panel docked over the canvas in overlay (the selection pane, the
 * artefact catalogue) covers the canvas without shrinking the container, so
 * the container rect alone says the whole canvas is visible (issue #433).
 */
export interface ViewportInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const NO_INSETS: Readonly<ViewportInsets> = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

/**
 * The smallest visible width or height {@link Viewport.visibleRect} answers,
 * in screen pixels. A panel at 85vw on a phone leaves a sliver; below this the
 * edge band and the fit maths would work on a strip nobody can use, so the
 * visible rect stops shrinking and overlaps the panel instead.
 */
export const MIN_VISIBLE_SIZE = 200;

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

function sanitizeInset(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * `padding` (top, right, bottom, left, in screen pixels) plus the viewport's
 * occupied insets, for a fit that should land in the visible part of the
 * canvas. Absolute pixels only: a padding below 1 that a caller means as a
 * percentage (`setViewportByBound`) must be resolved first.
 */
export function paddingWithInsets(
  viewport: Viewport,
  padding: [number, number, number, number] = [0, 0, 0, 0]
): [number, number, number, number] {
  const { top, right, bottom, left } = viewport.occupiedInsets$.value;
  const [pt, pr, pb, pl] = padding;
  return [pt + top, pr + right, pb + bottom, pl + left];
}

export interface ViewportRecord {
  left: number;
  top: number;
  viewportX: number;
  viewportY: number;
  zoom: number;
  viewScale: number;
}

export function clientToModelCoord(
  viewport: ViewportRecord,
  clientCoord: [number, number]
): IVec {
  const { left, top, viewportX, viewportY, zoom, viewScale } = viewport;

  const [clientX, clientY] = clientCoord;
  const viewportInternalX = clientX - left;
  const viewportInternalY = clientY - top;
  const modelX = viewportX + viewportInternalX / zoom / viewScale;
  const modelY = viewportY + viewportInternalY / zoom / viewScale;
  return [modelX, modelY];
}

export class Viewport {
  private _cachedBoundingClientRect: DOMRect | null = null;

  private _cachedOffsetWidth: number | null = null;

  private _resizeObserver: ResizeObserver | null = null;

  private readonly _resizeSubject = new Subject<{
    width: number;
    height: number;
    left: number;
    top: number;
  }>();

  private _isResizing = false;
  private _initialTopLeft: IVec | null = null;

  protected _center: IPoint = { x: 0, y: 0 };

  protected _shell: HTMLElement | null = null;

  protected _element: GfxViewportElement | null = null;

  protected _height = 0;

  protected _left = 0;

  protected _locked = false;

  protected _rafId: number | null = null;

  protected _top = 0;

  protected _width = 0;

  protected _zoom: number = 1.0;

  elementReady = new Subject<GfxViewportElement>();

  sizeUpdated = new Subject<{
    width: number;
    height: number;
    left: number;
    top: number;
  }>();

  viewportMoved = new Subject<IVec>();

  viewportUpdated = new Subject<{
    zoom: number;
    center: IVec;
  }>();

  zooming$ = new BehaviorSubject<boolean>(false);
  panning$ = new BehaviorSubject<boolean>(false);

  ZOOM_MAX = ZOOM_MAX;

  ZOOM_MIN = ZOOM_MIN;

  /** Every declared inset, by owner: one panel, one entry. */
  private readonly _occupiedInsets = new Map<string, ViewportInsets>();

  /**
   * The combined occupied insets: the max per side of every declaration, since
   * two panels docked on the same side (the catalogue and the selection pane)
   * overlap rather than stack. Runtime state only, never stored, never synced:
   * each peer's panels are its own.
   */
  readonly occupiedInsets$ = signal<Readonly<ViewportInsets>>(NO_INSETS);

  private readonly _resetZooming = debounce(() => {
    this.zooming$.next(false);
  }, 200);

  private readonly _resetPanning = debounce(() => {
    this.panning$.next(false);
  }, 200);

  constructor() {
    const subscription = this.elementReady.subscribe(el => {
      this._element = el;
      subscription.unsubscribe();
    });

    this._setupResizeObserver();
  }

  private _setupResizeObserver() {
    this._resizeSubject
      .pipe(debounceTime(200))
      .subscribe(({ width, height, left, top }) => {
        if (!this._shell || !this._initialTopLeft) return;
        this._completeResize(width, height, left, top);
      });
  }

  private _completeResize(
    width: number,
    height: number,
    left: number,
    top: number
  ) {
    if (!this._initialTopLeft) return;

    const [initialTopLeftX, initialTopLeftY] = this._initialTopLeft;
    const newCenterX = initialTopLeftX + width / (2 * this.zoom);
    const newCenterY = initialTopLeftY + height / (2 * this.zoom);

    this.setCenter(newCenterX, newCenterY, false);
    this._width = width;
    this._height = height;
    this._left = left;
    this._top = top;
    this._isResizing = false;
    this._initialTopLeft = null;

    this.sizeUpdated.next({
      left,
      top,
      width,
      height,
    });
  }

  private _forceCompleteResize() {
    if (this._isResizing && this._shell) {
      const { width, height, left, top } = this.boundingClientRect;
      this._completeResize(width, height, left, top);
    }
  }

  get boundingClientRect() {
    if (!this._shell) return new DOMRect(0, 0, 0, 0);
    if (!this._cachedBoundingClientRect) {
      this._cachedBoundingClientRect = this._shell.getBoundingClientRect();
    }
    return this._cachedBoundingClientRect;
  }

  get element() {
    return this._element;
  }

  get center() {
    return this._center;
  }

  get centerX() {
    return this._center.x;
  }

  get centerY() {
    return this._center.y;
  }

  get height() {
    return this.boundingClientRect.height;
  }

  get left() {
    return this._left;
  }

  // Does not allow the user to move and zoom the canvas in copilot tool
  get locked() {
    return this._locked;
  }

  set locked(locked: boolean) {
    this._locked = locked;
  }

  /**
   * Note this is different from the zoom property.
   * The editor itself may be scaled by outer container which is common in nested editor scenarios.
   * This property is used to calculate the scale of the editor.
   *
   * The scale is read as "what the host paints" over "what the host lays out":
   * `getBoundingClientRect().width` is the painted width, transforms included
   * and fractional; `offsetWidth` is the laid out width with no transform, but
   * the browser gives it as an integer — it rounds both border-box edges, so it
   * can sit up to a pixel away from the fractional width even when nothing is
   * scaled at all. A host that is merely a fraction of a pixel wide (a HiDPI
   * window, a flex remainder) would otherwise report a phantom scale of
   * ~1.0001, and every pointer delta divided by it comes back short: a 100px
   * drag moves the element 99.986. Below the rounding error there is no scale
   * to read, so answer exactly 1; a container that really scales the editor is
   * orders of magnitude past that pixel.
   */
  get viewScale() {
    if (
      !this._shell ||
      this._cachedOffsetWidth === null ||
      this._cachedOffsetWidth === 0
    )
      return 1;
    const width = this.boundingClientRect.width;
    // offsetWidth is rounded to an integer while the client rect is not:
    // on fractional devicePixelRatio displays an untransformed shell has a
    // fractional CSS width, which must not be mistaken for an outer scale.
    if (Math.abs(width - this._cachedOffsetWidth) <= 0.5) return 1;
    return width / this._cachedOffsetWidth;
  }

  get top() {
    return this._top;
  }

  get translateX() {
    return -this.viewportX * this.zoom;
  }

  get translateY() {
    return -this.viewportY * this.zoom;
  }

  /**
   * The part of the container nothing floats over, in client coordinates: the
   * container rect less {@link occupiedInsets$}. Each dimension is kept at
   * {@link MIN_VISIBLE_SIZE} (or the container's own size when smaller); the
   * rect then slides back inside the container rather than past its edge.
   * With no inset declared it is exactly the container rect.
   */
  get visibleRect() {
    const { left, top, width, height } = this;
    const insets = this.occupiedInsets$.value;
    const visibleWidth = Math.max(
      width - insets.left - insets.right,
      Math.min(MIN_VISIBLE_SIZE, width)
    );
    const visibleHeight = Math.max(
      height - insets.top - insets.bottom,
      Math.min(MIN_VISIBLE_SIZE, height)
    );
    return {
      left: clamp(left + insets.left, left, left + width - visibleWidth),
      top: clamp(top + insets.top, top, top + height - visibleHeight),
      width: visibleWidth,
      height: visibleHeight,
    };
  }

  get viewportBounds() {
    const { viewportMinXY, viewportMaxXY } = this;

    return Bound.from({
      ...viewportMinXY,
      w: viewportMaxXY.x - viewportMinXY.x,
      h: viewportMaxXY.y - viewportMinXY.y,
    });
  }

  get viewportMaxXY() {
    const { centerX, centerY, width, height, zoom } = this;
    return {
      x: centerX + width / 2 / zoom,
      y: centerY + height / 2 / zoom,
    };
  }

  get viewportMinXY() {
    const { centerX, centerY, width, height, zoom } = this;
    return {
      x: centerX - width / 2 / zoom,
      y: centerY - height / 2 / zoom,
    };
  }

  get viewportX() {
    const { centerX, width, zoom } = this;
    return centerX - width / 2 / zoom;
  }

  get viewportY() {
    const { centerY, height, zoom } = this;
    return centerY - height / 2 / zoom;
  }

  get width() {
    return this.boundingClientRect.width;
  }

  get zoom() {
    return this._zoom;
  }

  applyDeltaCenter(deltaX: number, deltaY: number) {
    this.setCenter(this.centerX + deltaX, this.centerY + deltaY);
  }

  clearViewportElement() {
    if (this._resizeObserver && this._shell) {
      this._resizeObserver.unobserve(this._shell);
      this._resizeObserver.disconnect();
    }
    this._resizeObserver = null;
    this._shell = null;
    this._cachedBoundingClientRect = null;
    this._cachedOffsetWidth = null;
  }

  dispose() {
    this.clearViewportElement();
    this.sizeUpdated.complete();
    this.viewportMoved.complete();
    this.viewportUpdated.complete();
    this._resizeSubject.complete();
    this.zooming$.complete();
    this.panning$.complete();
  }

  getFitToScreenData(
    bounds?: Bound | null,
    padding: [number, number, number, number] = [0, 0, 0, 0],
    maxZoom = ZOOM_MAX,
    fitToScreenPadding = 100
  ) {
    let { centerX, centerY, zoom } = this;

    if (!bounds) {
      return { zoom, centerX, centerY };
    }

    const { x, y, w, h } = bounds;
    const [pt, pr, pb, pl] = padding;
    const { width, height } = this;

    zoom = Math.min(
      (width - fitToScreenPadding - (pr + pl)) / w,
      (height - fitToScreenPadding - (pt + pb)) / h
    );
    zoom = clamp(zoom, ZOOM_MIN, clamp(maxZoom, ZOOM_MIN, ZOOM_MAX));

    centerX = x + (w + pr / zoom) / 2 - pl / zoom / 2;
    centerY = y + (h + pb / zoom) / 2 - pt / zoom / 2;

    return { zoom, centerX, centerY };
  }

  isInViewport(bound: Bound) {
    const viewportBounds = Bound.from(this.viewportBounds);
    return (
      viewportBounds.contains(bound) ||
      viewportBounds.isIntersectWithBound(bound)
    );
  }

  onResize() {
    if (!this._shell) return;

    if (!this._isResizing) {
      this._isResizing = true;
      this._initialTopLeft = this.toModelCoord(0, 0);
    }

    const { left, top, width, height } = this.boundingClientRect;
    this._cachedOffsetWidth = this._shell.offsetWidth;

    this._left = left;
    this._top = top;
    this._resizeSubject.next({
      left,
      top,
      width,
      height,
    });
  }

  /**
   * Set the center of the viewport.
   * @param centerX The new x coordinate of the center of the viewport.
   * @param centerY The new y coordinate of the center of the viewport.
   * @param forceUpdate Whether to force complete any pending resize operations before setting the viewport.
   */
  setCenter(centerX: number, centerY: number, forceUpdate = true) {
    if (forceUpdate && this._isResizing) {
      this._forceCompleteResize();
    }

    this._center.x = centerX;
    this._center.y = centerY;
    this.panning$.next(true);
    this.viewportUpdated.next({
      zoom: this.zoom,
      center: Vec.toVec(this.center) as IVec,
    });
    this._resetPanning();
  }

  setRect(left: number, top: number, width: number, height: number) {
    if (this._isResizing) {
      this._left = left;
      this._top = top;
      return;
    }

    this._left = left;
    this._top = top;
    this.sizeUpdated.next({
      left,
      top,
      width,
      height,
    });
  }

  /**
   * Set the viewport to the new zoom and center.
   * @param newZoom The new zoom value.
   * @param newCenter The new center of the viewport.
   * @param smooth Whether to animate the zooming and panning.
   * @param forceUpdate Whether to force complete any pending resize operations before setting the viewport.
   */
  setViewport(
    newZoom: number,
    newCenter = Vec.toVec(this.center),
    smooth = false,
    forceUpdate = true
  ) {
    // Force complete any pending resize operations if forceUpdate is true
    if (forceUpdate && this._isResizing) {
      this._forceCompleteResize();
    }

    const preZoom = this._zoom;
    if (smooth) {
      const cofficient = preZoom / newZoom;
      if (cofficient === 1) {
        this.smoothTranslate(newCenter[0], newCenter[1]);
      } else {
        const center = [this.centerX, this.centerY] as IVec;
        const focusPoint = Vec.mul(
          Vec.sub(newCenter, Vec.mul(center, cofficient)),
          1 / (1 - cofficient)
        );
        this.smoothZoom(newZoom, Vec.toPoint(focusPoint));
      }
    } else {
      this._center.x = newCenter[0];
      this._center.y = newCenter[1];
      this.setZoom(newZoom, undefined, false, forceUpdate);
    }
  }

  /**
   * Set the viewport to fit the bound with padding.
   * @param bound The bound will be zoomed to fit the viewport.
   * @param padding The padding will be applied to the bound after zooming, default is [0, 0, 0, 0],
   *                the value may be reduced if there is not enough space for the padding.
   *                Use decimal less than 1 to represent percentage padding. e.g. [0.1, 0.1, 0.1, 0.1] means 10% padding.
   * @param smooth whether to animate the zooming
   * @param forceUpdate whether to force complete any pending resize operations before setting the viewport
   */
  setViewportByBound(
    bound: Bound,
    padding: [number, number, number, number] = [0, 0, 0, 0],
    smooth = false,
    forceUpdate = true
  ) {
    let [pt, pr, pb, pl] = padding;

    // Convert percentage padding to absolute values if they are between 0 and 1
    if (pt > 0 && pt < 1) pt *= this.height;
    if (pr > 0 && pr < 1) pr *= this.width;
    if (pb > 0 && pb < 1) pb *= this.height;
    if (pl > 0 && pl < 1) pl *= this.width;

    // Calculate zoom
    let zoom = Math.min(
      (this.width - (pr + pl)) / bound.w,
      (this.height - (pt + pb)) / bound.h
    );

    // Adjust padding if space is not enough
    if (zoom < this.ZOOM_MIN) {
      zoom = this.ZOOM_MIN;
      const totalPaddingWidth = this.width - bound.w * zoom;
      const totalPaddingHeight = this.height - bound.h * zoom;
      pr = pl = Math.max(totalPaddingWidth / 2, 1);
      pt = pb = Math.max(totalPaddingHeight / 2, 1);
    }

    // Ensure zoom does not exceed ZOOM_MAX
    if (zoom > this.ZOOM_MAX) {
      zoom = this.ZOOM_MAX;
    }

    const center = [
      bound.x + (bound.w + pr / zoom) / 2 - pl / zoom / 2,
      bound.y + (bound.h + pb / zoom) / 2 - pt / zoom / 2,
    ] as IVec;

    this.setViewport(zoom, center, smooth, forceUpdate);
  }

  /**
   * Declare that `owner` covers part of the container (issue #433). A second
   * call for the same owner replaces its declaration. The returned function
   * withdraws it — and only it: a stale withdrawal after a newer declaration
   * by the same owner leaves the newer one in place.
   */
  setOccupiedInset(owner: string, insets: Partial<ViewportInsets>): () => void {
    const entry: ViewportInsets = {
      top: sanitizeInset(insets.top),
      right: sanitizeInset(insets.right),
      bottom: sanitizeInset(insets.bottom),
      left: sanitizeInset(insets.left),
    };
    this._occupiedInsets.set(owner, entry);
    this._combineOccupiedInsets();
    return () => {
      if (this._occupiedInsets.get(owner) !== entry) return;
      this._occupiedInsets.delete(owner);
      this._combineOccupiedInsets();
    };
  }

  private _combineOccupiedInsets() {
    const entries = [...this._occupiedInsets.values()];
    const combined: ViewportInsets = {
      top: Math.max(0, ...entries.map(entry => entry.top)),
      right: Math.max(0, ...entries.map(entry => entry.right)),
      bottom: Math.max(0, ...entries.map(entry => entry.bottom)),
      left: Math.max(0, ...entries.map(entry => entry.left)),
    };
    const current = this.occupiedInsets$.peek();
    // An unchanged value is not written: every reader would repaint for nothing.
    if (SIDES.every(side => current[side] === combined[side])) return;
    this.occupiedInsets$.value = SIDES.some(side => combined[side] > 0)
      ? Object.freeze(combined)
      : NO_INSETS;
  }

  /** This is the outer container of the viewport, which is the host of the viewport element */
  setShellElement(el: HTMLElement) {
    this._shell = el;
    this._cachedBoundingClientRect = el.getBoundingClientRect();
    this._cachedOffsetWidth = el.offsetWidth;

    const { left, top, width, height } = this._cachedBoundingClientRect;
    this.setRect(left, top, width, height);

    this._resizeObserver = new ResizeObserver(() => {
      this._cachedBoundingClientRect = null;
      this._cachedOffsetWidth = null;
      this.onResize();
    });
    this._resizeObserver.observe(el);
  }

  /**
   * Set the viewport to the new zoom.
   * @param zoom The new zoom value.
   * @param focusPoint The point to focus on after zooming, default is the center of the viewport.
   * @param wheel Whether the zoom is caused by wheel event.
   * @param forceUpdate Whether to force complete any pending resize operations before setting the viewport.
   */
  setZoom(
    zoom: number,
    focusPoint?: IPoint,
    wheel = false,
    forceUpdate = true
  ) {
    if (forceUpdate && this._isResizing) {
      this._forceCompleteResize();
    }

    const prevZoom = this.zoom;
    focusPoint = (focusPoint ?? this._center) as IPoint;
    this._zoom = clamp(zoom, this.ZOOM_MIN, this.ZOOM_MAX);
    const newZoom = this.zoom;

    const offset = Vec.sub(Vec.toVec(this.center), Vec.toVec(focusPoint));
    const newCenter = Vec.add(
      Vec.toVec(focusPoint),
      Vec.mul(offset, prevZoom / newZoom)
    );
    if (wheel) {
      this.zooming$.next(true);
    }
    this.setCenter(newCenter[0], newCenter[1], forceUpdate);
    this.viewportUpdated.next({
      zoom: this.zoom,
      center: Vec.toVec(this.center) as IVec,
    });
    this._resetZooming();
  }

  smoothTranslate(x: number, y: number, numSteps = 10) {
    const { center } = this;
    const delta = { x: x - center.x, y: y - center.y };
    const innerSmoothTranslate = () => {
      if (this._rafId) cancelAnimationFrame(this._rafId);
      this._rafId = requestAnimationFrame(() => {
        const step = { x: delta.x / numSteps, y: delta.y / numSteps };
        const nextCenter = {
          x: this.centerX + step.x,
          y: this.centerY + step.y,
        };
        const signX = delta.x > 0 ? 1 : -1;
        const signY = delta.y > 0 ? 1 : -1;
        nextCenter.x = cutoff(nextCenter.x, x, signX);
        nextCenter.y = cutoff(nextCenter.y, y, signY);
        this.setCenter(nextCenter.x, nextCenter.y, true);

        if (nextCenter.x != x || nextCenter.y != y) innerSmoothTranslate();
      });
    };
    innerSmoothTranslate();
  }

  smoothZoom(zoom: number, focusPoint?: IPoint, numSteps = 10) {
    const delta = zoom - this.zoom;
    if (this._rafId) cancelAnimationFrame(this._rafId);

    const innerSmoothZoom = () => {
      this._rafId = requestAnimationFrame(() => {
        const sign = delta > 0 ? 1 : -1;
        const step = delta / numSteps;
        const nextZoom = cutoff(this.zoom + step, zoom, sign);

        this.setZoom(nextZoom, focusPoint, undefined, true);

        if (nextZoom != zoom) innerSmoothZoom();
      });
    };
    innerSmoothZoom();
  }

  toModelBound(bound: Bound) {
    const { w, h } = bound;
    const [x, y] = this.toModelCoord(bound.x, bound.y);

    return new Bound(x, y, w / this.zoom, h / this.zoom);
  }

  toModelCoord(
    viewX: number,
    viewY: number,
    zoom = this.zoom,
    center?: IPoint
  ): IVec {
    const { viewScale } = this;
    const viewportX = center
      ? center.x - this.width / 2 / zoom
      : this.viewportX;
    const viewportY = center
      ? center.y - this.height / 2 / zoom
      : this.viewportY;

    return [
      viewportX + viewX / zoom / viewScale,
      viewportY + viewY / zoom / viewScale,
    ];
  }

  toModelCoordFromClientCoord([x, y]: IVec): IVec {
    return clientToModelCoord(this, [x, y]);
  }

  toViewBound(bound: Bound) {
    const { w, h } = bound;
    const [x, y] = this.toViewCoord(bound.x, bound.y);

    return new Bound(x, y, w * this.zoom, h * this.zoom);
  }

  toViewCoord(modelX: number, modelY: number): IVec {
    const { viewportX, viewportY, zoom, viewScale } = this;
    return [
      (modelX - viewportX) * zoom * viewScale,
      (modelY - viewportY) * zoom * viewScale,
    ];
  }

  toViewCoordFromClientCoord([x, y]: IVec): IVec {
    const { left, top } = this;
    return [x - left, y - top];
  }

  serializeRecord() {
    return JSON.stringify({
      left: this.left,
      top: this.top,
      viewportX: this.viewportX,
      viewportY: this.viewportY,
      zoom: this.zoom,
      viewScale: this.viewScale,
    });
  }

  deserializeRecord(record?: string) {
    try {
      const result = JSON.parse(record || '{}') as ViewportRecord;
      if (!('zoom' in result)) return null;
      return result;
    } catch (error) {
      console.error('Failed to deserialize viewport record:', error);
      return null;
    }
  }
}
