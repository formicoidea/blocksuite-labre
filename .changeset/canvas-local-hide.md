---
'@labre/std': minor
'@labre/affine-shared': minor
'@labre/affine-block-surface': minor
'@labre/affine-widget-edgeless-toolbar': minor
'@labre/affine': minor
---

Hide canvas elements for yourself only (ADR 0031, stage 3). Each row of the
selection pane gets an eye: a hidden element is no longer painted, picked by the
pointer or caught by the marquee on YOUR screen, and left out of your SVG and PNG
exports — nothing is written to the document, and nobody else's view, rules or
legends change. The row stays listed and selectable. The hide is remembered per
document in `localStorage` (`EditPropsStore`'s new `localHiddenElements`) and
pruned of deleted elements on load. New commands `canvas.visibility.hideLocal`
(with `hidden: false` to show again) and `canvas.visibility.showAll`, new
telemetry event `CanvasVisibilityChanged` (`target`, `scope: 'local'`, `hidden`,
`count`), new service `CanvasLocalVisibility`, and a per-editor hook
`gfx.localVisibility` in `@labre/std` that a host can read or register into.
