---
'@labre/affine-shared': minor
'@labre/affine-widget-edgeless-toolbar': minor
'@labre/affine-fragment-frame-panel': minor
'@labre/affine': minor
---

The selection pane and the frame panel scroll their list while a row is held near its top
or bottom edge, so a row can be dropped below the fold; the drop line follows the rows that
scroll under a still pointer, a wheel during the drag included. `PanelReorderDragOptions`
(`@labre/affine/host-panels`) gains an optional `scroller`: absent, a host's list behaves as
before; present, the controller scrolls it, faster the deeper in a 20 px band, at most 30 px
a frame, and stops at the end of the list or of the drag. New export `panelEdgeScrollDelta`
from `@labre/affine-shared/utils` (ADR 0034, amendment of 2026-11-04). Nothing persisted
changes.
