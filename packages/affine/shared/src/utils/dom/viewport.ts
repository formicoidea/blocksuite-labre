import type { EditorHost } from '@labre/std';

/**
 * Get editor viewport element.
 * @example
 * ```ts
 * const viewportElement = getViewportElement(this.model.doc);
 * if (!viewportElement) return;
 * this._disposables.addFromEvent(viewportElement, 'scroll', () => {
 *   updatePosition();
 * });
 * ```
 */
export function getViewportElement(editorHost: EditorHost) {
  return (
    editorHost.closest<HTMLElement>('.affine-page-viewport') ??
    editorHost.closest<HTMLElement>('.affine-edgeless-viewport')
  );
}

/**
 * Where a model point lands, in CSS pixels, for an overlay drawn *inside* the
 * edgeless container: the selection rectangle, the resize handles, the remote
 * cursors, the text editors mounted over an element.
 *
 * `Viewport.toViewCoord` answers in real screen pixels, so it multiplies by
 * `viewScale` — the CSS scale an outer container puts on the whole editor,
 * which is not 1 in a nested editor such as an embedded synced edgeless doc.
 * An overlay lives *inside* that container, so its placement has to be stated
 * in the container's already scaled space, exactly the way
 * `GfxBlockComponent.getCSSTransform` states a block's. Positioning an overlay
 * from `toViewCoord` lets the container apply its scale a second time, and the
 * overlay drifts away from the element it decorates as soon as
 * `viewScale !== 1`.
 */
export function toOverlayCoord(
  viewport: {
    viewportX: number;
    viewportY: number;
    zoom: number;
    viewScale: number;
  },
  modelX: number,
  modelY: number
): [number, number] {
  const { viewportX, viewportY, zoom, viewScale } = viewport;
  return [
    ((modelX - viewportX) * zoom) / viewScale,
    ((modelY - viewportY) * zoom) / viewScale,
  ];
}

/**
 * The scale an overlay drawn inside the edgeless container has to wear so that
 * it ends up painted at the viewport zoom. Counterpart of
 * {@link toOverlayCoord}; same reasoning about `viewScale`.
 */
export function overlayScale(viewport: { zoom: number; viewScale: number }) {
  return viewport.zoom / viewport.viewScale;
}

/**
 * How wide and tall the visible viewport is *in the same units as*
 * {@link toOverlayCoord}, so an overlay can tell whether it is about to run off
 * the edge.
 *
 * `Viewport.width` / `Viewport.height` are the bounding client rect, i.e. real
 * screen pixels. Comparing an overlay coordinate against them mixes two spaces
 * and the flip or the clamp fires at the wrong moment under a scaled host.
 */
export function overlayViewportSize(viewport: {
  width: number;
  height: number;
  viewScale: number;
}): [number, number] {
  const { width, height, viewScale } = viewport;
  return [width / viewScale, height / viewScale];
}

/**
 * Where a model point lands in *client* coordinates — what
 * `document.caretRangeFromPoint`, `elementFromPoint` and a `PointerEvent`'s
 * `clientX`/`clientY` speak.
 *
 * `Viewport.toViewCoord` answers relative to the viewport element's own top
 * left corner, so handing its result to a client-coordinate API drops the
 * viewport's offset in the window: the caret lands elsewhere as soon as the
 * editor is not flush against the window origin — a sidebar, a header, or the
 * editor embedded in a panel. Inverse of `Viewport.toViewCoordFromClientCoord`.
 */
export function toClientCoord(
  viewport: {
    left: number;
    top: number;
    toViewCoord: (modelX: number, modelY: number) => number[];
  },
  modelX: number,
  modelY: number
): [number, number] {
  const [x, y] = viewport.toViewCoord(modelX, modelY);
  return [x + viewport.left, y + viewport.top];
}
