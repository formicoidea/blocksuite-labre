# @labre/global

## 0.34.2

## 0.34.1

## 0.34.0

## 0.33.0

## 0.32.0

### Patch Changes

- 5ac0c68: fix(edgeless): hit-testing a degraded connector (empty path) no longer throws

  Follow-up to the absent-endpoint render fix: a connector whose endpoint
  references a vanished element keeps its last bound, so it stays indexed and
  hoverable — and `getElementByPoint` calls `includesPoint` on every mouse
  move. `includesPoint` (Curve mode), `getNearestPoint`,
  `getPointByOffsetDistance` and `getOffsetDistanceByPoint` now degrade on an
  empty path (miss / element origin / bound center / midpoint) instead of
  throwing. At the source, `getBezierParameters` handles a zero-length path
  the same way it already handled a single point.

  Also: `_getConnectorEndElement` no longer casts away null, and
  `updatePath` skips the redundant `path = []` rewrite (no signal
  notification when the path is already empty).

- 5edd916: A big board stays responsive: the canvas redraws only what changed

  Every element event repainted the whole surface, and every stacking canvas was
  allocated at full viewport size however little of it a layer occupied — on a
  1440x900 screen at device pixel ratio 2 that is about 20 MB of pixel buffer per
  layer, whether the layer held one shape or a hundred. Editing a large map spent
  most of its frame budget in redraws nothing on screen could tell apart.

  A stacking canvas is now sized to the bound of the elements it actually holds,
  clipped to the viewport, and canvases freed by a layer change are pooled for
  reuse instead of being thrown away. A change to one element marks only the
  layer it lives in, so a pan, a zoom or a single edit no longer forces a full
  repaint. During a drag a layer's canvas is allowed to grow but never to shrink,
  so the dragged element does not flicker at the edge of its own canvas; the full
  redraw comes once, when the drag ends.

  The DOM renderers for brush, highlighter, shape and connector now keep the
  nodes they already built and overwrite their attributes, instead of rebuilding
  the whole SVG subtree on every frame — a hundred redraws of one stroke now
  allocate two nodes in total instead of two hundred.

  Alongside: a block host re-reads its stacking order when the layers change, so
  a reorder shows immediately; sending a mindmap node backwards moves the whole
  mindmap once rather than each selected node in turn; and a connector whose path
  is momentarily empty answers its geometry questions instead of throwing.

## 0.31.0

## 0.30.2

## 0.30.1

## 0.30.0

## 0.29.1

## 0.29.0

## 0.28.0

## 0.27.0

## 0.26.0

## 0.24.0

## 0.23.3

## 0.23.2

## 0.23.1

## 0.23.0
