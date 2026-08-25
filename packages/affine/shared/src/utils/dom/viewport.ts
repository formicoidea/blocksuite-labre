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
