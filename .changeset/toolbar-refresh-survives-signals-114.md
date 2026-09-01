---
'@labre/affine-shared': patch
'@labre/affine-widget-toolbar': patch
---

fix(blocks): contextual toolbar buttons repaint in place under @preact/signals-core 1.14

Clicking a stateful button in the element toolbar (resize, sketch/strict
validation modes, profile picker) wrote the new state to the document but left
the button showing the old one — the toolbar only caught up after
deselecting and reselecting the element.

`Flags.refresh()` forced a repaint by toggling a flag off and back on inside a
`batch()`. Since `@preact/signals-core` 1.14 a batch that ends on its initial
value no longer notifies subscribers, so every `refresh()` call became a silent
no-op. `Flags` now carries a revision counter that `refresh()` increments, and
the toolbar widget subscribes to it alongside the flag value, so a forced
refresh repaints without ever exposing a transient "no selection" frame.
